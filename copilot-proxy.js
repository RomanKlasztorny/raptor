// Copilot proxy for RAPTOR AI
// Usage: GH_TOKEN=your_token node copilot-proxy.js
// Or:    set GH_TOKEN=your_token && node copilot-proxy.js   (Windows)
//
// Get your token: github.com → Settings → Developer settings → Personal access tokens
// Requires GitHub Copilot subscription (free plan works)

const http = require('http');
const https = require('https');

const GH_TOKEN = process.env.GH_TOKEN;
if (!GH_TOKEN) {
  console.error('Error: GH_TOKEN environment variable is not set.');
  console.error('Copy start-proxy.example.bat → start-proxy.bat, paste your token and run it.');
  process.exit(1);
}

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
          'User-Agent': 'raptor-proxy/1.0',
          'Editor-Version': 'vscode/1.95.0',
          'Editor-Plugin-Version': 'copilot/1.300.0',
          'Copilot-Integration-Id': 'vscode-chat',
        }
      }, upRes => {
        res.writeHead(upRes.statusCode, {'content-type':'application/json'});
        upRes.pipe(res);
      });
      upstream.on('error', e => {
        res.writeHead(500, {'content-type':'application/json'});
        res.end(JSON.stringify({error:{message:e.message}}));
      });
      if (body) upstream.write(body);
      upstream.end();
    } catch(e) {
      res.writeHead(500, {'content-type':'application/json'});
      res.end(JSON.stringify({error:{message:e.message}}));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`RAPTOR AI proxy listening on http://localhost:${PORT}`);
});
