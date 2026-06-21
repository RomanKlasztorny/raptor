// UI — палитра с шаблонами, сайдбар (анализ/проблемы)
// (выделено из app.js при разбиении на модули)

// ═══════════════════════════════════════════════════════════════
// ПАЛИТРА + ШАБЛОНЫ + ПРИМЕРЫ
// ═══════════════════════════════════════════════════════════════
function buildPalette(){
  const P=$('palette');P.innerHTML='';
  CATS.forEach(cat=>{
    const h=document.createElement('div');h.className='pal-cat';h.textContent=cat.lbl;P.appendChild(h);
    cat.els.forEach(type=>{const d=EL[type];const it=document.createElement('div');it.className='pal-item'+(S.palSel===type?' on':'');
      it.innerHTML=`<span class="pal-dot" style="background:${d.clr}"></span>${d.lbl}`;
      it.title=`${d.role}\n\n📍 ГДЕ: ${d.place}\n🚫 НЕЛЬЗЯ: ${d.never}\n💡 ${d.tip}`;
      it.onclick=()=>{S.palSel=S.palSel===type?null:type;buildPalette();};P.appendChild(it);});
  });
  // шаблоны переехали в меню «Шаблоны» наверху (buildTemplatesMenu)
}
function placeTemplate(key){
  const tpl=TMPLS[key];const r=svgRct();
  const ox=Math.max(20,Math.round(r.width/2-S.panX-220)),oy=Math.max(40,Math.round(r.height/3-S.panY));
  const ids=tpl.bls.map(bl=>{const id='b'+(S.nid++);
    const blk={id,type:bl.t,x:ox+bl.dx,y:oy+bl.dy,patterns:bl.pat?bl.pat.slice():[],settings:bl.set?{...bl.set}:{}};
    if(bl.cl)blk.customLabel=bl.cl;
    if(bl.auth){blk.auth={...bl.auth};blk.settings.authType=bl.auth.type;} // Auth Provider с типом из шаблона
    // готовая схема БД из шаблона (наполненная таблицами/примерами)
    if(bl.db&&typeof DB_TEMPLATES!=='undefined'){
      const dt=DB_TEMPLATES.find(x=>x.id===bl.db);
      if(dt)blk.dbSchema=JSON.parse(JSON.stringify(dt.schema));
    }
    S.blocks.push(blk);return id;});
  // связи: [from,to] или [from,to,[verb,uri,name,resp]] — метод живёт на самой связи
  tpl.cs.forEach(cc=>{const a=cc[0],b=cc[1],mth=cc[2];const conn={id:'c'+(S.nid++),from:ids[a],to:ids[b]};
    if(mth)conn.method={verb:mth[0],uri:mth[1],name:mth[2],resp:mth[3]||''};
    S.conns.push(conn);});
  pushHist();analyze();toast('📦 '+tpl.lbl);
}
// Меню «Шаблоны» = примеры (готовые системы) + заготовки (Сервисы/Группы) в одном месте
function buildTemplatesMenu(){
  const m=$('m-tmpl');if(!m)return;
  let h='<div class="menu-sec">🗂 Примеры — готовые системы</div>';
  EXAMPLES.forEach((ex,i)=>{h+=`<div class="menu-item" onclick="menuDo(function(){loadExampleByIndex(${i})})">🗂 ${ex.name}</div>`;});
  const groups={};
  Object.entries(TMPLS).forEach(([k,t])=>{(groups[t.g||'Шаблоны']=groups[t.g||'Шаблоны']||[]).push([k,t]);});
  Object.entries(groups).forEach(([gname,items])=>{
    h+=`<div class="menu-sep"></div><div class="menu-sec">📦 ${gname}</div>`;
    items.forEach(([key,tpl])=>{h+=`<div class="menu-item" onclick="menuDo(function(){placeTemplate('${key}')})" title="${tpl.bls.length} узлов, ${tpl.cs.length} связей">📦 ${tpl.lbl}</div>`;});
  });
  m.innerHTML=h;
}
// совместимость со старым именем (вызов из bootstrap)
function buildExamples(){buildTemplatesMenu();}
function loadExampleByIndex(i){
  const ex=EXAMPLES[i];if(!ex)return;
  S.blocks=ex.blocks.map(b=>({...JSON.parse(JSON.stringify(b)),patterns:b.patterns||[],settings:b.settings||{}}));
  S.conns=ex.conns.map(c=>({...c}));S.scenarios=[];S.nid=2000;S.selected=null;S.panX=0;S.panY=0;HIST=[];HI=-1;
  pushHist();analyze();if(typeof renderRoutesPanel==='function')renderRoutesPanel();toast('📋 '+ex.name);
}
// совместимость со старым вызовом
function loadExample(){loadExampleByIndex(0);}

// ── PS-style меню (выпадашки по темам) ──
function toggleMenu(e,id){
  if(e&&e.stopPropagation)e.stopPropagation();
  const pop=$(id);if(!pop)return;
  const wasOpen=pop.classList.contains('open');
  document.querySelectorAll('.menu-pop.open').forEach(p=>p.classList.remove('open'));
  if(!wasOpen){
    // позиционируем под кнопкой (position:fixed — не зависим от overflow родителя)
    const menu=pop.closest('.menu');
    const btn=menu&&menu.querySelector('.menu-btn');
    if(btn){const r=btn.getBoundingClientRect();pop.style.left=r.left+'px';pop.style.top=(r.bottom+3)+'px';}
    pop.classList.add('open');
  }
}
function menuClose(){document.querySelectorAll('.menu-pop.open').forEach(p=>p.classList.remove('open'));}
function menuDo(fn){try{fn();}finally{menuClose();}}
document.addEventListener('click',e=>{if(!e.target.closest('.menu'))menuClose();});

// ── РЕЖИМЫ РАБОТЫ (взаимоисключающие): Конструктор / Обучение / DevOps ──
function _markMode(m){S.uiMode=m;document.querySelectorAll('.modebtn2').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));}
function activateBuildMode(){_markMode('build');}
function setMode(m){
  // 1) выходим из текущих режимов
  if(m!=='learn'&&typeof closeTrainer==='function')closeTrainer();
  if(m!=='devops'&&typeof CHAOS!=='undefined'&&CHAOS.active&&typeof stopChaos==='function')stopChaos(true);
  // 2) подсвечиваем выбранный
  _markMode(m);
  // 3) входим
  if(m==='learn'&&typeof openTrainer==='function')openTrainer();
  if(m==='devops'&&typeof startChaos==='function'&&!(typeof CHAOS!=='undefined'&&CHAOS.active))startChaos();
}

// ═══════════════════════════════════════════════════════════════
// САЙДБАР — описание блока + анализ
// ═══════════════════════════════════════════════════════════════
let sideTab='analysis';
function switchTab(t){sideTab=t;document.querySelectorAll('.side-tab').forEach(x=>x.classList.toggle('on',x.dataset.tab===t));$('side-analysis').style.display=t==='analysis'?'':'none';$('side-logs').style.display=t==='logs'?'':'none';$('side-routes').style.display=t==='routes'?'':'none';$('side-saves').style.display=t==='saves'?'':'none';if(t==='saves')renderSaves();if(t==='logs')renderLogs();if(t==='routes'&&typeof renderRoutesPanel==='function')renderRoutesPanel();}
function updateSidebar(){
  const c=$('side-analysis');const sel=gb(S.selected);
  if(sel){
    const d=EL[sel.type];const rt=sel.rt||{};
    let h=`<div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:3px">${sel.customLabel||d.lbl}</div>`;
    h+=`<div style="font-size:11px;color:var(--txt2);margin-bottom:8px;line-height:1.4">${d.role}</div>`;
    // живые метрики
    if(rt.cap&&isFinite(rt.cap)){
      const pct=Math.round(rt.rho*100);const clr=hClr(rt.health)||'#9ece6a';
      h+=`<div class="metric-box"><div class="metric"><span>Ёмкость</span><b>${fmt(rt.cap)} rps</b></div><div class="metric"><span>Нагрузка λ</span><b>${fmt(rt.lambdaIn)} rps</b></div><div class="metric"><span>Загрузка</span><b style="color:${clr}">${pct}%</b></div><div class="metric"><span>Задержка</span><b style="color:${clr}">${rt.effLat?.toFixed(1)} мс</b></div></div>`;
      if(rt.cbOpen)h+=`<div class="card info">⚡ Circuit Breaker РАЗОМКНУТ — быстрый отказ вместо ожидания упавшей зависимости.</div>`;
      if(rt.cascade)h+=`<div class="card warn">🔗 КАСКАД: блок сам здоров, но тормозит из-за медленной зависимости (${gb(rt.slowDueTo)?.customLabel||EL[gb(rt.slowDueTo)?.type]?.lbl||'?'}). Реши: ускорь зависимость или добавь Circuit Breaker.</div>`;
      if(rt.health==='error')h+=`<div class="card error">💀 Перегружен. Реши: ${fixHint(sel)}</div>`;
      else if(rt.health==='warn'&&!rt.cascade)h+=`<div class="card warn">⚠ Под давлением (${pct}%). Запас мал — добавь ёмкость пока не поздно.</div>`;
      else if(rt.health==='ok')h+=`<div class="card ok">✓ Здоров, запас есть</div>`;
    }
    h+=`<div class="info-box">📍 <b>Где ставить:</b> ${d.place}</div>`;
    h+=`<div class="info-box" style="border-color:#f7768e44">🚫 <b>Нельзя:</b> ${d.never}</div>`;
    h+=`<div class="card info">💡 ${d.tip}</div>`;
    if(SETTINGS_DEF[sel.type]){
      const isBroker=['kafka','rabbitmq','nats','queue'].includes(sel.type);
      if(isBroker) h+=`<button onclick="openBrokerInspector('${sel.id}')" style="margin-top:8px;width:100%;padding:7px;border-radius:6px;border:1px solid #bb9af777;background:#bb9af722;color:#bb9af7;cursor:pointer;font-size:11.5px">📊 Инспектор${Object.keys(sel.settings||{}).length?' (активен)':''}</button>`;
      else h+=`<button onclick="openSettings('${sel.id}')" style="margin-top:8px;width:100%;padding:7px;border-radius:6px;border:1px solid #7aa2f777;background:#7aa2f722;color:#7aa2f7;cursor:pointer;font-size:11.5px">⚙ Настройки${(sel.patterns?.length||Object.keys(sel.settings||{}).length)?' (активны)':''}</button>`;
    }
    // Auth Provider — выбор типа (меняет схему БД и поведение в симуляции)
    if(sel.type==='auth'){
      const at=(typeof authType==='function')?authType(sel):'jwt_only';
      const rate=Math.round(((typeof authPassRate==='function')?authPassRate(sel):0.1)*100);
      const behav={jwt_only:'Stateless: токен по подписи, БД только на login/refresh.',oauth2_jwt:'Токены + интроспекция/refresh.',session_based:'Stateful: КАЖДЫЙ запрос читает сессию из хранилища.'}[at];
      h+=`<div style="margin-top:10px;background:#bb9af714;border-radius:7px;padding:9px">
        <div style="font-size:10px;color:var(--txt);font-weight:700;margin-bottom:5px">🔐 Тип авторизации</div>
        <select onchange="setAuthType('${sel.id}',this.value)" style="width:100%;background:var(--bg3);color:var(--txt);border:1px solid var(--brd2);border-radius:6px;padding:6px;font-size:11.5px;margin-bottom:6px">
          ${[['jwt_only','JWT-only'],['oauth2_jwt','OAuth2 + JWT'],['session_based','Session-based']].map(o=>`<option value="${o[0]}" ${at===o[0]?'selected':''}>${o[1]}</option>`).join('')}
        </select>
        <div style="font-size:10.5px;color:var(--txt2);line-height:1.5">${behav}</div>
        <div style="font-size:10.5px;color:#e0af68;margin-top:5px">Нагрузка на хранилище: <b>${rate}%</b> от трафика${at==='session_based'?' — нужен Redis при росте':''}</div>
      </div>`;
    }
    // Редактор схемы — только для PostgreSQL (реляционная модель)
    if(sel.type==='postgresql'){
      const tblCnt=(typeof schemaTables==='function')?schemaTables(sel).length:0;
      h+=`<button onclick="openDBEditor('${sel.id}')" style="margin-top:6px;width:100%;padding:7px;border-radius:6px;border:1px solid #4a90d977;background:#4a90d922;color:#4a90d9;cursor:pointer;font-size:11.5px">🗄 Редактировать схему${tblCnt?` (${tblCnt} табл.)`:''}</button>`;
      h+=`<button onclick="openDBSchemaPicker('${sel.id}')" style="margin-top:6px;width:100%;padding:7px;border-radius:6px;border:1px solid #4a4c6a;background:transparent;color:#787c99;cursor:pointer;font-size:11px">📚 Загрузить готовую схему</button>`;
    }
    c.innerHTML=h;return;
  }
  // общий список проблем
  const issues=[];
  S.blocks.forEach(b=>{const rt=b.rt||{};if(rt.health==='error')issues.push({s:'error',n:b.customLabel||EL[b.type].lbl,m:'Перегружен '+Math.round(rt.rho*100)+'% — '+fixHint(b)});else if(rt.cascade)issues.push({s:'warn',n:b.customLabel||EL[b.type].lbl,m:'Каскад: тормозит из-за зависимости'});else if(rt.health==='warn')issues.push({s:'warn',n:b.customLabel||EL[b.type].lbl,m:'Под давлением '+Math.round(rt.rho*100)+'%'});});
  Object.entries(S.connWarn||{}).forEach(([cid,w])=>{const c2=gc(cid);if(c2){const f=gb(c2.from);issues.push({s:w.sev,n:(f?.customLabel||EL[f?.type]?.lbl)+'→',m:w.msg});}});
  // структурная проверка брокеров: у брокера/очереди должны быть И продюсер, И консьюмер
  S.blocks.forEach(b=>{const cat=EL[b.type]?.cat;if(cat==='broker'||cat==='queue'){
    const nm=b.customLabel||EL[b.type].lbl;
    const hasProd=S.conns.some(c=>c.to===b.id);
    const consumers=S.conns.filter(c=>c.from===b.id).map(c=>EL[gb(c.to)?.type]?.cat);
    const hasCons=consumers.some(cc=>cc==='svc'||cc==='bff');
    if(!hasProd)issues.push({s:'warn',n:nm,m:'Брокер без продюсера — некому публиковать события. Подключи сервис-источник → '+nm});
    if(!S.conns.some(c=>c.from===b.id))issues.push({s:'error',n:nm,m:'Брокер ни с кем не связан на выход — события уходят в никуда. Подключи '+nm+' → сервис-консьюмер'});
    else if(!hasCons)issues.push({s:'warn',n:nm,m:'У брокера нет сервиса-консьюмера — событие читать некому. Добавь '+nm+' → сервис'});
  }});
  const okCard=S.loadMode==='realism'
    ?(scenTotalRps()===0
        ?'<div class="card warn">⚠ Режим «Реализм»: нагрузки нет. Нарисуй маршруты во вкладке «Методы» и задай им объём (rps) — тогда узлы получат нагрузку. Либо переключись в «Песочницу».</div>'
        :`<div class="card ok">✓ Держит трафик из сценариев · Σ ${fmt(scenTotalRps())} rps</div>`)
    :`<div class="card ok">✓ Всё здорово при ${fmt(S.load)} rps</div>`;
  c.innerHTML=!S.blocks.length?'<div style="color:var(--txt2);font-size:11px;line-height:1.7">Перетащи блок из палитры на холст.<br><br>Кликни на блок — увидишь что это, где ставить, живую нагрузку.<br><br>Кликни на стрелку — увидишь что по ней идёт.</div>':!issues.length?okCard:issues.map(i=>`<div class="card ${i.s}"><b>${i.n}</b><br>${i.m}</div>`).join('');
}
function fixHint(b){
  const t=b.type;
  if(t==='postgresql'||t==='mysql')return 'включи PgBouncer (×5) + Read Replicas, или поставь Redis-кэш перед БД';
  if(['service','bff'].includes(t))return 'увеличь реплики в настройках, поставь LB';
  if(t==='api_gw')return 'увеличь инстансы Gateway';
  if(t==='redis')return 'включи Redis Cluster (×10)';
  if(t==='kafka')return 'добавь партиций';
  if(t==='rabbitmq')return 'при таком потоке переходи на Kafka';
  if(t==='cassandra')return 'добавь нод в кластер';
  return 'добавь ёмкости в настройках';
}
function scenTotalRps(){return (S.scenarios||[]).reduce((a,s)=>a+(s.volume||0),0);}
function updateStatus(){
  $('sb-l').textContent=`${S.blocks.length} блоков · ${S.conns.length} связей`+((S.scenarios&&S.scenarios.length)?` · ${S.scenarios.length} сценариев`:'');
  const loadTxt=S.loadMode==='realism'?('Σ '+fmt(scenTotalRps())+' rps (реализм)'):(fmt(S.load)+' rps');
  $('sb-r').textContent=loadTxt+(SIM.running?(SIM.paused?' ⏸':' ▶ '+Object.keys(SIM.dots).length+' шар.'):'');
}
function setLoad(l){S.load=l;const inp=$('load-input');if(inp&&document.activeElement!==inp)inp.value=fmt(l);analyze();}
function setLoadMode(m){
  S.loadMode=m;
  document.querySelectorAll('.modebtn').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  const li=$('load-input');if(li){li.disabled=(m==='realism');li.style.opacity=(m==='realism')?'0.4':'1';}
  if(m==='realism'&&!(S.scenarios&&S.scenarios.length))toast('Реализм: нагрузка из объёмов сценариев. Нарисуй маршруты во вкладке «Методы».',3500);
  analyze();
}
// разбор ввода: "1.5M","200k","50 000","2кк" → число
function parseLoad(str){
  if(typeof str==='number')return str;
  let s=String(str).trim().toLowerCase().replace(/[\s_]/g,'').replace(',','.').replace('×','').replace('x','');
  let mult=1;
  const m=s.match(/(к|k|тыс)+$/)?1e3:0;
  if(/(млрд|b|g)$/.test(s)){mult=1e9;s=s.replace(/(млрд|b|g)$/,'');}
  else if(/(млн|m|кк|кк)$/.test(s)){mult=1e6;s=s.replace(/(млн|m|кк)$/,'');}
  else if(/(к|k|тыс)$/.test(s)){mult=1e3;s=s.replace(/(к|k|тыс)$/,'');}
  const n=parseFloat(s);
  if(!isFinite(n)||n<0)return null;
  return Math.round(n*mult);
}
function applyLoadInput(){
  const inp=$('load-input');if(!inp)return;
  const n=parseLoad(inp.value);
  if(n===null||n<1){inp.value=fmt(S.load);toast('Введи число, напр. 50000 или 1.5M');return;}
  const v=Math.min(n,1e12);
  setLoad(v);inp.value=fmt(v);
}
function bumpLoad(dir){const v=dir>0?S.load*10:Math.max(1,Math.round(S.load/10));setLoad(v);$('load-input').value=fmt(v);}
function toggleEdgeStyle(){
  S.edgeStyle=(S.edgeStyle||'ortho')==='ortho'?'curved':'ortho';
  const b=$('edge-btn');if(b)b.textContent=S.edgeStyle==='ortho'?'⌐ 90°':'∿ кривые';
  render();
}
function clearAll(){if(S.blocks.length&&!confirm('Очистить?'))return;stopSim();S.blocks=[];S.conns=[];S.scenarios=[];S.selected=null;pushHist();analyze();if(typeof renderRoutesPanel==='function')renderRoutesPanel();}

// ═══════════════════════════════════════════════════════════════
// РЕДАКТОР МЕТАДАННЫХ СИСТЕМЫ («О системе» — титул, роли, требования)
// ═══════════════════════════════════════════════════════════════
function openMetaEditor(){
  ensureMeta();
  let ov=$('meta-modal');
  if(!ov){
    ov=document.createElement('div');ov.id='meta-modal';ov.className='modal-ov';
    ov.onclick=e=>{if(e.target===ov)closeMetaEditor();};
    document.body.appendChild(ov);
  }
  ov.style.display='flex';renderMetaEditor();
}
function closeMetaEditor(){const ov=$('meta-modal');if(ov)ov.style.display='none';pushHist();analyze();}
function renderMetaEditor(){
  const m=S.meta;const ov=$('meta-modal');if(!ov)return;
  const inp='background:#1a1b26;border:1px solid #3d3f52;border-radius:5px;padding:6px 8px;font-size:12px;color:#c0caf5;outline:none;font-family:inherit;width:100%';
  ov.innerHTML=`<div class="modal-box" style="max-width:640px;width:96%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h2 style="color:#7aa2f7">📋 О системе (титул документа)</h2>
      <button class="modal-btn" onclick="closeMetaEditor()">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:10px;color:#787c99">Название системы</label><input id="meta-name" style="${inp}" value="${escHtml(m.systemName||'')}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label style="font-size:10px;color:#787c99">Версия</label><input id="meta-ver" style="${inp}" value="${escHtml(m.version||'')}"></div>
        <div><label style="font-size:10px;color:#787c99">Автор</label><input id="meta-author" style="${inp}" value="${escHtml(m.author||'')}"></div>
      </div>
    </div>
    <div style="margin-bottom:10px"><label style="font-size:10px;color:#787c99">Общее описание</label>
      <textarea id="meta-desc" style="${inp};min-height:48px;resize:vertical">${escHtml(m.description||'')}</textarea></div>

    <div style="font-size:12px;font-weight:700;color:#9ece6a;margin:10px 0 6px">Категории пользователей</div>
    <div id="meta-roles">${(m.userRoles||[]).map((r,ri)=>`
      <div style="border:1px solid #3d3f52;border-radius:7px;padding:8px;margin-bottom:6px">
        <div style="display:flex;gap:6px;margin-bottom:5px">
          <input style="${inp}" value="${escHtml(r.name)}" onchange="S.meta.userRoles[${ri}].name=this.value">
          <button class="btn" onclick="S.meta.userRoles.splice(${ri},1);renderMetaEditor()" style="color:#f7768e">✕</button>
        </div>
        <textarea style="${inp};min-height:54px;resize:vertical" placeholder="Возможности (по одной на строку)" onchange="S.meta.userRoles[${ri}].can=this.value.split('\\n').map(s=>s.trim()).filter(Boolean)">${(r.can||[]).join('\n')}</textarea>
      </div>`).join('')}</div>
    <button class="btn" onclick="S.meta.userRoles.push({name:'Новая роль',can:[]});renderMetaEditor()" style="margin-bottom:12px">＋ Роль</button>

    <div style="font-size:12px;font-weight:700;color:#e0af68;margin:6px 0 6px">Доп. требования (кардинальность)</div>
    <div id="meta-reqs">${(m.requirements||[]).map((r,ri)=>`
      <div style="display:flex;gap:6px;margin-bottom:5px">
        <input style="${inp};flex:1" value="${escHtml(r.text)}" onchange="S.meta.requirements[${ri}].text=this.value">
        <input style="${inp};width:80px" value="${escHtml(r.card||'')}" placeholder="1:M" onchange="S.meta.requirements[${ri}].card=this.value">
        <button class="btn" onclick="S.meta.requirements.splice(${ri},1);renderMetaEditor()" style="color:#f7768e">✕</button>
      </div>`).join('')}</div>
    <button class="btn" onclick="S.meta.requirements.push({text:'',card:''});renderMetaEditor()">＋ Требование</button>

    <div style="margin-top:14px"><button class="modal-btn primary" onclick="saveMetaFields();closeMetaEditor()">Готово</button></div>
  </div>`;
}
function saveMetaFields(){
  const g=id=>$(id)?.value||'';
  S.meta.systemName=g('meta-name');S.meta.version=g('meta-ver');
  S.meta.author=g('meta-author');S.meta.description=g('meta-desc');
}

