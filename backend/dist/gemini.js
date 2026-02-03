"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeHighlight = analyzeHighlight;
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { readJson } = require("./storage");
async function analyzeHighlight(runId, videoPath, prompt) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    return await fallbackFromReport(runId, videoPath);
  }
  try {
    const uploaded = await uploadFileToGemini(videoPath, key, `run-${runId}`);
    const suggestion = await requestHighlightFromGemini(uploaded.fileUri, prompt, key);
    if (suggestion) return suggestion;
    return await fallbackFromReport(runId, videoPath);
  } catch {
    return await fallbackFromReport(runId, videoPath);
  }
}
async function uploadFileToGemini(filePath, apiKey, displayName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/files:upload?key=${apiKey}`;
  const buf = await fsp.readFile(filePath);
  const blob = new Blob([buf], { type: guessMime(filePath) });
  const form = new FormData();
  form.append("file", blob, path.basename(filePath));
  form.append("display_name", displayName ?? path.basename(filePath));
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  const json = await res.json();
  const fileUri = json?.file?.uri || json?.uri || json?.file?.name;
  return { fileUri };
}
async function requestHighlightFromGemini(fileUri, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const sys = "You are a video analyst. Return ONLY compact JSON with fields startSec,endSec,crop:{x,y,width,height}. Keep length between 4 and 20 seconds if possible. If crop unknown, omit it.";
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: sys + "\n" + (prompt || "Identify the best demo segment.") },
          { fileData: { mimeType: guessMimeFromUri(fileUri) || "video/webm", fileUri } }
        ]
      }
    ]
  };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return undefined;
  const json = await res.json();
  const text = extractText(json);
  const parsed = safeParseJsonFromText(text);
  if (parsed && isValidSuggestion(parsed)) return parsed;
  return undefined;
}
function extractText(resp) {
  try {
    const c = resp?.candidates?.[0];
    const p = c?.content?.parts?.[0];
    return p?.text || JSON.stringify(resp);
  } catch { return ""; }
}
function safeParseJsonFromText(text) {
  if (!text) return undefined;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
  }
  try { return JSON.parse(text); } catch {}
  return undefined;
}
function isValidSuggestion(obj) {
  return obj && typeof obj.startSec === "number" && typeof obj.endSec === "number" && obj.endSec > obj.startSec && obj.endSec - obj.startSec > 1;
}
async function fallbackFromReport(runId, videoPath) {
  const reportPath = path.join(path.dirname(videoPath), "report.json");
  let durationSec = await getVideoDuration(videoPath);
  let start = Math.max(0, durationSec - Math.min(10, Math.max(4, durationSec)));
  let end = durationSec;
  try {
    const report = await readJson(reportPath);
    const steps = Array.isArray(report?.steps) ? report.steps : [];
    const lastPass = [...steps].reverse().find((s) => s.status === "PASS");
    if (lastPass) {
      start = Math.max(0, durationSec - Math.min(8, Math.max(4, durationSec)));
      end = durationSec;
    }
  } catch {}
  return { startSec: start, endSec: end };
}
function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    const spawn = require("node:child_process").spawn;
    const args = ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoPath];
    const p = spawn("ffprobe", args);
    let out = "";
    p.stdout.on("data", (d) => (out += String(d)));
    p.on("close", () => {
      const val = parseFloat(out.trim());
      if (isFinite(val)) resolve(val); else resolve(30);
    });
    p.on("error", () => resolve(30));
  });
}
function guessMime(filePath) {
  if (filePath.endsWith(".webm")) return "video/webm";
  if (filePath.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}
function guessMimeFromUri(uri) {
  if (!uri) return undefined;
  if (uri.includes(".webm")) return "video/webm";
  if (uri.includes(".mp4")) return "video/mp4";
  return undefined;
}
