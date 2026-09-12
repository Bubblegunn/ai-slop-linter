// The playground's behaviour. Issue #20.
//
// Rules and fixes come from the engine, which is the same module the command line imports; no
// pattern is restated here. `scripts/playground-build.mjs` copies it next to this file and fails
// the build if anything outside the engine, or any bare or `node:` specifier, gets in.
//
// Two invariants worth stating because breaking either is easy and silent:
//
// - **User text never becomes markup.** Everything reaches the DOM through `textContent` or
//   `createTextNode`. No markup-parsing property or string-evaluating function is used anywhere
//   here, and a test in test/playground.test.ts fails if one is named in this file at all.
// - **Nothing is fixed without an explicit accept.** `fixText` is never called on the user's
//   text. A preview applies one fix to a copy; the copy replaces the text only on accept.
import { applyFixes, lintText, prepare, rules } from "./engine/index.js";
import { ENGINE_FILES, VERSION } from "./engine/meta.js";
import { SAMPLES } from "./samples.js";

/**
 * Characters past which the page stops linting as you type. A product limit for responsiveness:
 * the run is synchronous on this thread, and no text this tool is aimed at is this long. It is
 * not a claim about where the rules stop working.
 */
const MAX_CHARS = 100000;
const DEBOUNCE_MS = 180;

const $ = (id) => document.getElementById(id);
const el = {
  sample: $("sample"), sampleNote: $("sample-note"), language: $("language"), kind: $("kind"),
  input: $("input"), count: $("count"), clear: $("clear"), status: $("status"),
  result: $("result"), grade: $("grade"), verdict: $("verdict"), runmeta: $("runmeta"), notrun: $("notrun"),
  findings: $("findings"), fcount: $("fcount"), nofindings: $("nofindings"), marked: $("marked"),
  detail: $("detail"), detailTitle: $("detail-title"), dWhy: $("d-why"), dSource: $("d-source"),
  dBefore: $("d-before"), dAfter: $("d-after"), dIgnore: $("d-ignore"), nofix: $("nofix"),
  preview: $("preview"), ignoreOne: $("ignore-one"), ignoreRule: $("ignore-rule"),
  fixbox: $("fixbox"), fixTitle: $("fixtitle"), fixBefore: $("fix-before"), fixAfter: $("fix-after"),
  accept: $("accept"), discard: $("discard"),
  history: $("history"), hcount: $("hcount"), undo: $("undo"), revert: $("revert"),
  copy: $("copy"), copied: $("copied"), footmeta: $("footmeta"),
};

const byId = new Map(rules.map((r) => [r.id, r]));

const state = {
  /** Text the user started this session with, so "back to what I started with" is honest. */
  original: "",
  /** Text as it stands now, after any accepted fixes. */
  text: "",
  /** One entry per accepted fix: the text as it was before that fix. */
  undo: [],
  /** Rule ids the user switched off for this run. */
  ignoredRules: new Set(),
  /** Keys of single findings the user dismissed: rule + line + column + message. */
  ignoredFindings: new Set(),
  result: null,
  /** Index into the currently displayed findings, or null. */
  selected: null,
  pending: null,
};

const keyOf = (f) => `${f.rule}:${f.line}:${f.column}:${f.message}`;

/** Replace an element's children with one text node. Never markup. */
function setText(node, text) {
  node.textContent = text === undefined || text === null ? "" : String(text);
}

// Samples, from the generated module.
for (const s of SAMPLES) {
  const opt = document.createElement("option");
  opt.value = s.id;
  setText(opt, s.label);
  el.sample.append(opt);
}

setText(el.footmeta, `Engine ${VERSION}, ${rules.length} rules, ${ENGINE_FILES.length} engine files, loaded and run in this tab.`);

// ---------------------------------------------------------------------------- linting

function optionsNow() {
  const lang = el.language.value;
  const o = { ignore: [...state.ignoredRules], language: lang === "other" ? "zz" : lang };
  // The engine's fifty-word floor exists so one finding cannot decide a letter grade on a
  // fragment. Commit messages and pull request bodies are short by nature, which is why the
  // command line drops the floor on those paths; the page keeps the same two behaviours apart
  // instead of blending them into one number.
  if (el.kind.value === "commit") o.floor = 0;
  return o;
}

function visibleFindings(result) {
  return result.findings.filter((f) => !state.ignoredFindings.has(keyOf(f)));
}

function run() {
  const text = state.text;
  if (text.length > MAX_CHARS) {
    el.result.hidden = true;
    setText(el.status, `${text.length.toLocaleString("en")} characters is over the ${MAX_CHARS.toLocaleString("en")} limit, so nothing was checked. Trim it and it will run.`);
    return;
  }
  setText(el.status, "");
  if (text.trim() === "") {
    el.result.hidden = true;
    state.result = null;
    return;
  }
  state.result = lintText("your text", text, optionsNow());
  state.selected = null;
  render();
}

// ---------------------------------------------------------------------------- rendering

function render() {
  const r = state.result;
  if (!r) return;
  el.result.hidden = false;
  const findings = visibleFindings(r);

  if (r.score === null) {
    setText(el.grade, "—");
    setText(el.verdict, `Not graded: ${r.words} words, under the fifty-word floor. Below that a single finding decides the letter, so the grade would say more about the length than the writing. The findings still stand.`);
  } else {
    setText(el.grade, r.grade);
    setText(el.verdict, `Score ${r.score}, which is weighted findings per 1,000 words. A is under 3, B under 8, C under 15, D under 30.`);
  }

  const profile = state.ignoredRules.size
    ? `${rules.length - state.ignoredRules.size} of ${rules.length} rules (off: ${[...state.ignoredRules].sort().join(", ")})`
    : `all ${rules.length} rules`;
  const langName = el.language.options[el.language.selectedIndex].text;
  setText(el.runmeta, `version ${VERSION} · ${profile} · language: ${langName} · read as: ${el.kind.value === "commit" ? "commit message or pull request body" : "document"} · ${r.words} words`);

  // A rule that stood down is said out loud. A quiet result in a language the rule set does not
  // cover is not a clean one, and showing it as a pass would be the dishonest option.
  if (r.stoodDown.length) {
    el.notrun.hidden = false;
    setText(el.notrun, `Did not run: ${r.stoodDown.slice().sort().join(", ")}. The evidence behind ${r.stoodDown.length === 1 ? "that rule is" : "those rules is"} English, and the same pattern is ordinary writing in other languages, so ${r.stoodDown.length === 1 ? "it stands" : "they stand"} down when the prose is not English. This is not a pass on ${r.stoodDown.length === 1 ? "that rule" : "those rules"}: nothing checked for ${r.stoodDown.length === 1 ? "it" : "them"}. The vocabulary rules that did run are English word lists, so they say little about text in another language either.`);
  } else {
    el.notrun.hidden = true;
  }

  renderFindings(findings);
  renderMarked(state.text, findings);
  renderDetail(findings);
  renderHistory();
}

function renderFindings(findings) {
  el.findings.replaceChildren();
  const ignoredCount = state.result.findings.length - findings.length;
  setText(el.fcount, `${findings.length}${ignoredCount ? ` (${ignoredCount} ignored)` : ""}`);
  if (findings.length === 0) {
    el.nofindings.hidden = false;
    setText(el.nofindings, "None of the listed tells are here. That is all a clean pass means.");
    return;
  }
  el.nofindings.hidden = true;
  findings.forEach((f, i) => {
    const li = document.createElement("li");
    li.className = `sev-${f.severity}`;
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-current", String(i === state.selected));
    const where = document.createElement("span");
    where.className = "fwhere";
    setText(where, `${f.line}:${f.column}`);
    const sev = document.createElement("span");
    sev.className = "fsev";
    setText(sev, ` ${f.severity} `);
    const rule = document.createElement("span");
    rule.className = "fwhere";
    setText(rule, `${f.rule}${f.fix ? " · fixable" : ""}`);
    const msg = document.createElement("span");
    msg.className = "fmsg";
    setText(msg, f.message);
    b.append(where, sev, rule, msg);
    b.addEventListener("click", () => {
      state.selected = i;
      state.pending = null;
      el.fixbox.hidden = true;
      render();
    });
    li.append(b);
    el.findings.append(li);
  });
}

/**
 * The text, line by line, with a mark at each finding. `prepare` gives the line offsets, so a
 * finding's absolute offset is its line start plus its column. A fixable finding carries a span
 * and gets marked exactly; the rest mark one character at the reported column, because the
 * engine's public finding has a position and no length.
 */
function renderMarked(text, findings) {
  const lineStarts = prepare("your text", text).lineStarts;
  const lines = text.split("\n");
  const perLine = new Map();
  findings.forEach((f, i) => {
    const start = (lineStarts[f.line - 1] ?? 0) + f.column - 1;
    const len = f.fix ? Math.max(1, f.fix.end - f.fix.start) : 1;
    const list = perLine.get(f.line) ?? [];
    list.push({ from: f.column - 1, to: f.column - 1 + len, sev: f.severity, i, start });
    perLine.set(f.line, list);
  });

  el.marked.replaceChildren();
  lines.forEach((line, idx) => {
    const n = idx + 1;
    const div = document.createElement("span");
    div.className = "line";
    const hits = (perLine.get(n) ?? []).sort((a, b) => a.from - b.from || a.to - b.to);
    if (hits.length) {
      div.classList.add("hit");
      div.dataset.n = String(n);
    }
    let cursor = 0;
    for (const h of hits) {
      if (h.from < cursor) continue; // overlapping marks: keep the earlier one
      if (h.from > cursor) div.append(document.createTextNode(line.slice(cursor, h.from)));
      const m = document.createElement("mark");
      m.className = h.sev + (h.i === state.selected ? " on" : "");
      setText(m, line.slice(h.from, Math.min(h.to, line.length)) || " ");
      div.append(m);
      cursor = Math.min(h.to, line.length);
    }
    div.append(document.createTextNode(`${line.slice(cursor)}\n`));
    el.marked.append(div);
  });
}

function renderDetail(findings) {
  const f = state.selected === null ? null : findings[state.selected];
  if (!f) {
    el.detail.hidden = true;
    return;
  }
  const rule = byId.get(f.rule);
  el.detail.hidden = false;
  setText(el.detailTitle, rule ? `${rule.id}: ${rule.title}` : f.rule);
  setText(el.dWhy, rule ? rule.why : "");
  setText(el.dSource, rule ? rule.source : "");
  setText(el.dBefore, rule ? rule.example.before.trimEnd() : "");
  setText(el.dAfter, rule ? rule.example.after.trimEnd() : "");
  setText(el.dIgnore, rule ? rule.ignoreWhen : "");
  el.preview.hidden = !f.fix;
  el.nofix.hidden = !!f.fix;
}

function renderHistory() {
  const n = state.undo.length;
  el.history.hidden = n === 0;
  setText(el.hcount, n === 0 ? "" : `${n} change${n === 1 ? "" : "s"} accepted. Your original text is still here: nothing was applied without you.`);
  el.undo.disabled = n === 0;
  el.revert.disabled = n === 0;
}

// ---------------------------------------------------------------------------- fix preview

el.preview.addEventListener("click", () => {
  const findings = visibleFindings(state.result);
  const f = state.selected === null ? null : findings[state.selected];
  if (!f || !f.fix) return;
  // One fix, applied to a copy. The user's text is untouched until accept.
  const after = applyFixes(state.text, [f]).text;
  state.pending = { finding: f, after };
  el.fixbox.hidden = false;
  setText(el.fixTitle, `Proposed change for ${f.rule} at line ${f.line}, column ${f.column}`);
  setText(el.fixBefore, contextOf(state.text, f.fix.start, f.fix.end));
  setText(el.fixAfter, contextOf(after, f.fix.start, f.fix.start + f.fix.replacement.length));
  el.fixbox.scrollIntoView({ block: "nearest" });
});

/** The line the change sits on, plus the one either side, so the change is readable in context. */
function contextOf(text, start, end) {
  const from = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEnd = text.indexOf("\n", end);
  const to = lineEnd === -1 ? text.length : lineEnd;
  return text.slice(from, to);
}

el.accept.addEventListener("click", () => {
  if (!state.pending) return;
  state.undo.push(state.text);
  state.text = state.pending.after;
  el.input.value = state.text;
  state.pending = null;
  el.fixbox.hidden = true;
  updateCount();
  run();
});

el.discard.addEventListener("click", () => {
  state.pending = null;
  el.fixbox.hidden = true;
});

el.ignoreOne.addEventListener("click", () => {
  const findings = visibleFindings(state.result);
  const f = state.selected === null ? null : findings[state.selected];
  if (!f) return;
  state.ignoredFindings.add(keyOf(f));
  state.selected = null;
  state.pending = null;
  el.fixbox.hidden = true;
  render();
});

el.ignoreRule.addEventListener("click", () => {
  const findings = visibleFindings(state.result);
  const f = state.selected === null ? null : findings[state.selected];
  if (!f) return;
  state.ignoredRules.add(f.rule);
  state.selected = null;
  state.pending = null;
  el.fixbox.hidden = true;
  run();
});

el.undo.addEventListener("click", () => {
  const prev = state.undo.pop();
  if (prev === undefined) return;
  state.text = prev;
  el.input.value = prev;
  updateCount();
  run();
});

el.revert.addEventListener("click", () => {
  state.text = state.original;
  state.undo = [];
  el.input.value = state.text;
  updateCount();
  run();
});

el.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(state.text);
    setText(el.copied, "Copied.");
  } catch {
    // Clipboard access can be refused, and there is no server to fall back to. Select it instead.
    el.input.focus();
    el.input.select();
    setText(el.copied, "The browser refused clipboard access; the text is selected, so copy it with your keyboard.");
  }
  setTimeout(() => setText(el.copied, ""), 4000);
});

// ---------------------------------------------------------------------------- input

function updateCount() {
  const n = el.input.value.length;
  setText(el.count, `${n.toLocaleString("en")} character${n === 1 ? "" : "s"}`);
}

let timer = null;
function typed() {
  state.text = el.input.value;
  // A fresh paste is a new session: the old undo stack described different text.
  if (state.undo.length === 0) state.original = state.text;
  updateCount();
  clearTimeout(timer);
  timer = setTimeout(run, DEBOUNCE_MS);
}

el.input.addEventListener("input", typed);

el.sample.addEventListener("change", () => {
  const s = SAMPLES.find((x) => x.id === el.sample.value);
  if (!s) {
    el.sampleNote.hidden = true;
    return;
  }
  el.sampleNote.hidden = false;
  setText(el.sampleNote, `${s.note} Source in the repository: ${s.source}`);
  el.input.value = s.text;
  state.original = s.text;
  state.text = s.text;
  state.undo = [];
  state.ignoredRules = new Set();
  state.ignoredFindings = new Set();
  updateCount();
  run();
});

for (const control of [el.language, el.kind]) control.addEventListener("change", run);

el.clear.addEventListener("click", () => {
  el.input.value = "";
  el.sample.value = "";
  el.sampleNote.hidden = true;
  state.original = "";
  state.text = "";
  state.undo = [];
  state.ignoredRules = new Set();
  state.ignoredFindings = new Set();
  state.result = null;
  state.selected = null;
  state.pending = null;
  el.result.hidden = true;
  el.fixbox.hidden = true;
  updateCount();
  el.input.focus();
});

updateCount();
