// Smoke-тест в headless Chrome: загрузка без JS-ошибок, готовые системы, симуляция,
// Sequence, BPMN, инспектор Kafka, визуализация БД по двойному клику, импорт/автосейв.
// Запуск: node tests/smoke-tests.js  (нужен статический сервер, см. tests/run-all.js)
// Переменные: RAPTOR_URL, CHROME, SHOTS (каталог для скриншотов, необязательно).
const path = require('path');
const fs = require('fs');
const req = m => { try { return require(m); } catch (e) { return require(path.join(process.env.BPMN_TOOLS || '/workspace/bpmn-tools', 'node_modules', m)); } };
const puppeteer = req('puppeteer-core');
const URL = process.env.RAPTOR_URL || 'http://127.0.0.1:5847/index.html';
const SHOTS = process.env.SHOTS || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'], defaultViewport: { width: 1600, height: 1000 } });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => { if (!/favicon/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
  page.on('dialog', d => d.accept());
  const shot = async n => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await sleep(250); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
  const errCount = () => errors.length;

  console.log('— Загрузка');
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' }); await sleep(500);
  await page.evaluate(() => { window.loadSys = k => { S.blocks = []; S.conns = []; S.scenarios = []; S.selected = null; S.panX = 0; S.panY = 0; S.zoom = 1; HIST = []; HI = -1; placeTemplate(k); }; });
  ok(await page.evaluate(() => typeof S === 'object' && typeof TMPLS === 'object' && Object.keys(TMPLS).length > 0), 'приложение загрузилось, шаблоны систем есть');
  ok(errCount() === 0, 'нет ошибок при загрузке', errors.slice());

  console.log('— Готовые системы + симуляция');
  const list = await page.evaluate(() => Object.entries(TMPLS).filter(([k, t]) => t.g === 'Системы').map(([k, t]) => ({ i: k, name: tplLabel(t), types: t.bls.map(b => b.t) })));
  ok(list.length >= 4, 'готовых систем в каталоге: ' + list.length);
  const want = [/kafka/, /redis/, /postgresql/, /clickhouse|elasticsearch|mongodb|cassandra/];
  const picked = [];
  want.forEach(re => { const e = list.find(x => !picked.includes(x) && x.types.some(t => re.test(t))); if (e) picked.push(e); });
  while (picked.length < 4 && picked.length < list.length) { const e = list.find(x => !picked.includes(x)); picked.push(e); }
  for (const ex of picked) {
    const e0 = errCount();
    const r = await page.evaluate(i => { loadSys(i); render(); return { n: S.blocks.length, c: S.conns.length }; }, ex.i);
    await page.evaluate(() => runSim()); await sleep(1500);
    const dots = await page.evaluate(() => ({ running: SIM.running, dots: document.querySelectorAll('#anim-layer *').length }));
    await page.evaluate(() => stopSim());
    ok(r.n > 0 && dots.running && errCount() === e0, `система «${ex.name}»: ${r.n} блоков, симуляция идёт (${dots.dots} эл. анимации)`, errors.slice(e0));
  }
  await shot('smoke-system-sim');

  console.log('— Sequence');
  { const e0 = errCount();
    const r = await page.evaluate(() => { openSeq(); return { open: $('seq-modal').style.display, svg: !!document.querySelector('#seq-canvas svg') }; });
    await shot('smoke-seq');
    await page.evaluate(() => closeSeq());
    ok(r.open === 'flex' && r.svg && errCount() === e0, 'Sequence открывается и рисует SVG', errors.slice(e0)); }

  console.log('— Инспектор Kafka');
  { const e0 = errCount();
    const idx = list.find(x => x.types.includes('kafka'));
    const r = await page.evaluate(i => { loadSys(i); const k = S.blocks.find(b => b.type === 'kafka'); runSim(); openBrokerInspector(k.id); return k.id; }, idx.i);
    await sleep(1200);
    const vis = await page.evaluate(() => { const m = [...document.querySelectorAll('.modal-ov,[id*=broker]')].find(m => m.offsetParent !== null || getComputedStyle(m).display !== 'none'); return !!m; });
    await shot('smoke-kafka-inspector');
    await page.evaluate(() => { stopSim(); if (typeof closeBrokerInspector === 'function') closeBrokerInspector(); document.querySelectorAll('.modal-ov').forEach(m => m.style.display = 'none'); });
    ok(vis && errCount() === e0, 'инспектор Kafka открывается во время симуляции', errors.slice(e0)); }

  console.log('— Визуализация БД двойным кликом');
  { const e0 = errCount();
    const idx = list.find(x => x.types.includes('postgresql'));
    await page.evaluate(i => { loadSys(i); S.panX = 0; S.panY = 0; S.zoom = 1; render(); }, idx.i);
    const pos = await page.evaluate(() => { const r = svgRct(); const z = S.zoom || 1; const b = S.blocks.find(b => b.type === 'postgresql'); return { x: r.left + S.panX + (b.x + 20) * z, y: r.top + S.panY + (b.y + 15) * z }; });
    await page.mouse.click(pos.x, pos.y, { count: 2 }); await sleep(300);
    const open = await page.evaluate(() => !!document.querySelector('#dbv-modal .dbv') && $('dbv-modal').style.display !== 'none');
    await shot('smoke-dbviz');
    await page.evaluate(() => closeDBViz());
    ok(open && errCount() === e0, 'двойной клик по PostgreSQL открывает визуализацию', errors.slice(e0)); }

  console.log('— BPMN');
  { const e0 = errCount();
    const r = await page.evaluate(() => { switchNotation('bpmn'); render(); return { mode: S.notationMode, d: (S.bpmn.diagrams || []).length }; });
    await shot('smoke-bpmn');
    await page.evaluate(() => switchNotation('c4'));
    ok(r.mode === 'bpmn' && errCount() === e0, 'BPMN-режим включается', errors.slice(e0)); }

  console.log('— Импорт JSON: валидация, id, история');
  { const e0 = errCount();
    const r = await page.evaluate(() => {
      const d = { blocks: [{ id: 'b5000', type: 'service', x: 10, y: 10 }, { id: 'b7', type: 'no_such_type', x: 200, y: 10, customLabel: '<img src=x onerror=window.__xss=1>' }, { id: 'b8', type: 'postgresql', x: 300, y: 10 }, 'мусор'],
        conns: [{ id: 'c1', from: 'b5000', to: 'b8' }, { id: 'c2', from: 'b5000', to: 'nope' }], scenarios: [{ name: '<b onmouseover=1>x', path: ['b5000', 'b8'] }] };
      const rep = importProjectData(d, 'test');
      render(); analyze(); if (typeof updateSidebar === 'function') updateSidebar();
      const nid = S.nid; const n = S.blocks.length; const c = S.conns.length;
      const unk = S.blocks.find(b => b.id === 'b7');
      undo(); // история новая — откатывать некуда
      return { nid, n, c, unk: unk && unk._unknownType, after: S.blocks.length, rep, xss: !!window.__xss };
    });
    ok(r.nid > 5000, 'S.nid = max(id)+1 после импорта', r.nid);
    ok(r.n === 3 && r.c === 1, 'неизвестный блок сохранён с пометкой, битая связь отброшена', r);
    ok(r.unk === 'no_such_type', 'неизвестный тип помечен', r.unk);
    ok(r.after === 3, 'undo после импорта не возвращает прошлый проект', r.after);
    ok(!r.xss, 'XSS через имя блока не срабатывает');
    await page.evaluate(() => runSim()); await sleep(600); await page.evaluate(() => stopSim());
    ok(errCount() === e0, 'нет ошибок с неизвестным блоком (рендер, анализ, симуляция)', errors.slice(e0)); }

  console.log('— Битый автосейв');
  { await page.evaluate(() => { window.removeEventListener('beforeunload', autosave); localStorage.setItem('arch4_auto', '{"blocks":[{"id":"b1",'); });
    const e0 = errCount();
    await page.reload({ waitUntil: 'load' }); await sleep(500);
    const r = await page.evaluate(() => ({ ok: typeof S === 'object' && Array.isArray(S.blocks), bak: !!localStorage.getItem('arch4_auto_broken'), pal: document.querySelectorAll('#palette .pal-item').length }));
    ok(r.ok && r.bak && r.pal > 0 && errCount() === e0, 'битый автосейв: приложение стартует, бэкап в arch4_auto_broken', { r, e: errors.slice(e0) }); }

  console.log('— Старый проект из автосейва');
  { await page.evaluate(() => { window.removeEventListener('beforeunload', autosave); localStorage.removeItem('arch4_auto_broken');
      localStorage.setItem('arch4_auto', JSON.stringify({ blocks: [{ id: 'o1', type: 'service', x: 60, y: 80 }, { id: 'o2', type: 'postgresql', x: 300, y: 60 }, { id: 'o3', type: 'kafka', x: 300, y: 200 }, { id: 'o4', type: 'redis', x: 300, y: 340 }],
        conns: [{ id: 'c1', from: 'o1', to: 'o2' }, { id: 'c2', from: 'o1', to: 'o3' }, { id: 'c3', from: 'o1', to: 'o4' }], nid: 10 })); });
    const e0 = errCount();
    await page.reload({ waitUntil: 'load' }); await sleep(600);
    const r = await page.evaluate(() => ({ n: S.blocks.length, nodes: document.querySelectorAll('#canvas [data-id], #canvas .blk, #canvas g').length }));
    await page.evaluate(() => runSim()); await sleep(800); await page.evaluate(() => stopSim());
    ok(r.n === 4 && errCount() === e0, 'старый автосейв восстанавливается, симуляция без ошибок', { r, e: errors.slice(e0) }); }

  ok(errors.length === 0, 'итого без JS-ошибок', errors);
  console.log(`\nИТОГО: ${pass}/${pass + fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
