#!/usr/bin/env node
/**
 * Euclidean steps and user-sample registry. No server, no browser.
 *
 *   node scripts/verify-euclid.mjs
 */
import {
  MAX_EUCLID_LENGTH,
  channelEuclid,
  euclidRows,
  euclidSteps,
  euclidString,
  normalizeEuclid,
} from "../public/audio/euclid.js";
import {
  USER_SAMPLE_BASE,
  countSampleRefs,
  mergeUserSamples,
  nextUserSampleId,
  normalizeUserSamples,
} from "../public/audio/user-samples.js";
import { migrateSong } from "../public/audio/instruments.js";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const str = (steps) => steps.map((h) => (h ? "x" : ".")).join("");

assert(str(euclidSteps(16, 4)) === "x...x...x...x...", "E(4,16) is four on the floor");
assert(str(euclidSteps(8, 3)) === "x..x..x.", "E(3,8) is the tresillo");
assert(str(euclidSteps(5, 2)) === "x..x.", "E(2,5) spreads two hits");
assert(str(euclidSteps(8, 0)) === "........", "zero hits is all rests");
assert(str(euclidSteps(8, 8)) === "xxxxxxxx", "hits = length is every step");
assert(str(euclidSteps(8, 3, 1)) === ".x..x..x", "shift 1 moves every hit one step forward");
assert(normalizeEuclid({ length: 8, shift: -1 }).shift === 7, "negative shift wraps backwards");
assert(str(euclidSteps(8, 3, 8)) === str(euclidSteps(8, 3, 0)), "shift wraps at length");

for (let len = 1; len <= MAX_EUCLID_LENGTH; len++) {
  for (let hits = 0; hits <= len; hits++) {
    const n = euclidSteps(len, hits).filter(Boolean).length;
    if (n !== hits) assert(false, `E(${hits},${len}) has ${n} hits`);
  }
}
assert(true, "every E(hits,length) up to 32 has exactly that many hits");

const clamped = normalizeEuclid({ length: 99, hits: 99, shift: 99, stepRate: "bad" });
assert(clamped.length === 32 && clamped.hits === 32 && clamped.shift === 3 && clamped.stepRate === "1/16", "values clamp");
assert(normalizeEuclid({ length: 4, hits: 0 }).hits === 0, "an explicit 0 hits stays 0");
assert(normalizeEuclid(null).length === 16, "missing config gets the defaults");

assert(euclidString({ length: 4, hits: 2, shift: 0, stepRate: "1/16" }, 8) === "x.x.x.x.", "step rate 1/16 is one row per step");
assert(euclidString({ length: 4, hits: 2, shift: 0, stepRate: "1/8" }, 16) === "x...x...x...x...", "step rate 1/8 is two rows per step");
assert(euclidString({ length: 4, hits: 2, shift: 0, stepRate: "1/4" }, 16) === "x.......x.......", "step rate 1/4 hits rows 0 and 8");
assert(euclidRows({ length: 3, hits: 3, shift: 0, stepRate: "1/16" }, 7).every(Boolean), "a cycle shorter than the pattern repeats");

assert(channelEuclid({ channelEuclid: { 2: { length: 8, hits: 3 } } }, 2).hits === 3, "per-channel lookup by number");
assert(channelEuclid({}, 0).length === 16, "no table gives defaults");

const stored = normalizeUserSamples([
  { id: 1000, name: "a.wav", data: "QUJD", mime: "audio/wav", role: "kick", fallback: 3 },
  { id: 1000, name: "dup", data: "QUJD" },
  { id: 5, name: "kit id", data: "QUJD" },
  { id: 1001, name: "no data" },
]);
assert(stored.length === 1 && stored[0].fallback === 3, "only well-formed, unique user entries survive");
const merged = mergeUserSamples([{ id: 1, file: "k.wav" }, { id: 1000, user: true }], stored);
assert(merged.length === 2 && merged[1].user && merged[1].url.startsWith("data:audio/wav;base64,"), "merge replaces old user rows");
assert(nextUserSampleId([{ id: 90 }], []) === USER_SAMPLE_BASE, "first user id is the base");
assert(nextUserSampleId([{ id: 90 }], stored) === 1001, "next id follows the highest stored id");

const song = {
  patterns: [{ data: [[{ sample: 1000 }, { sample: 3 }], [{ sample: 1000 }]] }],
};
assert(countSampleRefs(song, 1000) === 2, "cell references are counted");

const migrated = migrateSong({ patterns: [{ data: [] }] }, []);
assert(Array.isArray(migrated.userSamples) && migrated.channelEuclid && typeof migrated.channelEuclid === "object", "migrateSong adds the new tables");
const old = migrateSong({ version: 2, patterns: [{ data: [] }], instruments: [] }, []);
assert(Object.keys(old.channelEuclid).length === 0, "an old project gets no euclid configs");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
