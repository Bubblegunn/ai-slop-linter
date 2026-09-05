# Typography corpus sources

Thirteen excerpts of published prose, one per language, each trimmed to roughly 1,100 words
of continuous text with front matter, chapter headings and editorial apparatus removed. Every
text was written and set before any language model existed, so nothing here can carry a habit
learned from one, and every one of them was punctuated by a publisher or a translator applying
that language's own conventions.

The point of the corpus is that none of this punctuation is a mistake. The spaced dash in
French, the raya that opens a line of Spanish dialogue, the en dash Hungarian uses for the same
job, the em dash Russian puts where the verb "to be" would go, the guillemets of Italian, the
low opening quotation mark of Polish and German, the ideographic comma and corner brackets of
Japanese, the full-width quotation marks of Chinese: all of it is what a careful writer of that
language is supposed to type.

English is not a file here. `bench/corpus/human` already holds five English texts measured the
same way, and `bench/typography.mjs` reads them from there so that the English baseline in
[`../TYPOGRAPHY.md`](../TYPOGRAPHY.md) and the human baseline in
[`../PRECISION.md`](../PRECISION.md) are the same numbers rather than two samples that disagree.

## Files

| file | language | work | author | first published | source | licence |
|---|---|---|---|---|---|---|
| `de-eichendorff-taugenichts.md` | German | *Aus dem Leben eines Taugenichts* | Joseph von Eichendorff (1788–1857) | 1826 | [Project Gutenberg 35312](https://www.gutenberg.org/ebooks/35312) | public domain |
| `es-pardo-bazan-insolacion.md` | Spanish | *Insolación* | Emilia Pardo Bazán (1851–1921) | 1889 | [Project Gutenberg 52597](https://www.gutenberg.org/ebooks/52597) | public domain |
| `fi-haanpaa-karavaani.md` | Finnish | *Karavaani ja muita juttuja* | Pentti Haanpää (1905–1955) | Helsinki: Kansanvalta, 1930 | [Project Gutenberg 78018](https://www.gutenberg.org/ebooks/78018) | public domain |
| `fr-dumas-monte-cristo.md` | French | *Le comte de Monte-Cristo*, tome I | Alexandre Dumas (1802–1870) | 1844 | [Project Gutenberg 17989](https://www.gutenberg.org/ebooks/17989) | public domain |
| `hu-jokai-uj-foldesur.md` | Hungarian | *Az új földesúr*, 1. kötet | Mór Jókai (1825–1904) | 1862 | [Project Gutenberg 43777](https://www.gutenberg.org/ebooks/43777) | public domain |
| `it-manzoni-promessi-sposi.md` | Italian | *I promessi sposi* | Alessandro Manzoni (1785–1873) | 1840–1842 | [Project Gutenberg 45334](https://www.gutenberg.org/ebooks/45334) | public domain |
| `ja-akutagawa-rashomon.md` | Japanese | 羅生門 | Ryūnosuke Akutagawa (1892–1927) | 1915 | [Project Gutenberg 1982](https://www.gutenberg.org/ebooks/1982) | public domain |
| `nl-multatuli-max-havelaar.md` | Dutch | *Max Havelaar* | Multatuli, pen name of Eduard Douwes Dekker (1820–1887) | 1860 | [Project Gutenberg 11024](https://www.gutenberg.org/ebooks/11024) | public domain |
| `pl-doyle-baskerville.md` | Polish | *Tajemnica Baskerville'ów*, translated by Eugenia Żmijewska (1865–1923) | Arthur Conan Doyle (1859–1930) | translation dated 1902 in the source | [Project Gutenberg 34079](https://www.gutenberg.org/ebooks/34079) | public domain |
| `pt-eca-de-queiros-ramires.md` | Portuguese | *A Ilustre Casa de Ramires* | Eça de Queirós (1845–1900) | 1900 | [Project Gutenberg 23145](https://www.gutenberg.org/ebooks/23145) | public domain |
| `ru-chekhov-dama-s-sobachkoy.md` | Russian | Дама с собачкой | Anton Chekhov (1860–1904) | *Русская мысль*, 1899 | [Russian Wikisource](https://ru.wikisource.org/wiki/Дама_с_собачкой_(Чехов)) | public domain, author died 1904 |
| `tr-omer-seyfettin-kasagi.md` | Turkish | Kaşağı | Ömer Seyfettin (1884–1920) | in the author's lifetime; the source page gives no date | [Turkish Wikisource](https://tr.wikisource.org/wiki/Kaşağı) | public domain, author died 1920 |
| `zh-song-ling-li-ji-guang.md` | Chinese | 灵历集光 | Song Shangjie / John Sung (1901–1944) | diaries kept to 1944, compiled posthumously | [Project Gutenberg 25716](https://www.gutenberg.org/ebooks/25716) | public domain |

## How the licences were checked

**Project Gutenberg.** Each of these texts is distributed by Project Gutenberg as public domain
in the United States, which is the same basis on which `bench/corpus/human` already carries
Austen, Douglass and Darwin. Project Gutenberg's own header, footer, licence text and the
"Project Gutenberg" trademark phrase are removed from every excerpt, which is the condition
under which a public-domain text may be redistributed without the Project Gutenberg licence
attaching to it. Nothing that was added by a transcriber, an editor or the Project itself
survives in the files.

**Wikisource.** Two languages could not come from Project Gutenberg: it has nine Russian books,
none of which offers a plain-text file that contains the Russian text, and it has no Turkish
books at all. Both replacements are works whose author's copyright has expired, Chekhov in 1904
and Ömer Seyfettin in 1920, so the works themselves are in the public domain independently of
Wikisource. The wiki markup, templates, headers and footnotes that Wikisource contributors added
around them are licensed CC BY-SA 4.0 and are stripped out; none of that layer is reproduced.

**One case that was rejected.** The first Chinese excerpt taken from Project Gutenberg 25716
landed in a foreword written in 1993 by the compiler who assembled the diaries. Project
Gutenberg clears the ebook as a whole, but that foreword is not the 1901–1944 author's prose and
its own status is not established by his death. The excerpt was moved into the diary text and
the foreword was discarded.

## What this corpus cannot support

- One text per language. A single novel is not a language, and a nineteenth-century novel is
  not a modern README. These files show what the rules do to correct native typography; they
  cannot show how often a given language reaches for a dash on average.
- One of the thirteen is a translation: the Polish file is Conan Doyle in Eugenia Żmijewska's
  Polish. A translator applies the target language's typographic conventions, which is exactly
  what is being measured, but the sentence rhythm underneath is the source author's.
- The Turkish file is 561 words, half the size of the others, because it is a complete short
  story and there was no longer public-domain Turkish text available from a source whose licence
  could be verified. Its rate per 1,000 words is therefore the noisiest number in the table.
- These are prose. No file contains a heading, a bold label, a list or an emoji, so every rule
  that needs one of those has nothing to match here in any language, including English.
- Several nineteenth-century transcriptions type the em dash as two hyphens. The generated
  table measures that effect explicitly rather than leaving it in the numbers; see "What the
  transcription hides" in [`../TYPOGRAPHY.md`](../TYPOGRAPHY.md).
