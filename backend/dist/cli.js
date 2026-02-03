"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const yaml_1 = __importDefault(require("yaml"));
const spec_1 = require("./spec");
const storage_1 = require("./storage");
const runner_1 = require("./runner");
function readArg(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx === -1)
        return undefined;
    return process.argv[idx + 1];
}
async function main() {
    const specPath = readArg("--spec");
    if (!specPath) {
        console.error("Missing --spec <path>");
        process.exit(2);
    }
    const raw = await promises_1.default.readFile(specPath, "utf8");
    const parsed = specPath.endsWith(".yaml") || specPath.endsWith(".yml") ? yaml_1.default.parse(raw) : JSON.parse(raw);
    const spec = spec_1.testSpecSchema.parse(parsed);
    const runId = readArg("--run-id") ?? (0, storage_1.newRunId)();
    const allowDestructive = (process.env.ALLOW_DESTRUCTIVE ?? "false").toLowerCase() === "true";
    const allowedUrlPrefixesEnv = process.env.ALLOWED_URL_PREFIXES;
    const allowedUrlPrefixes = allowedUrlPrefixesEnv
        ? allowedUrlPrefixesEnv.split(",").map((v) => v.trim()).filter(Boolean)
        : undefined;
    const report = await (0, runner_1.runSpec)(spec, { runId, allowDestructive, allowedUrlPrefixes });
    const outPath = readArg("--out") ?? node_path_1.default.join(process.cwd(), "runs", runId, "report.json");
    await promises_1.default.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
    if (report.status === "PASS") {
        process.exit(0);
    }
    if (report.status === "FAIL") {
        process.exit(1);
    }
    process.exit(3);
}
main().catch((err) => {
    console.error(err);
    process.exit(3);
});
