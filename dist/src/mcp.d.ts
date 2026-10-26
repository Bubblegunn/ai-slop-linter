import type { Readable, Writable } from "node:stream";
/**
 * A Model Context Protocol server over stdio, so an agent can lint its own text and get
 * structured findings back. MCP is JSON-RPC 2.0, one message per line on stdin and stdout.
 * Only the three methods an agent needs are implemented (initialize, tools/list, tools/call)
 * plus ping, with Node built-ins and this package, so the package stays dependency-free.
 */
export declare const SERVER_NAME = "ai-slop-linter";
export declare const PROTOCOL_VERSIONS: readonly string[];
export declare const MAX_FILE_BYTES: number;
type Id = string | number | null;
export interface RpcReply {
    jsonrpc: "2.0";
    id: Id;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}
export declare const TOOLS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            language: {
                type: string;
                description: string;
            };
            ignore: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            only: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            text: {
                type: string;
                description: string;
            };
            before?: never;
            after?: never;
            rule?: never;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            language: {
                type: string;
                description: string;
            };
            ignore: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            only: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            file_path: {
                type: string;
                description: string;
            };
            before?: never;
            after?: never;
            rule?: never;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            before: {
                type: string;
                description: string;
            };
            after: {
                type: string;
                description: string;
            };
            language: {
                type: string;
                description: string;
            };
            rule?: never;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            before?: never;
            after?: never;
            language?: never;
            rule: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
})[];
/**
 * Answer one line from the client. Returns null when nothing is to be sent: a notification
 * (no id) never gets a reply, and neither does a reply from the client.
 */
export declare function handleMessage(line: string, version: string): RpcReply | null;
/** Read newline-delimited JSON-RPC from `input` until it closes, writing replies to `output`. */
export declare function serve(input: Readable, output: Writable): Promise<void>;
export {};
