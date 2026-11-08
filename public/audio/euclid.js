/**
 * Euclidean step generator for one tracker channel. Pure module: no DOM, no
 * Web Audio.
 *
 * Adapted from the base-pattern controls of gcd8-pd (glima31/gcd8-pd,
 * GPL-3.0): LENGTH, HITS, SHIFT and STEP RATE. gcd8-pd free-runs a sequencer
 * on the clock. The tracker has a fixed-length pattern, so this module
 * renders the steps onto pattern rows and the cells are then edited like any
 * other cell.
 *
 *   length    1–32 steps in the cycle
 *   hits      0–length steps that are hits
 *   shift     steps the whole cycle is rotated forward. Wraps at length, so
 *             the stored value is 0–(length-1)
 *   stepRate  how many rows one step lasts. "1/16" is one row (a row is a
 *             sixteenth), "1/8" is two, "1/4" is four, "1/2" is eight
 *
 * Hit placement uses the floor/remainder form of the Euclidean distribution:
 * step i is a hit when (i * hits) mod length < hits. It spreads hits as
 * evenly as the Euclidean algorithm does (E(3,8) is x..x..x., E(5,8) is
 * x.xx.xx.) but it is a rotation of the Bjorklund result for some inputs, and
 * it is not guaranteed to match [else/euclid] step for step.
 */

export const STEP_RATES = Object.freeze({ "1/2": 8, "1/4": 4, "1/8": 2, "1/16": 1 });
export const MAX_EUCLID_LENGTH = 32;

export function defaultEuclid() {
  return { length: 16, hits: 4, shift: 0, stepRate: "1/16" };
}

function int(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Shift is a rotation, so it wraps at length instead of clamping. */
function wrapShift(value, length) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return ((n % length) + length) % length;
}

/** Fill and clamp every field. A value the caller set, including 0, stays. */
export function normalizeEuclid(cfg) {
  const base = defaultEuclid();
  const src = cfg && typeof cfg === "object" ? cfg : {};
  const length = int(src.length, 1, MAX_EUCLID_LENGTH, base.length);
  const hits = int(src.hits, 0, length, Math.min(base.hits, length));
  const shift = wrapShift(src.shift, length);
  const stepRate = Object.hasOwn(STEP_RATES, src.stepRate) ? src.stepRate : base.stepRate;
  return { length, hits, shift, stepRate };
}

export function channelEuclid(song, ch) {
  const table = song?.channelEuclid;
  if (!table || typeof table !== "object") return normalizeEuclid(null);
  return normalizeEuclid(table[ch] ?? table[String(ch)]);
}

/** One cycle as booleans, true for a hit. */
export function euclidSteps(length, hits, shift = 0) {
  const len = int(length, 1, MAX_EUCLID_LENGTH, 16);
  const h = int(hits, 0, len, 0);
  const rot = wrapShift(shift, len);
  const base = [];
  for (let i = 0; i < len; i++) base.push(h > 0 && (i * h) % len < h);
  const out = new Array(len).fill(false);
  for (let i = 0; i < len; i++) out[(i + rot) % len] = base[i];
  return out;
}

/**
 * Render the cycle onto `rows` pattern rows. Row r starts a step when r is a
 * multiple of the step stride, and that step is cycle[(r / stride) % length].
 * Rows between steps are false. The cycle restarts at row 0.
 */
export function euclidRows(cfg, rows) {
  const { length, hits, shift, stepRate } = normalizeEuclid(cfg);
  const stride = STEP_RATES[stepRate];
  const cycle = euclidSteps(length, hits, shift);
  const out = [];
  for (let r = 0; r < rows; r++) {
    out.push(r % stride === 0 ? cycle[(r / stride) % length] : false);
  }
  return out;
}

/** "x...x...": a hit is x, a rest on a step row is a dot, a row between steps is a space-free dot too. */
export function euclidString(cfg, rows) {
  return euclidRows(cfg, rows).map((hit) => (hit ? "x" : ".")).join("");
}
