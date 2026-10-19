# How Pocket works

## 1. A drill is data

`src/lib/data/drills.ts` holds each drill's sticking, accents, subdivision, instructions, default tempo, and duration. Every pattern covers four quarter-note beats. For example:

```ts
subdivision: 2,
sticking: ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L'],
accents: [0, 4],
```

That is eight eighth notes. The UI highlights the first and fifth notes as accents. The click marks quarter notes and subdivisions; downbeats have a higher pitch. Highlighted sticking accents are instructions for your hands, not different click pitches.

To add a drill, add a typed object to `drills`. The library, planner, and practice room pick it up automatically. Keep `sticking.length === subdivision * 4`. `gapBars` silences every fourth practice bar; `tempoLadder` raises the tempo after each group of four practice bars.

## 2. The sound clock leads

JavaScript timers can drift when a browser is busy. `Metronome` uses a timer only to look ahead: every 25 ms, it schedules the next 120 ms of clicks on `AudioContext.currentTime`. Web Audio determines when those clicks sound. A separate UI callback follows the scheduled timestamps; it does not control the audio.

The engine reports both scheduled notes and visible ticks. `PracticeRoom` collects expected hit timestamps from scheduled notes and updates the beat grid from visible ticks. All pattern subdivisions are expected strokes, including during silent gap bars. The optional count-in is one full bar and is excluded from analysis, elapsed practice time, gap-bar counting, and the tempo ladder.

The session timer uses elapsed audio-clock time. Ending a session cancels future clicks, closes input streams, and saves a session if at least one second of practice elapsed. Very short starts/count-ins are discarded. Navigation is blocked during a session, and the browser is asked to warn before closing the tab.

## 3. Microphone input becomes timestamps

`Microphone` connects an input stream to `public/onset-processor.js`, an AudioWorklet running on the audio thread. Each audio block is reduced to RMS amplitude. A transient must exceed the chosen threshold and rise above a decaying amplitude envelope. A 75 ms refractory period reduces duplicate detection from one hit's decay. This also limits detection of very fast rolls.

The worklet posts hit timestamps and a live amplitude meter to the UI. A zero-gain output keeps the worklet active without monitoring the microphone through your speakers. Echo cancellation, noise suppression, and automatic gain control are requested off to preserve transients; browsers may still apply device processing.

Detected times and scheduled times share one audio clock. The latency compensation is subtracted from detected timestamps before matching. Use headphones: otherwise click audio can produce false hits. No raw audio is saved or sent anywhere.

## 4. Matching and scoring

`analyzeTiming()` sorts observed hits and matches each to the nearest unused expected subdivision within 150 ms. Each grid position and each hit can be used once.

- Negative offset: early. Positive offset: late.
- Mean absolute error: average distance from the grid among matched hits.
- Spread: standard deviation of signed matched offsets.
- A matched hit contributes `max(0, 1 - abs(offset) / 150ms)` to the score.
- Score = `100 × total contribution / (expected notes + extra hits)`.

Misses and extras lower the score. A session with no captured hits scores zero. A session without microphone input has no timing score, rather than an invented zero or a passing score. At high speeds, the windows for neighboring notes overlap, so this simple nearest-note matching is approximate. Isolated time-domain scoring cannot identify which hand played a hit.

## 5. Camera input becomes motion counts

`StrokeCamera` downsamples each frame to 80 × 60 pixels. It compares RGB changes with the previous frame inside two zones. A rise in changed pixels counts as a motion burst, with a 150 ms per-zone cooldown. The image and zone labels are mirrored together. Counts are saved only while a session is running, after the count-in.

This deliberately small, readable experiment has no pretrained model. Lighting changes, body motion, a moving camera, occlusion, and slow movements can all affect counts. It cannot infer contact, grip, or technique.

## 6. Practice history is local

`practice.svelte.ts` exposes one reactive `$state` object. Explicit functions change sessions, notes, plan items, or the weekly goal, then serialize data to `pocket.practice.v1` in `localStorage`. Views derive totals from real sessions. Weekly charts use local calendar days, Monday through Sunday. The planner is recurring, not a dated task checklist.

Backups contain versioned JSON with sessions, plan items, and the weekly goal. `validateData()` checks imported data before asking to replace existing state. The application never evaluates imported text as code. If saving fails, in-memory data remains available and the UI asks you to export it.

## 7. What the tests establish

Unit tests exercise scoring, missed/extra hits, tempo rules, calendar boundaries, backup validation, and synthetic transient detection. Browser tests run actual Chromium against Vite: session saving/reloading, notes, drill selection, planner settings, backup flows, microphone worklet connection, camera capture/cleanup, and mobile overflow.

The fake browser microphone and camera prove that the input pipelines work. They do not prove real-world hit accuracy or stroke recognition. Those need instrument/device trials and a more rigorous labeled dataset before making stronger performance claims.
