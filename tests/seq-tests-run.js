// Прогон встроенных тестов Sequence-движка (seq-tests.js → seqTests.run()) в headless Chrome.
// Переменные: RAPTOR_URL, CHROME.
const path = require('path');
const req = m => { try { return require(m); } catch (e) { return require(path.join(process.env.BPMN_TOOLS || '/workspace/bpmn-tools', 'node_modules', m)); } };
const puppeteer = req('puppeteer-core');
const URL = process.env.RAPTOR_URL || 'http://127.0.0.1:5847/index.html';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const pg = await br.newPage(); const errs = [], logs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => logs.push(m.text()));
  await pg.goto(URL, { waitUntil: 'load' });
  const r = await pg.evaluate(() => seqTests.run());
  logs.filter(l => /✗|FAIL/.test(l)).forEach(l => console.log(l));
  console.log(`seq-tests: ${r.pass}/${r.total}` + (r.fail ? ` — ${r.fail} FAILED` : ''));
  if (errs.length) console.log('page errors:', errs);
  await br.close();
  process.exit(r.fail || errs.length || !r.total ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
