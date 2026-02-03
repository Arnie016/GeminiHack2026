"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDemoFromRun = generateDemoFromRun;
exports.composeSegment = composeSegment;
exports.getRunVideoPath = getRunVideoPath;
const path = require("node:path");
const fs = require("node:fs/promises");
const { getRunDir, readJson, writeJson } = require("./storage");
const { analyzeHighlight } = require("./gemini");
function getRunVideoPath(runId) {
  const dir = getRunDir(runId);
  return path.join(dir, "run.webm");
}
async function composeSegment(inputPath, outputPath, segment, opts) {
  const spawn = require("node:child_process").spawn;
  const vf = opts && opts.crop ? `crop=${opts.crop.width}:${opts.crop.height}:${opts.crop.x}:${opts.crop.y},scale=1280:-2,setsar=1` : "scale=1280:-2,setsar=1";
  const args = ["-y", "-ss", String(segment.startSec), "-to", String(segment.endSec), "-i", inputPath, "-vf", vf, "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", outputPath];
  await new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: "inherit" });
    p.on("close", (code) => (code === 0 ? resolve(undefined) : reject(new Error("ffmpeg failed"))));
    p.on("error", (err) => reject(err));
  });
}
async function generateDemoFromRun(runId, prompt) {
  const dir = getRunDir(runId);
  const reportPath = path.join(dir, "report.json");
  const videoPath = getRunVideoPath(runId);
  const exists = await fs.access(videoPath).then(() => true).catch(() => false);
  if (!exists) throw new Error("Video not found");
  const highlight = await analyzeHighlight(runId, videoPath, prompt);
  const outName = "demo.mp4";
  const outPath = path.join(dir, outName);
  await composeSegment(videoPath, outPath, highlight, {});
  const metaPath = path.join(dir, "demo.json");
  await writeJson(metaPath, { runId, input: path.basename(videoPath), output: outName, highlight });
  return { outputPath: outPath, outputName: outName, highlight };
}
