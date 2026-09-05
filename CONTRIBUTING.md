# Contributing

ai-slop-linter lists the patterns that mark text as machine-made, with line numbers, and fixes the safe ones. Contributions are welcome, and a new rule with a fixture is the easiest kind to merge.

## Running the tests

```
npm ci
npm test        # tsc build, then node:test over the compiled tests
```

Node 20 or newer and git are required (one CLI test builds a throwaway repository). Node 20's test runner does not expand glob patterns, so test files are named explicitly in `package.json`.

## Adding a rule

1. Pick the file in `src/rules/` that fits (`dashes`, `constructions`, `vocabulary`, `residue`, `formatting`) or add a new one.
2. Export a `Rule`: `id` (kebab-case, stable, it appears in `.slop.json` and ignore comments), `title`, `severity`, `source`, and `check(doc)`. Use `scan()` from `src/doc.ts` for regex rules; it handles masking, positions, excerpts and suppression for you.
3. Add it to the `rules` array in `src/index.ts`.
4. Add one sentence to `test/fixtures/sloppy.md` that triggers it, and make sure `test/fixtures/clean.md` still grades A. The first test asserts that every rule fires on the sloppy fixture, so a rule with no fixture line fails the suite.
5. Add a row to the rule table in `README.md`, with its source.

Rules must name a source. Most come from Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) page; a house rule says so in its `source` field.

A fix (`Finding.fix`) is only allowed when applying it cannot change meaning: a character swap, a deletion of a phrase that carries no information. Anything that needs a sentence rewritten stays a finding without a fix.

## Severity

- `error`: a tell that is always wrong in shipped text and has no honest use (em dashes in prose, chatbot residue). Fails the run.
- `warning`: a construction a careful writer would rewrite. Counts 1 towards the score.
- `info`: a tidy-up. Counts 0.3.

## Pull requests

- One change per pull request, with a test that fails before and passes after.
- Say in the description what a user sees differently; the template asks for it.
- Keep the package dependency-free unless the issue discussing the dependency was accepted first.
- No em dashes in shipped text (README, help, output). The linter runs on this repository's own Markdown in CI, so it will tell you.
- Contributors are credited in the changelog entry for the release that ships their change.

## Releasing

Maintainers only.

1. Bump `version` in `package.json`, `action.yml` (the `version` input default), `.claude-plugin/plugin.json` and `CITATION.cff`; add a `CHANGELOG.md` entry.
2. Commit, then `git tag vX.Y.Z && git push origin main --tags`.
3. The `release` workflow runs the tests and publishes to npm with provenance, so every published tarball is linked to the exact commit and workflow run that built it.

The workflow uses npm trusted publishing and holds no token. Before the first tagged release, the maintainer configures the trusted publisher on npmjs.com: package settings, Trusted publishing, GitHub Actions, repository `Bubblegunn/ai-slop-linter`, workflow `release.yml`, with "Allow npm publish" ticked.
