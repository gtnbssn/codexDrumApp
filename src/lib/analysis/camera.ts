import { HandStrokeEstimator } from './hand-strokes';
import type { HandFrame, HandSide, TrackingReply, TrackingRequest } from './hand-tracking';

/** Owns camera/worker lifetime. Only one frame can be in flight; slow devices
 * drop frames rather than building a queue of stale stroke estimates.
 */
export class StrokeCamera {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private worker: Worker | null = null;
  private frame = 0;
  private closed = false;
  private pending = false;
  private resetAt = 0;
  private rejectLoad: ((error: Error) => void) | undefined;
  private strokes = new HandStrokeEstimator();

  reset() {
    this.resetAt = performance.now();
    this.strokes.reset();
  }

  async connect(
    video: HTMLVideoElement,
    onStroke: (side: HandSide) => void,
    onFrame: (frame: HandFrame) => void,
    onFailure: (error: Error) => void,
  ) {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Camera access needs HTTPS or localhost and a supported browser.');
    if (!('OffscreenCanvas' in window) || !('createImageBitmap' in window))
      throw new Error(
        'Hand tracking needs a browser with OffscreenCanvas and ImageBitmap support.',
      );
    this.video = video;
    let processedFrames = 0;
    try {
      this.worker = new Worker(new URL('./hand-tracking.worker.ts', import.meta.url), {
        type: 'module',
      });
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Hand tracking took too long to load. Try again.')),
          30000,
        );
        this.rejectLoad = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
        const fail = (message: string) => {
          const error = new Error(`Hand tracking failed. ${message}`);
          if (this.rejectLoad) this.rejectLoad(error);
          else {
            this.disconnect();
            onFailure(error);
          }
        };
        this.worker!.onerror = () =>
          fail('The MediaPipe worker could not run. Try a current browser.');
        this.worker!.onmessage = (event: MessageEvent<TrackingReply>) => {
          if (this.closed) return;
          const result = event.data;
          if (result.type === 'ready') {
            clearTimeout(timeout);
            this.rejectLoad = undefined;
            resolve();
          } else if (result.type === 'error') {
            fail(`Check that the local model and runtime files are available. ${result.message}`);
          } else {
            this.pending = false;
            // Discard movement captured before a new session/reset, even if
            // its inference reply arrives afterwards. Still draw its landmarks.
            if (result.timestamp >= this.resetAt) {
              for (const side of this.strokes.update(result.hands, result.timestamp))
                onStroke(side);
            }
            onFrame({
              hands: result.hands,
              timestamp: result.timestamp,
              processedFrames: ++processedFrames,
            });
          }
        };
        this.post({
          type: 'load',
          assetBase: new URL(`${import.meta.env.BASE_URL}mediapipe`, location.href).href,
        });
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      // A permission prompt can resolve after cancellation/navigation.
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException('Camera connection cancelled.', 'AbortError');
      }
      this.stream = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (!this.closed) {
          this.disconnect();
          onFailure(new Error('The camera was disconnected. Reconnect it to resume tracking.'));
        }
      });
      video.srcObject = stream;
      await video.play();
      if (this.closed) return;
      let lastFrame = -Infinity;
      let lastVideoTime = -1;
      const sample = (timestamp: number) => {
        if (this.closed) return;
        this.frame = requestAnimationFrame(sample);
        if (
          this.pending ||
          video.readyState < 2 ||
          timestamp - lastFrame < 50 ||
          video.currentTime === lastVideoTime
        )
          return;
        lastFrame = timestamp;
        lastVideoTime = video.currentTime;
        this.pending = true;
        const width = Math.min(480, video.videoWidth);
        void createImageBitmap(video, {
          resizeWidth: width,
          resizeHeight: Math.round((width * video.videoHeight) / video.videoWidth),
        })
          .then((image) => {
            if (this.closed) {
              image.close();
              return;
            }
            try {
              this.post({ type: 'frame', image, timestamp }, [image]);
            } catch (error) {
              image.close();
              throw error;
            }
          })
          .catch(() => {
            if (!this.closed) {
              this.disconnect();
              onFailure(new Error('Could not read camera frames. Reconnect the camera to retry.'));
            }
          });
      };
      this.frame = requestAnimationFrame(sample);
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  private post(message: TrackingRequest, transfer: Transferable[] = []) {
    this.worker?.postMessage(message, transfer);
  }

  disconnect() {
    this.closed = true;
    this.rejectLoad?.(new DOMException('Camera connection cancelled.', 'AbortError'));
    this.rejectLoad = undefined;
    cancelAnimationFrame(this.frame);
    this.worker?.terminate();
    this.worker = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
    this.strokes.reset();
  }
}
