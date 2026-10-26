import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { allRules, lintText } from "./index.js";
import { compareFacts } from "./compare.js";
/**
 * A Model Context Protocol server over stdio, so an agent can lint its own text and get
 * structured findings back. MCP is JSON-RPC 2.0, one message per line on stdin and stdout.
 * Only the three methods an agent needs are implemented (initialize, tools/list, tools/call)
 * plus ping, with Node built-ins and this package, so the package stays dependency-free.
 */
export const SERVER_NAME = "ai-slop-linter";
export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
/** A problem with what the caller asked for. Reported as a tool result with isError, not as a protocol error. */
class ToolError extends Error {
}
const optionProperties = {
    language: { type: "string", description: "BCP 47 tag of the language the prose is written in. Rules whose evidence is English stand down for any other language. Default auto: worked out from the front matter and the text, English if nothing is clear." },
    ignore: { type: "array", items: { type: "string" }, description: "Rule ids to skip." },
    only: { type: "array", items: { type: "string" }, description: "Run only these rule ids." },
};
const RESULT_NOTE = "Returns line and column, and where the finding ends, for each finding, a score (weighted findings per 1,000 words), a grade A to F (null under 50 words), and for a safe fix the exact character range and replacement. It lists tells; it does not judge who wrote the text.";
export const TOOLS = [
    {
        name: "check_slop",
        description: `Lint text for AI-writing tells such as em dashes, "delve", "not just X but Y" and chatbot residue. ${RESULT_NOTE}`,
        inputSchema: {
            type: "object",
            properties: { text: { type: "string", description: "The text to lint (Markdown or plain text)." }, ...optionProperties },
            required: ["text"],
        },
    },
    {
        name: "check_slop_file",
        description: `Read a file from disk and lint it. ${RESULT_NOTE}`,
        inputSchema: {
            type: "object",
            properties: { file_path: { type: "string", description: "Path of the file to lint." }, ...optionProperties },
            required: ["file_path"],
        },
    },
    {
        name: "compare_facts",
        description: "Compare a text with its rewrite: the numbers, versions, dates, urls, issue ids, quotations, code and names that the rewrite lost or added, plus kind person (a first-person word such as our that the rewrite added, or lost; set language for a short or Turkish text) kind claim (a claim word such as always that the rewrite added) and kind qualifier (an approximator or bound next to a number, such as up to 3, that the rewrite dropped or added). Read-only and deterministic.",
        inputSchema: {
            type: "object",
            properties: {
                before: { type: "string", description: "The original text." },
                after: { type: "string", description: "The rewritten text." },
                language: { type: "string", description: "BCP 47 tag of the language of both texts; it picks the first-person and claim word lists. Default auto: worked out from the front matter and the text, English if nothing is clear." },
            },
            required: ["before", "after"],
        },
    },
    {
        name: "explain_rule",
        description: "Explain one rule: why it exists, an example that trips it, a rewrite, and when to ignore it.",
        inputSchema: {
            type: "object",
            properties: { rule: { type: "string", description: "A rule id, for example dash." } },
            required: ["rule"],
        },
    },
];
const finding = (f) => ({
    rule: f.rule,
    severity: f.severity,
    line: f.line,
    column: f.column,
    endLine: f.endLine,
    endColumn: f.endColumn,
    excerpt: f.excerpt,
    message: f.message,
    fixable: !!f.fix,
    ...(f.fix ? { fix: { start: f.fix.start, end: f.fix.end, replacement: f.fix.replacement } } : {}),
});
const payload = (r) => ({
    path: r.path,
    words: r.words,
    score: r.score,
    grade: r.grade,
    errors: r.errors,
    language: r.language,
    languageSource: r.languageSource,
    stoodDown: r.stoodDown,
    findings: r.findings.map(finding),
});
/** Rule ids named by the caller must exist: a typo would otherwise read as a clean result. */
function options(args) {
    const known = new Set(allRules().map((r) => r.id));
    const list = (key) => {
        const value = args[key];
        if (value === undefined)
            return [];
        if (!Array.isArray(value) || value.some((v) => typeof v !== "string"))
            throw new ToolError(`${key} must be an array of rule ids`);
        for (const id of value)
            if (!known.has(id))
                throw new ToolError(`unknown rule "${id}" (rules: ${[...known].join(", ")})`);
        return value;
    };
    const out = { ignore: list("ignore"), only: list("only") };
    if (args.language !== undefined) {
        if (typeof args.language !== "string")
            throw new ToolError("language must be a string");
        out.language = args.language;
    }
    return out;
}
function run(name, args) {
    if (name === "compare_facts") {
        if (typeof args.before !== "string" || typeof args.after !== "string")
            throw new ToolError("before and after must be strings");
        if (args.language !== undefined && typeof args.language !== "string")
            throw new ToolError("language must be a string");
        return compareFacts(args.before, args.after, { language: args.language });
    }
    if (name === "explain_rule") {
        const rule = allRules().find((r) => r.id === args.rule);
        if (!rule)
            throw new ToolError(`unknown rule "${String(args.rule)}" (rules: ${allRules().map((r) => r.id).join(", ")})`);
        return { id: rule.id, title: rule.title, severity: rule.severity, source: rule.source, why: rule.why, example: rule.example, ignoreWhen: rule.ignoreWhen };
    }
    const opts = options(args);
    if (name === "check_slop") {
        if (typeof args.text !== "string")
            throw new ToolError("text must be a string");
        return payload(lintText("text", args.text, opts));
    }
    const file = args.file_path;
    if (typeof file !== "string" || !file)
        throw new ToolError("file_path must be a non-empty string");
    let text;
    try {
        const stat = statSync(file);
        if (stat.isDirectory())
            throw new ToolError(`path is a directory, not a file: ${file}`);
        if (!stat.isFile())
            throw new ToolError(`path is not a regular file: ${file}`);
        if (stat.size > MAX_FILE_BYTES)
            throw new ToolError(`file is larger than ${MAX_FILE_BYTES} bytes: ${file}`);
        text = readFileSync(file, "utf8");
    }
    catch (err) {
        if (err instanceof ToolError)
            throw err;
        throw new ToolError(`cannot read ${file}: ${err.code ?? "error"}`);
    }
    return payload(lintText(file, text, opts));
}
/**
 * Answer one line from the client. Returns null when nothing is to be sent: a notification
 * (no id) never gets a reply, and neither does a reply from the client.
 */
export function handleMessage(line, version) {
    let message;
    try {
        message = JSON.parse(line);
    }
    catch {
        return fail(null, -32700, "parse error");
    }
    if (typeof message !== "object" || message === null || Array.isArray(message))
        return fail(null, -32600, "invalid request");
    const req = message;
    const hasId = "id" in req;
    const id = typeof req.id === "string" || typeof req.id === "number" ? req.id : null;
    if (typeof req.method !== "string")
        return hasId && !("result" in req) && !("error" in req) ? fail(id, -32600, "invalid request") : null;
    try {
        const reply = dispatch(req.method, req.params, id, version);
        return hasId ? reply : null;
    }
    catch (err) {
        return hasId ? fail(id, -32603, `internal error: ${err instanceof Error ? err.message : String(err)}`) : null;
    }
}
function dispatch(method, params, id, version) {
    if (method === "initialize") {
        const asked = params?.protocolVersion;
        const protocolVersion = typeof asked === "string" && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0];
        return ok(id, { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: SERVER_NAME, version } });
    }
    if (method === "ping")
        return ok(id, {});
    if (method === "tools/list")
        return ok(id, { tools: TOOLS });
    if (method === "tools/call") {
        const p = (params ?? {});
        const tool = TOOLS.find((t) => t.name === p.name);
        if (!tool)
            return fail(id, -32602, `unknown tool ${String(p.name)}`);
        const args = p.arguments === undefined ? {} : p.arguments;
        if (typeof args !== "object" || args === null || Array.isArray(args))
            return fail(id, -32602, "arguments must be an object");
        try {
            const value = run(tool.name, args);
            return ok(id, { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError: false });
        }
        catch (err) {
            if (err instanceof ToolError)
                return ok(id, { content: [{ type: "text", text: err.message }], isError: true });
            throw err;
        }
    }
    return fail(id, -32601, `method not found: ${method}`);
}
/** Read newline-delimited JSON-RPC from `input` until it closes, writing replies to `output`. */
export async function serve(input, output) {
    const version = createRequire(import.meta.url)("../../package.json").version;
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
        if (!line.trim())
            continue;
        const reply = handleMessage(line, version);
        if (reply)
            output.write(`${JSON.stringify(reply)}\n`);
    }
}
