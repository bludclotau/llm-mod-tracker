#!/usr/bin/env node
/**
 * GCD-8 sample-response curves. No server, no browser.
 *
 *   node scripts/verify-sample-response.mjs
 */
import {
  holdStage,
  isPlainResponse,
  normalizeSampleResponse,
  shapeSampleHit,
} from "../public/audio/sample-response.js";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

function close(a, b, msg) {
  assert(Math.abs(a - b) < 1e-6, `${msg} (${a} vs ${b})`);
}

assert(isPlainResponse(null), "missing response is the unchanged drum hit");
assert(isPlainResponse({ velAmp: 0, level: 1, start: 0, end: 1 }), "zero depths stay plain");
assert(!isPlainResponse({ velAmp: 1 }), "amp depth leaves the plain path");

const linear = shapeSampleHit(null, 0.5, 1, 1);
assert(linear.plain && linear.gain === 0.5 && linear.offsetSec === 0, "volume 32 is still half gain");

const squared = shapeSampleHit({ velAmp: 1 }, 0.5, 1, 1);
close(squared.gain, 0.25, "amp depth 1 squares velocity");
close(shapeSampleHit({ velAmp: 1, level: 0.5 }, 1, 1, 1).gain, 0.5, "full velocity keeps the level trim");

const dark = shapeSampleHit({ velTone: 1 }, 0, 1, 1);
const bright = shapeSampleHit({ velTone: 1 }, 1, 1, 1);
close(dark.cutoff, 600, "tone depth 1 at velocity 0 is 600 Hz");
close(bright.cutoff, 24000, "tone depth 1 at full velocity is 24 kHz");
assert(!shapeSampleHit(null, 0.2, 1, 1).useFilter, "tone depth 0 adds no filter");

const trimmed = shapeSampleHit({ start: 0.25, end: 0.75 }, 1, 2, 1);
close(trimmed.offsetSec, 0.5, "start 0.25 of a 2 s buffer");
close(trimmed.bufferPlay, 1, "end 0.75 leaves a 0.5 span of that buffer");

const softStart = shapeSampleHit({ velStart: 1, end: 1 }, 0, 1, 1);
close(softStart.offsetSec, 1, "start depth 1 at velocity 0 skips the buffer");
close(shapeSampleHit({ velStart: 1 }, 1, 1, 1).offsetSec, 0, "start depth does not move a full-velocity hit");

const decay = shapeSampleHit({ velDecay: 1 }, 0, 1, 1);
close(decay.envelopeLen, 0.15, "decay depth 1 leaves 15% at velocity 0");
assert(decay.useEnvelope, "decay depth arms the envelope");

const attack = shapeSampleHit({ velAttack: 1, velDecay: 0, envShape: 1 }, 0, 2, 1);
close(attack.attack, 0.15, "attack depth 1 is 150 ms at velocity 0");
close(attack.attack, Math.min(0.15, attack.envelopeLen * 0.5), "attack stays inside half the envelope");
close(shapeSampleHit({ velAttack: 1 }, 1, 2, 1).attack, 0, "full velocity has no attack fade");

close(holdStage(1), 0.95, "hold 1 is a 95% hold stage");
close(holdStage(0), 0, "hold 0 is an AD envelope");

const pitched = shapeSampleHit({ velDecay: 1 }, 0, 1, 0.5);
close(pitched.envelopeLen, 0.3, "envelope time follows playback rate");

const norm = normalizeSampleResponse({ level: 2, end: -1, velTone: "0.5", nope: 1 });
assert(norm.level === 1 && norm.end === 0 && norm.velTone === 0.5 && norm.nope == null, "response values clamp");

if (failed) {
  console.error(`verify-sample-response ${failed} failed`);
  process.exit(1);
}
console.log("verify-sample-response ok");
