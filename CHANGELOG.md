# Changelog

## 0.1.0 (unreleased)

`filler` no longer matches "in order to" when a determiner follows it. "Overrides are applied in order to any file" is "in order" plus "to", not the padded infinitive; the tool found this on its own README.

`.slop.json` takes `overrides`: a list of `{ files, ignore, only, maxScore }` entries applied in order to any path that matches, so published docs can be held to a stricter score than a changelog. `--only` runs the named rules and nothing else, `--skip` is another spelling of `--ignore`, and both reject an unknown rule id instead of doing nothing.

`--init` writes a `.slop.json`, `--init action` the pull request workflow and `--init hook` the commit-msg hook. It refuses to overwrite a file that exists, and it names every file it wrote.

`--explain <rule>` prints one rule in full: why the pattern reads as machine-made, a line that trips it, the same line rewritten, and the case where a maintainer should switch it off. Every rule carries the material, and a test asserts that each rule's own example trips it. The text output names the command for the first rule that fired, on stderr so the machine-readable format is untouched.

A measured corpus in `bench/`: five public-domain texts written before any language model (Austen, Douglass, Darwin, PEP 8, PEP 257) and five pieces of unedited model output. `npm run bench` writes `bench/PRECISION.md` with the rate per rule in each corpus and lists every finding on the human side; CI fails when the committed table is stale. The human texts grade A or B, the model texts F.

`curly-quotes` no longer fires on a document that uses curly marks throughout. It flagged all 92 lines of dialogue in an excerpt of *Pride and Prejudice* and nothing in the model corpus, because consistent curly marks are typography. It now reports only a file that mixes curly and straight marks, which is what pasting from a chat interface leaves.

`not-x-but-y` catches the contracted forms (`isn't just X, it's Y`), which are the common ones, and recognises `that's`, `they're` and `it was` as the second half.

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
