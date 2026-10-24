# GitHub code scanning (SARIF)

[Back to the README](../README.md)

Use `--format sarif` to emit SARIF 2.1.0 for GitHub code scanning. SARIF output was written by [@Aaqibhafeezkhan](https://github.com/Aaqibhafeezkhan) ([#41](https://github.com/Bubblegunn/ai-slop-linter/pull/41)), who also made file paths with spaces and non-ASCII names valid URIs ([#63](https://github.com/Bubblegunn/ai-slop-linter/pull/63)). Every rule is included in the run metadata with its description and source citation, a `helpUri` linking its own page on the site (`https://bubblegunn.github.io/ai-slop-linter/rules/<id>/`) and `help` text and markdown carrying the same material `--explain` prints. Severities map directly: `error` to `error`, `warning` to `warning`, and `info` to `note`.

The run declares `utf16CodeUnits` for SARIF columns, matching the tool's documented 1-based UTF-16 column convention. Do not convert these columns to Unicode scalar values.

Example workflow:

```yaml
name: ai-slop-linter code scanning

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  security-events: write

jobs:
  slop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: "24"
      - run: npm ci
      - run: npm run build
      - run: node dist/src/cli.js --format sarif --warn "**/*.md" > results.sarif
      - uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: results.sarif
```

One limit worth knowing before you point this at something unusual: the `artifactLocation.uri` in the output is the path you gave on the command line, so running from outside the repository root can produce `../` segments that code scanning will not accept. The workflow above runs at the root, where that cannot happen.

An earlier version of this example ran `sarif-multitool validate` before the upload. It is gone because it could not fail: it exited 0 on every broken file it was given ([#43](https://github.com/Bubblegunn/ai-slop-linter/issues/43)). This repository checks its own SARIF against the vendored 2.1.0 schema in `test/sarif-schema.test.ts` instead. The upload requires `security-events: write`; no broader write permission is needed. `--max-score` remains a separate repository policy and is not encoded as SARIF severity.
