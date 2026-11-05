// SIM-PATTERNS — поведение «кружков» при отработке паттернов устойчивости и Kafka
// Подключается после sim.js. Хуки из sim.js: simPatReset, simPatTick, simPatFate (из decideFate),
// simPatArrive (начало onArrive), simPatStop (достигнут req.stopAt), simPatRevDone (обратный ход),
// simPatKafka (после tickBrokerConsumers). Модель/цифры — engine.js / kafka-engine.js, здесь только «как выглядит».

const PAT_COL = {
  rl:'#8b8fa8', cb:'#ff9e64', probe:'#bb9af7', retry:'#e0af68', timeout:'#f7768e', bulk:'#2ac3de',
  fallback:'#73daca', saga:'#ff9e64', hit:'#9ece6a', miss:'#e0af68', kafka:'#bb9af7', dlq:'#787c99', fail:'#f7768e'
};
const PSIM = { cb:{}, fx:[], parked:{}, kOv:{}, lastGhost:{}, lastLbl:{} };
const PSIM_MAX_PARKED = 220;

function simPatReset(){
  PSIM.cb = {}; PSIM.fx = []; PSIM.parked = {}; PSIM.kOv = {}; PSIM.lastGhost = {}; PSIM.lastLbl = {};
}

// ── утилиты ───────────────────────────────────────────────────
function _psvg(tag, attrs){ const e = document.createElementNS(NS, tag); for(const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function _player(){ return $('anim-layer'); }
function _pAt(pts, t){
  t = Math.max(0, Math.min(1, t)); const n = pts.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1), fr = t * n - i, a = pts[i], b = pts[i + 1];
  return { x:a.x + (b.x - a.x) * fr, y:a.y + (b.y - a.y) * fr };
}
function _pBlockC(id){ const b = gb(id); return b ? { x:b.x + bw(b) / 2, y:b.y + bh(b) / 2 } : null; }
function _pLbl(id){ const b = gb(id); return b ? (b.customLabel || EL[b.type]?.lbl || id) : id; }
function fxAdd(dur, step, done){ PSIM.fx.push({ t:0, dur, step, done }); }
function fxLabel(x, y, text, col, dur, key){
  if(key){ if(PSIM.lastLbl[key] && SIM.time - PSIM.lastLbl[key] < 700) return; PSIM.lastLbl[key] = SIM.time; }
  const e = _psvg('text', { x, y, 'text-anchor':'middle', 'font-size':'10', 'font-weight':'700', fill:col, stroke:'#ffffff', 'stroke-width':'3', 'pointer-events':'none' });
  e.style.paintOrder = 'stroke'; e.textContent = text; _player().appendChild(e);
  fxAdd(dur || 1100, fr => { e.setAttribute('y', (y - 14 * fr).toFixed(1)); e.style.opacity = String(1 - fr * fr); }, () => e.remove());
}
function fxRing(x, y, col, r0, r1, dur){
  const e = _psvg('circle', { cx:x, cy:y, r:r0, fill:'none', stroke:col, 'stroke-width':'2', 'pointer-events':'none' });
  _player().appendChild(e);
  fxAdd(dur || 500, fr => { e.setAttribute('r', (r0 + (r1 - r0) * fr).toFixed(1)); e.style.opacity = String(1 - fr); }, () => e.remove());
}
function _pPaint(req, col){
  req.color = col; const d = SIM.dots[req.id];
  if(d){ d.style.fill = col; d.style.filter = `drop-shadow(0 0 5px ${col})`; }
}
function _pPos(req){ return req.pts ? _pAt(req.pts, req.rev ? 1 - req.t : req.t) : _pBlockC(req.path[req.idx - 1]); }
function _pKill(req){
  const d = SIM.dots[req.id]; if(d) d.remove();
  delete SIM.dots[req.id]; delete SIM.reqs[req.id]; delete PSIM.parked[req.id];
}
function _patNote(req, text){
  const h = req.hopTrace && req.hopTrace[req.hopTrace.length - 1]; if(!h) return;
  (h.pats || (h.pats = [])).push(text);
}
function _pBaseColor(req){
  if(req.baseColor) return req.baseColor;
  const sc = req.scenarioId && (S.scenarios || []).find(s => s.id === req.scenarioId);
  return (req.baseColor = (sc && sc.color) || '#7aa2f7');
}
// новый элемент-«кружок» другой формы с теми же обработчиками
function _pSwap(req, tag){
  const old = SIM.dots[req.id];
  const el = tag === 'rect' ? _psvg('rect', { width:7, height:7, rx:1.5, x:-200, y:-200 }) : _psvg('circle', { r:'6.5', cx:'-200', cy:'-200' });
  el.style.fill = req.color; el.style.filter = `drop-shadow(0 0 4px ${req.color})`; el.style.cursor = 'pointer';
  el.addEventListener('click', e => { e.stopPropagation(); if(SIM.reqs[req.id]) showDotInfo(req.id); });
  el.addEventListener('mousemove', e => showHoverTip(req.id, e.clientX, e.clientY));
  el.addEventListener('mouseleave', () => hideHoverTip());
  if(old && old.parentNode) old.replaceWith(el); else _player().appendChild(el);
  SIM.dots[req.id] = el; return el;
}
function _pSetXY(el, x, y){
  if(!el) return;
  if(el.tagName === 'rect'){ el.setAttribute('x', (x - 3.5).toFixed(1)); el.setAttribute('y', (y - 3.5).toFixed(1)); }
  else if(el.tagName === 'circle'){ el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', y.toFixed(1)); }
  else el.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
}

// ── тик: эффекты, backoff ретраев ──────────────────────────────
function simPatTick(dt){
  for(let i = PSIM.fx.length - 1; i >= 0; i--){
    const f = PSIM.fx[i]; f.t += dt; const fr = Math.min(1, f.t / f.dur);
    try { f.step && f.step(fr); } catch(e){}
    if(fr >= 1){ PSIM.fx.splice(i, 1); try { f.done && f.done(); } catch(e){} }
  }
  Object.values(SIM.reqs).forEach(req => {
    if(req.status !== 'backoff') return;
    req.waitT -= dt;
    const d = SIM.dots[req.id]; if(d) d.style.opacity = String(0.35 + 0.65 * Math.abs(Math.sin(req.waitT / 110)));
    if(req.waitT <= 0) _pRetryGo(req);
  });
}

// ── Судьба хопа A→B с учётом паттернов (вызывается в конце decideFate) ──
function simPatFate(req, toId){
  if(req.isResponse) return;
  const fromId = req.path[req.idx - 1], A = gb(fromId), B = gb(toId);
  if(!A || !B) return;
  _pBaseColor(req);
  // узел «лежит» (хаос b.down): почти все вызовы падают, независимо от ρ
  if(B.down && !req.dead && Math.random() < 0.9){ req.dead = true; req.deadAt = toId; _pPaint(req, PAT_COL.fail); }
  req.pat = null; req.stopAt = null; req.rev = false;
  const dead = !!(req.dead && req.deadAt === toId);
  const bCat = BASE[B.type]?.cat;

  // 🗃 Cache-aside: сначала в кэш; hit — короткий путь назад, miss — дальше в БД
  if(bCat === 'db' && hasPat(A, 'cache_aside') && !req.cacheTried){
    const cc = S.conns.find(c => c.from === fromId && BASE[gb(c.to)?.type]?.cat === 'cache' && !req.path.includes(c.to));
    const pts = cc && edgePts(cc);
    if(pts){
      req.pat = { type:'cache', cache:cc.to, db:toId };
      if(dead){ req.dead = false; req.deadAt = null; }
      req.path.splice(req.idx, 0, cc.to);
      req.pts = pts; req.connId = cc.id; setSpeed(req, cc.to); _pPaint(req, _pBaseColor(req));
      return;
    }
  }
  // 🗃 Путь сразу в кэш (cache-aside у вызывающего): hit — ответ из кэша, miss — назад и в БД
  if(bCat === 'cache' && hasPat(A, 'cache_aside') && !req.cacheTried){
    const dc = S.conns.find(c => c.from === fromId && BASE[gb(c.to)?.type]?.cat === 'db' && !req.path.includes(c.to));
    if(dc){ req.pat = { type:'cache', cache:toId, db:dc.to, direct:true }; if(dead){ req.dead = false; req.deadAt = null; _pPaint(req, _pBaseColor(req)); } return; }
  }
  // 🚦 Rate limit на входе B: лишнее отбивается 429
  const rl = (B.rt && B.rt.rlDrop) || 0;
  if(rl > 0 && Math.random() < rl){
    req.pat = { type:'rl', at:toId }; req.stopAt = 0.8; req.dead = false; req.deadAt = null;
    _pPaint(req, PAT_COL.rl); return;
  }
  // ⚡ Circuit breaker у вызывающего A на связь A→B
  if(hasPat(A, 'circuit_breaker')){
    const k = fromId + '>' + toId;
    const cb = PSIM.cb[k] || (PSIM.cb[k] = { state:'closed', fails:[], until:0, probe:null });
    if(cb.state === 'open' && SIM.time >= cb.until){ cb.state = 'half'; cb.probe = null; }
    const probeBusy = cb.state === 'half' && cb.probe && (SIM.reqs[cb.probe] || PSIM.parked[cb.probe]);
    if(cb.state === 'open' || probeBusy){
      req.pat = { type:'cb_open', key:k }; req.stopAt = 0.3; req.dead = false; req.deadAt = null;
      _pPaint(req, PAT_COL.cb); return;
    }
    if(cb.state === 'half'){
      cb.probe = req.id; req.pat = { type:'cb_probe', key:k, dead };
      _pPaint(req, PAT_COL.probe);
      const d = SIM.dots[req.id]; if(d){ d.setAttribute('stroke', '#bb9af7'); d.setAttribute('stroke-width', '2'); d.setAttribute('stroke-dasharray', '3,2'); }
      req.probe = true; return;
    }
    req.cbKey = k;
  }
  if(!dead) return;
  // Сбой на хопе — как его отработает вызывающий
  if(hasPat(A, 'retry') && (req.retries || 0) < 3){ req.pat = { type:'retry' }; return; }
  if(hasPat(A, 'timeout') || hasPat(B, 'timeout')){ req.pat = { type:'timeout' }; req.stopAt = 0.7; _pPaint(req, _pBaseColor(req)); return; }
  if(hasPat(A, 'bulkhead')){ req.pat = { type:'bulkhead' }; req.stopAt = 0.16; _pPaint(req, _pBaseColor(req)); return; }
  req.pat = { type:'fail' };
}

// ── Достигнута точка остановки на ребре ───────────────────────
function simPatStop(req){
  const pat = req.pat || {}, at = req.stopAt; req.stopAt = null;
  const p = _pAt(req.pts, at), fromId = req.path[req.idx - 1], toId = req.path[req.idx];
  if(pat.type === 'rl'){
    fxLabel(p.x, p.y - 10, '429 Too Many', PAT_COL.rl, 900, 'rl' + toId);
    _patNote(req, `🚦 rate limit «${_pLbl(toId)}»: 429, запрос отбит на входе`);
    _pBounce(req, at, 0.5, () => _pAfterFail(req, fromId, 'rl')); return;
  }
  if(pat.type === 'cb_open'){
    fxLabel(p.x, p.y - 10, '⚡ CB OPEN', PAT_COL.cb, 900, 'cb' + pat.key);
    _patNote(req, `⚡ circuit breaker открыт: «${_pLbl(toId)}» не вызывается (fail-fast)`);
    _pBounce(req, at, 0, () => _pAfterFail(req, fromId, 'cb')); return;
  }
  if(pat.type === 'timeout'){
    _pPaint(req, PAT_COL.timeout); fxRing(p.x, p.y, PAT_COL.timeout, 6, 26, 500);
    fxLabel(p.x, p.y - 12, '⏱ timeout', PAT_COL.timeout, 1000, 'to' + toId);
    _patNote(req, `⏱ timeout: «${_pLbl(toId)}» не ответил вовремя — вызов оборван`);
    _pVanish(req, () => _pAfterFail(req, fromId, 'timeout')); return;
  }
  if(pat.type === 'bulkhead'){
    _patNote(req, `🛡 bulkhead: пул к «${_pLbl(toId)}» исчерпан — отказ сразу, остальные пулы живы`);
    fxLabel(p.x, p.y - 12, '◆ pool full', PAT_COL.bulk, 1000, 'bh' + fromId);
    _pDiamond(req, p, () => _pAfterFail(req, fromId, 'bulkhead')); return;
  }
}

// ── Обратный ход по ребру завершён ─────────────────────────────
function simPatRevDone(req){
  const pat = req.pat || {};
  req.rev = false; req.t = 0;
  if(pat.type === 'retry'){
    req.retries = (req.retries || 0) + 1;
    req.status = 'backoff'; req.waitT = 260 * Math.pow(2, req.retries - 1);
    const c = _pBlockC(req.path[req.idx - 1]);
    if(c) fxLabel(c.x, c.y - 22, `↻ ${req.retries}/3 · backoff ${Math.round(req.waitT)}ms`, PAT_COL.retry, Math.max(700, req.waitT), 'rt' + req.id + req.retries);
    const d = SIM.dots[req.id]; if(d && c) _pSetXY(d, c.x, c.y);
    return;
  }
  if(pat.type === 'cache'){
    // miss: вернулись в сервис → идём в БД
    const A = req.path[req.idx - 1];
    if(pat.direct){ req.path[req.idx] = pat.db; req.path.length = req.idx + 1; } else req.path.splice(req.idx, 1);
    const db = req.path[req.idx];
    const conn = S.conns.find(c => c.from === A && c.to === db);
    if(!conn){ _pKill(req); return; }
    req.cacheTried = true; req.connId = conn.id; req.pts = edgePts(conn); req.status = 'flying';
    req.dead = false; req.deadAt = null; req.color = _pBaseColor(req);
    setSpeed(req, db); decideFate(req, db);
    recordHop(req, A, db, conn); _patNote(req, '🗃 cache miss → читаем из БД');
    return;
  }
  _pKill(req);
}

function _pRetryGo(req){
  const toId = req.path[req.idx];
  req.status = 'flying'; req.t = 0; req.rev = false;
  req.dead = false; req.deadAt = null; req.color = _pBaseColor(req);
  const d = SIM.dots[req.id]; if(d){ d.style.opacity = '1'; }
  setSpeed(req, toId); decideFate(req, toId);
  if(!req.dead && !(req.pat && req.pat.type !== 'retry')) _pPaint(req, PAT_COL.retry);  // повторная попытка — оранжевая
  _patNote(req, `↻ retry #${req.retries} → «${_pLbl(toId)}»`);
}

// ── Прибытие в узел (начало onArrive) — true = обработано здесь ──
function simPatArrive(req){
  const at = req.path[req.idx], fromId = req.path[req.idx - 1];
  const B = gb(at);
  if(req.isResponse){
    if(req.comp && B){ flash(at, PAT_COL.saga); const c = _pBlockC(at); if(c) fxLabel(c.x, c.y - 18, '↶ compensate', PAT_COL.saga, 900); }
    return false;
  }
  const pat = req.pat || {};
  const c = _pBlockC(at);
  // CB: учёт результата
  const cbRec = (k, ok) => {
    const cb = PSIM.cb[k]; if(!cb) return;
    if(ok){ cb.fails = []; return; }
    cb.fails = cb.fails.filter(t => SIM.time - t < 4000); cb.fails.push(SIM.time);
    if(cb.fails.length >= 3){ cb.state = 'open'; cb.until = SIM.time + 2800; cb.fails = []; if(c) fxLabel(c.x, c.y - 24, '⚡ CB → OPEN', PAT_COL.cb, 1200); }
  };
  if(pat.type === 'cb_probe'){
    const cb = PSIM.cb[pat.key];
    if(cb){
      if(req.dead && req.deadAt === at){ cb.state = 'open'; cb.until = SIM.time + 2800; if(c) fxLabel(c.x, c.y - 24, 'probe ✕ → OPEN', PAT_COL.cb, 1100); _patNote(req, '⚡ half-open: пробный запрос упал → снова OPEN'); }
      else { cb.state = 'closed'; cb.fails = []; if(c) fxLabel(c.x, c.y - 24, 'probe ✓ → CLOSED', '#9ece6a', 1100); _patNote(req, '⚡ half-open: пробный запрос прошёл → CLOSED'); }
      cb.probe = null;
    }
    const d = SIM.dots[req.id]; if(d){ d.removeAttribute('stroke'); d.removeAttribute('stroke-dasharray'); }
    req.probe = false;
  } else if(req.cbKey && req.cbKey === fromId + '>' + at){
    cbRec(req.cbKey, !(req.dead && req.deadAt === at));
  }
  // 🗃 Кэш
  if(pat.type === 'cache' && at === pat.cache){
    const hr = +((B && B.settings && B.settings.hit_ratio) || 80);
    if(Math.random() * 100 < hr){
      if(c) fxLabel(c.x, c.y - 18, 'HIT', PAT_COL.hit, 800, 'hit' + at);
      flash(at, PAT_COL.hit); _patNote(req, '🗃 cache hit — ответ из кэша, БД не трогаем');
      spawnResponse(req.path.slice(0, req.idx + 1), PAT_COL.hit, req.trace ? { run:req.run } : null);
      _pKill(req); return true;
    }
    if(c) fxLabel(c.x, c.y - 18, 'MISS', PAT_COL.miss, 800, 'miss' + at);
    _patNote(req, '🗃 cache miss');
    _pPaint(req, PAT_COL.miss);
    req.rev = true; req.t = 0; req.status = 'flying';
    return true;
  }
  // ↻ Retry: упали на B — шарик возвращается и повторяет с backoff
  if(pat.type === 'retry' && req.dead && req.deadAt === at){
    if(c){ fxRing(c.x, c.y, PAT_COL.fail, 8, 28, 450); }
    _patNote(req, `✕ «${_pLbl(at)}» ответил ошибкой`);
    _pPaint(req, PAT_COL.retry);
    req.rev = true; req.t = 0; req.status = 'flying';
    return true;
  }
  // ✕ Прочие падения: красная вспышка в B + fallback/компенсация у вызывающего
  if(req.dead && req.deadAt === at){
    if(c){ fxRing(c.x, c.y, PAT_COL.fail, 8, 30, 500); fxLabel(c.x, c.y - 18, '✕ 5xx', PAT_COL.fail, 800, 'f' + at); }
    _patNote(req, `✕ «${_pLbl(at)}»: ошибка`);
    _pAfterFail(req, fromId, 'fail');
    return true;
  }
  // 📨 Kafka: шарик паркуется в партиции, пока его не заберёт консьюмер
  if(B && B.type === 'kafka' && req.kDone !== at && typeof kafkaProduce === 'function'){
    _kPark(req, at); return true;
  }
  return false;
}

// ── после отказа у вызывающего: fallback / saga-компенсация ────
function _pAfterFail(req, atId, kind){
  const idx = req.path.indexOf(atId);
  const A = gb(atId);
  const run = req.trace ? { run:req.run } : null;
  if(A && hasPat(A, 'fallback')){
    const c = _pBlockC(atId);
    if(c) fxLabel(c.x, c.y - 26, '🪂 fallback', PAT_COL.fallback, 1000, 'fb' + atId);
    if(idx > 0){
      spawnResponse(req.path.slice(0, idx + 1), PAT_COL.fallback, run);
      const r = SIM.reqs['r' + (_rId - 1)], d = r && SIM.dots[r.id];
      if(d){ d.style.fill = PAT_COL.fallback + '55'; d.setAttribute('stroke', PAT_COL.fallback); d.setAttribute('stroke-width', '1.5'); d.setAttribute('stroke-dasharray', '3,2'); r.fb = true; }
    }
    _pKill(req); return;
  }
  // ↶ Saga: откат шагов после оркестратора
  let s = -1;
  for(let i = Math.min(idx, req.path.length - 1); i >= 0; i--){ if(hasPat(gb(req.path[i]), 'saga')){ s = i; break; } }
  if(s >= 0){
    if(idx > s){
      spawnResponse(req.path.slice(s, idx + 1), PAT_COL.saga, run);
      const r = SIM.reqs['r' + (_rId - 1)], d = r && SIM.dots[r.id];
      if(r){ r.comp = true; }
      if(d){ d.style.fill = 'none'; d.setAttribute('stroke', PAT_COL.saga); d.setAttribute('stroke-width', '2'); }
      flash(atId, PAT_COL.saga);
    } else { const c = _pBlockC(atId); if(c) fxLabel(c.x, c.y - 26, '↶ saga: компенсация', PAT_COL.saga, 1000, 'sg' + atId); flash(atId, PAT_COL.saga); }
  }
  _pKill(req);
}

// ── анимации завершения ───────────────────────────────────────
function _pBounce(req, t0, t1, done){
  req.status = 'fx'; const d = SIM.dots[req.id], pts = req.pts;
  fxAdd(450, fr => { const p = _pAt(pts, t0 + (t1 - t0) * fr); _pSetXY(d, p.x, p.y); if(d) d.style.opacity = String(1 - 0.85 * fr); }, () => done && done());
}
function _pVanish(req, done){
  req.status = 'fx'; const d = SIM.dots[req.id];
  fxAdd(320, fr => { if(d){ d.setAttribute('r', (6.5 + 5 * fr).toFixed(1)); d.style.opacity = String(1 - fr); } }, () => done && done());
}
function _pDiamond(req, p, done){
  req.status = 'fx';
  const d = SIM.dots[req.id]; if(d) d.style.opacity = '0';
  const g = _psvg('polygon', { points:'0,-7 7,0 0,7 -7,0', transform:`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`, 'pointer-events':'none' });
  g.style.fill = PAT_COL.bulk; g.style.filter = `drop-shadow(0 0 5px ${PAT_COL.bulk})`; _player().appendChild(g);
  fxAdd(700, fr => { g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${(1 - 0.6 * fr).toFixed(2)})`); g.style.opacity = String(1 - fr * fr); }, () => { g.remove(); done && done(); });
}

// ══════════════════════════════════════════════════════════════
// 📨 KAFKA: парковка шариков в партициях и выдача консьюмерам
// ══════════════════════════════════════════════════════════════
function _kPark(req, K){
  const r = brokerProduce(K, { value:{ req:req.id }, reqId:req.id });   // без ключа — работает key_strategy брокера
  const c = _pBlockC(K);
  if(!r || r.ack === false){
    if(c){ fxRing(c.x, c.y, PAT_COL.fail, 8, 30, 500); fxLabel(c.x, c.y - 20, '⛔ ' + ((r && r.error) || 'reject'), PAT_COL.fail, 1100, 'kr' + K); }
    _patNote(req, `⛔ Kafka отклонила запись: ${(r && r.error) || 'reject'}`);
    _pAfterFail(req, req.path[req.idx - 1], 'kafka'); return;
  }
  if(r.lost){
    if(c) fxLabel(c.x, c.y - 20, 'acks=0: потеряно', PAT_COL.fail, 1000, 'kl' + K);
    _pKill(req); return;
  }
  const next = req.path[req.idx + 1], nb = next && gb(next);
  req.status = 'parked';
  req.kafka = { K, part:r.partition, retry:false, gidNext: nb ? kGroupId(nb) : null, since:SIM.time, state:BROKER_STATE[K] };
  _patNote(req, `📨 в партиции P${r.partition} (offset ${r.offset}${r.key ? ', key ' + r.key : ''}) — ждёт консьюмера${nb ? ' «' + _pLbl(next) + '»' : ''}`);
  delete SIM.reqs[req.id]; PSIM.parked[req.id] = req;
  _pPaint(req, _pBaseColor(req));
  _pSwap(req, 'rect');
  // лимит видимых «припаркованных»
  const ids = Object.keys(PSIM.parked);
  if(ids.length > PSIM_MAX_PARKED){ const old = PSIM.parked[ids[0]]; const k0 = old.kafka.K; _pKill(old); _kLayout(k0); }
  _kLayout(K);
}

function _kResume(req){
  const K = req.kafka.K;
  delete PSIM.parked[req.id];
  req.kDone = K; req.status = 'flying';
  if(req.kafka.retry) _patNote(req, '↻ обработано из retry-топика');
  _pSwap(req, 'circle');
  _pPaint(req, req.kafka.retry ? PAT_COL.retry : _pBaseColor(req));
  SIM.reqs[req.id] = req;
  onArrive(req);   // штатный переход K → консьюмер
}

function _kGhost(K, toId, col){
  const conn = S.conns.find(c => c.from === K && c.to === toId); const pts = conn && edgePts(conn);
  if(!pts) return;
  const e = _psvg('rect', { width:6, height:6, rx:3, 'pointer-events':'none' });
  e.style.fill = col; e.style.opacity = '0.6'; _player().appendChild(e);
  fxAdd(650, fr => { const p = _pAt(pts, fr); e.setAttribute('x', (p.x - 3).toFixed(1)); e.setAttribute('y', (p.y - 3).toFixed(1)); e.style.opacity = String(0.65 * (1 - fr * 0.6)); }, () => e.remove());
}

function _kLayout(K){
  const b = gb(K); if(!b) return;
  const st = BROKER_STATE[K]; const P = st && st.cfg ? st.cfg.partitions : 3;
  const rows = {};
  Object.values(PSIM.parked).forEach(r => { if(r.kafka.K !== K) return; const key = (r.kafka.retry ? 'r' : 'p') + (r.kafka.part % P); (rows[key] || (rows[key] = [])).push(r); });
  let ov = PSIM.kOv[K];
  if(!ov || !ov.parentNode){ ov = _psvg('g', { 'pointer-events':'none' }); _player().insertBefore(ov, _player().firstChild); PSIM.kOv[K] = ov; }
  ov.innerHTML = '';
  const W = bw(b), x0 = b.x + 20, y0 = b.y + bh(b) + 8, per = Math.max(3, Math.floor((W - 26) / 9));
  const order = []; for(let p = 0; p < P; p++) order.push('p' + p);
  Object.keys(rows).filter(k => k[0] === 'r').sort().forEach(k => order.push(k));
  const anyParked = Object.keys(rows).length > 0;
  if(!anyParked) return;
  order.forEach((key, ri) => {
    const y = y0 + ri * 10, list = rows[key] || [];
    const isR = key[0] === 'r';
    const lb = _psvg('text', { x:b.x + 2, y:y + 6, 'font-size':'7.5', fill:isR ? PAT_COL.retry : '#3a3f4b', 'font-weight':'700' }); lb.textContent = (isR ? 'r' : 'P') + key.slice(1); ov.appendChild(lb);
    ov.appendChild(_psvg('rect', { x:x0 - 2, y:y - 1, width:per * 9 + 2, height:9, rx:2, fill:'#ffffff', stroke:'#808590', 'stroke-width':'0.8' }));
    ov.appendChild(_psvg('path', { d:`M ${x0 - 1.5} ${y + 7.5} V ${y - 0.5} H ${x0 + per * 9 - 0.5}`, fill:'none', stroke:'#4a4f5a', 'stroke-width':'0.7' }));
    list.forEach((r, i) => {
      const d = SIM.dots[r.id]; if(!d) return;
      if(i >= per){ d.style.display = 'none'; return; }
      d.style.display = ''; d.style.opacity = '1';
      _pSetXY(d, x0 + i * 9 + 3.5, y + 3.5);
    });
    if(list.length > per){ const t = _psvg('text', { x:x0 + per * 9 + 3, y:y + 6.5, 'font-size':'7.5', fill:'#a86400', 'font-weight':'700' }); t.textContent = '+' + (list.length - per); ov.appendChild(t); }
  });
}

function _kDrop(r, col, text, fall){
  const d = SIM.dots[r.id]; const K = r.kafka.K;
  delete PSIM.parked[r.id];
  const x = d ? +(d.getAttribute('x') || 0) : 0, y = d ? +(d.getAttribute('y') || 0) : 0;
  if(text) fxLabel(x + 3, y - 4, text, col, 1000, text + K);
  if(d){ d.style.fill = col; d.style.display = ''; }
  fxAdd(700, fr => { if(d){ if(fall) d.setAttribute('y', (y + 30 * fr).toFixed(1)); d.style.opacity = String(1 - fr); } }, () => { if(d) d.remove(); delete SIM.dots[r.id]; });
  _kLayout(K);
}

// события брокера → поведение шариков (вызывается после tickBrokerConsumers)
function simPatKafka(){
  if(typeof kafkaDrainEvents !== 'function') return;
  // state брокера пересоздан (сменили настройки) — освобождаем «припаркованные»
  Object.values(PSIM.parked).forEach(r => { if(BROKER_STATE[r.kafka.K] !== r.kafka.state){ if(r.kafka.gidNext) _kResume(r); else _pKill(r); } });
  Object.keys(BROKER_STATE).forEach(K => {
    const b = gb(K); if(!b || b.type !== 'kafka') return;
    const st = BROKER_STATE[K];
    const evs = kafkaDrainEvents(K); if(!evs.length) return;
    let ghosts = 0, changed = false;
    const c = _pBlockC(K);
    evs.forEach(e => {
      const rid = e.msg && e.msg.reqId, pr = rid && PSIM.parked[rid];
      const mine = pr && pr.kafka.K === K && (!pr.kafka.gidNext || pr.kafka.gidNext === e.gid);
      switch(e.type){
        case 'consumed':
          if(mine){ if(pr.kafka.gidNext) _kResume(pr); else { _kGhost(K, e.blockId, _pBaseColor(pr)); _pKill(pr); } changed = true; }
          else if(rid && ghosts < 5){ const gk = K + e.gid; if(SIM.time - (PSIM.lastGhost[gk] || 0) > 160){ PSIM.lastGhost[gk] = SIM.time; _kGhost(K, e.blockId, PAT_COL.kafka); ghosts++; } }
          break;
        case 'retry':
          if(mine){ pr.kafka.retry = true; _pPaint(pr, PAT_COL.retry); _patNote(pr, `↻ консьюмер упал → retry-топик (попытка ${e.attempt})`); changed = true;
            if(c) fxLabel(c.x, c.y - 20, '↻ retry-topic', PAT_COL.retry, 900, 'kr' + K); }
          break;
        case 'dlq':
          if(mine){ _kDrop(pr, PAT_COL.dlq, '☠ DLQ', true); }
          else if(c) fxLabel(c.x, c.y - 20, '☠ DLQ', PAT_COL.dlq, 900, 'kd' + K);
          break;
        case 'lost': if(mine) _kDrop(pr, PAT_COL.fail, '✕ lost', true); break;
        case 'redeliver': if(pr){ const d = SIM.dots[pr.id]; if(d){ fxRing(+d.getAttribute('x') + 3.5, +d.getAttribute('y') + 3.5, PAT_COL.retry, 3, 12, 400); } } break;
        case 'expired': if(pr && pr.kafka.K === K) _kDrop(pr, '#565f89', '⌛ retention', false); break;
        case 'rebalance': {
          const g = st.consumerGroups[e.gid], cc = g && _pBlockC(g.blockId);
          if(cc) fxLabel(cc.x, cc.y - 22, '⟳ rebalance', PAT_COL.kafka, 1300, 'rb' + e.gid); break; }
        case 'leader': if(c) fxLabel(c.x, c.y - 22, `👑 P${e.partition} → b${e.leader}`, '#7aa2f7', 1300, 'ld' + K + e.partition); break;
        case 'broker_down': if(c){ fxRing(c.x, c.y, PAT_COL.fail, 10, 40, 700); fxLabel(c.x, c.y - 24, `💥 broker-${e.broker}`, PAT_COL.fail, 1400); } break;
        case 'broker_up': if(c) fxLabel(c.x, c.y - 24, `♻ broker-${e.broker}`, '#9ece6a', 1400); break;
      }
    });
    if(changed) _kLayout(K);
  });
}

// ── Легенда «что значат кружки» ──────────────────────────────
function simPatLegend(show){
  let el = document.getElementById('sim-legend');
  if(!show){ if(el) el.style.display = 'none'; return; }
  if(!el){
    el = document.createElement('div'); el.id = 'sim-legend'; el.className = 'window95 sim-legend'; el.dataset.collapsed = '1'; // по умолчанию свёрнута — не закрывает схему
    el.style.cssText = 'position:fixed;z-index:120;background:#1a1b26e6;border:1px solid #3d3f52;border-radius:8px;padding:7px 10px;font-size:10px;color:#a9b1d6;line-height:1.6;pointer-events:auto;max-width:240px;font-family:inherit';
    document.body.appendChild(el);
  }
  const en = typeof CURR_LANG !== 'undefined' && CURR_LANG === 'en';
  const sw = (svg, ru, enT) => `<div style="display:flex;align-items:center;gap:6px"><svg width="16" height="12" viewBox="-8 -6 16 12">${svg}</svg><span>${en ? enT : ru}</span></div>`;
  const collapsed = el.dataset.collapsed === '1';
  el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;font-weight:700;color:#c0caf5;cursor:pointer" class="titlebar95 sl-title" onclick="var e=document.getElementById('sim-legend');e.dataset.collapsed=e.dataset.collapsed==='1'?'0':'1';simPatLegend(true)">${en ? 'Dots legend' : 'Легенда кружков'} <span>${collapsed ? '▸' : '▾'}</span></div>` + (collapsed ? '' : [
    sw('<circle r="4.5" fill="#7aa2f7"/>', 'запрос (цвет сценария)', 'request (scenario colour)'),
    sw('<polygon points="-4,-4 5,0 -4,4" fill="#7aa2f7"/>', 'ответ', 'response'),
    sw(`<circle r="4.5" fill="${PAT_COL.fail}"/>`, 'упадёт / ✕ 5xx', 'will fail / ✕ 5xx'),
    sw(`<circle r="4.5" fill="${PAT_COL.retry}"/>`, '↻ retry с backoff (мигает)', '↻ retry with backoff (blinks)'),
    sw(`<circle r="4.5" fill="${PAT_COL.cb}" opacity=".6"/>`, '⚡ CB open: отскок fail-fast', '⚡ CB open: fail-fast bounce'),
    sw(`<circle r="4" fill="${PAT_COL.probe}" stroke="#bb9af7" stroke-dasharray="2,1.5"/>`, '⚡ half-open: пробный', '⚡ half-open: probe'),
    sw(`<circle r="4.5" fill="none" stroke="${PAT_COL.timeout}" stroke-width="1.5"/>`, '⏱ timeout: лопается', '⏱ timeout: pops'),
    sw(`<circle r="4.5" fill="${PAT_COL.rl}"/>`, '🚦 rate limit: 429 на входе', '🚦 rate limit: 429 at the entry'),
    sw(`<polygon points="0,-5 5,0 0,5 -5,0" fill="${PAT_COL.bulk}"/>`, '🛡 bulkhead: пул полон', '🛡 bulkhead: pool full'),
    sw(`<polygon points="-4,-4 5,0 -4,4" fill="${PAT_COL.fallback}55" stroke="${PAT_COL.fallback}" stroke-dasharray="2,1"/>`, '🪂 fallback-ответ', '🪂 fallback response'),
    sw(`<polygon points="-4,-4 5,0 -4,4" fill="none" stroke="${PAT_COL.saga}" stroke-width="1.5"/>`, '↶ saga: компенсация', '↶ saga: compensation'),
    sw(`<polygon points="-4,-4 5,0 -4,4" fill="${PAT_COL.hit}"/>`, '🗃 cache HIT (короткий путь) / MISS → БД', '🗃 cache HIT (short path) / MISS → DB'),
    sw(`<rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" fill="#7aa2f7"/>`, '📨 ждёт в партиции Kafka', '📨 waiting in a Kafka partition'),
    sw(`<rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" fill="${PAT_COL.retry}"/>`, '📨 в retry-топике', '📨 in the retry topic'),
    sw(`<rect x="-3" y="-3" width="6" height="6" rx="3" fill="${PAT_COL.kafka}" opacity=".6"/>`, '📨 копия другой группе', '📨 copy to another group'),
    sw(`<rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" fill="${PAT_COL.dlq}"/>`, '☠ ушёл в DLQ', '☠ moved to DLQ'),
  ].join(''));
  const svgEl = _player() && _player().ownerSVGElement;
  const r = svgEl ? svgEl.getBoundingClientRect() : { left:10, bottom:window.innerHeight - 10 };
  el.style.left = (r.left + 10) + 'px'; el.style.top = ''; el.style.bottom = Math.max(10, window.innerHeight - r.bottom + 10) + 'px';
  el.style.display = 'block';
}
