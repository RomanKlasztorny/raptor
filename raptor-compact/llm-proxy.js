// LLM proxy for RAPTOR — CORS + маршрут через апстрим-прокси (VPN) для api.openai.com / api.anthropic.com / api.groq.com
// Запуск:  node llm-proxy.js       (или start-proxy.bat)
// Слушает 127.0.0.1:8966, апстрим-прокси берётся из HTTPS_PROXY / HTTP_PROXY / LLM_UPSTREAM_PROXY (по умолчанию http://127.0.0.1:10809).
// Если апстрим-прокси не нужен — запусти:  set LLM_UPSTREAM_PROXY=  &&  node llm-proxy.js

const http  = require('http');
const https = require('https');
const tls   = require('tls');
const { URL } = require('url');

const PORT = 8966;
const RAW_PROXY = process.env.LLM_UPSTREAM_PROXY != null
  ? process.env.LLM_UPSTREAM_PROXY
  : (process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:10809');
const UPSTREAM = RAW_PROXY ? new URL(RAW_PROXY) : null;

const ROUTES = {
  openai:    'api.openai.com',
  anthropic: 'api.anthropic.com',
  groq:      'api.groq.com',
};

// TLS-сокет до targetHost:443 — напрямую или через CONNECT апстрим-прокси
function dial(targetHost, cb){
  if (!UPSTREAM){
    const s = tls.connect({ host: targetHost, port: 443, servername: targetHost }, () => cb(null, s));
    s.on('error', cb);
    return;
  }
  const req = http.request({
    host: UPSTREAM.hostname,
    port: UPSTREAM.port || 80,
    method: 'CONNECT',
    path: targetHost + ':443',
    headers: { Host: targetHost + ':443' },
    timeout: 15000,
  });
  req.on('connect', (res, socket) => {
    if (res.statusCode !== 200){ cb(new Error('апстрим-прокси CONNECT → HTTP ' + res.statusCode)); return; }
    const t = tls.connect({ socket, servername: targetHost }, () => cb(null, t));
    t.on('error', cb);
  });
  req.on('error', cb);
  req.on('timeout', () => req.destroy(new Error('таймаут апстрим-прокси')));
  req.end();
}

const server = http.createServer((cReq, cRes) => {
  cRes.setHeader('Access-Control-Allow-Origin', '*');
  cRes.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  cRes.setHeader('Access-Control-Allow-Headers', '*');
  cRes.setHeader('Access-Control-Max-Age', '86400');
  if (cReq.method === 'OPTIONS'){ cRes.writeHead(204); cRes.end(); return; }

  if (cReq.url === '/health' || cReq.url === '/'){
    cRes.writeHead(200, { 'content-type': 'application/json' });
    cRes.end(JSON.stringify({ status: 'ok', upstreamProxy: UPSTREAM ? UPSTREAM.origin : null, routes: Object.keys(ROUTES) }));
    return;
  }

  const m = cReq.url.match(/^\/(openai|anthropic|groq)(\/.*)$/);
  if (!m){ cRes.writeHead(404, { 'content-type': 'application/json' }); cRes.end(JSON.stringify({ error: { message: 'unknown route ' + cReq.url } })); return; }
  const targetHost = ROUTES[m[1]];
  const targetPath = m[2];

  dial(targetHost, (err, sock) => {
    if (err){
      cRes.writeHead(502, { 'content-type': 'application/json' });
      cRes.end(JSON.stringify({ error: { message: 'proxy: ' + err.message + (UPSTREAM ? ' (апстрим ' + UPSTREAM.origin + ')' : '') } }));
      return;
    }
    const headers = Object.assign({}, cReq.headers);
    headers.host = targetHost;
    delete headers['content-length'];
    delete headers['accept-encoding'];       // не хотим gzip между прокси и браузером
    delete headers['connection'];

    const up = https.request({
      host: targetHost, port: 443, method: cReq.method, path: targetPath, headers,
      createConnection: () => sock,
    }, uRes => {
      const h = Object.assign({}, uRes.headers);
      h['access-control-allow-origin'] = '*';
      delete h['content-security-policy'];
      cRes.writeHead(uRes.statusCode, h);
      uRes.pipe(cRes);
    });
    up.on('error', e => {
      if (!cRes.headersSent) cRes.writeHead(502, { 'content-type': 'application/json' });
      cRes.end(JSON.stringify({ error: { message: e.message } }));
    });
    cReq.pipe(up);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('LLM proxy: http://localhost:' + PORT);
  console.log('  апстрим-прокси: ' + (UPSTREAM ? UPSTREAM.origin : 'нет (прямое соединение)'));
  console.log('  маршруты: /openai/*  /anthropic/*  /groq/*');
});
