"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const yaml_1 = __importDefault(require("yaml"));
const spec_1 = require("./spec");
const runner_1 = require("./runner");
const storage_1 = require("./storage");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: "2mb" }));
const runs = new Map();
app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
});
app.post("/runs", async (req, res) => {
    const runId = (0, storage_1.newRunId)();
    const allowDestructive = (process.env.ALLOW_DESTRUCTIVE ?? "false").toLowerCase() === "true";
    const allowedUrlPrefixesEnv = process.env.ALLOWED_URL_PREFIXES;
    const allowedUrlPrefixes = allowedUrlPrefixesEnv
        ? allowedUrlPrefixesEnv.split(",").map((v) => v.trim()).filter(Boolean)
        : undefined;
    const specInput = req.body?.spec;
    if (!specInput) {
        res.status(400).json({ error: "Missing spec" });
        return;
    }
    const spec = spec_1.testSpecSchema.parse(specInput);
    runs.set(runId, { runId, status: "QUEUED" });
    void (async () => {
        runs.set(runId, { runId, status: "RUNNING" });
        try {
            const report = await (0, runner_1.runSpec)(spec, { runId, allowDestructive, allowedUrlPrefixes });
            runs.set(runId, { runId, status: report.status });
        }
        catch {
            runs.set(runId, { runId, status: "ERROR" });
        }
    })();
    res.status(202).json({ runId });
});
app.post("/runs/from-file", async (req, res) => {
    const runId = (0, storage_1.newRunId)();
    const allowDestructive = (process.env.ALLOW_DESTRUCTIVE ?? "false").toLowerCase() === "true";
    const allowedUrlPrefixesEnv = process.env.ALLOWED_URL_PREFIXES;
    const allowedUrlPrefixes = allowedUrlPrefixesEnv
        ? allowedUrlPrefixesEnv.split(",").map((v) => v.trim()).filter(Boolean)
        : undefined;
    const filePath = req.body?.path;
    if (!filePath) {
        res.status(400).json({ error: "Missing path" });
        return;
    }
    const raw = await promises_1.default.readFile(filePath, "utf8");
    const parsed = filePath.endsWith(".yaml") || filePath.endsWith(".yml") ? yaml_1.default.parse(raw) : JSON.parse(raw);
    const spec = spec_1.testSpecSchema.parse(parsed);
    runs.set(runId, { runId, status: "QUEUED" });
    void (async () => {
        runs.set(runId, { runId, status: "RUNNING" });
        try {
            const report = await (0, runner_1.runSpec)(spec, { runId, allowDestructive, allowedUrlPrefixes });
            runs.set(runId, { runId, status: report.status });
        }
        catch {
            runs.set(runId, { runId, status: "ERROR" });
        }
    })();
    res.status(202).json({ runId });
});
app.get("/runs/:runId", async (req, res) => {
    const runId = req.params.runId;
    const state = runs.get(runId);
    const reportPath = (0, storage_1.getRunReportPath)(runId);
    let report;
    try {
        report = await (0, storage_1.readJson)(reportPath);
    }
    catch {
        report = undefined;
    }
    res.json({ runId, status: state?.status ?? report?.status ?? "UNKNOWN", report });
});
app.get("/runs/:runId/demo", async (req, res) => {
    const runId = req.params.runId;
    const prompt = String(req.query.prompt ?? "Show the feature working clearly");
    try {
        const { generateDemoFromRun } = require("./video_pipeline");
        const result = await generateDemoFromRun(runId, prompt);
        res.sendFile(result.outputPath);
    }
    catch (err) {
        res.status(400).json({ error: String(err?.message ?? err) });
    }
});
app.get("/runs/:runId/artifacts/:name", async (req, res) => {
    const runId = req.params.runId;
    const name = req.params.name;
    const runDir = (0, storage_1.getRunDir)(runId);
    const resolved = node_path_1.default.resolve(runDir, name);
    if (!resolved.startsWith(node_path_1.default.resolve(runDir))) {
        res.status(400).json({ error: "Invalid artifact path" });
        return;
    }
    res.sendFile(resolved);
});
async function ensureRunsRoot() {
    await (0, storage_1.ensureDir)(node_path_1.default.join(process.cwd(), "runs"));
}
const port = Number(process.env.PORT ?? "8080");
ensureRunsRoot()
    .then(() => {
    app.listen(port, () => {
        console.log(`AegisQA backend listening on :${port}`);
    });
})
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
