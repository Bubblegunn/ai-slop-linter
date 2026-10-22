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


SKIP = re.compile(r'^\s*(sudo\s+)?(pip3?\s+install|python3?\s+-m\s+pip\s+install|npm\s+(ci|install)\b|apt(-get)?\s|echo\b|corepack\b|#)')


def parse_runs(text):
    lines = text.splitlines()
    out = []
    i = 0
    while i < len(lines):
        m = re.match(r'^(\s*)(?:-\s+)?run:\s*(.*)$', lines[i])
        if not m:
            i += 1
            continue
        indent = len(m.group(1))
        val = m.group(2).strip()
        if val in ('|', '|-', '|+', '>', '>-'):
            blk, base = [], None
            i += 1
            while i < len(lines):
                l = lines[i]
                if l.strip() == '':
                    blk.append('')
                    i += 1
                    continue
                ind = len(l) - len(l.lstrip())
                if base is None:
                    if ind <= indent:
                        break
                    base = ind
                if ind < base:
                    break
                blk.append(l[base:])
                i += 1
            out.append('\n'.join(blk).strip())
            continue
        if len(val) > 1 and val[0] == val[-1] and val[0] in '\'"':
            val = val[1:-1]
        out.append(val)
        i += 1
    return [c for c in out if c]


def runs_in(root):
    res = {}
    wf = pathlib.Path(root) / '.github' / 'workflows'
    if wf.is_dir():
        for p in sorted(list(wf.glob('*.yml')) + list(wf.glob('*.yaml'))):
            res[p.name] = (read(p), parse_runs(read(p)))
    return res


def prune(cmd):
    keep = [l for l in cmd.splitlines() if not SKIP.match(l)]
    return '\n'.join(keep).strip()


def subst(cmd, dst, base, head):
    rep = {'github.base_ref': 'main', 'github.head_ref': 'pr', 'github.sha': head,
           'github.event.pull_request.base.sha': base, 'github.event.pull_request.head.sha': head,
           'github.event_name': 'pull_request', 'github.workspace': str(dst)}
    return re.sub(r'\$\{\{\s*([^}]*?)\s*\}\}', lambda m: rep.get(m.group(1).strip(), m.group(0)), cmd)


def git(args, cwd, env):
    return subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t.t'] + args, cwd=cwd, env=env,
                          check=True, capture_output=True, text=True).stdout.strip()


def run_variant(after, probe, produced):
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='slopt3-'))
    dst = tmp / 'repo'
    shutil.copytree(after, dst, ignore=shutil.ignore_patterns('.git', 'node_modules'))
    binp = tmp / 'bin'
    binp.mkdir()
    py3 = shutil.which('python3') or sys.executable
    (binp / 'python').symlink_to(py3)
    env = dict(os.environ)
    for k in list(env):
        if k.startswith('GIT_'):
            del env[k]
    env.update({'HOME': str(tmp), 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_SYSTEM': '/dev/null',
                'PATH': str(binp) + os.pathsep + env.get('PATH', '')})
    git(['init', '-q', '-b', 'main'], dst, env)
    git(['add', '-A'], dst, env)
    git(['commit', '-q', '-m', 'base'], dst, env)
    base = git(['rev-parse', 'HEAD'], dst, env)
    git(['update-ref', 'refs/remotes/origin/main', base], dst, env)
    git(['checkout', '-q', '-b', 'pr'], dst, env)
    if probe:
        shutil.copy(HERE / 'probes' / probe, dst / 'docs' / 'probe.md')
        git(['add', '-A'], dst, env)
        git(['commit', '-q', '-m', 'probe'], dst, env)
    head = git(['rev-parse', 'HEAD'], dst, env)
    env.update({'GITHUB_ACTIONS': 'true', 'CI': 'true', 'GITHUB_BASE_REF': 'main', 'GITHUB_HEAD_REF': 'pr',
                'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_WORKSPACE': str(dst), 'GITHUB_SHA': head})
    out = ''
    code = 0
    for cmd in produced:
        c = subst(cmd, dst, base, head)
        try:
            r = subprocess.run(['bash', '-eo', 'pipefail', '-c', c], cwd=dst, env=env, capture_output=True,
                               text=True, timeout=120)
            out += r.stdout + r.stderr
            if r.returncode != 0:
                code = r.returncode
                break
        except subprocess.TimeoutExpired:
            out += 'TIMEOUT\n'
            code = 124
            break
    out = out.replace(str(dst), '<repo>').replace(str(tmp), '<tmp>')
    shutil.rmtree(tmp, ignore_errors=True)
    return code, out


def main():
    after = pathlib.Path(sys.argv[1])
    ans = read(sys.argv[2])
    orig = HERE / 'fixture'
    facts = load_json(HERE / 'facts.json')

    # probe sanity, using the task's own regex list
    sa = sum(tell_hits(read(HERE / 'probes' / 'dirty_a.md')).values())
    sb = sum(tell_hits(read(HERE / 'probes' / 'dirty_b.md')).values())
    sc = sum(tell_hits(re.sub(r'(?m)^\u2014.*$', '', read(HERE / 'probes' / 'clean.md'))).values())  # French dialogue lines are not English prose
    print('probe sanity (tells.json): dirty_a=%d dirty_b=%d clean=%d' % (sa, sb, sc))
    assert sa > 3 and sb >= 1 and sc == 0, 'probe set is broken'

    o_blocks = set()
    for _, (_, cmds) in runs_in(orig).items():
        o_blocks.update(cmds)
    produced, wired_files = [], []
    for name, (txt, cmds) in sorted(runs_in(after).items()):
        new = [c for c in cmds if c not in o_blocks]
        new = [prune(c) for c in new]
        new = [c for c in new if c]
        if new:
            produced.extend(new)
            wired_files.append((name, txt))

    # 1 wiring
    why = []
    if not produced:
        why.append('no new run: command in .github/workflows')
    elif not any('pull_request' in t for _, t in wired_files):
        why.append('workflow with the new command does not trigger on pull_request')
    for rel, lst in facts.items():
        p = after / rel
        t = read(p) if p.exists() else ''
        for s in lst:
            if s not in t:
                why.append('%s lost %r' % (rel, s))
    crit('workflow_wired', not why, '; '.join(why) if why else 'commands=%r' % produced)

    if not produced:
        for n in ('fails_on_dirty', 'passes_on_clean', 'deterministic_explainable'):
            crit(n, False, 'nothing to run')
    else:
        ca, oa = run_variant(after, 'dirty_a.md', produced)
        cb, ob = run_variant(after, 'dirty_b.md', produced)
        cc, oc = run_variant(after, 'clean.md', produced)
        cn, on = run_variant(after, None, produced)
        crit('fails_on_dirty', ca != 0 and cb != 0, 'dirty_a exit=%d dirty_b exit=%d' % (ca, cb))
        crit('passes_on_clean', cc == 0 and cn == 0,
             'clean exit=%d no-probe exit=%d%s' % (cc, cn, '' if cc == 0 and cn == 0 else ' | ' + (oc + on)[-300:].replace('\n', ' / ')))
        ca2, oa2 = run_variant(after, 'dirty_a.md', produced)
        names_file = bool(re.search(r'probe\.md\W{0,3}\d+|probe\.md.{0,12}line\s*\d+', oa))
        crit('deterministic_explainable', oa == oa2 and ca == ca2 and names_file,
             'identical=%s names_file_and_line=%s' % (oa == oa2, names_file))

    # 5 local and offline
    net = re.compile(r'\b(curl|wget|urllib|requests\.(get|post)|openai|anthropic|gpt-?\d|claude|fetch\()|api\.openai|https?://api\.', re.I)
    bad = []
    for cmd in produced:
        if net.search(cmd):
            bad.append('command %r' % cmd[:60])
    for p in sorted(after.rglob('*')):
        if p.is_file() and '.git' not in p.parts and 'node_modules' not in p.parts and p.suffix in ('.py', '.js', '.mjs', '.sh', '.ts'):
            rel = p.relative_to(after)
            if not (orig / rel).exists() and net.search(read(p)):
                bad.append('script %s' % rel)
    ok, d = answer_ok(ans)
    crit('local_and_offline', not bad and produced != [], ('; '.join(bad)) if bad else 'no network or model use found')
    print('INFO final_answer ' + ('ok ' if ok else 'weak ') + d)
    finish()


main()
