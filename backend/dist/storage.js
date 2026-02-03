"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDir = ensureDir;
exports.newRunId = newRunId;
exports.getRunsRoot = getRunsRoot;
exports.getRunDir = getRunDir;
exports.getRunReportPath = getRunReportPath;
exports.writeJson = writeJson;
exports.readJson = readJson;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
async function ensureDir(dirPath) {
    await promises_1.default.mkdir(dirPath, { recursive: true });
}
function newRunId() {
    const rand = Math.random().toString(16).slice(2, 10);
    return `${Date.now()}-${rand}`;
}
function getRunsRoot() {
    return node_path_1.default.join(process.cwd(), "runs");
}
function getRunDir(runId) {
    return node_path_1.default.join(getRunsRoot(), runId);
}
function getRunReportPath(runId) {
    return node_path_1.default.join(getRunDir(runId), "report.json");
}
async function writeJson(filePath, value) {
    await promises_1.default.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}
async function readJson(filePath) {
    const raw = await promises_1.default.readFile(filePath, "utf8");
    return JSON.parse(raw);
}
