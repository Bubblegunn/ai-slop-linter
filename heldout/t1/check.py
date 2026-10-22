#!/usr/bin/env python3
"""Run: python3 -I check.py <dir-after-run> <final-answer.txt>. Prints PASS/FAIL per criterion."""
import sys, re, json, pathlib, collections, shutil, subprocess, tempfile, os

HERE = pathlib.Path(__file__).resolve().parent
RESULTS = []


def load_json(p):
    return json.loads(pathlib.Path(p).read_text(encoding='utf-8'))


def read(p):
    return pathlib.Path(p).read_text(encoding='utf-8', errors='replace')


TELLS = load_json(HERE / 'tells.json')


def strip_code(t):
    t = re.sub(r'```.*?```', '', t, flags=re.S)
    return re.sub(r'`[^`\n]*`', '', t)


def tell_hits(text, lang='en'):
    t = strip_code(text)
    hits = collections.Counter()
    for r in TELLS:
        if r['lang'] != lang:
            continue
        n = len(re.findall(r['pattern'], t, re.I | re.M))
        if n:
            hits[r['name']] += n
    return hits


def nums(t):
    t = re.sub(r'(?m)^\s*\d+[.)]\s', '', t)
    return set(re.findall(r'\d(?:[\d,.]*\d)?', t))


def names(t):
    return set(re.findall(r'\b[A-Z][A-Za-z0-9]{2,}\b', t))


def mid_names(t):
    return set(re.findall(r'(?<=[a-z,;] )[A-Z][A-Za-z0-9]{2,}\b', t))


def nofence(t):
    return re.sub(r'```.*?```', '', t, flags=re.S)


def spans(t):
    return set(re.findall(r'`[^`\n]+`', nofence(t)))


def urls(t):
    return set(u.rstrip('.,;:') for u in re.findall(r'https?://[^\s)>\]`"]+', t))


def new_claims(o, a):
    out = {
        'numbers': sorted(nums(a) - nums(o)),
        'names': sorted(mid_names(a) - names(o)),
        'urls': sorted(urls(a) - urls(o)),
        'code': sorted(spans(a) - spans(o)),
    }
    return {k: v for k, v in out.items() if v}


def words(t):
    return len(re.findall(r'\S+', t))


def answer_ok(ans, max_words=250):
    w = words(ans)
    h = sum(tell_hits(ans).values())
    em = ans.count('—')
    return (0 < w <= max_words and h <= 2 and em == 0,
            'words=%d tells=%d em_dashes=%d (limits: 1..%d words, <=2 tells, 0 em dashes)' % (w, h, em, max_words))


def crit(name, ok, detail=''):
    RESULTS.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (': ' + detail if detail else ''))


def finish():
    p = sum(1 for _, o in RESULTS if o)
    print('RESULT %d/%d' % (p, len(RESULTS)))
    sys.exit(0 if p == len(RESULTS) else 1)


def main():
    after = pathlib.Path(sys.argv[1])
    ans = read(sys.argv[2])
    o = read(HERE / 'fixture' / 'README.md')
    facts = load_json(HERE / 'facts.json')['README.md']
    fp = after / 'README.md'
    if not fp.exists():
        crit('facts_survive', False, 'README.md missing')
        for n in ('tells_removed', 'no_new_claims', 'structure_kept', 'final_answer'):
            crit(n, False, 'README.md missing')
        finish()
    a = read(fp)
    missing = [s for s in facts if s not in a]
    crit('facts_survive', not missing, ('missing=%r' % missing) if missing else '%d/%d present' % (len(facts), len(facts)))
    b, c = tell_hits(o), tell_hits(a)
    tb, ta = sum(b.values()), sum(c.values())
    crit('tells_removed', ta <= 1 and c.get('em_dash', 0) == 0 and ta <= 0.1 * tb,
         'before=%d after=%d remaining=%s' % (tb, ta, dict(c)))
    nc = new_claims(o, a)
    crit('no_new_claims', not nc, repr(nc) if nc else 'none')
    fo = re.findall(r'```.*?```', o, flags=re.S)
    fa = re.findall(r'```.*?```', a, flags=re.S)
    hd = lambda t: len(re.findall(r'(?m)^#{1,6}\s', t))
    ratio = words(a) / float(words(o))
    crit('structure_kept', fo == fa and abs(hd(a) - hd(o)) <= 1 and 0.55 <= ratio <= 1.1,
         'fences_equal=%s headings %d->%d word_ratio=%.2f' % (fo == fa, hd(o), hd(a), ratio))
    ok, d = answer_ok(ans)
    crit('final_answer', ok, d)
    finish()


main()
