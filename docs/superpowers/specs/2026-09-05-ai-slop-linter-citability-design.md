# Citability: measuring the rules against declared machine writing

Written 5 September 2026, the day the package was published.

## The problem with the claim as it stands

The tool says twenty rules mark writing as machine-made. The evidence for that is
`bench/PRECISION.md`: five public-domain human texts written before any language model
existed, against 1,045 words of unedited model output. That corpus does its job, which is
to show the rules fire on one kind of text and stay quiet on another, and to catch a rule
that is measuring the wrong thing. It caught two.

What it cannot do is carry the claim into the genre the tool is actually pointed at. The
machine half is one model, in one sitting, writing an article, a README section, a
documentation page, a pull request and a set of commit messages. The human half is Austen,
Darwin, Douglass and two Python Enhancement Proposals. Neither half is a real repository,
and the register of a commit message is not the register of a nineteenth-century essay.

So the honest statement of the gap: the rules are known to separate a small hand-written
sample. They are not known to separate machine writing from human writing in commit
messages, which is where the Action, the hook and the commitlint plugin all run.

## What nobody has published

Commit messages are studied for generation, with CommitBench, CommitChronicle and
CommitPackFT as the corpora. They are studied for quality. They are now benchmarked for
consistency with the diff, by CodeFuse-CommitEval. None of that work reads the prose as a
register and asks whether machine-written commit messages carry the stylistic tells that
machine-written prose carries.

That question is answerable here, cheaply, because the ground truth is already in the data
and nobody has to label anything.

## The measurement

A commit message declares its own authorship when a tool wrote it. Three forms:

1. A `Co-Authored-By:` trailer naming an agent, which is what Claude Code, Copilot and
   several others append by convention.
2. An author name carrying an agent suffix, which is what aider writes.
3. A known agent bot address in the author field.

None of that is detection. Nobody is being classified. The commit says who helped write it,
and the measurement takes it at its word.

What is measured: weighted findings per 1,000 words, per rule, on the message body, with
the trailer block removed first.

Removing the trailer is not tidiness. The trailer is the label. Counting it would measure
the template that put the label there, and any rule that fired on `Co-Authored-By` would
report a difference that exists by construction. `stripTrailers` in `src/history.ts`
already removes exactly the contiguous block at the end, which is what the git convention
calls a trailer, and leaves a `Key: value` line in the middle of a paragraph alone.

What it is measured against: the undeclared commits in the same repositories over the same
period.

Same-repository pairing is the methodological core, and the harness enforces it rather
than documenting it. A repository has a house style: some projects write one-line
messages, some write paragraphs, some mandate a template. Comparing declared commits in
one set of repositories against undeclared commits in a different set would measure the
projects and report it as a finding about machines. A repository contributes to the
measurement only when it has commits on both sides, so every difference is a within-project
difference.

## What a result would mean

A per-rule table of rates on each side, with the absolute counts beside them, and the
ratio between them.

Ratios far from one, on rules whose absolute counts are large enough to mean anything,
would say the tells survive into the genre and the tool measures something real where it
runs.

Ratios near one would say they do not. That is a real result and it belongs in the README
rather than in a drawer: it would mean commit messages are too short and too templated to
carry what prose carries, which bounds the tool's own claim and tells a reader where the
rules are worth running and where they are not.

There is no single accuracy number in either case, and no threshold above which a message
is called machine-written. Emitting one would make this a detector, and the reason this
tool is not a detector is already in the README, cited to Liang and colleagues: seven
commercial detectors marked more than half of essays by non-native English writers as
machine-written. A rate per rule, with its counts, is a description. A verdict on a message
is the thing that goes wrong.

## Corpora, and one licence that constrains the design

CommitBench is the obvious external human control, because its filtering excludes bot
commits by design, which makes it a human baseline that was assembled without reference to
this question.

It is released under CC BY-NC 4.0. Two consequences, both binding:

The repository is MIT and people use it commercially, so no part of that corpus is ever
committed here. The harness reads it from wherever the person running it downloaded it, and
the repository stores numbers rather than text.

Anyone rerunning the measurement in a commercial setting cannot use it at all, and the
research note has to say so rather than leaving them to discover it.

Its bot filtering is described in one clause with no methodology, so it is treated as a
convenience baseline and not as a guaranteed clean human sample. The within-repository
comparison is the primary measurement and does not depend on it.

## Two citations that are free, and one that has to be qualified

The score is weighted findings per 1,000 words. That is a density, and density is the
prioritisation strategy with empirical support behind it. Charoenwet, Thongtanunam, Pham
and Treude, at ISSTA 2024, compared strategies for ordering static-analysis warnings and
found warning density gave the largest improvement, up to 5.6% recall and 13.3% on initial
false alarms, while warning severity, the strategy developers reach for first, gave the
lowest improvement on every metric.

The qualification matters and goes in the README beside the citation. That study ranks
warnings per line of code in changed functions during security code review. This tool
ranks findings per thousand words of prose. The design choice is the same shape and the
evidence is from a different domain, so it is support for the shape and not proof about
this tool. Saying that is cheaper than having a reader find it.

The same paragraph admits what has nothing behind it. The severity weights of three, one
and three tenths are a convention. The grade boundaries are a convention. The fifty-word
floor is arithmetic rather than a finding, and the README already explains why it exists.

CodeFuse-CommitEval is cited where the README argues the genre is worth taking seriously,
because it is the current benchmark in the neighbourhood and its own headline number is the
argument for staying rule-based: six models detecting inconsistent commits averaged 85.95%
recall and 80.28% precision, but 63.8% specificity, so on consistent commits they raised a
false alarm about a third of the time.

## What ships

`bench/agents.mjs`, a harness that runs the measurement over repositories already cloned on
the machine, enforcing the within-repository pairing, and printing the per-rule table with
counts.

`RESEARCH.md`, short, describing the selection rule, the split predicate, the commands, the
corpus licences and what the design cannot show, so that a stranger can rerun it and argue
with it.

Two README paragraphs, one grounding the density choice and admitting the conventions, one
citing the benchmark where the genre is discussed.

Nothing about the existing output changes. No flag changes, no exit code changes, and
`bench/PRECISION.md` regenerates byte for byte, because none of this touches a rule.

## What this design cannot show

It cannot show who wrote an undeclared commit. A message with no trailer may have been
written by a model, by a person, or by a person editing a model's draft, and the undeclared
side is a mixture of all three. That mixture makes the measured difference a floor rather
than an estimate: if the sides differ despite the undeclared half containing machine
writing, the true separation is larger, and if they do not differ, the mixture is one
reason among several.

It cannot generalise past the projects sampled, and the sample is whatever the person
running it cloned.

It cannot say a rule is right. A rule that fires more on declared machine messages is
measuring something that correlates with the declaration, and a house template that agents
follow would produce the same signal as a habit models have.
