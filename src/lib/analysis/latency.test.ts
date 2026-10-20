import { describe, expect, it } from 'vitest';
import { estimateLatency, MAX_DELAY_SECONDS, PROBE_OFFSETS, routeChanged } from './latency';

const probes = PROBE_OFFSETS.map((time) => time + 1);

describe('isolated loopback latency estimates', () => {
  it('measures a known round-trip delay using causal hits, not nearest grid notes', () => {
    const result = estimateLatency(
      probes,
      probes.map((time) => time + 0.48),
    );
    expect(result).toMatchObject({ reliable: true, latencyMs: 480, consistent: 8, jitterMs: 0 });
    expect(
      Math.min(...PROBE_OFFSETS.slice(1).map((time, i) => time - PROBE_OFFSETS[i])),
    ).toBeGreaterThan(MAX_DELAY_SECONDS);
  });

  it('uses a robust median and tolerates two missing/noisy probes', () => {
    const hits = probes.slice(0, 6).map((time, i) => time + (90 + (i % 3)) / 1000);
    hits.push(probes[6] + 0.6); // Accidental noise, not the normal output path.
    const result = estimateLatency(probes, hits);
    expect(result.reliable).toBe(true);
    expect(result.consistent).toBe(6);
    expect(result.latencyMs).toBe(91);
    expect(result.jitterMs).toBe(1);
  });

  it('never reuses an onset and prefers the first arrival over a later echo', () => {
    const hits = probes.flatMap((time) => [time + 0.08, time + 0.18]);
    const result = estimateLatency(probes, hits.reverse());
    expect(result).toMatchObject({ latencyMs: 80, matched: 8, consistent: 8, reliable: true });
  });

  it('ignores hits before the click or outside its bounded response window', () => {
    expect(
      estimateLatency(
        probes,
        probes.map((time) => time - 0.05),
      ).matched,
    ).toBe(0);
    expect(
      estimateLatency(
        probes,
        probes.map((time) => time + 0.95),
      ).matched,
    ).toBe(0);
  });

  it('does not accept silence, an empty run, or too few detections as calibration', () => {
    expect(estimateLatency(probes, []).reliable).toBe(false);
    expect(estimateLatency([], []).reliable).toBe(false);
    expect(
      estimateLatency(
        probes,
        probes.slice(0, 5).map((time) => time + 0.09),
      ).reliable,
    ).toBe(false);
  });

  it('rejects a varying device delay instead of applying a misleading average', () => {
    const varied = [20, 70, 120, 170, 220, 270, 320, 370];
    expect(
      estimateLatency(
        probes,
        probes.map((time, i) => time + varied[i] / 1000),
      ).reliable,
    ).toBe(false);
    const marginal = [80, 80, 80, 80, 80, 80, 98, 98];
    expect(
      estimateLatency(
        probes,
        probes.map((time, i) => time + marginal[i] / 1000),
      ).reliable,
    ).toBe(false);
  });

  it('supports a delay longer than a fast practice subdivision', () => {
    expect(
      estimateLatency(
        probes,
        probes.map((time) => time + 0.72),
      ).latencyMs,
    ).toBe(720);
  });
});

describe('saved audio route checks', () => {
  const route = {
    inputId: 'mic-a',
    inputLabel: 'Microphone',
    outputLabel: 'Headphones',
    sampleRate: 48000,
  };
  it('detects known input, output, and sample-rate changes', () => {
    expect(routeChanged(route, { ...route })).toBe(false);
    expect(routeChanged(route, { ...route, inputId: 'mic-b' })).toBeTruthy();
    expect(routeChanged(route, { ...route, outputLabel: 'Speakers' })).toBeTruthy();
    expect(routeChanged(route, { ...route, sampleRate: 44100 })).toBeTruthy();
  });
  it('does not invent a change when device metadata is unavailable', () => {
    expect(routeChanged(route, { ...route, inputId: '', outputLabel: '' })).toBe(false);
  });
});
