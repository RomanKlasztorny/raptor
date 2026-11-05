// ╔═══════════════════════════════════════════════════════════╗
// ║  СЛОЙ МАРШРУТИЗАЦИИ — сценарии-линии поверх схемы (как метро) ║
// ╚═══════════════════════════════════════════════════════════╝
// Схема = карта (блоки+связи). Сценарий = цветной маршрут запроса поверх неё.
// Несколько маршрутов на одной связи идут параллельными полосами (не перекрывают).

const ROUTE_COLORS=['#e0af68','#f7768e','#7aa2f7','#9ece6a','#bb9af7','#7dcfff','#ff9e64','#2ac3de','#ff007c','#b4f9f8','#e64553','#40a02b','#df8e1d','#8839ef','#fab387','#94e2d5'];
function nextRouteColor(){const used=new Set((S.scenarios||[]).map(s=>s.color));return ROUTE_COLORS.find(c=>!used.has(c))||('#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'));}
function ensureScenarios(){if(!S.scenarios)S.scenarios=[];}
// Синхронизировать массив шагов сценария с его маршрутом (по одному шагу на хоп пути)
function ensureScenSteps(s){
  if(!s.steps)s.steps=[];
  const need=Math.max(0,(s.path||[]).length-1);
  while(s.steps.length<need)s.steps.push({name:'',verb:'GET',uri:'',resp:''});
  if(s.steps.length>need)s.steps.length=need;
  return s.steps;
}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function nodeName(id){const b=gb(id);return b?(b.customLabel||EL[b.type]?.lbl||id):id;}

// ── РИСОВАНИЕ МАРШРУТА ──────────────────────────────────────
let ROUTE_DRAFT=null;
function startRouteDraw(){
  ensureScenarios();
  // НЕ привязываем первый узел: первый тап = инициатор сценария (любой блок — клиент, актор, да хоть БД)
  ROUTE_DRAFT={editId:null,name:(CURR_LANG==='en'?'Scenario ':'Сценарий ')+(S.scenarios.length+1),color:nextRouteColor(),actorId:null,path:[],steps:[]};
  S.mode='routing';
  toast(t('scen_draw_hint'),4000);
  switchTab('routes');render();renderRoutesPanel();
}
function editScenario(id){
  const s=(S.scenarios||[]).find(x=>x.id===id);if(!s)return;
  ROUTE_DRAFT={editId:id,name:s.name,color:s.color,actorId:s.actorId,path:s.path.slice()};
  ROUTE_HOVER=null;S.mode='routing';switchTab('routes');
  toast(t('scen_edit_hint'),4000);
  render();renderRoutesPanel();
}
let ROUTE_HOVER=null;
// поиск пути по схеме (сначала по направлению связей, потом без направления)
function routePathBFS(from,to){
  function bfs(directed){
    const q=[[from]],seen=new Set([from]);
    while(q.length){const p=q.shift(),cur=p[p.length-1];if(cur===to)return p;
      for(const c of S.conns){let nxt=null;if(c.from===cur)nxt=c.to;else if(!directed&&c.to===cur)nxt=c.from;
        if(nxt!=null&&!seen.has(nxt)){seen.add(nxt);q.push(p.concat(nxt));}}}
    return null;
  }
  return bfs(true)||bfs(false);
}
// узлы, куда можно пойти из текущего конца черновика (для подсветки)
function routeCandidates(){
  if(!ROUTE_DRAFT)return new Set();
  if(!ROUTE_DRAFT.path.length)return new Set(S.blocks.map(b=>b.id)); // первый тап — любой узел (инициатор)
  const last=ROUTE_DRAFT.path[ROUTE_DRAFT.path.length-1],set=new Set();
  S.conns.forEach(c=>{if(c.from===last)set.add(c.to);if(c.to===last)set.add(c.from);});
  return set;
}
function isRouteCandidate(id){return S.mode==='routing'&&routeCandidates().has(id);}
function setRouteHover(id){if(ROUTE_HOVER!==id){ROUTE_HOVER=id;render();}}
function validateHop(a,c){const f=gb(a),t=gb(c);const bad=(typeof badConn==='function')?badConn(EL[f.type],EL[t.type]):null;if(bad&&bad.sev==='error'){toast('⛔ '+bad.msg+' — '+tTask({ru:'так запрос ходить не может',en:'a request cannot travel this way'}));return false;}return true;}
function routeClickNode(b){
  if(!ROUTE_DRAFT||!b)return;
  const path=ROUTE_DRAFT.path;
  // Первый клик — инициатор (актор), шаг не нужен
  if(!path.length){path.push(b.id);ROUTE_DRAFT.actorId=b.id;render();renderRoutesPanel();return;}
  const last=path[path.length-1];
  if(b.id===last)return;
  const direct=S.conns.some(c=>(c.from===last&&c.to===b.id)||(c.from===b.id&&c.to===last));
  if(direct){
    if(!validateHop(last,b.id))return;
    path.push(b.id);
  } else {
    const bfs=routePathBFS(last,b.id);
    if(!bfs){toast(tTask({ru:'Нет пути по схеме до «'+nodeName(b.id)+'» — соедини узлы на схеме',en:'No path on the diagram to "'+nodeName(b.id)+'" — connect the nodes on the diagram'}));return;}
    for(let i=1;i<bfs.length;i++){
      if(!validateHop(bfs[i-1],bfs[i]))return;
      path.push(bfs[i]);
      // BFS-промежуточные узлы — пустой шаг без попапа
      if(i<bfs.length-1)(ROUTE_DRAFT.steps=ROUTE_DRAFT.steps||[]).push({name:'',verb:'',uri:'',resp:'',cache:null,dbTarget:null});
    }
  }
  render();renderRoutesPanel();
  // Показываем попап для последнего добавленного блока
  showStepPopup(b);
}
function finishRouteDraw(){
  if(!ROUTE_DRAFT)return;
  if(ROUTE_DRAFT.path.length<2){toast(t('scen_min_nodes'));return;}
  if(ROUTE_DRAFT.editId){
    const s=S.scenarios.find(x=>x.id===ROUTE_DRAFT.editId);
    if(s){s.path=ROUTE_DRAFT.path.slice();s.name=ROUTE_DRAFT.name;s.color=ROUTE_DRAFT.color;s.actorId=ROUTE_DRAFT.actorId;}
  }else{
    S.scenarios.push({id:'sc'+Date.now(),name:ROUTE_DRAFT.name,color:ROUTE_DRAFT.color,actorId:ROUTE_DRAFT.actorId,volume:100,path:ROUTE_DRAFT.path.slice(),steps:ROUTE_DRAFT.steps||[],visible:true});
  }
  removeStepPopup();
  ROUTE_DRAFT=null;ROUTE_HOVER=null;S.mode='idle';pushHist();render();renderRoutesPanel();toast(t('scen_saved'));
}
function cancelRouteDraw(){ROUTE_DRAFT=null;ROUTE_HOVER=null;S.mode='idle';render();renderRoutesPanel();}
function routeUndoLast(){if(ROUTE_DRAFT&&ROUTE_DRAFT.path.length>1){ROUTE_DRAFT.path.pop();render();renderRoutesPanel();}}

// ── ОТРИСОВКА ПОЛОС (вызывается из renderConns, слой conn-layer) ─
function offsetPath(pts,off){
  if(!off)return 'M '+pts.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' L ');
  const out=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
    const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
    out.push({x:pts[i].x+nx*off,y:pts[i].y+ny*off});
  }
  return 'M '+out.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' L ');
}
function scenUsesConn(s,connId){
  for(let i=0;i<s.path.length-1;i++){
    const a=s.path[i],b=s.path[i+1];
    const c=S.conns.find(cc=>(cc.from===a&&cc.to===b)||(cc.from===b&&cc.to===a));
    if(c&&c.id===connId)return true;
  }
  return false;
}
function renderRouteStripes(L){
  ensureScenarios();
  const gap=5,w=3.4;
  S.conns.forEach(c=>{
    const users=S.scenarios.filter(s=>s.visible&&(!ROUTE_DRAFT||s.id!==ROUTE_DRAFT.editId)&&scenUsesConn(s,c.id));
    if(!users.length)return;
    const pts=edgePts(c);if(!pts)return;
    users.forEach((s,k)=>{
      const off=(k-(users.length-1)/2)*gap;
      mkEl('path',{d:offsetPath(pts,off),fill:'none',stroke:s.color,'stroke-width':w,'stroke-linecap':'round',opacity:'0.92'},L);
    });
  });
  // черновик (уже проложенная часть)
  if(ROUTE_DRAFT&&ROUTE_DRAFT.path.length>1){
    for(let i=0;i<ROUTE_DRAFT.path.length-1;i++){
      const a=ROUTE_DRAFT.path[i],b=ROUTE_DRAFT.path[i+1];
      const c=S.conns.find(cc=>(cc.from===a&&cc.to===b)||(cc.from===b&&cc.to===a));if(!c)continue;
      const pts=edgePts(c);if(!pts)continue;
      mkEl('path',{d:offsetPath(pts,0),fill:'none',stroke:ROUTE_DRAFT.color,'stroke-width':4.5,'stroke-dasharray':'7 4',opacity:'0.95'},L);
    }
  }
  // превью: куда протянется линия к наведённому узлу (как в Cities: Skylines)
  if(ROUTE_DRAFT&&ROUTE_DRAFT.path.length&&ROUTE_HOVER){
    const last=ROUTE_DRAFT.path[ROUTE_DRAFT.path.length-1];
    if(ROUTE_HOVER!==last){
      const bfs=routePathBFS(last,ROUTE_HOVER);
      if(bfs)for(let i=0;i<bfs.length-1;i++){
        const c=S.conns.find(cc=>(cc.from===bfs[i]&&cc.to===bfs[i+1])||(cc.from===bfs[i+1]&&cc.to===bfs[i]));if(!c)continue;
        const pts=edgePts(c);if(pts)mkEl('path',{d:offsetPath(pts,0),fill:'none',stroke:ROUTE_DRAFT.color,'stroke-width':3,'stroke-dasharray':'2 5',opacity:'0.45'},L);
      }
    }
  }
}

// ── ПАНЕЛЬ СЦЕНАРИЕВ ────────────────────────────────────────
function renderRoutesPanel(){
  ensureScenarios();
  const c=$('side-routes');if(!c)return;
  let h='';
  if(S.mode==='routing'&&ROUTE_DRAFT){
    const pathTxt=ROUTE_DRAFT.path.map(nodeName).join(' → ')||t('scen_editing');
    h+=`<div style="background:var(--bg1);border:1px solid ${ROUTE_DRAFT.color};border-radius:7px;padding:9px;margin-bottom:8px">
      <div style="font-size:11px;color:${ROUTE_DRAFT.color};font-weight:700;margin-bottom:6px">${ROUTE_DRAFT.editId?'✏ '+escHtml(ROUTE_DRAFT.name):'✏ '+t('scen_new')}</div>
      <div style="font-size:10.5px;color:var(--txt2);margin-bottom:8px;line-height:1.4">${escHtml(pathTxt)}</div>
      <div style="display:flex;gap:6px">
        <button onclick="finishRouteDraw()" style="flex:1;padding:7px;border:1px solid #9ece6a;border-radius:6px;background:#9ece6a22;color:#9ece6a;cursor:pointer;font-size:11px">✓ OK</button>
        <button onclick="routeUndoLast()" style="padding:7px 9px;border:1px solid var(--brd2);border-radius:6px;background:transparent;color:#787c99;cursor:pointer;font-size:11px">↶</button>
        <button onclick="cancelRouteDraw()" style="padding:7px 9px;border:1px solid var(--brd2);border-radius:6px;background:transparent;color:#787c99;cursor:pointer;font-size:11px">${t('scen_cancel')}</button>
      </div>
    </div>`;
  }else{
    h+=`<button onclick="startRouteDraw()" style="width:100%;padding:8px;border:1px solid var(--blue);border-radius:6px;background:#1e4a9022;color:var(--blue);cursor:pointer;font-size:11.5px;font-weight:600;margin-bottom:8px">${t('scen_new')}</button>`;
  }
  if(!S.scenarios.length){h+=`<div style="color:var(--txt2);font-size:11px;line-height:1.7">${t('scen_hint')}</div>`;c.innerHTML=h;return;}
  S.scenarios.forEach(s=>{
    h+=`<div onmouseenter="S.hovScen='${s.id}';renderConns()" onmouseleave="S.hovScen=null;renderConns()" style="background:var(--bg1);border-radius:7px;padding:7px 8px;margin-bottom:6px;border-left:3px solid ${s.color}">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <input type="color" value="${s.color}" onchange="setScenColor('${s.id}',this.value)" style="width:18px;height:18px;border:none;background:none;padding:0;cursor:pointer;flex-shrink:0">
        <input value="${escHtml(s.name)}" onchange="setScenName('${s.id}',this.value)" style="flex:1;min-width:0;background:transparent;border:none;color:var(--txt);font-size:11.5px;font-weight:600;outline:none">
        <span onclick="editScenario('${s.id}')" style="cursor:pointer;color:var(--blue)">✏</span>
        <span onclick="openScenSteps('${s.id}')" style="cursor:pointer;color:var(--green)">📝</span>
        <span onclick="openSeqForScenario('${s.id}')" style="cursor:pointer;color:var(--blue)">📜</span>
        <span onclick="toggleScen('${s.id}')" style="cursor:pointer;opacity:${s.visible?1:0.3}">👁</span>
        <span onclick="runScen('${s.id}')" style="cursor:pointer;color:var(--green);font-weight:700">▶</span>
        <span onclick="delScen('${s.id}')" style="cursor:pointer;color:var(--red);opacity:.7">✕</span>
      </div>
      <div style="font-size:9.5px;color:var(--txt2);line-height:1.4">${escHtml(s.path.map(nodeName).join(' → '))}</div>
      <div style="font-size:10px;color:var(--txt2);margin-top:4px">${t('scen_volume')} <input type="number" min="0" value="${s.volume||0}" onchange="setScenVol('${s.id}',this.value)" style="width:70px;background:var(--bg3);border:1px solid var(--brd2);border-radius:4px;color:var(--txt);font-size:10px;padding:2px 5px"> rps</div>
    </div>`;
  });
  h+=`<button onclick="runAllScen()" style="width:100%;padding:7px;border:1px solid var(--green);border-radius:6px;background:#2a601022;color:var(--green);cursor:pointer;font-size:11px;margin-top:2px">${t('scen_run_all')}</button>`;
  c.innerHTML=h;
}
// ═══════════════════════════════════════════════════════════════
// РЕДАКТОР МЕТОДОВ ПО ШАГАМ СЦЕНАРИЯ (источник UML на бизнес-уровне)
// На каждом шаге маршрута: бизнес-смысл (над стрелкой) + метод verb/uri (под //) + ответ
// ═══════════════════════════════════════════════════════════════
const SCEN_VERBS=['GET','POST','PUT','PATCH','DELETE','PUBLISH','CONSUME','EVENT','SQL'];
let _scenStepsId=null;
function openScenSteps(id){
  const s=(S.scenarios||[]).find(x=>x.id===id);if(!s)return;
  if(!s.path||s.path.length<2){toast(t('scen_need_route_first'));return;}
  ensureScenSteps(s);
  _scenStepsId=id;
  let ov=document.getElementById('scensteps-modal');
  if(!ov){ov=document.createElement('div');ov.id='scensteps-modal';ov.className='modal-ov';
    ov.onclick=e=>{if(e.target===ov)closeScenSteps();};document.body.appendChild(ov);}
  ov.style.display='flex';renderScenSteps();
}
function closeScenSteps(){const ov=document.getElementById('scensteps-modal');if(ov)ov.style.display='none';_scenStepsId=null;pushHist();}
function renderScenSteps(){
  const s=(S.scenarios||[]).find(x=>x.id===_scenStepsId);if(!s)return;
  ensureScenSteps(s);
  const ov=document.getElementById('scensteps-modal');if(!ov)return;
  const inp='background:#1a1b26;border:1px solid #3d3f52;border-radius:5px;padding:5px 7px;font-size:11.5px;color:#c0caf5;outline:none;font-family:inherit;width:100%';
  const VERB_CLR={GET:'#9ece6a',POST:'#7aa2f7',PUT:'#e0af68',PATCH:'#bb9af7',DELETE:'#f7768e'};
  let rows='';
  for(let i=0;i<s.path.length-1;i++){
    const from=nodeName(s.path[i]),to=nodeName(s.path[i+1]);
    const st=s.steps[i]||{};
    const hidden=!!st._hidden;
    rows+=`<div style="border:1px solid ${hidden?'#2a2b3d':'#3d3f52'};border-radius:8px;padding:10px;margin-bottom:8px;background:#1a1b26;${hidden?'opacity:0.45':''}">
      <div style="font-size:11px;color:#7dcfff;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">
        ${t('scensteps_step')}${i+1}: ${escHtml(from)} → ${escHtml(to)}
        ${hidden?`<span style="font-size:9px;color:#787c99;background:#2a2b3d;padding:2px 7px;border-radius:10px;font-weight:400">${t('scensteps_hidden_uml')}</span>`:''}
      </div>
      ${hidden?`<div style="font-size:10px;color:#787c99;line-height:1.5">${escHtml(st.name||'')}</div>`:`
      <label style="font-size:10px;color:#9ece6a">${t('scensteps_biz_label')}</label>
      <input style="${inp};margin-bottom:6px" value="${escHtml(st.name||'')}" placeholder="${t('scensteps_biz_ph')}" oninput="setScenStep(${i},'name',this.value)">
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <select style="${inp};width:90px;color:${VERB_CLR[st.verb||'GET']};font-weight:700" onchange="setScenStep(${i},'verb',this.value)">${SCEN_VERBS.map(v=>`<option ${(st.verb||'GET')===v?'selected':''}>${v}</option>`).join('')}</select>
        <input style="${inp};color:#7dcfff" value="${escHtml(st.uri||'')}" placeholder="${t('scensteps_uri_ph')}" oninput="setScenStep(${i},'uri',this.value)">
      </div>
      <label style="font-size:10px;color:#787c99">${t('scensteps_resp_label')}</label>
      <input style="${inp}" value="${escHtml(st.resp||'')}" placeholder="${t('scensteps_resp_ph')}" oninput="setScenStep(${i},'resp',this.value)">
      `}
    </div>`;
  }
  ov.innerHTML=`<div class="modal-box" style="max-width:560px;width:96%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h2 style="color:#9ece6a">${t('scensteps_title')}${escHtml(s.name)}</h2>
      <button class="modal-btn" onclick="closeScenSteps()">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:10.5px;color:#787c99;flex:1">${t('scensteps_route')}${escHtml(s.path.map(nodeName).join(' → '))}</span>
      <button class="modal-btn" style="margin-top:0;border-color:#e0af6877;color:#e0af68" onclick="autofillScenSteps('${s.id}')" title="${t('scensteps_autofill_title')}">${t('scensteps_autofill')}</button>
    </div>
    <div style="max-height:54vh;overflow-y:auto">${rows}</div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="modal-btn primary" onclick="closeScenSteps()">${t('scensteps_done')}</button>
      <button class="modal-btn" onclick="closeScenSteps();openSeqForScenario('${s.id}')">${t('scensteps_show_uml')}</button>
    </div>
  </div>`;
}
function setScenStep(i,field,val){
  const s=(S.scenarios||[]).find(x=>x.id===_scenStepsId);if(!s||!s.steps[i])return;
  s.steps[i][field]=val;
}

// ── АВТО-ЗАПОЛНЕНИЕ шагов по логике ─────────────────────────
function inferVerb(text){
  const t=(text||'').toLowerCase();
  if(/созда|добав|оформ|регистр|публику|отправл|загруж|постит|постав|вход|логин|автор|аутент|sign.?in|log.?in/.test(t))return'POST';
  if(/измен|редактир|обнов|меня|правит/.test(t))return'PATCH';
  if(/удал|отмен|снос|блокир/.test(t))return'DELETE';
  return'GET';
}
function autoResp(fc,tc,verb){
  if(fc==='actor'||fc==='client')return tTask({ru:'Показывает результат',en:'Shows result'});
  if(tc==='db'||tc==='cache')return verb==='GET'?tTask({ru:'Отдаёт данные',en:'Returns data'}):tTask({ru:'Подтверждает операцию',en:'Confirms operation'});
  if(tc==='broker'||tc==='queue')return '';
  if(tc==='external')return tTask({ru:'200 OK (внешний ответ)',en:'200 OK (external response)'});
  // REST-корректные статус-коды по глаголу
  if(verb==='POST')return '201 Created';
  if(verb==='DELETE')return '204 No Content';
  if(verb==='PUT')return tTask({ru:'200 OK (ресурс заменён)',en:'200 OK (resource replaced)'});
  return '200 OK';
}

// URI по REST: POST = коллекция, GET/PATCH/PUT/DELETE = конкретный ресурс
function buildRestUri(resource, verb){
  if(verb==='POST')return `/api/v1/${resource}`;
  return `/api/v1/${resource}/{id}`;
}

// SQL по REST-глаголу
function buildSQL(resource, verb){
  if(verb==='GET')    return `SELECT * FROM ${resource} WHERE id = $1`;
  if(verb==='POST')   return `INSERT INTO ${resource} (...) VALUES (...) RETURNING *`;
  if(verb==='PUT')    return `UPDATE ${resource} SET ... WHERE id = $1`;       // полная замена
  if(verb==='PATCH')  return `UPDATE ${resource} SET col = $1 WHERE id = $2`;  // частичное
  if(verb==='DELETE') return `DELETE FROM ${resource} WHERE id = $1`;
  return `SELECT * FROM ${resource}`;
}

// Событие брокера: past-tense по CloudEvents (resource.created, resource.updated...)
function buildEvent(resource, verb){
  const past={POST:'created',PUT:'updated',PATCH:'updated',DELETE:'deleted',GET:'fetched'};
  return `${resource}.${past[verb]||'changed'}`;
}
const RESOURCE_MAP=[
  [/(личный кабинет|профил|profile|account)/i,'profile'],
  [/(пользовател|users?|account)/i,'users'],
  [/(авториз|аутентиф|auth|login|sign)/i,'auth'],
  [/(заказ|order)/i,'orders'],
  [/(оплат|платеж|платёж|payment|billing)/i,'payments'],
  [/(корзин|cart|basket)/i,'cart'],
  [/(каталог|товар|product|catalog)/i,'products'],
  [/(поиск|search)/i,'search'],
  [/(уведомл|notif)/i,'notifications'],
  [/(курс|course)/i,'courses'],
  [/(запис|enroll|application|заявк)/i,'enrollments'],
  [/(диалог|чат|сообщен|chat|message)/i,'messages'],
  [/(цел|goal)/i,'goals'],
  [/(привыч|habit)/i,'habits'],
  [/(трекинг|прогресс|tracking|progress)/i,'tracking'],
  [/(отзыв|рейтинг|review|rating)/i,'reviews'],
  [/(ментор|mentor)/i,'mentors'],
  [/(студент|student)/i,'students'],
  [/(подписк|subscription|план|plan|тариф)/i,'subscriptions'],
  [/(аналит|analytic)/i,'analytics'],
  [/(файл|медиа|file|media|upload)/i,'files'],
];
function resourceName(label){
  const s=String(label||'');
  for(const [re,en] of RESOURCE_MAP){if(re.test(s))return en;}
  const latin=s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return latin||'resource';
}

function autofillScenSteps(id){
  const s=(S.scenarios||[]).find(x=>x.id===id);if(!s)return;
  ensureScenSteps(s);
  const path=s.path;

  // ── Найти финальный сервис (последний svc/bff в пути) ──────
  let finalSvcIdx=-1;
  for(let i=path.length-1;i>=0;i--){
    const b=gb(path[i]);
    if(b&&['svc','bff'].includes(EL[b.type]?.cat)){finalSvcIdx=i;break;}
  }
  const finalSvcBlock=finalSvcIdx>=0?gb(path[finalSvcIdx]):null;
  const resource=resourceName(finalSvcBlock?(finalSvcBlock.customLabel||EL[finalSvcBlock.type]?.lbl):'resource');

  // ── Определить финальный глагол ────────────────────────────
  // Правило: verb берём ТОЛЬКО с шага, который непосредственно вызывает finalSvc
  // (не из всех шагов — иначе "Создаёт заказ" на шаге актора заразит весь путь POST-ом)
  let finalVerb='GET';
  let incomingToFinalIdx=-1; // индекс шага, чей TO = finalSvc от non-db

  for(let i=0;i<path.length-1;i++){
    if(path[i+1]===path[finalSvcIdx]){
      const fromCat=EL[gb(path[i])?.type]?.cat;
      if(fromCat!=='db'&&fromCat!=='cache'){
        incomingToFinalIdx=i;
        const v=s.steps[i]?.verb;
        // Берём verb только если он явно выставлен (не пустой и не дефолтный GET без смысла)
        if(v&&v!=='GET'&&SCEN_VERBS.includes(v)){finalVerb=v;break;}
        // GET — допустим явно, тоже берём
        if(v==='GET'){finalVerb='GET';break;}
      }
    }
  }
  // Фолбэк: угадываем verb ТОЛЬКО из текста шага, вызывающего финальный сервис
  // Никогда не угадываем из текста других шагов (это было причиной бага)
  if(finalVerb==='GET'&&incomingToFinalIdx>=0){
    const incomingName=(s.steps[incomingToFinalIdx]||{}).name||'';
    if(incomingName)finalVerb=inferVerb(incomingName);
  }

  // ── Заполнить каждый шаг ───────────────────────────────────
  for(let i=0;i<path.length-1;i++){
    const fb=gb(path[i]),tb=gb(path[i+1]);if(!fb||!tb)continue;
    const fc=EL[fb.type]?.cat,tc=EL[tb.type]?.cat;
    const st=s.steps[i];

    const isFromAuth=(fb.type==='auth');
    const isToAuthDB=isFromAuth&&(tc==='db'||tc==='cache');
    const isDbToSvc=(fc==='db'||fc==='cache')&&(tc==='svc'||tc==='bff'||tc==='gw'||tc==='auth');
    const isGwToAuth=fc==='gw'&&tb.type==='auth';
    const isToFinalSvc=finalSvcIdx>=0&&path[i+1]===path[finalSvcIdx]&&!isGwToAuth;
    const isFinalSvcToDb=finalSvcIdx>=0&&path[i]===path[finalSvcIdx]&&(tc==='db'||tc==='cache');
    const isFromActor=fc==='actor'||fc==='client';
    const isBroker=tc==='broker'||tc==='queue';
    // Login-сценарий: Auth ВСЕГДА нужна БД (даже при jwt_only) — для проверки пароля
    const isLoginScenario=/вход|логин|регистр|login|signin|auth/i.test(s.name||'');

    if(!st.name)st.name=bizVerb(fc,tc,false);

    if(isToAuthDB){
      // Auth Service → своя БД: зависит от auth.type ──────────
      const authType=fb.auth?.type||fb.settings?.authType||'jwt_only';
      if(authType==='jwt_only'&&!isLoginScenario){
        // JWT stateless — Gateway проверяет подпись локально, DB не нужна
        st._hidden=true;
        st.verb='GET';
        st.name=tTask({ru:'JWT проверяется локально (stateless — БД не нужна)',en:'JWT is verified locally (stateless — no DB needed)'});
        st.uri=st.uri||'JWT signature validation (internal)';
        st.resp='';
      }else if(authType==='jwt_only'&&isLoginScenario){
        // Login/register: Auth ВСЕГДА читает БД — проверяет пароль/создаёт запись
        delete st._hidden;
        st.verb='POST';
        if(!st.name||st.name===bizVerb(fc,tc,false))st.name=tTask({ru:'Проверяет учётные данные / создаёт пользователя',en:'Verifies credentials / creates user'});
        if(!st.uri)st.uri='SELECT * FROM users WHERE email = $1  -- bcrypt verify';
        if(!st.resp)st.resp=tTask({ru:'Отдаёт данные пользователя',en:'Returns user data'});
      }else if(authType==='session_based'){
        delete st._hidden;
        st.verb='GET';
        if(!st.name||st.name===bizVerb(fc,tc,false))st.name=tTask({ru:'Читает сессию из хранилища',en:'Reads session from storage'});
        if(!st.uri)st.uri='SELECT * FROM sessions WHERE token = $1';
        if(!st.resp)st.resp=tTask({ru:'Отдаёт данные сессии',en:'Returns session data'});
      }else{ // oauth2_jwt
        delete st._hidden;
        st.verb='GET';
        if(!st.name||st.name===bizVerb(fc,tc,false))st.name=tTask({ru:'Проверяет OAuth-токен',en:'Verifies OAuth token'});
        if(!st.uri)st.uri='SELECT * FROM oauth_tokens WHERE access_token_hash = $1';
        if(!st.resp)st.resp=tTask({ru:'Отдаёт данные токена',en:'Returns token data'});
      }

    }else if(isDbToSvc){
      // БД → Сервис: архитектурный разрыв, скрываем
      st._hidden=true;
      st.verb='GET';
      st.name=tTask({ru:'(Auth завершил проверку — не показывается в UML)',en:'(Auth finished the check — not shown in UML)'});
      st.uri='';
      st.resp='';

    }else if(isFinalSvcToDb){
      // Финальный сервис → его БД: SQL по REST-глаголу ─────────
      delete st._hidden;
      st.verb=finalVerb;
      if(!st.name||st.name===bizVerb(fc,tc,false)){
        st.name=finalVerb==='GET'?tTask({ru:`Читает ${resource}`,en:`Reads ${resource}`}):
                finalVerb==='POST'?tTask({ru:`Сохраняет ${resource}`,en:`Saves ${resource}`}):
                (finalVerb==='PATCH'||finalVerb==='PUT')?tTask({ru:`Обновляет ${resource}`,en:`Updates ${resource}`}):
                tTask({ru:`Удаляет ${resource}`,en:`Deletes ${resource}`});
      }
      if(!st.uri)st.uri=buildSQL(resource,finalVerb);
      if(!st.resp)st.resp=finalVerb==='GET'?tTask({ru:'Отдаёт данные',en:'Returns data'}):tTask({ru:'Подтверждает операцию',en:'Confirms operation'});

    }else if(isToFinalSvc&&fc!=='db'&&fc!=='cache'){
      // Вызов финального сервиса от реального caller'а ─────────
      delete st._hidden;
      st.verb=finalVerb;
      if(!st.uri)st.uri=buildRestUri(resource,finalVerb); // POST=/resources, GET/PATCH/DELETE=/resources/{id}
      if(!st.name||st.name===bizVerb(fc,tc,false)){
        st.name=finalVerb==='GET'?tTask({ru:'Запрашивает данные',en:'Requests data'}):
                finalVerb==='POST'?tTask({ru:'Создаёт запись',en:'Creates record'}):
                (finalVerb==='PATCH'||finalVerb==='PUT')?tTask({ru:'Обновляет запись',en:'Updates record'}):
                tTask({ru:'Удаляет запись',en:'Deletes record'});
      }
      if(!st.resp)st.resp=autoResp(fc,tc,finalVerb);

    }else if(isGwToAuth){
      // Gateway → Auth Service ──────────────────────────────────
      // Если режим JWT в GW — Auth Service не вызывается на обычные запросы
      const gwAuthMode=fb.settings?.auth_mode||'JWT (встроенный)';
      delete st._hidden;
      st.verb='GET';
      if(gwAuthMode.includes('JWT')){
        if(!st.name||st.name===bizVerb(fc,tc,false))st.name=tTask({ru:'Маршрутизирует к Auth (login/register)',en:'Routes to Auth (login/register)'});
        if(!st.uri)st.uri='/api/v1/auth/*';
        if(!st.resp)st.resp=tTask({ru:'200 OK · токен выдан',en:'200 OK · token issued'});
      }else{
        // Session / OAuth2 — Gateway вызывает Auth на каждый запрос
        if(!st.name||st.name===bizVerb(fc,tc,false))st.name=tTask({ru:'Проверяет токен (introspection)',en:'Verifies token (introspection)'});
        if(!st.uri)st.uri='/api/v1/auth/validate';
        if(!st.resp)st.resp=tTask({ru:'200 OK · токен валиден',en:'200 OK · token valid'});
      }

    }else if(isFromActor){
      // Актор инициирует — несёт финальный verb ────────────────
      delete st._hidden;
      st.verb=finalVerb;
      if(!st.uri)st.uri=buildRestUri(resource,finalVerb);
      if(!st.resp)st.resp=autoResp(fc,tc,finalVerb);

    }else if(isBroker){
      // Публикация события: past-tense по CloudEvents ──────────
      delete st._hidden;
      if(!st.uri)st.uri=`publish: ${buildEvent(resource,finalVerb)}`;
      st.resp=st.resp||'';

    }else{
      // Промежуточный hop svc→svc / gw→svc: всегда GET ─────────
      delete st._hidden;
      st.verb='GET';
      if(!st.uri){
        const targetRes=resourceName(tb.customLabel||EL[tb.type]?.lbl||'service');
        st.uri=`/api/v1/${targetRes}/{id}`;  // промежуточные — всегда читают по id
      }
      if(!st.resp)st.resp=autoResp(fc,tc,'GET');
    }
  }

  renderScenSteps();pushHist();
  toast(tTask({ru:`✨ Авто: промежуточные GET · конечный ${finalVerb} · Auth — по типу (jwt/session/oauth2)`,en:`✨ Auto: intermediate GET · final ${finalVerb} · Auth — by type (jwt/session/oauth2)`}));
}

// ── ШАГ-ПОПАП при рисовании маршрута ────────────────────────────
function getBlockVerbs(b){
  const t=b.type;
  if(['postgresql','mysql'].includes(t))return{verbs:['SELECT','INSERT','UPDATE','DELETE'],hint:'table WHERE id=$1'};
  if(t==='mongodb')return{verbs:['find','insertOne','updateOne','deleteOne'],hint:'collection'};
  if(t==='redis')return{verbs:['GET','SET','DEL','HGET','HSET','EXPIRE'],hint:'key'};
  if(['kafka','rabbitmq','nats','queue'].includes(t))return{verbs:['producer.send','consumer.poll','commitOffset','publish','subscribe'],hint:'topic/queue'};
  if(t==='external')return{verbs:['POST','GET','webhook'],hint:'/callback'};
  if(t==='elasticsearch')return{verbs:['search','index','delete'],hint:'index/_search'};
  if(t==='s3')return{verbs:['PUT','GET','DELETE'],hint:'bucket/key'};
  // service/auth/bff/api_gw — берём из settings.methods или routes
  const ms=(b.settings&&(b.settings.methods||b.settings.routes))||[];
  const verbs=ms.length?[...new Set(ms.map(m=>m.method).filter(Boolean))]:['GET','POST','PUT','PATCH','DELETE'];
  const first=ms[0]?{verb:ms[0].method,uri:ms[0].path}:null;
  return{verbs,hint:'/api/v1/path',first};
}
function showStepPopup(b){
  removeStepPopup();
  if(!b||!ROUTE_DRAFT)return;
  // Для акторов и клиентов — пустой шаг без попапа
  if(['actor','web_client','mob_client'].includes(b.type)){
    (ROUTE_DRAFT.steps=ROUTE_DRAFT.steps||[]).push({name:'',verb:'',uri:'',resp:'',cache:null,dbTarget:null});
    return;
  }
  const info=getBlockVerbs(b);
  // Smart verb: переносим с предыдущего шага + CRUD-маппинг для БД
  const _steps=ROUTE_DRAFT.steps||[];
  const _prev=_steps.length?_steps[_steps.length-1]:null;
  const _prevVerb=_prev?_prev.verb:'';
  const _isDb=['postgresql','mysql','mongodb','redis','elasticsearch','cassandra','clickhouse','s3'].includes(b.type);
  const _CRUD={'GET':'SELECT','POST':'INSERT','PUT':'UPDATE','PATCH':'UPDATE','DELETE':'DELETE'};
  let _smart=info.first?info.first.verb:'';
  if(_isDb&&_prevVerb&&_CRUD[_prevVerb])_smart=_CRUD[_prevVerb];
  else if(!_isDb&&_prevVerb&&info.verbs.includes(_prevVerb))_smart=_prevVerb;
  const opts=info.verbs.map(v=>`<option${v===_smart?' selected':''}>${escHtml(v)}</option>`).join('');
  const isLast=ROUTE_DRAFT.path.length>2;
  const popup=document.createElement('div');
  popup.id='step-popup';
  popup.style.cssText='position:fixed;z-index:9999;background:var(--bg1);border:2px solid var(--border);border-radius:8px;padding:12px;width:250px;box-shadow:4px 4px 0 #0004;font-family:Tahoma,sans-serif';
  popup.innerHTML=`
    <div style="font-size:10.5px;color:var(--blue);font-weight:700;margin-bottom:8px">📍 ${escHtml(b.customLabel||b.type)}</div>
    <input id="sp-name" placeholder="${t('step_popup_what')}" style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--brd2);border-radius:5px;background:var(--bg3);color:var(--txt);font-size:11px;margin-bottom:6px">
    <div style="display:flex;gap:5px;margin-bottom:6px">
      <select id="sp-verb" style="width:100px;padding:5px;border:1px solid var(--brd2);border-radius:5px;background:var(--bg3);color:var(--txt);font-size:11px">${opts}</select>
      <input id="sp-uri" placeholder="${escHtml(info.hint)}" style="flex:1;padding:5px 7px;border:1px solid var(--brd2);border-radius:5px;background:var(--bg3);color:var(--txt);font-size:11px">
    </div>
    <input id="sp-resp" placeholder="${t('step_popup_resp')}" style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--brd2);border-radius:5px;background:var(--bg3);color:var(--txt);font-size:11px;margin-bottom:8px">
    <div style="display:flex;gap:6px">
      <button onclick="submitStepPopup(${isLast?'false':'false'})" style="flex:1;padding:6px;background:var(--blue);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600">${t('step_popup_add')}</button>
      ${isLast?`<button onclick="submitStepPopup(true)" style="padding:6px 8px;background:#2a6010;color:#9ece6a;border:1px solid #9ece6a55;border-radius:5px;cursor:pointer;font-size:11px">${t('step_popup_finish')}</button>`:''}
      <button onclick="skipStepPopup()" style="padding:6px 8px;background:transparent;border:1px solid var(--brd2);color:var(--txt2);border-radius:5px;cursor:pointer;font-size:11px">${t('step_popup_skip')}</button>
    </div>`;
  document.body.appendChild(popup);
  // Автозаполнение URI из settings (verb уже выставлен через _smart)
  if(info.first){
    const ue=document.getElementById('sp-uri');
    if(ue&&info.first.uri)ue.value=info.first.uri;
  }
  // Позиция рядом с блоком (учитывает пан и зум холста)
  try{
    const r=svgRct();const z=S.zoom||1;
    const sx=r.left+(b.x+130)*z+S.panX,sy=r.top+b.y*z+S.panY;
    popup.style.left=Math.min(sx+8,window.innerWidth-265)+'px';
    popup.style.top=Math.max(8,Math.min(sy,window.innerHeight-230))+'px';
  }catch(e){popup.style.left='60%';popup.style.top='30%';}
  popup.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();submitStepPopup();}
    if(e.key==='Escape'){e.preventDefault();skipStepPopup();}
  });
  setTimeout(()=>{const n=document.getElementById('sp-name');if(n)n.focus();},40);
}
function submitStepPopup(finish){
  if(!ROUTE_DRAFT){removeStepPopup();return;}
  const name=(document.getElementById('sp-name')||{}).value||'';
  const verb=(document.getElementById('sp-verb')||{}).value||'';
  const uri=(document.getElementById('sp-uri')||{}).value||'';
  const resp=(document.getElementById('sp-resp')||{}).value||'';
  (ROUTE_DRAFT.steps=ROUTE_DRAFT.steps||[]).push({name,verb,uri,resp,cache:null,dbTarget:null});
  syncStepToConn(name,verb,uri,resp);
  removeStepPopup();
  if(finish)finishRouteDraw();
}
// Один шаг из попапа сценария = один источник и для sequence, и для метода связи на схеме.
// Пишем verb/uri/name/resp сразу в c.method той связи, что соответствует последнему хопу пути.
function syncStepToConn(name,verb,uri,resp){
  if(!ROUTE_DRAFT||!ROUTE_DRAFT.path||ROUTE_DRAFT.path.length<2)return;
  const path=ROUTE_DRAFT.path,a=path[path.length-2],bId=path[path.length-1];
  const c=(S.conns||[]).find(x=>(x.from===a&&x.to===bId)||(x.from===bId&&x.to===a));
  if(!c)return;
  const t=gb(c.to);if(!t||typeof methodHost!=='function'||!methodHost(t.type))return;
  if(!c.method)c.method={verb:'GET',uri:'',name:'',resp:''};
  if(verb)c.method.verb=verb;
  if(uri)c.method.uri=uri;
  if(name)c.method.name=name;
  if(resp)c.method.resp=resp;
  if(typeof renderConns==='function')renderConns();
}
function skipStepPopup(){
  if(!ROUTE_DRAFT){removeStepPopup();return;}
  (ROUTE_DRAFT.steps=ROUTE_DRAFT.steps||[]).push({name:'',verb:'',uri:'',resp:'',cache:null,dbTarget:null});
  removeStepPopup();
}
function removeStepPopup(){const p=document.getElementById('step-popup');if(p)p.remove();}

function setScenColor(id,v){const s=S.scenarios.find(x=>x.id===id);if(s){s.color=v;pushHist();render();}}
function setScenName(id,v){const s=S.scenarios.find(x=>x.id===id);if(s){s.name=v;pushHist();}}
function setScenVol(id,v){const s=S.scenarios.find(x=>x.id===id);if(s){s.volume=Math.max(0,+v||0);pushHist();}}
function toggleScen(id){const s=S.scenarios.find(x=>x.id===id);if(s){s.visible=!s.visible;render();renderRoutesPanel();}}
function delScen(id){S.scenarios=(S.scenarios||[]).filter(x=>x.id!==id);pushHist();render();renderRoutesPanel();}

// ── ЗАПУСК СЦЕНАРИЯ (анимация одного запроса по маршруту) ────
let SCEN={balls:[],raf:null,last:0};
function addScenBall(s){
  if(s.path.length<2)return;
  const nodes=s.path.concat(s.path.slice(0,-1).reverse()); // туда и обратно
  const turn=s.path.length-1;
  const segs=nodes.slice(0,-1).map((id,i)=>{const sp=getSegPts(nodes[i],nodes[i+1]);return sp?sp.pts:null;});
  const el=document.createElementNS(NS,'circle');el.setAttribute('r','7');el.style.fill=s.color;el.style.filter=`drop-shadow(0 0 6px ${s.color})`;el.style.opacity='0';
  $('anim-layer').appendChild(el);
  SCEN.balls.push({color:s.color,segs,turn,seg:0,t:0,el,kind:'req'});
}
function runScen(id){const s=(S.scenarios||[]).find(x=>x.id===id);if(s)addScenBall(s);startScenLoop();}
function runAllScen(){(S.scenarios||[]).forEach(s=>{if(s.visible)addScenBall(s);});startScenLoop();}
function startScenLoop(){if(!SCEN.raf){SCEN.last=0;SCEN.raf=requestAnimationFrame(scenLoop);}}
function scenLoop(now){
  const sp=(typeof SPEED_MUL!=='undefined'?SPEED_MUL:1);
  SCEN.balls=SCEN.balls.filter(b=>{
    const seg=b.segs[b.seg];
    if(!seg){b.seg++;b.t=0;if(b.seg>=b.segs.length){b.el.remove();return false;}return true;}
    b.t+=0.02*sp;
    if(b.t>=1){
      b.seg++;b.t=0;
      if(b.seg>=b.segs.length){b.el.remove();return false;}
      if(b.seg>=b.turn&&b.kind==='req'){ // разворот: запрос → ответ (треугольник)
        b.kind='resp';b.el.remove();
        const tri=document.createElementNS(NS,'polygon');tri.setAttribute('points','0,-6 11,0 0,6');
        tri.style.fill=b.color;tri.style.filter=`drop-shadow(0 0 6px ${b.color})`;
        $('anim-layer').appendChild(tri);b.el=tri;
      }
      return true;
    }
    const idx=Math.min(Math.floor(b.t*(seg.length-1)),seg.length-2);const fr=b.t*(seg.length-1)-idx;
    const p1=seg[idx],p2=seg[idx+1];const px=(p1.x+(p2.x-p1.x)*fr),py=(p1.y+(p2.y-p1.y)*fr); // pan/zoom в transform слоя
    if(b.kind==='resp'){const ang=(Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI).toFixed(0);b.el.setAttribute('transform',`translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${ang})`);}
    else{b.el.setAttribute('cx',px.toFixed(1));b.el.setAttribute('cy',py.toFixed(1));}
    b.el.style.opacity='1';
    return true;
  });
  if(SCEN.balls.length)SCEN.raf=requestAnimationFrame(scenLoop);else SCEN.raf=null;
}
