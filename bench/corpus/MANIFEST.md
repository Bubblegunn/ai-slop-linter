# Corpus sources

Every file is an excerpt, trimmed to roughly 1,100 words, with the source's front matter,
chapter headings and indented code blocks removed so the rules see prose.

## human

Writing that existed before any language model, so no sample can contain a tell learned from
one. Three works are literary or scientific prose from the 1840s to 1860s; two are Python
Enhancement Proposals, which are the closest public-domain match to the register this tool is
aimed at, technical documentation kept in a repository.

| file | source | licence |
|---|---|---|
| `austen-pride-and-prejudice.md` | Jane Austen, *Pride and Prejudice* (1813), [Project Gutenberg 1342](https://www.gutenberg.org/ebooks/1342) | public domain |
| `douglass-narrative.md` | Frederick Douglass, *Narrative of the Life of Frederick Douglass* (1845), [Project Gutenberg 23](https://www.gutenberg.org/ebooks/23) | public domain |
| `darwin-origin-of-species.md` | Charles Darwin, *On the Origin of Species* (1859), [Project Gutenberg 1228](https://www.gutenberg.org/ebooks/1228) | public domain |
| `pep-8-style-guide.md` | [PEP 8](https://peps.python.org/pep-0008/), Guido van Rossum, Barry Warsaw, Alyssa Coghlan (2001) | public domain / CC0, per [PEP 1](https://peps.python.org/pep-0001/) |
| `pep-257-docstrings.md` | [PEP 257](https://peps.python.org/pep-0257/), David Goodger, Guido van Rossum (2001) | public domain / CC0, per [PEP 1](https://peps.python.org/pep-0001/) |

## machine

Unedited model output, written for this corpus in the five shapes the tool is pointed at. It
was typed as plain text in an editor, so it carries no smart quotes and no emoji; the
typography rules are therefore not exercised by it, and their rows in the table say `clean`
for that reason rather than because the corpus tested them.

| file | shape |
|---|---|
| `readme-section.md` | a project README |
| `pull-request.md` | a pull request description |
| `article-intro.md` | the opening of a blog post |
| `docs-page.md` | a documentation page |
| `commit-messages.md` | four commit messages |

## What this corpus cannot support

- It is one model's output on one day. A different model, or a person imitating one, produces
  different text.
- Five human sources cannot represent English. Two of them are more than a century and a half
  old, and their sentence length and punctuation are not those of a modern README.
- The human files are prose, not repository text with tables, badges and command blocks. The
  two PEPs are the closest available and are still not a README.
- No sample here is labelled by a person as machine-written or human-written after the fact.
  The labels are provenance, not judgement.
