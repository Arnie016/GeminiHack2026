"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSpecSchema = exports.stepSchema = exports.assertSchema = void 0;
const zod_1 = require("zod");
exports.assertSchema = zod_1.z
    .object({
    kind: zod_1.z.enum([
        "textPresent",
        "elementVisible",
        "urlMatches",
        "noConsoleErrors",
        "httpStatusOk"
    ]),
    selector: zod_1.z.string().optional(),
    text: zod_1.z.string().optional(),
    pattern: zod_1.z.string().optional(),
    urlPattern: zod_1.z.string().optional(),
    maxStatus: zod_1.z.number().int().min(100).max(599).optional()
})
    .superRefine((val, ctx) => {
    if (val.kind === "textPresent" && !val.text) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "textPresent requires text" });
    }
    if (val.kind === "elementVisible" && !val.selector) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "elementVisible requires selector" });
    }
    if (val.kind === "urlMatches" && !val.pattern) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "urlMatches requires pattern" });
    }
    if (val.kind === "httpStatusOk" && !val.urlPattern) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "httpStatusOk requires urlPattern" });
    }
});
exports.stepSchema = zod_1.z
    .object({
    type: zod_1.z.enum(["goto", "click", "type", "select", "upload", "waitFor", "assert"]),
    name: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    selector: zod_1.z.string().optional(),
    text: zod_1.z.string().optional(),
    value: zod_1.z.string().optional(),
    filePath: zod_1.z.string().optional(),
    timeoutMs: zod_1.z.number().int().positive().optional(),
    destructive: zod_1.z.boolean().optional(),
    assertion: exports.assertSchema.optional()
})
    .superRefine((val, ctx) => {
    if (val.type === "goto" && !val.url) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "goto requires url" });
    }
    if (val.type === "click" && !val.selector) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "click requires selector" });
    }
    if (val.type === "type" && (!val.selector || val.text == null)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "type requires selector and text" });
    }
    if (val.type === "select" && (!val.selector || val.value == null)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "select requires selector and value" });
    }
    if (val.type === "upload" && (!val.selector || !val.filePath)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "upload requires selector and filePath" });
    }
    if (val.type === "waitFor" && !val.selector && !val.text) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "waitFor requires selector or text" });
    }
    if (val.type === "assert" && !val.assertion) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "assert requires assertion" });
    }
});
exports.testSpecSchema = zod_1.z.object({
    name: zod_1.z.string().default("Unnamed Suite"),
    environment: zod_1.z.enum(["preview", "staging", "production"]).default("staging"),
    baseUrl: zod_1.z.string().url().optional(),
    allowedUrlPrefixes: zod_1.z.array(zod_1.z.string()).optional(),
    recordVideo: zod_1.z.boolean().optional(),
    steps: zod_1.z.array(exports.stepSchema).min(1)
});
