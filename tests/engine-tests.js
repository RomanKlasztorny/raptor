// Node-тесты движка (без браузера): node tests/engine-tests.js
// Проверяют модель Kafka v2: партиционирование, назначение партиций, idle-консьюмеры,
// ребаланс, лаг, retention/compaction, ISR/хаос, retry→DLQ и обратную совместимость computeFlow.
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.join(__dirname,'..');
const ctx={console, Math, Date, JSON, Object, Array, String, Number, Set, Map, Infinity, isFinite};
ctx.S={blocks:[],conns:[]};
ctx.gb=id=>ctx.S.blocks.find(b=>b.id===id);
vm.createContext(ctx);
['engine.js','kafka-engine.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f}));
const X=vm.runInContext('({BROKER_STATE,KAFKA_CHAOS})',ctx);
let pass=0, fail=0;
function ok(c,name,extra){ if(c){pass++;} else {fail++; console.log('✗',name,extra===undefined?'':extra);} }
function setup(kSettings, consumers){
  ctx.S.blocks=[{id:'p',type:'service',settings:{},patterns:[]},{id:'k',type:'kafka',settings:kSettings||{},patterns:[]}];
  ctx.S.conns=[{id:'c0',from:'p',to:'k'}];
  (consumers||[{replicas:1}]).forEach((s,i)=>{ ctx.S.blocks.push({id:'c'+i+'b',type:'service',customLabel:'cons'+i,settings:s,patterns:[]}); ctx.S.conns.push({id:'cc'+i,from:'k',to:'c'+i+'b'}); });
  vm.runInContext('resetBrokerStates(); Object.keys(KAFKA_CHAOS).forEach(k=>delete KAFKA_CHAOS[k]);',ctx);
  return vm.runInContext('initBrokerState(gb("k"))',ctx);
}
const run=code=>vm.runInContext(code,ctx);

// 1. Обратная совместимость effCap/computeFlow
{
  const old={id:'k',type:'kafka',settings:{partitions:6,delivery:'exactly-once'}};
  ok(run('effCap')(old)===2000000*2*0.5,'effCap kafka как раньше (без новых настроек)');
  ok(run('baseLat')({type:'kafka',settings:{}})===5,'baseLat kafka как раньше');
  setup({},[{replicas:1}]);
  ctx.S.blocks.forEach(b=>b.rt=null);
  run('computeFlow')(ctx.S.blocks,ctx.S.conns,1000);
  const k=ctx.gb('k');
  ok(k.rt.lambdaIn===1000 && k.rt.health==='ok','computeFlow: kafka получает 1000 rps');
  ok(k.rt.kafka && k.rt.kafka.groups.length===1,'rt.kafka.groups рассчитаны');
}
// 2. Топик по умолчанию и чтение (баг 'default' vs 'events')
{
  setup({},[{replicas:1}]);
  const r=run('brokerProduce')('k',{value:{a:1}});
  ok(r.ack && r.partition>=0,'produce ack');
  const m=run('brokerConsume')('k',{});
  ok(m && m.topic==='events','brokerConsume по умолчанию читает events', m&&m.topic);
}
// 3. Хэш-партиционирование: один ключ → одна партиция; hot-key → горячая партиция
{
  setup({partitions:6},[{replicas:1}]);
  const ps=new Set(); for(let i=0;i<20;i++) ps.add(run('brokerProduce')('k',{key:'user-7'}).partition);
  ok(ps.size===1,'одинаковый ключ → одна партиция');
  setup({partitions:6,key_strategy:'hot-key'},[{replicas:1}]);
  for(let i=0;i<3000;i++) run('brokerProduce')('k',{value:{}});
  const counts=X.BROKER_STATE.k.topics.events.map(p=>p.produced);
  const mx=Math.max(...counts), avg=3000/6;
  ok(mx>avg*2.5,'hot-key даёт горячую партицию', counts.join(','));
  setup({partitions:6},[{replicas:1}]);
  for(let i=0;i<6000;i++) run('brokerProduce')('k',{value:{}});
  const c2=X.BROKER_STATE.k.topics.events.map(p=>p.produced);
  ok(Math.max(...c2)<1000*1.25 && Math.min(...c2)>1000*0.75,'by-entity распределяет равномерно', c2.join(','));
}
// 4. Назначение партиций: range / roundrobin / idle / sticky
{
  const A=run('kAssign');
  const tps=[0,1,2,3,4].map(p=>({t:'e',p}));
  const r=A('range',['a','b'],tps);
  ok(r.a.length===3&&r.b.length===2&&r.a[0].p===0&&r.a[2].p===2,'range: a=[0,1,2], b=[3,4]');
  const rr=A('roundrobin',['a','b'],tps);
  ok(rr.a.map(x=>x.p).join()==='0,2,4','roundrobin: a=0,2,4');
  const idle=A('range',['a','b','c','d'],[0,1].map(p=>({t:'e',p})));
  ok(idle.c.length===0&&idle.d.length===0,'консьюмеров больше партиций → idle');
  const prev=A('range',['a','b'],tps);
  const st=A('cooperative-sticky',['a','b','c'],tps,prev);
  const moved=['a','b'].reduce((n,m)=>n+st[m].filter(tp=>!prev[m].some(x=>x.p===tp.p)).length,0);
  ok(moved===0 && st.c.length>=1,'cooperative-sticky: старые партиции не переезжают между a/b');
}
// 5. Throughput зависит от числа консьюмеров и партиций; лаг
{
  function lagAfter(parts,reps){
    setup({partitions:parts,poll_rate:4,retry_dlq:false,delivery:'exactly-once'},[{replicas:reps}]);
    const st=X.BROKER_STATE.k;
    for(let t=0;t<20;t++){ for(let i=0;i<20;i++) run('brokerProduce')('k',{value:{}}); run('tickBrokerConsumers')(); }
    return run('brokerConsumerLag')('k',Object.keys(st.consumerGroups)[0]);
  }
  const l1=lagAfter(6,1), l3=lagAfter(6,3), l6=lagAfter(6,6), l2p=lagAfter(2,6);
  ok(l3<l1 && l6<l3,'больше консьюмеров → меньше лаг', [l1,l3,l6].join('/'));
  ok(l2p>l6,'2 партиции ограничивают параллелизм (4 idle из 6)', l2p+' vs '+l6);
  const st=X.BROKER_STATE.k, g=Object.values(st.consumerGroups)[0];
  ok(Object.values(g.assignment).filter(a=>a.length===0).length===4,'4 консьюмера idle при 2 партициях');
}
// 6. Несколько consumer groups читают независимо
{
  setup({partitions:3,delivery:'exactly-once',retry_dlq:false},[{replicas:1},{replicas:3}]);
  for(let i=0;i<30;i++) run('brokerProduce')('k',{value:{}});
  run('tickBrokerConsumers')();
  const gs=Object.values(X.BROKER_STATE.k.consumerGroups);
  ok(gs.length===2,'две группы');
  ok(gs[0].consumed<gs[1].consumed,'группа с 3 консьюмерами прочла больше', gs.map(g=>g.consumed).join('/'));
}
// 7. Ребаланс при изменении числа реплик консьюмера
{
  setup({partitions:4},[{replicas:1}]);
  const st=X.BROKER_STATE.k; run('tickBrokerConsumers')();
  ctx.gb('c0b').settings.replicas=2; run('tickBrokerConsumers')();
  const g=Object.values(st.consumerGroups)[0];
  ok(st.rebalances===1 && g.members.length===2 && g.generation===2,'ребаланс: generation++');
}
// 8. Retention и compaction
{
  setup({retention_msgs:50,partitions:1},[]);
  for(let i=0;i<120;i++) run('brokerProduce')('k',{key:'k'+(i%5)});
  const p=X.BROKER_STATE.k.topics.events[0];
  ok(p.messages.length===50 && p.base===70 && p.hw===120,'retention delete: logStart=70', p.base);
  setup({retention_msgs:50,partitions:1,cleanup:'compact'},[]);
  for(let i=0;i<120;i++) run('brokerProduce')('k',{key:'k'+(i%5)});
  const q=X.BROKER_STATE.k.topics.events[0];
  ok(q.messages.length<=50 && X.BROKER_STATE.k.compactedCount>0,'compaction удаляет старые версии ключей', q.messages.length);
  const keys=new Set(q.messages.map(m=>m.key)); ok(keys.size===5,'compaction сохраняет последнее значение каждого ключа');
}
// 9. ISR / min.insync / падение брокеров
{
  setup({partitions:3,replication:3,min_insync:2,acks:'all'},[{replicas:1}]);
  run('kafkaSetBrokerUp')('k',0,false);
  const r1=run('brokerProduce')('k',{key:'x'});
  ok(r1.ack,'1 брокер из 3 упал: ISR=2 ≥ min.insync → запись идёт');
  run('kafkaSetBrokerUp')('k',1,false);
  const r2=run('brokerProduce')('k',{key:'x'});
  ok(!r2.ack && r2.error==='NOT_ENOUGH_REPLICAS','2 из 3 упали: NOT_ENOUGH_REPLICAS', r2.error);
  ok(run('effCap')(ctx.gb('k'))<2000000*0.1,'хаос снижает effCap → computeFlow видит отказ');
  setup({partitions:3,replication:1,acks:'1'},[{replicas:1}]);
  run('kafkaSetBrokerUp')('k',0,false);
  const st=X.BROKER_STATE.k;
  ok(st.topics.events[0].offline,'RF=1: партиция на упавшем брокере offline');
  run('kafkaResetChaos')('k');
}
// 10. Retry-топик и DLQ
{
  // детерминированный PRNG на время блока: иначе ~2% прогонов без DLQ (флак)
  run('(()=>{let a=12345;globalThis.__rnd=Math.random;Math.random=()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296;};})()');
  setup({partitions:1,max_retries:2,poll_rate:50},[{replicas:1}]);
  const cb=ctx.gb('c0b'); cb.rt={health:'error'};   // консьюмер «болеет» → много ошибок
  for(let i=0;i<200;i++) run('brokerProduce')('k',{value:{}});
  for(let t=0;t<40;t++) run('tickBrokerConsumers')();
  const st=X.BROKER_STATE.k;
  const rt=Object.keys(st.topics).filter(n=>n.endsWith('.retry'));
  ok(rt.length && rt.every(n=>st.topicMeta[n].group) && st.retriedCount>0,'ошибки уходят в retry-топик своей группы', rt.join(','));
  const foreign=Object.values(st.consumerGroups).some(g=>Object.keys(g.topics).some(n=>n.endsWith('.retry')&&st.topicMeta[n].group!==g.gid));
  ok(!foreign,'чужие группы не читают чужой retry-топик (нет дублей)');
  ok(st.topics['events.dlq'] && st.dlq.length>0,'после max_retries → events.dlq', st.dlq.length);
  ok(st.dlq.every(m=>m.attempt===2),'в DLQ попадают сообщения после 2 ретраев');
  const n=run('kafkaRedriveDlq')('k'); ok(n>0 && st.dlq.length===0,'redrive DLQ → основной топик');
  run('Math.random=globalThis.__rnd');
}
// 11. Rate Limit режет поток дальше по графу
{
  ctx.S.blocks=[{id:'g',type:'api_gw',settings:{rate_limit_rps:400},patterns:['rate_limit']},{id:'s',type:'service',settings:{},patterns:[]}];
  ctx.S.conns=[{id:'x',from:'g',to:'s'}];
  run('computeFlow')(ctx.S.blocks,ctx.S.conns,1000);
  ok(ctx.gb('s').rt.lambdaIn===400 && Math.abs(ctx.gb('g').rt.rlDrop-0.6)<1e-9,'rate limit 400 rps: дальше идёт 400, 60% → 429');
}
// 12. Регресс: все шаблоны TMPLS считаются так же, как в baseline (git HEAD~ движок), если нет новых настроек
{
  const {execSync}=require('child_process');
  let baseSrc=null;
  try{ baseSrc=execSync('git show 1e9e023:engine.js',{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']}); }catch(e){}
  if(baseSrc){
    const old={console,Math,Date,JSON,Object,Array,String,Number,Set,Map,Infinity,isFinite}; vm.createContext(old);
    vm.runInContext(baseSrc,old);
    const cat={console,Math,Date,JSON,Object,Array,String,Number,Set,Map,Infinity,isFinite}; vm.createContext(cat);
    vm.runInContext(baseSrc,cat);
    vm.runInContext(fs.readFileSync(path.join(ROOT,'catalog.js'),'utf8')+'\n;globalThis.__T=TMPLS;',cat);
    const T=cat.__T; let n=0, diff=[];
    Object.entries(T).forEach(([key,tpl])=>{
      const mk=()=>{const ids=tpl.bls.map((_,i)=>'b'+i);
        return {blocks:tpl.bls.map((bl,i)=>({id:ids[i],type:bl.t,customLabel:bl.cl,patterns:bl.pat?bl.pat.slice():[],settings:bl.set?{...bl.set}:{},auth:bl.auth})),
          conns:tpl.cs.map((cc,j)=>({id:'c'+j,from:ids[cc[0]],to:ids[cc[1]]})),
          scen:(tpl.scenarios||[]).map(sc=>({volume:sc.volume!=null?sc.volume:100,path:sc.path.map(i=>ids[i])}))};};
      [false,true].forEach(real=>{
        const a=mk(), b=mk();
        if(real&&!a.scen.length) return;
        if(real){ vm.runInContext('computeFlowScenarios',old)(a.blocks,a.conns,a.scen); run('computeFlowScenarios')(b.blocks,b.conns,b.scen); }
        else { vm.runInContext('computeFlow',old)(a.blocks,a.conns,5000); run('computeFlow')(b.blocks,b.conns,5000); }
        a.blocks.forEach((x,i)=>{ const y=b.blocks[i]; n++;
          ['lambdaIn','cap','rho','dropRate','effLat','health','cascade','cbOpen','respTime'].forEach(f=>{
            if(String(x.rt[f])!==String(y.rt[f])) diff.push(key+(real?'[real]':'')+':'+x.type+'.'+f+' '+x.rt[f]+'→'+y.rt[f]); }); });
      });
    });
    console.log('  регресс: сравнено узлов',n);
    ok(diff.length===0,'computeFlow/Scenarios совпадают с baseline на всех шаблонах ('+n+' узлов)', diff.slice(0,5).join('; '));
  } else console.log('(пропуск регресс-теста: нет git baseline)');
}

// 13. Кэш/Redis/PgBouncer: настраиваемый hit rate, eviction, cluster, лимит соединений
{
  const mk=(redisS,pgS,svcS)=>({blocks:[
    {id:'g',type:'api_gw',settings:{},patterns:[]},
    {id:'s',type:'service',settings:svcS||{},patterns:['cache_aside']},
    {id:'r',type:'redis',settings:redisS||{},patterns:[]},
    {id:'d',type:'postgresql',settings:pgS||{},patterns:[]}],
    conns:[{from:'g',to:'s'},{from:'s',to:'r'},{from:'s',to:'d'}]});
  const flow=(m,l)=>{ run('computeFlow')(m.blocks,m.conns,l); return Object.fromEntries(m.blocks.map(b=>[b.id,b.rt])); };
  let rt=flow(mk(),1000);
  ok(rt.d.lambdaIn===200,'дефолт hit rate 80% → в БД 20%', rt.d.lambdaIn);
  rt=flow(mk({hit_rate:95}),1000);
  ok(rt.d.lambdaIn===50,'hit_rate=95 → в БД 5%', rt.d.lambdaIn);
  rt=flow(mk({hit_rate:0}),1000);
  ok(rt.d.lambdaIn===1000,'hit_rate=0 → весь трафик в БД', rt.d.lambdaIn);
  // computeFlowScenarios тоже берёт hit rate из блока
  const m=mk({hit_rate:90}); run('computeFlowScenarios')(m.blocks,m.conns,[{volume:1000,path:['g','s','d']}]);
  ok(m.blocks[3].rt.lambdaIn===100,'scenarios: hit_rate=90 → в БД 10%', m.blocks[3].rt.lambdaIn);
  // eviction: данные не влезают
  const H=run('cacheHitRate');
  const hL=H({type:'redis',settings:{maxmemory:'1gb',dataset:'2gb',eviction:'allkeys-LRU'}});
  const hF=H({type:'redis',settings:{maxmemory:'1gb',dataset:'2gb',eviction:'allkeys-LFU'}});
  ok(Math.abs(hL-0.8*Math.SQRT1_2)<1e-9,'LRU, fill=2 → hit 0.8·(1/2)^0.5', hL);
  ok(hF>hL && hF<0.8,'LFU теряет hit rate меньше LRU', hF);
  ok(H({type:'redis',settings:{}})===0.8,'старый Redis без настроек → 0.8');
  rt=flow(mk({maxmemory:'256mb',dataset:'2gb',eviction:'allkeys-LRU'}),1000);
  ok(rt.d.lambdaIn>200 && !rt.r.oomErr,'LRU переполнение → больше промахов в БД, без OOM', rt.d.lambdaIn);
  rt=flow(mk({maxmemory:'256mb',dataset:'2gb',eviction:'noeviction'}),1000);
  ok(rt.r.oomErr>0 && rt.r.dropRate>=rt.r.oomErr && rt.r.health!=='ok' && rt.d.lambdaIn===200,'noeviction переполнение → OOM-ошибки записи, hit не меняется', JSON.stringify({oom:rt.r.oomErr,h:rt.r.health}));
  rt=flow(mk({maxmemory:'1gb',eviction:'noeviction'}),1000);
  ok(!rt.r.oomErr,'noeviction без переполнения (дефолт 512mb/1gb) — ошибок нет');
  // Redis Cluster: ёмкость ∝ мастерам
  const E=run('effCap');
  ok(E({type:'redis',settings:{cluster:true}})===3000000,'cluster без cluster_shards → 3 мастера', E({type:'redis',settings:{cluster:true}}));
  ok(E({type:'redis',settings:{cluster:true,cluster_shards:6}})===6000000,'cluster_shards=6 → ×6');
  ok(E({type:'redis',settings:{cluster_shards:6}})===1000000,'без cluster мастера не учитываются');
  // PgBouncer: не умножает ёмкость, снимает лимит соединений
  ok(E({type:'postgresql',settings:{pgbouncer:true}},{blocks:[],conns:[]})===10000,'PgBouncer больше не ×5');
  const big=mk({}, {}, {replicas:20}); // 20 реплик × 10 = 200 соединений > 100
  rt=flow(big,100);
  ok(rt.d.cap===5000 && rt.d.connLimited && rt.d.connLimited.demand===200,'без PgBouncer: 200 соединений при max 100 → ёмкость ×0.5', rt.d.cap);
  rt=flow(mk({}, {pgbouncer:true}, {replicas:20}),100);
  ok(rt.d.cap===10000 && !rt.d.connLimited,'с PgBouncer лимит снят', rt.d.cap);
  rt=flow(mk({}, {max_connections:500}, {replicas:20}),100);
  ok(rt.d.cap===10000,'max_connections=500 хватает → без деградации');
}
// 14. Read/write split: реплики ускоряют только чтение, запись — на праймари
{
  const mk=(pgS,svcS,pats)=>({blocks:[
    {id:'g',type:'api_gw',settings:{},patterns:[]},
    {id:'s',type:'service',settings:svcS||{},patterns:pats||[]},
    {id:'r',type:'redis',settings:{hit_rate:90},patterns:[]},
    {id:'d',type:'postgresql',settings:Object.assign({pgbouncer:true},pgS||{}),patterns:[]}],
    conns:[{from:'g',to:'s'},{from:'s',to:'r'},{from:'s',to:'d'}]});
  const flow=(m,l)=>{ run('computeFlow')(m.blocks,m.conns,l); return m.blocks[3].rt; };
  let d=flow(mk({replicas:2}),1000);
  ok(d.cap===24000 && !d.writeBound && Math.abs(d.wShare-0.2)<1e-9,'дефолт 20% записи, 2 реплики → ёмкость как раньше (×2.4)', d.cap);
  d=flow(mk({replicas:10}),1000);
  ok(d.cap===50000 && d.writeBound,'10 реплик при 20% записи: потолок = праймари/0.2 = 50К, а не 80К', d.cap);
  d=flow(mk({replicas:3,write_share:50}),1000);
  ok(d.cap===20000 && d.writeBound,'write_share БД 50% → ёмкость 20К (запись упирается в праймари)', d.cap);
  d=flow(mk({replicas:3,write_share:0}),1000);
  ok(Math.round(d.cap)===31000,'только чтение → праймари + 3 реплики = 31К', d.cap);
  d=flow(mk({write_share:100}),1000);
  ok(d.cap===10000 && !d.writeBound,'без реплик ёмкость = праймари при любой доле записи', d.cap);
  // сервис с write_share: записи идут мимо кэша
  d=flow(mk({replicas:2},{write_share:30},['cache_aside']),1000);
  ok(d.lambdaIn===370 && d.lambdaWr===300,'сервис 30% записи + кэш 90%: в БД 300 записей + 70 промахов чтения', JSON.stringify({l:d.lambdaIn,w:d.lambdaWr}));
  ok(Math.abs(d.wShare-300/370)<1e-9 && d.writeBound,'доля записи в БД считается по фактическому потоку', d.wShare);
  // scenarios — так же
  const m=mk({replicas:2},{write_share:30},['cache_aside']); run('computeFlowScenarios')(m.blocks,m.conns,[{volume:1000,path:['g','s','d']}]);
  ok(m.blocks[3].rt.lambdaIn===370,'scenarios: write_share сервиса учитывается', m.blocks[3].rt.lambdaIn);
  // реплики не спасают write-bound нагрузку
  const a=flow(mk({replicas:2,write_share:60}),20000).rho, b=flow(mk({replicas:10,write_share:60}),20000).rho;
  ok(a===b && a>1,'при 60% записи 2 и 10 реплик дают одинаковую загрузку (упор в запись)', a+' / '+b);
  // лаг репликации
  d=flow(mk({replicas:2}),1000); const lowLag=d.replLag;
  d=flow(mk({replicas:2,write_share:90},{} ,[]),11000);
  ok(lowLag>0 && lowLag<20 && d.replLag>lowLag*10,'лаг реплик растёт при перегрузке праймари записью', lowLag+' → '+d.replLag);
  ok(flow(mk({}),1000).replLag===0,'без реплик лага нет');
}
// Kafka: нагрузка по партициям (rt.kafka.parts) — та же модель, что effCap/kafkaCapMul
{
  const F=(ks,cons,load)=>{ setup(ks,cons); ctx.S.blocks.forEach(b=>b.rt=null); run('computeFlow')(ctx.S.blocks,ctx.S.conns,load); return ctx.gb('k').rt; };
  let rt=F({partitions:6},[{replicas:6}],600000);
  const ps=rt.kafka.parts;
  ok(ps.length===6 && ps.every(x=>x.lambda===100000) && rt.kafka.hotPart===-1,'by-entity: 6 партиций по 100К, горячей нет', JSON.stringify(ps.map(x=>x.lambda)));
  ok(Math.abs(ps[0].rho-rt.rho)<1e-9,'ρ партиции = ρ топика при равномерном ключе', ps[0].rho+' / '+rt.rho);
  ok(ps.every(x=>x.lagGrowth>0),'6 партиций по 100К, у консьюмера 10К/реплику → лаг растёт везде');
  rt=F({partitions:6},[{replicas:6}],30000);
  ok(rt.kafka.parts.every(x=>x.lagGrowth===0),'30К rps на 6 реплик по 10К → лаг не растёт');
  rt=F({partitions:6,key_strategy:'hot-key'},[{replicas:6}],30000);
  const hp=rt.kafka.parts[rt.kafka.hotPart];
  ok(rt.kafka.hotPart>=0 && hp.hot && Math.abs(hp.share-(0.55+0.45/6))<1e-9,'hot-key: горячая партиция получает 0.55+0.45/P', hp&&hp.share);
  ok(Math.abs(rt.kafka.parts.reduce((a,x)=>a+x.share,0)-1)<1e-9,'доли партиций в сумме = 1');
  ok(Math.abs(hp.rho-rt.rho)<1e-6,'ρ горячей партиции = ρ топика (упор в одну партицию)', hp.rho+' / '+rt.rho);
  ok(hp.lagGrowth>0 && rt.kafka.parts.filter(x=>x.lagGrowth>0).length===1,'лаг растёт только на горячей партиции', JSON.stringify(rt.kafka.parts.map(x=>x.lagGrowth)));
  ok(rt.kafka.hotPart===Math.abs(run('hashStr')('celebrity-42'))%6,'горячая партиция = та же, что в симуляции (hash ключа)');
}
// NATS-кластер: ноды масштабируют ёмкость, по умолчанию — как раньше (500К)
{
  const E=run('effCap');
  ok(E({type:'nats',settings:{}})===500000,'nats по умолчанию 500К msg/s (как раньше)');
  ok(E({type:'nats',settings:{nodes:4}})===2000000,'nats nodes=4 → 2М msg/s');
}
console.log(`engine-tests: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
