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
    toast('Нет сценариев или связей для симуляции');return;
  }
  SIM.running=true;SIM.paused=false;SIM.time=0;SIM.lastT=0;SIM.spawn={};SIM.dots={};SIM.reqs={};
  $('anim-layer').innerHTML='';
  $('run-btn').style.display='none';$('pause-btn').style.display='';$('stop-btn').style.display='';
  SIM.rafId=requestAnimationFrame(simLoop);updateStatus();
}
function stopSim(){if(SIM.rafId)cancelAnimationFrame(SIM.rafId);Object.values(SIM.dots).forEach(d=>d?.remove());SIM.running=false;SIM.paused=false;SIM.dots={};SIM.reqs={};$('anim-layer').innerHTML='';$('run-btn').style.display='';$('pause-btn').style.display='none';$('resume-btn').style.display='none';$('stop-btn').style.display='none';updateStatus();}
function pauseSim(){SIM.paused=true;$('pause-btn').style.display='none';$('resume-btn').style.display='';}
function resumeSim(){SIM.paused=false;$('pause-btn').style.display='';$('resume-btn').style.display='none';closeInsp();$('dot-modal').style.display='none';}

// сколько реальных запросов представляет 1 шарик (честность на ×10М)
function dotWeight(){return Math.max(1,Math.round(S.load/40));}

function simLoop(now){
  if(!SIM.running)return;
  if(!SIM.paused){
    const dt=SIM.lastT?Math.min(now-SIM.lastT,80):16;SIM.time+=dt;SIM.lastT=now;
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
      req.t+=req.speed;if(req.t>=1){onArrive(req);return;}
      const idx=Math.min(Math.floor(req.t*(req.pts.length-1)),req.pts.length-2);
      const fr=req.t*(req.pts.length-1)-idx;const p1=req.pts[idx],p2=req.pts[idx+1];
      const px=(p1.x+(p2.x-p1.x)*fr+S.panX).toFixed(1);
      const py=(p1.y+(p2.y-p1.y)*fr+S.panY).toFixed(1);
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
    if(SIM._btick%30===0&&typeof tickBrokerConsumers==='function')tickBrokerConsumers();
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
  dot.style.fill=color;dot.style.filter=`drop-shadow(0 0 5px ${color})`;dot.style.opacity='0';dot.style.cursor='pointer';
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
}
function onArrive(req){
  req.t=0;
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
        brokerProduce(lastId,{value:{req:req.id},key:req.id});
      if(req.trace)pushLog({run:req.run,hdr2:true,text:'✓ Запрос дошёл до '+(gb(lastId)?.customLabel||EL[gb(lastId)?.type]?.lbl)+(['db','cache'].includes(ld?.cat)?' — формируется ответ ◀':'')});
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
    if(['broker','queue'].includes(fromCat)){
      brokerProduce(from,{value:{req:req.id},key:req.id});
    }
    // [2] implicit: сервис/gw/auth → боковая связь на брокер (Kafka не в sc.path)
    if(!req.dead&&(fromCat==='svc'||fromCat==='gw'||fromCat==='auth')){
      S.conns.filter(c=>c.from===from).forEach(c=>{
        const bt=gb(c.to);
        if(bt&&['broker','queue'].includes(BASE[bt.type]?.cat)&&!req.path.includes(c.to)){
          brokerProduce(c.to,{value:{req:req.id,src:from},key:req.id});
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
function flash(nid,color){const b=gb(nid);if(!b)return;const fl=document.createElementNS(NS,'circle');fl.setAttribute('cx',b.x+bw(b)/2+S.panX);fl.setAttribute('cy',b.y+bh(b)/2+S.panY);fl.setAttribute('r','8');fl.style.fill=color;fl.style.opacity='0.55';$('anim-layer').appendChild(fl);let r=8;const iv=setInterval(()=>{r+=3;fl.setAttribute('r',r);fl.style.opacity=Math.max(0,0.55-(r-8)/30);if(r>34){clearInterval(iv);fl.remove();}},22);}
let _deShown={};
function showDeadEnd(nodeId){const b=gb(nodeId);if(!b)return;if(_deShown[nodeId]&&Date.now()-_deShown[nodeId]<4000)return;_deShown[nodeId]=Date.now();const r=svgRct();const el=document.createElement('div');el.style.cssText=`position:fixed;left:${b.x+bw(b)/2+S.panX+r.left}px;top:${b.y-14+S.panY+r.top}px;transform:translateX(-50%);background:#1a1b26;border:1.5px solid #e0af68;border-radius:8px;padding:7px 11px;font-size:11px;color:#e0af68;z-index:200;white-space:nowrap;pointer-events:none`;el.textContent=`⚠ Тупик: ${EL[b.type].lbl} — запросу некуда идти дальше`;document.body.appendChild(el);setTimeout(()=>el.remove(),3500);}

// ═══════════════════════════════════════════════════════════════
// 📋 ТРАССИРОВКА — лог пути запроса: бизнес-смысл + технический вызов
// ═══════════════════════════════════════════════════════════════
let LOG=[],TRACE_RUN=0;
const HOP_BIZ={
  'actor>client':'Пользователь открывает приложение',
  'actor>gw':'Пользователь отправляет запрос в систему',
  'actor>net':'Пользователь обращается к системе через сеть',
  'actor>svc':'Пользователь работает с сервисом напрямую',
  'actor>bff':'Пользователь работает через приложение',
  'client>gw':'Приложение шлёт запрос на бэкенд',
  'client>net':'Запрос идёт через сеть (CDN/балансировщик)',
  'client>svc':'Приложение обращается к сервису',
  'client>bff':'Приложение шлёт запрос своему BFF',
  'bff>gw':'BFF идёт за данными через шлюз',
  'bff>net':'BFF обращается к сервисам через балансировщик',
  'bff>db':'BFF читает/пишет данные',
  'bff>cache':'BFF проверяет кэш',
  'gw>bff':'Шлюз направляет в BFF',
  'net>bff':'Балансировщик выбрал реплику BFF',
  'net>net':'Передаёт дальше по сети',
  'gw>cache':'Шлюз проверяет токен/лимиты в кэше',
  'gw>svc':'Gateway проверяет доступ и направляет в нужный сервис',
  'gw>net':'Gateway передаёт балансировщику',
  'net>svc':'Балансировщик выбирает свободную реплику сервиса',
  'svc>db':'Сервис читает или записывает данные в БД',
  'svc>cache':'Сервис проверяет кэш — быстрый ответ без БД',
  'svc>broker':'Сервис публикует событие (асинхронно, не ждёт)',
  'svc>queue':'Сервис ставит фоновую задачу в очередь',
  'svc>svc':'Сервис синхронно вызывает другой сервис',
  'svc>external':'Сервис обращается к внешней системе',
  'bff>svc':'BFF собирает данные из сервиса под клиент',
  'broker>svc':'Консьюмер читает событие из брокера и обрабатывает',
  'queue>svc':'Worker забирает задачу из очереди',
};
function hopBiz(fc,tc){return HOP_BIZ[fc+'>'+tc]||(tc==='db'?'Работает с данными':tc==='cache'?'Обращается к кэшу':tc==='broker'?'Публикует событие':'Вызывает следующий узел');}
function hopTech(from,to,conn,isResp){
  if(conn){
    if(isResp){const r=connResp(conn)||conn.respLabel;if(r)return r;}
    else{const a=conn.label||connApi(conn)||conn.reqLabel;if(a)return a;}
  }
  const tc=BASE[to.type]?.cat,fc=BASE[from.type]?.cat;
  if(isResp)return BASE[to.type]?.cat==='actor'?'результат пользователю (200 OK)':'возврат: 200 OK (данные)';
  if(tc==='db')return 'SQL: SELECT / INSERT';
  if(tc==='cache')return 'GET key (Redis)';
  if(tc==='broker')return 'produce(topic, event)';
  if(tc==='queue')return 'enqueue(task)';
  if(tc==='gw')return 'HTTPS запрос';
  if(tc==='external')return 'внешний API / SMTP вызов';
  if(fc==='gw'&&tc==='svc')return 'проксирует HTTP → сервис';
  if(tc==='svc')return 'вызов внутреннего API (REST/gRPC)';
  if(tc==='net')return 'маршрутизация трафика';
  return 'HTTP-запрос';
}
function logHopFor(req,fromId,toId,conn){
  const from=gb(fromId),to=gb(toId);if(!from||!to)return;
  const fc=BASE[from.type]?.cat,tc=BASE[to.type]?.cat;
  const status=(req.dead&&req.deadAt===toId)?'fail':(to.rt?.health==='error'?'fail':to.rt?.health==='warn'?'slow':'ok');
  pushLog({run:req.run,reqId:req.id,resp:!!req.isResponse,
    from:from.customLabel||EL[from.type]?.lbl, to:to.customLabel||EL[to.type]?.lbl,
    biz:req.isResponse?'Ответ возвращается отправителю':hopBiz(fc,tc),
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
      biz=toActor?'Пользователь видит результат':'Возвращает результат вызвавшему';
      tech=connResp(ev.conn)||ev.conn.respLabel||'200 OK (данные)';
      status=from.rt?.health==='error'?'fail':from.rt?.health==='warn'?'slow':'ok';arrow='◀';
    }else if(ev.kind==='async'){
      biz=hopBiz(fc,tc);tech=ev.conn.label||ev.conn.reqLabel||'publish событие (async)';status='ok';arrow='⇢';
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
    if(ev.type==='else'){out.push({run:runId,frag:true,depth:Math.max(0,depth-1),text:'иначе'+(ev.label?': '+ev.label:'')});return;}
    if(ev.type==='end'){depth=Math.max(0,depth-1);return;}
    if(ev.type==='note')return;
    if(ev.type==='msg'){
      const from=model.lanes[ev.from]?.name||'?',to=model.lanes[ev.to]?.name||'?';
      out.push({run:runId,depth,kind:ev.dashed?'return':(ev.async?'async':'call'),
        arrow:ev.dashed?'◀':ev.async?'⇢':'→',from,to,
        biz:ev.note||(ev.dashed?'Возврат результата':'Шаг сценария'),
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
    if(!src){toast('Нет сценариев и источников на схеме');return;}
    var ev=walkCalls(src.id);
    if(!ev.length){toast('У источника нет связей');return;}
    entries=logFromEvents(ev,0);
  }
  const runId=++TRACE_RUN;entries.forEach(function(e){e.run=runId;});
  const calls=entries.filter(function(e){return !e.frag&&e.kind!=='return';}).length;
  const label=sc?sc.name:'авто из схемы';
  LOG.push({hdr:true,run:runId,text:'▶ '+label+' · '+calls+' шагов'+(fromScenario?'':' (авто из схемы)')});
  if(TRACE_TIMER)clearInterval(TRACE_TIMER);
  switchTab('logs');renderLogs();
  let i=0;
  TRACE_TIMER=setInterval(()=>{
    if(i>=entries.length){clearInterval(TRACE_TIMER);TRACE_TIMER=null;LOG.push({hdr2:true,run:runId,text:'✓ Сценарий завершён'});renderLogs();return;}
    pushLog(entries[i++]);
  },230);
}
function renderLogs(){
  const c=$('side-logs');if(!c)return;
  // Сценарии вместо блоков-источников — трассировка идёт по scenario.steps
  const scOpts=(S.scenarios||[]).filter(function(sc){return sc.visible!==false&&sc.path&&sc.path.length>1;})
    .map(function(sc){return `<option value="${sc.id}">${sc.name||sc.id}</option>`;}).join('')
    ||'<option value="">нет сценариев — создай во вкладке Линии</option>';
  let h=`<div style="margin-bottom:8px">
    <select id="trace-src" style="width:100%;background:var(--bg3);color:var(--txt);border:1px solid var(--brd2);border-radius:6px;padding:5px 7px;font-size:11px;margin-bottom:6px">${scOpts}</select>
    <div style="display:flex;gap:6px">
      <button onclick="traceRequest(document.getElementById('trace-src').value)" style="flex:1;padding:8px;border:1px solid #e0af68;border-radius:6px;background:#e0af6822;color:#e0af68;cursor:pointer;font-size:11.5px;font-weight:600">▶ Трассировать сценарий</button>
      <button onclick="clearLog()" style="padding:8px 10px;border:1px solid #4a4c6a;border-radius:6px;background:transparent;color:#787c99;cursor:pointer;font-size:11.5px">Очистить</button>
    </div>
  </div>`;
  if(!LOG.length){h+='<div style="color:var(--txt2);font-size:11px;line-height:1.7">Выбери <b>кто инициирует</b> (Ученик, Ментор…) и нажми «<b style="color:var(--yellow)">Трассировать сценарий</b>».<br><br>📜 <b>Двойной клик по человечку</b> → опиши ЕГО сценарий (что он делает). Лог и UML возьмут именно его — у Ученика свой путь, у Ментора свой.<br><br>Формат шага:<br><code style="color:var(--blue)">App -> Gateway: POST /api/v1/enroll // ученик жмёт «записаться»</code><br>слева от <code>//</code> — технический вызов, справа — 🧩 бизнес-смысл.<br><br>Без сценария трассировка идёт авто-обходом схемы.</div>';c.innerHTML=h;return;}
  LOG.forEach(e=>{
    if(e.hdr){h+=`<div style="margin:10px 0 4px;font-size:11px;font-weight:700;color:var(--yellow);border-bottom:1px solid var(--brd);padding-bottom:3px">${e.text}</div>`;return;}
    if(e.hdr2){h+=`<div style="font-size:10.5px;color:var(--green);font-weight:600;margin:3px 0 8px;padding-left:2px">${e.text}</div>`;return;}
    if(e.frag){h+=`<div style="margin-left:${(e.depth||0)*11}px;font-size:10px;color:var(--purple);font-weight:600;margin-top:3px;margin-bottom:2px">⎇ ${e.text}</div>`;return;}
    const clr=e.status==='fail'?'#f7768e':e.status==='slow'?'#e0af68':'#9ece6a';
    const st=e.status==='fail'?'ошибка':e.status==='slow'?'медленно':'ok';
    const ind=(e.depth||0)*11;
    const dashed=e.kind==='return'?'border-left-style:dashed;':'';
    h+=`<div style="margin-left:${ind}px;background:var(--bg1);border-left:2px solid ${clr};${dashed}border-radius:5px;padding:5px 7px;margin-bottom:4px;font-size:10.5px;line-height:1.45">
      <div style="color:var(--txt);font-weight:600">${e.arrow} ${e.from} → ${e.to} <span style="float:right;color:${clr};font-size:9px">${st}</span></div>
      <div style="color:var(--txt2)">🧩 ${e.biz}</div>
      <div style="color:var(--blue)">⚙ ${e.tech}</div>
    </div>`;
  });
  c.innerHTML=h;c.scrollTop=c.scrollHeight;
}

// showBrokerInspector → заменён на openBrokerInspector в broker-inspector.js
// Оставлен как алиас на случай вызова из старого кода
function showBrokerInspector(blockId){ openBrokerInspector(blockId); }

function doReplay(blockId,groupId){
  brokerReplay(blockId,groupId);
  toast('↺ Offset сброшен — консьюмер перечитает с начала');
  // refreshBrokerInspector вызовется автоматически через setInterval
}

// ═══════════════════════════════════════════════════════════════
// КЛИК НА ШАРИК
// ═══════════════════════════════════════════════════════════════
function showDotInfo(id){
  const req=SIM.reqs[id];if(!req)return;pauseSim();hideHoverTip();
  const curId=req.path[req.idx-1]||req.path[0],nextId=req.path[req.idx];
  const cur=gb(curId),next=nextId?gb(nextId):null;
  const pathHtml=req.path.map((pid,i)=>{const b=gb(pid),d=EL[b?.type];const cls=i===req.idx-1?'path-cur':i<req.idx-1?'path-done':'path-next';return `<span class="path-step ${cls}">${b?.customLabel||d?.lbl||pid}</span>`;}).join('<span style="color:#6c7086">→</span>');
  const verdict=req.dead?'❌ Упадёт на '+(EL[gb(req.deadAt)?.type]?.lbl||'?')+' — перегружен':req.color==='#e0af68'?'⚠ Идёт медленно (узел под давлением)':'✅ Дойдёт успешно';
  const vClr=req.dead?'#f7768e':req.color==='#e0af68'?'#e0af68':'#9ece6a';
  const timeline=renderTraceTimeline(req);
  $('dot-info').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:14px;font-weight:600">${req.isResponse?'▶ Ответ':'🔵 Запрос'} #${id.slice(1)}</div><button onclick="resumeSim()" style="background:transparent;border:none;color:#787c99;cursor:pointer;font-size:16px">✕</button></div>
    <div style="font-size:11.5px;margin-bottom:12px;line-height:2">${pathHtml}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:11px;margin-bottom:10px">
      <div><div style="color:var(--txt2);margin-bottom:3px">СЕЙЧАС НА</div><b style="color:var(--txt)">${cur?.customLabel||EL[cur?.type]?.lbl||'?'}</b></div>
      <div><div style="color:var(--txt2);margin-bottom:3px">ДАЛЬШЕ</div><b style="color:var(--txt)">${next?(next.customLabel||EL[next.type].lbl):'конец'}</b></div>
      <div><div style="color:var(--txt2);margin-bottom:3px">НАКОПЛЕНО</div><b style="color:var(--txt)">${req.accLat.toFixed(1)} мс</b></div>
    </div>
    <div style="padding:9px;border-radius:7px;background:${vClr}1a;border-left:2px solid ${vClr};font-size:11.5px;color:${vClr};margin-bottom:12px">${verdict}</div>
    <div style="margin-bottom:8px">
      <div style="font-size:11.5px;font-weight:700;color:var(--txt);margin-bottom:8px;display:flex;align-items:center;gap:7px">
        <span>📋 Трейс запроса</span>
        <span style="font-size:9.5px;color:#4a4c6a;font-weight:400">нажми ▶ Продолжить — трейс обновится в реальном времени</span>
      </div>
      ${timeline}
    </div>
    <button onclick="resumeSim()" style="margin-top:6px;width:100%;padding:7px;border:1px solid #9ece6a77;border-radius:6px;background:#9ece6a22;color:#9ece6a;cursor:pointer;font-size:11.5px">▶ Продолжить</button>
  `;
  $('dot-modal').style.display='flex';
}

// ═══════════════════════════════════════════════════════════════
// 🔥 DEVOPS-РЕЖИМ — построй систему и удержи её под хаосом
// ═══════════════════════════════════════════════════════════════
let CHAOS={active:false,loadMul:1,budget:100,survived:0,goalT:90,tickId:null,events:[],startMul:1};
const EVT_POOL=[
  {id:'spike',title:'📈 Всплеск трафика',desc:'Распродажа/вирусный пост — входящий трафик резко вырос.',
   fix:'Масштабируй ВСЮ цепочку: инстансы Gateway, реплики сервисов, ёмкость БД.',dur:16,
   can:()=>true,apply:()=>{CHAOS.loadMul=Math.min(50,CHAOS.loadMul* (4+Math.random()*4));},revert:()=>{CHAOS.loadMul=CHAOS.startMul;}},
  {id:'crash',title:'💥 Падение ноды',desc:'Под/инстанс упал (OOM, краш). Ёмкость узла почти ноль.',
   fix:'Реплики/инстансы спасают: кластер переживает смерть ноды. Жди рестарта.',dur:12,
   can:()=>pickChaosNode(['svc','gw','db','cache','broker','net']),
   apply:e=>{const b=pickChaosNode(['svc','gw','db','cache','broker','net']);if(b){b.down=true;e.targetId=b.id;e.title='💥 '+(b.customLabel||EL[b.type].lbl)+' упал';}},
   revert:e=>{const b=gb(e.targetId);if(b)b.down=false;}},
  {id:'slow',title:'🐌 Деградация',desc:'Узел жив, но тормозит (диск/GC/сеть) — задержка ×3.',
   fix:'Circuit Breaker и Timeout у зовущих остановят каскад. Или ускорь зависимость.',dur:14,
   can:()=>pickChaosNode(['db','svc','cache']),
   apply:e=>{const b=pickChaosNode(['db','svc','cache']);if(b){b.chaosLat=3;e.targetId=b.id;e.title='🐌 '+(b.customLabel||EL[b.type].lbl)+' тормозит';}},
   revert:e=>{const b=gb(e.targetId);if(b)delete b.chaosLat;}},
  {id:'cacheflush',title:'🧊 Сброс кэша',desc:'Redis перезапущен — кэш пуст, вся нагрузка ринулась в БД (thundering herd).',
   fix:'Кэш защищал БД. Переживи окно: добавь ёмкость БД (PgBouncer, реплики) пока кэш греется.',dur:12,
   can:()=>S.blocks.some(b=>BASE[b.type]?.cat==='cache'),
   apply:e=>{const b=S.blocks.find(x=>BASE[x.type]?.cat==='cache');if(b){b.down=true;e.targetId=b.id;}},
   revert:e=>{const b=gb(e.targetId);if(b)b.down=false;}},
];
function pickChaosNode(cats){
  const cand=S.blocks.filter(b=>cats.includes(BASE[b.type]?.cat)&&!b.down&&!b.chaosLat);
  return cand.length?cand[Math.floor(Math.random()*cand.length)]:null;
}
function toggleChaos(){CHAOS.active?stopChaos(true):startChaos();}
function startChaos(){
  const hasInc=new Set(S.conns.map(c=>c.to));
  if(!S.blocks.length||!S.blocks.some(b=>!hasInc.has(b.id))){toast('Сначала построй систему с клиентом');return;}
  if(!S.blocks.some(b=>['db','cache','queue','broker'].includes(BASE[b.type]?.cat))){toast('Добавь хранилище — цепочке некуда вести');return;}
  closeTrainer&&closeTrainer();
  CHAOS.active=true;CHAOS.budget=100;CHAOS.survived=0;CHAOS.loadMul=1;CHAOS.startMul=1;CHAOS.events=[];
  S.blocks.forEach(b=>{b.down=false;delete b.chaosLat;});
  if(!SIM.running)runSim();else{SIM.paused=false;}
  const _cb=$('chaos-btn');if(_cb){_cb.textContent='⏹ Стоп';_cb.style.color='#f7768e';}
  CHAOS.tickId=setInterval(chaosTick,1000);
  CHAOS.nextEvt=4; // первое событие через 4с
  renderChaosBar();toast('🔥 DevOps: держи систему живой '+CHAOS.goalT+' секунд!',3000);
}
function stopChaos(manual){
  CHAOS.active=false;if(CHAOS.tickId)clearInterval(CHAOS.tickId);CHAOS.tickId=null;
  CHAOS.loadMul=1;S.blocks.forEach(b=>{b.down=false;delete b.chaosLat;});
  const _cb=$('chaos-btn');if(_cb){_cb.textContent='🔥 DevOps';_cb.style.color='#f7768e';}
  $('chaos-bar').style.display='none';
  // вернуть переключатель режима на «Конструктор»
  if(typeof activateBuildMode==='function')activateBuildMode();
  analyze();if(manual)stopSim();
}
function chaosTick(){
  CHAOS.survived++;
  // завершить истёкшие события
  CHAOS.events=CHAOS.events.filter(e=>{if(CHAOS.survived>=e.until){e.def.revert(e);return false;}return true;});
  // запустить новое событие по расписанию (чем дальше — тем чаще)
  if(CHAOS.survived>=CHAOS.nextEvt){
    fireEvent();
    const gap=Math.max(6,13-Math.floor(CHAOS.survived/15)); // ускоряемся со временем
    CHAOS.nextEvt=CHAOS.survived+gap;
  }
  analyze(); // пересчёт с учётом упавших/медленных узлов и спайка
  const reds=S.blocks.filter(b=>b.rt.health==='error').length;
  const warns=S.blocks.filter(b=>b.rt.health==='warn').length;
  if(reds>0)CHAOS.budget-=(4+reds*4);
  else if(warns>0)CHAOS.budget-=1;
  else CHAOS.budget=Math.min(100,CHAOS.budget+3); // восстановление SLA когда всё зелёное
  if(CHAOS.budget<=0){CHAOS.budget=0;renderChaosBar();return chaosEnd(false);}
  if(CHAOS.survived>=CHAOS.goalT)return chaosEnd(true);
  renderChaosBar();
}
function fireEvent(){
  const avail=EVT_POOL.filter(d=>d.can());
  if(!avail.length)return;
  const def=avail[Math.floor(Math.random()*avail.length)];
  const e={def,title:def.title,desc:def.desc,fix:def.fix,until:CHAOS.survived+def.dur,targetId:null};
  def.apply(e);
  CHAOS.events.push(e);
  toast('⚠ '+e.title,3500);
}
function chaosEnd(win){
  const survived=CHAOS.survived,budget=Math.round(CHAOS.budget);
  stopChaos(false);stopSim();
  const score=Math.round(survived*10+budget*5);
  $('dot-info').innerHTML=`
    <div style="text-align:center">
      <div style="font-size:34px;margin-bottom:6px">${win?'🏆':'💀'}</div>
      <div style="font-size:17px;font-weight:700;color:${win?'#9ece6a':'#f7768e'};margin-bottom:10px">${win?'Система выстояла!':'Система легла'}</div>
      <div style="font-size:12px;color:#c0caf5;line-height:1.8;margin-bottom:14px">
        Продержался: <b>${survived}</b> сек${win?' / '+CHAOS.goalT:''}<br>
        Остаток SLA-бюджета: <b style="color:${budget>30?'#9ece6a':'#e0af68'}">${budget}%</b><br>
        Очки: <b style="color:#7aa2f7">${score}</b>
      </div>
      <div style="font-size:11px;color:#787c99;line-height:1.6;margin-bottom:12px">${win?'Ты держал нагрузку под хаосом — это и есть работа дежурного инженера (on-call).':'Узлы краснели быстрее, чем ты успевал масштабировать. Заложи запас ёмкости и паттерны устойчивости ЗАРАНЕЕ.'}</div>
      <button onclick="$('dot-modal').style.display='none'" style="width:100%;padding:9px;border-radius:7px;border:1px solid #7aa2f7;background:#7aa2f722;color:#7aa2f7;cursor:pointer;font-size:12.5px">Закрыть</button>
    </div>`;
  $('dot-modal').style.display='flex';
}
function renderChaosBar(){
  const bar=$('chaos-bar');if(!bar)return;bar.style.display='block';
  const b=Math.round(CHAOS.budget);
  const bClr=b>50?'#9ece6a':b>25?'#e0af68':'#f7768e';
  const reds=S.blocks.filter(x=>x.rt.health==='error');
  const evHtml=CHAOS.events.map(e=>`<div style="font-size:10.5px;color:#f7768e;margin-top:3px">${e.title} <span style="color:#787c99">· ${Math.max(0,e.until-CHAOS.survived)}с</span><br><span style="color:#e0af68">→ ${e.fix}</span></div>`).join('');
  bar.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-weight:700;color:#f7768e;font-size:12px">🔥 DevOps</span>
      <span style="font-size:11px;color:#787c99">⏱ ${CHAOS.survived}/${CHAOS.goalT}с</span>
      <span style="font-size:11px">SLA: <b style="color:${bClr}">${b}%</b></span>
      <div style="flex:1;min-width:80px;height:6px;background:#11121a;border-radius:3px;overflow:hidden"><div style="height:100%;width:${b}%;background:${bClr};transition:width .3s"></div></div>
      <span style="font-size:11px;color:${reds.length?'#f7768e':'#9ece6a'}">${reds.length?'🔴 горит: '+reds.map(x=>x.customLabel||EL[x.type].lbl).join(', '):'✓ всё зелёное'}</span>
    </div>
    ${evHtml?`<div style="margin-top:6px;border-top:1px solid #3d3f5266;padding-top:5px">${evHtml}</div>`:'<div style="font-size:10.5px;color:#787c99;margin-top:5px">Ждём инцидент… крути реплики и паттерны заранее.</div>'}`;
}

