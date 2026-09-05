# Changelog

## 0.1.4

Before this went out, every rule was run against correct published typography in thirteen languages, one text per language, all public domain and all typeset before any language model existed. The table is `bench/TYPOGRAPHY.md`, the corpus and its licences are in `bench/typography`, and the argument is `docs/typography-across-languages.md`.

One rule failed badly. `dash` carries the highest severity here and fires 73.5 times per 1,000 words on correct Polish, 52.1 on Hungarian, 24.0 on Russian and 22.0 on French, against 1.0 on the English human baseline. The Polish, Hungarian and Russian files grade F for punctuating their own language correctly: the em dash is ordinary in French, opens dialogue in Spanish, and in Russian stands where the verb would go. So a repository can now declare what it writes in, `"language": "fr"` in `.slop.json` or `--language fr`, and `dash` stands down, with the run saying which rules did not run so a quiet result is never read as a clean one. English is the default, so no existing repository sees a change. This is configuration rather than detection on purpose: a README with English headings over French prose defeats a guess in both directions. A density threshold was measured first and does not work, because correct German prose sits at 6.7 findings per 1,000 words and the machine corpus in `bench/PRECISION.md` sits at 5.7.

`curly-quotes` now judges each quote family against the straight form of its own family. Chinese uses the curly double marks as its primary quotation marks and nests straight apostrophes inside them, which is correct Chinese; the rule read that as a paste artifact and reported 21.7 findings per 1,000 words on the Chinese text, now zero, with the English corpus unmoved. The cost is that a file whose only straight mark is an apostrophe no longer has its curly double quotes reported.

`hyphen-density` counted `[a-z]+-[a-z]+`, so `peut-être` and every other compound carrying a non-ASCII letter was invisible and the rule quietly did nothing outside English. It counts Unicode letters now. Measured after the change across both corpora: the highest rate in any file is 1.4 per 100 words against a threshold of 3, so nothing new fires.

`dash` also counted the Chinese 破折号, which is written as two em dashes, as two findings. A run of em dashes is one mark.


`Intl.Segmenter` existing is not the same as ICU carrying the word dictionaries it needs. A Node built with small ICU constructs the segmenter and then hands back a whole run of Japanese, Chinese, Thai, Khmer, Lao, Burmese or Tibetan as a single segment, which is the "a three-thousand-character document counts as one word" bug again, this time with no symptom: the document would grade F whatever it said. The segmenter's answer is now checked per run instead of trusted, and a run of twelve characters or more that comes back as one word falls to the two-characters-per-word estimate. Per run, so a build carrying the dictionary for one of these scripts and not another gets the right treatment for each. Nothing changes on a full-ICU build, which is what CI and the published binaries use.

Both READMEs gain a section on where a finding points: the column is a 1-based UTF-16 offset in logical order, which is what editors, GitHub annotations and language servers use, and for a reader of Arabic or Hebrew that is not the position the eye sees. The finding's `excerpt` is the part meant for reading; the column is for the tool that jumps to it.

## 0.1.3 (2026-09-05)

`bench/agents.mjs` measures whether machine-written commit messages carry the tells this linter looks for, using the declaration the messages make themselves: an agent trailer, an agent suffix in the author name, or a known agent address. Trailers are stripped before counting, because the trailer is the label. Two runs are written up in `RESEARCH.md`, and the second is the reason it exists: on langchain-ai/openwiki the `dash` rule, the only one reported as an error, fires about two and a half times less on the declared side. One repository is an anecdote, and what it establishes is that the direction is not obvious.

The score's design has a citation and its conventions are admitted. Charoenwet, Thongtanunam, Pham and Treude (ISSTA 2024) found warning density the most effective prioritisation and warning severity the least, which is the shape this tool's per-1,000-words score takes; the README also says the study ranks warnings per line of code in security review rather than findings per words of prose, so it supports the shape and proves nothing about this tool. The severity weights and the grade boundaries are labelled as conventions with nothing behind them.

A test now fails when a test file exists and is not named in the test script, after that mistake hid tests twice in one day in two repositories.

A `.mailmap`, because `surviving-lines --identities` reported this repository as two people.

`CITATION.cff` carries keywords and the author's ORCID, which are the fields an archive reads when it mints a record.

## 0.1.2 (2026-09-05)

`--history` reads your own commit messages back over time: weighted tells per 1,000 words per month, quarter or year, with the most common rule in each period. It defaults to the address in the repository's own git config, so the thing it shows you first is your own writing. Trailers are not counted, because a `Co-Authored-By` line is a template rather than prose. There is no grade and no exit code: a bar comparing one period against another describes writing over time, and a lone period gets no bar at all, because a bar is a comparison. `--author`, `--by month|quarter|year` and `--since` narrow it; `--format json` gives the periods for charting.

## 0.1.1 (2026-09-05)

Words are counted in every script. The counter matched `[A-Za-z0-9'’]+`, so a run of
Japanese was a single token and a word containing a non-ASCII letter split into pieces.
Measured on eight documents each carrying one identical em dash, before and after:

| document | characters | words before | grade before | words after | grade after |
|---|---:|---:|:--:|---:|:--:|
| Japanese | 626 | 1 | F | 323 | C |
| Japanese, longer | 3,334 | 1 | F | 1,691 | A |
| Chinese | 460 | 1 | F | 232 | C |
| Korean | 531 | 1 | F | 119 | D |
| Hebrew | 70 | 0 | F | 12 | not graded |
| Arabic | 75 | 0 | F | 12 | not graded |
| Turkish | 1,334 | 264 | C | 136 | D |
| English | 1,366 | 200 | D | 200 | D |

Length now counts for something: the longer Japanese document grades A where the shorter
one grades C, and both were F before at any length. Turkish moves the other way, because
its words were being split at every non-ASCII letter, which inflated the count and
flattered the score. Scripts that separate words are tokenised; Chinese, Japanese, Thai
and the rest go through the platform's Unicode segmenter rather than a
characters-per-word constant nobody measured.

`--languages`, and `"languages"` in `.slop.json`, switch on a rule pack for a language
other than English. No pack ships: the registry is empty, English is unchanged and always
on, and asking for a language with no pack is an error rather than a quiet clean run.
`checkLanguagePack` states what a pack has to satisfy, an id prefixed by its language and a
source on every rule, and CONTRIBUTING.md records which languages can be sourced from the
same authority the English rules use. Issue #1 tracks the first pack, and the rules in it
are an outside contributor's to write.

A directory argument lints the Markdown inside it, which is what running with no target
does for the whole repository. It used to print `EISDIR: illegal operation on a directory,
read`. A directory holding no Markdown now says so and exits 2.

A document under 50 words is no longer graded. Below the floor one finding decides the
letter, so a twelve-word fragment with one em dash printed a confident F. The findings
still stand and an error still fails the run; only the letter is withheld. Commit messages
and pull request descriptions keep their score, since they are short by nature and the
question there is whether the text carries a tell. `bench/scripts` adds one paragraph of
the same release notes in seven scripts, each with one em dash, and `bench/PRECISION.md`
records what each scores, so the counting cannot regress unnoticed.

The English corpus moved by five words in 5,929, from two words carrying accents that
were previously counted as four. No grade changed; `pep-8-style-guide.md` moves from 3.2
to 3.3.

## 0.1.0 (2026-09-05)


A nested Markdown list no longer reads as a spaced hyphen. Indentation followed by a hyphen is a bullet, so a README with nested items took three errors and an F; the rule now refuses a hyphen preceded only by indentation, and the measured corpus is unchanged.

A fenced block now closes on a file with CRLF line endings. The closing marker was matched with `[ \t]*$`, which a trailing carriage return fails, so on Windows a fence stayed open and masked the rest of the document. Caught by the Windows leg of CI on the fixture above, and pinned by a test that feeds the same fixture with CRLF endings.

Masking covers four constructs it missed. Code quoted by four-space or tab indentation, which is how a README shows a diff, was linted as prose, so a diff line beginning `-  ` was reported as a spaced-hyphen dash. A fenced block inside a blockquote was not recognised as a fence. The contents of HTML `pre` and `code` blocks were visible to the rules. Front matter was matched only in its YAML form, so a TOML header was linted. Content indented under a list item stays visible on purpose, because list continuation is prose more often than it is code. Fixture: `test/fixtures/quoted-code.md`.

<!-- slop-ignore-next-line filler -->
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
