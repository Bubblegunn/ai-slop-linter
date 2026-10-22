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


LANG_OF = {'en': 'en', 'fr': 'fr', 'de': 'de'}
STOP = {
    'en': set('the and is to of a it you for on if'.split()),
    'fr': set('le la les de des et est un une que vous vos en dans'.split()),
    'de': set('der die das und ist nicht zu den ein eine an nach'.split()),
}


def lang_of(rel):
    return rel.split('/')[1]


def md_files(root):
    return sorted(str(p.relative_to(root)) for p in pathlib.Path(root).rglob('*.md'))


def lang_ok(rel, text):
    toks = re.findall(r"[a-zà-ÿ]+", strip_code(text).lower())
    sc = {k: sum(1 for t in toks if t in v) for k, v in STOP.items()}
    mine = lang_of(rel)
    return all(sc[mine] > sc[k] for k in sc if k != mine), sc


def main():
    after = pathlib.Path(sys.argv[1])
    ans = read(sys.argv[2])
    orig = HERE / 'fixture'
    facts = load_json(HERE / 'facts.json')
    typo = load_json(HERE / 'typography.json')
    files = md_files(orig)
    got = {}
    for rel in files:
        p = after / rel
        got[rel] = read(p) if p.exists() else None
    old = {rel: read(orig / rel) for rel in files}

    # 1 facts
    miss = []
    for rel, lst in facts.items():
        for s in lst:
            if got.get(rel) is None or s not in got[rel]:
                miss.append((rel, s))
    crit('facts_survive', not miss, ('missing=%r' % miss) if miss else 'all present')

    # 2 tells
    bad = []
    det = []
    fb = fa = 0
    for rel in files:
        if got[rel] is None:
            bad.append(rel + ' missing')
            continue
        lg = lang_of(rel)
        b, a = tell_hits(old[rel], lg), tell_hits(got[rel], lg)
        det.append('%s %d->%d' % (rel, sum(b.values()), sum(a.values())))
        if lg == 'en':
            if sum(a.values()) > 1 or got[rel].count('—') > 0:
                bad.append('%s still has %s' % (rel, dict(a)))
        else:
            fb += sum(b.values())
            fa += sum(a.values())
    if fb and fa > 0.5 * fb:
        bad.append('fr/de tells %d->%d (need at most half)' % (fb, fa))
    crit('tells_reduced', not bad, '; '.join(bad) if bad else ', '.join(det))

    # 3 typography
    tb = []
    for rel, lst in typo.items():
        for s in lst:
            if got.get(rel) is None or s not in got[rel]:
                tb.append('%s lost %r' % (rel, s))
    for rel in files:
        if got[rel] is None:
            continue
        o, a = old[rel], got[rel]
        lg = lang_of(rel)
        cnt = lambda t, chars: sum(t.count(c) for c in chars)
        pairs = [('–', 'en dash'), ('¿', 'inverted ?'), ('¡', 'inverted !')]
        if lg == 'fr':
            pairs += [('«', 'open guillemet'), ('»', 'close guillemet'), (' ', 'nbsp'), (' ', 'nnbsp')]
        if lg == 'de':
            pairs += [('„', 'low quote'), ('“', 'high quote')]
        for ch, nm in pairs:
            if cnt(a, ch) < cnt(o, ch):
                tb.append('%s %s count %d->%d' % (rel, nm, cnt(o, ch), cnt(a, ch)))
        if lg == 'fr':
            lo = len(re.findall(r'(?m)^—', o))
            la = len(re.findall(r'(?m)^—', a))
            if la < lo:
                tb.append('fr dialogue dash lines %d->%d' % (lo, la))
            if len(re.findall(r' [:;!?]', a)) > len(re.findall(r' [:;!?]', o)):
                tb.append('fr plain space before punctuation introduced')
        if lg in ('fr', 'de') and a.count('"') > o.count('"'):
            tb.append('%s ASCII quotes introduced' % rel)
    crit('foreign_typography_preserved', not tb, '; '.join(tb) if tb else 'all marks intact')

    # 4 no new claims, files, language
    pr = []
    extra = set(md_files(after)) - set(files)
    lost = set(files) - set(md_files(after))
    if extra:
        pr.append('extra files %s' % sorted(extra))
    if lost:
        pr.append('missing files %s' % sorted(lost))
    for rel in files:
        if got[rel] is None:
            continue
        nc = new_claims(old[rel], got[rel])
        if nc:
            pr.append('%s new claims %r' % (rel, nc))
        ok, sc = lang_ok(rel, got[rel])
        if not ok:
            pr.append('%s no longer reads as %s %r' % (rel, lang_of(rel), sc))
    crit('no_new_claims_and_files_intact', not pr, '; '.join(pr) if pr else 'none')

    ok, d = answer_ok(ans)
    crit('final_answer', ok, d)
    finish()


main()
