// BPMN E2E-тесты (headless Chrome + puppeteer-core).
// Запуск:  python3 -m http.server 5847 --bind 127.0.0.1 &   (из корня проекта)
//          node tests/bpmn-tests.js
// Переменные: RAPTOR_URL (по умолчанию http://127.0.0.1:5847/index.html),
//             CHROME (по умолчанию /usr/bin/google-chrome),
//             BPMN_TOOLS — каталог с node_modules (puppeteer-core, bpmn-moddle опционально).
const path = require('path');
const fs = require('fs');
const TOOLS = process.env.BPMN_TOOLS || '/workspace/bpmn-tools';
const req = m => { try { return require(m); } catch (e) { return require(path.join(TOOLS, 'node_modules', m)); } };
const puppeteer = req('puppeteer-core');
let BpmnModdle = null; try { BpmnModdle = req('bpmn-moddle').BpmnModdle; } catch (e) { /* опционально */ }
const URL = process.env.RAPTOR_URL || 'http://127.0.0.1:5847/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'], defaultViewport: { width: 1600, height: 1000 } });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|SEQ|✗ T\d/.test(m.text()) && !/status of 404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' }); await sleep(400);
  await page.evaluate(() => switchNotation('bpmn'));

  // хелперы внутри страницы: build({els:[[key,type,x,y,label?,extra?]], flows:[[a,b,label?]]})
  await page.evaluate(() => {
    window.__build = spec => {
      const d = getCurrentBpmn(); d.elements = []; d.flows = []; d.scenarios = []; BPMN_SANITIZE_LOG.delete(d);
      const id = {};
      spec.els.forEach(([k, type, x, y, label, extra]) => {
        const def = BPMN_EL[type]; const e = Object.assign({ id: 'be' + (S.nid++), type, label: label || def.lbl, x, y, w: def.w, h: def.h }, extra || {});
        if (e.attachedTo) e.attachedTo = id[e.attachedTo];
        id[k] = e.id; d.elements.push(e);
      });
      (spec.flows || []).forEach(([a, b, l]) => { const f = { id: 'bf' + (S.nid++), from: id[a], to: id[b] }; if (l) f.label = l; d.flows.push(f); });
      bpmnSyncBoundaries(d); S.selected = null; S.zoom = 1; S.panX = 0; S.panY = 0; render();
      return id;
    };
    window.__issues = () => bpmnValidate(getCurrentBpmn()).map(i => i.sev + ': ' + i.msg);
    window.__toScreen = (x, y) => { const r = $('canvas').getBoundingClientRect(); const z = S.zoom || 1; return { x: r.left + S.panX + x * z, y: r.top + S.panY + y * z }; };
  });
  const scr = (x, y) => page.evaluate((x, y) => __toScreen(x, y), x, y);

  console.log('— Выбор связи / зум / колесо');
  {
    const id = await page.evaluate(() => __build({ els: [['p', 'pool', 100, 60, 'P', { w: 700, h: 200 }], ['a', 'task', 200, 120], ['b', 'task', 500, 120]], flows: [['a', 'b']] }));
    const m = await page.evaluate(() => { const b = getCurrentBpmn(); return bpmnPolyAt(bpmnFlowPoints(b, b.flows[0]), 0.5); });
    let p = await scr(m.x, m.y); await page.mouse.click(p.x, p.y);
    ok(await page.evaluate(() => S.selected && S.selected.startsWith('bf')), 'клик по связи внутри пула выбирает связь, а не пул/дорожку');
    await page.evaluate(() => { S.zoom = 1.5; render(); });
    p = await scr(m.x, m.y); await page.mouse.click(p.x + 0, p.y + 0);
    ok(await page.evaluate(() => S.selected && S.selected.startsWith('bf')), 'клик по связи при zoom 1.5');
    p = await scr(400, 400); await page.mouse.move(p.x, p.y); await page.mouse.wheel({ deltaY: -200 }); await sleep(100);
    ok(await page.evaluate(() => S.zoom > 1.5), 'колесо мыши зумит в BPMN', await page.evaluate(() => S.zoom));
    {
      const g = await page.evaluate(() => { __build({ els: [['s', 'start', 100, 100], ['t', 'task', 200, 90], ['g', 'gateway_xor', 360, 95]], flows: [['s', 't'], ['t', 'g']] });
        const gl = [...document.querySelectorAll('#canvas .bpmn-gloss')]; const sh = document.querySelectorAll('#canvas [filter="url(#m-sh)"]').length;
        return { n: gl.length, pe: gl.every(e => e.getAttribute('pointer-events') === 'none' && e.getAttribute('fill') === 'url(#m-v)'), sh, defs: !!document.querySelector('#canvas #m-v') }; });
      ok(g.n >= 3 && g.pe && g.sh >= 3 && g.defs, 'BPMN-фигуры объёмные: блик-накладка (без событий мыши) и тень', g);
    }
    ok(await page.evaluate(() => /scale\(/.test($('block-layer').getAttribute('transform') || '')), 'слой фигур масштабируется');
    await page.evaluate(() => { S.zoom = 1; S.panX = 0; S.panY = 0; render(); });
  }

  console.log('— Перетаскивание: сетка и выравнивание');
  {
    const id = await page.evaluate(() => __build({ els: [['a', 'task', 200, 200], ['b', 'task', 500, 330]] }));
    const p = await scr(560, 360);
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 7, p.y - 128, { steps: 6 }); // y≈202 → прилипает к a.y=200
    const guides = await page.evaluate(() => (S.bpmnGuides || []).length);
    await page.mouse.up();
    const b = await page.evaluate(k => bEl(k), id.b);
    ok(b.y === 200, 'прилипание к соседу по верхнему краю/центру', b);
    ok(guides > 0, 'во время перетаскивания рисуются направляющие');
    ok(b.x % 10 === 0 || b.x === 200, 'x по сетке', b.x);
    await page.evaluate(k => { S.bpmnMulti = Object.values(k); bpmnAlignSelection('left'); }, id);
    ok(await page.evaluate(k => bEl(k.a).x === bEl(k.b).x, id), 'выравнивание выделения по левому краю');
  }

  console.log('— Роутинг: стрелки не пересекают фигуры');
  {
    await page.evaluate(() => __build({ els: [['a', 'task', 100, 200], ['m', 'task', 300, 200], ['b', 'task', 500, 200], ['c', 'task', 300, 380]], flows: [['a', 'b'], ['a', 'c'], ['c', 'b']] }));
    const r = await page.evaluate(() => {
      const d = getCurrentBpmn(); const bad = [];
      d.flows.forEach(f => {
        const pts = bpmnFlowPoints(d, f);
        d.elements.forEach(e => {
          if (e.id === f.from || e.id === f.to) return;
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
            if (x1 > e.x && x0 < e.x + e.w && y1 > e.y && y0 < e.y + e.h) bad.push(f.id + '×' + e.label);
          }
        });
        for (let i = 0; i < pts.length - 1; i++) if (pts[i].x !== pts[i + 1].x && pts[i].y !== pts[i + 1].y) bad.push(f.id + ' diagonal');
      });
      return bad;
    });
    ok(r.length === 0, 'ортогональные маршруты в обход фигур', r);
    const st = await page.evaluate(() => { __build({ els: [['s', 'start', 100, 204], ['t', 'task', 200, 196]], flows: [['s', 't']] }); const d = getCurrentBpmn(); return bpmnFlowPoints(d, d.flows[0]).length; });
    ok(st === 2, 'почти соосные фигуры соединяются прямой без зигзага', st);
  }

  console.log('— Валидация');
  {
    await page.evaluate(() => __build({ els: [['t', 'task', 100, 100]] }));
    let iss = await page.evaluate(() => __issues());
    ok(iss.some(i => /Нет Start/.test(i)) && iss.some(i => /Нет End/.test(i)), 'нет start / нет end', iss);
    await page.evaluate(() => __build({ els: [['s', 'start', 50, 100], ['g', 'gateway_xor', 150, 100], ['e', 'end', 300, 100]], flows: [['s', 'g']] }));
    iss = await page.evaluate(() => __issues());
    ok(iss.some(i => /error/.test(i) && /исходящ|выход/i.test(i) && /Exclusive|Gateway|шлюз/i.test(i)), 'шлюз без выходов', iss);
    await page.evaluate(() => { const id = __build({ els: [['s', 'start', 50, 100], ['e', 'end', 300, 100]], flows: [['s', 'e']] }); getCurrentBpmn().flows.push({ id: 'bfX', from: id.s, to: 'be_missing' }); bpmnSanitizeState(); });
    iss = await page.evaluate(() => __issues());
    ok(iss.some(i => /отброшено/.test(i)) && await page.evaluate(() => !getCurrentBpmn().flows.some(f => f.id === 'bfX')), 'висячая связь удалена и показана в отчёте', iss);
    await page.evaluate(() => __build({ els: [['s', 'start', 50, 100], ['x', 'gateway_xor', 130, 97], ['a', 'task', 230, 40], ['b', 'task', 230, 160], ['j', 'gateway_and', 400, 97], ['e', 'end', 500, 100]],
      flows: [['s', 'x'], ['x', 'a', 'да'], ['x', 'b', 'нет'], ['a', 'j'], ['b', 'j'], ['j', 'e']] }));
    iss = await page.evaluate(() => __issues());
    ok(iss.some(i => /^error/.test(i) && /AND|Parallel|deadlock|взаимоблок/i.test(i)), 'несбалансированный AND (XOR-split → AND-join)', iss);
    await page.evaluate(() => __build({ els: [['s', 'start', 50, 100], ['x', 'gateway_and', 130, 97], ['a', 'task', 230, 40], ['b', 'task', 230, 160], ['j', 'gateway_and', 400, 97], ['e', 'end', 500, 100]],
      flows: [['s', 'x'], ['x', 'a'], ['x', 'b'], ['a', 'j'], ['b', 'j'], ['j', 'e']] }));
    iss = await page.evaluate(() => __issues());
    ok(iss.length === 0, 'корректный AND-split/AND-join без замечаний', iss);
    await page.evaluate(() => __build({ els: [['s', 'start', 50, 100], ['t', 'task', 150, 90], ['u', 'task', 350, 90], ['e', 'end', 500, 100]], flows: [['s', 't'], ['u', 'e']] }));
    iss = await page.evaluate(() => __issues());
    ok(iss.some(i => /тупик|недостижим/.test(i)), 'тупик / недостижимый элемент', iss);
  }

  console.log('— Симуляция и пошаговый режим');
  {
    await page.evaluate(() => __build({ els: [['s', 'start', 50, 100], ['x', 'gateway_and', 130, 97], ['a', 'task', 230, 40], ['b', 'task', 230, 160], ['j', 'gateway_and', 400, 97], ['e', 'end', 500, 100]],
      flows: [['s', 'x'], ['x', 'a'], ['x', 'b'], ['a', 'j'], ['b', 'j'], ['j', 'e']] }));
    await page.evaluate(() => bpmnSimStart()); await sleep(200);
    const sc = await page.evaluate(() => getCurrentBpmn().scenarios.map(s => s.name));
    ok(sc.length === 1 && !/deadlock/.test(sc[0]), 'AND-форк = один сценарий без deadlock', sc);
    const st = await page.evaluate(() => { bpmnStepStart(getCurrentBpmn().scenarios[0].id); const a = [...S.bpmnStep.activeIds]; bpmnStepGo(2); const b = [...S.bpmnStep.activeIds]; bpmnStepGo(99); const c = [...S.bpmnStep.activeIds]; return { a, b, c, tokens: document.querySelectorAll('.bpmn-token-ring').length }; });
    ok(st.a.length === 1 && st.b.length === 2, 'шаг 0 — 1 токен, после AND-split — 2 токена', st);
    ok(st.tokens > 0, 'токены подсвечены на холсте (.bpmn-token-ring)');
    await page.evaluate(() => { bpmnStepStop(); bpmnSimReset(); });
    await page.evaluate(() => __build({ els: [['s', 'start', 50, 100], ['x', 'gateway_xor', 130, 97], ['a', 'task', 230, 40], ['b', 'task', 230, 160], ['j', 'gateway_and', 400, 97], ['e', 'end', 500, 100]],
      flows: [['s', 'x'], ['x', 'a', 'да'], ['x', 'b', 'нет'], ['a', 'j'], ['b', 'j'], ['j', 'e']] }));
    await page.evaluate(() => bpmnSimStart()); await sleep(200);
    const sc2 = await page.evaluate(() => getCurrentBpmn().scenarios.map(s => s.name));
    ok(sc2.length === 2 && sc2.every(n => /deadlock/.test(n)), 'XOR→AND-join: сценарии помечены deadlock', sc2);
    await page.evaluate(() => bpmnSimReset());
  }

  console.log('— Переименование, XSS, старые проекты');
  {
    const id = await page.evaluate(() => __build({ els: [['t', 'task', 200, 200, 'Исходное']] }));
    await page.evaluate(k => bpmnStartRename(k), id.t); await sleep(50);
    await page.keyboard.type('XXX'); await page.keyboard.press('Escape'); await sleep(50);
    ok(await page.evaluate(k => bEl(k).label, id.t) === 'Исходное', 'Escape отменяет переименование');
    await page.evaluate(k => bpmnStartRename(k), id.t); await sleep(50);
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('Новое'); await page.keyboard.press('Enter'); await sleep(50);
    ok(await page.evaluate(k => bEl(k).label, id.t) === 'Новое', 'Enter применяет переименование');
    await page.evaluate(k => { bEl(k).label = '<img src=x onerror="window.__xss=1">'; getCurrentBpmn().name = '<img src=x onerror="window.__xss=1">'; S.selected = k; renderBpmnPanel(); render(); }, id.t);
    await sleep(150);
    ok(await page.evaluate(() => !window.__xss), 'метки не исполняются как HTML в панели');
    const old = await page.evaluate(() => {
      S.bpmn = normalizeBpmn([{ id: 'bpOld', name: 'old', elements: [{ id: 'be1', type: 'start', x: 50, y: 50 }, { id: 'be2', type: 'task', x: 150, y: 40, label: 'T' }, { id: 'be3', type: 'weird', x: 300, y: 40 }], flows: [{ id: 'bf4', from: 'be1', to: 'be2' }, { id: 'bf5', from: 'be2', to: 'nope' }] }]);
      try { render(); renderBpmnPanel(); } catch (e) { return 'ERR ' + e.message; }
      const d = getCurrentBpmn();
      return { n: d.elements.length, f: d.flows.length, nan: /NaN/.test($('block-layer').innerHTML), nid: S.nid };
    });
    ok(old.n === 3 && old.f === 1 && !old.nan && old.nid > 5, 'старый проект без w/h и с мусором открывается', old);
  }

  console.log('— BPMN 2.0 XML');
  {
    await page.evaluate(() => __build({ els: [
      ['p', 'pool', 100, 60, 'Магазин', { w: 800, h: 260 }], ['l1', 'lane', 108, 88, 'Продажи', { w: 784, h: 120 }], ['l2', 'lane', 108, 208, 'Склад', { w: 784, h: 110 }],
      ['q', 'pool', 100, 320, 'Клиент', { w: 800, h: 150 }],
      ['s', 'start', 160, 126], ['t', 'task_user', 240, 116, 'Проверить & "<заказ>"'], ['g', 'gateway_xor', 400, 123], ['a', 'task_service', 500, 116], ['b', 'task_script', 500, 236],
      ['e', 'end', 700, 126], ['er', 'event_error', 700, 250], ['bt', 'boundary_timer', 0, 0, 'T', { attachedTo: 't' }], ['do', 'data_object', 300, 240], ['an', 'annotation', 650, 160, 'note'],
      ['cs', 'start', 160, 370], ['ct', 'task', 260, 360], ['ce', 'end', 450, 370]],
      flows: [['s', 't'], ['t', 'g'], ['g', 'a', 'да'], ['g', 'b', 'нет'], ['a', 'e'], ['b', 'e'], ['bt', 'er'], ['t', 'do'], ['an', 'a'], ['cs', 'ct'], ['ct', 'ce'], ['ct', 's', 'заказ']] }));
    const x = await page.evaluate(() => bpmnToXml(getCurrentBpmn()));
    ok(/<bpmn:collaboration/.test(x) && (x.match(/<bpmn:participant /g) || []).length === 2 && /<bpmn:messageFlow /.test(x) && /<bpmn:laneSet/.test(x), 'XML: collaboration, 2 участника, messageFlow, laneSet');
    ok(/<bpmn:boundaryEvent [^>]*attachedToRef=/.test(x) && /<bpmn:dataOutputAssociation/.test(x) && /<di:waypoint/.test(x), 'XML: boundary, data association, waypoints');
    if (BpmnModdle) {
      const r = await new BpmnModdle().fromXML(x).catch(e => ({ warnings: ['ERR ' + e.message] }));
      ok(r.warnings.length === 0, 'XML проходит bpmn-moddle без предупреждений', r.warnings.map(w => w.message || w));
    }
    const rt = await page.evaluate(x => { const a = getCurrentBpmn(); const sig = d => d.elements.map(e => e.type).sort().join() + '|' + d.flows.length; const sa = sig(a); const d = bpmnImportXmlText(x, 'rt.bpmn'); return { same: sa === sig(d), cur: S.bpmn.currentDiagramId === d.id, label: d.elements.find(e => e.type === 'task_user').label }; }, x);
    ok(rt.same && rt.cur, 'round-trip: типы и число связей совпадают, диаграмма открыта', rt);
    ok(rt.label === 'Проверить & "<заказ>"', 'спецсимволы в именах сохраняются', rt.label);
    const cam = fs.readFileSync(path.join(__dirname, 'fixtures', 'camunda-sample.bpmn'), 'utf8');
    const c = await page.evaluate(x => { const d = bpmnImportXmlText(x, 'c.bpmn'); return { name: d.name, n: d.elements.length, f: d.flows.length, b: d.elements.filter(e => e.type === 'boundary_error' && e.attachedTo).length, send: d.elements.filter(e => e.origType === 'sendTask').length }; }, cam);
    ok(c.n === 9 && c.f === 7 && c.b === 1 && c.send === 1 && c.name === 'Согласование счёта', 'импорт файла Camunda Modeler', c);
    const bad = await page.evaluate(() => { try { bpmnFromXml('<a/>'); return 'no error'; } catch (e) { return 'ok'; } });
    ok(bad === 'ok', 'не-BPMN XML отклоняется с понятной ошибкой');
  }

  console.log('— Undo/Redo и регрессия seq-тестов');
  {
    await page.evaluate(() => { __build({ els: [['s', 'start', 50, 100]] }); pushHist(); });
    const n0 = await page.evaluate(() => S.bpmn.diagrams.length);
    await page.evaluate(() => { window.prompt = () => 'Новая'; addBpmnDiagram(); });
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(50);
    ok(await page.evaluate(() => S.bpmn.diagrams.length) === n0, 'Undo отменяет создание диаграммы');
    const r = await page.evaluate(() => seqTests.run());
    ok(r.fail <= 9, 'seqTests: не хуже базовых 9 падений (отдельная зона seq)', r);
  }

  ok(errors.length === 0, 'нет ошибок в консоли', errors);
  await page.close();

  console.log('— Автосохранение старого формата');
  {
    const old = JSON.stringify({ blocks: [], conns: [], nid: 3, notationMode: 'bpmn',
      bpmn: { diagrams: [{ id: 'bp1', name: 'old', elements: [{ id: 'be1', type: 'start', x: 40, y: 40 }, { id: 'be2', type: 'task', x: 140, y: 30 }], flows: [{ id: 'bf9', from: 'be1', to: 'be2' }] }], currentDiagramId: 'bp1' } });
    const p2 = await browser.newPage(); const err2 = [];
    p2.on('pageerror', e => err2.push(e.message));
    p2.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) err2.push(m.text()); });
    await p2.evaluateOnNewDocument(j => { if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem('arch4_auto', j); sessionStorage.setItem('__seeded', '1'); } }, old);
    await p2.goto(URL, { waitUntil: 'load' }); await sleep(500);
    const r = await p2.evaluate(() => { if (S.notationMode !== 'bpmn') switchNotation('bpmn'); const d = getCurrentBpmn(); return { name: d.name, n: d.elements.length, w: d.elements[1] && d.elements[1].w, nid: S.nid, svg: document.querySelectorAll('#block-layer .bpmn-el').length }; });
    ok(r.name === 'old' && r.n === 2 && r.w === 110 && r.nid > 9 && r.svg === 2, 'старое автосохранение восстанавливается и рисуется', r);
    ok(err2.length === 0, 'без ошибок консоли при восстановлении', err2);
    await p2.evaluate(() => localStorage.clear());
  }

  await browser.close();
  console.log(`\nИТОГО: ${pass}/${pass + fail}` + (fail ? ` — ${fail} FAILED` : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
