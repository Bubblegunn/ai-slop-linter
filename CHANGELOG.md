# Changelog

## 0.1.0 (unreleased)

First release.

- Twenty rules, each with a named source (mostly Wikipedia's "Signs of AI writing"), three severities, line and column numbers
- Masking for front matter, fenced and inline code, link targets, URLs, HTML tags and comments, so a dash in code is never a finding
- `--fix` for dashes, curly quotes and filler phrases; fixes are idempotent and never change meaning
- Score per 1,000 words and an A to F grade, with `--max-score` and `.slop.json`
- `--commit`, `--commit-msg <file>` and `--pr <n>` for the text that actually goes into a repository
- `--format github` annotations, a composite GitHub Action, a commit-msg hook and an installer
- A Claude Code skill and plugin manifest; also installable with `npx skills add Bubblegunn/ai-slop-linter`
- `--baseline` and `--baseline-write`: record the findings a repository already has and fail only on new ones, keyed by file, rule and sentence rather than line number (#3)
