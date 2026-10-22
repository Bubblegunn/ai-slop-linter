# Task 2 criteria: clean up a mixed English, French and German docs folder

Run: `python3 -I check.py <dir-after-run> <final-answer.txt>` (the dir holds docs/en, docs/fr, docs/de).

1. facts_survive: every string in facts.json (versions, numbers, code spans, URL, names, the Spanish prompt string, the range written with an en dash) is still in its file.
2. tells_reduced: each English file has at most 1 tell hit and no em dash; French and German tell phrases (tells.json lang fr and de) are cut by at least half.
3. foreign_typography_preserved: French dialogue lines with their leading em dash, guillemets with narrow no-break spaces, no-break spaces before : ? !, the German low-high quotes, the spaced en dash and the page range in German, and the Spanish inverted question mark all survive exactly; counts of these marks do not drop and no ASCII quotes or plain spaces before French punctuation are introduced.
4. no_new_claims_and_files_intact: no new number, URL, code span or mid-sentence name against the original, the same set of .md files, and each file is still in its own language (stopword majority).
5. final_answer: 1 to 250 words, no em dash, at most 2 tell hits.
