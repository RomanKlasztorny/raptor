// ENGINE — движок симуляции: ёмкости, задержки, расчёт потока нагрузки (математика, без DOM)

// Базовые ёмкости (rps) и задержки (мс)
const BASE = {
  web_client:   {cat:'client', cap:Infinity, lat:0},
  mob_client:   {cat:'client', cap:Infinity, lat:0},
  api_gw:       {cat:'gw',     cap:100000,   lat:2},
  lb:           {cat:'net',    cap:1000000,  lat:0.5},
  cdn:          {cat:'net',    cap:10000000, lat:0},
  service:      {cat:'svc',    cap:10000,    lat:5},
  bff:          {cat:'svc',    cap:20000,    lat:3},
  auth:         {cat:'svc',    cap:30000,    lat:4},
  postgresql:   {cat:'db',     cap:10000,    lat:1},
  mysql:        {cat:'db',     cap:8000,     lat:1.2},
  mongodb:      {cat:'db',     cap:50000,    lat:2},
  redis:        {cat:'cache',  cap:1000000,  lat:0.1},
  cassandra:    {cat:'db',     cap:100000,   lat:1},
  clickhouse:   {cat:'db',     cap:500000,   lat:0.5},
  elasticsearch:{cat:'db',     cap:80000,    lat:3},
  s3:           {cat:'db',     cap:300000,   lat:8},
  kafka:        {cat:'broker', cap:2000000,  lat:5},
  rabbitmq:     {cat:'broker', cap:50000,    lat:1},
  nats:         {cat:'broker', cap:500000,   lat:0.5},
  queue:        {cat:'queue',  cap:100000,   lat:2},
  websocket_gw: {cat:'gw',    cap:500000,   lat:1},
  actor:        {cat:'actor',  cap:Infinity, lat:0},
  external:     {cat:'external',cap:1000000, lat:10},
};

const HIT_RATE = 0.8; // дефолт hit rate кэша (старые проекты без настройки hit_rate)

// ── Redis: память и hit rate ───────────────────────────────────
// '256mb' / '1gb' → МБ
function memMB(v,def){
  const m=String(v||'').trim().toLowerCase().match(/^([\d.]+)\s*(kb|mb|gb|tb)?$/);
  if(!m) return def;
  const n=+m[1], u=m[2]||'mb';
  return n*({kb:1/1024,mb:1,gb:1024,tb:1024*1024}[u]);
}
// Заполнение памяти: dataset / maxmemory (1 = ровно влезает). Дефолты 512mb / 1gb → 0.5 (старые проекты не задеты)
function redisFill(b){
  const s=b.settings||{};
  return memMB(s.dataset,512)/Math.max(1,memMB(s.maxmemory,1024));
}
// Эффективный hit rate кэш-блока.
// База — настройка hit_rate (%; дефолт 80). Если данные не влезают (fill>1) и политика вытесняющая,
// в памяти остаётся доля 1/fill рабочего набора. Доступы скошены (Zipf-подобно: горячие ключи часто),
// поэтому hit падает медленнее доли: hit = base · (1/fill)^α, где α — «качество» политики:
//   allkeys-LFU 0.35 (лучше всех держит горячее), allkeys-LRU 0.5, volatile-TTL 0.8 (вытесняет по TTL, не по популярности).
// noeviction hit rate не снижает — вместо этого запись падает с OOM (см. redisWriteErr).
function cacheHitRate(b){
  const s=(b&&b.settings)||{};
  let h=s.hit_rate!=null&&s.hit_rate!==''?(+s.hit_rate):HIT_RATE*100;
  if(!isFinite(h)) h=HIT_RATE*100;
  h=Math.max(0,Math.min(99,h))/100;
  if(b&&b.type==='redis'){
    const fill=redisFill(b), ev=String(s.eviction||'allkeys-LRU').toLowerCase();
    if(fill>1 && ev!=='noeviction'){
      const a=ev.includes('lfu')?0.35:ev.includes('ttl')?0.8:0.5;
      h*=Math.pow(1/fill,a);
    }
  }
  return h;
}
// noeviction + переполнение: доля записей, падающих с OOM = доля данных сверх maxmemory (1-1/fill).
// Записи — s.write_share% трафика кэша (дефолт 20%). Возвращает долю ВСЕХ запросов с ошибкой.
function redisWriteErr(b){
  if(!b||b.type!=='redis') return 0;
  const s=b.settings||{};
  if(String(s.eviction||'allkeys-LRU').toLowerCase()!=='noeviction') return 0;
  const fill=redisFill(b); if(fill<=1) return 0;
  const ws=Math.max(0,Math.min(100,s.write_share!=null?+s.write_share:20))/100;
  return ws*(1-1/fill);
}
// Hit rate для сервиса с Cache Aside: по подключённому кэш-блоку (несколько — лучший)
function svcHitRate(b, blocks, conns){
  let h=null;
  conns.forEach(c=>{ if(c.from!==b.id) return; const t=blocks.find(x=>x.id===c.to);
    if(t&&BASE[t.type]?.cat==='cache'){ const r=cacheHitRate(t); if(h==null||r>h) h=r; } });
  return h==null?HIT_RATE:h;
}

// ── PostgreSQL/MySQL: лимит соединений ─────────────────────────
// Каждый инстанс сервиса держит пул s.conn_pool (дефолт 10) соединений к БД.
// Спрос = Σ по входящим сервисам (replicas × pool). max_connections дефолт 100.
// Без пулера: при спросе > max_connections ёмкость падает пропорционально (max/спрос) — остальные ждут/отваливаются.
// С PgBouncer/Connection Pool: сотни клиентских соединений мультиплексируются в малый серверный пул — лимит снят, ёмкость НЕ растёт.
function dbConnDemand(b, env){
  const blocks=env&&env.blocks, conns=env&&env.conns;
  if(!blocks||!conns) return 0;
  let d=0;
  conns.forEach(c=>{ if(c.to!==b.id) return; const f=blocks.find(x=>x.id===c.from); if(!f) return;
    const cat=BASE[f.type]?.cat; if(cat!=='svc') return;
    const fs=f.settings||{}; d+=(fs.replicas||1)*(+fs.conn_pool||10); });
  return d;
}
function dbConnFactor(b, env){
  const s=b.settings||{};
  if(s.pgbouncer) return 1;
  const max=+s.max_connections||100, d=dbConnDemand(b,env);
  return d>max?max/d:1;
}
// ── PostgreSQL/MySQL: read/write split ────────────────────────
// Реплики чтения ускоряют ТОЛЬКО чтение: запись всегда идёт на праймари.
//   P = ёмкость праймари (база × лимит соединений × изоляция) — потолок по записи;
//   R = P·(1+0.7·replicas) — потолок по чтению (праймари + реплики).
//   Доля записи w: смесь держится, пока λ·w ≤ P и λ ≤ R → ёмкость = min(R, P/w).
// w — доля записи в трафике, дошедшем до БД. Если сервис задал write_share — записи идут мимо кэша,
// иначе берётся write_share самой БД (дефолт 20%). При w=20% и ≤5 репликах ёмкость как раньше.
const DB_WS_DEF=20;
function isRelDb(b){ return !!b&&(b.type==='postgresql'||b.type==='mysql'); }
function wsPct(s){ const v=s&&s.write_share; return (v!=null&&v!==''&&isFinite(+v))?Math.max(0,Math.min(100,+v)):null; }
function dbDefWs(b){ const p=wsPct(b&&b.settings); return (p!=null?p:DB_WS_DEF)/100; }
function dbWriteShare(b){ return (b&&b.rt&&b.rt.wShare!=null)?b.rt.wShare:dbDefWs(b); }
// Учесть поток в БД: w — явный объём записи (сервис с write_share) или null → доля write_share самой БД
function dbAddFlow(t, pass, w){ if(!isRelDb(t)) return; t.rt.lambdaW=(t.rt.lambdaW||0)+(w!=null?w:pass*dbDefWs(t)); }
// Ёмкости праймари (запись) и праймари+реплик (чтение)
function dbCaps(b, env){
  const base=BASE[b.type]; const s=b.settings||{};
  let cap=base.cap; cap*=dbConnFactor(b, env||_engEnv());
  let R=s.replicas?cap*(1+0.7*s.replicas):cap, P=cap;
  const iso=s.isolation==='SERIALIZABLE'?0.6:s.isolation==='REPEATABLE READ'?0.85:1;
  if(iso!==1){ R*=iso; P*=iso; }
  return {P,R};
}
// Лаг репликации: растёт, когда праймари загружен записью (реплики не успевают применять WAL/binlog)
function dbReplLag(rhoW, replicas){
  if(!replicas||!(rhoW>0)) return 0;
  if(rhoW>=1) return 5000;
  return Math.min(5000, Math.round(5/(1-rhoW)*(rhoW>0.6?Math.pow(rhoW/0.6,6):1)));
}
function _engEnv(){ return (typeof S!=='undefined'&&S&&S.blocks)?S:null; }

// ── Эффективная ёмкость с учётом настроек ──────────────────────
function effCap(b, env){
  const base=BASE[b.type]; if(!base) return 0;
  if(!isFinite(base.cap)) return Infinity;
  let cap=base.cap; const s=b.settings||{};
  switch(b.type){
    case 'service': case 'bff': case 'auth':
      cap *= (s.replicas||1); break;
    case 'queue':
      cap *= (s.workers||1); break;
    case 'elasticsearch':
      cap *= (s.shards||1); break;
    case 'api_gw': case 'websocket_gw':
      cap *= (s.instances||1); break;
    case 'lb':
      cap *= (s.instances||1); break;
    case 'postgresql': case 'mysql': {
      // PgBouncer снимает лимит соединений, но не умножает ёмкость; реплики — только чтение (см. dbCaps)
      const {P,R}=dbCaps(b, env); const w=dbWriteShare(b);
      cap=(s.replicas&&w>0)?Math.min(R,P/w):R;
      break; }
    case 'redis':
      if(s.cluster) cap*=Math.max(1,+s.cluster_shards||3); // ёмкость ∝ числу мастеров (слоты делятся между ними)
      if(s.persistence==='AOF') cap*=0.7;
      else if(s.persistence==='RDB') cap*=0.9;
      break;
    case 'kafka':
      cap = base.cap*((s.partitions||3)/3);
      if(s.delivery==='exactly-once') cap*=0.5;
      else if(s.delivery==='at-most-once') cap*=1.3;
      if(typeof kafkaCapMul==='function') cap*=kafkaCapMul(b); // acks / hot-key / хаос брокеров (1 для старых проектов)
      break;
    case 'cassandra':
      cap = base.cap*((s.nodes||3)/3);
      if(s.consistency==='ALL') cap*=0.5;
      else if(s.consistency==='ONE') cap*=1.5;
      break;
    case 'mongodb':
      if(s.sharding) cap*=4;
      if(s.replicas) cap*=(1+0.5*((s.replicas||1)-1));
      break;
    case 'clickhouse':
      cap *= (s.shards||1); break;
    case 'rabbitmq':
      if(s.mirrored) cap*=0.7; break;
    case 'nats':
      cap *= Math.max(1,+s.nodes||1); break; // NATS-кластер: ёмкость ∝ числу нод (по умолчанию 1 — как раньше)
  }
  if(b.down) return Math.max(1,(isFinite(cap)?cap:base.cap)*0.02);
  return cap;
}

// ── Эффективная задержка обработки с учётом настроек ───────────
function baseLat(b){
  const base=BASE[b.type]; let lat=base?base.lat:5; const s=b.settings||{};
  if((b.type==='postgresql'||b.type==='mysql')&&s.isolation==='SERIALIZABLE') lat*=1.4;
  if(b.type==='kafka'&&s.delivery==='exactly-once') lat*=1.5;
  if(b.type==='kafka'&&typeof kafkaLatMul==='function') lat*=kafkaLatMul(b);
  if(b.type==='redis'&&s.persistence==='AOF') lat*=1.3;
  if(b.type==='cassandra'&&s.consistency==='ALL') lat*=2;
  if(b.type==='nats') lat=0.5;
  if(b.chaosLat) lat*=b.chaosLat;
  return lat;
}

// ── Есть ли у сервиса Cache Aside И кэш в схеме ────────────────
function svcHasCache(b, blocks, conns){
  const pats=b.patterns||[];
  if(!pats.includes('cache_aside')) return false;
  return conns.some(c=>{
    if(c.from!==b.id) return false;
    const t=blocks.find(x=>x.id===c.to);
    return t && BASE[t.type]?.cat==='cache';
  });
}
function hasCB(b){return (b.patterns||[]).includes('circuit_breaker');}
function hasPat(b,p){return !!(b&&(b.patterns||[]).includes(p));}
// Rate Limit: лимит пропуска (Gateway — настройка rate_limit_rps, сервис — 70% своей ёмкости)
function rateLimitOf(b){
  if(!hasPat(b,'rate_limit')) return Infinity;
  const s=b.settings||{};
  if(b.type==='api_gw'||b.type==='websocket_gw') return +s.rate_limit_rps||1000;
  const c=effCap(b); return isFinite(c)?c*0.7:Infinity;
}

// ── ПОВЕДЕНИЕ AUTH: какая доля запросов реально идёт в хранилище ──
// session-based = stateful: каждый запрос читает сессию (100%).
// jwt-only = stateless: токен валиден по подписи, в БД только login/refresh (~10%).
// oauth2+jwt: выдача/интроспекция/refresh токенов (~20%).
// api_key = ключ проверяется в хранилище, но кэшируется (~30%).
// oidc_sso = внешний IdP, подписи по JWKS-кэшу; БД только онбординг/линковка (~5%).
function authType(b){return (b.auth&&b.auth.type)||(b.settings&&b.settings.authType)||'jwt_only';}
function authPassRate(b){
  const t=authType(b);
  if(t==='session_based')return 1.0;
  if(t==='api_key')return 0.3;
  if(t==='oauth2_jwt')return 0.2;
  if(t==='oidc_sso')return 0.05;
  return 0.1; // jwt_only
}

// ── Топологический порядок (Kahn). При цикле — как есть ────────
function topoOrder(blocks, conns){
  const indeg={}, adj={};
  blocks.forEach(b=>{indeg[b.id]=0;adj[b.id]=[];});
  conns.forEach(c=>{if(adj[c.from]){adj[c.from].push(c.to);indeg[c.to]=(indeg[c.to]||0)+1;}});
  const q=blocks.filter(b=>indeg[b.id]===0).map(b=>b.id);
  const order=[];
  while(q.length){
    const id=q.shift(); order.push(id);
    for(const nb of (adj[id]||[])){indeg[nb]--;if(indeg[nb]===0)q.push(nb);}
  }
  blocks.forEach(b=>{if(!order.includes(b.id))order.push(b.id);});
  return order;
}

// ══════════════════════════════════════════════════════════════
// ГЛАВНОЕ: расчёт потока нагрузки через граф
// ══════════════════════════════════════════════════════════════
function computeFlow(blocks, conns, load){
  const B=id=>blocks.find(b=>b.id===id);
  blocks.forEach(b=>{ b.rt={lambdaIn:0,cap:0,rho:0,dropRate:0,latMul:1,effLat:0,
    health:'ok',cascade:false,cbOpen:false,respTime:0,slowDueTo:null}; });

  const hasInc=new Set(conns.map(c=>c.to));
  const sources=blocks.filter(b=>!hasInc.has(b.id));
  // Нагрузка делится между источниками — total rps = load, не load×N
  const srcLoad=load/Math.max(1,sources.length);
  sources.forEach(s=>{ s.rt.lambdaIn += srcLoad; });

  const order=topoOrder(blocks,conns);

  for(const id of order){
    const b=B(id); if(!b) continue;
    let inL=b.rt.lambdaIn;
    const rl=rateLimitOf(b);
    if(inL>rl){ b.rt.rlDrop=1-rl/inL; inL=rl; }   // 🚦 лишнее отбивается 429 на входе
    const outs=conns.filter(c=>c.from===id);
    if(!outs.length) continue;
    const cat=BASE[b.type]?.cat;
    const isRouter=(cat==='gw'||cat==='net'||cat==='client'||cat==='actor');

    if(isRouter){
      const share=inL/outs.length;
      outs.forEach(c=>{const t=B(c.to);if(t){t.rt.lambdaIn+=share;dbAddFlow(t,share,null);}});
    } else {
      const cache=svcHasCache(b,blocks,conns);
      const hit=cache?svcHitRate(b,blocks,conns):0;
      const isAuth=(b.type==='auth');
      const aRate=isAuth?authPassRate(b):1;
      outs.forEach(c=>{
        const t=B(c.to); if(!t) return;
        const td=BASE[t.type]?.cat;
        let pass=inL;
        let w=null;
        const sw=(!isAuth&&isRelDb(t))?wsPct(b.settings):null;
        if(sw!=null){ w=inL*sw/100; pass=w+(inL-w)*(cache?(1-hit):1); } // запись идёт мимо кэша
        else if(cache && td==='db') pass=inL*(1-hit);
        else if(isAuth && (td==='db'||td==='cache')) pass=inL*aRate; // stateful/stateless
        t.rt.lambdaIn+=pass; dbAddFlow(t,pass,w);
      });
    }
  }

  finalizeFlow(blocks,conns);
  return blocks;
}

// ── РЕАЛИЗМ: нагрузка узла = сумма объёмов сценариев ──
// Учитывает cache hit rate (Cache Aside → DB получает только 20%) и authPassRate.
function computeFlowScenarios(blocks, conns, scenarios, _rlPass){
  const B=id=>blocks.find(x=>x.id===id);
  blocks.forEach(b=>{ b.rt={lambdaIn:0,cap:0,rho:0,dropRate:0,latMul:1,effLat:0,
    health:'ok',cascade:false,cbOpen:false,respTime:0,slowDueTo:null}; });
  (scenarios||[]).forEach(s=>{
    let v=s.volume||0; if(v<=0) return;
    const path=s.path||[];
    const seen=new Set();
    for(let i=0;i<path.length;i++){
      if(_rlPass&&i>0&&_rlPass[path[i-1]]!=null) v*=_rlPass[path[i-1]]; // 🚦 после Rate Limit дальше идёт меньше
      const id=path[i];
      if(seen.has(id))continue;
      seen.add(id);
      const b=B(id);if(!b)continue;
      let vol=v, w=null;
      if(i>0){
        const prev=B(path[i-1]);
        if(prev){
          const fc=BASE[prev.type]?.cat,tc=BASE[b.type]?.cat;
          const sw=(prev.type!=='auth'&&fc==='svc'&&isRelDb(b))?wsPct(prev.settings):null;
          const ch=svcHasCache(prev,blocks,conns);
          if(sw!=null){ w=v*sw/100; vol=w+(v-w)*(ch?(1-svcHitRate(prev,blocks,conns)):1); }
          else if(ch&&(tc==='db'||tc==='cache'))
            vol=v*(1-svcHitRate(prev,blocks,conns));
          else if(prev.type==='auth'&&(tc==='db'||tc==='cache'))
            vol=v*authPassRate(prev);
        }
      }
      b.rt.lambdaIn+=vol; dbAddFlow(b,vol,w);
    }
  });
  if(!_rlPass){
    // второй проход только если есть Rate Limit и он срабатывает (старые проекты не затронуты)
    const f={}; let any=false;
    blocks.forEach(b=>{ const rl=rateLimitOf(b); if(b.rt.lambdaIn>rl){ f[b.id]=rl/b.rt.lambdaIn; any=true; } });
    if(any){ computeFlowScenarios(blocks,conns,scenarios,f);
      blocks.forEach(b=>{ if(f[b.id]!=null) b.rt.rlDrop=1-f[b.id]; }); return blocks; }
  }
  finalizeFlow(blocks,conns);
  return blocks;
}

// ── Общая часть: по lambdaIn считаем загрузку, отказы, задержку, каскады ──
function finalizeFlow(blocks, conns){
  const B=id=>blocks.find(b=>b.id===id);
  const env={blocks,conns};
  blocks.forEach(b=>{
    if(isRelDb(b)) b.rt.wShare=b.rt.lambdaIn>0&&b.rt.lambdaW!=null?Math.min(1,b.rt.lambdaW/b.rt.lambdaIn):dbDefWs(b);
    const cap=effCap(b, env);
    b.rt.lambdaIn=Math.round(b.rt.lambdaIn);
    b.rt.cap=cap;
    b.rt.rho=isFinite(cap)?(cap>0?b.rt.lambdaIn/cap:99):0;
    const r=b.rt.rho;
    // r≤0.8: нет потерь; r∈(0.8,1): 0→8% линейно; r≥1: max(8%,(λ-cap)/λ) — непрерывно
    b.rt.dropRate=r<=0.8?0:r>=1?Math.min(0.95,Math.max(0.08,1-1/r)):(r-0.8)*0.4;
    b.rt.latMul=r<1?Math.min(1/(1-r),20):20;
    b.rt.effLat=baseLat(b)*b.rt.latMul;
    b.rt.health=r>=0.9?'error':r>=0.6?'warn':'ok';
    if(b.type==='postgresql'||b.type==='mysql'){ const s=b.settings||{}; const f=dbConnFactor(b,env); if(f<1) b.rt.connLimited={demand:dbConnDemand(b,env),max:+s.max_connections||100};
      // read/write split: где потолок — в записи (праймари) или в чтении (реплики)
      const {P,R}=dbCaps(b,env), w=b.rt.wShare, lw=b.rt.lambdaIn*w;
      b.rt.capW=P; b.rt.capR=R; b.rt.lambdaWr=Math.round(lw); b.rt.rhoW=P>0?lw/P:0;
      b.rt.writeBound=!!(s.replicas&&w>0&&P/w<R);
      b.rt.replLag=dbReplLag(b.rt.rhoW, +s.replicas||0); }
    if(b.type==='redis'){
      b.rt.hitRate=cacheHitRate(b);
      const oom=redisWriteErr(b);
      if(oom>0 && b.rt.lambdaIn>0){ b.rt.oomErr=oom; b.rt.dropRate=Math.min(0.95,Math.max(b.rt.dropRate,oom)); if(b.rt.health==='ok') b.rt.health=oom>=0.1?'error':'warn'; }
    }
  });
  const memo={};
  function respTime(id, seen){
    if(memo[id]!=null) return memo[id];
    if(seen.has(id)) return 0;
    seen.add(id);
    const b=B(id); if(!b){return 0;}
    let down=0, slowDep=null;
    const outs=conns.filter(c=>c.from===id);
    for(const c of outs){
      const t=B(c.to); if(!t) continue;
      const tcat=BASE[t.type]?.cat;
      if(tcat==='broker'||tcat==='queue') continue;
      if(hasCB(b) && t.rt.health==='error'){ b.rt.cbOpen=true; continue; }
      const rt=respTime(t.id, new Set(seen));
      if(rt>down){down=rt;slowDep=t.id;}
    }
    b.rt.slowDep=slowDep;
    memo[id]=b.rt.effLat+down;
    return memo[id];
  }
  blocks.forEach(b=>{ b.rt.respTime=respTime(b.id, new Set()); });
  blocks.forEach(b=>{
    const cat=BASE[b.type]?.cat;
    if((hasPat(b,'bulkhead')||hasPat(b,'fallback')) && b.rt.slowDep){ b.rt.isolated=true; return; } // 🛡/🪂 медленная зависимость не тянет вызывающего
    if((cat==='svc'||cat==='gw') && b.rt.health!=='error' && !b.rt.cbOpen){
      const wait=b.rt.respTime-b.rt.effLat;
      if(wait>Math.max(b.rt.effLat*2,15)){
        b.rt.cascade=true;
        b.rt.slowDueTo=b.rt.slowDep;
        if(b.rt.health==='ok') b.rt.health='warn';
      }
    }
  });
  if(typeof kafkaAnnotateFlow==='function') kafkaAnnotateFlow(blocks,conns);
  return blocks;
}

// ══════════════════════════════════════════════════════════════
// МОДЕЛЬ БРОКЕРА — Kafka, RabbitMQ, NATS, Queue
// Сервис может быть одновременно продюсером (produces[]) и консьюмером (consumes[])
// ══════════════════════════════════════════════════════════════
const BROKER_STATE = {}; // keyed by blockId

function initBrokerState(b){
  if(BROKER_STATE[b.id]) return BROKER_STATE[b.id];
  const state = {
    type: b.type,
    topics: {},        // topicName -> partitions[]
    queues: {},        // queueName -> messages[]
    consumerGroups: {}, // groupId -> {topics: {topicName -> {partitionIdx -> offset}}}
    dlq: [],           // dead letter queue
    failedCount: 0,
    lostCount: 0,      // NATS core (без JetStream): сообщения без подписчика теряются
    totalProduced: 0,
    totalConsumed: 0,
  };
  // Создаём дефолтный топик/очередь
  BROKER_STATE[b.id] = state;
  if(b.type==='kafka'){
    kafkaInit(b,state); // модель v2: kafka-engine.js
  } else {
    state.queues['default'] = [];
  }
  BROKER_STATE[b.id] = state;
  return state;
}
// Оффсеты группы по топику (создать нули если не было)
function grpTopicOffsets(state, groupId, topic, partsCount){
  if(!state.consumerGroups[groupId]) state.consumerGroups[groupId]={topics:{}};
  const grp=state.consumerGroups[groupId];
  if(!grp.topics) grp.topics={};
  if(!grp.topics[topic]) grp.topics[topic]=Object.fromEntries(Array.from({length:partsCount},(_,i)=>[i,0]));
  return grp.topics[topic];
}

// Продюсер пишет сообщение в брокер
function brokerProduce(brokerId, message){
  const b = (typeof gb==='function')?gb(brokerId):null;
  if(!b) return false;
  const state = initBrokerState(b);
  const s = b.settings||{};
  message = message||{};
  const mkMsg = body => ({
    id: 'msg_'+Date.now()+'_'+Math.random().toString(36).slice(2),
    body: body||{},
    timestamp: Date.now(),
    status: 'pending',
    retries: 0,
  });

  if(b.type==='kafka') return kafkaProduce(b,state,message);

  if(b.type==='nats' && !s.jetstream){
    // NATS core = at-most-once, ничего не хранит:
    // есть подписчики → мгновенный fan-out каждому; нет — сообщение ПОТЕРЯНО
    const subs = (typeof S!=='undefined')?S.conns.filter(c=>c.from===b.id):[];
    state.totalProduced++;
    if(!subs.length){ state.lostCount++; return {ack:true, lost:true}; }
    state.totalConsumed += subs.length; // копия каждому подписчику, очередь не растёт
    return {ack:true, fanout:subs.length};
  }

  if(b.type==='rabbitmq'){
    // Exchange-модель: direct → одна очередь; fanout → копия в очередь КАЖДОГО консьюмера;
    // topic → очередь по routing key (упрощённо как direct с паттерном)
    const ex = s.exchange||'direct';
    state.totalProduced++;
    if(ex==='fanout'){
      const consumers = (typeof S!=='undefined')?S.conns.filter(c=>c.from===b.id).map(c=>gb(c.to)).filter(Boolean):[];
      const targets = consumers.length?consumers:[null];
      targets.forEach(t=>{
        const qn = t?('q_'+(t.customLabel||t.id)):'default';
        if(!state.queues[qn]) state.queues[qn]=[];
        state.queues[qn].push(mkMsg(message.value||message.body));
      });
      return {ack:true, fanout:targets.length};
    }
    const q = message.queue||(ex==='topic'?(message.routingKey||'default'):'default');
    if(!state.queues[q]) state.queues[q]=[];
    state.queues[q].push(mkMsg(message.value||message.body));
    return {ack:true};
  }

  // Queue / NATS JetStream — простая очередь
  const q = message.queue||'default';
  if(!state.queues[q]) state.queues[q]=[];
  state.queues[q].push(mkMsg(message.value||message.body));
  state.totalProduced++;
  return {ack:true};
}

// Консьюмер читает сообщение из брокера
function brokerConsume(brokerId, opts){
  opts = opts||{};
  const b = (typeof gb==='function')?gb(brokerId):null;
  if(!b) return null;
  const state = BROKER_STATE[brokerId];
  if(!state) return null;
  const groupId = opts.groupId||'default-group';
  const delivery = (b.settings||{}).delivery||'at-least-once';

  if(b.type==='kafka'){
    const topic = opts.topic||kTopicName(b); // было 'default' при записи в 'events' — баг
    const parts = state.topics[topic];
    if(!parts) return null;
    const offs = grpTopicOffsets(state, groupId, topic, parts.length); // оффсеты СВОЕГО топика
    // ищем партицию с необработанными сообщениями
    for(let pi=0;pi<parts.length;pi++){
      const offset = Math.max(offs[pi]||0, parts[pi].base||0);
      const msg = kReadAt(parts[pi], offset);
      if(msg){
        // at-most-once: сразу коммитим
        if(delivery==='at-most-once') offs[pi] = msg.offset+1;
        return {msg, partition:pi, offset:msg.offset, groupId, topic,
          commit: ()=>{ offs[pi]=msg.offset+1; state.totalConsumed++; },
          nack: ()=>{
            state.dlq.push({...msg, failReason:'consumer_error', dlqAt:Date.now()});
            state.failedCount++;
            offs[pi]=msg.offset+1; // пропускаем
          }
        };
      }
    }
    return null;
  } else {
    const q = opts.queue||'default';
    const queue = state.queues[q];
    if(!queue||!queue.length) return null;
    const msg = queue[0];
    const ack = (b.settings||{}).ack||'manual';
    if(ack==='auto') { queue.shift(); state.totalConsumed++; }
    return {msg, commit:()=>{queue.shift();state.totalConsumed++;},
      nack:()=>{state.dlq.push({...msg,failReason:'nack',dlqAt:Date.now()});state.failedCount++;queue.shift();}};
  }
}

// Replay: сброс оффсетов для группы (по всем её топикам)
function brokerReplay(brokerId, groupId){
  const state = BROKER_STATE[brokerId];
  if(!state) return;
  groupId = groupId||'default-group';
  const grp = state.consumerGroups[groupId];
  if(grp&&grp.topics){
    Object.values(grp.topics).forEach(offs=>{
      Object.keys(offs).forEach(k=>{ offs[k]=0; }); // < base → читаем с начала лога (logStartOffset)
    });
  }
}

// Лаг консьюмера по топику (разница между последним сообщением и оффсетом группы)
function brokerConsumerLag(brokerId, groupId, topic){
  const state = BROKER_STATE[brokerId];
  if(!state) return 0;
  const b = (typeof gb==='function')?gb(brokerId):null;
  groupId = groupId||'default-group';
  topic = topic||(b&&b.type==='kafka'?kTopicName(b):'default');
  const parts = state.topics[topic];
  if(!parts) return 0;
  const offs = state.consumerGroups[groupId]?.topics?.[topic];
  const hw = p => p.hw!=null?p.hw:p.messages.length;
  if(!offs) return parts.reduce((a,p)=>a+hw(p)-(p.base||0),0);
  return parts.reduce((a,p,i)=>a+Math.max(0,hw(p)-Math.max(offs[i]||0,p.base||0)),0);
}

// Для NATS: pub/sub fan-out ко всем подписчикам (возвращает список потребителей)
function natsFanOut(brokerId, blocks, conns, message){
  const consumers = conns.filter(c=>c.from===brokerId).map(c=>blocks.find(b=>b.id===c.to)).filter(Boolean);
  return consumers.map(c=>({consumerId:c.id, msg:message, delivered:true}));
}

function hashStr(s){
  let h=0; for(let i=0;i<s.length;i++){h=(Math.imul(31,h)+s.charCodeAt(i))|0;} return h;
}

// Получить состояние брокера для инспектора
function getBrokerInspectorData(brokerId){
  const b = (typeof gb==='function')?gb(brokerId):null;
  if(!b) return null;
  const state = BROKER_STATE[brokerId];
  if(!state) return {type:b.type, empty:true, totalProduced:0, totalConsumed:0, dlq:[], consumerGroups:{}};
  const result = {
    type: b.type,
    totalProduced: state.totalProduced,
    totalConsumed: state.totalConsumed,
    dlqCount: state.dlq.length,
    failedCount: state.failedCount,
    lostCount: state.lostCount||0,
    dlq: state.dlq.slice(-10), // последние 10
    consumerGroups: {},
    topics: {},
    queues: {},
  };
  if(b.type==='kafka'){
    Object.assign(result,{kafka:true, cfg:state.cfg, brokers:state.brokers, tick:state.tick, rebalances:state.rebalances, log:(state.log||[]).slice(-12),
      expiredCount:state.expiredCount, compactedCount:state.compactedCount, rejectedCount:state.rejectedCount,
      retriedCount:state.retriedCount, dupCount:state.dupCount});
    Object.entries(state.topics).forEach(([topic,parts])=>{
      result.topics[topic] = { kind:state.topicMeta?.[topic]?.kind||'main',
        partitions: parts.map((p,i)=>({
          index:i,
          messages:p.messages.length,
          highWatermark:p.hw,
          logStart:p.base,
          produced:p.produced,
          leader:p.leader, replicas:p.replicas, isr:p.isr, offline:p.offline,
        })),
      };
    });
    Object.entries(state.consumerGroups).forEach(([gid,grp])=>{
      // лаг группы = сумма лагов по ЕЁ топикам (каждый топик против своих оффсетов)
      let lag=0; const perTopic={}, perPart={};
      Object.entries(grp.topics||{}).forEach(([topic,offs])=>{
        const parts=state.topics[topic]; if(!parts)return;
        let tLag=0; perPart[topic]={};
        parts.forEach((p,i)=>{ const l=kLagPart(p,offs[i]); perPart[topic][i]=l; tLag+=l; });
        perTopic[topic]=tLag; lag+=tLag;
      });
      result.consumerGroups[gid] = {lag, topics:perTopic, partLag:perPart, members:grp.members||[], assignment:grp.assignment||{},
        blockId:grp.blockId, label:grp.label, generation:grp.generation||0, consumed:grp.consumed||0, failed:grp.failed||0,
        rebalancing:(grp.pause||0)>0||Object.values(grp.paused||{}).some(v=>v>0)};
    });
  } else {
    Object.entries(state.queues).forEach(([q,msgs])=>{
      result.queues[q] = {pending:msgs.length};
    });
  }
  return result;
}

// Очистить состояние брокеров
function resetBrokerStates(){
  Object.keys(BROKER_STATE).forEach(k=>delete BROKER_STATE[k]);
}

// ── Периодическое потребление сообщений (вызывается из simLoop каждые N кадров) ──
// Полностью отвязано от физики шариков: консьюмеры опрашивают брокер асинхронно.
function tickBrokerConsumers(){
  if(typeof S==='undefined') return;
  const conns = S.conns||[];
  Object.keys(BROKER_STATE).forEach(function(bId){
    const b = (typeof gb==='function')?gb(bId):null; if(!b) return;
    const state = BROKER_STATE[bId]; if(!state) return;
    const delivery = (b.settings||{}).delivery || 'at-least-once';

    if(b.type==='kafka'){
      kafkaTick(b,state); // группы, назначение партиций, ретраи/DLQ — kafka-engine.js
    } else {
      // RabbitMQ / Queue / NATS JetStream — дрейним очереди
      Object.values(state.queues||{}).forEach(function(queue){
        var batch = Math.min(3, queue.length);
        for(var i=0;i<batch;i++){
          if(!queue.length) break;
          var fail = Math.random()<0.015;
          if(fail){
            state.dlq.push({...queue[0], failReason:'nack', dlqAt:Date.now()});
            state.failedCount++;
          } else { state.totalConsumed++; }
          queue.shift();
        }
      });
    }
  });
}
