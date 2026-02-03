# AegisQA Video Demo Pipeline

- Set `GOOGLE_API_KEY` for Gemini analysis. Without it, the pipeline uses a fallback segment.
- Ensure `ffmpeg` and `ffprobe` are installed and available on `PATH`.

## Server Endpoint

- Start: `node backend/dist/server.js`
- Generate demo: `GET /runs/:runId/demo?prompt=...`
- Artifacts directory: `runs/<runId>/` contains `run.webm`, `demo.mp4`, `demo.json`.

## CLI

- Generate demo: `node backend/dist/demo.js --run-id <runId> --prompt "Show the feature working"`

## Behavior

- Records Playwright video when `RECORD_VIDEO=true` or `spec.recordVideo=true`.
- Calls Gemini to detect highlight segment when configured; otherwise selects the last seconds of the video.
- Uses ffmpeg to cut and render `demo.mp4` at 1280x720, 30fps.

