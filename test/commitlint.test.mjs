import { test } from "node:test";
import assert from "node:assert/strict";
import plugin, { tells } from "../integrations/commitlint/index.mjs";
import config from "../integrations/commitlint/config.mjs";

test("the commitlint rule fails a message with a tell and names it with line and column", () => {
  const [valid, message] = tells({ raw: "feat: thing — with a dash\n\nI hope this helps!" }, "always", {});
  assert.equal(valid, false);
  assert.match(message, /AI-writing tells \(score \d+(\.\d+)?, max 10\)/);
  assert.match(message, /1:\d+ error dash: em dash/);
  assert.match(message, /3:1 error chatbot:/);
});

test("a plain message passes; ignore and maxScore are honoured; never inverts", () => {
  assert.deepEqual(tells({ raw: "fix: plain message\n\nOne sentence of why." }), [true, ""]);
  const [ignored] = tells({ raw: "feat: thing\n\nI hope this helps!" }, "always", { ignore: ["chatbot"] });
  assert.equal(ignored, true);
  const [strict] = tells({ raw: "feat: thing\n\nLet's dive in." }, "always", { maxScore: 1 });
  assert.equal(strict, false);
  const [inverted] = tells({ raw: "feat: thing — dash" }, "never");
  assert.equal(inverted, true);
  // Without `raw`, the parts are joined the way commitlint splits them.
  const [fromParts] = tells({ header: "feat: thing", body: "I hope this helps!", footer: null });
  assert.equal(fromParts, false);
});

test("the plugin and the shareable config have the shapes commitlint loads", () => {
  assert.equal(typeof plugin.rules["ai-slop-linter/tells"], "function");
  assert.deepEqual(config.plugins, [plugin]);
  assert.deepEqual(config.rules["ai-slop-linter/tells"], [2, "always", { maxScore: 10 }]);
});
