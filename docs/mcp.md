# Use ai-slop-linter from an AI agent

`slop --mcp` starts a [Model Context Protocol](https://modelcontextprotocol.io) server on standard input and output. An agent that writes a commit message, a pull request description or a README can lint its own text and read the findings as JSON before it hands the text over.

```
npx --yes ai-slop-linter --mcp
```

## Tools

| tool | input | returns |
|---|---|---|
| `check_slop` | `text`, and optionally `language`, `ignore`, `only` | the findings for that text |
| `check_slop_file` | `file_path`, and the same options | the findings for that file |
| `compare_facts` | `before` and `after` (two texts), and optionally `language` | the facts the rewrite lost or added: numbers, versions, dates, urls, issue ids, quotations, code and names, first-person words (kind `person`) the rewrite added or dropped, claim words (kind `claim`) it added, an approximator or bound next to a number (kind `qualifier`, such as `up to 3`) that it dropped or added, and how many facts were kept. Set `language` for a text under about 25 words or in Turkish, which detection cannot tell |
| `explain_rule` | `rule` | why the rule exists, an example that trips it, a rewrite, and when to ignore it |

A finding has `rule`, `severity`, `line`, `column`, `endLine`, `endColumn`, `excerpt`, `message` and `fixable`. A fixable finding also carries `fix`, the character range (`start`, `end`, in UTF-16 code units) and the `replacement`, so the agent can apply it without guessing. The result also has `score` (weighted findings per 1,000 words), `grade` (null under 50 words) and `errors`.

`explain_rule`, `only` and `ignore` accept the ids of the language pack rules (`fr/closer`) as well as the English ones.

A rule id that does not exist, a file that cannot be read and a directory in place of a file come back as an error result with a message, never as a clean one.

## Set up

Claude Code:

```
claude mcp add ai-slop-linter -- npx --yes ai-slop-linter --mcp
```

Codex:

```
codex mcp add ai-slop-linter -- npx --yes ai-slop-linter --mcp
```

Any client that reads an `mcpServers` object:

```json
{
  "mcpServers": {
    "ai-slop-linter": { "command": "npx", "args": ["--yes", "ai-slop-linter", "--mcp"] }
  }
}
```

The tests in this repository speak the protocol to `slop --mcp` directly. The two commands above were not run against Claude Code or Codex when this page was written, so check them in your client.

## What it does not do

It lists tells and does not say who wrote the text. It implements `initialize`, `ping`, `tools/list` and `tools/call` and nothing else, so it offers no resources or prompts. The package still has no dependencies: the server is a separate module that the command loads only for `--mcp`.
