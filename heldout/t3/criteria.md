# Task 3 criteria: add a CI check for AI writing tells

Run: `python3 -I check.py <repo-dir-after-run> <final-answer.txt>`. The checker copies the repo to a temp git repo (base commit on `main`, `origin/main` ref set, probe committed on a branch, GITHUB_* variables set), then runs the run: commands the agent added to .github/workflows, skipping install steps and the commands that were already there.

1. workflow_wired: a new run: command exists in a workflow that triggers on pull_request, the existing CI workflow facts are intact (checkout, setup-node, npm test), and the repo docs and French dialogue were not altered.
2. fails_on_dirty: the produced commands exit non-zero on probe dirty_a (many tells) and on dirty_b (one em dash used as punctuation).
3. passes_on_clean: the produced commands exit 0 on the repo with probes/clean.md added (English prose, French dialogue dashes and guillemets, German quotes, a range, a Spanish inverted mark) and on the repo with no probe at all.
4. deterministic_explainable: two runs on dirty_a give identical output, and the output names the file (probe.md) with a line number.
5. local_and_offline: no model or network call in the added commands or scripts (no curl, wget, urllib, requests, openai, anthropic and similar).
