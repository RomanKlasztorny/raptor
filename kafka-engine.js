// KAFKA-ENGINE — модель Kafka v2 (без DOM): брокеры/реплики/ISR, партиционирование по ключу,
// consumer groups (каждый сервис-подписчик = своя группа, его реплики = члены группы),
// назначение партиций (range / roundrobin / cooperative-sticky), ребаланс, retention/compaction,
// retry-топик + DLQ, хаос (падение брокера). Вызывается из engine.js (initBrokerState/brokerProduce/...).
// Совместимость: старые проекты без новых настроек дают тот же effCap/computeFlow.

const KAFKA_CHAOS = {};            // blockId -> {down:{brokerIdx:true}} — переживает resetBrokerStates
const KAFKA_HOT_SHARE = 0.55;      // доля трафика «горячего» ключа при key_strategy=hot-key

function _kclamp(v,a,b){return Math.max(a,Math.min(b,v));}

// Имя основного топика: настройка → подпись блока (если похожа на имя топика) → 'events'
function kTopicName(b){
  const s=b.settings||{};
  if(s.topic_name) return String(s.topic_name);
  const lbl=(b.customLabel||'').trim();
  if(lbl && /^[A-Za-z0-9._-]+$/.test(lbl)) return lbl;
  return 'events';
}

// Нормализованная конфигурация (дефолты = поведение Kafka 3.x)
function kafkaCfg(b){
  const s=b.settings||{};
  const rf=_kclamp(+s.replication||3,1,5);
  const brokers=Math.max(_kclamp(+s.brokers||3,1,12), rf);
  return {
    topic: kTopicName(b),
    partitions: _kclamp(Math.round(+s.partitions||3),1,64),
    rf, brokers,
    minIsr: _kclamp(+s.min_insync||Math.min(2,rf),1,rf),
    acks: s.acks||'all',
    delivery: s.delivery||'at-least-once',
    assignor: s.assignor||'range',
    keyStrategy: s.key_strategy||'by-entity',
    cleanup: s.cleanup||'delete',
    retention: _kclamp(+s.retention_msgs||300,20,100000),
    retryDlq: s.retry_dlq!==false && !(s.on_error||'').startsWith('redeliver'),
    maxRetries: _kclamp(s.max_retries==null?3:+s.max_retries,0,10),
    pollRate: _kclamp(+s.poll_rate||6,1,100),   // сообщений за тик на одного консьюмера
  };
}

// ── Влияние на аналитическую модель (только явно заданные новые настройки + хаос) ──
function kafkaHotShare(P){ return KAFKA_HOT_SHARE + (1-KAFKA_HOT_SHARE)/Math.max(1,P); }
function kafkaCapMul(b){
  const s=b.settings||{}; let m=1;
  // базовая модель = acks=all (как было); 1/0 — быстрее, но менее надёжно
  if(s.acks==='1') m*=1.1; else if(s.acks==='0') m*=1.2;
  if(s.key_strategy==='hot-key'){
    const P=+s.partitions||3, h=kafkaHotShare(P);
    m*=Math.min(1, 1/(P*h));          // упираемся в одну (лидер-)партицию
  }
  const h=kafkaHealth(b);
  if(h){
    if(h.alive<h.brokers) m*=Math.max(0.05,h.alive/h.brokers);
    if(h.writeBlocked||h.offlineParts>=h.partitions) m*=0.02;
    else if(h.offlineParts) m*=Math.max(0.05,1-h.offlineParts/h.partitions);
  }
  return m;
}
function kafkaLatMul(b){
  const s=b.settings||{};
  if(s.acks==='1') return 0.8; if(s.acks==='0') return 0.5; return 1;
}

// Статическое здоровье кластера по хаосу (без запущенной симуляции тоже работает)
function kafkaHealth(b){
  const ch=KAFKA_CHAOS[b.id]; if(!ch||!Object.keys(ch.down||{}).length) return null;
  const c=kafkaCfg(b); let offline=0, underMin=0;
  for(let p=0;p<c.partitions;p++){
    const reps=kReplicas(p,c); const alive=reps.filter(r=>!ch.down[r]).length;
    if(!alive) offline++; else if(alive<c.minIsr) underMin++;
  }
  const alive=c.brokers-Object.keys(ch.down).filter(k=>ch.down[k]&&+k<c.brokers).length;
  return {brokers:c.brokers, alive, partitions:c.partitions, offlineParts:offline, underMinIsr:underMin,
    writeBlocked: c.acks==='all' && underMin+offline>=c.partitions};
}

// События: для анимации (sim дренирует) + короткий журнал для инспектора
const K_LOG_TYPES={rebalance:1,leader:1,broker_down:1,broker_up:1,dlq:1,expired:1,rejected:1,lost:1,redeliver:1,compacted:0,retry:1};
function kEv(state,e){
  if(!state.events) state.events=[];
  e.tick=state.tick||0; state.events.push(e);
  if(state.events.length>3000) state.events.splice(0,state.events.length-3000);
  if(K_LOG_TYPES[e.type]){ if(!state.log) state.log=[]; const last=state.log[state.log.length-1];
    if(last&&last.type===e.type&&last.gid===(e.gid||null)&&e.type!=='rebalance'&&e.type!=='leader'){ last.n++; last.tick=e.tick; }
    else { state.log.push({type:e.type,gid:e.gid||null,n:1,tick:e.tick,broker:e.broker,partition:e.partition,leader:e.leader,members:e.members,eager:e.eager,error:e.error}); if(state.log.length>40) state.log.shift(); } }
}

function kReplicas(p,c){ const r=[]; for(let i=0;i<c.rf;i++) r.push((p+i)%c.brokers); return r; }

// ── Состояние ──
function kafkaInit(b,state){
  const c=kafkaCfg(b);
  state.kafka=true; state.cfg=c; state.tick=0; state.rr=0;
  state.topicMeta={}; state.events=[]; state.log=[]; state.rebalances=0;
  state.expiredCount=0; state.compactedCount=0; state.rejectedCount=0; state.retriedCount=0; state.dupCount=0;
  state.brokers=Array.from({length:c.brokers},(_,i)=>({id:i, up:!(KAFKA_CHAOS[b.id]?.down?.[i])}));
  kEnsureTopic(state,c.topic,'main');
  kafkaSyncGroups(b,state);
  return state;
}

function kEnsureTopic(state,name,kind){
  if(state.topics[name]) return state.topics[name];
  const c=state.cfg;
  const P=kind==='dlq'?1:c.partitions;
  state.topics[name]=Array.from({length:P},(_,i)=>{
    const replicas=kReplicas(i,c);
    const part={index:i, messages:[], base:0, hw:0, replicas, isr:replicas.slice(), leader:replicas[0], offline:false, produced:0, catchUp:{}};
    kRefreshPartition(state,part);
    return part;
  });
  state.topicMeta[name]={kind};
  return state.topics[name];
}
function kUp(state,i){ return !!(state.brokers[i]&&state.brokers[i].up); }
function kRefreshPartition(state,part){
  part.isr=part.isr.filter(r=>kUp(state,r));
  if(part.leader==null||!kUp(state,part.leader)){
    const prev=part.leader;
    part.leader=part.isr.length?part.isr[0]:null;     // чистые выборы лидера только из ISR
    if(prev!==part.leader && part.leader!=null) kEv(state,{type:'leader',partition:part.index,leader:part.leader});
  }
  part.offline=part.leader==null;
}

// Хаос: уронить / поднять брокер
function kafkaSetBrokerUp(blockId, idx, up){
  if(!KAFKA_CHAOS[blockId]) KAFKA_CHAOS[blockId]={down:{}};
  if(up) delete KAFKA_CHAOS[blockId].down[idx]; else KAFKA_CHAOS[blockId].down[idx]=true;
  const state=BROKER_STATE[blockId];
  if(state&&state.kafka&&state.brokers[idx]){
    state.brokers[idx].up=!!up;
    Object.values(state.topics).forEach(parts=>parts.forEach(p=>{
      if(up){ if(p.replicas.includes(idx)&&!p.isr.includes(idx)) p.catchUp[idx]=3; } // догоняет 3 тика → в ISR
      kRefreshPartition(state,p);
    }));
    kEv(state,{type:up?'broker_up':'broker_down',broker:idx});
  }
}
function kafkaResetChaos(blockId){ delete KAFKA_CHAOS[blockId]; const st=BROKER_STATE[blockId];
  if(st&&st.kafka){ st.brokers.forEach(x=>x.up=true); Object.values(st.topics).forEach(ps=>ps.forEach(p=>{p.isr=p.replicas.slice();kRefreshPartition(st,p);})); } }

// ── Ключи и партиционер ──
function kGenKey(c){
  if(c.keyStrategy==='null') return null;
  if(c.keyStrategy==='hot-key' && Math.random()<KAFKA_HOT_SHARE) return 'celebrity-42';
  return 'id-'+Math.floor(Math.random()*5000);
}
function kPartitionFor(state,parts,key){
  if(key==null){ state.rr=(state.rr+1)%parts.length; return state.rr; } // sticky/round-robin
  return Math.abs(hashStr(String(key)))%parts.length;               // murmur2 в реальности; тут простой hash
}

function kAppend(state,part,msg){
  msg.offset=part.hw++; part.messages.push(msg); part.produced++;
  kRetention(state,part,msg.topic);
}

// Retention (delete) / log compaction (compact)
function kRetention(state,part,topic){
  const c=state.cfg; if(part.messages.length<=c.retention) return;
  const minOff=kMinCommitted(state,topic,part.index);
  if(c.cleanup==='compact'){
    const lastByKey={}; part.messages.forEach((m,i)=>{ if(m.key!=null) lastByKey[m.key]=i; });
    const head=part.messages.length-Math.floor(c.retention/2);   // «активный сегмент» не трогаем
    const keep=[];
    part.messages.forEach((m,i)=>{
      if(i>=head || m.key==null || lastByKey[m.key]===i) keep.push(m);
      else { state.compactedCount++; if(m.offset>=minOff) kEv(state,{type:'compacted',msg:m}); }
    });
    part.messages=keep;
    while(part.messages.length>c.retention){ const m=part.messages.shift(); kExpire(state,m,minOff); }
  } else {
    while(part.messages.length>c.retention){ const m=part.messages.shift(); kExpire(state,m,minOff); }
  }
  part.base=part.messages.length?part.messages[0].offset:part.hw;
}
function kExpire(state,m,minOff){
  if(m.offset>=minOff){ state.expiredCount++; kEv(state,{type:'expired',msg:m}); }
}
function kMinCommitted(state,topic,pi){
  let mn=Infinity;
  Object.values(state.consumerGroups).forEach(g=>{ const o=g.topics?.[topic]; if(o&&g.members&&g.members.length) mn=Math.min(mn,o[pi]||0); });
  return mn===Infinity?0:mn;
}

// Продюсер
function kafkaProduce(b,state,message){
  const c=state.cfg; message=message||{};
  const topic=message.topic||c.topic;
  const kind=topic.endsWith('.dlq')?'dlq':topic.endsWith('.retry')?'retry':'main';
  const parts=kEnsureTopic(state,topic,kind);
  if(kind==='retry'&&message.forGroup&&!state.topicMeta[topic].group) state.topicMeta[topic].group=message.forGroup;
  const key=('key' in message)?message.key:kGenKey(c);
  const pi=message.partition!=null?message.partition%parts.length:kPartitionFor(state,parts,key);
  const part=parts[pi];
  kRefreshPartition(state,part);
  state.totalProduced++;
  if(part.offline){
    state.rejectedCount++; kEv(state,{type:'rejected',error:'LEADER_NOT_AVAILABLE',partition:pi,reqId:message.reqId});
    if(c.acks==='0'){ state.lostCount++; return {ack:true,lost:true,partition:pi,error:'OFFLINE_PARTITION'}; }
    return {ack:false,partition:pi,error:'LEADER_NOT_AVAILABLE'};
  }
  if(c.acks==='all' && part.isr.length<c.minIsr){
    state.rejectedCount++; kEv(state,{type:'rejected',error:'NOT_ENOUGH_REPLICAS',partition:pi,reqId:message.reqId});
    return {ack:false,partition:pi,error:'NOT_ENOUGH_REPLICAS'};
  }
  const msg={key, value:message.value||message.body||{}, timestamp:Date.now(), status:'pending', topic, partition:pi,
    attempt:message.attempt||0, readyTick:message.readyTick||0, reqId:message.reqId||(message.value&&message.value.req)||null, origTopic:message.origTopic||null};
  kAppend(state,part,msg);
  return {ack:true, partition:pi, offset:msg.offset, key, leader:part.leader, isr:part.isr.length};
}

// ── Consumer groups ──
function kRetryTopic(base,gid){ return base+'.'+String(gid).replace(/-group$/,'')+'.retry'; }
function kGroupId(cb){
  const s=cb.settings||{};
  if(s.group_id) return String(s.group_id);
  const base=(cb.customLabel||cb.type||'svc').toString().toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-').replace(/^-|-$/g,'');
  return (base||'svc')+'-group';
}
function kInstances(cb){ const s=cb.settings||{}; return _kclamp(+(s.replicas||s.workers||s.instances||1),1,32); }

function kafkaSyncGroups(b,state){
  if(typeof S==='undefined') return;
  const c=state.cfg;
  const consumers=(S.conns||[]).filter(x=>x.from===b.id).map(x=>gb(x.to)).filter(Boolean);
  const seen={};
  consumers.forEach(cb=>{
    const gid=kGroupId(cb); seen[gid]=true;
    let g=state.consumerGroups[gid];
    if(!g) g=state.consumerGroups[gid]={gid, blockId:cb.id, topics:{}, members:[], assignment:{}, generation:0, pause:0, paused:{}, consumed:0, failed:0, sig:''};
    g.blockId=cb.id; g.label=cb.customLabel||(typeof NAMES!=='undefined'&&NAMES[cb.type])||cb.type;
    const subs=Object.keys(state.topics).filter(t=>{ const m=state.topicMeta[t]; return m&&(m.kind==='main'||(m.kind==='retry'&&(!m.group||m.group===gid))); });
    subs.forEach(t=>{ if(!g.topics[t]) g.topics[t]=Object.fromEntries(state.topics[t].map(p=>[p.index,p.base])); });
    const n=kInstances(cb)*(cb.down?0:1);
    const sig=n+'|'+c.assignor+'|'+subs.join(',');
    if(sig!==g.sig){ kRebalance(state,g,n,subs,g.sig!==''); g.sig=sig; }
  });
  Object.values(state.consumerGroups).forEach(g=>{ if(!seen[g.gid]&&g.members&&g.members.length){ g.members=[]; g.assignment={}; } });
}

// Назначение партиций. members: ['c0','c1',...]; tps: [{t,p}]
function kAssign(strategy,members,tps,prev){
  const out={}; members.forEach(m=>out[m]=[]);
  if(!members.length) return out;
  if(strategy==='roundrobin'){
    tps.slice().sort((a,b)=>a.t<b.t?-1:a.t>b.t?1:a.p-b.p).forEach((tp,i)=>out[members[i%members.length]].push(tp));
    return out;
  }
  if(strategy==='cooperative-sticky' && prev){
    const key=tp=>tp.t+'#'+tp.p, valid=new Set(tps.map(key)), taken=new Set();
    members.forEach(m=>(prev[m]||[]).forEach(tp=>{ if(valid.has(key(tp))&&!taken.has(key(tp))){out[m].push(tp);taken.add(key(tp));} }));
    const free=tps.filter(tp=>!taken.has(key(tp)));
    const target=Math.ceil(tps.length/members.length);
    members.forEach(m=>{ while(out[m].length>target) free.push(out[m].pop()); });
    free.forEach(tp=>{ const m=members.slice().sort((a,b)=>out[a].length-out[b].length)[0]; out[m].push(tp); });
    return out;
  }
  // range: по каждому топику отдельно, первые члены получают «лишние» партиции
  const byT={}; tps.forEach(tp=>(byT[tp.t]=byT[tp.t]||[]).push(tp));
  Object.values(byT).forEach(list=>{
    list.sort((a,b)=>a.p-b.p);
    const per=Math.floor(list.length/members.length), extra=list.length%members.length; let k=0;
    members.forEach((m,i)=>{ const n=per+(i<extra?1:0); for(let j=0;j<n;j++) out[m].push(list[k++]); });
  });
  return out;
}

function kRebalance(state,g,n,subs,isRe){
  const c=state.cfg;
  const members=Array.from({length:n},(_,i)=>g.gid.replace(/-group$/,'')+'-'+(i+1));
  const tps=[]; subs.forEach(t=>state.topics[t].forEach(p=>tps.push({t,p:p.index})));
  const prev=g.assignment;
  const next=kAssign(c.assignor,members,tps,prev);
  g.members=members; g.assignment=next; g.generation++;
  if(isRe){
    state.rebalances++;
    if(c.assignor==='cooperative-sticky'){
      // инкрементальный: стоят только переехавшие партиции
      const owner={}; Object.entries(prev||{}).forEach(([m,l])=>l.forEach(tp=>owner[tp.t+'#'+tp.p]=m));
      g.paused={}; Object.entries(next).forEach(([m,l])=>l.forEach(tp=>{ const k=tp.t+'#'+tp.p; if(owner[k]&&owner[k]!==m) g.paused[k]=2; }));
    } else g.pause=2;   // eager: stop-the-world для всей группы
    kEv(state,{type:'rebalance',gid:g.gid,members:n,eager:c.assignor!=='cooperative-sticky'});
  }
}

// Чтение по оффсету (с учётом дыр после compaction)
function kReadAt(part,off){
  const ms=part.messages; let lo=0,hi=ms.length;
  while(lo<hi){const mid=(lo+hi)>>1; if(ms[mid].offset<off) lo=mid+1; else hi=mid;}
  return lo<ms.length?ms[lo]:null;
}
function kLagPart(part,off){ return Math.max(0, part.hw-Math.max(off||0,part.base)); }

// ── Тик консьюмеров ──
function kafkaTick(b,state){
  const c=state.cfg; state.tick++;
  kafkaSyncGroups(b,state);
  // реплики догоняют лидера → возвращаются в ISR
  Object.values(state.topics).forEach(parts=>parts.forEach(p=>{
    Object.keys(p.catchUp).forEach(r=>{ if(!kUp(state,+r)){delete p.catchUp[r];return;} if(--p.catchUp[r]<=0){ delete p.catchUp[r]; if(!p.isr.includes(+r)) p.isr.push(+r); kRefreshPartition(state,p);} });
  }));
  const failBase=c.delivery==='exactly-once'?0.004:c.delivery==='at-most-once'?0.01:0.02;
  Object.values(state.consumerGroups).forEach(g=>{
    if(!g.members||!g.members.length) return;
    if(g.pause>0){ g.pause--; return; }
    const cb=gb(g.blockId);
    const hl=cb&&cb.rt?cb.rt.health:'ok';
    const factor=(cb&&cb.down)?0:hl==='error'?0.4:hl==='warn'?0.75:1;
    const failP=failBase+(hl==='error'?0.25:0);
    g.members.forEach(m=>{
      let budget=Math.max(0,Math.round(c.pollRate*factor));
      const list=(g.assignment[m]||[]).filter(tp=>{const k=tp.t+'#'+tp.p; if(g.paused[k]>0){g.paused[k]--;return false;} return true;});
      let progress=true;
      while(budget>0&&progress){
        progress=false;
        for(const tp of list){
          if(budget<=0) break;
          const part=state.topics[tp.t]&&state.topics[tp.t][tp.p]; if(!part||part.offline) continue;
          const offs=g.topics[tp.t]||(g.topics[tp.t]={});
          let off=Math.max(offs[tp.p]||0,part.base);
          const msg=kReadAt(part,off); if(!msg) { offs[tp.p]=Math.max(off,part.hw); continue; }
          if(msg.readyTick>state.tick) continue;          // backoff retry-топика (head-of-line)
          budget--; progress=true;
          const ok=Math.random()>=failP;
          if(ok){
            offs[tp.p]=msg.offset+1; g.consumed++; state.totalConsumed++;
            kEv(state,{type:'consumed',gid:g.gid,blockId:g.blockId,member:m,msg});
          } else kFail(b,state,g,m,msg,offs,tp);
        }
      }
    });
  });
}

function kFail(b,state,g,m,msg,offs,tp){
  const c=state.cfg; g.failed++; state.failedCount++;
  if(c.delivery==='at-most-once'){        // оффсет уже закоммичен до обработки → потеря
    offs[tp.p]=msg.offset+1; state.lostCount++;
    kEv(state,{type:'lost',gid:g.gid,blockId:g.blockId,msg}); return;
  }
  if(!c.retryDlq){                        // без retry/DLQ: не коммитим → повторная доставка (дубль)
    state.dupCount++; kEv(state,{type:'redeliver',gid:g.gid,blockId:g.blockId,msg}); return;
  }
  offs[tp.p]=msg.offset+1;
  const base=msg.origTopic||c.topic;
  if((msg.attempt||0)<c.maxRetries){
    const att=(msg.attempt||0)+1;
    // retry-топик — свой у каждой группы (иначе другие группы получили бы дубль)
    kafkaProduce(b,state,{topic:kRetryTopic(base,g.gid),forGroup:g.gid,key:msg.key,value:msg.value,attempt:att,readyTick:state.tick+Math.pow(2,att-1),reqId:msg.reqId,origTopic:base});
    state.retriedCount++;
    kafkaSyncGroups(b,state);
    kEv(state,{type:'retry',gid:g.gid,blockId:g.blockId,msg,attempt:att});
  } else {
    const r=kafkaProduce(b,state,{topic:base+'.dlq',key:msg.key,value:msg.value,attempt:msg.attempt,reqId:msg.reqId,origTopic:base,partition:0});
    state.dlq.push({...msg,failReason:'consumer_error',group:g.gid,dlqAt:Date.now()});
    kEv(state,{type:'dlq',gid:g.gid,blockId:g.blockId,msg,ok:r&&r.ack});
  }
}

// Перезалить DLQ в основной топик (redrive)
function kafkaRedriveDlq(blockId){
  const b=gb(blockId), st=BROKER_STATE[blockId]; if(!b||!st||!st.kafka) return 0;
  let n=0;
  Object.keys(st.topics).filter(t=>st.topicMeta[t]?.kind==='dlq').forEach(t=>{
    const p=st.topics[t][0];
    p.messages.forEach(m=>{ kafkaProduce(b,st,{topic:m.origTopic||st.cfg.topic,key:m.key,value:m.value,attempt:0,reqId:m.reqId}); n++; });
    p.messages=[]; p.base=p.hw;
  });
  st.dlq=[];
  return n;
}

// Достать накопившиеся события (для анимации шариков)
function kafkaDrainEvents(blockId){ const st=BROKER_STATE[blockId]; if(!st||!st.events) return []; const e=st.events; st.events=[]; return e; }

// ── Аналитика для computeFlow: группы, активные/idle консьюмеры, скорость роста лага ──
function kafkaAnnotateFlow(blocks,conns){
  blocks.forEach(b=>{
    if(b.type!=='kafka'||!b.rt) return;
    const c=kafkaCfg(b), lam=b.rt.lambdaIn||0;
    const hot=c.keyStrategy==='hot-key'?kafkaHotShare(c.partitions):1/c.partitions;
    const groups=conns.filter(x=>x.from===b.id).map(x=>blocks.find(y=>y.id===x.to)).filter(Boolean).map(cb=>{
      const inst=kInstances(cb), active=Math.min(inst,c.partitions);
      const perInst=effCap(cb)/inst;
      // самый загруженный консьюмер: тот, кому достался горячий / «лишний» кусок партиций
      const maxShare=Math.max(hot, Math.ceil(c.partitions/active)/c.partitions);
      const thr=Math.min(active*perInst, perInst/Math.max(maxShare,1e-9));
      return {gid:kGroupId(cb), blockId:cb.id, instances:inst, active, idle:inst-active, throughput:Math.round(thr), lagGrowth:Math.max(0,Math.round(lam-thr))};
    });
    b.rt.kafka={topic:c.topic, partitions:c.partitions, rf:c.rf, minIsr:c.minIsr, hotShare:hot, groups, health:kafkaHealth(b)};
    const pp=kafkaPartitionLoad(b,c,lam,groups.map(g=>blocks.find(y=>y.id===g.blockId)));
    b.rt.kafka.parts=pp.parts; b.rt.kafka.hotPart=pp.hotPart; b.rt.kafka.partCap=pp.partCap;
  });
}

// ── Нагрузка по партициям (та же модель, что effCap/kafkaCapMul, только разложенная по P) ──
// λp: hot-key — горячая партиция (hash('celebrity-42')%P, как в симуляции) получает kafkaHotShare(P),
// остальные — поровну; by-entity / null — равномерно. Ёмкость партиции = ёмкость топика без штрафа
// hot-key / P. Лаг: на каждую группу range-назначение партиций членам, член делит свою ёмкость
// между своими партициями; lagGrowth = max(0, λp − скорость чтения), берём худшую группу.
// Если идёт симуляция — добавляем фактический лаг (partLag) из BROKER_STATE.
function kafkaPartitionLoad(b,c,lam,consumers){
  c=c||kafkaCfg(b); const P=c.partitions, rt=b.rt||{};
  const hotKey=c.keyStrategy==='hot-key';
  const h=hotKey?kafkaHotShare(P):1/P;
  const hotIdx=hotKey?Math.abs(hashStr('celebrity-42'))%P:-1;
  const hotMul=hotKey?Math.min(1,1/(P*h)):1;
  const partCap=(rt.cap&&isFinite(rt.cap))?rt.cap/hotMul/P:Infinity;
  const ch=KAFKA_CHAOS[b.id]?.down||{};
  const st=(typeof BROKER_STATE!=='undefined')?BROKER_STATE[b.id]:null;
  const simParts=st&&st.kafka&&st.topics?st.topics[c.topic]:null;
  const parts=[];
  for(let p=0;p<P;p++){
    const share=hotKey?(p===hotIdx?h:(1-KAFKA_HOT_SHARE)/P):1/P;
    const lp=lam*share;
    const offline=kReplicas(p,c).every(r=>ch[r]);
    parts.push({index:p, share, lambda:Math.round(lp), cap:Math.round(partCap), rho:partCap>0&&isFinite(partCap)?lp/partCap:0,
      hot:p===hotIdx, offline, lagGrowth:0, lagGid:null, simLag:null, messages:simParts&&simParts[p]?simParts[p].messages.length:null});
  }
  (consumers||[]).forEach(cb=>{
    if(!cb) return;
    const inst=kInstances(cb), active=Math.min(inst,P), perInst=effCap(cb)/inst;
    const base=Math.floor(P/active), extra=P%active; let p=0;
    for(let m=0;m<active;m++){
      const own=base+(m<extra?1:0), rate=perInst/Math.max(1,own);
      for(let k=0;k<own;k++,p++){ const g=Math.max(0,Math.round(parts[p].lambda-rate));
        if(g>parts[p].lagGrowth){ parts[p].lagGrowth=g; parts[p].lagGid=kGroupId(cb); } }
    }
  });
  if(simParts&&st.consumerGroups) Object.values(st.consumerGroups).forEach(g=>{
    if(!g.members||!g.members.length) return;
    const offs=(g.topics&&g.topics[c.topic])||{};
    parts.forEach(x=>{ const sp=simParts[x.index]; if(!sp) return;
      const l=kLagPart(sp,offs[x.index]); if(x.simLag==null||l>x.simLag) x.simLag=l; });
  });
  return {parts, hotPart:hotIdx, partCap:Math.round(partCap)};
}
