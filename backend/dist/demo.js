"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { generateDemoFromRun } = require("./video_pipeline");
function parseArg(name, def) {
  const i = process.argv.findIndex((v) => v === name);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return def;
}
async function main() {
  const runId = parseArg("--run-id", "");
  const prompt = parseArg("--prompt", "Show the feature working clearly");
  if (!runId) {
    console.error("Missing --run-id");
    process.exit(2);
  }
  try {
    const result = await generateDemoFromRun(runId, prompt);
    console.log(JSON.stringify({ ok: true, output: result.outputPath, highlight: result.highlight }));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
    process.exit(1);
  }
}
main();

