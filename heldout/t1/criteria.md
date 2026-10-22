# Task 1 criteria: rewrite one tell-heavy README section

Run: `python3 -I check.py <dir-after-run> <final-answer.txt>` (the dir holds README.md).

1. facts_survive: all 37 strings in facts.json (numbers, versions, code spans, the code block lines, issue number, URL, quote) are still in README.md verbatim.
2. tells_removed: the regex list in tells.json (chatbot residue, inflated words, not-X-but-Y, em dash, vague attribution, participle tails, stock phrases, emoji lead, rule of three) drops to at most 1 hit, to 0 em dashes, and by at least 90 percent from the fixture count.
3. no_new_claims: no number, URL, code span or mid-sentence capitalised name appears that was not in the original file.
4. structure_kept: fenced code blocks are byte-identical, heading count is within 1 of the original, and the length is 55 to 110 percent of the original words (so deleting the section does not pass).
5. final_answer: the reply is 1 to 250 words, has no em dash and at most 2 tell hits itself.
