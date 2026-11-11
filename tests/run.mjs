// Bundle the engine and run the headless careers. Usage: npm test
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "pm-"));
execSync(`npx esbuild src/sim.js --bundle --format=esm --platform=node --outfile=${dir}/sim.mjs --log-level=error`, { stdio: "inherit" });
writeFileSync(`${dir}/careers.mjs`, readFileSync("tests/careers.mjs", "utf8").replace('"SIM"', JSON.stringify(`${dir}/sim.mjs`)));
execSync(`node ${dir}/careers.mjs`, { stdio: "inherit" });
