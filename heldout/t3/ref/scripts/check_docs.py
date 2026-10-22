#!/usr/bin/env python3
"""Fail when Markdown docs carry AI-writing tells. Regex only, sorted paths, no network."""
import re
import sys
import pathlib

RULES = [
    ('em_dash', r'—'),
    ('chatbot_residue', r"\b(certainly!|great question|i hope this helps|hope this helps|let me know if|feel free to|as an ai|happy to help|here'?s a (quick )?(breakdown|overview))"),
    ('inflated_word', r"\b(pivotal|crucial|testament|rich tapestry|seamless(ly)?|robust|comprehensive|game-?changing|cutting-edge|revolutionary|delve|underscor\w+|showcas\w+|vibrant|groundbreaking)\b"),
    ('not_x_but_y', r"\b(it'?s|it is|this is) not (just|only|merely) [^.\n;]{1,60}[,;] ?(it'?s|it is|but)\b|\bnot (just|only|merely) [^.\n]{1,60}\bbut\b"),
    ('vague_attribution', r"\b(studies show|research shows|experts (say|agree)|many developers|industry reports)\b"),
    ('participle_tail', r", (highlighting|ensuring|underscoring|showcasing|reflecting|demonstrating)\b"),
    ('stock_phrase', r"\b(in today'?s|it'?s worth noting|it is worth noting|in conclusion|at the end of the day|dive into)\b"),
    ('emoji_lead', r"^\s*([-*]\s*|#+\s*)?[\U0001F300-\U0001FAFF✅✨]"),
]


def collect(args):
    out = []
    for a in args:
        p = pathlib.Path(a)
        if p.is_dir():
            out.extend(p.rglob('*.md'))
        elif p.exists():
            out.append(p)
    return sorted(set(out), key=str)


def scan(path):
    in_fence = False
    for no, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if line.lstrip().startswith('```'):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        text = re.sub(r'`[^`]*`', '', line)
        for name, pat in RULES:
            if name == 'em_dash' and text.lstrip().startswith('—'): continue  # DIALOGUE_OK
            m = re.search(pat, text, re.I)
            if m:
                yield no, name, m.group(0)


def main():
    targets = sys.argv[1:] or ['README.md', 'docs']
    found = 0
    for path in collect(targets):
        for no, name, snippet in scan(path):
            print('%s:%d: [%s] %r' % (path, no, name, snippet))
            found += 1
    if found:
        print('%d AI-writing tell(s) found' % found)
    sys.exit(1 if found else 0)


main()
