/*!
 * tests/dynamic-landing.test.js — zero-dependency suite on Node's built-in
 * runner (Node ≥18). Covers the pure core (classification, normalization,
 * config integrity). DOM-level behaviour is covered by the in-browser suite
 * in demo-console.js (jsdom port listed under "Future improvements").
 *
 *   npm test
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const dl = require('../dynamic-landing.js');

const classify = (q) => dl.detectVariant(dl.parseContext(q).context).variant;

/* ---- the four required behaviours (brief, verbatim) --------------------- */
test('required: keyword=rfid-inventory-tracking → inventory', () => {
  assert.equal(classify('?keyword=rfid-inventory-tracking'), 'inventory');
});
test('required: keyword=rfid-tool-tracking → tools', () => {
  assert.equal(classify('?keyword=rfid-tool-tracking'), 'tools');
});
test('required: keyword=rfid-reader → hardware', () => {
  assert.equal(classify('?keyword=rfid-reader'), 'hardware');
});
test('required: no context → null (original page)', () => {
  assert.equal(classify(''), null);
  assert.equal(classify('?'), null);
  assert.equal(classify('?debug=true'), null); // debug never personalizes
});

/* ---- case-insensitivity & normalization --------------------------------- */
test('case-insensitive: RFID-INVENTORY-TRACKING → inventory', () => {
  assert.equal(classify('?keyword=RFID-INVENTORY-TRACKING'), 'inventory');
});
test('case-insensitive: ad=Stop-Losing-Tools → tools', () => {
  assert.equal(classify('?ad=Stop-Losing-Tools'), 'tools');
});
test('normalization folds spaces and underscores to hyphens', () => {
  assert.equal(dl.normalize('  RFID_Tool  Tracking '), 'rfid-tool-tracking');
  assert.equal(dl.normalize('warehouse--stock'), 'warehouse-stock');
});
test('keyword="rfid tool tracking" (URL-encoded space) → tools', () => {
  assert.equal(classify('?keyword=rfid%20tool%20tracking'), 'tools');
});
test('keyword=warehouse_stock → inventory', () => {
  assert.equal(classify('?keyword=warehouse_stock'), 'inventory');
});

/* ---- all four params + convergence -------------------------------------- */
test('ad=stop-losing-tools → tools (source convergence on one category)', () => {
  assert.equal(classify('?ad=stop-losing-tools'), 'tools');
});
test('campaign=warehouse-q1 → inventory', () => {
  assert.equal(classify('?campaign=warehouse-q1'), 'inventory');
});
test('source=construction-dive → tools', () => {
  assert.equal(classify('?source=construction-dive'), 'tools');
});
test('brief example: source=google&keyword=rfid-tool-tracking → tools', () => {
  assert.equal(classify('?source=google&keyword=rfid-tool-tracking'), 'tools');
});

/* ---- two-tier matching (phrase → lexicon) -------------------------------- */
test('phrase tier reported for exact allow-listed phrases', () => {
  assert.equal(dl.detectVariant(dl.parseContext('?keyword=rfid-tool-tracking').context).how, 'phrase');
});
test('lexicon: "tracking-industrial-tools" → tools', () => {
  assert.equal(classify('?keyword=tracking-industrial-tools'), 'tools');
});
test('lexicon: "tool-tracker" → tools', () => {
  assert.equal(classify('?keyword=tool-tracker'), 'tools');
});
test('lexicon: "stockout-recovery" → inventory', () => {
  assert.equal(classify('?keyword=stockout-recovery'), 'inventory');
});
test('lexicon only applies to intent params, not channel params', () => {
  // "reader" is in the hardware lexicon, but source is phrase-only
  assert.equal(classify('?source=reader-gazette'), null);
});

/* ---- precedence & fall-through ------------------------------------------- */
test('precedence: keyword beats ad', () => {
  assert.equal(classify('?keyword=rfid-tool-tracking&ad=cut-stockouts'), 'tools');
});
test('fall-through: unrecognized keyword, recognized ad → tools', () => {
  assert.equal(classify('?keyword=something-random&ad=stop-losing-tools'), 'tools');
});

/* ---- failure / hostile / edge cases -------------------------------------- */
test('unknown value → null', () => {
  assert.equal(classify('?keyword=something-random'), null);
});
test('hostile value is classified null', () => {
  assert.equal(classify('?keyword=' + encodeURIComponent('<script>alert(1)</script>')), null);
});
test('blank value → null (with warning)', () => {
  const r = dl.parseContext('?keyword=');
  assert.equal(dl.detectVariant(r.context).variant, null);
  assert.ok(r.warnings.length > 0);
});
test('untracked parameter is ignored entirely', () => {
  assert.equal(classify('?utm_source=newsletter&foo=bar'), null);
});

/* ---- config integrity (guards manual edits) ------------------------------ */
test('every variant defines all copy fields + a visual key', () => {
  for (const [name, v] of Object.entries(dl.VARIANTS)) {
    for (const field of ['headline', 'description', 'cta', 'benefit', 'visual']) {
      assert.ok(v[field], `VARIANTS.${name}.${field} missing`);
    }
  }
});
test('every phrase maps to a declared variant', () => {
  for (const [param, phrases] of Object.entries(dl.CONFIG.phrases)) {
    for (const [value, variant] of Object.entries(phrases)) {
      assert.ok(dl.VARIANTS[variant], `${param}:${value} → unknown variant "${variant}"`);
      assert.ok(dl.CONFIG.trackedParams.includes(param), `phrase declared for untracked param "${param}"`);
    }
  }
});
test('lexicon entries are single words (values are tokenized on "-")', () => {
  for (const words of Object.values(dl.CONFIG.lexicon)) {
    for (const w of words) assert.ok(!w.includes('-') && w.length > 0);
  }
});
test('exactly the four brief params are tracked; debug is not one of them', () => {
  assert.deepEqual([...dl.CONFIG.trackedParams].sort(), ['ad', 'campaign', 'keyword', 'source']);
  assert.ok(!dl.CONFIG.trackedParams.includes('debug'));
});
