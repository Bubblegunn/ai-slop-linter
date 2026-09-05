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
- The Action lints the pull request title with the body, posts one review comment with the findings table and updates it on every push (`comment`, `baseline` inputs, `findings` output); `--format github` marks each failing text with an error line; `--format markdown` prints that table for issues and reviews
- A commitlint plugin and shareable config (`ai-slop-linter/commitlint`, `ai-slop-linter/commitlint/config`) with one rule, `ai-slop-linter/tells`
- A VS Code task with a problem matcher for the text output (`.vscode/tasks.json`), and a test that pins the line format (#2)
- `--baseline` and `--baseline-write`: record the findings a repository already has and fail only on new ones, keyed by file, rule and sentence rather than line number (#3)
- A moving `v0` tag: every release moves it to the released commit, so `uses: Bubblegunn/ai-slop-linter@v0` follows the newest release in that major without editing the workflow The release workflow starts on full version tags only, so the moving tag cannot start a second publish.
