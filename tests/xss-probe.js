// Проба stored XSS: все пользовательские строки = payload, открываем все панели, смотрим, сработал ли onerror.
const path=require('path');
const req=m=>{try{return require(m);}catch(e){return require(path.join(process.env.BPMN_TOOLS||'/workspace/bpmn-tools','node_modules',m));}};
const puppeteer=req('puppeteer-core');
const URL=process.env.RAPTOR_URL||'http://127.0.0.1:5847/index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const br=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox'],defaultViewport:{width:1600,height:1000}});
  const pg=await br.newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept('<img src=x onerror="(window.__x=window.__x||[]).push(\'saveName\')">'));
  await pg.goto(URL,{waitUntil:'load'});await pg.evaluate(()=>localStorage.clear());await pg.reload({waitUntil:'load'});await sleep(300);
  await pg.evaluate(()=>{
    const P=f=>`<img src=x onerror="(window.__x=window.__x||[]).push((window.__step||'init')+':${f}')">`;
    const k=Object.keys(TMPLS).find(k=>TMPLS[k].g==='Системы'&&TMPLS[k].bls.some(b=>b.t==='kafka'));
    S.blocks=[];S.conns=[];placeTemplate(k);
    S.blocks.forEach(b=>{b.customLabel=P('blk:'+b.type);if(b.type==='kafka'){b.settings.topic_name='">'+P('topic');}});
    S.meta.userRoles=[{name:'">'+P('roleName'),can:['</textarea>'+P('roleCan')]}];S.meta.requirements=[{text:'">'+P('req'),card:'x'}];
    (S.scenarios||[]).forEach(sc=>{sc.name=P('scen');(sc.steps||[]).forEach(st=>{if(st){st.name=P('step');st.uri='/'+P('uri');}});});
    S.conns.forEach(c=>{if(c.method){c.method.name=P('meth');c.method.uri=P('muri');}});
    S.meta.systemName=P('sys');
    render();analyze();
  });
  const steps={
    sidebar:()=>{S.blocks.forEach(b=>{S.selected=b.id;updateSidebar();});S.selected=null;updateSidebar();},
    logs:()=>{switchTab('logs');renderLogs();if(S.scenarios[0])traceRequest(S.scenarios[0].id);},
    routes:()=>{switchTab('routes');renderRoutesPanel();},
    saves:()=>{saveCheckpoint();switchTab('saves');renderSaves();},
    settings:()=>{S.blocks.forEach(b=>{openSettings(b.id);closeSettings();});},
    methods:()=>{S.blocks.forEach(b=>{if(methodHost(b.type)){openMethods(b.id);closeMethods();}});},
    conns:()=>{S.conns.forEach(c=>{onConnClick(c.id);});closeInsp();},
    broker:()=>{S.blocks.filter(b=>['kafka','rabbitmq','nats','queue'].includes(b.type)).forEach(b=>{openBrokerInspector(b.id);closeBrokerInspector();});},
    dbviz:()=>{S.blocks.filter(b=>typeof DBV_META!=='undefined'&&DBV_META[b.type]).forEach(b=>{openDBViz(b.id,'topo');dbvTab('model');closeDBViz();});},
    seq:()=>{localStorage.removeItem('arch4_seq');openSeq();closeSeq();},
    meta:()=>{openMetaEditor();closeMetaEditor();},
    c4:()=>{if(typeof setView==='function')setView('c4_level');render();},
  };
  for(const [n,f] of Object.entries(steps)){await pg.evaluate(n=>{window.__step=n;},n);
    try{await pg.evaluate(`(${f.toString()})()`);}catch(e){console.log('step err',n,e.message.split('\n')[0]);}
    await sleep(150);}
  // симуляция + инфо о кружке
  await pg.evaluate(()=>{window.__step='sim';runSim();});await sleep(1500);
  await pg.evaluate(()=>{window.__step='dot';const id=Object.keys(SIM.reqs)[0];pauseSim();if(id)showDotInfo(id);});await sleep(200);
  await pg.evaluate(()=>{window.__step='broker-live';const k=S.blocks.find(b=>b.type==='kafka');openBrokerInspector(k.id);});await sleep(1500);
  const fired=await pg.evaluate(()=>[...new Set(window.__x||[])]);
  console.log('XSS fired:',fired.length?fired.join(', '):'none');
  console.log('page errors:',errs.length?errs:'none');
  await br.close();process.exit(fired.length||errs.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
