#!/usr/bin/env node
// Checks the ballistics engine inside one or more app pages against solver-reference.json.
// Exits 1 (and build.py refuses to build) if any number is off by more than the tolerance.
// Usage: node source/check/check_solver.js <page.html> [<page.html> ...]
const fs = require("fs"), path = require("path"), vm = require("vm");

const ref = JSON.parse(fs.readFileSync(path.join(__dirname, "solver-reference.json"), "utf8"));
const FIELDS = { dropIn: '"', windIn: '"', v: " fps", tof: " s" };

function loadEngine(file) {
  const m = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").match(/const BAL = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
  if (!m) throw new Error(`no ballistics engine (const BAL = ...) found in ${file}`);
  return { src: m[0], BAL: vm.runInNewContext(m[0] + "\nBAL;", { Math }) };
}

function check(file) {
  const { src, BAL } = loadEngine(file);
  const fails = [];
  let n = 0;
  for (const s of ref.shots) {
    const got = BAL.solve(s.load, s.zeroEnv, s.env, s.ranges);
    s.expected.forEach((want, i) => {
      const g = got[i];
      if (!g || g.r !== want.r) { fails.push(`${s.name} @ ${want.r} yd: no result`); return; }
      for (const [k, unit] of Object.entries(FIELDS)) {
        const [abs, rel] = ref.tolerance[k], tol = abs + rel * Math.abs(want[k]);
        n++;
        if (!(Math.abs(g[k] - want[k]) <= tol))
          fails.push(`${s.name} @ ${want.r} yd: ${k} ${g[k].toFixed(3)}${unit}, expected ${want[k].toFixed(3)}${unit} (±${tol.toFixed(3)})`);
      }
    });
  }
  // Wind from 3 o'clock (the right) pushes the bullet left; 9 o'clock mirrors it exactly.
  const w = ref.shots[0], at = c => BAL.solve(w.load, w.zeroEnv, { ...w.env, windClock: c }, [300])[0].windIn;
  n++;
  if (!(at(3) < 0 && Math.abs(at(3) + at(9)) < 0.01)) fails.push(`wind direction: 3 o'clock gave ${at(3).toFixed(2)}", 9 o'clock ${at(9).toFixed(2)}"`);
  return { src, n, fails };
}

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: node check_solver.js <page.html> ..."); process.exit(2); }
let bad = false, first = null;
for (const f of files) {
  let r;
  try { r = check(f); } catch (e) { console.error(`FAIL ${f}: ${e.message}`); bad = true; continue; }
  if (first === null) first = r.src;
  else if (r.src !== first) { r.fails.push("engine differs from " + files[0]); }
  if (r.fails.length) { bad = true; console.error(`FAIL ${f}: ${r.fails.length} of ${r.n} checks`); r.fails.forEach(x => console.error("  " + x)); }
  else console.log(`ok   ${f}: ${r.n} checks match ${ref.source}`);
}
process.exit(bad ? 1 : 0);
