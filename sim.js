// SIM — прогон симуляции, шарики-запросы, логи, клик по шарику
// (выделено из app.js при разбиении на модули)

// ═══════════════════════════════════════════════════════════════
// СИМУЛЯЦИЯ — шарики используют расчёт движка (реальная судьба)
// ═══════════════════════════════════════════════════════════════
let SIM={running:false,paused:false,rafId:null,dots:{},reqs:{},time:0,lastT:0,spawn:{}};
let _rId=0;

function runSim(){
  stopSim();
  if(typeof resetBrokerStates==='function')resetBrokerStates();
  analyze();
  const activeScs=(S.scenarios||[]).filter(function(sc){
    return sc.visible!==false&&sc.path&&sc.path.length>1;
  });
  if(!activeScs.length&&!S.blocks.some(function(b){return !new Set(S.conns.map(function(c){return c.to;})).has(b.id)&&S.conns.some(function(c){return c.from===b.id;});})){
    toast(t('sim_no_scenarios'));return;
  }
  SIM.running=true;SIM.paused=false;SIM.time=0;SIM.lastT=0;SIM.spawn={};SIM.dots={};SIM.reqs={};
  $('anim-layer').innerHTML='';
  if(typeof simPatReset==='function'){simPatReset();simPatLegend(true);}
  $('run-btn').style.display='none';$('pause-btn').style.display='';$('stop-btn').style.display='';
  SIM.rafId=requestAnimationFrame(simLoop);updateStatus();
}
function stopSim(){if(SIM.rafId)cancelAnimationFrame(SIM.rafId);Object.values(SIM.dots).forEach(d=>d?.remove());SIM.running=false;SIM.paused=false;SIM.dots={};SIM.reqs={};$('anim-layer').innerHTML='';if(typeof simPatReset==='function'){simPatReset();simPatLegend(false);}$('run-btn').style.display='';$('pause-btn').style.display='none';$('resume-btn').style.display='none';$('stop-btn').style.display='none';updateStatus();}
function pauseSim(){SIM.paused=true;$('pause-btn').style.display='none';$('resume-btn').style.display='';}
function resumeSim(){SIM.paused=false;$('pause-btn').style.display='';$('resume-btn').style.display='none';closeInsp();$('dot-modal').style.display='none';}

// сколько реальных запросов представляет 1 шарик (честность на ×10М)
function dotWeight(){return Math.max(1,Math.round(S.load/40));}

function simLoop(now){
  if(!SIM.running)return;
  if(!SIM.paused){
    const dt=SIM.lastT?Math.min(now-SIM.lastT,80):16;SIM.time+=dt;SIM.lastT=now;
    if(typeof simPatTick==='function')simPatTick(dt); // эффекты паттернов, backoff ретраев
    // Спавн по сценариям — каждый сценарий с шагами порождает шарики своего цвета
    const load=effLoad();
    const hasScs=(S.scenarios||[]).some(function(sc){return sc.visible!==false&&sc.path&&sc.path.length>1;});
    if(hasScs){
      (S.scenarios||[]).forEach(function(sc){
        if(sc.visible===false||!sc.path||sc.path.length<2)return;
        const rate=Math.min(12,Math.max(0.5,(sc.volume||100)/100*load));
        const interval=1000/rate;
        if(!SIM.spawn[sc.id])SIM.spawn[sc.id]=SIM.time;
        while(SIM.spawn[sc.id]<=SIM.time&&Object.keys(SIM.reqs).length<140){
          spawnScenario(sc);
          SIM.spawn[sc.id]+=interval;
        }
      });
    }else{
      // фолбэк: нет сценариев — спавним от source-блоков как раньше
      const hasInc=new Set(S.conns.map(c=>c.to));
      const sources=S.blocks.filter(b=>!hasInc.has(b.id)&&S.conns.some(c=>c.from===b.id));
      const rate=Math.min(12,Math.max(0.5,load/Math.max(1,sources.length)));
      const interval=1000/rate;
      if(!SIM.spawn['__src'])SIM.spawn['__src']=SIM.time;
      while(SIM.spawn['__src']<=SIM.time&&Object.keys(SIM.reqs).length<140){
        sources.forEach(s=>spawnReq(s.id));
        SIM.spawn['__src']+=interval;
      }
    }
    Object.values(SIM.reqs).forEach(req=>{
      if(req.status!=='flying'||!req.pts)return;
      const dot=SIM.dots[req.id];if(!dot)return;
      req.t+=req.speed;
      if(req.stopAt!=null&&req.t>=req.stopAt&&typeof simPatStop==='function'){simPatStop(req);return;} // паттерн оборвал хоп
      if(req.t>=1){if(req.rev&&typeof simPatRevDone==='function'){simPatRevDone(req);return;}onArrive(req);return;}
      const tt=req.rev?1-req.t:req.t; // rev — шарик идёт по ребру назад (retry, cache miss)
      const idx=Math.min(Math.floor(tt*(req.pts.length-1)),req.pts.length-2);
      const fr=tt*(req.pts.length-1)-idx;const p1=req.pts[idx],p2=req.pts[idx+1];
      const px=(p1.x+(p2.x-p1.x)*fr).toFixed(1); // pan/zoom даёт transform слоя anim-layer
      const py=(p1.y+(p2.y-p1.y)*fr).toFixed(1);
      if(req.isResponse){
        const angle=(Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI).toFixed(0);
        dot.setAttribute('transform',`translate(${px},${py}) rotate(${angle})`);
      } else {
        dot.setAttribute('cx',px);dot.setAttribute('cy',py);
      }
      dot.style.opacity='1';
    });
    // Тик консьюмеров: каждые 30 кадров (~500мс при 60fps)
    SIM._btick=(SIM._btick||0)+1;
    if(SIM._btick%30===0&&typeof tickBrokerConsumers==='function'){tickBrokerConsumers();if(typeof simPatKafka==='function')simPatKafka();}
  }
  SIM.rafId=requestAnimationFrame(simLoop);updateStatus();
}

// выбор пути: роутеры выбирают ОДНУ ветку, сервисы — тоже одну для анимации (фан-аут учтён в λ)
function nextHop(nodeId,visited){
  const outs=S.conns.filter(c=>c.from===nodeId&&!visited.has(c.to));
  if(!outs.length)return null;
  // Синхронные (не-брокерные) ветки приоритетнее для наглядности пути
  const sync=outs.filter(c=>{const t=gb(c.to);return t&&!['broker','queue'].includes(BASE[t.type]?.cat);});
  const pool=sync.length?sync:outs;
  return pool[Math.floor(Math.random()*pool.length)];
}
function buildPath(start){
  const path=[start],visited=new Set([start]);let cur=start,guard=0;
  while(guard++<20){const h=nextHop(cur,visited);if(!h)break;path.push(h.to);visited.add(h.to);cur=h.to;}
  return path;
}
// Спавн шарика строго по пути сценария (цвет = цвет сценария, путь = scenario.path)
function spawnScenario(sc){
  if(!sc||!sc.path||sc.path.length<2)return;
  const path=sc.path.slice();
  const color=sc.color||'#7aa2f7';
  const id='r'+(_rId++);
  const conn=S.conns.find(c=>c.from===path[0]&&c.to===path[1]);if(!conn)return;
  const pts=edgePts(conn);if(!pts)return;
  const req={id,path,idx:1,connId:conn.id,pts,t:0,speed:0,status:'flying',
             color,accLat:0,dead:false,trace:false,hopTrace:[],scenarioId:sc.id};
  setSpeed(req,path[1]);
  decideFate(req,path[1]);
  recordHop(req,path[0],path[1],conn);
  SIM.reqs[id]=req;
  const dot=document.createElementNS(NS,'circle');
  dot.setAttribute('r','6.5');dot.setAttribute('cx','-200');dot.setAttribute('cy','-200');
  dot.style.fill=req.color;dot.style.filter=`drop-shadow(0 0 5px ${req.color})`;dot.style.opacity='0';dot.style.cursor='pointer';
  dot.addEventListener('click',e=>{e.stopPropagation();showDotInfo(id);});
  dot.addEventListener('mousemove',e=>{showHoverTip(id,e.clientX,e.clientY);});
  dot.addEventListener('mouseleave',()=>{hideHoverTip();});
  $('anim-layer').appendChild(dot);SIM.dots[id]=dot;
}

// Выбрать сценарий для блока-источника (взвешенно по volume)
function pickScenario(startId){
  var m=(S.scenarios||[]).filter(function(sc){
    return sc.visible!==false&&sc.path&&sc.path.length>1&&sc.path[0]===startId;
  });
  if(!m.length)return null;
  var t=m.reduce(function(s,sc){return s+(sc.volume||1);},0),r=Math.random()*t,a=0;
  for(var i=0;i<m.length;i++){a+=(m[i].volume||1);if(r<=a)return m[i];}
  return m[m.length-1];
}

function spawnReq(start,opts){
  opts=opts||{};
  // Используем путь из сценария — так шарики идут через Kafka когда нужно
  const _sc=pickScenario(start);
  const path=_sc?_sc.path.slice():buildPath(start);
  if(path.length<2)return;
  const id='r'+(_rId++);
  const conn=S.conns.find(c=>c.from===path[0]&&c.to===path[1]);if(!conn)return;
  const pts=edgePts(conn);if(!pts)return;
  // судьба определяется на первом узле назначения по реальному dropRate
  const req={id,path,idx:1,connId:conn.id,pts,t:0,speed:0,status:'flying',color:'#7aa2f7',accLat:0,dead:false,trace:!!opts.trace,run:opts.run,hopTrace:[]};
  setSpeed(req,path[1]);
  decideFate(req,path[1]);
  if(req.trace)logHopFor(req,path[0],path[1],conn);
  recordHop(req,path[0],path[1],conn);
  SIM.reqs[id]=req;
  const dot=document.createElementNS(NS,'circle');dot.setAttribute('r',req.trace?'9':'6.5');dot.setAttribute('cx','-200');dot.setAttribute('cy','-200');
  dot.style.fill=req.color;dot.style.filter=`drop-shadow(0 0 ${req.trace?9:5}px ${req.trace?'#e0af68':req.color})`;dot.style.opacity='0';dot.style.cursor='pointer';
  if(req.trace)dot.setAttribute('stroke','#e0af68'),dot.setAttribute('stroke-width','2');
  dot.addEventListener('click',e=>{e.stopPropagation();showDotInfo(id);});
  dot.addEventListener('mousemove',e=>{showHoverTip(id,e.clientX,e.clientY);});
  dot.addEventListener('mouseleave',()=>{hideHoverTip();});
  $('anim-layer').appendChild(dot);SIM.dots[id]=dot;
}
function setSpeed(req,toId){const lat=Math.max(1,(gb(toId)?.rt?.effLat)||5);req.speed=Math.max(0.018,Math.min(0.6,24/Math.max(1,lat)*0.016*8*0.12*SPEED_MUL));}
function decideFate(req,toId){
  const rt=gb(toId)?.rt;if(!rt)return;
  req.accLat+=rt.effLat||0;
  if(!req.dead&&Math.random()<rt.dropRate){req.dead=true;req.color='#f7768e';req.deadAt=toId;}
  else if(rt.health==='warn'&&!req.dead){req.color='#e0af68';}
  const dot=SIM.dots[req.id];if(dot){dot.style.fill=req.color;dot.style.filter=`drop-shadow(0 0 5px ${req.color})`;}
  if(typeof simPatFate==='function')simPatFate(req,toId); // CB / retry / timeout / rate limit / cache / bulkhead
}
function onArrive(req){
  req.t=0;
  // C3: в раскрытом сервисе шарик сначала проходит цепочку контроллер → сервис → адаптер
  if(typeof zsSimArrive==='function'&&zsSimArrive(req))return;
  if(typeof simPatArrive==='function'&&simPatArrive(req))return; // паттерн/Kafka-парковка обработали прибытие
  if(req.dead&&!req.isResponse){const d=SIM.dots[req.id];if(d)setTimeout(()=>{d.remove();delete SIM.dots[req.id];delete SIM.reqs[req.id];},200);return;}
  if(req.idx>=req.path.length-1){
    if(req.isResponse){
      const d=SIM.dots[req.id];if(d)setTimeout(()=>{d.remove();delete SIM.dots[req.id];delete SIM.reqs[req.id];},200);return;
    }
    const lastId=req.path[req.path.length-1],ld=BASE[gb(lastId)?.type];
    if(!['db','cache','queue','broker','external','net'].includes(ld?.cat)){showDeadEnd(lastId);}
    else{
      flash(lastId,req.color);
      // Конец пути = брокер: событие опубликовано, но читать некому → копится lag
      if(['broker','queue'].includes(ld?.cat)&&typeof brokerProduce==='function')
        brokerProduce(lastId,{value:{req:req.id},reqId:req.id});
      if(req.trace)pushLog({run:req.run,hdr2:true,text:t('sim_arrived').replace('{lbl}',gb(lastId)?.customLabel||EL[gb(lastId)?.type]?.lbl)+(['db','cache'].includes(ld?.cat)?t('sim_forming_response'):'')});
      if(!req.dead&&['db','cache'].includes(ld?.cat))spawnResponse(req.path,req.color,req.trace?{run:req.run}:null);
    }
    const d=SIM.dots[req.id];if(d)setTimeout(()=>{d.remove();delete SIM.dots[req.id];delete SIM.reqs[req.id];},250);return;
  }
  req.idx++;const from=req.path[req.idx-1],to=req.path[req.idx];
  if(req.isResponse){
    const seg=getSegPts(from,to);if(!seg){delete SIM.reqs[req.id];SIM.dots[req.id]?.remove();delete SIM.dots[req.id];return;}
    req.pts=seg.pts;req.connId=seg.connId;req.t=0;req.status='flying';
    const _rc=S.conns.find(c=>(c.from===to&&c.to===from)||(c.from===from&&c.to===to));
    if(req.trace)logHopFor(req,from,to,_rc);
    recordHop(req,from,to,_rc);
    return;
  }
  const conn=S.conns.find(c=>c.from===from&&c.to===to);if(!conn){delete SIM.reqs[req.id];SIM.dots[req.id]?.remove();delete SIM.dots[req.id];return;}
  const pts=edgePts(conn);if(!pts){delete SIM.reqs[req.id];return;}

  // ── PRODUCE: два случая ──────────────────────────────────────
  const fromB=gb(from);
  const fromCat=BASE[fromB?.type]?.cat;
  if(typeof brokerProduce==='function'){
    // [1] broker-in-path: шарик прошёл через брокер — produce
    if(['broker','queue'].includes(fromCat)&&req.kDone!==from){ // Kafka: уже записано при парковке
      brokerProduce(from,{value:{req:req.id},reqId:req.id});
    }
    // [2] implicit: сервис/gw/auth → боковая связь на брокер (Kafka не в sc.path)
    if(!req.dead&&(fromCat==='svc'||fromCat==='gw'||fromCat==='auth')){
      S.conns.filter(c=>c.from===from).forEach(c=>{
        const bt=gb(c.to);
        if(bt&&['broker','queue'].includes(BASE[bt.type]?.cat)&&!req.path.includes(c.to)){
          brokerProduce(c.to,{value:{req:req.id,src:from},reqId:req.id}); // без ключа — key_strategy брокера
        }
      });
    }
  }
  // consume — НЕ здесь; tickBrokerConsumers() вызывается из simLoop каждые 30 кадров

  req.connId=conn.id;req.pts=pts;setSpeed(req,to);decideFate(req,to);req.status='flying';
  if(req.trace)logHopFor(req,from,to,conn);
  recordHop(req,from,to,conn);
}
function spawnResponse(path,color,opts){
  opts=opts||{};
  if(path.length<2)return;
  const revPath=[...path].reverse();
  const id='r'+(_rId++);
  const seg=getSegPts(revPath[0],revPath[1]);if(!seg)return;
  const req={id,path:revPath,idx:1,pts:seg.pts,connId:seg.connId,t:0,speed:0.04,status:'flying',color,isResponse:true,accLat:0,trace:!!opts.trace||!!opts.run,run:opts.run,hopTrace:[]};
  const _respConn=S.conns.find(c=>(c.from===revPath[1]&&c.to===revPath[0])||(c.from===revPath[0]&&c.to===revPath[1]));
  if(req.trace)logHopFor(req,revPath[0],revPath[1],_respConn);
  recordHop(req,revPath[0],revPath[1],_respConn);
  SIM.reqs[id]=req;
  const tri=document.createElementNS(NS,'polygon');
  tri.setAttribute('points',req.trace?'0,-7 12,0 0,7':'0,-5 9,0 0,5');
  tri.style.fill=color;tri.style.filter=`drop-shadow(0 0 ${req.trace?8:4}px ${req.trace?'#e0af68':color})`;tri.style.opacity='0';tri.style.cursor='pointer';
  tri.addEventListener('click',e=>{e.stopPropagation();showDotInfo(id);});
  tri.addEventListener('mousemove',e=>{showHoverTip(id,e.clientX,e.clientY);});
  tri.addEventListener('mouseleave',()=>{hideHoverTip();});
  $('anim-layer').appendChild(tri);SIM.dots[id]=tri;
}
function flash(nid,color){const b=gb(nid);if(!b)return;const fl=document.createElementNS(NS,'circle');fl.setAttribute('cx',b.x+bw(b)/2);fl.setAttribute('cy',b.y+bh(b)/2);fl.setAttribute('r','8');fl.style.fill=color;fl.style.opacity='0.55';$('anim-layer').appendChild(fl);let r=8;const iv=setInterval(()=>{r+=3;fl.setAttribute('r',r);fl.style.opacity=Math.max(0,0.55-(r-8)/30);if(r>34){clearInterval(iv);fl.remove();}},22);}
let _deShown={};
function showDeadEnd(nodeId){const b=gb(nodeId);if(!b)return;if(_deShown[nodeId]&&Date.now()-_deShown[nodeId]<4000)return;_deShown[nodeId]=Date.now();const r=svgRct();const z=S.zoom||1;const el=document.createElement('div');el.style.cssText=`position:fixed;left:${(b.x+bw(b)/2)*z+S.panX+r.left}px;top:${(b.y-14)*z+S.panY+r.top}px;transform:translateX(-50%);background:#1a1b26;border:1.5px solid #e0af68;border-radius:8px;padding:7px 11px;font-size:11px;color:#e0af68;z-index:200;white-space:nowrap;pointer-events:none`;el.textContent=t('sim_dead_end').replace('{lbl}',EL[b.type].lbl);document.body.appendChild(el);setTimeout(()=>el.remove(),3500);}

// ═══════════════════════════════════════════════════════════════
// 📋 ТРАССИРОВКА — лог пути запроса: бизнес-смысл + технический вызов
// ═══════════════════════════════════════════════════════════════
let LOG=[],TRACE_RUN=0;
const HOP_BIZ_KEYS={
  'actor>client':'hb_actor_client','actor>gw':'hb_actor_gw','actor>net':'hb_actor_net',
  'actor>svc':'hb_actor_svc','actor>bff':'hb_actor_bff',
  'client>gw':'hb_client_gw','client>net':'hb_client_net','client>svc':'hb_client_svc','client>bff':'hb_client_bff',
  'bff>gw':'hb_bff_gw','bff>net':'hb_bff_net','bff>db':'hb_bff_db','bff>cache':'hb_bff_cache',
  'gw>bff':'hb_gw_bff','net>bff':'hb_net_bff','net>net':'hb_net_net',
  'gw>cache':'hb_gw_cache','gw>svc':'hb_gw_svc','gw>net':'hb_gw_net','net>svc':'hb_net_svc',
  'svc>db':'hb_svc_db','svc>cache':'hb_svc_cache','svc>broker':'hb_svc_broker','svc>queue':'hb_svc_queue',
  'svc>svc':'hb_svc_svc','svc>external':'hb_svc_external','bff>svc':'hb_bff_svc',
  'broker>svc':'hb_broker_svc','queue>svc':'hb_queue_svc',
};
function hopBiz(fc,tc){const k=HOP_BIZ_KEYS[fc+'>'+tc];if(k)return t(k);return tc==='db'?t('hb_fallback_db'):tc==='cache'?t('hb_fallback_cache'):tc==='broker'?t('hb_fallback_broker'):t('hb_fallback_default');}
function hopTech(from,to,conn,isResp){
  if(conn){
    if(isResp){const r=connResp(conn)||conn.respLabel;if(r)return r;}
    else{const a=conn.label||connApi(conn)||conn.reqLabel;if(a)return a;}
  }
  const tc=BASE[to.type]?.cat,fc=BASE[from.type]?.cat;
  if(isResp)return BASE[to.type]?.cat==='actor'?t('tech_result_user'):t('tech_return_data');
  if(tc==='db')return t('tech_sql');
  if(tc==='cache')return t('tech_cache_get');
  if(tc==='broker')return t('tech_produce');
  if(tc==='queue')return t('tech_enqueue');
  if(tc==='gw')return t('tech_https');
  if(tc==='external')return t('tech_external');
  if(fc==='gw'&&tc==='svc')return t('tech_gw_proxy');
  if(tc==='svc')return t('tech_internal_api');
  if(tc==='net')return t('tech_net_route');
  return t('tech_http_generic');
}
function logHopFor(req,fromId,toId,conn){
  const from=gb(fromId),to=gb(toId);if(!from||!to)return;
  const fc=BASE[from.type]?.cat,tc=BASE[to.type]?.cat;
  const status=(req.dead&&req.deadAt===toId)?'fail':(to.rt?.health==='error'?'fail':to.rt?.health==='warn'?'slow':'ok');
  pushLog({run:req.run,reqId:req.id,resp:!!req.isResponse,
    from:from.customLabel||EL[from.type]?.lbl, to:to.customLabel||EL[to.type]?.lbl,
    biz:req.isResponse?t('log_biz_resp_return'):hopBiz(fc,tc),
    tech:hopTech(from,to,conn,req.isResponse), status});
}
// ОБХОД ДЕРЕВА ВЫЗОВОВ — детерминированный (вызов → вглубь → возврат)
// Это основа и для логов, и для UML: настоящая семантика sequence-диаграммы.
function walkCalls(startId,maxDepth){
  maxDepth=maxDepth||14;
  const events=[],usedConn=new Set(),deferred=[];
  function visit(id,depth){
    if(depth>maxDepth)return;
    const outs=S.conns.filter(c=>c.from===id&&!usedConn.has(c.id))
      .sort((a,b)=>{const ta=gb(a.to),tb=gb(b.to);return (ta?.y||0)-(tb?.y||0)||(ta?.x||0)-(tb?.x||0);});
    for(const c of outs){
      usedConn.add(c.id);
      const to=gb(c.to);if(!to)continue;
      const tcat=BASE[to.type]?.cat;
      const async=(tcat==='broker'||tcat==='queue');
      events.push({kind:async?'async':'call',from:id,to:c.to,conn:c,depth});
      if(async){
        // async = «отправил и забыл»: продюсер НЕ ждёт. Ветку брокера обрабатываем ОТДЕЛЬНО, потом —
        // чтобы столбик продюсера закрылся сразу, а не тянулся через всю цепочку уведомлений.
        deferred.push({id:c.to,depth});
      }else{
        visit(c.to,depth+1);
        events.push({kind:'return',from:c.to,to:id,conn:c,depth}); // синхронный вызов всегда возвращает
      }
    }
  }
  visit(startId,0);
  // асинхронные ветки (брокер → консьюмеры) — после синхронного потока, как отдельная фаза
  let guard=0;
  while(deferred.length&&guard++<40){const d=deferred.shift();if(!usedConn.has('async-root-'+d.id)){usedConn.add('async-root-'+d.id);events.push({kind:'asyncphase',from:d.id,to:d.id,depth:d.depth});visit(d.id,d.depth+1);}}
  return events;
}
function logFromEvents(events,runId){
  const out=[];
  events.forEach(ev=>{
    if(ev.kind==='asyncphase')return; // маркер фазы — в логе не нужен
    const from=gb(ev.from),to=gb(ev.to);if(!from||!to)return;
    const fc=BASE[from.type]?.cat,tc=BASE[to.type]?.cat;
    let biz,tech,status,arrow;
    if(ev.kind==='return'){
      const toActor=BASE[to.type]?.cat==='actor';
      biz=toActor?t('log_biz_user_sees'):t('log_biz_return_caller');
      tech=connResp(ev.conn)||ev.conn.respLabel||t('tech_return_data');
      status=from.rt?.health==='error'?'fail':from.rt?.health==='warn'?'slow':'ok';arrow='◀';
    }else if(ev.kind==='async'){
      biz=hopBiz(fc,tc);tech=ev.conn.label||ev.conn.reqLabel||t('tech_publish_async');status='ok';arrow='⇢';
    }else{
      biz=hopBiz(fc,tc);tech=hopTech(from,to,ev.conn,false);
      status=to.rt?.health==='error'?'fail':to.rt?.health==='warn'?'slow':'ok';arrow='→';
    }
    out.push({run:runId,depth:ev.depth,kind:ev.kind,arrow,
      from:from.customLabel||EL[from.type]?.lbl,to:to.customLabel||EL[to.type]?.lbl,biz,tech,status});
  });
  return out;
}
function pushLog(e){e.t=Date.now();LOG.push(e);if(LOG.length>500)LOG.shift();if(sideTab==='logs')renderLogs();}
function clearLog(){LOG=[];if(TRACE_TIMER){clearInterval(TRACE_TIMER);TRACE_TIMER=null;}renderLogs();}
let TRACE_TIMER=null;
function statusForName(name){
  const b=S.blocks.find(x=>(x.customLabel||EL[x.type]?.lbl)===name);
  if(!b||!b.rt)return 'ok';
  return b.rt.health==='error'?'fail':b.rt.health==='warn'?'slow':'ok';
}
// лог из АВТОРСКОГО сценария актора (приоритет) — то, что ты написал
function logFromScenario(text,runId){
  if(typeof parseSeq!=='function')return null;
  const model=parseSeq(text);if(!model.events.length)return null;
  const out=[];let depth=0;
  model.events.forEach(ev=>{
    if(ev.type==='frag'){out.push({run:runId,frag:true,depth,text:ev.kind.toUpperCase()+(ev.label?': '+ev.label:'')});depth++;return;}
    if(ev.type==='else'){out.push({run:runId,frag:true,depth:Math.max(0,depth-1),text:t('log_else')+(ev.label?': '+ev.label:'')});return;}
    if(ev.type==='end'){depth=Math.max(0,depth-1);return;}
    if(ev.type==='note')return;
    if(ev.type==='msg'){
      const from=model.lanes[ev.from]?.name||'?',to=model.lanes[ev.to]?.name||'?';
      out.push({run:runId,depth,kind:ev.dashed?'return':(ev.async?'async':'call'),
        arrow:ev.dashed?'◀':ev.async?'⇢':'→',from,to,
        biz:ev.note||(ev.dashed?t('log_return_result'):t('log_scenario_step')),
        tech:ev.text||'—',status:ev.dashed?statusForName(from):statusForName(to)});
    }
  });
  return out;
}
// Строит лог трассировки из структурированного сценария S.scenarios[i]
function logFromScenarioObj(sc, runId){
  if(!sc||!sc.path||!sc.steps)return null;
  var out=[];
  for(var i=0;i<sc.path.length-1;i++){
    var fromId=sc.path[i],toId=sc.path[i+1];
    var from=gb(fromId),to=gb(toId);
    if(!from||!to)continue;
    var step=sc.steps[i]||{};
    var isReturn=(!step.name&&!step.verb&&!step.uri&&!!step.resp);
    var biz=step.name||(step.resp?'← '+step.resp:'—');
    var tech=step.verb&&step.uri?step.verb+' '+step.uri:step.verb||step.uri||(step.resp||'—');
    var health=(gb(toId)?.rt?.health)||'ok';
    out.push({
      run:runId, kind:isReturn?'return':'call', arrow:isReturn?'◀':'→',
      from:from.customLabel||EL[from.type]?.lbl||fromId,
      to:to.customLabel||EL[to.type]?.lbl||toId,
      depth:0, biz:biz, tech:tech,
      status:health==='error'?'fail':health==='warn'?'slow':'ok'
    });
  }
  return out.length?out:null;
}

function traceRequest(scId){
  analyze();
  // Ищем сценарий по id (новый режим) или по блоку-источнику (fallback)
  var sc=(S.scenarios||[]).find(function(s){return s.id===scId;});
  var entries=sc?logFromScenarioObj(sc,0):null;
  var fromScenario=!!entries;
  if(!entries){
    // fallback: авто-обход от первого источника
    var hasInc=new Set(S.conns.map(function(c){return c.to;}));
    var src=S.blocks.find(function(b){return !hasInc.has(b.id)&&S.conns.some(function(c){return c.from===b.id;});});
    if(!src){toast(t('sim_no_src'));return;}
    var ev=walkCalls(src.id);
    if(!ev.length){toast(t('sim_no_src_conns'));return;}
    entries=logFromEvents(ev,0);
  }
  const runId=++TRACE_RUN;entries.forEach(function(e){e.run=runId;});
  const calls=entries.filter(function(e){return !e.frag&&e.kind!=='return';}).length;
  const label=sc?sc.name:t('sim_auto_from_scheme');
  LOG.push({hdr:true,run:runId,text:'▶ '+label+' · '+calls+' '+t('sim_steps')+(fromScenario?'':t('sim_auto_suffix'))});
  if(TRACE_TIMER)clearInterval(TRACE_TIMER);
  switchTab('logs');renderLogs();
  let i=0;
  TRACE_TIMER=setInterval(()=>{
    if(i>=entries.length){clearInterval(TRACE_TIMER);TRACE_TIMER=null;LOG.push({hdr2:true,run:runId,text:typeof t==='function'?t('log_done'):'✓ Done'});renderLogs();return;}
    pushLog(entries[i++]);
  },230);
}
function renderLogs(){
  const c=$('side-logs');if(!c)return;
  // Сценарии вместо блоков-источников — трассировка идёт по scenario.steps
  const scOpts=(S.scenarios||[]).filter(function(sc){return sc.visible!==false&&sc.path&&sc.path.length>1;})
    .map(function(sc){return `<option value="${esc(sc.id)}">${esc(sc.name||sc.id)}</option>`;}).join('')
    ||(typeof t==='function'?`<option value="">${t('log_no_scenarios')}</option>`:'<option value=""></option>');
  let h=`<div style="margin-bottom:8px">
    <select id="trace-src" style="width:100%;background:var(--bg3);color:var(--txt);border:1px solid var(--brd2);border-radius:6px;padding:5px 7px;font-size:11px;margin-bottom:6px">${scOpts}</select>
    <div style="display:flex;gap:6px">
      <button onclick="traceRequest(document.getElementById('trace-src').value)" style="flex:1;padding:8px;border:1px solid #e0af68;border-radius:6px;background:#e0af6822;color:#e0af68;cursor:pointer;font-size:11.5px;font-weight:600">${typeof t==='function'?t('log_trace_btn'):'▶ Trace'}</button>
      <button onclick="clearLog()" style="padding:8px 10px;border:1px solid #4a4c6a;border-radius:6px;background:transparent;color:#787c99;cursor:pointer;font-size:11.5px">${typeof t==='function'?t('log_clear_btn'):'Clear'}</button>
    </div>
  </div>`;
  if(!LOG.length){h+=`<div style="color:var(--txt2);font-size:11px;line-height:1.7">${typeof t==='function'?t('log_empty_hint'):''}</div>`;c.innerHTML=h;return;}
  LOG.forEach(e=>{
    if(e.hdr){h+=`<div style="margin:10px 0 4px;font-size:11px;font-weight:700;color:var(--yellow);border-bottom:1px solid var(--brd);padding-bottom:3px">${esc(e.text)}</div>`;return;}
    if(e.hdr2){h+=`<div style="font-size:10.5px;color:var(--green);font-weight:600;margin:3px 0 8px;padding-left:2px">${esc(e.text)}</div>`;return;}
    if(e.frag){h+=`<div style="margin-left:${(e.depth||0)*11}px;font-size:10px;color:var(--purple);font-weight:600;margin-top:3px;margin-bottom:2px">⎇ ${esc(e.text)}</div>`;return;}
    const clr=e.status==='fail'?'#f7768e':e.status==='slow'?'#e0af68':'#9ece6a';
    const st=e.status==='fail'?t('status_error'):e.status==='slow'?t('status_slow'):t('status_ok');
    const ind=(e.depth||0)*11;
    const dashed=e.kind==='return'?'border-left-style:dashed;':'';
    h+=`<div style="margin-left:${ind}px;background:var(--bg1);border-left:2px solid ${clr};${dashed}border-radius:5px;padding:5px 7px;margin-bottom:4px;font-size:10.5px;line-height:1.45">
      <div style="color:var(--txt);font-weight:600">${e.arrow} ${esc(e.from)} → ${esc(e.to)} <span style="float:right;color:${clr};font-size:9px">${st}</span></div>
      <div style="color:var(--txt2)">🧩 ${esc(e.biz)}</div>
      <div style="color:var(--blue)">⚙ ${esc(e.tech)}</div>
    </div>`;
  });
  c.innerHTML=h;c.scrollTop=c.scrollHeight;
}

// showBrokerInspector → заменён на openBrokerInspector в broker-inspector.js
// Оставлен как алиас на случай вызова из старого кода
function showBrokerInspector(blockId){ openBrokerInspector(blockId); }

function doReplay(blockId,groupId){
  brokerReplay(blockId,groupId);
  toast(t('sim_offset_reset'));
  // refreshBrokerInspector вызовется автоматически через setInterval
}

// ═══════════════════════════════════════════════════════════════
// КЛИК НА ШАРИК
// ═══════════════════════════════════════════════════════════════
function showDotInfo(id){
  const req=SIM.reqs[id];if(!req)return;pauseSim();hideHoverTip();
  const curId=req.path[req.idx-1]||req.path[0],nextId=req.path[req.idx];
  const cur=gb(curId),next=nextId?gb(nextId):null;
  const pathHtml=req.path.map((pid,i)=>{const b=gb(pid),d=EL[b?.type];const cls=i===req.idx-1?'path-cur':i<req.idx-1?'path-done':'path-next';return `<span class="path-step ${cls}">${b?bLabel(b):esc(pid)}</span>`;}).join('<span style="color:#6c7086">→</span>');
  const verdict=req.dead?t('dot_will_fail')+' '+(EL[gb(req.deadAt)?.type]?.lbl||'?')+' '+t('dot_overloaded'):req.color==='#e0af68'?t('dot_slow_going'):t('dot_will_arrive');
  const vClr=req.dead?'#f7768e':req.color==='#e0af68'?'#e0af68':'#9ece6a';
  const timeline=renderTraceTimeline(req);
  $('dot-info').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:14px;font-weight:600">${req.isResponse?t('dot_response'):t('dot_request')} #${id.slice(1)}</div><button onclick="resumeSim()" style="background:transparent;border:none;color:#787c99;cursor:pointer;font-size:16px">✕</button></div>
    <div style="font-size:11.5px;margin-bottom:12px;line-height:2">${pathHtml}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:11px;margin-bottom:10px">
      <div><div style="color:var(--txt2);margin-bottom:3px">${t('dot_now_at')}</div><b style="color:var(--txt)">${bLabel(cur)}</b></div>
      <div><div style="color:var(--txt2);margin-bottom:3px">${t('dot_next')}</div><b style="color:var(--txt)">${next?bLabel(next):t('dot_end')}</b></div>
      <div><div style="color:var(--txt2);margin-bottom:3px">${t('dot_accumulated')}</div><b style="color:var(--txt)">${req.accLat.toFixed(1)} ${CURR_LANG==='en'?'ms':'мс'}</b></div>
    </div>
    <div style="padding:9px;border-radius:7px;background:${vClr}1a;border-left:2px solid ${vClr};font-size:11.5px;color:${vClr};margin-bottom:12px">${verdict}</div>
    <div style="margin-bottom:8px">
      <div style="font-size:11.5px;font-weight:700;color:var(--txt);margin-bottom:8px;display:flex;align-items:center;gap:7px">
        <span>${t('dot_trace_title')}</span>
        <span style="font-size:9.5px;color:#4a4c6a;font-weight:400">${t('dot_trace_hint')}</span>
      </div>
      ${timeline}
    </div>
    <button onclick="resumeSim()" style="margin-top:6px;width:100%;padding:7px;border:1px solid #9ece6a77;border-radius:6px;background:#9ece6a22;color:#9ece6a;cursor:pointer;font-size:11.5px">${t('dot_continue')}</button>
  `;
  $('dot-modal').style.display='flex';
}

