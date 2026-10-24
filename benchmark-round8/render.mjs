#!/usr/bin/env node
// Renders the two round 8 benchmark figures for the launch post:
//   cover.png  - 1000x420 CSS px at device scale 2 (2000x840 px)
//   figure.png - 700 CSS px wide at device scale 2 (1400 px wide)
//
// No number is typed into this file. Every total and interval is parsed from
// bench/head-to-head/results/round8-final-2026-10-23/SUMMARY.md, and the
// script exits non-zero if a table is missing, has the wrong row count, or an
// arm is unknown. The --compare panel shows captured output (see COMPARE).
//
// Usage: node render.mjs [outDir]
//   SUMMARY=<path>   override the results file
//   FONT_DIR=<dir>   folder holding the three Fontsource variable woff2 files
//   CHROME=<path>    Chrome binary (headless screenshot, no npm dependency)
// Deterministic for a given Chrome build: fonts are embedded as data URIs and
// the layout is fixed-size; nothing reads the clock or the network.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? here);
mkdirSync(outDir, { recursive: true });

const REL_SUMMARY = 'bench/head-to-head/results/round8-final-2026-10-23/SUMMARY.md';
const summaryCandidates = [
  process.env.SUMMARY,
  join(here, '../../..', REL_SUMMARY),
  join('/Users/efe/Desktop/Open-Source/projelerim/ai-slop-linter', REL_SUMMARY),
].filter(Boolean);
const summaryPath = summaryCandidates.find((p) => existsSync(p));
if (!summaryPath) throw new Error(`SUMMARY.md not found; tried ${summaryCandidates.join(', ')}`);
const md = readFileSync(summaryPath, 'utf8');

const fontCandidates = [
  process.env.FONT_DIR,
  join(here, 'fonts'),
  '/Users/efe/Desktop/portfolio/node_modules/@fontsource-variable',
].filter(Boolean);
const FONT_FILES = {
  display: ['bricolage-grotesque', 'bricolage-grotesque-latin-wght-normal.woff2'],
  body: ['newsreader', 'newsreader-latin-wght-normal.woff2'],
  mono: ['jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2'],
};
function fontData([pkg, file]) {
  for (const dir of fontCandidates) {
    for (const p of [join(dir, pkg, 'files', file), join(dir, file)]) {
      if (existsSync(p)) return `data:font/woff2;base64,${readFileSync(p).toString('base64')}`;
    }
  }
  throw new Error(`font ${file} not found; set FONT_DIR`);
}

// ---------- data from SUMMARY.md ----------
const NAMES = {
  ours: 'ai-slop-linter',
  'blader-inv': 'Humanizer, called by name',
  blader: 'Humanizer',
  'everwrite-inv': 'everwrite, called by name',
  everwrite: 'everwrite',
  'unslop-inv': 'unslop, called by name',
  unslop: 'unslop',
  slopless: 'slopless',
  'avoid-ai-writing': 'avoid-ai-writing',
  'slop-cop': 'slop-cop',
  base: 'Claude, no plugin',
};

function section(heading) {
  const start = md.indexOf(heading);
  if (start < 0) throw new Error(`heading not found: ${heading}`);
  const next = md.indexOf('\n### ', start + heading.length);
  return md.slice(start, next < 0 ? undefined : next);
}
function parseSet(heading, max) {
  const text = section(heading);
  if (!text.includes(`Total of ${max.toFixed(2)} per arm`)) throw new Error(`${heading}: maximum ${max} not stated`);
  const rows = [];
  const re = /^\| ([a-z-]+) \| (\d+\.\d\d) \| \[(\d+\.\d\d), (\d+\.\d\d)\] \|$/gm;
  for (const m of text.matchAll(re)) {
    if (!(m[1] in NAMES)) throw new Error(`unknown arm ${m[1]}`);
    rows.push({ arm: m[1], name: NAMES[m[1]], total: +m[2], lo: +m[3], hi: +m[4], totalText: m[2] });
  }
  if (rows.length !== 11) throw new Error(`${heading}: expected 11 arms, parsed ${rows.length}`);
  const d = text.match(/ours minus ([a-z-]+): (-?\d+\.\d\d), 95% interval \[(-?\d+\.\d\d), (-?\d+\.\d\d)\]/);
  if (!d) throw new Error(`${heading}: difference line not found`);
  return { rows, max, diff: { vs: d[1], value: d[2], lo: d[3], hi: d[4] } };
}
const pub = parseSet('### Public set (12 tasks, Sonnet)', 60);
const held = parseSet('### Held-out g (6 tasks, Sonnet)', 30);
const scope = md.match(/# Round 8 final measurement \((\d{4}-\d\d-\d\d)\)/)?.[1];
if (!scope) throw new Error('measurement date not found');
const atOrAbove = held.rows.filter((r) => r.total >= 29.67).length;
const baseHeld = held.rows.find((r) => r.arm === 'base').totalText;

// ---------- the --compare panel ----------
// Captured 2026-10-24 from ai-slop-linter 0.2.0 (`--compare before.md after.md`,
// exit status 1). The two inputs are the post's own example, reproduced here
// verbatim; LOST lists the spans of BEFORE that the output reports as lost.
const COMPARE = {
  before: 'We shipped version 2.4 on 3 March 2026. The change cuts cold start by up to 40 percent for 1,200 customers.',
  after: 'We shipped the new version in March. The change cuts cold start by 40 percent for many customers.',
  lost: ['2.4', '3 March 2026', 'up to', '1,200'],
  output: [
    'facts: 1 kept, 4 lost, 0 added',
    'lost   date     3 March 2026',
    'lost   number   1200',
    'lost   qualifier up to 40',
    'lost   version  2.4',
  ],
};

// ---------- drawing ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f2 = (n) => n.toFixed(2);

const CSS = `
@font-face{font-family:"Bricolage";src:url(${fontData(FONT_FILES.display)}) format("woff2");font-weight:200 800}
@font-face{font-family:"Newsreader";src:url(${fontData(FONT_FILES.body)}) format("woff2");font-weight:200 800}
@font-face{font-family:"JBMono";src:url(${fontData(FONT_FILES.mono)}) format("woff2");font-weight:100 800}
:root{
  --paper:#fcfbf9; --ink:#0e1116; --fg:#23272e; --fg-light:#545a63;
  --mark:#7d828a; --rule:rgba(35,39,46,.14); --rule-soft:rgba(35,39,46,.08);
  --accent:#1b2fbf; --accent-soft:rgba(27,47,191,.10); --lost:#a3261a;
  --font-display:"Bricolage",sans-serif; --font-body:"Newsreader",serif; --font-mono:"JBMono",monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--paper);color:var(--fg);overflow:hidden}
body{position:relative;font-family:var(--font-body);-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.h{font-family:var(--font-display);font-weight:600;color:var(--ink);letter-spacing:-0.01em}
.p{font-family:var(--font-body);color:var(--fg-light)}
.m{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
svg text{font-kerning:normal}
.lost{color:var(--lost);text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}
`;

/**
 * One ranked dot-and-interval chart as an SVG fragment.
 * rows are drawn in the order given (SUMMARY order: by total, ties as listed).
 */
function chart({ set, x0, y0, labelRight, plotLeft, plotRight, valueRight, rowH, axisFrom, tickStep, labelSize, note }) {
  const ppt = (plotRight - plotLeft) / (set.max - axisFrom);
  const X = (v) => plotLeft + (v - axisFrom) * ppt;
  const n = set.rows.length;
  const top = y0;
  const bottom = y0 + n * rowH;
  const parts = [];
  // grid
  for (let v = axisFrom; v <= set.max + 1e-9; v += tickStep) {
    const x = X(v).toFixed(1);
    const isMax = Math.abs(v - set.max) < 1e-9;
    parts.push(`<line x1="${x}" x2="${x}" y1="${top - 4}" y2="${bottom + 2}" stroke="${isMax ? 'var(--fg-light)' : 'var(--rule)'}" stroke-width="${isMax ? 1 : 1}" ${isMax ? 'stroke-dasharray="2 3"' : ''}/>`);
    parts.push(`<text x="${x}" y="${bottom + 17}" text-anchor="middle" class="m" font-size="11" fill="var(--fg-light)">${v}</text>`);
  }
  // baseline of the axis
  parts.push(`<line x1="${plotLeft}" x2="${plotRight}" y1="${bottom + 2}" y2="${bottom + 2}" stroke="var(--fg-light)" stroke-width="1"/>`);
  // note under the axis (range honesty)
  if (note) parts.push(`<text x="${plotRight}" y="${bottom + 34}" text-anchor="end" class="p" font-family="var(--font-body)" font-size="12.5" fill="var(--fg-light)">${esc(note)}</text>`);
  set.rows.forEach((r, i) => {
    const cy = top + i * rowH + rowH / 2;
    const ours = r.arm === 'ours';
    const col = ours ? 'var(--accent)' : 'var(--mark)';
    if (ours) parts.push(`<rect x="${x0}" y="${(cy - rowH / 2 + 1).toFixed(1)}" width="${valueRight - x0 + 6}" height="${rowH - 2}" rx="3" fill="var(--accent-soft)"/>`);
    parts.push(`<text x="${labelRight}" y="${cy + labelSize * 0.35}" text-anchor="end" font-family="var(--font-display)" font-size="${labelSize}" font-weight="${ours ? 650 : 420}" fill="${ours ? 'var(--accent)' : 'var(--fg)'}">${esc(r.name)}</text>`);
    const capH = ours ? 8 : 6;
    parts.push(`<line x1="${X(r.lo).toFixed(1)}" x2="${X(r.hi).toFixed(1)}" y1="${cy}" y2="${cy}" stroke="${col}" stroke-width="${ours ? 2 : 1.5}"/>`);
    for (const v of [r.lo, r.hi]) parts.push(`<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${cy - capH / 2}" y2="${cy + capH / 2}" stroke="${col}" stroke-width="${ours ? 2 : 1.5}"/>`);
    parts.push(`<circle cx="${X(r.total).toFixed(1)}" cy="${cy}" r="${ours ? 5.5 : 4.5}" fill="${col}" stroke="var(--paper)" stroke-width="1.5"/>`);
    parts.push(`<text x="${valueRight}" y="${cy + 4}" text-anchor="end" class="m" font-size="${labelSize - 1}" font-weight="${ours ? 700 : 400}" fill="${ours ? 'var(--accent)' : 'var(--fg-light)'}">${r.totalText}</text>`);
  });
  return { svg: parts.join('\n'), X, bottom };
}

// SVG presentation attributes do not take var(); resolve the tokens declared in CSS above.
const TOKENS = Object.fromEntries([...CSS.matchAll(/--([a-z-]+):([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const resolveVars = (s) => s.replace(/="var\(--([a-z-]+)\)"/g, (_, k) => {
  if (!(k in TOKENS)) throw new Error(`unknown token ${k}`);
  return `="${TOKENS[k].replace(/"/g, "'")}"`;
});

function page(w, h, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}
html,body{width:${w}px;height:${h}px}</style></head><body>${resolveVars(body)}</body></html>`;
}

// ---------- cover (1000 x 420) ----------
function cover() {
  const W = 1000;
  const H = 420;
  const c = chart({
    set: pub, x0: 28, y0: 92, labelRight: 214, plotLeft: 226, plotRight: 548, valueRight: 600,
    rowH: 22, axisFrom: 46, tickStep: 2, labelSize: 13.5,
    note: null,
  });
  const beforeHtml = COMPARE.lost.reduce((s, span) => s.replace(span, `<span class="lost">${span}</span>`), esc(COMPARE.before));
  const out = COMPARE.output
    .map((l) => (l.startsWith('lost') ? `<span style="color:var(--lost)">lost</span>${esc(l.slice(4))}` : esc(l)))
    .join('\n');
  const body = `
<div class="h" style="position:absolute;left:28px;top:26px;font-size:17px">Score on 12 public tasks, of 60</div>
<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">
${c.svg}
</svg>
<div class="p" style="position:absolute;left:28px;top:52px;font-size:14px;color:var(--fg)">First by ${pub.diff.value} points over ${esc(NAMES[pub.diff.vs])}; 95% interval of the difference [${pub.diff.lo}, ${pub.diff.hi}].</div>
<div class="p" style="position:absolute;left:226px;top:${c.bottom + 22}px;width:374px;font-size:12px;text-align:left">Axis from 46 to the maximum of 60. Lines: 95% intervals.</div>
<div style="position:absolute;left:640px;top:24px;width:1px;height:340px;background:var(--rule)"></div>
<div style="position:absolute;left:666px;top:26px;width:308px">
  <div class="h" style="font-size:17px">It also checks a rewrite kept the facts</div>
  <div class="m" style="margin-top:14px;font-size:11px;color:var(--fg-light)">before.md</div>
  <div style="margin-top:3px;font-size:14px;line-height:1.38;color:var(--fg)">${beforeHtml}</div>
  <div class="m" style="margin-top:10px;font-size:11px;color:var(--fg-light)">after.md</div>
  <div style="margin-top:3px;font-size:14px;line-height:1.38;color:var(--fg)">${esc(COMPARE.after)}</div>
  <div class="m" style="margin-top:14px;font-size:11px;color:var(--fg-light)">ai-slop-linter --compare before.md after.md</div>
  <pre class="m" style="margin-top:5px;font-size:11.5px;line-height:1.5;color:var(--ink)">${out}</pre>
</div>
<div style="position:absolute;left:28px;right:28px;top:${H - 34}px;height:1px;background:var(--rule)"></div>
<div class="p" style="position:absolute;left:28px;top:${H - 25}px;font-size:12.5px;white-space:nowrap">ai-slop-linter head-to-head, round 8: 12 public tasks, Sonnet 5.5, 3 runs per arm, ${scope}. Totals are sums of per-task means.</div>
`;
  return { html: page(W, H, body), W, H };
}

// ---------- in-article figure (700 CSS px wide, rendered at 2x) ----------
function figure() {
  const W = 700;
  const rowH = 23;
  const geo = { x0: 20, labelRight: 196, plotLeft: 208, plotRight: 612, valueRight: 676, rowH, tickStep: 2, labelSize: 13 };
  const span = 14; // both axes span 14 points and end at their maximum, so a point is the same width in both panels
  let y = 24;
  const blocks = [];
  const svgs = [];
  // panel A
  blocks.push(`<div class="h" style="position:absolute;left:20px;top:${y}px;font-size:18px">Public set: 12 tasks, total of 60</div>`);
  y += 28;
  blocks.push(`<div class="p" style="position:absolute;left:20px;top:${y}px;width:640px;font-size:14px;line-height:1.4;color:var(--fg)">ai-slop-linter is first, ${pub.diff.value} points ahead of ${esc(NAMES[pub.diff.vs])}. The 95% interval of that difference is [${pub.diff.lo}, ${pub.diff.hi}], so it stays above zero.</div>`);
  y += 56;
  const a = chart({ set: pub, y0: y, axisFrom: pub.max - span, ...geo, note: `Axis from ${pub.max - span} to the maximum of ${pub.max}` });
  svgs.push(a.svg);
  y = a.bottom + 64;
  // panel B
  blocks.push(`<div style="position:absolute;left:20px;right:20px;top:${y - 22}px;height:1px;background:var(--rule)"></div>`);
  blocks.push(`<div class="h" style="position:absolute;left:20px;top:${y}px;font-size:18px">Held-out set: 6 tasks, total of 30</div>`);
  y += 28;
  blocks.push(`<div class="p" style="position:absolute;left:20px;top:${y}px;width:640px;font-size:14px;line-height:1.4;color:var(--fg)">A near-tie at the ceiling. ${['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven'][atOrAbove]} arms score ${f2(29.67)} or more and Claude with no plugin reaches ${baseHeld}, so these tasks cannot separate the top arms. ai-slop-linter is ${f2(Math.abs(+held.diff.value))} behind ${esc(NAMES[held.diff.vs])}, interval [${held.diff.lo}, ${held.diff.hi}].</div>`);
  y += 56;
  const b = chart({ set: held, y0: y, axisFrom: held.max - span, ...geo, note: `Axis from ${held.max - span} to the maximum of ${held.max}, the same 14-point span as above` });
  svgs.push(b.svg);
  y = b.bottom + 52;
  blocks.push(`<div style="position:absolute;left:20px;right:20px;top:${y}px;height:1px;background:var(--rule)"></div>`);
  blocks.push(`<div class="p" style="position:absolute;left:20px;top:${y + 10}px;width:660px;font-size:12.5px;line-height:1.45">Round 8, ${scope}. Sonnet 5.5, 11 arms, 3 runs per arm and task. A total is the sum over tasks of the mean over runs, 5 points per task. Dots are totals; lines are 95% bootstrap intervals.</div>`);
  blocks.push(`<div class="m" style="position:absolute;left:20px;top:${y + 48}px;font-size:11px;color:var(--fg-light)">Data: ${REL_SUMMARY}</div>`);
  const H = y + 76;
  const body = `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">${svgs.join('\n')}</svg>${blocks.join('\n')}`;
  return { html: page(W, H, body), W, H };
}

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
function shoot(name, { html, W, H }) {
  const tmp = mkdtempSync(join(tmpdir(), 'asl-fig-'));
  const htmlPath = join(tmp, `${name}.html`);
  const pngPath = join(outDir, `${name}.png`);
  writeFileSync(htmlPath, html);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--force-device-scale-factor=2', `--window-size=${W},${H}`, '--virtual-time-budget=3000',
    '--force-color-profile=srgb', `--screenshot=${pngPath}`, pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore' });
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${pngPath}  ${W * 2}x${H * 2}`);
}

console.log(`data: ${summaryPath}`);
for (const [label, s] of [['public', pub], ['held-out', held]]) {
  console.log(`${label} (of ${s.max}): ${s.rows.map((r) => `${r.arm} ${r.totalText} [${f2(r.lo)}, ${f2(r.hi)}]`).join('; ')}`);
  console.log(`  ours minus ${s.diff.vs}: ${s.diff.value} [${s.diff.lo}, ${s.diff.hi}]`);
}
shoot('cover', cover());
shoot('figure', figure());
