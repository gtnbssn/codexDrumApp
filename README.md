# Pocket

A calm, focused drum practice app built with **Svelte 5, TypeScript, and Vite**. No backend, account, or API keys. Your practice history stays in your browser.

## Run it

Use Node.js 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

Vite runs on port 5173 by default. Microphone and camera access require a secure origin (HTTPS or localhost) and explicit browser permission. Headphones keep the metronome out of the microphone input.

```sh
npm run check       # Svelte + TypeScript diagnostics
npm test            # Timing, drill rules, backup validation, and onset detection
npm run build       # Production files in dist/
npm run preview     # Serve the production build
npm run test:e2e    # Real Chromium browser flows, with synthetic media devices
npm run format     # Format source with Prettier
```

Browser tests use `/usr/bin/chromium`. Set `CHROMIUM_PATH` to another Chromium executable on your own machine. Playwright starts a test server automatically. The app's fonts are bundled locally; runtime use does not depend on a font CDN.

## What you can do

- Practice single strokes, double strokes, paradiddles, shifting accents, a disappearing click, and a progressive tempo ladder.
- Set 30–240 BPM, a 1–60 minute session, volume, mute, and an optional one-bar count-in. The tempo ladder adds 4 BPM every four practice bars, capped at 240.
- Follow a live sticking grid. The count-in is excluded from saved practice time and timing analysis.
- Save completed or partial sessions, add reflections, and review practice time, timing estimates, and weekly goals.
- Build a recurring weekly practice plan, then launch drills with your planned tempo and duration.
- Enable optional microphone onset detection or an experimental webcam motion tracker.
- Measure acoustic round-trip latency in a short, separate calibration test and save compensation for future sessions.
- Export/import JSON backups. Import requires confirmation before replacing your data. Session deletion also requires confirmation.

## Calibrate audio latency

Open **Practice room → Performance analysis → Calibrate latency**. Use your usual microphone and audio output, put one headphone cup close to the microphone, and keep the room quiet. Do not play or tap along: this measures the audio path, not your reaction time.

The test plays eight isolated clicks in about **eleven seconds**, checks whether the microphone hears them at a repeatable delay, and offers **Use … ms** only for a reliable result. It reports the median delay and repeatability. You can adjust test volume and detection threshold and retry if the signal is too quiet. Cancellation stops the test and releases the microphone. Failed or cancelled tests leave your compensation unchanged and never create practice sessions.

Applying a result saves compensation and its detection threshold in this browser. Manual compensation also persists, from −200 to +1000 ms; the automatic test searches for delays from 0 to 850 ms. Positive compensation shifts recorded hits earlier. Session results record which compensation was used. The final microphone hits are allowed to arrive after the metronome stops, without adding that wait to your practice duration.

This is an **acoustic round-trip estimate**: output buffering, headphone/speaker playback, sound travel, microphone/input buffering, and detector delay are combined. It is appropriate for scoring against the audible click. Browser `baseLatency`/`outputLatency` estimates alone do not include the full microphone path. The test rejects inconsistent delays but cannot guarantee absolute accuracy. Wireless jitter, noise, echoes, or device processing can still affect results. A hardware interface's dedicated loopback can provide a more controlled path when available.

Recalibrate after switching headphones, microphone, audio interface, or Bluetooth mode. On microphone connection, known input IDs, sample rates, and default output labels are checked; a detected change resets compensation to zero and requests recalibration. Browsers cannot expose every operating-system routing change, so this check is not a guarantee. Calibration stays out of portable session backups because another device can have a different delay.

You can also end any ordinary practice session early with **End session**; the duration selector is a target rather than a minimum wait.

## Read the code

Start at [`src/App.svelte`](src/App.svelte), then follow the modules below. Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) manage the UI; there is no extra state library or routing framework.

```text
src/
  App.svelte                    App shell and four hash-based screens
  app.css                       Stylesheet entry point
  styles/                       Tokens, layout, screen styles, responsive overrides
  lib/
    types.ts                    Shared data shapes
    data/drills.ts              Drill patterns, instructions, tempo rules
    audio/metronome.ts          Look-ahead Web Audio click scheduler
    audio/click-sound.ts        Click envelope shared by practice and calibration
    analysis/microphone.ts      Microphone lifecycle and AudioWorklet connection
    analysis/calibrate.ts       Cancellable loopback capture and click scheduling
    analysis/latency.ts         Probe matching, robust latency estimate, route checks
    analysis/camera.ts          Two-zone frame-difference motion experiment
    stores/practice.svelte.ts   Reactive history/plan store and browser persistence
    stores/audio-settings.svelte.ts  Device-specific latency/threshold persistence
    utils/timing.ts            Hit matching, timing statistics, calendar helpers
    utils/backup.ts            Validate untrusted backup files
    utils/dialog.ts            Accessible native dialog lifecycle
    components/               Practice room, feedback, library, progress, planner
public/
  onset-processor.js           Audio-thread transient detector
tests/
  practice.e2e.ts              Browser workflow and media connection checks
  calibration.e2e.ts           Known-delay loopback, persistence, failures, cancellation
```

[`docs/how-it-works.md`](docs/how-it-works.md) explains timing, scoring, storage, and how to add a drill.

## Measurement limits

Microphone analysis detects **amplitude transients**, not drum types or hand identity. It stores timestamps and aggregate results, never raw audio. Timing estimates depend on your microphone, room, threshold, and hardware latency. Use the calibration test or enter a known compensation; positive values shift detected hits earlier. At fast subdivisions, multiple hits can fall within the matching window; treat scores as approximate feedback, not a certification of accuracy.

The webcam feature counts **motion bursts** in left and right image zones. Keep the camera fixed, with one hand in each zone and a stable background. It does not recognize poses, sticks, actual drum contact, or safe technique. No video is retained. Browser tests exercise synthetic media pipelines; real instrument and real camera accuracy still need validation on your hardware.

The app uses `localStorage`, so history is specific to a browser and origin. Export backups before clearing site data, changing the address, or changing devices. There is no server or cloud synchronization. An in-progress session is saved when you end it or the timer completes; an unexpected tab closure can lose that session. Navigation is disabled while practicing to prevent accidental loss.
