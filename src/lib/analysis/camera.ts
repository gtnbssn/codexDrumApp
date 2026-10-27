/** Small, dependency-free motion experiment.
 * Changes in two image zones count motion bursts. This does not infer pose,
 * stick technique, impact timing, or actual contact with a drum.
 */
export class StrokeCamera {
  private stream: MediaStream | null = null;
  private frame = 0;
  private previous: Uint8ClampedArray | null = null;
  private active = [false, false];
  private lastStroke = [0, 0];

  async connect(
    video: HTMLVideoElement,
    onStroke: (side: 'left' | 'right') => void,
    onMotion: (left: number, right: number) => void,
  ) {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Camera access needs HTTPS or localhost and a supported browser.');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      video.srcObject = this.stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 60;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas is not supported in this browser.');
      const sample = () => {
        context.drawImage(video, 0, 0, 80, 60);
        const pixels = context.getImageData(0, 0, 80, 60).data;
        const motion = [0, 0];
        if (this.previous) {
          for (let y = 12; y < 54; y++) {
            for (let x = 8; x < 72; x++) {
              const i = (y * 80 + x) * 4;
              const difference =
                Math.abs(pixels[i] - this.previous[i]) +
                Math.abs(pixels[i + 1] - this.previous[i + 1]) +
                Math.abs(pixels[i + 2] - this.previous[i + 2]);
              if (difference > 90) motion[x < 40 ? 1 : 0]++; // Mirror to match the preview.
            }
          }
          motion.forEach((amount, side) => {
            const moving = amount > 65;
            if (moving && !this.active[side] && performance.now() - this.lastStroke[side] > 150) {
              onStroke(side === 0 ? 'left' : 'right');
              this.lastStroke[side] = performance.now();
            }
            this.active[side] = moving;
          });
          onMotion(motion[0] / 300, motion[1] / 300);
        }
        this.previous = new Uint8ClampedArray(pixels);
        this.frame = requestAnimationFrame(sample);
      };
      this.frame = requestAnimationFrame(sample);
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  disconnect() {
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.previous = null;
  }
}
