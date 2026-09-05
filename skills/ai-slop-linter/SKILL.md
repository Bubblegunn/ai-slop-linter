---
name: ai-slop-linter
description: Before finishing any prose you wrote (commit message, PR description, README, docs, article), run ai-slop-linter on it and fix every finding. Also use when the user asks whether text "sounds like AI", asks to humanize text, or asks to remove em dashes.
---

# ai-slop-linter

You write a lot of prose: commit messages, pull request descriptions, docs, release notes. Most of it carries the same tells, and readers have learned to skip text that carries them. This skill makes you check before you hand text over.

## When to run it

Run the linter on anything longer than one line that a person will read, before you call the work done:

- a commit message you are about to commit
- a pull request title and body
- a README, CHANGELOG entry, doc page or article you wrote or edited
- an answer the user asked you to draft for someone else

## How to run it

```
npx ai-slop-linter path/to/file.md          # a file, exits 1 on errors
printf '%s' "$TEXT" | npx ai-slop-linter -   # text you have in hand
npx ai-slop-linter --commit                  # the last commit message
npx ai-slop-linter path/to/file.md --fix     # apply the safe fixes in place
```

Read the output top to bottom. Each line is `line:col severity rule message`. The message says what to do. Apply every fix yourself rather than only running `--fix`: `--fix` handles dashes, curly quotes and filler phrases, and leaves the rest to you because those need a sentence rewritten, not a character swapped.

The file grades A to F. Aim for A on anything you ship. Do not add `slop-ignore` comments to make a file pass; rewrite the sentence.

## If the CLI is not available

Check the text by hand against the rules. Fix each one you find.

**Errors** (never ship these)
- Em dashes and en dashes as dashes. Use a comma, a full stop, or a colon.
- Chatbot residue: `I hope this helps`, `Certainly!`, `Let me know if`, `As an AI`.
- Knowledge-cutoff disclaimers: `as of my last update`, `as of [date] I cannot`.

**Warnings** (rewrite the sentence)
- `Not X but Y`, `It's not X. It's Y.`, `not because A, because B`: say Y directly.
- Forced groups of three adjectives or nouns with a shared suffix: keep the one that is true.
- `The real question is`, `At its core`, `What really matters`: make the point without announcing it.
- A participle tail after a comma that adds significance: `, highlighting`, `, showcasing`, `, underscoring`. Cut it or give it its own sentence with a fact in it.
- Inflated importance: `is a testament to`, `pivotal`, `stands as a`, `marks a turning point`.
- AI vocabulary: `delve`, `tapestry`, `robust`, `seamless`, `vibrant`, `leverage`, `landscape`, `elevate`, `showcase`, `foster`, `crucial`, `comprehensive`, and their friends. Use the plain word.
- Sales language: `world-class`, `best-in-class`, `state-of-the-art`, `cutting-edge`, `nestled in the heart of`.
- Vague sources: `experts argue`, `studies show`, `it is widely believed`. Name the source or drop the claim.
- Announcing: `Let's dive in`, `In this article we will`, `Without further ado`.
- Generic positive closers: `Exciting times ahead`, `the future looks bright`, `stay tuned`.
- Bold mini-headings in list items (`**Speed:** ...`) and decorative emoji.

**Info** (tidy when you can)
- Filler: `in order to`, `due to the fact that`, `it is important to note that`, `at this point in time`.
- Curly quotes in plain-text contexts; Title Case Headings; a formulaic `Challenges and future outlook` section; more than three hyphenated compounds per hundred words.

## What this skill does not do

It does not decide whether a person or a model wrote the text. It lists the patterns that readers associate with machine writing and tells you where they are. A clean pass means the text has none of the listed tells, nothing more.
