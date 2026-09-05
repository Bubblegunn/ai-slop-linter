# Security

Report a vulnerability privately through GitHub's security advisories:
https://github.com/Bubblegunn/ai-slop-linter/security/advisories/new

Do not open a public issue for a security problem. You will get a first response within
72 hours, and a fix or a written assessment within 14 days of confirmation.

## Supported versions

Only the latest minor release receives security fixes. Upgrade before reporting if you are
behind; if the problem reproduces on the latest release, report it.

## Scope

The CLI reads text files, a commit message, or a pull request body, and with `--fix` writes
the file back. In scope: anything that makes `--fix` change text outside the reported
finding, a regular expression that hangs on crafted input, or `--pr` and `--commit` running
a command other than the documented `gh` and `git` invocations.
