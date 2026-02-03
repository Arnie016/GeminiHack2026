"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSpec = runSpec;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const playwright_1 = require("playwright");
const storage_1 = require("./storage");
function nowIso() {
    return new Date().toISOString();
}
function asErrorMessage(err) {
    if (err instanceof Error)
        return err.message;
    return String(err);
}
function normalizeAllowedPrefixes(prefixes) {
    if (!prefixes)
        return [];
    return prefixes.map((p) => p.trim()).filter(Boolean);
}
function envFlag(name, defaultValue) {
    const raw = process.env[name];
    if (!raw)
        return defaultValue;
    return raw.toLowerCase() === "true";
}
function assertInScope(url, allowedUrlPrefixes) {
    if (allowedUrlPrefixes.length === 0)
        return;
    const ok = allowedUrlPrefixes.some((p) => url.startsWith(p));
    if (!ok) {
        throw new Error(`Out of scope URL encountered: ${url}`);
    }
}
async function takeStepScreenshot(page, filePath) {
    await page.screenshot({ path: filePath, fullPage: true });
}
async function runAssertion(page, assertion, ctx) {
    if (assertion.kind === "textPresent") {
        const text = assertion.text ?? "";
        const body = await page.locator("body").innerText();
        if (!body.includes(text)) {
            throw new Error(`Expected text not found: ${text}`);
        }
        return;
    }
    if (assertion.kind === "elementVisible") {
        const selector = assertion.selector ?? "";
        const locator = page.locator(selector);
        await locator.waitFor({ state: "visible", timeout: 10_000 });
        return;
    }
    if (assertion.kind === "urlMatches") {
        const pattern = assertion.pattern ?? "";
        const regex = new RegExp(pattern);
        const url = page.url();
        if (!regex.test(url)) {
            throw new Error(`URL did not match pattern. url=${url} pattern=${pattern}`);
        }
        return;
    }
    if (assertion.kind === "noConsoleErrors") {
        if (ctx.consoleErrors.length > 0) {
            throw new Error(`Console errors detected: ${ctx.consoleErrors.length}`);
        }
        return;
    }
    if (assertion.kind === "httpStatusOk") {
        const urlPattern = assertion.urlPattern ?? "";
        const regex = new RegExp(urlPattern);
        const maxStatus = assertion.maxStatus ?? 399;
        const failures = ctx.httpFailures.filter((f) => regex.test(f.url) && f.status > maxStatus);
        if (failures.length > 0) {
            throw new Error(`HTTP failures detected for pattern=${urlPattern}: ${failures.length}`);
        }
        return;
    }
}
async function runSpec(spec, opts) {
    const runDir = (0, storage_1.getRunDir)(opts.runId);
    await (0, storage_1.ensureDir)(runDir);
    const allowedUrlPrefixes = normalizeAllowedPrefixes(opts.allowedUrlPrefixes ?? spec.allowedUrlPrefixes);
    const startedAt = nowIso();
    const consoleErrors = [];
    const httpFailures = [];
    const steps = [];
    const report = {
        runId: opts.runId,
        name: spec.name,
        environment: spec.environment,
        startedAt,
        status: "RUNNING",
        baseUrl: spec.baseUrl,
        steps,
        console: { errors: consoleErrors },
        network: { failures: httpFailures },
        artifactsDir: runDir
    };
    await (0, storage_1.writeJson)((0, storage_1.getRunReportPath)(opts.runId), report);
    const recordVideo = spec.recordVideo ?? envFlag("RECORD_VIDEO", false);
    const videosDir = node_path_1.default.join(runDir, "videos");
    if (recordVideo) {
        await (0, storage_1.ensureDir)(videosDir);
    }
    const browser = await playwright_1.chromium.launch();
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        ...(recordVideo
            ? {
                recordVideo: {
                    dir: videosDir,
                    size: { width: 1280, height: 720 }
                }
            }
            : {})
    });
    const page = await context.newPage();
    page.on("console", (msg) => {
        const type = msg.type();
        if (type !== "error")
            return;
        const location = msg.location();
        const loc = location.url ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : undefined;
        consoleErrors.push({ type, text: msg.text(), location: loc });
    });
    page.on("response", (res) => {
        const status = res.status();
        if (status >= 400) {
            httpFailures.push({ url: res.url(), status });
        }
    });
    try {
        for (let i = 0; i < spec.steps.length; i++) {
            const step = spec.steps[i];
            const stepStartedAt = nowIso();
            const name = step.name ?? `${step.type}#${i + 1}`;
            const screenshotName = `${String(i + 1).padStart(3, "0")}-${step.type}.png`;
            const screenshotPath = node_path_1.default.join(runDir, screenshotName);
            try {
                await executeStep(page, step, {
                    baseUrl: spec.baseUrl,
                    allowDestructive: opts.allowDestructive,
                    allowedUrlPrefixes,
                    consoleErrors,
                    httpFailures
                });
                assertInScope(page.url(), allowedUrlPrefixes);
                await takeStepScreenshot(page, screenshotPath);
                steps.push({
                    index: i,
                    name,
                    type: step.type,
                    startedAt: stepStartedAt,
                    finishedAt: nowIso(),
                    status: "PASS",
                    screenshotPath: screenshotName
                });
            }
            catch (err) {
                await takeStepScreenshot(page, screenshotPath).catch(() => undefined);
                steps.push({
                    index: i,
                    name,
                    type: step.type,
                    startedAt: stepStartedAt,
                    finishedAt: nowIso(),
                    status: "FAIL",
                    screenshotPath: screenshotName,
                    error: { message: asErrorMessage(err) }
                });
                report.status = "FAIL";
                report.finalUrl = page.url();
                report.finishedAt = nowIso();
                await (0, storage_1.writeJson)((0, storage_1.getRunReportPath)(opts.runId), report);
                return report;
            }
            finally {
                await (0, storage_1.writeJson)((0, storage_1.getRunReportPath)(opts.runId), report);
            }
        }
        report.status = "PASS";
        report.finalUrl = page.url();
        report.finishedAt = nowIso();
        await (0, storage_1.writeJson)((0, storage_1.getRunReportPath)(opts.runId), report);
        return report;
    }
    catch (err) {
        report.status = "ERROR";
        report.finalUrl = page.url();
        report.finishedAt = nowIso();
        steps.push({
            index: steps.length,
            name: "runner",
            type: "runner",
            startedAt: nowIso(),
            finishedAt: nowIso(),
            status: "FAIL",
            error: { message: asErrorMessage(err) }
        });
        await (0, storage_1.writeJson)((0, storage_1.getRunReportPath)(opts.runId), report);
        return report;
    }
    finally {
        if (recordVideo) {
            try {
                await page.close();
                const video = page.video();
                if (video) {
                    const rawPath = await video.path();
                    const targetName = "run.webm";
                    const targetPath = node_path_1.default.join(runDir, targetName);
                    await promises_1.default.rename(rawPath, targetPath).catch(async () => {
                        await promises_1.default.copyFile(rawPath, targetPath);
                    });
                    report.videoPath = targetName;
                    await (0, storage_1.writeJson)((0, storage_1.getRunReportPath)(opts.runId), report);
                }
            }
            catch {
            }
        }
        await context.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
    }
}
async function executeStep(page, step, ctx) {
    if (step.destructive && !ctx.allowDestructive) {
        throw new Error("Destructive step blocked (ALLOW_DESTRUCTIVE=false)");
    }
    if (step.type === "goto") {
        const rawUrl = step.url ?? "";
        const url = ctx.baseUrl ? new URL(rawUrl, ctx.baseUrl).toString() : rawUrl;
        assertInScope(url, ctx.allowedUrlPrefixes);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return;
    }
    if (step.type === "click") {
        const selector = step.selector ?? "";
        const locator = page.locator(selector);
        await locator.first().click();
        await page.waitForLoadState("domcontentloaded");
        return;
    }
    if (step.type === "type") {
        const selector = step.selector ?? "";
        const text = step.text ?? "";
        const locator = page.locator(selector);
        await locator.first().fill(text);
        return;
    }
    if (step.type === "select") {
        const selector = step.selector ?? "";
        const value = step.value ?? "";
        await page.selectOption(selector, { value });
        return;
    }
    if (step.type === "upload") {
        const selector = step.selector ?? "";
        const filePath = step.filePath ?? "";
        await page.setInputFiles(selector, filePath);
        return;
    }
    if (step.type === "waitFor") {
        const timeoutMs = step.timeoutMs ?? 10_000;
        if (step.selector) {
            await page.locator(step.selector).waitFor({ state: "visible", timeout: timeoutMs });
            return;
        }
        if (step.text) {
            await page.getByText(step.text, { exact: false }).first().waitFor({
                state: "visible",
                timeout: timeoutMs
            });
            return;
        }
        return;
    }
    if (step.type === "assert") {
        const assertion = step.assertion;
        await runAssertion(page, assertion, {
            consoleErrors: ctx.consoleErrors,
            httpFailures: ctx.httpFailures
        });
        return;
    }
}
