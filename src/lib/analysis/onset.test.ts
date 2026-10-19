import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the actual public AudioWorklet code with deterministic audio blocks.
function detector() {
  const messages: { type: string; time?: number; level?: number }[] = [];
  let Processor: new () => {
    process: (inputs: Float32Array[][]) => boolean;
    port: { onmessage: (event: { data: { type: string; value: number } }) => void };
  };
  const scope = {
    currentTime: 0,
    AudioWorkletProcessor: class {
      port = { postMessage: (message: (typeof messages)[number]) => messages.push(message) };
    },
    registerProcessor: (_name: string, implementation: typeof Processor) => {
      Processor = implementation;
    },
  };
  runInNewContext(
    readFileSync(new URL('../../../public/onset-processor.js', import.meta.url), 'utf8'),
    scope,
  );
  const processor = new Processor!();
  return {
    messages,
    process(time: number, amplitude: number) {
      scope.currentTime = time;
      processor.process([[new Float32Array(128).fill(amplitude)]]);
    },
    threshold(value: number) {
      processor.port.onmessage({ data: { type: 'threshold', value } });
    },
  };
}

describe('audio-thread transient detection', () => {
  it('detects separated sharp transients, while ignoring silence and decay', () => {
    const input = detector();
    input.process(0, 0);
    input.process(0.1, 0.2);
    input.process(0.11, 0.15);
    input.process(0.12, 0.1);
    for (let i = 0; i < 25; i++) input.process(0.13 + i * 0.003, 0);
    input.process(0.4, 0.2);
    expect(input.messages.filter((m) => m.type === 'hit').map((m) => m.time)).toEqual([0.1, 0.4]);
  });
  it('respects sensitivity changes and the duplicate-hit cooldown', () => {
    const input = detector();
    input.threshold(0.1);
    input.process(0.1, 0.05);
    expect(input.messages.filter((m) => m.type === 'hit')).toHaveLength(0);
    input.process(0.2, 0.2);
    input.process(0.21, 0.5);
    expect(input.messages.filter((m) => m.type === 'hit')).toHaveLength(1);
  });
});
