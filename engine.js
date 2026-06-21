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

const HIT_RATE = 0.8;

// ── Эффективная ёмкость с учётом настроек ──────────────────────
function effCap(b){
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
    case 'postgresql': case 'mysql':
      if(s.pgbouncer) cap*=5;
      if(s.replicas) cap*=(1+0.7*s.replicas);
      if(s.isolation==='SERIALIZABLE') cap*=0.6;
      else if(s.isolation==='REPEATABLE READ') cap*=0.85;
      break;
    case 'redis':
      if(s.cluster) cap*=10;
      if(s.persistence==='AOF') cap*=0.7;
      else if(s.persistence==='RDB') cap*=0.9;
      break;
    case 'kafka':
      cap = base.cap*((s.partitions||3)/3);
      if(s.delivery==='exactly-once') cap*=0.5;
      else if(s.delivery==='at-most-once') cap*=1.3;
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
      break; // NATS: ёмкость не зависит от настроек в упрощённой модели
  }
  if(b.down) return Math.max(1,(isFinite(cap)?cap:base.cap)*0.02);
  return cap;
}

// ── Эффективная задержка обработки с учётом настроек ───────────
function baseLat(b){
  const base=BASE[b.type]; let lat=base?base.lat:5; const s=b.settings||{};
  if((b.type==='postgresql'||b.type==='mysql')&&s.isolation==='SERIALIZABLE') lat*=1.4;
  if(b.type==='kafka'&&s.delivery==='exactly-once') lat*=1.5;
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
    const inL=b.rt.lambdaIn;
    const outs=conns.filter(c=>c.from===id);
    if(!outs.length) continue;
    const cat=BASE[b.type]?.cat;
    const isRouter=(cat==='gw'||cat==='net'||cat==='client'||cat==='actor');

    if(isRouter){
      const share=inL/outs.length;
      outs.forEach(c=>{const t=B(c.to);if(t)t.rt.lambdaIn+=share;});
    } else {
      const cache=svcHasCache(b,blocks,conns);
      const isAuth=(b.type==='auth');
      const aRate=isAuth?authPassRate(b):1;
      outs.forEach(c=>{
        const t=B(c.to); if(!t) return;
        const td=BASE[t.type]?.cat;
        let pass=inL;
        if(cache && td==='db') pass=inL*(1-HIT_RATE);
        else if(isAuth && (td==='db'||td==='cache')) pass=inL*aRate; // stateful/stateless
        t.rt.lambdaIn+=pass;
      });
    }
  }

  finalizeFlow(blocks,conns);
  return blocks;
}

// ── РЕАЛИЗМ: нагрузка узла = сумма объёмов сценариев ──
// Учитывает cache hit rate (Cache Aside → DB получает только 20%) и authPassRate.
function computeFlowScenarios(blocks, conns, scenarios){
  const B=id=>blocks.find(x=>x.id===id);
  blocks.forEach(b=>{ b.rt={lambdaIn:0,cap:0,rho:0,dropRate:0,latMul:1,effLat:0,
    health:'ok',cascade:false,cbOpen:false,respTime:0,slowDueTo:null}; });
  (scenarios||[]).forEach(s=>{
    const v=s.volume||0; if(v<=0) return;
    const path=s.path||[];
    const seen=new Set();
    for(let i=0;i<path.length;i++){
      const id=path[i];
      if(seen.has(id))continue;
      seen.add(id);
      const b=B(id);if(!b)continue;
      let vol=v;
      if(i>0){
        const prev=B(path[i-1]);
        if(prev){
          const fc=BASE[prev.type]?.cat,tc=BASE[b.type]?.cat;
          if(svcHasCache(prev,blocks,conns)&&(tc==='db'||tc==='cache'))
            vol=v*(1-HIT_RATE);
          else if(prev.type==='auth'&&(tc==='db'||tc==='cache'))
            vol=v*authPassRate(prev);
        }
      }
      b.rt.lambdaIn+=vol;
    }
  });
  finalizeFlow(blocks,conns);
  return blocks;
}

// ── Общая часть: по lambdaIn считаем загрузку, отказы, задержку, каскады ──
function finalizeFlow(blocks, conns){
  const B=id=>blocks.find(b=>b.id===id);
  blocks.forEach(b=>{
    const cap=effCap(b);
    b.rt.lambdaIn=Math.round(b.rt.lambdaIn);
    b.rt.cap=cap;
    b.rt.rho=isFinite(cap)?(cap>0?b.rt.lambdaIn/cap:99):0;
    const r=b.rt.rho;
    // r≤0.8: нет потерь; r∈(0.8,1): 0→8% линейно; r≥1: max(8%,(λ-cap)/λ) — непрерывно
    b.rt.dropRate=r<=0.8?0:r>=1?Math.min(0.95,Math.max(0.08,1-1/r)):(r-0.8)*0.4;
    b.rt.latMul=r<1?Math.min(1/(1-r),20):20;
    b.rt.effLat=baseLat(b)*b.rt.latMul;
    b.rt.health=r>=0.9?'error':r>=0.6?'warn':'ok';
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
    if((cat==='svc'||cat==='gw') && b.rt.health!=='error' && !b.rt.cbOpen){
      const wait=b.rt.respTime-b.rt.effLat;
      if(wait>Math.max(b.rt.effLat*2,15)){
        b.rt.cascade=true;
        b.rt.slowDueTo=b.rt.slowDep;
        if(b.rt.health==='ok') b.rt.health='warn';
      }
    }
  });
  return blocks;
}

// ══════════════════════════════════════════════════════════════
// МОДЕЛЬ БРОКЕРА — Kafka, RabbitMQ, NATS, Queue
// Сервис может быть одновременно продюсером (produces[]) и консьюмером (consumes[])
// ══════════════════════════════════════════════════════════════
const BROKER_STATE = {}; // keyed by blockId

function initBrokerState(b){
  if(BROKER_STATE[b.id]) return BROKER_STATE[b.id];
  const s = b.settings||{};
  const partitions = s.partitions||3;
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
  if(b.type==='kafka'){
    const topicName = s.topic_name||'events';
    state.topics[topicName] = Array.from({length:partitions}, (_,i)=>({
      index: i,
      messages: [],
    }));
    state.consumerGroups['default-group'] = {
      topics: { [topicName]: Object.fromEntries(Array.from({length:partitions},(_,i)=>[i,0])) },
    };
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

  if(b.type==='kafka'){
    const topic = message.topic || s.topic_name || 'events';
    if(!state.topics[topic]){
      const parts = s.partitions||3;
      state.topics[topic] = Array.from({length:parts},(_,i)=>({index:i,messages:[]}));
    }
    const parts = state.topics[topic];
    const key = message.key||String(Math.random());
    const partIdx = Math.abs(hashStr(key)) % parts.length;
    const msg = {
      offset: parts[partIdx].messages.length,
      key,
      value: message.value||message.body||{},
      timestamp: Date.now(),
      status: 'pending',
      topic,
      partition: partIdx,
    };
    parts[partIdx].messages.push(msg);
    state.totalProduced++;
    return {ack:true, partition:partIdx, offset:msg.offset};
  }

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
    const topic = opts.topic||'default';
    const parts = state.topics[topic];
    if(!parts) return null;
    const offs = grpTopicOffsets(state, groupId, topic, parts.length); // оффсеты СВОЕГО топика
    // ищем партицию с необработанными сообщениями
    for(let pi=0;pi<parts.length;pi++){
      const offset = offs[pi]||0;
      if(offset < parts[pi].messages.length){
        const msg = parts[pi].messages[offset];
        // at-most-once: сразу коммитим
        if(delivery==='at-most-once') offs[pi] = offset+1;
        return {msg, partition:pi, offset, groupId, topic,
          commit: ()=>{ offs[pi]=offset+1; state.totalConsumed++; },
          nack: ()=>{
            state.dlq.push({...msg, failReason:'consumer_error', dlqAt:Date.now()});
            state.failedCount++;
            offs[pi]=offset+1; // пропускаем
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
      Object.keys(offs).forEach(k=>{ offs[k]=0; });
    });
  }
}

// Лаг консьюмера по топику (разница между последним сообщением и оффсетом группы)
function brokerConsumerLag(brokerId, groupId, topic){
  const state = BROKER_STATE[brokerId];
  if(!state) return 0;
  groupId = groupId||'default-group';
  topic = topic||'default';
  const parts = state.topics[topic];
  if(!parts) return 0;
  const offs = state.consumerGroups[groupId]?.topics?.[topic];
  if(!offs) return parts.reduce((a,p)=>a+p.messages.length,0);
  return parts.reduce((a,p,i)=>a+(p.messages.length-(offs[i]||0)),0);
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
    Object.entries(state.topics).forEach(([topic,parts])=>{
      result.topics[topic] = {
        partitions: parts.map((p,i)=>({
          index:i,
          messages:p.messages.length,
          highWatermark:p.messages.length,
        })),
      };
    });
    Object.entries(state.consumerGroups).forEach(([gid,grp])=>{
      // лаг группы = сумма лагов по ЕЁ топикам (каждый топик против своих оффсетов)
      let lag=0; const perTopic={};
      Object.entries(grp.topics||{}).forEach(([topic,offs])=>{
        const parts=state.topics[topic]; if(!parts)return;
        const tLag=parts.reduce((a,p,i)=>a+(p.messages.length-(offs[i]||0)),0);
        perTopic[topic]=tLag; lag+=tLag;
      });
      result.consumerGroups[gid] = {lag, topics:perTopic};
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
      const topicName = (b.settings||{}).topic_name||'events';
      const parts = state.topics[topicName]; if(!parts) return;
      // Нет консьюмеров — lag просто растёт, тик ничего не делает
      const hasCons = conns.some(function(c){return c.from===bId;});
      if(!hasCons) return;
      const offs = grpTopicOffsets(state,'default-group',topicName,parts.length);
      for(var pi=0;pi<parts.length;pi++){
        var off = offs[pi]||0;
        var avail = parts[pi].messages.length - off;
        if(avail<=0) continue;
        // Обрабатываем до 3 сообщений с партиции за тик (~150 msg/s при 30fps)
        var batch = Math.min(3, avail);
        for(var j=0;j<batch;j++){
          // exactly-once без потерь; at-least-once: 2% DLQ; at-most-once: 1% DLQ
          var failP = delivery==='exactly-once'?0 : delivery==='at-most-once'?0.01:0.02;
          if(Math.random()<failP){
            state.dlq.push({offset:off+j, topic:topicName, partition:pi,
              failReason:'consumer_error', dlqAt:Date.now()});
            state.failedCount++;
          } else {
            state.totalConsumed++;
          }
        }
        offs[pi] = off+batch;
      }
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

// RAPTOR v1.1.0
