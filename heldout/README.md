# Held-out tasks for an AI-writing-tells tool (written 2026-10-21)

Each task has prompt.txt, fixture/, facts.json, tells.json, check.py, criteria.md, ref/ (correct), broken1/, broken2/ (both must fail) and answers/ (sample final answers).
Run: `python3 -I tN/check.py <dir-after-run> <final-answer.txt>`

- t1 (2026-10-21): rewrite a 590-word English README section full of tells, 37 exact facts (numbers, code spans, URL, quote), code block must stay byte-identical.
- t2 (2026-10-21): "clean up the docs before release" over English, French and German pages; foreign typography (dialogue dashes, guillemets, narrow no-break spaces, German quotes, inverted marks, en dash ranges) must survive.
- t3 (2026-10-21): "set up a check in CI" in a repo with GitHub Actions; checker runs the produced commands on a dirty, a one-tell and a clean probe, plus determinism and offline checks.
