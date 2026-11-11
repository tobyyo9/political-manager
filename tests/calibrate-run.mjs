// Compare the vote formula with real 2025-26 roll calls. Usage: npm run calibrate
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "pmc-"));
execSync(`npx esbuild src/sim.js --bundle --format=esm --platform=node --outfile=${dir}/sim.mjs --log-level=error`, { stdio: "inherit" });
writeFileSync(`${dir}/cal.mjs`, readFileSync("tests/calibrate.mjs", "utf8").replace('"SIM"', JSON.stringify(`${dir}/sim.mjs`)));
execSync(`node ${dir}/cal.mjs`, { stdio: "inherit" });
