// Тренажёр: каждую задачу TASKS можно пройти эталонным решением и нельзя — наивным.
// Для всех задач: пустой холст → проверка НЕ проходит; эталон из fixtures/trainer-solutions.js → проходит;
// эталон задан ЯВНО (без @auto — игрок должен пройти, выставив числа сам); каждое naive-решение → не проходит. Задачи без эталона — ошибка (чтобы новые не терялись).
// Запуск: node tests/trainer-tests.js  (нужен статический сервер, см. tests/run-all.js)
const path = require('path'), fs = require('fs');
const req = m => { try { return require(m); } catch (e) { return require(path.join(process.env.BPMN_TOOLS || '/workspace/bpmn-tools', 'node_modules', m)); } };
const puppeteer = req('puppeteer-core');
const URL = process.env.RAPTOR_URL || 'http://127.0.0.1:5847/index.html';
const FIX = fs.readFileSync(path.join(__dirname, 'fixtures', 'trainer-solutions.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 500));
  const res = await page.evaluate(FIX => {
    (0, eval)(FIX.replace(/^const /gm, 'var '));
    const SCALE = { service: 'replicas', bff: 'replicas', auth: 'replicas', api_gw: 'instances', websocket_gw: 'instances', lb: 'instances',
      cassandra: 'nodes', clickhouse: 'shards', elasticsearch: 'shards', kafka: 'partitions', queue: 'workers', nats: 'nodes', mongodb: 'shard_count', redis: 'cluster_shards' };
    const maxOf = (t, k) => ((SETTINGS_DEF[t] || []).find(d => d.k === k) || {}).max || 1e9;
    const defOf = (t, k) => ((SETTINGS_DEF[t] || []).find(d => d.k === k) || {}).def;
    function build(spec, load) {
      const auto = /@auto\s*$/.test(spec); spec = spec.replace(/@auto\s*$/, '');
      const [bp, cp = ''] = spec.split('|');
      const blocks = [], conns = [];
      bp.split(';').map(s => s.trim()).filter(Boolean).forEach((s, i) => {
        const [type, id, ...rest] = s.split(/\s+/);
        if (!EL[type]) throw new Error('нет типа ' + type);
        const b = { id, type, x: 80 + (i % 5) * 180, y: 80 + Math.floor(i / 5) * 140, settings: {}, patterns: [] };
        rest.forEach(tok => {
          if (tok[0] === '+') return b.patterns.push(tok.slice(1));
          const [k, v] = tok.split('=');
          b.settings[k] = v === undefined ? true : v === 'true' ? true : v === 'false' ? false : (/^-?\d+(\.\d+)?$/.test(v) ? +v : v.replace(/~/g, ' '));
        });
        blocks.push(b);
      });
      cp.trim().split(/\s+/).filter(Boolean).forEach((l, i) => { const [f, t] = l.split('>'); conns.push({ id: 'c' + i, from: f, to: t }); });
      S.blocks = blocks; S.conns = conns; S.load = load;
      if (auto) for (let it = 0; it < 40; it++) {
        computeFlow(S.blocks, S.conns, S.load); let ch = false;
        S.blocks.forEach(b => {
          const k = SCALE[b.type]; if (!k || (b.rt.health !== 'error' && !(b.rt.rho >= 0.6))) return;
          if (b.type === 'mongodb') b.settings.sharding = true;
          if (b.type === 'redis') b.settings.cluster = true;
          const cur = b.settings[k] ?? defOf(b.type, k) ?? 1, nv = Math.min(maxOf(b.type, k), Math.ceil(cur * 1.5) + 1);
          if (nv !== cur) { b.settings[k] = nv; ch = true; }
        });
        if (!ch) break;
      }
    }
    const run = (task, spec) => { try { build(spec, task.load ?? 1); return task.check(TH()); } catch (e) { return { ok: 'EXC', msg: e.message }; } };
    const out = [];
    TASKS.forEach((task, i) => {
      S.blocks = []; S.conns = []; S.load = task.load ?? 1;
      let r; try { r = task.check(TH()); } catch (e) { r = { ok: 'EXC', msg: e.message }; }
      out.push({ i, t: task.t, kind: 'empty', ok: r.ok === false, msg: r.msg });
      const sol = TRAINER_SOLUTIONS[task.t];
      if (!sol) { out.push({ i, t: task.t, kind: 'ref', ok: false, msg: 'нет эталонного решения' }); return; }
      if (/@auto/.test(sol.ref)) out.push({ i, t: task.t, kind: 'ref-explicit', ok: false, msg: 'эталон должен быть явным (без @auto) — игрок проходит без автомасштаба' });
      r = run(task, sol.ref); out.push({ i, t: task.t, kind: 'ref', ok: r.ok === true, msg: r.msg, over: r.ok === true ? '' : H_over() });
      (sol.naive || []).forEach((n, j) => { r = run(task, n); out.push({ i, t: task.t, kind: 'naive' + j, ok: r.ok === false, msg: r.msg }); });
    });
    function H_over() { return S.blocks.filter(b => b.rt && b.rt.health === 'error').map(b => b.type + ':' + b.id + ' ρ' + (b.rt.rho || 0).toFixed(2)).join(', '); }
    const extra = Object.keys(TRAINER_SOLUTIONS).filter(k => !TASKS.some(t => t.t === k));
    S.blocks = []; S.conns = [];
    return { out, extra, n: TASKS.length };
  }, FIX);
  console.log(`— ${res.n} задач тренажёра`);
  res.out.forEach(o => ok(o.ok, `#${o.i} «${o.t}» ${o.kind}`, o.ok ? undefined : (o.msg || '') + (o.over ? ' | горят: ' + o.over : '')));
  ok(!res.extra.length, 'в fixtures нет решений к несуществующим задачам', res.extra);
  ok(!errors.length, 'без JS-ошибок', errors);
  const naive = res.out.filter(o => o.kind.startsWith('naive')).length;
  console.log(`  эталонов: ${res.out.filter(o => o.kind === 'ref').length}, наивных решений: ${naive}`);
  console.log(`\nИТОГО trainer: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
