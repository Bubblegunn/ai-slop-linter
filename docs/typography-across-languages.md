# Do these rules measure machine writing, or measure English?

Every rule in this linter was written against English prose and measured on English prose.
`bench/PRECISION.md` reports what they do to five public-domain English texts and to 1,045
words of unedited model output. That corpus says nothing about a French writer writing
French.

Punctuation is not universal. The em dash is ordinary typography in French, where it is set
with spaces around it. Spanish opens a line of dialogue with one. Hungarian does the same job
with an en dash. Russian puts an em dash where the verb "to be" would go, so the mark is not
decoration there, it is grammar. Chinese and Japanese have their own dash and comma forms
entirely. If a rule fires on a person writing their own language correctly, the tool is not
measuring machine writing. It is charging a fee for not writing in English.

This repository already cites Liang et al. on GPT detectors misclassifying writing by
non-native English speakers. A tool that repeats that failure in a different form would be
worse than one that never read the paper.

So the rules were run against correct native typography in thirteen languages, and this is
what came back.

## What was measured

Thirteen excerpts of published prose, one per language, roughly 1,100 words each, all written
and typeset before any language model existed and all in the public domain. Ten come from
Project Gutenberg. Russian and Turkish come from Wikisource, because Project Gutenberg has no
plain-text Russian file that contains Russian and no Turkish books at all. Each text was
punctuated by a publisher or a translator applying that language's own conventions, so none of
the punctuation in the corpus is a mistake.

`bench/typography/MANIFEST.md` names every text, its author, its date, its source and its
licence, and records the one candidate that was rejected on licence grounds. The corpus lives
in `bench/typography`, the harness is `bench/typography.mjs`, and the generated numbers are in
`bench/TYPOGRAPHY.md`. Rates are findings per 1,000 words, the same measure `bench/precision.mjs`
uses. The English baseline is not a new file: the harness reads the same five English texts from
`bench/corpus/human`, so the English row here and the human column in `bench/PRECISION.md` are
one sample rather than two that disagree.

## What happened

Two rules of the twenty fired on any non-English file. Both are typography rules. Two others
fired only on English. The remaining sixteen fired nowhere in this corpus.

`dash` is the finding. It carries `error` severity, the highest this tool has, and after
restoring the em dashes that nineteenth-century transcribers typed as two hyphens, it fires at
these rates per 1,000 words:

| language | `dash` per 1,000 words |
|---|---:|
| Polish | 73.5 |
| Hungarian | 52.1 |
| Russian | 24.0 |
| French | 22.0 |
| Dutch | 15.2 |
| Spanish | 13.4 |
| Portuguese | 12.3 |
| Turkish | 8.9 |
| Finnish | 8.2 |
| German | 6.7 |
| English, human baseline | 1.0 |
| Italian, Japanese, Chinese | 0 |

The Polish file grades F. So does the Hungarian one, and the Russian one. Nothing is wrong with
any of them. They are a Conan Doyle translation from 1902, a Jókai novel from 1862 and a Chekhov
story from 1899, each punctuated exactly as its language requires.

`curly-quotes` is the second. It fires 21.7 times per 1,000 words on the Chinese file, because
the standard Chinese quotation marks are the same code points as the English curly quotes, and
the rule's mixture test is satisfied by four straight ASCII apostrophes nested inside them,
which is itself correct Chinese practice.

Italian, Japanese and Chinese score zero on `dash` for three different reasons, and only one of
them is good news. Italian quotes dialogue with guillemets and the excerpt happens to use no
dash at all. Japanese uses neither. Chinese does use a dash, and the rule cannot see it. The
Chinese 破折号 is written as two em dashes, and the rule counts one punctuation mark as two
findings; written with the box-drawing character that this Chinese edition uses, it produces
none. Both were checked directly against the built linter rather than inferred from the pattern.

## Which rules measure machine writing, and which measure English

The division is visible in the source, and it is cleaner than the table alone suggests.

Fifteen rules are built from English words and phrases: `not-x-but-y`, `triad`, `reveal`,
`ing-tail`, `inflated`, `ai-vocabulary`, `sales`, `filler`, `chatbot`, `announcing`, `closer`,
`challenges-section`, `cutoff-disclaimer`, `vague-source` and `title-case-heading`. Outside
English these are not unfair. They are inert. A French README written entirely by a model passes
all fifteen, because `in order to` is not a French phrase and title case is not a French
convention. That is a real limit on what this tool can claim, and it is the opposite of the
problem `dash` has: the word rules are blind rather than biased.

Three rules are built from document structure rather than language: `bold-label`, `emoji` and
the heading half of `title-case-heading`. A bold label followed by a colon reads the same in any
language, and these should carry across unchanged. This corpus cannot confirm that, because it
is continuous prose and contains no headings, no lists and no emoji at all.

Two rules are built from punctuation: `dash` and `curly-quotes`. These are the two that fire on
correct native typography, and they are the two that need a decision.

`hyphen-density` belongs in a category of its own. Its pattern is `\b[a-z]+-[a-z]+\b`, which is
ASCII, so it cannot match `peut-être` or any other hyphenated compound containing a letter
outside the English alphabet. It did not fire on any file here, English included. It is not
penalising anyone; it is quietly not working outside ASCII.

## What the fix would be

Nothing here is implemented. This is a measurement, and the changes it argues for belong in
their own change with their own tests.

### `dash`

Three shapes were considered.

The first is a per-language exemption driven by language detection: guess the document's
language and stand the rule down when the guess is not English. This is rejected. Detection is
a guess made on text that is often mixed, a README with English headings over French prose
being the normal case rather than the exception, and a wrong guess either silences the rule on
English or exempts nothing on French. It also puts a list of languages in the source, which
invites the question of which languages were left off it.

The second is to make `dash` a consistency rule rather than a presence rule, in exactly the way
`curly-quotes` already works: a document that uses the mark throughout has made a typographic
choice, and the tell is the isolated dash in text that otherwise has none. This is the shape
this repository would reach for first, and the measurement rules it out. Correct German prose
sits at 6.7 dashes per 1,000 words and the machine corpus in `bench/PRECISION.md` sits at 5.7.
The distributions overlap, so no global threshold separates a German writer from a model. The
idea is good and the numbers do not support it, which is worth recording so that nobody spends
an afternoon rediscovering it.

The third is to treat the language as configuration rather than inference. `dash` keeps its
current behaviour and its current severity when the configured language is English, which is
the default and therefore the status quo for every repository that exists today. When a
repository declares that it writes in something else, `dash` is off, because outside English
this tool has no evidence that a dash means anything, and the evidence it does have says the
dash is ordinary there.

This third option is the one to take. It fixes Polish, Hungarian, Russian, French, Dutch,
Spanish, Portuguese, Turkish, Finnish and German at once without naming any of them in a rule,
it does not silently change what any existing repository sees, and it puts the claim where it
can be defended: this rule is a house rule for English text in a repository, and it says so.

The honest cost is that a machine-written French README would no longer be flagged for its
dashes. That is the right trade. The alternative charges a French writer an error-severity
finding every few sentences for punctuating French correctly, which is precisely the failure
Liang et al. describe, and this tool would rather miss a model than mark a person.

One smaller change is independent of all of this and is right either way. Where `dash` stays
on, it should count the Chinese 破折号 as the single mark it is instead of two findings, and it
should recognise the dash forms that Chinese editions actually use. A rule that fires twice for
one dash is wrong about the text whatever the policy is.

### `curly-quotes`

The rule fires on the Chinese file because it tests whether the document contains any straight
quote or apostrophe and then reports every curly mark. In Chinese, the full-width quotation
marks are the primary quotation marks, and a straight apostrophe nested inside them is normal.
The fix is to judge each quote family separately, counting the curly double marks against the
straight double marks and the curly single marks against the straight single marks, and to
report only when the straight form of the same family is itself being used as a quotation mark.
That keeps the behaviour the rule was written for, which is text pasted out of an interface that
substituted smart quotes into a file that otherwise uses straight ones, and it stops the rule
from reading correct Chinese as a paste artifact.

This is the option to take because it needs no configuration and no language detection. It is
the rule's existing idea, applied more carefully.

### `hyphen-density`

Replace the ASCII character class with a Unicode letter class so the rule means the same thing
in every alphabet. This should be measured before it is trusted, because languages that hyphenate
freely may cross the threshold for reasons that have nothing to do with a model reaching for
adjectives, and this corpus cannot answer that question: the rule reports nothing until it
crosses the threshold, so a corpus of files that never cross it says only that they never
crossed it.

## What this cannot support

- One text per language. A single novel is not a language. These files show what the rules do
  to correct native typography. They cannot say how often a given language reaches for a dash
  on average.
- Nineteenth-century novels are not READMEs. The register is wrong for the tool's target, and
  the direction of that error is unknown.
- No machine-written text in any of these languages was measured. Whether a model writing
  French produces French tells, and whether those tells look anything like the English ones,
  is open and this corpus does not touch it.
- Sixteen rules fired nowhere. That is a property of a prose corpus with no headings, lists or
  emoji, not evidence that those rules are safe in any language.
- The Turkish file is 561 words, about half the size of the others, so its rate is the noisiest
  number in the set.

## Rerunning it

```sh
npm run build
node bench/typography.mjs           # regenerate bench/TYPOGRAPHY.md
node bench/typography.mjs --check   # fail if the committed table is stale
```
