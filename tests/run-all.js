#!/usr/bin/env node
// Запуск всех тестов РАПТОРа одной командой:  node tests/run-all.js  (или npm test)
// Поднимает свой статический сервер на свободном порту (127.0.0.1), прогоняет наборы по очереди
// и печатает сводку. Код выхода 0 — всё зелёное.
// Нужно: Node 18+, Google Chrome/Chromium (CHROME=путь, по умолчанию /usr/bin/google-chrome),
// devDependencies из package.json (npm install): puppeteer-core, bpmn-moddle.
// Переменные: CHROME, SHOTS (каталог для скриншотов smoke/db-viz), ONLY=engine,smoke (подмножество).
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const SUITES = [
  { id: 'engine', title: 'Движок (engine-tests)', file: 'engine-tests.js', browser: false },
  { id: 'bpmn',   title: 'BPMN (bpmn-tests)',     file: 'bpmn-tests.js' },
  { id: 'seq',    title: 'Sequence (seqTests)',   file: 'seq-tests-run.js' },
  { id: 'dbviz',  title: 'Визуализация БД',       file: 'dbviz-tests.js' },
  { id: 'smoke',  title: 'Smoke (headless Chrome)', file: 'smoke-tests.js' },
  { id: 'c4zoom', title: 'C4 семантический зум',  file: 'c4zoom-tests.js' },
  { id: 'trainer', title: 'Тренажёр: эталон/наивное', file: 'trainer-tests.js' },
  { id: 'xss',    title: 'Stored XSS probe',      file: 'xss-probe.js' },
];

function serve() {
  const srv = http.createServer((rq, rs) => {
    let p = decodeURIComponent(rq.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.normalize(path.join(ROOT, p));
    if (!f.startsWith(ROOT) || f.includes(`${path.sep}.git`)) { rs.writeHead(403); return rs.end(); }
    fs.readFile(f, (e, data) => {
      if (e) { rs.writeHead(404); return rs.end('not found'); }
      rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      rs.end(data);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

function run(file, env) {
  return new Promise(res => {
    const t0 = Date.now(); let out = '';
    const ch = spawn(process.execPath, [path.join(__dirname, file)], { cwd: ROOT, env: { ...process.env, ...env } });
    ch.stdout.on('data', d => { out += d; process.stdout.write(d); });
    ch.stderr.on('data', d => { out += d; process.stderr.write(d); });
    ch.on('close', code => res({ code, ms: Date.now() - t0, out }));
  });
}

(async () => {
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  console.log(`Статический сервер: ${url}\n`);
  const res = [];
  for (const s of SUITES) {
    if (only.length && !only.includes(s.id)) continue;
    console.log(`\n══ ${s.title} ══`);
    const r = await run(s.file, { RAPTOR_URL: url });
    res.push({ ...s, ...r });
  }
  srv.close();
  console.log('\n══ Сводка ══');
  for (const r of res) {
    const sum = (r.out.match(/(?:ИТОГО|engine-tests|seq-tests|XSS fired)[^\n]*/g) || []).pop() || '';
    console.log(`${r.code === 0 ? '✓' : '✗'} ${r.title.padEnd(26)} ${(r.ms / 1000).toFixed(1).padStart(5)}s  ${sum.trim()}`);
  }
  const bad = res.filter(r => r.code !== 0);
  console.log(bad.length ? `\n${bad.length} набор(ов) упали.` : '\nВсе наборы зелёные.');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
