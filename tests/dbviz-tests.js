// Визуализация БД: старый проект без settings/schema, двойной клик → модалка, Esc, кнопка в инспекторе,
// все типы БД × шаблоны схем: вкладки «Топология» и «Модель» не пустые; модалка настроек поверх визуализации.
// Переменные: RAPTOR_URL, CHROME, SHOTS (каталог для скриншотов, необязательно).
const path=require('path');
const req=m=>{try{return require(m);}catch(e){return require(path.join(process.env.BPMN_TOOLS||'/workspace/bpmn-tools','node_modules',m));}};
const puppeteer=req('puppeteer-core');
const OUT=process.env.SHOTS?process.env.SHOTS.replace(/\/?$/,'/'):'';
const URL=process.env.RAPTOR_URL||'http://127.0.0.1:5847/index.html';
let pass=0,fail=0;const ok=(c,n,d)=>{if(c){pass++;console.log('  ✓',n);}else{fail++;console.log('  ✗',n,d!==undefined?JSON.stringify(d):'');}};
(async()=>{
  const br=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--window-size=1500,1000']});
  const pg=await br.newPage();await pg.setViewport({width:1500,height:1000});
  const errs=[];
  pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  pg.on('pageerror',e=>errs.push('pageerror: '+e.message));
  // старый проект: блоки БД без settings/schema
  await pg.goto(URL,{waitUntil:'load'});
  await pg.evaluate(()=>{window.removeEventListener('beforeunload',autosave);localStorage.setItem('arch4_auto',JSON.stringify({blocks:[
    {id:'o1',type:'service',x:60,y:80},{id:'o2',type:'postgresql',x:300,y:60},{id:'o3',type:'redis',x:300,y:200},{id:'o4',type:'clickhouse',x:300,y:340}],
    conns:[{id:'c1',from:'o1',to:'o2'},{id:'c2',from:'o1',to:'o3'}],nid:10}));});
  await pg.reload({waitUntil:'load'});await new Promise(r=>setTimeout(r,800));
  const old=await pg.evaluate(()=>({n:S.blocks.length,types:S.blocks.map(b=>b.type)}));
  ok(old.n===4,'старый проект из автосейва открылся',old);
  const shot=async n=>{if(!OUT)return;await new Promise(r=>setTimeout(r,250));await pg.screenshot({path:OUT+n+'.png'});};
  // dblclick по старому PG-блоку (реальный путь через событие)
  await pg.evaluate(()=>{const b=gb('o2');S.selected='o2';if(typeof updateSidebar==='function')updateSidebar();});
  const pos=await pg.evaluate(()=>{const r=svgRct();const z=S.zoom||1;const b=gb('o2');return {x:r.left+S.panX+(b.x+20)*z,y:r.top+S.panY+(b.y+15)*z};});
  await pg.mouse.click(pos.x,pos.y,{count:2});
  const opened=await pg.evaluate(()=>!!document.querySelector('#dbv-modal .dbv')&&$('dbv-modal').style.display!=='none');
  ok(opened,'двойной клик по PostgreSQL открывает визуализацию');
  await shot('00-old-project-pg-topology');
  await pg.keyboard.press('Escape');
  const closed=await pg.evaluate(()=>$('dbv-modal').style.display==='none');ok(closed,'Esc закрывает визуализацию');
  const insp=await pg.evaluate(()=>!!document.querySelector('#side-analysis .dbv-insp-btn'));ok(insp,'кнопка визуализации в инспекторе');
  await pg.evaluate(()=>openDBViz('o3','model'));await shot('01-old-project-redis-model-demo');
  await pg.evaluate(()=>openDBViz('o4','model'));await shot('02-old-project-clickhouse-model-demo');
  await pg.evaluate(()=>closeDBViz());
  // все типы с настройками и схемами из шаблонов
  const cases=[
    ['postgresql','ecommerce_orders',{replicas:2,pgbouncer:true}],
    ['mysql','shop_mysql',{replicas:1}],
    ['redis','leaderboard_redis',{cluster:true,cluster_shards:3,redis_replicas:1,eviction:'volatile-lru'}],
    ['redis_standalone','events_stream_redis',{cluster:false,persistence:'aof',redis_replicas:2}],
    ['elasticsearch','products_search_elasticsearch',{shards:3,es_replicas:1,es_nodes:3}],
    ['elasticsearch_yellow','logs_elasticsearch',{shards:2,es_replicas:2,es_nodes:2}],
    ['clickhouse','analytics_clickhouse',{shards:3,ch_replicas:2}],
    ['clickhouse_summing','revenue_clickhouse',{shards:1,ch_replicas:1}],
    ['mongodb','catalog_mongodb',{sharding:true,shard_count:3,replicas:3,shard_key:'category_id'}],
    ['mongodb_rs','chat_mongodb',{sharding:false,replicas:3}],
    ['cassandra','logs_cassandra',{nodes:6,rf:3,consistency:'QUORUM'}],
    ['cassandra_one','iot_cassandra',{nodes:5,rf:3,consistency:'ONE'}],
    ['s3','media_s3',{versioning:true,crr:true,storage_class:'STANDARD'}],
  ];
  let i=10;
  for(const [name,tpl,settings] of cases){
    const type=name.split('_')[0];
    const r=await pg.evaluate((type,tpl,settings,name)=>{
      const id='t_'+name;
      S.blocks.push({id,type,x:600,y:60+S.blocks.length*10,settings});
      S.conns.push({id:'cc_'+name,from:'o1',to:id});
      const t=DB_TEMPLATES.find(x=>x.id===tpl);if(!t)return 'no template '+tpl;
      applyDBTemplateToBlock(id,tpl);
      document.querySelectorAll('.modal-ov').forEach(m=>{if(m.id!=='dbv-modal')m.style.display='none';});
      analyze&&analyze();
      openDBViz(id,'topo');
      return document.querySelector('#dbv-modal .dbv-empty')?'EMPTY':'ok';
    },type,tpl,settings,name);
    await shot(`${i}-${name}-topology`);
    const r2=await pg.evaluate(()=>{dbvTab('model');return document.querySelector('#dbv-modal .dbv-empty')?.textContent||'ok';});
    await shot(`${i}-${name}-model`);
    ok(r==='ok'&&r2==='ok',name+': топология и модель',{topo:r,model:r2});
    i++;
  }
  // settings modal over viz + refresh on close
  const z=await pg.evaluate(()=>{openSettings('t_redis');const s=getComputedStyle($('set-modal')).zIndex,v=getComputedStyle($('dbv-modal')).zIndex;closeSettings();return s+' > '+v;});
  {const [a,b]=z.split(' > ').map(Number);ok(a>b,'настройки поверх визуализации (z-index '+z+')');}
  // самостоятельный SVG-экспорт: градиенты в своём <defs>, без классов и внешнего CSS
  const ex=await pg.evaluate(()=>{openDBViz('t_redis','topo');const s=dbvSvgStandalone(document.querySelector('#dbv-modal .dbv-svg'));
    const d=new DOMParser().parseFromString(s,'image/svg+xml'),refs=[...s.matchAll(/url\(#([\w-]+)\)/g)].map(m=>m[1]);
    return {ok:!d.querySelector('parsererror'),refs:[...new Set(refs)],miss:[...new Set(refs)].filter(id=>!d.getElementById(id)),cls:d.querySelectorAll('[class]').length,grad:d.querySelectorAll('defs linearGradient,defs radialGradient').length,btn:!!document.querySelector('#dbv-modal .dbv-exp')};});
  ok(ex.ok&&ex.btn&&ex.refs.length>0&&ex.miss.length===0&&ex.grad>0&&ex.cls===0,'DB-viz: экспорт SVG самодостаточен (defs градиентов внутри, без классов)',ex);
  await pg.evaluate(()=>closeDBViz());
  ok(!errs.filter(e=>!/favicon|404/.test(e)).length,'без JS-ошибок',errs);
  await br.close();
  console.log(`\nИТОГО: ${pass}/${pass+fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
