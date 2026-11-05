// C4 семантический зум (c4-zoom.js): уровни C1…C4, колесо, авто-компоненты, привязка
// внешних связей, код C4, рамка системы C1, миграция/импорт-экспорт поля components,
// цепочка симуляции на C3 и производительность отрисовки.
// Запуск: node tests/c4zoom-tests.js  (нужен статический сервер, см. tests/run-all.js)
const path = require('path');
const req = m => { try { return require(m); } catch (e) { return require(path.join(process.env.BPMN_TOOLS || '/workspace/bpmn-tools', 'node_modules', m)); } };
const puppeteer = req('puppeteer-core');
const URL = process.env.RAPTOR_URL || 'http://127.0.0.1:5847/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' }); await sleep(500);
  const ev = (f, ...a) => page.evaluate(f, ...a);
  const bank = () => ev(() => { if (typeof stopSim === 'function') stopSim(); S.blocks = []; S.conns = []; S.scenarios = []; S.selected = null; S.view = 'workspace'; ZS.svc = null; ZS.comp = null; ZS.l1 = false; ZS.p = 0; ZS.pc = 0; ZS.bound = false; ZS_MS = 0; S.panX = 0; S.panY = 0; S.zoom = 1; S.nid = 1; placeTemplate('bank'); render(); });

  console.log('— Пороги уровней (zsLevelFor, гистерезис)');
  const L = await ev(() => {
    const f = zsLevelFor, H = { svc: true, comp: false }, C = { svc: true, comp: true }, N = { svc: false, comp: false };
    return [f(1, 2, H), f(1.6, 2, H), f(1.6, 2, N), f(1.4, 3, H), f(1.25, 3, H), f(2.4, 3, C), f(2.2, 4, C), f(2.0, 4, C), f(0.45, 2, N), f(0.55, 1, N), f(0.6, 1, N)];
  });
  ok(JSON.stringify(L) === JSON.stringify([2, 3, 2, 3, 2, 4, 4, 3, 1, 1, 2]), 'пороги и гистерезис C1/C2/C3/C4', L);

  console.log('— Колесо над «Переводы» (банк)');
  await bank();
  const pos = await ev(() => { const b = gb('b10'), r = svgRct(); S.zoom = 1; S.panX = r.width / 2 - (b.x + bw(b) / 2); S.panY = r.height / 2 - (b.y + bh(b) / 2); render(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await ev(() => { window._zsXY = JSON.stringify(S.blocks.map(b => [b.x, b.y])); });
  await page.mouse.move(pos.x, pos.y);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: -100 }); await sleep(40); }
  await sleep(150);
  let st = await ev(() => ({ lvl: zsLevel(), svc: ZS.svc, z: S.zoom, frame: !!document.querySelector('#zl-body [data-zs="frame"]'), comps: document.querySelectorAll('#zl-body [data-zs="comp"]').length }));
  ok(st.lvl === 3 && st.svc === 'b10', 'колесо ↑ над сервисом → C3, раскрыт b10', st);
  ok(st.frame && st.comps >= 4, 'рамка C3 и компоненты нарисованы на месте блока', st);
  const m = await ev(() => { const m = ZS.model; return { names: m.comps.map(c => c.name), bind: m.bind, kinds: m.comps.map(c => c.kind) }; });
  ['TransfersController', 'TransfersService', 'LedgerEntriesRepository', 'SwiftClient', 'TransferEventsProducer', 'AuditLogProducer']
    .forEach(n => ok(m.names.includes(n), 'авто-компонент ' + n, m.names));
  const bindOk = await ev(() => { const m = ZS.model; return S.conns.filter(c => c.from === 'b10' || c.to === 'b10').every(c => m.byId[m.bind[c.id]]); });
  ok(bindOk, 'каждая внешняя связь сервиса привязана к компоненту', m.bind);
  const rebound = await ev(() => { const m = ZS.model, c = S.conns.find(c => c.to === 'b10'), n = zsNode('b10', c), comp = m.byId[m.bind[c.id]]; return n === comp && document.querySelectorAll('#zl-conns path').length > 0; });
  ok(rebound, 'входящая связь ведёт к контроллеру (zsNode), связи в #zl-conns');
  const neigh = await ev(() => { const f = ZS.model.frame; return S.blocks.filter(b => b.id !== 'b10').every(b0 => { const b = zsView(b0); return !(b.x < f.x + f.w && b.x + bw(b) > f.x && b.y < f.y + f.h && b.y + bh(b) > f.y); }); });
  ok(neigh, 'соседи раздвинуты: рамка никого не накрывает (визуально)');
  ok(await ev(() => JSON.stringify(S.blocks.map(b => [b.x, b.y])) === window._zsXY), 'реальные координаты блоков не меняются');
  ok(await ev(() => /C3/.test($('sb-l').textContent) && $('c4-l3').classList.contains('on') && /Переводы/.test($('zs-crumbs').textContent)), 'статус-бар, кнопка C3 и хлебные крошки синхронны');

  console.log('— C4 Code');
  const cp = await ev(() => { const c = ZS.model.comps.find(x => x.kind === 'ctrl'), r = svgRct(), z = S.zoom; return { x: r.left + S.panX + (c.x + c.w / 2) * z, y: r.top + S.panY + (c.y + c.h / 2) * z }; });
  await page.mouse.move(cp.x, cp.y);
  for (let i = 0; i < 5; i++) { await page.mouse.wheel({ deltaY: -100 }); await sleep(40); }
  await sleep(150);
  st = await ev(() => ({ lvl: zsLevel(), comp: ZS.comp && ZS.model.byId[ZS.comp].name, code: document.querySelector('#zl-code [data-zs="code"]')?.textContent || '' }));
  ok(st.lvl === 4 && st.comp === 'TransfersController', 'колесо ↑ над компонентом → C4', st);
  ok(/class TransfersController/.test(st.code) && /POST|Mapping/.test(st.code), 'панель кода: класс и методы', st.code.slice(0, 120));
  for (let i = 0; i < 4; i++) { await page.mouse.wheel({ deltaY: 100 }); await sleep(40); }
  await sleep(150);
  ok(await ev(() => zsLevel() === 3), 'колесо ↓ → обратно на C3');
  for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: 100 }); await sleep(40); }
  await sleep(150);
  ok(await ev(() => zsLevel() === 2 && !ZS.svc && !document.querySelector('#zl-body [data-zs="frame"]')), 'колесо ↓ → C2, сервис свёрнут');

  console.log('— C1 Context');
  for (let i = 0; i < 10; i++) { await page.mouse.wheel({ deltaY: 100 }); await sleep(30); }
  await sleep(150);
  st = await ev(() => { const blocks = [...document.querySelectorAll('#block-layer > g')].length; return { lvl: zsLevel(), sys: !!document.querySelector('#block-layer [data-zs="system"]'), inner: ZS.sys && ZS.sys.inner.size, drawn: blocks, conns: zsConnFilter(S.conns).length }; });
  ok(st.lvl === 1 && st.sys, 'колесо ↓ → C1: рамка системы', st);
  ok(st.inner >= 15 && st.drawn < 12, 'внутренние контейнеры спрятаны в рамке', st);
  ok(st.conns > 0 && st.conns < 27, 'на C1 только внешние связи без дублей', st);
  ok(await ev(() => { zsGo(2); return zsLevel() === 2 && !ZS.l1; }), 'клавиша/кнопка 2 → обратно на C2');

  console.log('— Кнопки и клавиши');
  await bank(); await ev(() => { S.selected = 'b7'; });
  await page.keyboard.press('3'); await sleep(250);
  ok(await ev(() => zsLevel() === 3 && ZS.svc === 'b7'), 'клавиша 3 раскрывает выделенный сервис («Счета»)');
  await page.keyboard.press('4'); await sleep(250);
  ok(await ev(() => zsLevel() === 4 && !!ZS.comp), 'клавиша 4 → код компонента');
  await page.keyboard.press('Escape'); await sleep(250);
  ok(await ev(() => zsLevel() === 3), 'Esc на C4 → C3');
  await page.keyboard.press('Escape'); await sleep(250);
  ok(await ev(() => zsLevel() === 2), 'Esc на C3 → C2');
  await ev(() => zsBtn(2)); await sleep(150);
  ok(await ev(() => S.view === 'c4_level' && $('c4-l2').classList.contains('zs-strict')), 'C2 повторно → строгая C4-нотация');
  await ev(() => zsBtn(2)); await sleep(150);
  ok(await ev(() => S.view === 'workspace'), 'C2 ещё раз → обычный вид');

  console.log('— Ручные компоненты, миграция, импорт/экспорт');
  const nm = await ev(() => JSON.stringify([normalizeComponents(undefined), normalizeComponents('x'), normalizeComponents([null, { name: '' }, { name: 'A', kind: 'zzz', uses: ['nope'] }, { id: 'k', name: 'B', kind: 'repo', funcs: ['f()', 5] }])]));
  ok(nm === JSON.stringify([undefined, undefined, [{ id: 'cmp2', name: 'A', kind: 'uc' }, { id: 'k', name: 'B', kind: 'repo', funcs: ['f()'] }]]), 'normalizeComponents чистит мусор', nm);
  await bank();
  const rt = await ev(() => {
    const b = gb('b10');
    b.components = [{ id: 'm1', name: 'TransferApi', kind: 'ctrl', uses: ['m2'] }, { id: 'm2', name: 'TransferSaga', kind: 'uc', funcs: ['run(t)'], uses: ['m3'] }, { id: 'm3', name: 'LedgerDao', kind: 'repo' }];
    const data = JSON.parse(JSON.stringify({ blocks: S.blocks.map(b => ({ ...b })), conns: S.conns, scenarios: S.scenarios, meta: S.meta }));
    data.blocks.find(x => x.id === 'b7').components = 'garbage';
    importProjectData(data, 'test');
    const b2 = gb('b10'), b7 = gb('b7');
    zsGo(3, 'b10'); zsPrep();
    const m = ZS.model;
    return { kept: b2.components && b2.components.map(c => c.name).join(','), garbage: 'components' in b7, manual: !!m.manual, names: m.comps.map(c => c.name), allBound: S.conns.filter(c => c.from === 'b10' || c.to === 'b10').every(c => m.byId[m.bind[c.id]]) };
  });
  ok(rt.kept === 'TransferApi,TransferSaga,LedgerDao', 'export → import сохраняет components', rt);
  ok(!rt.garbage, 'мусорное components при импорте отброшено', rt);
  ok(rt.manual && rt.names.includes('TransferSaga') && rt.allBound, 'ручные компоненты используются, все связи привязаны', rt);
  const old = await ev(() => { importProjectData({ blocks: [{ id: 'b1', type: 'service', x: 0, y: 0 }, { id: 'b2', type: 'postgresql', x: 300, y: 0 }], conns: [{ id: 'c1', from: 'b1', to: 'b2' }] }, 'old'); zsGo(3, 'b1'); zsPrep(); return { lvl: zsLevel(), n: ZS.model && ZS.model.comps.length, has: 'components' in gb('b1') }; });
  ok(old.lvl === 3 && old.n >= 2 && !old.has, 'старый файл без components грузится, авто-компоненты строятся', old);
  const ed = await ev(() => { zsGo(2); zsEdMaterialize('b1'); const a = gb('b1').components.length; zsEdAdd('b1'); const b = gb('b1').components.length; zsEdReset('b1'); return { a, b, after: 'components' in gb('b1'), html: /zs-ed/.test($('sidebar-content')?.innerHTML || document.body.innerHTML) }; });
  ok(ed.a >= 2 && ed.b === ed.a + 1 && !ed.after, 'редактор: «вручную» → +компонент → «вернуть авто»', ed);

  console.log('— Симуляция на C3');
  await bank();
  await ev(() => { ZS.simHits = 0; zsGo(3, 'b10'); runSim(); });
  let done = false;
  for (let i = 0; i < 40 && !done; i++) { await sleep(150); done = await ev(() => (ZS.simHits || 0) > 0); }
  ok(done, 'запрос проходит внутреннюю цепочку раскрытого сервиса (_zsDone)');
  await ev(() => stopSim());

  console.log('— Связи не идут по телу окна C3 (порты на краю, обход)');
  for (const sid of ['b10', 'b7']) {
    await bank();
    const rr = await ev((sid) => {
      zsGo(3, sid); ZS.p = 1; ZS.bound = true; render(); zsPrep();
      const m = ZS.model, f = m.frame, inner = { x: f.x + 1, y: f.y + 1, w: f.w - 2, h: f.h - 2 };
      const bad = [], badComp = [];
      zsConnFilter(S.conns).forEach(c => {
        const r = route(c); if (!r || !r.pts) { bad.push(c.id + ':nopts'); return; }
        let pts = r.pts;
        if (zsTouches(c)) {
          if (c.to === sid) pts = pts.slice().reverse();
          const comp = m.byId[m.bind[c.id]];
          // внутренний участок — до первого выхода на край окна
          let k = pts.findIndex(p => p.x <= f.x + 0.5 || p.x >= f.x + f.w - 0.5 || p.y <= f.y + 0.5 || p.y >= f.y + f.h - 0.5);
          if (k < 0) { bad.push(c.id + ':noport'); return; }
          if (zsPathHit(pts.slice(k), inner)) bad.push(c.id + ':reenter');
          m.comps.filter(q => q !== comp).forEach(q => { if (zsPathHit(pts.slice(0, k + 1), zsInfl(q, -1))) badComp.push(c.id + '→' + q.name); });
        } else if (zsPathHit(pts, f)) bad.push(c.id + ':transit');
      });
      return { bad, badComp, n: zsConnFilter(S.conns).length };
    }, sid);
    ok(rr.bad.length === 0, `${sid}: ни одна связь не пересекает тело окна (транзит обходит, свои — через порт)`, rr);
    ok(rr.badComp.length === 0, `${sid}: путь от компонента до порта не задевает другие компоненты`, rr);
  }

  console.log('— C4: код в «ящике» окна, без перекрытий');
  await bank();
  const c4 = await ev(() => {
    zsGo(3, 'b10'); ZS.p = 1; ZS.bound = true; zsGo(4); ZS.pc = 1; render(); zsPrep();
    const m = ZS.model, D = m.drawer, f = m.frame;
    if (!D) return { none: true };
    const ov = m.comps.filter(q => !(q.x + q.w <= D.x || q.x >= D.x + D.w || q.y + q.h <= D.y || q.y >= D.y + D.h)).map(q => q.name);
    const inside = D.x >= f.x && D.x + D.w <= f.x + f.w && D.y + D.h <= f.y + f.h + 0.5;
    const neigh = S.blocks.filter(b => b.id !== 'b10').map(zsView).filter(o => !(o.x + bw(o) <= f.x || o.x >= f.x + f.w || o.y + bh(o) <= f.y || o.y >= f.y + f.h)).map(o => o.id);
    const dim = [...document.querySelectorAll('#zl-body [data-zs="comp"]')].filter(g => +g.getAttribute('opacity') < 0.6).length;
    return { ov, inside, neigh, dim, n: m.comps.length, code: !!document.querySelector('#zl-code [data-zs="code"]') };
  });
  ok(c4.code && c4.ov.length === 0 && c4.inside, 'ящик кода внутри окна и не перекрывает компоненты', c4);
  ok(c4.neigh && c4.neigh.length === 0, 'соседние блоки раздвинуты под выросшее окно', c4);
  ok(c4.dim === c4.n - 1, 'остальные компоненты приглушены', c4);

  console.log('— C1: читаемость и защита от перетаскивания');
  await bank();
  await ev(() => zsGo(1)); await sleep(350);
  const l1 = await ev(() => { render(); zsPrep();
    const s = ZS.sys, g = document.querySelector('#block-layer [data-zs="system"]'), title = g && g.querySelector('text');
    const out = [...s.pos.keys()].map(id => zsView(gb(id)));
    const ov = []; out.forEach((a, i) => out.slice(i + 1).forEach(b => { if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h + 18 && a.y + a.h + 18 > b.y) ov.push(a.id + '/' + b.id); }));
    const inBox = out.filter(o => o.x < s.box.x + s.box.w && o.x + o.w > s.box.x && o.y < s.box.y + s.box.h && o.y + o.h > s.box.y).map(o => o.id);
    const fs = title ? parseFloat(getComputedStyle(title).fontSize) * s.k * S.zoom : 0;
    const blk = document.querySelector('#block-layer g[transform*="scale"]');
    return { k: s.k, fs, ov, inBox, scaled: !!blk, n: out.length };
  });
  ok(l1.k > 1.5 && l1.fs >= 10, 'C1: шрифты растут обратно зуму — заголовок системы ≥10px на экране', l1);
  ok(l1.scaled && l1.ov.length === 0 && l1.inBox.length === 0, 'C1: внешние блоки увеличены, не налезают друг на друга и на рамку', l1);
  await ev(() => { window._zsXY = JSON.stringify(S.blocks.map(b => [b.x, b.y])); });
  const dp = await ev(() => { const id = [...ZS.sys.pos.keys()][0], o = zsView(gb(id)), r = svgRct(), z = S.zoom; return { id, x: r.left + S.panX + (o.x + o.w / 2) * z, y: r.top + S.panY + (o.y + o.h / 2) * z }; });
  await page.mouse.move(dp.x, dp.y); await page.mouse.down(); await page.mouse.move(dp.x + 80, dp.y + 60, { steps: 6 }); await page.mouse.up(); await sleep(80);
  const dr = await ev((id) => ({ same: JSON.stringify(S.blocks.map(b => [b.x, b.y])) === window._zsXY, sel: S.selected === id, toast: (document.getElementById('toast') || {}).textContent || '' }), dp.id);
  ok(dr.same, 'C1: перетаскивание не сдвигает реальные координаты', dr);
  ok(dr.sel && /C2/.test(dr.toast), 'C1: клик выбирает блок и показывает подсказку «двигать на C2»', dr);

  console.log('— Имя системы из шаблона и переименование в крошках');
  const sn = await ev(() => { S.blocks = []; S.conns = []; S.meta.systemName = t('default_project_name'); S.nid = 1; placeTemplate('bank'); const a = S.meta.systemName;
    placeTemplate('bank'); const b = S.meta.systemName; return { a, b, lbl: tplLabel(TMPLS.bank) }; });
  ok(sn.a && sn.a !== 'Новый проект' && sn.lbl.includes(sn.a), "имя системы = название шаблона вместо «Новый проект»", sn);
  ok(sn.b === sn.a, "повторная вставка шаблона имя не трогает", sn);
  await ev(() => { S.meta.systemName = 'Моя система'; S.blocks = []; S.conns = []; placeTemplate('bank'); });
  ok(await ev(() => S.meta.systemName === 'Моя система'), 'пользовательское имя шаблон не перезаписывает');
  await ev(() => zsGo(1)); await sleep(350);
  await page.click('#zs-crumbs .zs-ren'); await sleep(50);
  ok(await ev(() => !!document.querySelector('#zs-crumbs .zs-ren-in')), '✎ в крошках открывает поле ввода');
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.type('Платёжный хаб'); await page.keyboard.press('Enter'); await sleep(60);
  const rn = await ev(() => ({ n: S.meta.systemName, cr: $('zs-crumbs').textContent, svg: [...document.querySelectorAll('#block-layer [data-zs="system"] text')].map(x => x.textContent).join('|'), auto: (JSON.parse(localStorage.getItem('arch4_auto') || '{}').meta || {}).systemName }));
  ok(rn.n === 'Платёжный хаб' && /Платёжный хаб/.test(rn.cr) && /Платёжный хаб/.test(rn.svg) && rn.auto === 'Платёжный хаб', 'Enter сохраняет имя: крошки, рамка C1, автосейв', rn);
  await page.click('#zs-crumbs .zs-sys'); await sleep(50); await page.keyboard.type('xxx'); await page.keyboard.press('Escape'); await sleep(50);
  ok(await ev(() => S.meta.systemName === 'Платёжный хаб' && !document.querySelector('#zs-crumbs .zs-ren-in')), 'клик по имени на C1 → ввод; Esc отменяет');

  console.log('— C3 для инфраструктуры: Gateway, Kafka, БД');
  await bank();
  const inf = await ev(() => {
    const D = id => { const b = gb(id), m = zsModel(b); return { exp: zsExpandable(b), comps: m.comps.map(c => ({ k: c.kind, n: c.name, sub: zsOpsTxt(c) })), bind: m.bind, links: m.links.length,
      unbound: S.conns.filter(c => c.from === id || c.to === id).filter(c => !m.bind[c.id]).map(c => c.id) }; };
    const gw = D('b4'), kf = D('b12'), db = D('b9'), rd = D('b8');
    const m = zsModel(gb('b4')), af = m.comps.find(c => c.kind === 'flt' && /OAuth2/.test(c.name));
    const authBound = af && S.conns.some(c => c.from === 'b4' && c.to === 'b5' && m.bind[c.id] === af.id);
    const outs = S.conns.filter(c => c.from === 'b4' && gb(c.to)?.type !== 'auth').length;
    const km = zsModel(gb('b12')), grpTo = S.conns.filter(c => c.from === 'b12').map(c => gb(c.to)?.id);
    return { gw, kf, db, rd, authBound, outs, grpTo, kgrp: km.comps.filter(c => c.kind === 'grp').length };
  });
  const K = (o, k) => o.comps.filter(c => c.k === k);
  ok(inf.gw.exp && K(inf.gw, 'lsn').length === 1 && K(inf.gw, 'flt').some(c => /RateLimit/.test(c.n)) && K(inf.gw, 'flt').some(c => /TraceId/.test(c.n)), 'Gateway C3: listener + фильтры RateLimit/TraceId', inf.gw.comps);
  ok(inf.authBound, 'Gateway: фильтр OAuth2Introspection привязан к связи с Auth (по auth_mode)', inf.gw.bind);
  ok(K(inf.gw, 'rt').length === inf.outs && K(inf.gw, 'rt').every(c => /\/api\/v1\/.+→ lb:\/\//.test(c.sub)), 'Gateway: маршрут на каждый сервис с Path → lb://', K(inf.gw, 'rt'));
  ok(inf.gw.unbound.length === 0 && inf.kf.unbound.length === 0 && inf.db.unbound.length === 0, 'все связи gw/kafka/db привязаны к компонентам', [inf.gw.unbound, inf.kf.unbound, inf.db.unbound]);
  ok(K(inf.kf, 'topic').length === 1 && K(inf.kf, 'topic')[0].n === 'transfer-events' && K(inf.kf, 'part').length === 3, 'Kafka C3: топик transfer-events и 3 партиции', inf.kf.comps);
  ok(inf.kgrp === inf.grpTo.length && K(inf.kf, 'grp').every(c => /-group$/.test(c.n)), 'Kafka: consumer group на каждого потребителя', inf.kf.comps);
  ok(K(inf.db, 'pool').length === 1 && ['accounts', 'ledger_entries', 'transfers'].every(t => K(inf.db, 'tbl').some(c => c.n === t)), 'Ledger DB C3: пул + таблицы из схемы', inf.db.comps);
  ok(K(inf.db, 'idx').some(c => c.n === 'idx_ledger_account' && /ledger_entries\(/.test(c.sub)), 'Ledger DB: индексы из DDL', K(inf.db, 'idx'));
  ok(inf.rd.exp && K(inf.rd, 'key').some(c => /balance:/.test(c.n)), 'Redis C3: ключи из операций', inf.rd.comps);
  ok(await ev(() => !zsExpandable(gb('b2')) || BASE[gb('b2').type].cat === 'svc'), 'клиенты/внешние не раскрываются');

  for (const [sid, kind, re] of [['b9', 'tbl', /CREATE TABLE ledger_entries/], ['b4', 'rt', /predicates/], ['b12', 'topic', /kafka-topics.*--create/]]) {
    await bank();
    const r = await ev((sid, kind) => {
      zsGo(3, sid); ZS.p = 1; ZS.bound = true; render(); zsPrep();
      const want = kind === 'tbl' ? ZS.model.comps.find(c => c.name === 'ledger_entries') : ZS.model.comps.find(c => c.kind === kind);
      zsGo(4, want.id); ZS.pc = 1; render(); zsPrep();
      const m = ZS.model, Dr = m.drawer, f = m.frame;
      const ov = Dr ? m.comps.filter(q => !(q.x + q.w <= Dr.x || q.x >= Dr.x + Dr.w || q.y + q.h <= Dr.y || q.y >= Dr.y + Dr.h)).map(q => q.name) : ['nodrawer'];
      const txt = [...document.querySelectorAll('#zl-code text')].map(t => t.textContent).join('\n');
      const routes = [];
      zsConnFilter(S.conns).filter(c => !zsTouches(c)).forEach(c => { const rr = route(c); if (rr && rr.pts && zsPathHit(rr.pts, f)) routes.push(c.id); });
      return { ov, txt: txt.slice(0, 400), transit: routes };
    }, sid, kind);
    ok(r.ov.length === 0 && re.test(r.txt), `${sid} C4: конфиг/DDL в ящике без перекрытий`, r);
    ok(r.transit.length === 0, `${sid}: транзитные связи обходят окно`, r.transit);
  }

  console.log('— Производительность (24 блока)');
  await bank();
  const perf = await ev(() => { zsGo(3, 'b10'); ZS.p = 0.5; const t0 = performance.now(); for (let i = 0; i < 20; i++) { ZS.p = 0.3 + i * 0.035; render(); } return (performance.now() - t0) / 20; });
  ok(perf < 40, 'кадр анимации раскрытия < 40 мс (' + perf.toFixed(1) + ' мс)', perf);

  ok(errors.length === 0, 'нет JS-ошибок', errors.slice(0, 5));
  console.log(`\nИТОГО: ${pass}/${pass + fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
