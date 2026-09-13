/*!
 * demo-console.js — evaluator harness. LOADED ONLY BY demo.html.
 * Injects its own UI + styles at runtime; index.html never sees this file.
 * Drives the page exclusively through the public window.DynamicLanding API.
 * =========================================================================== */
(function () {
  'use strict';
  var DL = window.DynamicLanding;
  if (!DL) { console.error('[demo-console] dynamic-landing.js must load first'); return; }

  /* ---------- 1. inject harness styles ---------- */
  var style = document.createElement('style');
  style.textContent = [
    '.dl-console{position:fixed;left:16px;bottom:16px;z-index:100;width:354px;max-width:calc(100vw - 32px);',
    'background:#14120D;border:1px solid #3B362A;border-radius:10px;color:#D9D2BF;font-family:var(--mono,monospace);',
    'box-shadow:0 18px 50px rgba(20,15,5,.4)}',
    '.dl-c-head{display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;color:#E9E3D3;',
    'font-family:var(--mono,monospace);font-size:11px;letter-spacing:.14em;padding:12px 14px;cursor:pointer;text-align:left}',
    '.dl-c-head .tag-h{color:#F0602A}.dl-c-hint{margin-left:auto;color:#6E6858;font-size:9.5px}',
    '.dl-caret{transition:transform .2s;color:#6E6858}.dl-console.collapsed .dl-caret{transform:rotate(180deg)}',
    '.dl-c-body{padding:0 14px 14px;max-height:min(72vh,560px);overflow:auto;border-top:1px solid #2C2920}',
    '.dl-console.collapsed .dl-c-body{display:none}',
    '.dl-c-note{font-size:10px;line-height:1.55;color:#8F8875;padding:10px 0 2px}.dl-c-note b{color:#D9D2BF}',
    '.dl-c-label{font-size:9.5px;letter-spacing:.18em;color:#6E6858;margin:14px 0 8px;display:flex;justify-content:space-between;align-items:center}',
    '.dl-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.dl-chip{font-family:var(--mono,monospace);font-size:10px;color:#C9C2AD;background:#1E1B14;border:1px solid #3B362A;',
    'border-radius:5px;padding:6px 8px;cursor:pointer;transition:border-color .15s,color .15s}',
    '.dl-chip:hover{border-color:#F0602A;color:#F0602A}.dl-chip.active{border-color:#F0602A;color:#F0602A;background:#251A10}',
    '.dl-c-row{display:flex;gap:6px}',
    '.dl-c-input{flex:1;min-width:0;background:#0E0C08;border:1px solid #3B362A;border-radius:5px;color:#E9E3D3;',
    'font-family:var(--mono,monospace);font-size:11px;padding:8px 10px}',
    '.dl-c-input:focus{outline:none;border-color:#F0602A}',
    '.dl-c-btn{background:#F0602A;color:#160D06;border:0;border-radius:5px;font-family:var(--mono,monospace);',
    'font-size:10.5px;letter-spacing:.08em;padding:8px 12px;cursor:pointer}.dl-c-btn:hover{background:#E9E3D3}',
    '.dl-c-btn-sm{padding:4px 8px;font-size:9.5px}',
    '.dl-c-debug{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:10px;color:#8F8875}',
    '.dl-switch{position:relative;width:30px;height:16px;flex:none}.dl-switch input{position:absolute;opacity:0;inset:0;cursor:pointer;margin:0}',
    '.dl-switch .track{position:absolute;inset:0;background:#3B362A;border-radius:9px;transition:background .15s;pointer-events:none}',
    '.dl-switch .track::after{content:\'\';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#8F8875;transition:transform .15s,background .15s}',
    '.dl-switch input:checked + .track{background:#F0602A}.dl-switch input:checked + .track::after{transform:translateX(14px);background:#160D06}',
    '.dl-badge{font-size:9px;letter-spacing:.1em;color:#F0602A;border:1px solid #F0602A;border-radius:3px;padding:1px 6px}',
    '.dl-badge.null{color:#8F8875;border-color:#3B362A}',
    '.dl-c-log{background:#0E0C08;border:1px solid #2C2920;border-radius:6px;height:150px;overflow:auto;padding:8px 10px;font-size:10px;line-height:1.7}',
    '.dl-c-tests{background:#0E0C08;border:1px solid #2C2920;border-radius:6px;max-height:152px;overflow:auto;padding:8px 10px;font-size:10px;line-height:1.85}',
    '.empty{color:#57523F}.log-line{display:block;word-break:break-word;color:#B9B29C}',
    '.log-line .lt{color:#57523F;margin-right:7px}.log-line .ls{color:#F0602A;margin-right:7px}',
    '.t-sum{color:#E9E3D3}.t-row{color:#8F8875;display:block}.t-row .mark{margin-right:7px}',
    '.t-row.pass .mark{color:#9BA96F}.t-row.fail{color:#F0602A}'
  ].join('');
  document.head.appendChild(style);

  /* ---------- 2. inject harness markup ---------- */
  var aside = document.createElement('aside');
  aside.className = 'dl-console';
  aside.innerHTML =
    '<button class="dl-c-head" type="button" aria-expanded="true">' +
      '<span class="tag-h">▣</span><span>DEMO CONSOLE</span>' +
      '<span class="dl-c-hint">harness — loaded only by demo.html</span><span class="dl-caret">▾</span>' +
    '</button>' +
    '<div class="dl-c-body">' +
      '<p class="dl-c-note">The production pipeline reads only <b>location.search</b> — the address bar above updates like a real landing. <b>index.html</b> (without this file) is the clean production page.</p>' +
      '<div class="dl-c-label">SCENARIOS</div><div class="dl-chips" id="dl-chips"></div>' +
      '<div class="dl-c-label">CUSTOM QUERY</div>' +
      '<div class="dl-c-row"><input class="dl-c-input" id="dl-q" spellcheck="false" placeholder="?keyword=rfid-tool-tracking" aria-label="Query string">' +
      '<button class="dl-c-btn" id="dl-q-apply" type="button">APPLY</button></div>' +
      '<div class="dl-c-debug"><label class="dl-switch"><input type="checkbox" id="dl-debug"><span class="track"></span></label>' +
      '<span><b>?debug=true</b> — pipeline log + changed-target outlines</span></div>' +
      '<div class="dl-c-label">PIPELINE <span class="dl-badge null" id="dl-badge">→ original</span></div>' +
      '<div class="dl-c-log" id="dl-log"><span class="empty">run a scenario…</span></div>' +
      '<div class="dl-c-label">TESTS <button class="dl-c-btn dl-c-btn-sm" id="dl-run-tests" type="button">RUN ALL</button></div>' +
      '<div class="dl-c-tests" id="dl-tests"><span class="empty">running…</span></div>' +
    '</div>';
  document.body.appendChild(aside);

  var chipsBox = aside.querySelector('#dl-chips'),
      qInput   = aside.querySelector('#dl-q'),
      logBox   = aside.querySelector('#dl-log'),
      testsBox = aside.querySelector('#dl-tests'),
      badge    = aside.querySelector('#dl-badge'),
      dbgBox   = aside.querySelector('#dl-debug');

  /* ---------- 3. scenario driving (through the public API only) ---------- */
  var currentQuery = window.location.search;

  var isDebug = function (q) {
    try { return new URLSearchParams(q || '').get('debug') === 'true'; } catch (e) { return false; }
  };

  function setScenario(q) {
    currentQuery = q;
    try { history.replaceState(null, '', q || window.location.pathname); } catch (e) { /* file:// — pipeline still runs */ }
    render(DL.personalize(currentQuery, { debug: isDebug(currentQuery) }));
  }

  function render(res) {
    qInput.value = currentQuery;
    dbgBox.checked = isDebug(currentQuery);
    chipsBox.querySelectorAll('.dl-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.q === currentQuery); });
    badge.textContent = res.variant ? ('→ ' + res.variant) : '→ original';
    badge.classList.toggle('null', !res.variant);
    logBox.textContent = '';
    if (isDebug(currentQuery)) {
      res.entries.forEach(function (e) {
        var line = document.createElement('span'); line.className = 'log-line';
        var t = document.createElement('span'); t.className = 'lt'; t.textContent = '+' + e.dt + 'ms';
        var s = document.createElement('span'); s.className = 'ls'; s.textContent = e.stage;
        line.appendChild(t); line.appendChild(s);
        line.appendChild(document.createTextNode(e.msg + (e.detail !== undefined ? ' ' + JSON.stringify(e.detail) : '')));
        logBox.appendChild(line);
      });
    } else {
      var line = document.createElement('span'); line.className = 'log-line';
      line.textContent = res.variant
        ? 'variant "' + res.variant + '" via ' + res.param + '="' + res.matched + '" (' + res.how + ') — enable debug for the full pipeline log'
        : 'no recognized context — original page preserved (fail-open)';
      logBox.appendChild(line);
    }
  }

  var SCENARIOS = [
    '?source=google&keyword=rfid-inventory-tracking', '?source=google&keyword=rfid-tool-tracking', '?source=google&keyword=rfid-reader',
    '?source=meta&ad=stop-losing-tools', '?campaign=toolroom-launch',
    '?keyword=tracking-industrial-tools', '?keyword=tool-tracker',
    '?keyword=RFID_Reader', '?campaign=warehouse-q1',
    '?keyword=random-value', '?keyword=%3Cscript%3Ealert(1)%3C%2Fscript%3E', ''
  ];
  SCENARIOS.forEach(function (q) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'dl-chip';
    b.textContent = q || '?  (original)';
    b.dataset.q = q;
    b.addEventListener('click', function () { setScenario(q); });
    chipsBox.appendChild(b);
  });

  aside.querySelector('#dl-q-apply').addEventListener('click', function () {
    var v = qInput.value.trim();
    if (v && v.charAt(0) !== '?') v = '?' + v.replace(/^\?+/, '');
    setScenario(v);
  });
  qInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') aside.querySelector('#dl-q-apply').click(); });

  dbgBox.addEventListener('change', function () {
    var params; try { params = new URLSearchParams(currentQuery); } catch (e) { params = new URLSearchParams(); }
    if (dbgBox.checked) params.set('debug', 'true'); else params.delete('debug');
    var s = params.toString();
    setScenario(s ? '?' + s : '');
  });

  aside.querySelector('.dl-c-head').addEventListener('click', function () {
    var collapsed = aside.classList.toggle('collapsed');
    this.setAttribute('aria-expanded', String(!collapsed));
  });

  /* ---------- 4. in-browser test suite (classification + DOM) ---------- */
  function runTests() {
    var classify = function (q) { return DL.detectVariant(DL.parseContext(q).context).variant; };
    var results = [], passed = 0;
    function t(name, fn) {
      var ok = false, note = '';
      try { var r = fn(); if (Array.isArray(r)) { ok = r[0] === true; note = r[1]; } else ok = r === true; }
      catch (e) { note = 'threw: ' + e.message; }
      if (ok) passed++;
      results.push({ name: name, ok: ok, note: note });
    }
    function expect(q, v) { var got = classify(q); return [got === v, 'got ' + JSON.stringify(got)]; }
    function readTargets() {
      var o = {};
      [['headline','[data-dl="headline"]'], ['description','[data-dl="description"]'],
       ['cta-primary','[data-dl="cta-primary"] .btn-label'], ['benefit-heading','[data-dl="benefit-heading"]'],
       ['hero-visual','[data-dl="hero-visual"]']].forEach(function (p) {
        var el = document.querySelector(p[1]); o[p[0]] = el ? el.textContent : null;
      });
      var f = document.querySelector('[data-visual]:not([hidden])');
      o['hero-visual'] = f ? f.getAttribute('data-visual') : '?';
      return o;
    }
    var hostile = '?keyword=' + encodeURIComponent('<img src=x onerror=window.__xssProbe=true>');

    /* classification — mirrors tests/dynamic-landing.test.js */
    t('keyword=rfid-inventory-tracking → inventory', function () { return expect('?keyword=rfid-inventory-tracking', 'inventory'); });
    t('RFID-INVENTORY-TRACKING (case-insensitive)',  function () { return expect('?keyword=RFID-INVENTORY-TRACKING', 'inventory'); });
    t('warehouse_stock (underscore normalization)',  function () { return expect('?keyword=warehouse_stock', 'inventory'); });
    t('keyword=rfid-tool-tracking → tools',          function () { return expect('?keyword=rfid-tool-tracking', 'tools'); });
    t('ad=stop-losing-tools → tools (convergence)',  function () { return expect('?ad=stop-losing-tools', 'tools'); });
    t('ad=Stop-Losing-Tools (case-insensitive)',     function () { return expect('?ad=Stop-Losing-Tools', 'tools'); });
    t('keyword=rfid-reader → hardware',              function () { return expect('?keyword=rfid-reader', 'hardware'); });
    t('lexicon: tracking-industrial-tools → tools',  function () { return expect('?keyword=tracking-industrial-tools', 'tools'); });
    t('lexicon: tool-tracker → tools',               function () { return expect('?keyword=tool-tracker', 'tools'); });
    t('lexicon: stockout-recovery → inventory',      function () { return expect('?keyword=stockout-recovery', 'inventory'); });
    t('precedence: keyword beats ad',                function () { return expect('?keyword=rfid-tool-tracking&ad=cut-stockouts', 'tools'); });
    t('fall-through: unknown keyword, known ad',     function () { return expect('?keyword=something-random&ad=stop-losing-tools', 'tools'); });
    t('campaign=warehouse-q1 → inventory',           function () { return expect('?campaign=warehouse-q1', 'inventory'); });
    t('source=construction-dive → tools',            function () { return expect('?source=construction-dive', 'tools'); });
    t('something-random → null',                     function () { return expect('?keyword=something-random', null); });
    t('hostile keyword → null',                      function () { return expect(hostile, null); });
    t('empty query → null',                          function () { return expect('', null); });
    t('blank value (?keyword=) → null',              function () { return expect('?keyword=', null); });
    t('?debug=true alone → null (never personalizes)', function () { return expect('?debug=true', null); });
    t('untracked param (?utm_source=x) → null',      function () { return expect('?utm_source=newsletter', null); });

    /* DOM-level */
    t('dom · tools changes exactly the 5 approved targets', function () {
      DL.personalize('?keyword=rfid-tool-tracking', {});
      var now = readTargets();
      var changed = Object.keys(now).filter(function (k) { return now[k] !== DL.original[k]; });
      return [changed.length === 5, 'changed: ' + (changed.join(', ') || 'none')];
    });
    t('dom · tools headline is the approved copy verbatim', function () {
      DL.personalize('?keyword=rfid-tool-tracking', {});
      return [document.querySelector('[data-dl="headline"]').textContent === DL.VARIANTS.tools.headline, 'exact-match check'];
    });
    t('dom · non-approved sentinel (nav brand) untouched', function () {
      var before = document.querySelector('.brand span').textContent;
      DL.personalize('?keyword=rfid-tool-tracking', {});
      return [document.querySelector('.brand span').textContent === before && before === 'WAYMARK', 'sentinel stable'];
    });
    t('dom · variant switch leaves no residue (tools→inventory)', function () {
      DL.personalize('?keyword=rfid-tool-tracking', {});
      DL.personalize('?keyword=rfid-inventory-tracking', {});
      var now = readTargets();
      return [now['headline'] === DL.VARIANTS.inventory.headline && now['hero-visual'] === 'inventory', 'fully replaced'];
    });
    t('dom · null context after a variant restores pristine DOM', function () {
      DL.personalize('?keyword=rfid-tool-tracking', {});
      DL.personalize('', {});
      var now = readTargets(), same = Object.keys(DL.original).every(function (k) { return now[k] === DL.original[k]; });
      return [same, 'byte-identical restore'];
    });
    t('dom · hostile value never executes nor reaches the DOM', function () {
      DL.personalize(hostile, {});
      return [window.__xssProbe === undefined, 'probe undefined — input inert'];
    });

    testsBox.textContent = '';
    var sum = document.createElement('span'); sum.className = 't-sum';
    sum.textContent = passed + '/' + results.length + ' PASSING';
    testsBox.appendChild(sum);
    results.forEach(function (r) {
      var row = document.createElement('span'); row.className = 't-row ' + (r.ok ? 'pass' : 'fail');
      var m = document.createElement('span'); m.className = 'mark'; m.textContent = r.ok ? '✓' : '✗';
      row.appendChild(m);
      row.appendChild(document.createTextNode(r.name + (r.ok ? '' : '  [' + r.note + ']')));
      testsBox.appendChild(row);
    });

    render(DL.personalize(currentQuery, { debug: isDebug(currentQuery) })); // leave page in live-URL state
    return { pass: passed, total: results.length };
  }
  aside.querySelector('#dl-run-tests').addEventListener('click', runTests);

  /* ---------- 5. init ---------- */
  runTests();
  if (window.innerWidth < 720) aside.classList.add('collapsed');
})();
