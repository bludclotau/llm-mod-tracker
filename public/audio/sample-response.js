/**
 * GCD-8 sampler response, as numbers. No Web Audio.
 *
 * The Pure Data patch in gcd8.sampler~.pd is the source of the curves.
 * Drum channels in the tracker use cell volume as velocity (1 = volume 64).
 * Every depth at 0, level 1, start 0, and end 1 leaves that hit unchanged.
 *
 * Amp depth 0 keeps the tracker's linear volume. Depth 1 is GCD-8's
 * velocity-squared law: gain = level * velocity^(1 + velAmp).
 *
 * Tone cutoff is 24000 * 40^(velTone * (velocity - 1)). Depth 1 reaches
 * 600 Hz at velocity 0 and stays at 24 kHz at velocity 1.
 *
 * Attack depth 1 is 150 ms at velocity 0, times (1 - velocity)^2, and never
 * more than half the envelope. Decay depth 1 shortens a velocity-0 hit to
 * 15% (the patch knob stops at 0.85). Hold 0 is an AD envelope. Hold 1 keeps
 * the level for 95% of what remains after the attack, then fades.
 */

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function defaultSampleResponse() {
  return {
    level: 1,
    start: 0,
    end: 1,
    envShape: 1,
    velAmp: 0,
    velTone: 0,
    velStart: 0,
    velAttack: 0,
    velDecay: 0,
  };
}

export function normalizeSampleResponse(src) {
  const base = defaultSampleResponse();
  const incoming = src && typeof src === "object" ? src : {};
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (incoming[key] != null && incoming[key] !== "") {
      out[key] = clamp(incoming[key], 0, 1, base[key]);
    }
  }
  if (out.end < out.start) out.end = out.start;
  return out;
}

/** 0 = no hold (AD). 1 = 95% of the post-attack region is hold. */
export function holdStage(envShape) {
  const shape = clamp(envShape, 0, 1, 1);
  return 1 - 0.05 * 20 ** (1 - shape);
}

export function isPlainResponse(response) {
  const r = normalizeSampleResponse(response);
  return r.level >= 0.999
    && r.start <= 0.0001
    && r.end >= 0.999
    && r.envShape >= 0.999
    && r.velAmp <= 0.0001
    && r.velTone <= 0.0001
    && r.velStart <= 0.0001
    && r.velAttack <= 0.0001
    && r.velDecay <= 0.0001;
}

/**
 * @param {object|null} response
 * @param {number} velocity 0–1
 * @param {number} durationSec full buffer length, before pitch
 * @param {number} playbackRate 1 is the recorded pitch
 */
export function shapeSampleHit(response, velocity, durationSec, playbackRate) {
  const r = normalizeSampleResponse(response);
  const vel = clamp(velocity, 0, 1, 1);
  const dur = Math.max(0, Number(durationSec) || 0);
  const rate = Math.max(1e-6, Number(playbackRate) || 1);
  const endTrim = 1 - r.end;
  const startPos = r.start + Math.max(0, 1 - endTrim - r.start) * (r.velStart * (1 - vel));
  const span = Math.max(0, 1 - endTrim - startPos);
  const offsetSec = Math.min(dur, startPos * dur);
  const bufferPlay = Math.max(0, Math.min(dur - offsetSec, span * dur));
  const outputPlay = bufferPlay / rate;
  const envelopeLen = outputPlay * (1 - r.velDecay * 0.85 * (1 - vel));
  const attack = Math.min(r.velAttack * 0.15 * (1 - vel) ** 2, envelopeLen * 0.5);
  const hold = Math.max(0, (envelopeLen - attack) * holdStage(r.envShape));
  const decay = Math.max(0, envelopeLen - attack - hold);
  const gain = r.level * (vel <= 0 ? 0 : vel ** (1 + r.velAmp));
  const cutoff = 24000 * 40 ** (r.velTone * (vel - 1));
  const useEnvelope = r.velAttack > 0.0001 || r.velDecay > 0.0001 || r.envShape < 0.999;
  const useFilter = r.velTone > 0.0001;
  const trimmed = startPos > 0.0001 || r.end < 0.999;
  return {
    gain,
    offsetSec,
    bufferPlay,
    outputPlay,
    envelopeLen,
    attack,
    hold,
    decay,
    cutoff,
    useEnvelope,
    useFilter,
    trimmed,
    plain: isPlainResponse(r),
  };
}
