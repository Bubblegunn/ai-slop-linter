# Do machine-written commit messages carry these tells?

The rules in this linter are measured on prose, in `bench/PRECISION.md`: five public-domain
human texts against 1,045 words of unedited model output. That corpus shows the rules fire
on one kind of writing and stay quiet on another. It does not show they separate machine
writing from human writing in commit messages, which is where the Action, the commit hook
and the commitlint plugin actually run.

`bench/agents.mjs` is the harness for answering that. This file is how to rerun it and what
it can and cannot support.

## Where the ground truth comes from

Nothing here detects authorship. A commit message says who helped write it, in one of three
ways, and the measurement takes it at its word:

1. A trailer naming a coding agent, which is what Claude Code, Copilot, Devin and others
   append by convention.
2. An author name carrying an agent suffix, which is what aider writes.
3. A known agent bot address in the author field.

The list in `AGENTS` is deliberately conservative and matches addresses rather than names,
so that a person called Claude is never counted as a machine. Under-counting is the safe
direction: an agent commit the list misses lands on the undeclared side, which dilutes that
side toward machine writing and makes any measured difference a floor rather than an
estimate.

Dependency bots are excluded on purpose. Dependabot and Renovate write a template that never
varies, so counting them would measure the template and report it as a habit models have.

## The split, and why the trailer goes first

The trailer is the label. A rule firing on `Co-Authored-By` would report a difference that
exists by construction, so the trailer block is removed before any text is counted. The
harness reuses `stripTrailers` from `src/history.ts`, which removes only the contiguous
block at the end, the thing the git convention calls a trailer, and leaves a `Key: value`
line inside a paragraph alone. A message that explains the convention in prose is therefore
not counted as an agent's work, and there is a test for exactly that.

A message with no prose left after the trailer goes contributes to neither side.

## Why the comparison stays inside one repository

A project has a house style. Some write one-line messages, some write paragraphs, some
mandate a template. Comparing declared commits in one set of projects against undeclared
commits in a different set would measure the projects and report it as a finding about
machines.

So a repository counts only when it has commits on both sides, and `pairedOnly` enforces
that in code rather than in a paragraph. Repositories with only one side are dropped and
listed with the reason.

## Running it

```sh
npm run build
node bench/agents.mjs ~/src/repo-a ~/src/repo-b
node bench/agents.mjs --dir ~/src
```

It prints a Markdown table: the rate per 1,000 words on each side, the ratio between them,
and the absolute counts that produced both. Read a row only when both counts are large
enough to mean something.

## Two runs so far, and neither is a study

Six repositories from this account, which is the weakest possible sample: one author, one
agent, and 349 declared messages against 41 undeclared ones. It shows the harness runs.

```
declared   349 messages, 54,228 words
undeclared  41 messages,  2,617 words
dash            2.54 /1k declared, 0.38 /1k undeclared, ratio 6.66  (138 against 1)
hyphen-density  0.89 /1k declared, 0    /1k undeclared, no ratio    (48 against 0)
```

One third-party repository, langchain-ai/openwiki, with 41 declared messages against 255
undeclared:

```
declared    41 messages,  9,464 words
undeclared 255 messages, 26,401 words
dash            2.64 /1k declared, 6.82 /1k undeclared, ratio 0.39  (25 against 180)
hyphen-density  2.43 /1k declared, 0.72 /1k undeclared, ratio 3.38  (23 against 19)
```

The second run is the reason the study is worth doing. On that repository the dash rule,
which is this tool's most confident rule and its error-severity one, fires **less** on
declared machine messages than on the rest, by a factor of about two and a half. The
hyphen-density rule goes the other way.

Neither run is evidence about machine writing in general. One repository is an anecdote,
the sample was whatever happened to be on the machine, and 41 messages is small. What the
pair establishes is narrower and still worth writing down: the direction is not obvious,
and anyone who assumed these rules would separate the two sides in commit messages should
run it before saying so. That includes this project.

## The sample the real study needs

Repositories chosen before the measurement rather than after, across languages and project
sizes, filtered for the mining pitfalls that Kalliamvakou and colleagues documented, so
personal and inactive repositories do not dominate. Cloned, measured, deleted, one at a
time, because `git blame` and `git log` need real objects and no event archive carries them.

A per-rule table with confidence intervals, published with the repository list, so a
stranger can rerun it.

## Corpora, and a licence that binds

CommitBench is the natural external human control, because its filtering excludes bot
commits for reasons unrelated to this question. It is released under CC BY-NC 4.0, and two
consequences follow.

No part of it is ever committed to this repository. This project is MIT and people use it
commercially; the harness reads a corpus from wherever you downloaded it, and what is stored
here is numbers rather than text.

Anyone rerunning this in a commercial setting cannot use that corpus at all. The
within-repository comparison is the primary measurement and does not depend on it.

Its bot filtering is described in a single clause with no method, so it is a convenience
baseline and not a guaranteed clean human sample.

## What this design cannot show

It cannot say who wrote an undeclared commit. That side is a mixture of human writing,
undeclared machine writing, and human editing of a machine draft. The mixture is why a
measured difference is a floor.

It cannot generalise past the repositories sampled, and the sample is whatever the person
running it cloned.

It cannot say a rule is right. A rule that fires more on declared messages is measuring
something that correlates with the declaration, and a house template that agents follow
would produce the same signal as a habit models have.

It produces no accuracy number and no threshold, and it must not. The reason is in the
README, cited to Liang and colleagues: seven commercial detectors marked more than half of
essays by non-native English writers as machine-written. A rate per rule with its counts is
a description. A verdict on a message is the thing that goes wrong.
