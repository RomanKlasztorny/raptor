// SIM-TRACE — детальная трассировка запросов: SQL/Redis/брокер, hover-тултип, таймлайн
// Загружается ДО sim.js; использует gb, EL, BASE, baseLat из engine/catalog/core.

function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ── SQL-запрос по схеме БД и методу ──────────────────────────────
function genSQLQuery(dbBlock, verb, connMethod){
  const schema = dbBlock.dbSchema;
  const tables = schema?.tables || schema?.collections || [];
  const t0 = tables[0];
  const raw = dbBlock.customLabel || EL[dbBlock.type]?.lbl || 'records';
  const tableName = t0?.name || raw.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  const cols = (t0?.fields || []).slice(0, 6);
  const pkField = cols.find(f => /\bPK\b/i.test(f.constraints||''))?.name || 'id';
  const colNames = cols.length ? cols.map(f => f.name).join(', ') : '*';
  const uri = connMethod?.uri || '';
  const params = connMethod?.params || [];
  const bodyParams = params.filter(p => p.in === 'body' || !p.in);
  verb = verb || 'GET';

  if(verb === 'GET'){
    if(/:id|{id}|\$/.test(uri)){
      return `SELECT ${colNames}\nFROM ${tableName}\nWHERE ${pkField} = $1\nLIMIT 1`;
    }
    const filterCol = cols.find(f => /\bNN\b/i.test(f.constraints||'') && !/\bPK\b/i.test(f.constraints||''));
    if(filterCol){
      return `SELECT ${colNames}\nFROM ${tableName}\nWHERE ${filterCol.name} = $1\nORDER BY ${pkField} DESC\nLIMIT 20`;
    }
    return `SELECT ${colNames}\nFROM ${tableName}\nORDER BY ${pkField} DESC\nLIMIT 20`;
  }
  if(verb === 'POST'){
    const ins = bodyParams.length ? bodyParams.slice(0,5)
      : cols.filter(f => !/\bPK\b/i.test(f.constraints||'')).slice(0,4);
    if(!ins.length) return `INSERT INTO ${tableName} DEFAULT VALUES\nRETURNING ${pkField}`;
    const names = ins.map(p => p.name||p).join(', ');
    const vals  = ins.map((_,i) => `$${i+1}`).join(', ');
    return `INSERT INTO ${tableName} (${names})\nVALUES (${vals})\nRETURNING ${pkField}`;
  }
  if(verb === 'PUT' || verb === 'PATCH'){
    const upd = bodyParams.length ? bodyParams.slice(0,4)
      : cols.filter(f => !/\bPK\b/i.test(f.constraints||'')).slice(0,3);
    const sets = upd.length ? upd.map((p,i) => `${p.name||p} = $${i+1}`).join(',\n       ')
                            : 'updated_at = NOW()';
    const pNum = upd.length + 1;
    return `UPDATE ${tableName}\nSET ${sets}\nWHERE ${pkField} = $${pNum}\nRETURNING ${pkField}`;
  }
  if(verb === 'DELETE'){
    return `DELETE FROM ${tableName}\nWHERE ${pkField} = $1\nRETURNING ${pkField}`;
  }
  return `SELECT ${colNames}\nFROM ${tableName}\nLIMIT 1`;
}

// ── Redis-команда ─────────────────────────────────────────────────
function genRedisCmd(cacheBlock, verb, connMethod){
  const uri = connMethod?.uri || '';
  const parts = uri.split('/').filter(p => p && !p.startsWith(':') && !p.startsWith('{') && !/^v\d/.test(p));
  const resource = parts[parts.length-1] || 'item';
  const key = `${resource}:{id}`;
  const ttl = cacheBlock.settings?.ttl || 3600;
  verb = verb || 'GET';
  if(verb === 'GET')    return `GET ${key}`;
  if(verb === 'DELETE') return `DEL ${key}`;
  return `SET ${key} "{...json}" EX ${ttl}`;
}

// ── Команда брокера ───────────────────────────────────────────────
function genBrokerCmd(brokerBlock, verb, connMethod){
  const uri = connMethod?.uri || '';
  const parts = uri.split('/').filter(p => p && !p.startsWith(':') && !p.startsWith('{') && !/^v\d/.test(p));
  const resource = parts[parts.length-1] || 'events';
  const evMap = {POST:'created',PUT:'updated',PATCH:'updated',DELETE:'deleted',GET:'read'};
  const evType = evMap[verb||'POST'] || 'event';
  const topic = `${resource}.${evType}`;
  if(brokerBlock.type === 'kafka'){
    const numParts = brokerBlock.settings?.partitions || 3;
    return `produce(topic="${topic}"\n  key="{id}", partition=auto/${numParts}\n  payload={...event data})`;
  }
  if(brokerBlock.type === 'rabbitmq'){
    return `AMQP publish(exchange="${resource}"\n  routingKey="${evType}"\n  body={...event data})`;
  }
  return `publish(queue="${topic}"\n  msg={type:"${evType}", ...})`;
}

// ── Симулированный ответ ──────────────────────────────────────────
function genSimResponse(toBlock, verb, status){
  const cat = EL[toBlock?.type]?.cat;
  if(status === 'fail'){
    return ['500 Internal Server Error','503 Service Unavailable','408 Timeout','502 Bad Gateway'][Math.floor(Math.random()*4)];
  }
  if(cat === 'db'){
    const schema = toBlock.dbSchema;
    const t0 = schema?.tables?.[0];
    const pkField = t0?.fields?.find(f => /\bPK\b/i.test(f.constraints||''))?.name || 'id';
    switch(verb||'GET'){
      case 'GET':    return `200 · ${Math.floor(Math.random()*15)+1} row(s) fetched`;
      case 'POST':   return `201 Created · ${pkField}=${Math.floor(Math.random()*89999)+10000}`;
      case 'PUT':
      case 'PATCH':  return '200 · 1 row updated';
      case 'DELETE': return '204 · 1 row deleted';
      default:       return '200 OK';
    }
  }
  if(cat === 'cache'){
    if(verb === 'GET') return Math.random() < 0.72 ? 'HIT · {cached data}' : 'MISS → fallback to DB';
    return 'OK';
  }
  if(cat === 'broker' || cat === 'queue'){
    return `ACK · offset=${Math.floor(Math.random()*999)+1}`;
  }
  switch(verb||'GET'){
    case 'POST':   return '201 Created';
    case 'DELETE': return '204 No Content';
    case 'PUT':
    case 'PATCH':  return '200 OK (updated)';
    default:       return '200 OK';
  }
}

// ── Построить hop-event ───────────────────────────────────────────
function buildHopEvent(fromId, toId, conn, isResponse){
  const fromB = (typeof gb==='function') ? gb(fromId) : null;
  const toB   = (typeof gb==='function') ? gb(toId)   : null;
  if(!fromB || !toB) return null;

  const cat  = EL[toB.type]?.cat;
  const verb = conn?.method?.verb || (isResponse ? null : 'GET');
  const method = conn?.method ? (typeof fmtMethod==='function' ? fmtMethod(conn.method) : null) : null;
  const latMs  = +((toB.rt?.effLat || (typeof baseLat==='function' ? baseLat(toB) : 5))).toFixed(1);
  const status = toB.rt?.health === 'error' ? 'fail' : toB.rt?.health === 'warn' ? 'slow' : 'ok';

  let query = null, queryType = null, icon = '→';
  if(!isResponse){
    if(cat === 'db'){
      query = genSQLQuery(toB, verb, conn?.method);
      queryType = 'sql';  icon = '🗄';
    } else if(cat === 'cache'){
      query = genRedisCmd(toB, verb, conn?.method);
      queryType = 'redis'; icon = '⚡';
    } else if(cat === 'broker' || cat === 'queue'){
      query = genBrokerCmd(toB, verb, conn?.method);
      queryType = 'broker'; icon = '📨';
    }
  }

  const resp = conn?.method?.resp || conn?.respLabel ||
    (isResponse ? genSimResponse(fromB, verb, status) : null);

  return {
    fromId, toId,
    fromLabel: fromB.customLabel || EL[fromB.type]?.lbl || fromId,
    toLabel:   toB.customLabel   || EL[toB.type]?.lbl   || toId,
    method, verb, query, queryType, icon, latMs, status, resp, isResponse,
    t: Date.now(),
  };
}

// Вызывается из sim.js при каждом шаге запроса
function recordHop(req, fromId, toId, conn){
  if(!req.hopTrace) req.hopTrace = [];
  const ev = buildHopEvent(fromId, toId, conn, !!req.isResponse);
  if(ev) req.hopTrace.push(ev);
}

// ── HOVER-ТУЛТИП ─────────────────────────────────────────────────
let _htip = null;
function showHoverTip(reqId, cx, cy){
  if(!SIM || !SIM.reqs) return;
  const req = SIM.reqs[reqId]; if(!req) return;
  if(!_htip){
    _htip = document.createElement('div');
    _htip.id = 'sim-hover-tip';
    _htip.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:#1a1b26ee;backdrop-filter:blur(6px);border:1.5px solid #3d3f52;border-radius:10px;padding:9px 12px;font-size:11px;color:#c0caf5;max-width:270px;box-shadow:0 4px 22px #0009;line-height:1.55';
    document.body.appendChild(_htip);
  }
  const curId  = req.path[req.idx-1] || req.path[0];
  const nextId = req.path[req.idx];
  const curB   = (typeof gb==='function') ? gb(curId)  : null;
  const nextB  = (typeof gb==='function') && nextId ? gb(nextId) : null;
  const lastH  = req.hopTrace?.[req.hopTrace.length-1];
  const stClr  = req.dead ? '#f7768e' : req.color === '#e0af68' ? '#e0af68' : '#9ece6a';

  let h = `<div style="font-weight:700;color:#7aa2f7;margin-bottom:4px">${req.isResponse?'▶ Ответ':'● Запрос'} #${req.id.slice(1)}</div>`;
  h += `<div style="color:#9aa5ce;font-size:10.5px">📍 ${_esc(curB?.customLabel||EL[curB?.type]?.lbl||'?')} <span style="color:#4a4c6a">→</span> <b>${nextB?_esc(nextB.customLabel||EL[nextB.type]?.lbl):'конец'}</b></div>`;
  if(lastH?.method) h += `<div style="color:#7aa2f7;font-size:10.5px;margin-top:2px">⚙ ${_esc(lastH.method)}</div>`;
  if(lastH?.query){
    const firstLine = lastH.query.split('\n')[0];
    const preview   = firstLine.length > 46 ? firstLine.slice(0,46)+'…' : firstLine;
    const qc = lastH.queryType==='sql'?'#7dcfff':lastH.queryType==='redis'?'#9ece6a':'#bb9af7';
    h += `<div style="margin-top:4px;font-family:Consolas,monospace;font-size:10px;color:${qc};background:#11121a;padding:3px 7px;border-radius:5px;white-space:nowrap;overflow:hidden">${_esc(preview)}</div>`;
  }
  if(lastH?.resp){
    const rc = /^2/.test(lastH.resp)||lastH.resp==='OK'||/HIT|ACK/.test(lastH.resp) ? '#9ece6a' : '#f7768e';
    h += `<div style="margin-top:3px;font-size:10px;color:${rc}">↩ ${_esc(lastH.resp)}</div>`;
  }
  h += `<div style="margin-top:5px;display:flex;justify-content:space-between;align-items:center">`;
  h += `<span style="font-size:10.5px;color:${stClr}">${req.dead?'❌ Упадёт':req.color==='#e0af68'?'⚠ Медленно':'✓ Норма'}</span>`;
  h += `<span style="font-size:10.5px;color:#e0af68"><b>${req.accLat.toFixed(0)} мс</b></span>`;
  h += `</div>`;
  h += `<div style="font-size:9.5px;color:#4a4c6a;margin-top:3px;text-align:right">клик → полный трейс</div>`;

  _htip.innerHTML = h;
  _htip.style.display = 'block';
  const tw = _htip.offsetWidth, th2 = _htip.offsetHeight;
  const vw = window.innerWidth,  vh  = window.innerHeight;
  let lx = cx + 16, ly = cy - 14;
  if(lx + tw  > vw - 8) lx = cx - tw  - 12;
  if(ly + th2 > vh - 8) ly = cy - th2 - 8;
  _htip.style.left = lx + 'px';
  _htip.style.top  = ly + 'px';
}
function hideHoverTip(){ if(_htip) _htip.style.display = 'none'; }

// ── ТАЙМЛАЙН в модалке ────────────────────────────────────────────
function renderTraceTimeline(req){
  const trace = req.hopTrace || [];
  if(!trace.length) return '<div style="color:var(--txt2);font-size:11px;padding:8px 0">Трассировка пуста — запрос ещё не прошёл ни одного узла.</div>';

  const rows = trace.map((h, i) => {
    const isLast = i === trace.length - 1;
    const sc = h.status==='fail'?'#f7768e':h.status==='slow'?'#e0af68':'#9ece6a';
    const si = h.status==='fail'?'❌':h.status==='slow'?'⚠':'✓';

    let qHtml = '';
    if(h.query){
      const qc = h.queryType==='sql'?'#7dcfff':h.queryType==='redis'?'#9ece6a':'#bb9af7';
      const ql = h.queryType==='sql'?'SQL':h.queryType==='redis'?'Redis':'Broker';
      qHtml += `<div style="margin-top:5px;background:#11121a;border-radius:6px;padding:6px 9px;font-family:Consolas,monospace;font-size:10px;color:${qc};white-space:pre-wrap;border-left:2px solid ${qc}"><span style="opacity:.55;font-size:9.5px">${ql}:</span>\n${_esc(h.query)}</div>`;
    }
    if(h.resp){
      const rc = /^2/.test(h.resp)||h.resp==='OK'||/HIT|ACK/.test(h.resp) ? '#9ece6a'
                 : /^[45]/.test(h.resp) ? '#f7768e' : '#e0af68';
      qHtml += `<div style="margin-top:4px;font-size:10.5px;color:${rc}">↩ ${_esc(h.resp)}</div>`;
    }

    return `<div style="display:flex;gap:0">
      <div style="display:flex;flex-direction:column;align-items:center;margin-right:10px;padding-top:3px">
        <div style="width:11px;height:11px;border-radius:50%;background:${sc};box-shadow:0 0 6px ${sc}99;flex-shrink:0"></div>
        ${!isLast?`<div style="width:1.5px;flex:1;min-height:14px;background:#3d3f5266;margin-top:3px"></div>`:''}
      </div>
      <div style="flex:1;padding-bottom:${isLast?'0':'13px'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
          <div style="font-size:11px;font-weight:600;color:var(--txt)">${h.icon} ${_esc(h.fromLabel)} <span style="color:var(--txt2);font-weight:400">→</span> ${_esc(h.toLabel)}</div>
          <div style="font-size:10.5px;color:var(--txt2);white-space:nowrap;padding-top:1px">${h.latMs} мс</div>
        </div>
        ${h.method?`<div style="font-size:10.5px;color:var(--blue);margin-top:1px">⚙ ${_esc(h.method)}</div>`:''}
        ${qHtml}
        <div style="font-size:10px;color:${sc};margin-top:4px">${si} ${h.status==='fail'?'Ошибка':h.status==='slow'?'Медленно (деградация)':'OK'}</div>
      </div>
    </div>`;
  });

  const totalHops = req.path.length - 1;
  const pct = totalHops ? Math.round(trace.length / totalHops * 100) : 100;

  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #2a2b3d;font-size:10.5px">
    <span style="color:var(--txt2)">Шагов: <b style="color:var(--txt)">${trace.length}/${totalHops}</b></span>
    <span style="color:var(--txt2)">Накоплено: <b style="color:var(--yellow)">${req.accLat.toFixed(1)} мс</b></span>
    <span style="color:var(--txt2)">Прогресс: <b style="color:var(--blue)">${pct}%</b></span>
  </div>
  <div style="max-height:310px;overflow-y:auto;padding-right:3px">${rows.join('')}</div>`;
}
