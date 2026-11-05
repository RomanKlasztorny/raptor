// C4-ZOOM — семантический зум C1…C4 прямо на рабочем холсте.
// Модель одна: блоки/связи/сценарии из S. Компоненты сервиса (C3) и их код (C4)
// выводятся из того, что уже известно о блоке (методы связей, шаги сценариев,
// исходящие связи в БД/кэш/брокеры/внешние системы), либо берутся из b.components,
// если пользователь задал их вручную. Состояние зума (ZS) — временное, в файл не пишется.
//   C1 Context   — внутренние блоки сворачиваются в одну рамку «Software System»
//   C2 Container — обычный холст
//   C3 Component — один сервис раскрыт на месте: контроллеры → сервисы → адаптеры
//   C4 Code      — классы/функции одного компонента
const ZS={l1:false,svc:null,comp:null,p:0,pc:0,bound:false,model:null,sys:null,sel:null,_anim:{},_view:null};
// Пороги масштаба (с гистерезисом, чтобы уровень не дребезжал на границе)
const ZS_T={l1In:0.5,l1Out:0.58,l3In:1.5,l3Out:1.3,l4In:2.3,l4Out:2.05,zMin:0.3,zMax:3.2};
const ZS_KINDS=['ctrl','cons','uc','repo','cache','prod','cli'];
const ZS_COL={ctrl:0,cons:0,uc:1,repo:2,cache:2,prod:2,cli:2,lsn:0,flt:1,rt:2,topic:0,part:1,grp:2,pool:0,tbl:1,idx:2,key:1};
const ZS_KCLR={ctrl:'#7aa2f7',cons:'#bb9af7',uc:'#9ece6a',repo:'#e0af68',cache:'#f7768e',prod:'#bb9af7',cli:'#9399b2',lsn:'#7aa2f7',flt:'#e0af68',rt:'#9ece6a',topic:'#bb9af7',part:'#7dcfff',grp:'#9ece6a',pool:'#7aa2f7',tbl:'#e0af68',idx:'#9399b2',key:'#f7768e'};
const ZS_G={cw:146,ch:36,gx:40,gy:10,pad:14,head:24};
const ZS_SYS_OUT=new Set(['actor','client','external']);

function zsActive(){return (S.view||'workspace')==='workspace'&&S.notationMode!=='bpmn';}
const ZS_EXP=new Set(['svc','gw','broker','queue','db','cache']);
function zsExpandable(b){return !!b&&ZS_EXP.has(BASE[b.type]?.cat);}
function zsIsSvc(b){return !!b&&BASE[b.type]?.cat==='svc';}
function zsLevel(){return ZS.l1?1:ZS.comp?4:ZS.svc?3:2;}
function zsKindLbl(k){return t('zs_k_'+k);}

// Следующий уровень по масштабу z. cur — текущий уровень, hit — что под курсором.
// Чистая функция (покрыта тестами).
function zsLevelFor(z,cur,hit){
  hit=hit||{};
  if(cur===1){if(z>ZS_T.l1Out)cur=2;else return 1;}
  if(z<ZS_T.l1In)return 1;
  if(cur===4){if(z<ZS_T.l4Out)cur=3;else return 4;}
  if(cur===3){if(z<ZS_T.l3Out)return 2;return (z>=ZS_T.l4In&&hit.comp)?4:3;}
  return (z>=ZS_T.l3In&&hit.svc)?3:2;
}

// ── имена ────────────────────────────────────────────────────────
const _ZS_TR={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
function zsTranslit(s){return String(s).replace(/[а-яё]/gi,ch=>{const l=ch.toLowerCase(),r=_ZS_TR[l]??'';return ch===l?r:r.charAt(0).toUpperCase()+r.slice(1);});}
// «transfer-events» → TransferEvents, «SWIFT / Платёжный шлюз» → Swift, «Антифрод» → Antifrod
function zsIdent(s){
  s=String(s||'');
  let words=s.match(/[A-Za-z][A-Za-z0-9]*/g);
  if(!words)words=zsTranslit(s).match(/[A-Za-z][A-Za-z0-9]*/g)||[];
  const out=[];
  words.forEach(w=>{(w.match(/[A-Z]{2,}(?![a-z])|[A-Z]?[a-z0-9]+|[A-Z]+/g)||[w]).forEach(p=>out.push(p.charAt(0).toUpperCase()+p.slice(1).toLowerCase()));});
  return out.join('').slice(0,32);
}
function zsLbl(b){return b?(b.customLabel||EL[b.type]?.lbl||b.id):'?';}
// Ресурс из URI: /api/v1/transfers/{id} → transfers
function zsResource(uri){
  const segs=String(uri||'').split('?')[0].split(/[\/\s]+/).filter(x=>x&&!/^api$/i.test(x)&&!/^v\d+$/i.test(x)&&!/^[{:]/.test(x));
  return segs[0]||'';
}
function zsSing(s){return s.replace(/ies$/,'y').replace(/(s)$/,'');}

// Эндпоинты/операции одной связи: метод связи + шаги сценариев по этому хопу
function zsOps(c){
  const ops=[],seen=new Set();
  const add=(verb,uri)=>{verb=String(verb||'').trim();uri=String(uri||'').trim();if(!verb&&!uri)return;const k=verb+' '+uri;if(seen.has(k))return;seen.add(k);ops.push({verb,uri});};
  if(c.method&&(c.method.verb||c.method.uri))add(c.method.verb,c.method.uri);
  (S.scenarios||[]).forEach(s=>{const p=s.path||[];for(let i=0;i<p.length-1;i++)if(p[i]===c.from&&p[i+1]===c.to){const st=(s.steps||[])[i];if(st)add(st.verb,st.uri);}});
  return ops;
}
// Вид компонента-адаптера для внешнего конца связи
function zsExitKind(o){const cat=BASE[o?.type]?.cat;return cat==='db'?'repo':cat==='cache'?'cache':(cat==='broker'||cat==='queue')?'prod':'cli';}
function zsExitName(o,ops){
  const k=zsExitKind(o);
  if(k==='repo'){const tb=ops.map(x=>x.uri).find(u=>/^[A-Za-z_][\w.]*$/.test(u));return zsIdent(tb||zsLbl(o).replace(/\s*DB$/i,''))+'Repository';}
  if(k==='cache')return zsIdent(zsLbl(o))+'Adapter';
  if(k==='prod')return zsIdent(zsLbl(o))+'Producer';
  return zsIdent(zsLbl(o))+'Client';
}

// ── модель компонентов сервиса ─────────────────────────────────
// {svc, comps:[{id,name,kind,col,x,y,w,h,ops,target,auto}], links:[[a,b]], bind:{connId:compId}, byId, frame}
function zsAutoComps(b){
  const cat=BASE[b.type]?.cat;if(cat!=='svc'){const r=zsInfraComps(b,cat);if(r)return r;}
  const comps=[],bind={},links=[],byName={};
  const svcId=zsIdent(zsLbl(b))||'Core';
  const mk=(name,kind,extra)=>{let c=byName[name];if(!c){c=Object.assign({id:'a'+comps.length,name,kind,ops:[],targets:[]},extra||{});comps.push(c);byName[name]=c;}return c;};
  const ins=S.conns.filter(c=>c.to===b.id&&c.from!==b.id),outs=S.conns.filter(c=>c.from===b.id&&c.to!==b.id);
  const ctrlOf={};
  ins.forEach(c=>{
    const o=gb(c.from);const cat=BASE[o?.type]?.cat;
    if(cat==='broker'||cat==='queue'){const k=mk(zsIdent(zsLbl(o))+'Consumer','cons',{topic:zsLbl(o)});k.targets.push(o.id);bind[c.id]=k.id;return;}
    const ops=zsOps(c);
    const res=ops.map(x=>zsResource(x.uri)).find(Boolean)||'';
    const k=mk((res?zsIdent(res):svcId)+'Controller','ctrl',{res});
    ops.forEach(x=>{if(!k.ops.some(y=>y.verb===x.verb&&y.uri===x.uri))k.ops.push(x);});
    k.targets.push(o?.id);bind[c.id]=k.id;ctrlOf[c.id]=k;
  });
  // use-case на каждый ресурс контроллера; если контроллеров нет — один доменный сервис
  const ucs={};
  comps.filter(c=>c.kind==='ctrl').forEach(k=>{const u=mk((k.res?zsIdent(k.res):svcId)+'Service','uc');u.ops=k.ops.slice();ucs[k.id]=u;links.push([k.id,u.id]);});
  if(!Object.keys(ucs).length&&!comps.some(c=>c.kind==='uc'))mk(svcId+'Service','uc');
  const allUc=comps.filter(c=>c.kind==='uc');
  comps.filter(c=>c.kind==='cons').forEach(k=>links.push([k.id,allUc[0].id]));
  outs.forEach(c=>{
    const o=gb(c.to);if(!o)return;const ops=zsOps(c);
    const k=mk(zsExitName(o,ops),zsExitKind(o),{clr:EL[o.type]?.clr});
    ops.forEach(x=>{if(!k.ops.some(y=>y.verb===x.verb&&y.uri===x.uri))k.ops.push(x);});
    k.targets.push(o.id);bind[c.id]=k.id;
    // какой use-case зовёт адаптер: по сценариям вход→сервис→выход
    const users=new Set();
    (S.scenarios||[]).forEach(s=>{const p=s.path||[];for(let i=1;i<p.length-1;i++)if(p[i]===b.id&&p[i+1]===o.id){const ic=ins.find(x=>x.from===p[i-1]);const u=ic&&ucs[bind[ic.id]];if(u)users.add(u.id);}});
    if(!users.size)users.add(allUc[0].id);
    users.forEach(u=>{if(!links.some(l=>l[0]===u&&l[1]===k.id))links.push([u,k.id]);});
  });
  return {comps,links,bind};
}
// ── C3 для инфраструктурных блоков: Gateway, брокеры, БД, кэш ──
// Компоненты строятся из настроек блока (SETTINGS_DEF), паттернов, dbSchema и связей — без отдельной модели
function zsSet(b,k){const v=b.settings&&b.settings[k];if(v!==undefined&&v!=='')return v;const d=(typeof SETTINGS_DEF!=='undefined'&&SETTINGS_DEF[b.type]||[]).find(x=>x.k===k);return d?d.def:undefined;}
function zsPat(b,p){return Array.isArray(b.patterns)&&b.patterns.includes(p);}
function zsSlug(s){return zsTranslit(String(s||'')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'svc';}
function zsTopicName(b){return (b.settings&&b.settings.topic_name)||b.customLabel||zsSet(b,'topic_name')||'events';}
const ZS_GW_AUTH={'JWT (встроенный)':'JwtAuthFilter','OAuth2 Introspection':'OAuth2IntrospectionFilter','Session Cookie':'SessionCookieFilter','API Key':'ApiKeyFilter'};
function zsInfraComps(b,cat){
  const comps=[],bind={},links=[],dest={};
  const mk=(name,kind,extra)=>{const c=Object.assign({id:'a'+comps.length,name,kind,ops:[],targets:[]},extra||{});comps.push(c);return c;};
  const ins=S.conns.filter(c=>c.to===b.id&&c.from!==b.id),outs=S.conns.filter(c=>c.from===b.id&&c.to!==b.id);
  const chain=arr=>{for(let i=1;i<arr.length;i++)links.push([arr[i-1].id,arr[i].id]);};
  let colNames=null;
  if(cat==='gw'){
    colNames=['listener','filters','routes'];
    const ws=b.type==='websocket_gw';
    const lsn=mk(ws?'WebSocketListener':'HttpListener','lsn',{sub:ws?`:443 · wss · max ${zsSet(b,'maxConn')||10000}`:`:8080 · ${zsSet(b,'instances')||1} inst`});
    ins.forEach(c=>{bind[c.id]=lsn.id;lsn.targets.push(c.from);});
    const fl=[];
    const am=zsSet(b,'auth_mode');
    const isAuth=o=>o&&o.type==='auth',authC=outs.filter(c=>isAuth(gb(c.to)));
    if(!ws&&am&&ZS_GW_AUTH[am])fl.push(mk(ZS_GW_AUTH[am],'flt',{sub:am==='JWT (встроенный)'?'verify JWT (local)':am==='API Key'?'X-API-Key':(authC.length?'→ '+zsLbl(gb(authC[0].to)):am),role:'auth',mode:am}));
    if(!ws)fl.push(mk('RateLimitFilter','flt',{sub:zsPat(b,'rate_limit')?`${zsSet(b,'rate_limit_rps')} rps · 429`:'off',role:'rl',on:zsPat(b,'rate_limit')}));
    if(zsPat(b,'circuit_breaker'))fl.push(mk('CircuitBreakerFilter','flt',{sub:'fallback: 503',role:'cb'}));
    if(zsPat(b,'timeout'))fl.push(mk('TimeoutFilter','flt',{sub:'response-timeout 3s',role:'to'}));
    fl.push(mk('TraceIdFilter','flt',{sub:'X-Request-Id',role:'trace'}));
    links.push([lsn.id,fl[0].id]);chain(fl);
    const af=fl.find(x=>x.role==='auth');
    outs.forEach(c=>{
      const o=gb(c.to);if(!o)return;
      if(af&&isAuth(o)){bind[c.id]=af.id;af.targets.push(o.id);return;}
      const ops=zsOps(c),res=ops.map(x=>zsResource(x.uri)).find(Boolean)||zsSlug(zsLbl(o));
      const r=mk('route: '+zsLbl(o),'rt',{ops,res,sub:`/api/v1/${res}/** → lb://${zsSlug(zsLbl(o))}`});
      r.targets.push(o.id);bind[c.id]=r.id;links.push([fl[fl.length-1].id,r.id]);
    });
  }else if(cat==='broker'||cat==='queue'){
    const kafka=b.type==='kafka',tn=zsTopicName(b);
    if(kafka){
      colNames=['topic','partitions','consumer groups'];
      const N=+zsSet(b,'partitions')||3,RF=+zsSet(b,'replication')||1,BR=+zsSet(b,'brokers')||1;
      const tp=mk(tn,'topic',{sub:`${N} part · RF ${RF} · ${zsSet(b,'cleanup')||'delete'}`,topic:tn});
      ins.forEach(c=>{bind[c.id]=tp.id;tp.targets.push(c.from);});
      const shown=Math.min(N,6),parts=[];
      for(let i=0;i<shown;i++)parts.push(mk(`P${i}`+(i===shown-1&&N>shown?` … P${N-1}`:''),'part',{sub:`leader broker-${i%BR+1} · ISR ${Math.min(RF,BR)}`,pi:i,leader:i%BR+1}));
      parts.forEach(p=>links.push([tp.id,p.id]));
      outs.forEach(c=>{const o=gb(c.to);if(!o)return;
        const rep=+(o.settings&&(o.settings.replicas||o.settings.instances))||1;
        const g=mk(zsSlug(zsLbl(o))+'-group','grp',{sub:`${rep} cons · ${zsSet(b,'assignor')||'range'}`,rep,topic:tn});
        g.targets.push(o.id);bind[c.id]=g.id;parts.forEach(p=>links.push([p.id,g.id]));});
    }else{
      colNames=b.type==='rabbitmq'?['exchange','queues','consumers']:b.type==='nats'?['subject','streams','consumers']:['producer api','queue','consumers'];
      const ex=mk(b.type==='rabbitmq'?tn+'.exchange':b.type==='nats'?tn+'.>':'SendMessage','topic',{sub:b.type==='rabbitmq'?'type: topic':b.type==='nats'?'JetStream subject':'at-least-once',topic:tn});
      ins.forEach(c=>{bind[c.id]=ex.id;ex.targets.push(c.from);});
      outs.forEach(c=>{const o=gb(c.to);if(!o)return;const s=zsSlug(zsLbl(o));
        const q=mk(b.type==='nats'?s+'-stream':s+'.queue','part',{sub:b.type==='rabbitmq'?`bind ${tn}.#`:'durable'});links.push([ex.id,q.id]);
        const g=mk(s+'-consumer','grp',{sub:'ack manual · prefetch 10'});g.targets.push(o.id);bind[c.id]=g.id;links.push([q.id,g.id]);});
      if(!outs.length){const q=mk(tn+'.queue','part',{sub:'durable'});links.push([ex.id,q.id]);}
    }
  }else if(cat==='db'||cat==='cache'){
    const sc=b.dbSchema||{},redis=cat==='cache';
    colNames=redis?['client','keys','']:['pool','tables','indexes'];
    const PN={postgresql:'HikariPool',mysql:'HikariPool',mongodb:'MongoClient',cassandra:'CqlSession',clickhouse:'ClickHouseHttp',elasticsearch:'RestClient',s3:'S3Client',redis:'LettucePool'};
    const pool=mk(PN[b.type]||'ConnectionPool','pool',{sub:redis?'max 64 conns':b.type==='s3'?'multipart · 8 MiB':'max 20 conns · 30s'});
    ins.forEach(c=>{bind[c.id]=pool.id;pool.targets.push(c.from);});
    const uris=ins.flatMap(c=>zsOps(c).map(o=>({c,o})));
    if(redis){
      const keys=new Map();
      (sc.keys||[]).forEach(k=>{const p=k.pattern||k.key;if(p&&!keys.has(p))keys.set(p,{type:k.type,ttl:k.ttl});});
      uris.forEach(({o})=>{const u=String(o.uri||'').trim();if(u&&!/^\//.test(u)&&!keys.has(u))keys.set(u,{type:'string'});});
      if(!keys.size)keys.set(zsSlug(zsLbl(b))+':{id}',{type:'string'});
      [...keys].slice(0,8).forEach(([p,k])=>{const c=mk(p,'key',{sub:`${k.type||'string'}${k.ttl?' · TTL '+k.ttl:''}`,key:p,ktype:k.type,ttl:k.ttl});links.push([pool.id,c.id]);});
    }else{
      let tbls=(sc.tables||sc.collections||[]).filter(x=>x&&x.name);
      if(!tbls.length){const nm=new Set();uris.forEach(({o})=>{const u=String(o.uri||'').trim();if(/^[A-Za-z_][\w.]*$/.test(u))nm.add(u);});tbls=[...nm].map(n=>({name:n,fields:[]}));}
      if(!tbls.length)tbls=[{name:b.type==='s3'?'objects':'data',fields:[]}];
      const byT={};
      tbls.slice(0,8).forEach(tb=>{const f=tb.fields||[],pk=f.filter(x=>x.pk).map(x=>x.name);
        const c=mk(tb.name,'tbl',{sub:`${f.length} ${t('zs_fields')}`+(pk.length?` · PK ${pk.join(',')}`:''),tbl:tb});byT[tb.name]=c;links.push([pool.id,c.id]);});
      const idx=[];
      tbls.forEach(tb=>(tb.indexes||[]).forEach(s=>{const mm=/CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]*)\)/i.exec(String(s));if(mm&&byT[mm[3]])idx.push({u:!!mm[1],name:mm[2],tb:mm[3],cols:mm[4].trim(),sql:String(s)});}));
      idx.slice(0,8).forEach(ix=>{const c=mk(ix.name,'idx',{sub:`${ix.u?'UNIQUE ':''}${ix.tb}(${ix.cols})`,ix});links.push([byT[ix.tb].id,c.id]);});
      ins.forEach(c=>{const u=zsOps(c).map(o=>String(o.uri||'').trim()).find(u=>byT[u]);dest[c.id]=(byT[u]||comps.find(x=>x.kind==='tbl')).id;});
    }
  }else return null;
  return {comps,links,bind,dest,colNames,infra:cat};
}
// C4 для инфраструктурных компонентов: конфиг/DDL вместо класса
function zsInfraCode(c,m){
  const b=gb(m.svc);if(!b)return null;const R=[],A=(t,cls)=>R.push({t,cls:cls||'f'});
  const fl=m.comps.filter(x=>x.kind==='flt'),rts=m.comps.filter(x=>x.kind==='rt');
  const fy=x=>x.role==='auth'?(x.mode==='JWT (встроенный)'?'JwtAuth':x.mode==='API Key'?'ApiKeyAuth':'TokenRelay'):x.role==='rl'?'RequestRateLimiter':x.role==='cb'?'CircuitBreaker':x.role==='to'?'Timeout':'TraceId';
  switch(c.kind){
    case 'lsn':return {ann:'# Spring Cloud Gateway · application.yml',raw:[{t:'server:',cls:'k'},{t:'  port: 8080'},{t:'spring.cloud.gateway:',cls:'k'},{t:'  default-filters:',cls:'k'},...fl.map(x=>({t:'    - '+fy(x)+(x.role==='rl'&&!x.on?'   # off':''),cls:'m'})),{t:`  routes: ${rts.length}  # → routes`,cls:'a'}]};
    case 'flt':{
      if(c.role==='auth'){A('- name: '+fy(c),'m');A('  args:','k');A(`    mode: ${c.mode}`);A(`    token: ${zsSet(b,'token_location')}`);if(c.mode!=='JWT (встроенный)'&&c.targets[0])A(`    introspect: lb://${zsSlug(zsLbl(gb(c.targets[0])))}`);A(c.mode==='JWT (встроенный)'?'# подпись проверяется локально (JWKS)':'# Auth-сервис зовётся на каждый запрос','a');}
      else if(c.role==='rl'){A('- name: RequestRateLimiter','m');A('  args:','k');A(`    replenishRate: ${zsSet(b,'rate_limit_rps')}`);A(`    burstCapacity: ${2*zsSet(b,'rate_limit_rps')}`);A('    deny-status: 429');if(!c.on)A('# выключен: включи паттерн Rate Limit','a');}
      else if(c.role==='cb'){A('- name: CircuitBreaker','m');A('  args:','k');A('    failureRateThreshold: 50');A('    fallbackUri: forward:/fallback');}
      else if(c.role==='to'){A('- name: Timeout','m');A('  args: { response-timeout: 3s }');}
      else{A('- name: TraceId','m');A('  args: { header: X-Request-Id }');A('# пробрасывается во все сервисы','a');}
      return {ann:'# filter · '+c.name,raw:R};}
    case 'rt':{const tg=gb(c.targets[0]);A('- id: '+zsSlug(c.res),'m');A(`  uri: lb://${zsSlug(zsLbl(tg))}`);A('  predicates:','k');A(`    - Path=/api/v1/${c.res}/**`);
      const vs=[...new Set(c.ops.map(o=>(o.verb||'').toUpperCase()).filter(v=>/^(GET|POST|PUT|PATCH|DELETE)$/.test(v)))];if(vs.length)A('    - Method='+vs.join(','));
      A('  filters:','k');A('    - StripPrefix=2');fl.filter(x=>x.role!=='trace'&&(x.role!=='rl'||x.on)).forEach(x=>A('    - '+fy(x)));return {ann:'# route',raw:R};}
    case 'topic':{
      if(b.type!=='kafka'){A(`name: ${c.name}`,'m');A(`type: ${b.type}`);m.comps.filter(x=>x.kind==='part').forEach(q=>A('  → '+q.name));return {ann:'# '+b.type,raw:R};}
      A(`kafka-topics.sh --create --topic ${c.name}`,'m');A(`  --partitions ${zsSet(b,'partitions')}`);A(`  --replication-factor ${zsSet(b,'replication')}`);
      A('configs:','k');A(`  min.insync.replicas=${zsSet(b,'min_insync')}`);A(`  cleanup.policy=${zsSet(b,'cleanup')}`);A(`  acks(producer)=${zsSet(b,'acks')}`);A(`  key: ${zsSet(b,'key_strategy')}  # hash(key) % ${zsSet(b,'partitions')}`,'a');
      return {ann:'# topic',raw:R};}
    case 'part':{if(b.type!=='kafka'){A(`queue: ${c.name}`,'m');A(`  ${c.sub}`);return {ann:'# queue',raw:R};}
      const RF=+zsSet(b,'replication')||1,BR=+zsSet(b,'brokers')||1,rep=[];for(let i=0;i<Math.min(RF,BR);i++)rep.push((c.leader-1+i)%BR+1);
      A(`partition ${c.name} of ${zsTopicName(b)}`,'m');A(`  leader: broker-${c.leader}`);A(`  replicas: [${rep.join(', ')}]`);A(`  isr: [${rep.join(', ')}]`);A(`  retention: ${zsSet(b,'retention_msgs')} msg`);
      const gs=m.comps.filter(x=>x.kind==='grp');if(gs.length)A('  consumed by: '+gs.map(g=>g.name).join(', '),'a');return {ann:'# partition',raw:R};}
    case 'grp':{A(`group.id=${c.name}`,'m');if(b.type==='kafka'){A(`topics=${zsTopicName(b)}`);A(`partition.assignment.strategy=${zsSet(b,'assignor')}`);A('enable.auto.commit=false');A(`max.poll.records=${zsSet(b,'poll_rate')}`);
      const N=+zsSet(b,'partitions')||3;A(`# ${c.rep||1} cons × ${N} part → активны ${Math.min(c.rep||1,N)}`,'a');A(`on.error: ${zsSet(b,'on_error')} (max ${zsSet(b,'max_retries')})`);}
      else{A('ack: manual');A('prefetch: 10');}return {ann:'# consumer',raw:R};}
    case 'pool':{if(b.type==='postgresql'||b.type==='mysql'){A('spring.datasource:','k');A(`  url: jdbc:${b.type}://${zsSlug(zsLbl(b))}:${b.type==='mysql'?3306:5432}/app`);A('  hikari:','k');A('    maximum-pool-size: 20');A('    connection-timeout: 30s');A('    idle-timeout: 10m');}
      else{A(`${c.name}:`,'k');A(`  host: ${zsSlug(zsLbl(b))}`);A(`  ${c.sub}`);}
      A('clients: '+c.targets.map(id=>zsLbl(gb(id))).join(', '),'a');return {ann:'# connection pool',raw:R};}
    case 'tbl':{const tb=c.tbl||{fields:[]},f=tb.fields||[];
      if(b.type==='mongodb'){A(`db.createCollection("${tb.name}")`,'m');f.slice(0,10).forEach(x=>A(`  ${x.name}: ${x.type||'any'}`));return {ann:'// collection',raw:R};}
      A(`CREATE TABLE ${tb.name} (`,'k');const pk=f.filter(x=>x.pk===true).map(x=>x.name),ck=f.filter(x=>x.pk==='clustering').map(x=>x.name);
      f.slice(0,12).forEach((x,i)=>A(`  ${x.name} ${x.type||''}${x.notNull?' NOT NULL':''}${x.fk?` REFERENCES ${x.fk.table}`:''}${i<f.length-1||pk.length?',':''}`));
      if(f.length>12)A(`  -- … ещё ${f.length-12}`,'a');if(pk.length)A(ck.length?`  PRIMARY KEY ((${pk.join(', ')}), ${ck.join(', ')})`:`  PRIMARY KEY (${pk.join(', ')})`);A(');','k');return {ann:'-- DDL',raw:R};}
    case 'idx':{const ix=c.ix;A(ix.sql,'m');A(`-- ${ix.u?'уникальность + ':''}поиск по ${ix.cols}`,'a');return {ann:'-- index',raw:R};}
    case 'key':{A(`${c.key}`,'m');A(`  type: ${c.ktype||'string'}`);if(c.ttl)A(`  ttl: ${c.ttl}`);A(`GET ${c.key}`);A(`SET ${c.key} <value>${c.ttl?' EX '+c.ttl:''}`);return {ann:'# redis key',raw:R};}
  }
  return null;
}
// Ручные компоненты: связи привязываются по имени → по виду → к первому подходящему
function zsManualComps(b,auto){
  const comps=b.components.map(c=>({id:c.id,name:c.name,kind:c.kind,funcs:c.funcs,uses:c.uses,ops:[],targets:[],manual:true}));
  const byId={};comps.forEach(c=>byId[c.id]=c);
  const bind={};
  Object.keys(auto.bind).forEach(cid=>{
    const a=auto.comps.find(x=>x.id===auto.bind[cid]);if(!a)return;
    const m=comps.find(x=>x.name.toLowerCase()===a.name.toLowerCase())||comps.find(x=>x.kind===a.kind)||comps.find(x=>ZS_COL[x.kind]===ZS_COL[a.kind])||comps[0];
    if(m){bind[cid]=m.id;a.ops.forEach(x=>m.ops.push(x));m.targets.push(...a.targets);if(a.topic)m.topic=a.topic;if(a.clr&&!m.clr)m.clr=a.clr;}
  });
  let links=[];
  if(comps.some(c=>Array.isArray(c.uses)&&c.uses.length))comps.forEach(c=>(c.uses||[]).forEach(u=>{if(byId[u]&&u!==c.id)links.push([c.id,u]);}));
  else{
    const ent=comps.filter(c=>ZS_COL[c.kind]===0),uc=comps.filter(c=>ZS_COL[c.kind]===1),ex=comps.filter(c=>ZS_COL[c.kind]===2);
    if(uc.length){ent.forEach(e=>(uc.length<=2?uc:[uc[0]]).forEach(u=>links.push([e.id,u.id])));uc.forEach((u,i)=>ex.forEach((x,j)=>{if(uc.length===1||j%uc.length===i)links.push([u.id,x.id]);}));}
    else ent.forEach(e=>ex.forEach(x=>links.push([e.id,x.id])));
  }
  return {comps,links,bind};
}
function zsModel(b){
  if(!b)return null;
  const auto=zsAutoComps(b);
  const m=(zsIsSvc(b)&&Array.isArray(b.components)&&b.components.length)?zsManualComps(b,auto):auto;
  m.manual=m!==auto;m.svc=b.id;
  // раскладка: 3 колонки (вход · логика · выход), пустые колонки схлопываются
  const cols=[[],[],[]];m.comps.forEach(c=>{c.col=ZS_COL[c.kind]??1;cols[c.col].push(c);});
  const used=cols.filter(c=>c.length);const nr=Math.max(1,...used.map(c=>c.length));
  const G=ZS_G,W=G.pad*2+used.length*G.cw+(used.length-1)*G.gx,H=G.head+G.pad*2+nr*G.ch+(nr-1)*G.gy;
  const cx=b.x+bw(b)/2,cy=b.y+bh(b)/2;
  m.frame={x:cx-W/2,y:cy-H/2,w:W,h:H};
  used.forEach((col,ci)=>{
    const colH=col.length*G.ch+(col.length-1)*G.gy,y0=m.frame.y+G.head+G.pad+(nr*G.ch+(nr-1)*G.gy-colH)/2;
    col.forEach((c,ri)=>{c.x=m.frame.x+G.pad+ci*(G.cw+G.gx);c.y=y0+ri*(G.ch+G.gy);c.w=G.cw;c.h=G.ch;c.type=b.type;});
  });
  m.byId={};m.comps.forEach(c=>m.byId[c.id]=c);
  return m;
}
// Рамка «Software System» для C1: всё, кроме людей/клиентов/внешних систем
function zsSysModel(){
  const inner=S.blocks.filter(b=>!ZS_SYS_OUT.has(BASE[b.type]?.cat));
  if(!inner.length)return null;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  inner.forEach(b=>{x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+bw(b));y1=Math.max(y1,b.y+bh(b));});
  // Компактная контекстная диаграмма: система — один крупный блок в центре,
  // люди/клиенты — колонкой слева, внешние системы — справа (только визуально)
  const svcs=inner.filter(b=>BASE[b.type]?.cat==='svc');
  const rows=Math.ceil(Math.min(12,svcs.length)/3);
  const W=600,H=Math.max(300,220+rows*30),cx=(x0+x1)/2,cy=(y0+y1)/2;
  // Читаемость: на мелком масштабе вся контекстная диаграмма растёт обратно зуму
  // (k — рамка системы, ko — внешние блоки), экранный размер текста остаётся постоянным
  const k=zsL1K(),ko=Math.max(1,Math.min(4,1/(ZS._zT||S.zoom||1)));
  const box0={x:cx-W/2,y:cy-H/2,w:W,h:H};
  const box={id:'__sys',type:'service',x:cx-W/2*k,y:cy-H/2*k,w:W*k,h:H*k};
  const pos=new Map(),outer=S.blocks.filter(b=>ZS_SYS_OUT.has(BASE[b.type]?.cat));
  const left=outer.filter(b=>BASE[b.type]?.cat!=='external').sort((a,b)=>a.y-b.y);
  const right=outer.filter(b=>BASE[b.type]?.cat==='external').sort((a,b)=>a.y-b.y);
  const col=(arr,xc)=>{const mh=Math.max(0,...arr.map(bh));
    const gap=Math.max(mh*ko+40*ko,Math.min(140*k,(H+160)*k/Math.max(1,arr.length)));
    let y=cy-((arr.length-1)*gap)/2;arr.forEach(b=>{const w=bw(b),h=bh(b);pos.set(b.id,{cx:xc,cy:y,w,h,k:ko});y+=gap;});};
  col(left,cx-(W/2+190)*k);col(right,cx+(W/2+190)*k);
  return {inner:new Set(inner.map(b=>b.id)),box,box0,k,cx,cy,pos,svcs,n:inner.length};
}

// ── геометрия для отрисовки/маршрутов ─────────────────────────
function zsEase(p){return 1-Math.pow(1-p,3);}
// Раздвигаем соседей, чтобы раскрытый сервис никого не накрыл (только визуально)
function zsPrep(){
  ZS._view=null;ZS._fr=null;ZS.model=null;ZS.sys=null;
  const A=typeof $==='function'&&$('anim-layer');if(A)A.style.visibility=(ZS.l1&&zsActive())?'hidden':'';
  if(!zsActive()){return;}
  if(ZS.svc&&!gb(ZS.svc)){ZS.svc=null;ZS.comp=null;ZS.p=0;ZS.pc=0;ZS.bound=false;}
  if(ZS.l1)ZS.sys=zsSysModel();
  if(ZS.svc){
    const b=gb(ZS.svc);ZS.model=zsModel(b);
    if(ZS.comp&&!ZS.model.byId[ZS.comp])ZS.comp=null;
    zsDrawer(ZS.model);
    const e=zsEase(ZS.p),f=ZS.model.frame,W=bw(b),H=bh(b);
    ZS._fr={x:b.x+(f.x-b.x)*e,y:b.y+(f.y-b.y)*e,w:W+(f.w-W)*e,h:H+(f.h-H)*e};
    // окно может расти несимметрично (ящик кода C4 — вниз), поэтому сдвиги по сторонам раздельные
    ZS._view={cx:b.x+W/2,cy:b.y+H/2,hw:W/2,hh:H/2,dxL:(b.x-f.x+14)*e,dxR:(f.x+f.w-b.x-W+14)*e,dyU:(b.y-f.y+14)*e,dyD:(f.y+f.h-b.y-H+14)*e,cache:new Map()};
  }
}
function zsL1K(){return Math.max(1,Math.min(3.5,0.7/(ZS._zT||S.zoom||1)));} // во время анимации камеры — целевой зум
function zsView(b){
  if(ZS.l1&&ZS.sys&&b&&ZS.sys.pos.has(b.id)){
    // o — увеличенная геометрия (связи, попадание мышью), o._zsDraw — исходный размер для отрисовки с transform
    const q=ZS.sys.pos.get(b.id),o=Object.create(b),d=Object.create(b);
    o.w=q.w*q.k;o.h=q.h*q.k;o.x=q.cx-o.w/2;o.y=q.cy-o.h/2;
    d.x=q.cx-q.w/2;d.y=q.cy-q.h/2;o._zsK=q.k;o._zsDraw=d;return o;}
  const v=ZS._view;if(!v||!b||b.id===ZS.svc||ZS.p<=0)return b;
  let o=v.cache.get(b.id);if(o)return o;
  const W=bw(b),H=bh(b),bx=b.x+W/2,by=b.y+H/2;
  const dx=bx>v.cx+v.hw?v.dxR:bx<v.cx-v.hw?-v.dxL:0;
  const dy=by>v.cy+v.hh?v.dyD:by<v.cy-v.hh?-v.dyU:0;
  if(!dx&&!dy)o=b;else{o=Object.create(b);o.x=b.x+dx;o.y=b.y+dy;}
  v.cache.set(b.id,o);return o;
}
function zsHidden(b){return !!(ZS.l1&&ZS.sys&&ZS.sys.inner.has(b.id));}
// Геометрия конца связи: компонент раскрытого сервиса / рамка системы / сдвинутый блок
function zsNode(id,conn){
  const b=gb(id);if(!b)return b;
  if(ZS.l1&&ZS.sys&&ZS.sys.inner.has(id)){const o=conn.from===id?conn.to:conn.from;return ZS.sys.inner.has(o)?b:ZS.sys.box;}
  if(id===ZS.svc&&ZS.bound&&ZS.model){const c=ZS.model.byId[ZS.model.bind[conn.id]];if(c)return c;}
  return zsView(b);
}
function zsTouches(c){return ZS.bound&&ZS.svc&&(c.from===ZS.svc||c.to===ZS.svc);}
// C1: внутренние связи прячем, внешние ↔ рамка системы — без дублей
function zsConnFilter(set){
  if(!ZS.l1||!ZS.sys)return set;
  const inn=ZS.sys.inner,seen=new Set();
  return set.filter(c=>{
    const a=inn.has(c.from),b=inn.has(c.to);if(a&&b)return false;if(!a&&!b)return true;
    const k=a?'o:'+c.to:'i:'+c.from;if(seen.has(k))return false;seen.add(k);return true;
  });
}
function zsCompAt(pt){
  if(!ZS.bound||!ZS.model)return null;
  return ZS.model.comps.find(c=>pt.x>=c.x&&pt.x<=c.x+c.w&&pt.y>=c.y&&pt.y<=c.y+c.h)||null;
}
function zsInFrame(pt){const f=ZS.model&&ZS.p>0.5&&ZS.model.frame;return !!f&&pt.x>=f.x&&pt.x<=f.x+f.w&&pt.y>=f.y&&pt.y<=f.y+f.h;}
// blockAt с учётом раздвинутых блоков, рамки раскрытого сервиса и C1
const _zsBlockAtBase=blockAt;
blockAt=function(pt){
  if(!zsActive()||(!ZS.svc&&!ZS.l1))return _zsBlockAtBase(pt);
  if(ZS.svc&&zsInFrame(pt))return gb(ZS.svc);
  for(let i=0;i<S.blocks.length;i++){const b0=S.blocks[i];if(zsHidden(b0))continue;const b=zsView(b0);if(pt.x>=b.x&&pt.x<=b.x+bw(b)&&pt.y>=b.y&&pt.y<=b.y+bh(b))return b0;}
  return null;
};

// ── маршруты вокруг раскрытого окна C3 ───────────────────────
// Связи раскрытого сервиса выходят через порт на краю окна; транзитные связи
// соседей обходят окно по «полосам» вокруг него. Тело окна связями не пересекается.
const ZS_RM=10;
function zsInfl(f,m){return {x:f.x-m,y:f.y-m,w:f.w+2*m,h:f.h+2*m};}
// Ортогональный (или произвольный) отрезок пересекает внутренность прямоугольника?
function zsSegHit(a,b,R){
  const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
  if(x1<=R.x||x0>=R.x+R.w||y1<=R.y||y0>=R.y+R.h)return false;
  if(Math.abs(a.x-b.x)<0.5||Math.abs(a.y-b.y)<0.5)return true;
  for(let i=0;i<=16;i++){const k=i/16,x=a.x+(b.x-a.x)*k,y=a.y+(b.y-a.y)*k;if(x>R.x&&x<R.x+R.w&&y>R.y&&y<R.y+R.h)return true;}
  return false;
}
function zsPathHit(pts,R){for(let i=1;i<pts.length;i++)if(zsSegHit(pts[i-1],pts[i],R))return true;return false;}
function zsPathLen(pts){let L=0;for(let i=1;i<pts.length;i++)L+=Math.abs(pts[i].x-pts[i-1].x)+Math.abs(pts[i].y-pts[i-1].y);return L;}
// Нормаль стороны прямоугольника, на которой лежит точка
function zsSideN(p,r){
  const W=r.w!=null?r.w:bw(r),H=r.h!=null?r.h:bh(r);
  const d=[[Math.abs(p.x-r.x),-1,0],[Math.abs(p.x-(r.x+W)),1,0],[Math.abs(p.y-r.y),0,-1],[Math.abs(p.y-(r.y+H)),0,1]].sort((a,b)=>a[0]-b[0])[0];
  return {x:d[1],y:d[2]};
}
// Лучший ортогональный путь A→B (A,B — концы «стабов»), не задевающий obst[]
function zsDetour(A,B,F,lane,obst){
  const L={t:F.y-lane,b:F.y+F.h+lane,l:F.x-lane,r:F.x+F.w+lane};
  const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
  const C=[
    [A,{x:B.x,y:A.y},B],[A,{x:A.x,y:B.y},B],
    [A,{x:mx,y:A.y},{x:mx,y:B.y},B],[A,{x:A.x,y:my},{x:B.x,y:my},B],
    [A,{x:A.x,y:L.t},{x:B.x,y:L.t},B],[A,{x:A.x,y:L.b},{x:B.x,y:L.b},B],
    [A,{x:L.l,y:A.y},{x:L.l,y:B.y},B],[A,{x:L.r,y:A.y},{x:L.r,y:B.y},B],
    // обход угла: выйти на полосу по одной оси, пройти вдоль, вернуться по другой
    [A,{x:L.l,y:A.y},{x:L.l,y:L.t},{x:B.x,y:L.t},B],[A,{x:L.r,y:A.y},{x:L.r,y:L.t},{x:B.x,y:L.t},B],
    [A,{x:L.l,y:A.y},{x:L.l,y:L.b},{x:B.x,y:L.b},B],[A,{x:L.r,y:A.y},{x:L.r,y:L.b},{x:B.x,y:L.b},B],
    [A,{x:A.x,y:L.t},{x:L.l,y:L.t},{x:L.l,y:B.y},B],[A,{x:A.x,y:L.t},{x:L.r,y:L.t},{x:L.r,y:B.y},B],
    [A,{x:A.x,y:L.b},{x:L.l,y:L.b},{x:L.l,y:B.y},B],[A,{x:A.x,y:L.b},{x:L.r,y:L.b},{x:L.r,y:B.y},B],
  ];
  let best=null,bs=1e18;
  C.forEach(p=>{p=dedup(p);if(obst.some(R=>zsPathHit(p,R)))return;const s=zsPathLen(p)+p.length*24;if(s<bs){bs=s;best=p;}});
  return best;
}
function zsMkRoute(pts){
  const cl=dedup(pts);if(cl.length<2)return null;
  const s=cl[0],e=cl[cl.length-1];
  return {sx:s.x,sy:s.y,ex:e.x,ey:e.y,c1x:s.x,c1y:s.y,c2x:e.x,c2y:e.y,pts:cl,d:'M '+cl.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' L '),ortho:true,zs:true};
}
// Порт компонента на краю окна: col0 — слева, col2 — справа, логика — через межколоночный зазор вверх/вниз
function zsPort(c,m,o,k,n){
  const f=m.frame,G=ZS_G,ocx=o.x+bw(o)/2,ocy=o.y+bh(o)/2;
  const sp=n>1?(k-(n-1)/2)*Math.min(7,(c.h-8)/n):0,cy=c.y+c.h/2+sp;
  const cols=[...new Set(m.comps.map(x=>x.col))];
  const leftMost=c.col===Math.min(...cols),rightMost=c.col===Math.max(...cols);
  if(c.col===0||(leftMost&&ocx<f.x+f.w/2))return {inner:[{x:c.x,y:cy},{x:f.x,y:cy}],port:{x:f.x,y:cy},n:{x:-1,y:0}};
  if(c.col===2||rightMost)return {inner:[{x:c.x+c.w,y:cy},{x:f.x+f.w,y:cy}],port:{x:f.x+f.w,y:cy},n:{x:1,y:0}};
  const gx=c.x+c.w+G.gx/2+sp,up=ocy<f.y+f.h/2,py=up?f.y:f.y+f.h;
  return {inner:[{x:c.x+c.w,y:cy},{x:gx,y:cy},{x:gx,y:py}],port:{x:gx,y:py},n:{x:0,y:up?-1:1}};
}
function zsRouteBound(conn){
  const m=ZS.model,c=m.byId[m.bind[conn.id]];if(!c)return null;
  const outgoing=conn.from===ZS.svc,oid=outgoing?conn.to:conn.from,ob=gb(oid);if(!ob)return null;
  const o=zsView(ob);
  // несколько связей на один компонент — разносим порты
  const same=S.conns.filter(x=>(x.from===ZS.svc||x.to===ZS.svc)&&m.bind[x.id]===c.id);
  const P=zsPort(c,m,o,same.findIndex(x=>x.id===conn.id),same.length);
  const st=ZS_RM+4+((same.length>1?same.findIndex(x=>x.id===conn.id):0)%3)*5;
  const A={x:P.port.x+P.n.x*st,y:P.port.y+P.n.y*st};
  const F=zsInfl(m.frame,ZS_RM-2),ow=bw(o),oh=bh(o),R=zsInfl({x:o.x,y:o.y,w:ow,h:oh},-2);
  const anchors=[{x:o.x,y:o.y+oh/2,n:{x:-1,y:0}},{x:o.x+ow,y:o.y+oh/2,n:{x:1,y:0}},{x:o.x+ow/2,y:o.y,n:{x:0,y:-1}},{x:o.x+ow/2,y:o.y+oh,n:{x:0,y:1}}];
  let best=null,bs=1e18;
  anchors.forEach(an=>{
    const B={x:an.x+an.n.x*12,y:an.y+an.n.y*12};
    const p=zsDetour(A,B,m.frame,ZS_RM+6+(conn.id.length%3)*4,[F,R]);if(!p)return;
    const full=[...P.inner,...p,{x:an.x,y:an.y}],s=zsPathLen(full)+full.length*24;
    if(s<bs){bs=s;best=full;}
  });
  if(!best)best=[...P.inner,A,{x:o.x+ow/2,y:o.y+oh/2}];
  return zsMkRoute(outgoing?best:best.slice().reverse());
}
function zsRouteTransit(conn,r){
  const F=ZS._fr;if(!F||!r)return r;
  const R=zsInfl(F,ZS_RM-2);
  let pts=r.pts;
  if(!pts){pts=[];for(let i=0;i<=24;i++){const t=i/24,u=1-t;pts.push({x:u*u*u*r.sx+3*u*u*t*r.c1x+3*u*t*t*r.c2x+t*t*t*r.ex,y:u*u*u*r.sy+3*u*u*t*r.c1y+3*u*t*t*r.c2y+t*t*t*r.ey});}}
  if(!zsPathHit(pts,R))return r;
  const fb=zsNode(conn.from,conn),tb=zsNode(conn.to,conn);if(!fb||!tb)return r;
  const S0={x:r.sx,y:r.sy},E0={x:r.ex,y:r.ey},n0=zsSideN(S0,fb),n1=zsSideN(E0,tb);
  const A={x:S0.x+n0.x*12,y:S0.y+n0.y*12},B={x:E0.x+n1.x*12,y:E0.y+n1.y*12};
  const p=zsDetour(A,B,F,ZS_RM+6+(conn.id.length%3)*4,[R]);
  if(!p)return r;
  return zsMkRoute([S0,...p,E0])||r;
}
const _zsRouteBase=route;
route=function(conn){
  const r=_zsRouteBase(conn);
  if(!r||!zsActive()||!ZS.svc||!ZS.model||ZS.p<=0||ZS.l1)return r;
  if(zsTouches(conn))return zsRouteBound(conn)||r;
  if(conn.from===ZS.svc||conn.to===ZS.svc)return r;
  return zsRouteTransit(conn,r);
};

// ── анимация ──────────────────────────────────────────────────
function zsTween(key,to,ms,done){
  const from=ZS[key],t0=performance.now();
  cancelAnimationFrame(ZS._anim[key]);
  if(Math.abs(from-to)<1e-3||ms<=0||document.hidden){ZS[key]=to;zsStep(key);if(done)done();return;}
  const tick=now=>{
    const k=Math.min(1,(now-t0)/ms);ZS[key]=from+(to-from)*k;zsStep(key);
    if(k<1)ZS._anim[key]=requestAnimationFrame(tick);else{ZS._anim[key]=0;if(done)done();}
  };
  ZS._anim[key]=requestAnimationFrame(tick);
}
function zsStep(key){
  if(key==='p')ZS.bound=ZS.p>=0.5;
  render();
}
let ZS_MS=230;
function zsExpand(id){
  if(ZS.svc&&ZS.svc!==id){ZS.comp=null;ZS.pc=0;ZS.p=0;ZS.bound=false;}
  ZS.l1=false;ZS.svc=id;ZS.sel=null;
  S.selected=id;if(typeof updateSidebar==='function')updateSidebar();
  zsTween('p',1,ZS_MS);zsUI();
}
function zsCollapse(instant){
  if(!ZS.svc)return;
  ZS.comp=null;ZS.pc=0;
  zsTween('p',0,instant?0:ZS_MS,()=>{if(ZS.p<=0){ZS.svc=null;ZS.sel=null;ZS.bound=false;render();zsUI();}});
  zsUI();
}
function zsSetComp(id){
  ZS.comp=id;ZS.sel=id;ZS.pc=0;render();zsTween('pc',1,ZS_MS*0.8);zsUI();
}
function zsSetL1(on){
  if(on){if(ZS.svc)zsCollapse(true);ZS.l1=true;}else ZS.l1=false;
  render();zsUI();
}
// Колесо: вызывается из interact.js после изменения S.zoom
function zsOnWheel(zoomIn,wpt){
  if(!zsActive())return;
  const cur=zsLevel(),z=S.zoom||1;
  const hb=blockAt(wpt),hc=zsCompAt(wpt);
  const want=zsLevelFor(z,cur,{svc:zsExpandable(hb),comp:!!hc});
  // уже на C3/C4 и крутим к другому сервису — переключаем раскрытый сервис
  if(zoomIn&&cur>=3&&want>=3&&zsExpandable(hb)&&hb.id!==ZS.svc){zsExpand(hb.id);return;}
  if(zoomIn&&cur===4&&hc&&hc.id!==ZS.comp){zsSetComp(hc.id);return;}
  if(want===cur)return;
  if(want===1)zsSetL1(true);
  else if(want===2){if(cur===1)zsSetL1(false);else zsCollapse();}
  else if(want===3){if(cur===4){ZS.comp=null;zsTween('pc',0,ZS_MS*0.6,()=>{render();});zsUI();}else zsExpand(hb.id);}
  else if(want===4)zsSetComp(hc.id);
}

// ── камера (кнопки/клавиши) ───────────────────────────────────
function zsCam(z,wx,wy,ms,done){
  const r=svgRct(),W=r.width||1000,H=r.height||700;
  const z0=S.zoom||1,px0=S.panX,py0=S.panY,px1=W/2-wx*z,py1=H/2-wy*z,t0=performance.now();
  const set=(zz,px,py)=>{S.zoom=zz;S.panX=px;S.panY=py;const tr=`translate(${px},${py}) scale(${zz})`;['conn-layer','block-layer','anim-layer','zoom-layer'].forEach(id=>{const e=$(id);if(e)e.setAttribute('transform',tr);});};
  if(ms<=0||document.hidden){ZS._zT=0;set(z,px1,py1);render();if(done)done();return;}
  ZS._zT=z;
  const tick=now=>{const k=zsEase(Math.min(1,(now-t0)/ms));set(z0+(z-z0)*k,px0+(px1-px0)*k,py0+(py1-py0)*k);if(k<1)requestAnimationFrame(tick);else{ZS._zT=0;render();if(done)done();}};
  requestAnimationFrame(tick);
}
function zsViewCenter(){const r=svgRct(),z=S.zoom||1;return{x:((r.width||1000)/2-S.panX)/z,y:((r.height||700)/2-S.panY)/z};}
function zsPickSvc(){
  const sel=gb(S.selected);if(zsExpandable(sel))return sel;
  if(ZS.svc)return gb(ZS.svc);
  const c=zsViewCenter();let best=null,bd=1e18;
  [zsIsSvc,zsExpandable].some(ok=>{S.blocks.forEach(b=>{if(!ok(b))return;const d=(b.x+bw(b)/2-c.x)**2+(b.y+bh(b)/2-c.y)**2;if(d<bd){bd=d;best=b;}});return best;});
  return best;
}
// Переход на уровень n без колеса (кнопки C1…C4, клавиши 1…4, хлебные крошки)
function zsGo(n,id){
  if(S.notationMode==='bpmn')return;
  if(S.view==='c4_level'){S.c4Level=null;S.view='workspace';}
  const ms=ZS_MS+120;
  if(n===1){if(ZS.svc)zsCollapse(true);ZS.l1=true;ZS.sys=zsSysModel();const bx=ZS.sys?.box;zsCam(0.42,bx?bx.x+bx.w/2:zsViewCenter().x,bx?bx.y+bx.h/2:zsViewCenter().y,ms);render();zsUI();return;}
  if(n===2){ZS.l1=false;const b=ZS.svc&&gb(ZS.svc);if(ZS.svc)zsCollapse();const c=b?{x:b.x+bw(b)/2,y:b.y+bh(b)/2}:zsViewCenter();zsCam(1,c.x,c.y,ms);render();zsUI();return;}
  const b=(id&&gb(id))||zsPickSvc();if(!b){toast(t('zs_no_svc'));return;}
  if(n===3){
    if(ZS.comp){ZS.comp=null;ZS.pc=0;}
    if(ZS.svc!==b.id||ZS.p<1)zsExpand(b.id);
    zsCam(Math.max(1.7,Math.min(2.2,S.zoom||1)),b.x+bw(b)/2,b.y+bh(b)/2,ms);zsUI();return;
  }
  if(n===4){
    if(ZS.svc!==b.id){zsExpand(b.id);ZS.p=1;ZS.bound=true;}
    zsPrep();const m=ZS.model;if(!m)return;
    const cid=(id&&m.byId[id]&&id)||(ZS.sel&&m.byId[ZS.sel]&&ZS.sel)||(m.comps.find(c=>c.kind==='ctrl')||m.comps.find(c=>c.kind==='uc')||m.comps.find(c=>c.kind==='rt'||c.kind==='tbl'||c.kind==='topic')||m.comps[0]).id;
    const c=m.byId[cid];
    zsSetComp(cid);
    // камера: компонент и ящик с кодом под ним целиком в кадре
    const nRows=zsCodeRows(c,m).length,DH=22+nRows*ZS_LH+8;
    const y0=c.y-10,y1=Math.max(...m.comps.map(q=>q.y+q.h))+10+DH+10,r=svgRct(),VW=r.width||1000,VH=r.height||700;
    const z=Math.max(2.1,Math.min(2.3,VW/(ZS_DW+110),VH/(y1-y0+70)));
    const f=m.frame,grow=ZS.pc>0?0:Math.max(0,ZS_DW+2*ZS_G.pad-f.w),fx=f.x-grow/2,fw=f.w+grow;
    const dx=Math.max(fx+ZS_G.pad,Math.min(fx+fw-ZS_G.pad-ZS_DW,c.x+c.w/2-ZS_DW/2));
    const x0=Math.min(c.x,dx)-14,x1=Math.max(c.x+c.w,dx+ZS_DW)+14;
    zsCam(z,(x0+x1)/2,Math.min((y0+y1)/2,y0+VH/z/2-30),ms);
  }
}
// Кнопка C2: если уже на C2 — переключает строгую C4-нотацию (подписи [Container: тип])
function zsBtn(n){
  if(n===2&&zsLevel()===2){
    if(S.view==='c4_level'){S.c4Level=null;S.view='workspace';render();}
    else{S.c4Level=2;S.view='c4_level';render();}
    zsUI();return;
  }
  zsGo(n);
}

// ── отрисовка ─────────────────────────────────────────────────
function zsCompClr(c){return c.clr||ZS_KCLR[c.kind]||'#7aa2f7';}
function zsOpsTxt(c){
  if(c.sub)return c.sub;
  if(c.kind==='cons')return '⇠ '+(c.topic||'');
  if(c.ops&&c.ops.length){const o=c.ops[0];return (o.verb+' '+o.uri).trim()+(c.ops.length>1?' +'+(c.ops.length-1):'');}
  const tg=gb(c.targets&&c.targets[0]);return tg?'→ '+zsLbl(tg):zsKindLbl(c.kind);
}
function renderZoom(){
  const Z=$('zoom-layer');if(!Z)return;
  Z.setAttribute('transform',`translate(${S.panX},${S.panY}) scale(${S.zoom||1})`);
  const body=$('zl-body'),code=$('zl-code');
  body.innerHTML='';code.innerHTML='';
  zsCrumbs();
  if(!zsActive()||!ZS.svc||!ZS.model||ZS.p<=0)return;
  ensureMatDefs();
  const b=gb(ZS.svc),m=ZS.model,f=m.frame,e=zsEase(ZS.p),W=bw(b),H=bh(b);
  const rx=b.x+(f.x-b.x)*e,ry=b.y+(f.y-b.y)*e,rw=W+(f.w-W)*e,rh=H+(f.h-H)*e;
  const g=mkEl('g',{transform:`translate(${rx},${ry}) scale(${rw/f.w},${rh/f.h}) translate(${-f.x},${-f.y})`,'data-zs':'frame'},body);
  const clr=EL[b.type]?.clr||'#7aa2f7';
  // рамка-«окно» сервиса: светлое тело + синий заголовок в духе Win95
  matShape('rect',{x:f.x,y:f.y,width:f.w,height:f.h,rx:7},clr,g,{base:matTint(clr,.86),st:matDark(clr,.6),sw:'1.6'});
  mkEl('rect',{x:f.x+3,y:f.y+3,width:f.w-6,height:ZS_G.head-4,rx:4,fill:'url(#zs-title)'},g);
  matGloss(g,f.x+4,f.y+4,f.w-8,(ZS_G.head-4)*0.45,3);
  const tt=mkTxt(f.x+10,f.y+3+(ZS_G.head-4)/2,`${zsLbl(b)}  ·  C3 Component`+(m.manual?'  ✎':''),'font-size:10.5px;font-weight:700;fill:#fff;letter-spacing:.2px',g);tt.setAttribute('text-anchor','start');
  const xb=mkEl('g',{'data-zs':'collapse',style:'cursor:pointer'},g);
  mkEl('rect',{x:f.x+f.w-21,y:f.y+6,width:15,height:13,fill:'#ccc4b0',stroke:'#3a3020','stroke-width':'.8'},xb);
  mkTxt(f.x+f.w-13.5,f.y+12.5,'–','font-size:11px;font-weight:700;fill:#1c1810',xb);
  const cg=mkEl('g',{opacity:Math.max(0,Math.min(1,(ZS.p-0.35)/0.5)).toFixed(3)},g);
  // колонки-подписи
  const colsUsed=[...new Set(m.comps.map(c=>c.col))].sort();
  const colName=m.colNames||[t('zs_col_in'),t('zs_col_logic'),t('zs_col_out')];
  colsUsed.forEach(ci=>{const c=m.comps.find(x=>x.col===ci);const lt=mkTxt(c.x+2,f.y+ZS_G.head+5,colName[ci],'font-size:7.5px;font-weight:700;fill:'+matDark(clr,.45)+';letter-spacing:.6px;text-transform:uppercase',cg);lt.setAttribute('text-anchor','start');});
  // внутренние связи
  m.links.forEach(([a,bb])=>{
    const A=m.byId[a],B=m.byId[bb];if(!A||!B)return;
    let d;
    if(B.col>A.col){const x1=A.x+A.w,y1=A.y+A.h/2,x2=B.x,y2=B.y+B.h/2,mx=(x1+x2)/2;d=`M${x1} ${y1} L${mx} ${y1} L${mx} ${y2} L${x2-2} ${y2}`;}
    else{const x1=A.x+A.w/2,y1=A.y+A.h,x2=B.x+B.w/2,y2=B.y;d=`M${x1} ${y1} L${x2} ${y2-2}`;}
    mkEl('path',{d,fill:'none',stroke:matDark(clr,.55),'stroke-width':'1.2','stroke-dasharray':'none','marker-end':'url(#arr)',opacity:'.8'},cg);
  });
  // компоненты
  m.comps.forEach(c=>{
    const k=zsCompClr(c),sel=ZS.sel===c.id||ZS.comp===c.id;
    const dim=ZS.comp&&ZS.comp!==c.id&&m.drawer?(1-0.62*m.drawer.e).toFixed(3):'1';
    const cgp=mkEl('g',{'data-zs':'comp','data-comp':c.id,style:'cursor:pointer',opacity:dim},cg);
    if(sel)mkEl('rect',{x:c.x-3,y:c.y-3,width:c.w+6,height:c.h+6,rx:6,fill:'none',stroke:'#bb9af7','stroke-width':'1.4','stroke-dasharray':'4 2'},cgp);
    matShape('rect',{x:c.x,y:c.y,width:c.w,height:c.h,rx:4},k,cgp,{base:matTint(k,.62)});
    mkEl('rect',{x:c.x+1,y:c.y+1,width:4,height:c.h-2,rx:1.5,fill:matDark(k,.8)},cgp);
    matGloss(cgp,c.x+5,c.y+1,c.w-6,c.h*0.4,3);
    const nm=c.name.length>23?c.name.slice(0,22)+'…':c.name;
    const t1=mkTxt(c.x+10,c.y+11,nm,`font-size:9px;font-weight:700;fill:${matDark(k,.35)}`,cgp);t1.setAttribute('text-anchor','start');
    const sub=zsOpsTxt(c);
    const t2=mkTxt(c.x+10,c.y+25,(sub.length>25?sub.slice(0,24)+'…':sub),'font-size:7.6px;fill:#3a3020;font-family:Consolas,monospace',cgp);t2.setAttribute('text-anchor','start');
    const kt=mkTxt(c.x+c.w-4,c.y+c.h-5,'«'+c.kind+'»','font-size:6.2px;fill:'+matDark(k,.45),cgp);kt.setAttribute('text-anchor','end');
  });
  zsRenderCode(code);
}
// C4: «код» компонента — класс, аннотации, функции
function zsCode(c,m){
  if(m.infra){const r=zsInfraCode(c,m);if(r)return Object.assign({cls:c.name,deps:[],lines:[]},r);}
  const lines=[];let ann='@Component',cls=c.name;
  const fn=(o)=>{const v=(o.verb||'').toUpperCase(),res=zsIdent(zsSing(zsResource(o.uri)||'item'));
    const byId=/\{|:id/.test(o.uri||'');
    return v==='GET'?(byId?'get'+res+'(id)':'list'+zsIdent(zsResource(o.uri)||'items')+'()'):v==='POST'?'create'+res+'(req)':(v==='PUT'||v==='PATCH')?'update'+res+'(id, req)':v==='DELETE'?'delete'+res+'(id)':(zsIdent(o.uri||o.verb||'call').replace(/^./,ch=>ch.toLowerCase())||'call')+'()';};
  const deps=m.links.filter(l=>l[0]===c.id).map(l=>m.byId[l[1]]?.name).filter(Boolean);
  if(c.kind==='ctrl'){ann='@RestController';(c.ops.length?c.ops:[{verb:'GET',uri:'/'+(c.res||'')}]).forEach(o=>{const v=(o.verb||'GET').toUpperCase();lines.push({a:/^(GET|POST|PUT|PATCH|DELETE)$/.test(v)?`@${v.charAt(0)+v.slice(1).toLowerCase()}Mapping("${o.uri||'/'}")`:`// ${v} ${o.uri}`,s:fn(o)});});}
  else if(c.kind==='cons'){ann=`@KafkaListener(topics = "${c.topic||''}")`;lines.push({s:'onMessage(event)'});lines.push({s:'ack(offset)'});}
  else if(c.kind==='uc'){ann='@Service';const src=c.ops.length?c.ops:[{verb:'',uri:'handle'}];src.forEach(o=>lines.push({s:fn(o).replace(/\(.*\)/,'(cmd)')}));lines.push({s:'validate(cmd)'});}
  else if(c.kind==='repo'){ann='@Repository';const tb=(c.ops.find(o=>o.uri)||{}).uri;if(tb)lines.push({a:`// table: ${tb}`});const vs=new Set(c.ops.map(o=>(o.verb||'').toUpperCase()));if(!vs.size)['SELECT','INSERT'].forEach(v=>vs.add(v));
    vs.forEach(v=>lines.push({s:v==='INSERT'?'save(entity)':v==='SELECT'||v==='FIND'?'findById(id)':v==='UPDATE'?'update(entity)':v==='DELETE'?'deleteById(id)':v.toLowerCase()+'(…)'}));}
  else if(c.kind==='cache'){ann='@CacheAdapter';const key=(c.ops.find(o=>o.uri)||{}).uri;if(key)lines.push({a:`// key: ${key}`});lines.push({s:'get(key)'},{s:'put(key, value, ttl)'},{s:'evict(key)'});}
  else if(c.kind==='prod'){const tg=gb(c.targets[0]);ann=`@Producer(topic = "${tg?zsLbl(tg):''}")`;lines.push({s:'send(event)'});lines.push({s:'flush()'});}
  else{const tg=gb(c.targets[0]);ann=`@HttpClient("${tg?zsLbl(tg):''}")`;(c.ops.length?c.ops:[{verb:'POST',uri:'/call'}]).forEach(o=>lines.push({a:`// ${o.verb} ${o.uri}`.trim(),s:fn(o)}));}
  if(Array.isArray(c.funcs)&&c.funcs.length){for(let i=lines.length-1;i>=0;i--)if(lines[i].s)lines.splice(i,1);c.funcs.forEach(s=>lines.push({s:/\(/.test(s)?s:s+'()'}));}
  return {ann,cls,deps,lines};
}
// C4: «ящик» с кодом внутри окна под компонентами — окно вырастает вниз,
// соседи раздвигаются, ничего не перекрывается
function zsCodeRows(c,m){
  const cd=zsCode(c,m);
  if(cd.raw)return [{t:cd.ann,cls:'a'},...cd.raw];
  const rows=[{t:cd.ann,cls:'a'},{t:`class ${cd.cls} {`,cls:'k'}];
  cd.deps.forEach(d=>rows.push({t:`  - ${d.charAt(0).toLowerCase()+d.slice(1)}: ${d}`,cls:'f'}));
  cd.lines.forEach(l=>{if(l.a)rows.push({t:'  '+l.a,cls:'a'});if(l.s)rows.push({t:'  + '+l.s,cls:'m'});});
  rows.push({t:'}',cls:'k'});
  return rows;
}
const ZS_DW=290,ZS_LH=11.5;
function zsDrawer(m){
  m.drawer=null;if(!ZS.comp||ZS.pc<=0)return;
  const c=m.byId[ZS.comp];if(!c)return;
  const f=m.frame,G=ZS_G,e=zsEase(ZS.pc),rows=zsCodeRows(c,m);
  const DW=ZS_DW,DH=22+rows.length*ZS_LH+8;
  const grow=Math.max(0,DW+2*G.pad-f.w)*e;f.x-=grow/2;f.w+=grow;
  const y=f.y+f.h-G.pad+10;
  const x=Math.max(f.x+G.pad,Math.min(f.x+f.w-G.pad-DW,c.x+c.w/2-DW/2));
  f.h+=(DH+10)*e;
  m.drawer={x,y,w:DW,h:DH,rows,c,e};
}
function zsRenderCode(code){
  const m=ZS.model,D=m&&m.drawer;if(!D)return;
  const c=D.c,k=zsCompClr(c),e=D.e,{x,y,w:W,h:H}=D;
  const g=mkEl('g',{transform:`translate(0,${y}) scale(1,${(0.3+0.7*e).toFixed(3)}) translate(0,${-y})`,opacity:e.toFixed(3),'data-zs':'code'},code);
  // выноска: от компонента по зазору колонки вниз к ящику
  const lx=c.x-6,ly=c.y+c.h/2;
  mkEl('path',{d:`M${c.x} ${ly} L${lx} ${ly} L${lx} ${y}`,stroke:matDark(k,.5),'stroke-width':'1','stroke-dasharray':'3 2',fill:'none'},g);
  mkEl('rect',{x:x+2.5,y:y+3,width:W,height:H,fill:'#1c2230',opacity:'.22'},g);
  mkEl('rect',{x,y,width:W,height:H,fill:'#fffdf6',stroke:'#3a3020','stroke-width':'1'},g);
  mkEl('rect',{x:x+2,y:y+2,width:W-4,height:16,fill:'url(#zs-title)'},g);
  const tt=mkTxt(x+7,y+10,`C4 Code · ${c.name}`,'font-size:8.5px;font-weight:700;fill:#fff',g);tt.setAttribute('text-anchor','start');
  const CL={a:'#8a5a00',k:'#1f3a7a',f:'#4a6070',m:'#1c1810'};
  const mx=Math.floor((W-12)/4.95);
  D.rows.forEach((r,i)=>{const s=r.t.length>mx?r.t.slice(0,mx-1)+'…':r.t;const tx=mkTxt(x+7,y+26+i*ZS_LH,s,`font-size:8.2px;font-family:Consolas,'Courier New',monospace;fill:${CL[r.cls]};${r.cls==='k'||r.cls==='m'?'font-weight:600':''}`,g);tx.setAttribute('text-anchor','start');tx.setAttribute('xml:space','preserve');});
}
function zsApplyCode(){const code=$('zl-code');if(!code)return;code.innerHTML='';zsRenderCode(code);zsCrumbs();}
// C1: рамка системы поверх (вместо) внутренних блоков
function zsRenderL1(L){
  if(!ZS.l1||!ZS.sys)return;
  ensureMatDefs();
  const s=ZS.sys,B=s.box0,clr='#7aa2f7';
  const g=mkEl('g',{'data-zs':'system',transform:`translate(${s.cx},${s.cy}) scale(${s.k}) translate(${-s.cx},${-s.cy})`},L);
  matShape('rect',{x:B.x,y:B.y,width:B.w,height:B.h,rx:14},clr,g,{base:matTint(clr,.8),st:matDark(clr,.55),sw:'2'});
  matGloss(g,B.x+6,B.y+4,B.w-12,Math.min(70,B.h*0.18),10);
  const cx=B.x+B.w/2;let y=B.y+70;
  mkTxt(cx,y,zsSysName(),'font-size:40px;font-weight:800;fill:#1f3a7a',g);
  mkTxt(cx,y+38,'[Software System]','font-size:20px;fill:#3a4a6a;font-style:italic',g);
  mkTxt(cx,y+68,`${s.n} ${t('zs_containers')} · ${s.svcs.length} ${t('zs_services')}`,'font-size:17px;fill:#3a3020',g);
  // мини-список сервисов «под капотом»
  const names=s.svcs.map(zsLbl);const per=3,cw=Math.min(180,(B.w-40)/per);
  names.slice(0,12).forEach((n,i)=>{
    const col=i%per,row=Math.floor(i/per),x=cx-(per*cw)/2+col*cw+4,yy=y+96+row*30;
    mkEl('rect',{x,y:yy,width:cw-8,height:22,fill:'#fffdf6',stroke:'#7a6e5a','stroke-width':'1',opacity:'.92'},g);
    mkTxt(x+(cw-8)/2,yy+11,n.length>18?n.slice(0,17)+'…':n,'font-size:13px;fill:#1c1810',g);
  });
  mkTxt(cx,B.y+B.h-20,t('zs_l1_hint'),'font-size:15px;fill:#5a5040',g);
}
function zsSysName(){return (S.meta&&S.meta.systemName)||t('zs_system');}
let _zsDefs=false;
function zsEnsureDefs(){
  if(_zsDefs)return;const defs=$('canvas')?.querySelector('defs');if(!defs)return;
  const tmp=document.createElementNS(NS,'svg');
  tmp.innerHTML='<linearGradient id="zs-title" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f3a7a"/><stop offset="1" stop-color="#5a7ec0"/></linearGradient>';
  [...tmp.childNodes].forEach(n=>defs.appendChild(n));_zsDefs=true;
}

// ── UI: кнопки C1…C4, хлебные крошки, статус-бар ──────────────
function zsUI(){
  const L=S.view==='c4_level'?(S.c4Level||2):zsLevel();
  ['c4-l1','c4-l2','c4-l3','c4-l4'].forEach((id,i)=>{const b=$(id);if(!b)return;b.style.color='';b.style.background='';b.classList.toggle('on',L===i+1);});
  const c2=$('c4-l2');if(c2)c2.classList.toggle('zs-strict',S.view==='c4_level');
  zsCrumbs();
  if(typeof updateStatus==='function')updateStatus();
}
function zsStatusPrefix(){
  if(S.notationMode==='bpmn')return '';
  if(S.view==='c4_level')return 'C'+(S.c4Level||2)+' · '+t('zs_strict')+' · ';
  const L=zsLevel();return 'C'+L+' '+['','Context','Container','Component','Code'][L]+' · ';
}
function zsCrumbs(){
  const el=$('zs-crumbs');if(!el)return;
  if(!zsActive()||!S.blocks.length){el.style.display='none';return;}
  const L=zsLevel(),b=ZS.svc&&gb(ZS.svc),c=ZS.comp&&ZS.model&&ZS.model.byId[ZS.comp];
  const seg=(txt,n,id,cur)=>`<span class="zs-seg${cur?' cur':''}" ${cur?'':`onclick="zsGo(${n}${id?','+escJs(id):''})"`}>${esc(txt)}</span>`;
  const sysSeg=L===1?`<span class="zs-seg cur zs-sys" title="${esc(t('zs_rename'))}" onclick="zsRename(event)">${esc(zsSysName())}</span>`:seg(zsSysName(),1,null,false);
  let h=`<span class="zs-lv">C${L}</span>`+sysSeg+
    `<span class="zs-ren" title="${esc(t('zs_rename'))}" onclick="zsRename(event)">✎</span>`;
  if(L>=2&&!ZS.l1)h+=`<span class="zs-sep">›</span>`+(b?seg(zsLbl(b),3,b.id,L===3):`<span class="zs-seg cur">${esc(t('zs_containers_all'))}</span>`);
  if(c)h+=`<span class="zs-sep">›</span>`+seg(c.name,4,c.id,true);
  h+=`<span class="zs-hint">${esc(t('zs_hint_'+L))}</span>`;
  el.innerHTML=h;el.style.display='flex';
}

// Переименование системы прямо из крошек: ✎ (или 2× клик по имени) → поле ввода; Enter/blur — сохранить, Esc — отмена
function zsRename(e){
  if(e&&e.stopPropagation)e.stopPropagation();
  const el=$('zs-crumbs');if(!el)return;const seg=el.querySelector('.zs-seg');if(!seg)return;
  const inp=document.createElement('input');inp.className='zs-ren-in';inp.value=(S.meta&&S.meta.systemName)||'';
  inp.placeholder=t('zs_system');inp.size=Math.max(10,inp.value.length+2);
  let done=false;const fin=ok=>{if(done)return;done=true;
    if(ok){const v=inp.value.trim().slice(0,80);if(!S.meta)S.meta=defaultMeta();
      if(v!==(S.meta.systemName||'')){S.meta.systemName=v;pushHist();if(typeof autosave==='function')autosave();}}
    render();zsCrumbs();};
  inp.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter')fin(true);else if(ev.key==='Escape')fin(false);});
  inp.addEventListener('blur',()=>fin(true));
  inp.addEventListener('mousedown',ev=>ev.stopPropagation());
  seg.replaceWith(inp);const r=el.querySelector('.zs-ren');if(r)r.remove();inp.focus();inp.select();
}

// ── мышь по компонентам ──────────────────────────────────────
// Вызывается из mousedown холста до выбора блока. true — событие обработано.
function zsMouseDown(pt,e){
  if(!zsActive())return false;
  if(ZS.l1&&ZS.sys){
    const B=ZS.sys.box,hit=blockAt(pt);
    if(pt.x>=B.x&&pt.x<=B.x+B.w&&pt.y>=B.y&&pt.y<=B.y+B.h&&!hit){if(e.detail===2)zsGo(2);return true;}
    // C1 — раскладка только визуальная: таскать блоки здесь нельзя (иначе тихо поедут реальные координаты)
    if(hit){S.selected=hit.id;if(typeof updateSidebar==='function')updateSidebar();
      if(e.detail===2){zsGo(2);return true;}
      render();if(!ZS._l1Hint){ZS._l1Hint=1;toast(t('zs_l1_nodrag'));}return true;}
  }
  if(!ZS.svc||!ZS.bound||!ZS.model)return false;
  const f=ZS.model.frame;
  if(pt.x>=f.x+f.w-21&&pt.x<=f.x+f.w-6&&pt.y>=f.y+6&&pt.y<=f.y+19){zsGo(2);return true;}
  const c=zsCompAt(pt);if(!c)return false;
  if(e.detail===2){zsGo(4,c.id);return true;}
  ZS.sel=c.id;if(S.selected!==ZS.svc){S.selected=ZS.svc;}
  if(ZS.comp&&ZS.comp!==c.id)zsSetComp(c.id);
  updateSidebar();render();zsCrumbs();return true;
}

// ── симуляция: путь шарика внутри раскрытого сервиса ─────────
function zsCtr(c){return [c.x+c.w/2,c.y+c.h/2];}
function zsChainPts(inC,outC){
  const m=ZS.model;if(!m||!inC)return null;
  let seq=[inC];
  if(m.infra&&outC&&outC!==inC){ // путь по внутренним связям (BFS): listener → фильтры → route, pool → table
    const prev={[inC.id]:null},q=[inC.id];while(q.length){const a=q.shift();if(a===outC.id)break;m.links.forEach(l=>{if(l[0]===a&&!(l[1] in prev)){prev[l[1]]=a;q.push(l[1]);}});}
    if(outC.id in prev){const p=[];for(let x=outC.id;x;x=prev[x])p.unshift(m.byId[x]);seq=p;}
  }
  if(seq.length===1&&inC.col===0){const u=m.links.filter(l=>l[0]===inC.id).map(l=>m.byId[l[1]]).find(x=>x&&x.col===1&&(!outC||m.links.some(l=>l[0]===x.id&&l[1]===outC.id)))||m.links.filter(l=>l[0]===inC.id).map(l=>m.byId[l[1]]).find(x=>x&&x.col===1);if(u)seq.push(u);}
  if(outC&&outC!==inC&&!seq.includes(outC))seq.push(outC);
  const pts=[];
  for(let i=0;i<seq.length;i++){
    const c=seq[i],[x,y]=zsCtr(c);
    if(i>0){const p=seq[i-1],[px,py]=zsCtr(p);const x1=p.x+p.w,x2=c.x,mx=(x1+x2)/2;if(c.col>p.col){pts.push([x1,py],[mx,py],[mx,y],[x2,y]);}else pts.push([px,p.y+p.h],[x,c.y]);}
    pts.push([x,y]);
  }
  // равномерная выборка по длине (как edgePts)
  const seg=[];let L=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(d);L+=d;}
  if(L<1)return null;
  const N=Math.max(12,Math.min(48,Math.round(L/8))),out=[];
  for(let k=0;k<=N;k++){let d=L*k/N,i=0;while(i<seg.length-1&&d>seg[i]){d-=seg[i];i++;}const r=seg[i]?d/seg[i]:0;out.push({x:pts[i][0]+(pts[i+1][0]-pts[i][0])*r,y:pts[i][1]+(pts[i+1][1]-pts[i][1])*r});}
  return out;
}
function zsSimArrive(req){
  if(!ZS.bound||!ZS.model||!zsActive()||req.isResponse||req.dead||req.rev)return false;
  const at=req.path[req.idx];if(at!==ZS.svc||req._zsDone===req.idx)return false;
  if(ZS.model.infra==='broker'||ZS.model.infra==='queue')return false; // брокер ведёт свой движок (kafka-engine) — не перехватываем
  const m=ZS.model,prev=req.path[req.idx-1],next=req.path[req.idx+1];
  const ic=S.conns.find(c=>c.from===prev&&c.to===at),oc=next!=null&&S.conns.find(c=>c.from===at&&c.to===next);
  const inC=ic&&m.byId[m.bind[ic.id]],outC=(oc&&m.byId[m.bind[oc.id]])||(ic&&m.dest&&m.byId[m.dest[ic.id]]);
  const pts=zsChainPts(inC||m.comps.find(c=>c.col===0)||m.comps[0],outC);
  req._zsDone=req.idx;ZS.simHits=(ZS.simHits||0)+1;
  if(!pts)return false;
  const last=req.pts&&req.pts[req.pts.length-1];if(last)pts.unshift({x:last.x,y:last.y});
  req.pts=pts;req.t=0;req.status='flying';req.speed=Math.max(0.02,Math.min(0.08,0.9/pts.length*(typeof SPEED_MUL!=='undefined'?SPEED_MUL:1)));
  req._zsIn=true;
  return true;
}

// ── данные: b.components (миграция/валидация) ────────────────
// Старые файлы без поля грузятся как есть. Мусор отбрасывается, id чинятся.
function normalizeComponents(arr){
  if(!Array.isArray(arr))return undefined;
  const out=[],ids=new Set();
  arr.slice(0,60).forEach((c,i)=>{
    if(!c||typeof c!=='object'||Array.isArray(c))return;
    const name=String(c.name==null?'':c.name).trim().slice(0,60);if(!name)return;
    let id=String(c.id==null?'':c.id).trim().slice(0,40);if(!id||ids.has(id))id='cmp'+i;while(ids.has(id))id+='_';
    ids.add(id);
    const o={id,name,kind:ZS_KINDS.includes(c.kind)?c.kind:'uc'};
    if(Array.isArray(c.funcs)){const f=c.funcs.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,80)).slice(0,30);if(f.length)o.funcs=f;}
    if(Array.isArray(c.uses))o.uses=c.uses.map(String);
    out.push(o);
  });
  out.forEach(o=>{if(o.uses){o.uses=o.uses.filter(u=>ids.has(u)&&u!==o.id);if(!o.uses.length)delete o.uses;}});
  return out;
}

// ── правая панель: редактор компонентов ──────────────────────
function zsSidebarHtml(b){
  if(!zsExpandable(b))return '';
  const m=zsModel(b);const manual=m.manual,infra=!zsIsSvc(b);
  let h=`<div class="zs-ed"><div class="zs-ed-h">🧩 ${t('zs_ed_title')} <span>${manual?t('zs_ed_manual'):t('zs_ed_auto')}</span></div>`;
  m.comps.forEach(c=>{
    const k=zsCompClr(c);
    h+=`<div class="zs-ed-row${ZS.sel===c.id?' sel':''}"><i style="background:${k}"></i>`;
    if(manual){
      h+=`<input value="${esc(c.name)}" onchange="zsEdRename(${escJs(b.id)},${escJs(c.id)},this.value)">`+
        `<select onchange="zsEdKind(${escJs(b.id)},${escJs(c.id)},this.value)">${ZS_KINDS.map(x=>`<option value="${x}"${x===c.kind?' selected':''}>${esc(zsKindLbl(x))}</option>`).join('')}</select>`+
        `<b title="${esc(t('zs_ed_del'))}" onclick="zsEdDel(${escJs(b.id)},${escJs(c.id)})">✕</b>`;
    }else h+=`<span class="nm" onclick="zsGo(4,${escJs(c.id)})">${esc(c.name)}</span><span class="kd">${esc(zsKindLbl(c.kind))}</span>`;
    h+=`</div>`;
  });
  h+=`<div class="zs-ed-btns">`;
  if(infra){}
  else if(manual)h+=`<button class="lbtn" onclick="zsEdAdd(${escJs(b.id)})">＋ ${t('zs_ed_add')}</button><button class="lbtn" onclick="zsEdReset(${escJs(b.id)})">↺ ${t('zs_ed_reset')}</button>`;
  else h+=`<button class="lbtn" onclick="zsEdMaterialize(${escJs(b.id)})">✎ ${t('zs_ed_make')}</button>`;
  h+=`<button class="lbtn" onclick="zsGo(3,${escJs(b.id)})">🔍 C3</button></div></div>`;
  return h;
}
function _zsEdDone(){pushHist();render();updateSidebar();if(typeof autosave==='function')autosave();}
function zsEdMaterialize(id){
  const b=gb(id);if(!b)return;const m=zsModel(b);
  b.components=m.comps.map(c=>{const o={id:c.id,name:c.name,kind:c.kind};const u=m.links.filter(l=>l[0]===c.id).map(l=>l[1]);if(u.length)o.uses=u;return o;});
  _zsEdDone();
}
function zsEdReset(id){const b=gb(id);if(!b)return;delete b.components;ZS.sel=null;ZS.comp=null;_zsEdDone();}
function zsEdRename(id,cid,v){const b=gb(id),c=b?.components?.find(x=>x.id===cid);v=String(v||'').trim().slice(0,60);if(!c||!v)return;c.name=v;_zsEdDone();}
function zsEdKind(id,cid,v){const b=gb(id),c=b?.components?.find(x=>x.id===cid);if(!c||!ZS_KINDS.includes(v))return;c.kind=v;_zsEdDone();}
function zsEdDel(id,cid){
  const b=gb(id);if(!b||!b.components)return;
  b.components=b.components.filter(x=>x.id!==cid);b.components.forEach(x=>{if(x.uses){x.uses=x.uses.filter(u=>u!==cid);if(!x.uses.length)delete x.uses;}});
  if(!b.components.length)delete b.components;if(ZS.comp===cid)ZS.comp=null;_zsEdDone();
}
function zsEdAdd(id){
  const b=gb(id);if(!b)return;b.components=b.components||[];
  let n=1;while(b.components.some(x=>x.id==='m'+n))n++;
  b.components.push({id:'m'+n,name:'NewComponent'+n,kind:'uc'});_zsEdDone();
}

function zsInit(){zsEnsureDefs();zsUI();}
