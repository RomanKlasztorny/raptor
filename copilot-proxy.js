// Tiny Copilot proxy for RAPTOR — fixes Anti-API's hardcoded enterprise URL
// Usage: node copilot-proxy.js
// Listens on :8965, forwards to api.individual.githubcopilot.com

const http = require('http');
const https = require('https');

const GH_TOKEN = '';
const PORT = 8965;

let cachedToken = null;
let tokenExpiry = 0;

function getApiToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return Promise.resolve(cachedToken);
  }
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/copilot_internal/v2/token',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'raptor-proxy/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.token) { reject(new Error('No token: ' + data)); return; }
          cachedToken = json.token;
          tokenExpiry = (json.expires_at || (Date.now()/1000 + 1800)) * 1000;
          resolve(cachedToken);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/health') {
    res.writeHead(200, {'content-type':'application/json'});
    res.end(JSON.stringify({status:'ok'}));
    return;
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const apiToken = await getApiToken();
      const path = req.url === '/v1/chat/completions'
        ? '/chat/completions'
        : req.url.replace('/v1/', '/');

      const upstream = https.request({
        hostname: 'api.individual.githubcopilot.com',
        path,
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'User-Agent': 'anti-api/1.0',
          'Editor-Version': 'vscode/1.95.0',
          'Editor-Plugin-Version': 'copilot/1.300.0',
          'Copilot-Integration-Id': 'vscode-chat',
        }
      }, upRes => {
        res.writeHead(upRes.statusCode, {'content-type':'application/json'});
        upRes.pipe(res);
      });
      upstream.on('error', e => {
        console.error('upstream error:', e.message);
        res.writeHead(500, {'content-type':'application/json'});
        res.end(JSON.stringify({error:{message:e.message}}));
      });
      if (body) upstream.write(body);
      upstream.end();
    } catch(e) {
      console.error('proxy error:', e.message);
      res.writeHead(500, {'content-type':'application/json'});
      res.end(JSON.stringify({error:{message:e.message}}));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Copilot proxy listening on http://localhost:${PORT}`);
  console.log('  POST /v1/chat/completions -> api.individual.githubcopilot.com');
});
