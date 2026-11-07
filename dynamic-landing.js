/*!
 * dynamic-landing.js — URL-driven landing page personalization layer
 * ===========================================================================
 * Zephra AI — technical evaluation
 *
 * Pipeline:
 *   URL ──▶ parseContext() ──▶ detectVariant() ──▶ VARIANTS ──▶ applyVariant() ──▶ DOM
 *                                (pure)           (config)       (only DOM writer)
 *
 * Contract
 *   1. The landing page is the source of truth. This file may change ONLY the
 *      five elements carrying a data-dl attribute (see TARGETS below).
 *   2. Fail-open: missing / unknown / invalid / hostile context ⇒ variant null
 *      ⇒ the original page renders untouched.
 *   3. URL text is NEVER rendered. Every rendered string originates from the
 *      static VARIANTS config; all writes use textContent or the hidden attr.
 *   4. Deterministic classification only — no AI, no backend, no dependencies.
 *   5. This file never mutates the URL (no history writes in production).
 *
 * Environments
 *   Browser  : runs once on load against location.search; exposes
 *              window.DynamicLanding. `?debug=true` adds logging + target
 *              outlines — it never changes which variant is selected.
 *   Node ≥18 : exports the pure core for `npm test`; the DOM stage is skipped.
 * =========================================================================== */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  /* =========================================================================
   * 1. CONFIG — the single edit surface for matching behaviour
   * ========================================================================= */
  var CONFIG = {
    // Zephra brief: support source, campaign, keyword and ad.
    trackedParams: ['source', 'campaign', 'keyword', 'ad'],

    // keyword & ad carry *intent* → phrase matching + word-level lexicon.
    // source & campaign carry *channel identity* → exact-phrase matching only.
    // Fuzzy-matching a channel name has no upside and adds mis-classification
    // risk, so channels are deliberately strict.
    lexiconParams: ['keyword', 'ad'],

    // Parameter precedence: the first parameter (in this order) whose value
    // classifies wins. keyword expresses the strongest intent, source the weakest.
    paramPrecedence: ['keyword', 'ad', 'campaign', 'source'],

    // Tier 1 — exact-phrase allow-list (values compared after normalization).
    phrases: {
      keyword: {
        'rfid-inventory-tracking': 'inventory',
        'rfid-inventory':          'inventory',
        'inventory-tracking':      'inventory',
        'warehouse-stock':         'inventory',
        'stock-tracking':          'inventory',
        'rfid-tool-tracking':      'tools',
        'tool-tracking':           'tools',
        'tool-checkout':           'tools',
        'equipment-tracking':      'tools',
        'tool-crib':               'tools',
        'rfid-reader':             'hardware',
        'rfid-readers':            'hardware',
        'rfid-hardware':           'hardware',
        'handheld-reader':         'hardware',
        'fixed-reader':            'hardware'
      },
      ad: {
        'cut-stockouts':          'inventory',
        'end-quarter-surprises':  'inventory',
        'stop-losing-tools':      'tools',
        'tool-loss-audit':        'tools',
        'reader-comparison':      'hardware',
        'hardware-buyers-guide':  'hardware'
      },
      campaign: {
        'warehouse-q1':      'inventory',
        'inventory-refresh': 'inventory',
        'toolroom-launch':   'tools',
        'reader-trade-show': 'hardware'
      },
      source: {
        'supplychain-weekly': 'inventory',
        'construction-dive':  'tools',
        'barcode-industry':   'hardware'
      }
    },

    // Tier 2 — deterministic lexicon. A value that misses the phrase list is
    // tokenized on "-" and scored against these word sets. Still allow-listed,
    // still deterministic, and the output is still just a variant key — so the
    // security property is unchanged: URL input → classification → approved
    // copy. Never URL input → page content.
    lexicon: {
      inventory: ['inventory', 'stock', 'stockout', 'restock', 'warehouse', 'sku', 'pallet'],
      tools:     ['tool', 'tools', 'equipment', 'crib'],
      hardware:  ['reader', 'readers', 'hardware', 'handheld', 'antenna', 'tag']
    },

    // Tie-break: a value scoring equally in several categories resolves to the
    // earliest category here. Deterministic; and the worst case is only that a
    // *different approved* variant renders — never unapproved content.
    categoryPrecedence: ['inventory', 'tools', 'hardware']
  };

  /* =========================================================================
   * 2. VARIANTS — the only copy this layer is allowed to render
   * ========================================================================= */
  var VARIANTS = {
    inventory: {
      headline:    'Know Every SKU, Without Counting',
      description: 'Cycle counts that run themselves. Waymark reads a full aisle in one pass and keeps your ledger current — no scanners, no clipboards, no quarter-end surprises.',
      cta:         'See Inventory OS',
      benefit:     'Continuous inventory, not quarterly guesses',
      visual:      'inventory'
    },
    tools: {
      headline:    'Track Every Tool With RFID',
      description: 'Every wrench, drill and calibrated gauge accounted for — who has it, which bench it touched, when it is back. Checkout takes a tap; audits take minutes.',
      cta:         'Track Your Tool Crib',
      benefit:     'Every tool accounted for, every shift',
      visual:      'tools'
    },
    hardware: {
      headline:    'Readers That Read First Time',
      description: 'Fixed panels and handhelds tuned for dense docks and metal-heavy floors — long-range reads, high tag throughput, and read rates your team can actually trust.',
      cta:         'Compare Readers',
      benefit:     'Engineered to read through real conditions',
      visual:      'hardware'
    }
  };

  /* =========================================================================
   * 3. PURE CORE — no DOM access anywhere below this point until section 4
   * ========================================================================= */

  // trim · lowercase · fold whitespace/underscores to hyphens · collapse runs.
  // No substring matching anywhere: equality against allow-lists only.
  function normalize(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-');
  }

  // Stage 1 — read only the four tracked params. Everything else in the query
  // is ignored. Empty values are dropped with a warning rather than matched.
  function parseContext(search) {
    var raw = {}, context = {}, warnings = [];
    var params;
    try {
      params = new URLSearchParams(search || '');
    } catch {
      return { raw: raw, context: context, warnings: ['query unparseable — fail open'] };
    }
    CONFIG.trackedParams.forEach(function (p) {
      var v = params.get(p);
      if (v === null) return;
      if (v.trim() === '') { warnings.push('"' + p + '" present but empty — ignored'); return; }
      raw[p] = v;
      context[p] = normalize(v);
    });
    return { raw: raw, context: context, warnings: warnings };
  }

  // Classify ONE normalized value for ONE parameter. Two tiers:
  //   1. exact phrase allow-list  (highest confidence)
  //   2. lexicon word scoring     (keyword/ad only; ties → categoryPrecedence)
  function classifyValue(value, param) {
    if (!value) return { variant: null, how: 'empty', matched: null, score: 0 };

    var phrases = CONFIG.phrases[param];
    if (phrases && Object.prototype.hasOwnProperty.call(phrases, value)) {
      return { variant: phrases[value], how: 'phrase', matched: value, score: 1 };
    }

    if (CONFIG.lexiconParams.indexOf(param) !== -1) {
      var tokens = value.split('-').filter(Boolean);
      var best = null, bestScore = 0;
      CONFIG.categoryPrecedence.forEach(function (cat) {
        var lex = CONFIG.lexicon[cat];
        var score = 0;
        tokens.forEach(function (t) { if (lex.indexOf(t) !== -1) score += 1; });
        if (score > bestScore) { best = cat; bestScore = score; } // strict > ⇒ ties keep earlier category
      });
      if (best) {
        var hits = tokens.filter(function (t) { return CONFIG.lexicon[best].indexOf(t) !== -1; });
        return { variant: best, how: 'lexicon', matched: hits.join('+'), score: bestScore };
      }
    }
    return { variant: null, how: 'no-match', matched: null, score: 0 };
  }

  // Stage 2 — evaluate parameters in declared precedence order. A recognized
  // value in ANY tracked parameter personalizes; unrecognized higher-precedence
  // params do not veto recognized lower-precedence ones.
  function detectVariant(context) {
    for (var i = 0; i < CONFIG.paramPrecedence.length; i++) {
      var param = CONFIG.paramPrecedence[i];
      if (context[param] === undefined) continue;
      var r = classifyValue(context[param], param);
      if (r.variant) {
        return { variant: r.variant, param: param, how: r.how, matched: context[param], score: r.score };
      }
    }
    return { variant: null, param: null, how: 'none', matched: null, score: 0 };
  }

  /* =========================================================================
   * 4. DOM LAYER — the only code that touches the page
   * ========================================================================= */
  var targets = [], pristine = [], pristineMap = {};

  if (typeof document !== 'undefined') {

    // Stable data-dl selectors — no nth-child brittleness. Each target knows
    // how to read (for snapshot/tests), restore, and apply itself.
    function setVisual(container, key) {
      var figs = container.querySelectorAll('[data-visual]');
      for (var i = 0; i < figs.length; i++) figs[i].hidden = figs[i].getAttribute('data-visual') !== key;
    }

    var TARGETS = [
      { key: 'headline', selector: '[data-dl="headline"]',
        read:    function (el) { return el.textContent; },
        restore: function (el, v) { el.textContent = v; },
        apply:   function (el, v) { el.textContent = v.headline; } },
      { key: 'description', selector: '[data-dl="description"]',
        read:    function (el) { return el.textContent; },
        restore: function (el, v) { el.textContent = v; },
        apply:   function (el, v) { el.textContent = v.description; } },
      { key: 'cta-primary', selector: '[data-dl="cta-primary"]',
        read:    function (el) { return el.querySelector('.btn-label').textContent; },
        restore: function (el, v) { el.querySelector('.btn-label').textContent = v; },
        apply:   function (el, v) { el.querySelector('.btn-label').textContent = v.cta; } },
      { key: 'benefit-heading', selector: '[data-dl="benefit-heading"]',
        read:    function (el) { return el.textContent; },
        restore: function (el, v) { el.textContent = v; },
        apply:   function (el, v) { el.textContent = v.benefit; } },
      { key: 'hero-visual', selector: '[data-dl="hero-visual"]',
        read:    function (el) { var f = el.querySelector('[data-visual]:not([hidden])'); return f ? f.getAttribute('data-visual') : '?'; },
        restore: function (el) { setVisual(el, 'default'); },
        apply:   function (el, v) { setVisual(el, v.visual); } }
    ];

    // Pristine snapshot captured ONCE, before any personalization runs.
    targets = TARGETS.map(function (t) {
      return Object.assign({}, t, { el: document.querySelector(t.selector) });
    });
    pristine = targets.filter(function (t) { return t.el; })
                      .map(function (t) { return { t: t, value: t.read(t.el) }; });
    pristine.forEach(function (p) { pristineMap[p.t.key] = p.value; });

  }

  // The three DOM helpers below are deliberately declared at IIFE scope, NOT
  // inside the guard block above: in strict mode, function declarations in a
  // block are block-scoped, and runPipeline (section 5) must be able to call
  // them. They only ever execute when targets exist (hasDom).
  function restoreOriginal() {
    pristine.forEach(function (p) { p.t.restore(p.t.el, p.value); });
  }

  function applyVariant(name, log) {
    var v = VARIANTS[name];
    var changed = [];
    targets.forEach(function (t) {
      // A target captured at load but since removed from the DOM (detached
      // nodes are still truthy) counts as missing — skip it, never crash.
      if (!t.el || !t.el.isConnected) { log('apply', 'target "' + t.key + '" missing — skipped (fail-open)'); return; }
      try { t.apply(t.el, v); changed.push(t.key); }
      catch (e) { log('apply', 'target "' + t.key + '" failed (' + e.message + ') — skipped'); }
    });
    return changed;
  }

  function setDebugHighlight(debug, changed) {
    document.body.classList.toggle('debug-mode', !!debug);
    targets.forEach(function (t) {
      if (!t.el) return;
      t.el.classList.toggle('dl-changed', !!debug && changed.indexOf(t.key) !== -1);
    });
  }

  /* =========================================================================
   * 5. PIPELINE — one orchestrated run; restore-first guarantees idempotency
   * ========================================================================= */
  function runPipeline(search, opts) {
    var debug = !!(opts && opts.debug);
    var hasDom = typeof document !== 'undefined' && targets.length > 0;
    var t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    var entries = [];
    function log(stage, msg, detail) {
      var now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      entries.push({ dt: Math.max(0, Math.round(now - t0)), stage: stage, msg: msg, detail: detail });
    }

    // Restore FIRST: re-running never leaves residue, and a failed apply can
    // never leave a half-personalized page.
    if (hasDom) { restoreOriginal(); log('reset', 'all approved targets restored to pristine content'); }

    var parsed = parseContext(search);
    log('parse', 'raw params', parsed.raw);
    log('parse', 'normalized context (trim · lowercase · fold [ _]→-)', parsed.context);
    parsed.warnings.forEach(function (w) { log('parse', 'warning: ' + w); });

    var result = detectVariant(parsed.context);
    log('match', result.variant
      ? 'matched ' + result.param + '="' + result.matched + '" via ' + result.how + ' → variant "' + result.variant + '"'
      : '0 matches → variant null (fail-open)');

    var changed = [];
    if (hasDom && result.variant && VARIANTS[result.variant]) {
      changed = applyVariant(result.variant, log);
    } else if (result.variant && !VARIANTS[result.variant]) {
      log('match', 'variant "' + result.variant + '" missing from VARIANTS — fail open'); // defense in depth
      result = { variant: null, param: result.param, how: 'config-drift', matched: result.matched, score: 0 };
    }
    log('apply', 'changed targets: ' + (changed.length ? changed.join(', ') : 'none'));
    log('done', result.variant ? 'personalized as "' + result.variant + '"' : 'original page preserved');

    if (hasDom) setDebugHighlight(debug, changed);

    var out = {
      raw: parsed.raw, context: parsed.context, warnings: parsed.warnings,
      variant: result.variant, param: result.param, how: result.how,
      matched: result.matched, changed: changed, entries: entries
    };
    if (debug) emitDebug(out);
    return out;
  }

  /* =========================================================================
   * 6. DEBUG (?debug=true) — observability only; never affects selection
   * ========================================================================= */
  function emitDebug(result) {
    if (typeof console !== 'undefined' && console.info) {
      result.entries.forEach(function (e) {
        console.info('[dl +' + e.dt + 'ms] ' + e.stage + ' — ' + e.msg,
                     e.detail !== undefined ? e.detail : '');
      });
    }
    // Harnesses (demo-console.js) subscribe to this event; production code
    // knows nothing about the harness.
    try {
      if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('dl:debug', { detail: result }));
      }
    } catch { /* non-fatal */ }
  }

  function isDebugEnabled(search) {
    try { return new URLSearchParams(search || '').get('debug') === 'true'; }
    catch { return false; }
  }

  /* =========================================================================
   * 7. INIT + EXPORTS
   * ========================================================================= */
  var API = { VERSION: VERSION, CONFIG: CONFIG, VARIANTS: VARIANTS,
              normalize: normalize, parseContext: parseContext,
              classifyValue: classifyValue, detectVariant: detectVariant };

  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    API.personalize = runPipeline;
    API.original = Object.freeze(pristineMap); // pristine copy for harnesses/tests
    window.DynamicLanding = API;

    // Run once on load, against the real URL. JS disabled ⇒ this never runs
    // ⇒ the original page renders untouched (the brief's success criterion).
    var initialSearch = (typeof location !== 'undefined') ? location.search : '';
    runPipeline(initialSearch, { debug: isDebugEnabled(initialSearch) });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API; // pure core for `npm test` (Node ≥18)
  }
})();
