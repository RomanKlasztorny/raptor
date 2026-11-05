// UI — палитра с шаблонами, сайдбар (анализ/проблемы)
// (выделено из app.js при разбиении на модули)

// Возвращает поле описания блока на текущем языке (role/place/never/tip)
function elDesc(type, field){
  if(typeof CURR_LANG!=='undefined' && CURR_LANG==='en' && typeof EL_EN!=='undefined' && EL_EN[type])
    return EL_EN[type][field] || (EL[type]&&EL[type][field]) || '';
  return (EL[type]&&EL[type][field]) || '';
}
// Возвращает название шаблона на текущем языке (tpl.lbl_en при CURR_LANG==='en')
function tplLabel(tpl){
  return (typeof CURR_LANG!=='undefined'&&CURR_LANG==='en'&&tpl.lbl_en)||tpl.lbl;
}
// Возвращает название темы/группы шаблонов на текущем языке (THEME_EN при CURR_LANG==='en')
function themeLabel(th){
  return (typeof CURR_LANG!=='undefined'&&CURR_LANG==='en'&&typeof THEME_EN!=='undefined'&&THEME_EN[th])||th;
}

// ═══════════════════════════════════════════════════════════════
// ПАЛИТРА + ШАБЛОНЫ + ПРИМЕРЫ
// ═══════════════════════════════════════════════════════════════
function buildPalette(){
  const P=$('palette');P.innerHTML='';

  // Choose between C4 and BPMN catalogs
  const cats = (typeof S !== 'undefined' && S.notationMode === 'bpmn' && typeof BPMN_CATS !== 'undefined') ? BPMN_CATS : CATS;
  const els = (typeof S !== 'undefined' && S.notationMode === 'bpmn' && typeof BPMN_EL !== 'undefined') ? BPMN_EL : EL;

  cats.forEach(cat=>{
    // Win95-иконки вместо эмодзи (см. icons95.js)
    const h=document.createElement('div');h.className='pal-cat';
    const _catIcon=(S.notationMode!=='bpmn'&&typeof icon95cat==='function')?icon95cat(cat.key):'';
    h.innerHTML=_catIcon+(typeof t==='function'?t(cat.key):cat.key);P.appendChild(h);
    cat.els.forEach(type=>{
      const d=els[type];
      if(!d) return;
      const it=document.createElement('div');

      if(S.notationMode==='bpmn'){
        it.className='pal-item'+(S.bpmnPalSel===type?' on':'');
        const icon=(typeof bpmnPaletteIcon==='function')?bpmnPaletteIcon(type):'';
        it.innerHTML=`${icon}${d.lbl}`;
        it.title=d.desc?`${d.lbl}\n\n${d.desc}`:`Click, then click the canvas to place a ${d.lbl}`;
        it.onclick=()=>{S.bpmnPalSel=S.bpmnPalSel===type?null:type;buildPalette();};
      }else{
        it.className='pal-item'+(S.palSel===type?' on':'');
        const _lbl=(typeof LOCALE!=='undefined'&&LOCALE[CURR_LANG]&&LOCALE[CURR_LANG]['el_'+type])||d.lbl;
        it.innerHTML=(typeof icon95==='function'?icon95(type):`<span class="pal-dot" style="background:${d.clr}"></span>`)+_lbl;
        it.title=`${elDesc(type,'role')}\n\n📍 ${elDesc(type,'place')}\n🚫 ${elDesc(type,'never')}\n💡 ${elDesc(type,'tip')}`;
        it.onclick=()=>{S.palSel=S.palSel===type?null:type;buildPalette();};
      }
      P.appendChild(it);
    });
  });
}
// Имя системы по умолчанию («Новый проект») заменяем названием шаблона/примера
function isDefaultSysName(n){n=(n||'').trim();return !n||n==='Новый проект'||n==='New project';}
function adoptSysName(name){
  if(!name)return;if(!S.meta)S.meta=typeof defaultMeta==='function'?defaultMeta():{};
  if(isDefaultSysName(S.meta.systemName))S.meta.systemName=String(name).replace(/^[^\p{L}\p{N}]+/u,'').trim()||name;
}
function placeTemplate(key){
  const tpl=TMPLS[key];const r=svgRct();const wasEmpty=!S.blocks.length;
  const ox=Math.max(20,Math.round(r.width/2-S.panX-220)),oy=Math.max(40,Math.round(r.height/3-S.panY));
  const ids=tpl.bls.map(bl=>{const id='b'+(S.nid++);
    const blk={id,type:bl.t,x:ox+bl.dx,y:oy+bl.dy,patterns:bl.pat?bl.pat.slice():[],settings:bl.set?{...bl.set}:{}};
    if(bl.cl)blk.customLabel=(typeof CURR_LANG!=='undefined'&&CURR_LANG==='en'&&bl.cl_en)||bl.cl;
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
  // сценарии («Линии»): tpl.scenarios — path/steps по индексам bls, переводим в реальные id блоков
  if(tpl.scenarios&&tpl.scenarios.length){
    if(!S.scenarios)S.scenarios=[];
    tpl.scenarios.forEach(sc=>{
      const path=sc.path.map(i=>ids[i]);
      S.scenarios.push({
        id:'sc'+(S.nid++),
        name:sc.name,
        color:sc.color||(typeof nextRouteColor==='function'?nextRouteColor():'#7aa2f7'),
        actorId:path[0],
        volume:sc.volume!=null?sc.volume:100,
        path,
        steps:(sc.steps||[]).map(s=>({name:s.name||'',verb:s.verb||'',uri:s.uri||'',resp:s.resp||''})),
        visible:true
      });
    });
    if(typeof renderRoutesPanel==='function')renderRoutesPanel();
  }
  if(wasEmpty)adoptSysName(tplLabel(tpl));
  pushHist();analyze();toast('📦 '+tplLabel(tpl));
}
// Меню «Шаблоны» = примеры (готовые системы) + заготовки (Системы/Элементы), категории — flyout-подменю вправо
// Элементы дополнительно разбиты на тематические под-подменю (3-й уровень), т.к. их много (40+)
function buildTemplatesMenu(){
  const m=$('m-tmpl');if(!m)return;
  const _grpName=g=>({'Системы':t('tmpl_g_systems'),'Элементы':t('tmpl_g_elements')}[g]||g);
  const _grpOrder=['Системы','Элементы'];
  const _tplItem=([key,tpl])=>{const _lbl=tplLabel(tpl);return `<div class="menu-item" onclick="menuDo(function(){placeTemplate('${key}')})" title="${tpl.bls.length} ${t('tpl_nodes')}, ${tpl.cs.length} ${t('tpl_conns')}">📦 ${_lbl}</div>`;};
  let h='';
  if(EXAMPLES.length){
    h+=`<div class="menu-sec">${t('tmpl_examples')}</div>`;
    EXAMPLES.forEach((ex,i)=>{h+=`<div class="menu-item" onclick="menuDo(function(){loadExampleByIndex(${i})})">🗂 ${ex.name}</div>`;});
    h+=`<div class="menu-sep"></div>`;
  }
  const groups={};
  Object.entries(TMPLS).forEach(([k,tpl])=>{const g=tpl.g||t('tmpl_group_default');(groups[g]=groups[g]||[]).push([k,tpl]);});
  const orderedNames=[..._grpOrder.filter(g=>groups[g]),...Object.keys(groups).filter(g=>!_grpOrder.includes(g))];
  orderedNames.forEach(gname=>{
    const items=groups[gname];
    const themed={};let untheme=[];
    items.forEach(pair=>{const th=pair[1].theme;if(th)(themed[th]=themed[th]||[]).push(pair);else untheme.push(pair);});
    let sub='';let subScrollable=false;
    if(Object.keys(themed).length){
      Object.entries(themed).forEach(([thname,thItems])=>{
        const thSub=thItems.map(_tplItem).join('');
        sub+=`<div class="menu-item has-sub">🏷 ${themeLabel(thname)}<span class="menu-kbd">▶</span><div class="submenu scrollable">${thSub}</div></div>`;
      });
      untheme.forEach(pair=>{sub+=_tplItem(pair);});
    }else{
      items.forEach(pair=>{sub+=_tplItem(pair);});
      subScrollable=true; // плоский список без тем (напр. «Системы») — может быть длинным
    }
    h+=`<div class="menu-item has-sub">📦 ${_grpName(gname)}<span class="menu-kbd">▶</span><div class="submenu${subScrollable?' scrollable':''}">${sub}</div></div>`;
  });
  m.innerHTML=h;
}
// совместимость со старым именем (вызов из bootstrap)
function buildExamples(){buildTemplatesMenu();}
function loadExampleByIndex(i){
  const ex=EXAMPLES[i];if(!ex)return;
  S.blocks=ex.blocks.map(b=>({...JSON.parse(JSON.stringify(b)),patterns:b.patterns||[],settings:b.settings||{}}));
  S.conns=ex.conns.map(c=>({...c}));S.scenarios=[];recomputeNidFromState();S.selected=null;S.panX=0;S.panY=0;HIST=[];HI=-1;
  if(S.meta)S.meta.systemName='';adoptSysName(ex.name);
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

// ── РЕЖИМЫ РАБОТЫ (взаимоисключающие): Конструктор / Обучение ──
function _markMode(m){S.uiMode=m;document.querySelectorAll('.modebtn2').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));}
function activateBuildMode(){_markMode('build');}
function setMode(m){
  // 1) выходим из текущих режимов
  if(m!=='learn'&&typeof closeTrainer==='function')closeTrainer();
  // 2) подсвечиваем выбранный
  _markMode(m);
  // 3) входим
  if(m==='learn'&&typeof openTrainer==='function')openTrainer();
}

// ═══════════════════════════════════════════════════════════════
// САЙДБАР — описание блока + анализ
// ═══════════════════════════════════════════════════════════════
let sideTab='analysis';
function switchTab(t){sideTab=t;document.querySelectorAll('.side-tab').forEach(x=>x.classList.toggle('on',x.dataset.tab===t));$('side-analysis').style.display=t==='analysis'?'':'none';$('side-logs').style.display=t==='logs'?'':'none';$('side-routes').style.display=t==='routes'?'':'none';$('side-saves').style.display=t==='saves'?'':'none';if(t==='saves')renderSaves();if(t==='logs')renderLogs();if(t==='routes'&&typeof renderRoutesPanel==='function')renderRoutesPanel();if(S.notationMode==='bpmn'&&t==='analysis'&&typeof renderBpmnPanel==='function')renderBpmnPanel();}
function updateSidebar(){
  const c=$('side-analysis');const sel=gb(S.selected);
  if(sel){
    const d=EL[sel.type];const rt=sel.rt||{};
    let h=`<div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:3px">${bLabel(sel)}</div>`;
    h+=`<div style="font-size:11px;color:var(--txt2);margin-bottom:8px;line-height:1.4">${elDesc(sel.type,'role')}</div>`;
    // живые метрики
    if(rt.cap&&isFinite(rt.cap)){
      const pct=Math.round(rt.rho*100);const clr=hClr(rt.health)||'#9ece6a';
      h+=`<div class="metric-box"><div class="metric"><span>${t('an_capacity')}</span><b>${fmt(rt.cap)} rps</b></div><div class="metric"><span>${t('an_load')}</span><b>${fmt(rt.lambdaIn)} rps</b></div><div class="metric"><span>${t('an_usage')}</span><b style="color:${clr}">${pct}%</b></div><div class="metric"><span>${t('an_latency')}</span><b style="color:${clr}">${rt.effLat?.toFixed(1)} ms</b></div></div>`;
      h+=rtExtraHtml(sel);
      if(rt.cbOpen)h+=`<div class="card info">${t('an_cb_open')}</div>`;
      if(rt.cascade)h+=`<div class="card warn">${t('an_cascade')} (${bLabel(gb(rt.slowDueTo))}).</div>`;
      if(rt.health==='error')h+=`<div class="card error">${t('an_overloaded')} ${fixHint(sel)}</div>`;
      else if(rt.health==='warn'&&!rt.cascade)h+=`<div class="card warn">${t('an_warn')} (${pct}%)</div>`;
      else if(rt.health==='ok')h+=`<div class="card ok">${t('an_ok')}</div>`;
    }
    h+=`<div class="info-box">${t('an_place')} ${elDesc(sel.type,'place')}</div>`;
    h+=`<div class="info-box" style="border-color:#f7768e44">${t('an_never')} ${elDesc(sel.type,'never')}</div>`;
    h+=`<div class="card info">💡 ${elDesc(sel.type,'tip')}</div>`;
    if(SETTINGS_DEF[sel.type]){
      const isBroker=['kafka','rabbitmq','nats','queue'].includes(sel.type);
      if(isBroker) h+=`<button onclick="openBrokerInspector('${sel.id}')" style="margin-top:8px;width:100%;padding:7px;border-radius:6px;border:1px solid #bb9af777;background:#bb9af722;color:#bb9af7;cursor:pointer;font-size:11.5px">${t('an_inspector')}${Object.keys(sel.settings||{}).length?t('an_inspector_active'):''}</button>`;
      else h+=`<button onclick="openSettings('${sel.id}')" style="margin-top:8px;width:100%;padding:7px;border-radius:6px;border:1px solid #7aa2f777;background:#7aa2f722;color:#7aa2f7;cursor:pointer;font-size:11.5px">${t('an_where_btn')}${(sel.patterns?.length||Object.keys(sel.settings||{}).length)?t('an_settings_active'):''}</button>`;
    }
    // Топология и модель хранения — для любого типа БД (db-viz.js)
    if(typeof DBV_META!=='undefined'&&DBV_META[sel.type])
      h+=`<button class="dbv-insp-btn" onclick="openDBViz('${sel.id}')">🧬 ${tTask({ru:'Топология и модель хранения',en:'Topology & storage model'})}</button>`;
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
    // Redis-редактор паттернов
    if(sel.type==='redis'){
      const pCnt=(sel.redisSchema?.patterns||[]).length;
      h+=`<button onclick="openRedisEditor('${sel.id}')" style="margin-top:6px;width:100%;padding:7px;border-radius:6px;border:1px solid #f7768e77;background:#f7768e18;color:#f7768e;cursor:pointer;font-size:11.5px">⚡ Redis-схема${pCnt?` (${pCnt} паттернов)`:''}</button>`;
    }
    if(typeof zsSidebarHtml==='function')h+=zsSidebarHtml(sel);
    c.innerHTML=h;return;
  }
  // общий список проблем
  const issues=[];
  S.blocks.forEach(b=>{const rt=b.rt||{};const ex=rtIssues(b);if(ex.length){issues.push(...ex);return;}if(rt.health==='error')issues.push({s:'error',n:b.customLabel||EL[b.type].lbl,m:t('an_issue_overload')+' '+Math.round(rt.rho*100)+'% — '+fixHint(b)});else if(rt.cascade)issues.push({s:'warn',n:b.customLabel||EL[b.type].lbl,m:t('an_issue_cascade')});else if(rt.health==='warn')issues.push({s:'warn',n:b.customLabel||EL[b.type].lbl,m:t('an_issue_warn')+' '+Math.round(rt.rho*100)+'%'});});
  Object.entries(S.connWarn||{}).forEach(([cid,w])=>{const c2=gc(cid);if(c2){const f=gb(c2.from);issues.push({s:w.sev,n:(f?.customLabel||EL[f?.type]?.lbl)+'→',m:w.msg});}});
  // структурная проверка брокеров: у брокера/очереди должны быть И продюсер, И консьюмер
  S.blocks.forEach(b=>{const cat=EL[b.type]?.cat;if(cat==='broker'||cat==='queue'){
    const nm=b.customLabel||EL[b.type].lbl;
    const hasProd=S.conns.some(c=>c.to===b.id);
    const consumers=S.conns.filter(c=>c.from===b.id).map(c=>EL[gb(c.to)?.type]?.cat);
    const hasCons=consumers.some(cc=>cc==='svc'||cc==='bff');
    if(!hasProd)issues.push({s:'warn',n:nm,m:t('an_broker_no_prod')+' '+nm});
    if(!S.conns.some(c=>c.from===b.id))issues.push({s:'error',n:nm,m:t('an_broker_no_out')+' '+nm+' '+t('an_broker_to_svc')});
    else if(!hasCons)issues.push({s:'warn',n:nm,m:t('an_broker_no_cons')+' '+nm+' '+t('an_broker_to_svc')});
  }});
  const okCard=S.loadMode==='realism'
    ?(scenTotalRps()===0
        ?`<div class="card warn">${t('an_ok_realism_no_load')}</div>`
        :`<div class="card ok">${t('an_ok_realism')} ${fmt(scenTotalRps())} rps</div>`)
    :`<div class="card ok">${t('an_ok_sandbox')} ${fmt(S.load)} rps</div>`;
  c.innerHTML=!S.blocks.length?`<div style="color:var(--txt2);font-size:11px;line-height:1.7">${typeof t==='function'?t('analyze_empty'):'Перетащи блок из палитры на холст.'}</div>`:!issues.length?okCard:issues.map(i=>`<div class="card ${i.s}"><b>${esc(i.n)}</b><br>${esc(i.m)}</div>`).join('');
}
function fixHint(b){
  const tp=b.type, rt=b.rt||{}, s=b.settings||{}, L=(ru,en)=>tTask({ru,en});
  if(tp==='postgresql'||tp==='mysql'){
    if(rt.connLimited)return L(`лимит соединений: спрос ${rt.connLimited.demand} при max_connections ${rt.connLimited.max} — включи ${tp==='mysql'?'Connection Pool':'PgBouncer'} или уменьши conn_pool сервисов`,`connection limit: demand ${rt.connLimited.demand} vs max_connections ${rt.connLimited.max} — enable ${tp==='mysql'?'Connection Pool':'PgBouncer'} or lower services' conn_pool`);
    if(rt.writeBound||rt.rhoW>=0.9)return L(`реплики не помогут — упираетесь в запись на праймари (${Math.round((rt.wShare||0)*100)}% записи, ${fmt(rt.lambdaWr||0)} из ${fmt(rt.capW||0)} rps): шардируйте, пишите через очередь или снизьте долю записи`,`replicas won't help — the primary is write-bound (${Math.round((rt.wShare||0)*100)}% writes, ${fmt(rt.lambdaWr||0)} of ${fmt(rt.capW||0)} rps): shard, write via a queue or cut the write share`);
    return t('fix_postgresql');
  }
  if(tp==='redis'&&rt.oomErr)return L('noeviction и данные не влезают в maxmemory → записи падают с OOM: увеличь maxmemory или выбери allkeys-LFU/LRU','noeviction and data exceeds maxmemory → writes fail with OOM: raise maxmemory or pick allkeys-LFU/LRU');
  if(['service','bff'].includes(tp))return t('fix_service');
  if(tp==='api_gw')return t('fix_api_gw');
  if(tp==='redis')return t('fix_redis');
  if(tp==='kafka'&&s.key_strategy==='hot-key')return L('смени ключ сообщения (by-entity) — горячая партиция упирается в один лидер, партиции не помогут','change the message key (by-entity) — the hot partition is bound to one leader, partitions won\'t help');
  if(tp==='kafka')return t('fix_kafka');
  if(tp==='rabbitmq')return t('fix_rabbitmq');
  if(tp==='cassandra')return t('fix_cassandra');
  return t('fix_default');
}
function scenTotalRps(){return (S.scenarios||[]).reduce((a,s)=>a+(s.volume||0),0);}
function updateStatus(){
  if(S.notationMode==='bpmn'){ // в BPMN показываем счётчики BPMN, а не C4
    const bp=S.bpmn||{},ds=bp.diagrams||[],d=ds.find(x=>x.id===bp.currentDiagramId)||ds[0]||{elements:[],flows:[]};
    const els=(d.elements||[]).filter(e=>e.type!=='pool'&&e.type!=='lane').length,fl=(d.flows||[]).length;
    $('sb-l').textContent=`BPMN · ${els} ${t('sb_bpmn_els')} · ${fl} ${t('sb_bpmn_flows')}`+(ds.length>1?` · ${t('sb_bpmn_diag')} ${Math.max(1,ds.indexOf(d)+1)}/${ds.length}`:'');
    $('sb-r').textContent=(typeof BPMN_ANIM!=='undefined'&&BPMN_ANIM.running)?'▶ BPMN':'';
    return;
  }
  $('sb-l').textContent=(typeof zsStatusPrefix==='function'?zsStatusPrefix():'')+`${S.blocks.length} ${t('sb_blocks')} · ${S.conns.length} ${t('sb_connections')}`+((S.scenarios&&S.scenarios.length)?` · ${S.scenarios.length} ${t('sb_scenarios')}`:'');
  const loadTxt=S.loadMode==='realism'?('Σ '+fmt(scenTotalRps())+' rps ('+t('sb_realism')+')'):(fmt(S.load)+' rps');
  $('sb-r').textContent=loadTxt+(SIM.running?(SIM.paused?' ⏸':' ▶ '+Object.keys(SIM.dots).length+' '+t('sb_balls')):'');
}
function setLoad(l){S.load=l;const inp=$('load-input');if(inp&&document.activeElement!==inp)inp.value=fmt(l);analyze();}
function setLoadMode(m){
  S.loadMode=m;
  document.querySelectorAll('.modebtn').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  const li=$('load-input');if(li){li.disabled=(m==='realism');li.style.opacity=(m==='realism')?'0.4':'1';}
  if(m==='realism'&&!(S.scenarios&&S.scenarios.length))toast(t('toast_realism_no_scenarios'),3500);
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
  const b=$('edge-btn');if(b)b.textContent=S.edgeStyle==='ortho'?t('edge_style_ortho'):t('edge_style_curve');
  render();
}
function clearAll(){if(S.blocks.length&&!confirm(t('confirm_clear')))return;stopSim();S.blocks=[];S.conns=[];S.scenarios=[];S.selected=null;pushHist();analyze();if(typeof renderRoutesPanel==='function')renderRoutesPanel();}

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
  const inp='background:#faf4e8;border:1px solid #7a6e5a;padding:6px 8px;font-size:12px;color:#1a1410;outline:none;font-family:inherit;width:100%';
  const lbl='display:block;font-size:10px;color:#6a6050;margin-bottom:3px;font-weight:600;text-transform:uppercase;letter-spacing:.05em';
  const sec=(icon,txt,clr)=>`<div style="font-size:11px;font-weight:700;color:${clr||'#162850'};margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #7a6e5a44">${icon} ${txt}</div>`;
  const DOMAINS=['','E-commerce','Fintech','EdTech','Healthcare','Logistics','SaaS / B2B','Маркетплейс','Медиа / Стриминг','Социальная сеть','Другое'];
  ov.innerHTML=`<div class="modal-box" style="max-width:680px;width:96%;background:#d8d0be;border:2px solid #7a6e5a">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h2 style="color:#162850;font-size:15px">${t('meta_title')}</h2>
      <button class="modal-btn" onclick="closeMetaEditor()">✕</button>
    </div>

    ${sec('🏷',t('meta_sec_ident'))}
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <div><label style="${lbl}">${t('meta_sys_name')}</label><input id="meta-name" style="${inp}" value="${escHtml(m.systemName||'')}" placeholder="${t('meta_sys_name_ph')}"></div>
      <div><label style="${lbl}">${t('meta_version')}</label><input id="meta-ver" style="${inp}" value="${escHtml(m.version||'')}" placeholder="${t('meta_version_ph')}"></div>
      <div><label style="${lbl}">${t('meta_author')}</label><input id="meta-author" style="${inp}" value="${escHtml(m.author||'')}" placeholder="${t('meta_author_ph')}"></div>
    </div>
    <div style="margin-bottom:10px"><label style="${lbl}">${t('meta_domain')}</label>
      <select id="meta-domain" style="${inp}">
        ${DOMAINS.map(d=>`<option value="${d}"${(m.domain||'')==d?' selected':''}>${d||t('meta_domain_ph')}</option>`).join('')}
      </select>
    </div>

    ${sec('🎯',t('meta_sec_essence'),'#1e4a90')}
    <div style="margin-bottom:8px"><label style="${lbl}">${t('meta_problem')}</label>
      <textarea id="meta-problem" style="${inp};min-height:56px;resize:vertical" placeholder="${t('meta_problem_ph')}">${escHtml(m.problem||'')}</textarea></div>
    <div style="margin-bottom:8px"><label style="${lbl}">${t('meta_solution')}</label>
      <textarea id="meta-solution" style="${inp};min-height:56px;resize:vertical" placeholder="${t('meta_solution_ph')}">${escHtml(m.solution||'')}</textarea></div>
    <div style="margin-bottom:10px"><label style="${lbl}">${t('meta_desc')}</label>
      <textarea id="meta-desc" style="${inp};min-height:48px;resize:vertical" placeholder="${t('meta_desc_ph')}">${escHtml(m.description||'')}</textarea></div>

    ${sec('👥',t('meta_sec_users'),'#2a6010')}
    <div id="meta-roles">${(m.userRoles||[]).map((r,ri)=>`
      <div style="border:1px solid #7a6e5a44;padding:8px;margin-bottom:6px;background:#ccc4b0">
        <div style="display:flex;gap:6px;margin-bottom:5px">
          <input style="${inp}" value="${escHtml(r.name)}" placeholder="${t('meta_role_name_ph')}" onchange="S.meta.userRoles[${ri}].name=this.value">
          <button class="modal-btn" onclick="S.meta.userRoles.splice(${ri},1);renderMetaEditor()" style="color:#8a1808;padding:4px 8px">✕</button>
        </div>
        <textarea style="${inp};min-height:48px;resize:vertical" placeholder="${t('meta_role_can_ph')}" onchange="S.meta.userRoles[${ri}].can=this.value.split('\\n').map(s=>s.trim()).filter(Boolean)">${esc((r.can||[]).join('\n'))}</textarea>
      </div>`).join('')}</div>
    <button class="modal-btn" onclick="S.meta.userRoles.push({name:'${t('meta_new_role')}',can:[]});renderMetaEditor()" style="margin-bottom:12px">${t('meta_add_role')}</button>

    ${sec('📐',t('meta_sec_reqs'),'#7a5008')}
    <div id="meta-reqs">${(m.requirements||[]).map((r,ri)=>`
      <div style="display:flex;gap:6px;margin-bottom:5px">
        <input style="${inp};flex:1" value="${escHtml(r.text)}" placeholder="${t('meta_req_text_ph')}" onchange="S.meta.requirements[${ri}].text=this.value">
        <input style="${inp};width:70px" value="${escHtml(r.card||'')}" placeholder="${t('meta_req_card_ph')}" onchange="S.meta.requirements[${ri}].card=this.value">
        <button class="modal-btn" onclick="S.meta.requirements.splice(${ri},1);renderMetaEditor()" style="color:#8a1808;padding:4px 8px">✕</button>
      </div>`).join('')}</div>
    <button class="modal-btn" onclick="S.meta.requirements.push({text:'',card:''});renderMetaEditor()">${t('meta_add_req')}</button>

    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="modal-btn primary" onclick="saveMetaFields();closeMetaEditor()">${t('meta_done')}</button>
      <button class="modal-btn" onclick="closeMetaEditor()">${t('meta_cancel')}</button>
    </div>
  </div>`;
}
function saveMetaFields(){
  const g=id=>$(id)?.value||'';
  S.meta.systemName=g('meta-name');S.meta.version=g('meta-ver');
  S.meta.author=g('meta-author');S.meta.description=g('meta-desc');
  S.meta.domain=g('meta-domain');S.meta.problem=g('meta-problem');S.meta.solution=g('meta-solution');
}


// ── Метрики движка для БД/Redis: вкладка «Анализ», тултип блока ──
// Redis: hit rate (с учётом переполнения памяти), заполнение, OOM. PostgreSQL/MySQL: запись/чтение, праймари, реплики, лаг.
function rtExtraRows(b){
  const rt=b.rt||{}, s=b.settings||{}, L=(ru,en)=>tTask({ru,en}), rows=[];
  if(b.type==='redis'&&rt.hitRate!=null){
    const base=(s.hit_rate!=null&&s.hit_rate!==''?+s.hit_rate:80), h=Math.round(rt.hitRate*100);
    rows.push({k:'Hit rate',v:h+'%'+(h<Math.round(base)?' ('+L('настройка','set')+' '+Math.round(base)+'%)':''),c:h<Math.round(base)-5?'warn':null,id:'hit'});
    const fill=(typeof redisFill==='function')?redisFill(b):0;
    rows.push({k:L('Память','Memory'),v:(s.dataset||'512mb')+' / '+(s.maxmemory||'1gb')+' · '+Math.round(fill*100)+'%',c:fill>1?(rt.oomErr?'error':'warn'):null,id:'mem'});
    if(rt.oomErr)rows.push({k:'OOM',v:Math.round(rt.oomErr*100)+'% '+L('запросов','requests'),c:'error',id:'oom'});
  }
  if((b.type==='postgresql'||b.type==='mysql')&&rt.capW!=null){
    const ws=Math.round((rt.wShare||0)*100);
    rows.push({k:L('Запись / чтение','Write / read'),v:ws+'% / '+(100-ws)+'% · '+fmt(rt.lambdaWr||0)+' w rps',id:'ws'});
    rows.push({k:L('Праймари (запись)','Primary (writes)'),v:fmt(rt.capW)+' rps · '+Math.round((rt.rhoW||0)*100)+'%',c:rt.rhoW>=0.9?'error':rt.rhoW>=0.6?'warn':null,id:'pw'});
    if(+s.replicas>0){
      rows.push({k:L('Чтение (+'+s.replicas+' реплик)','Reads (+'+s.replicas+' replicas)'),v:fmt(rt.capR)+' rps',id:'rr'});
      rows.push({k:L('Лаг реплик','Replica lag'),v:(rt.replLag>=5000?'> 5 s':rt.replLag+' ms'),c:rt.replLag>=1000?'error':rt.replLag>=200?'warn':null,id:'lag'});
    }
  }
  return rows;
}
// Kafka: нагрузка по партициям (rt.kafka.parts из kafkaAnnotateFlow) — λ, ρ, горячая партиция, лаг консьюмеров
function kafkaPartsHtml(b){
  const k=b.rt&&b.rt.kafka; if(!k||!k.parts||!k.parts.length)return '';
  const L=(ru,en)=>tTask({ru,en}), P=k.parts.length, MAX=16;
  const sev=r=>r>=0.9?'err':r>=0.6?'warn':'ok';
  let list=k.parts.slice();
  if(P>MAX){ list.sort((x,y)=>y.rho-x.rho||x.index-y.index); list=list.slice(0,MAX-1).sort((x,y)=>x.index-y.index); }
  const sim=k.parts.some(x=>x.simLag!=null);
  const lagTxt=x=>x.offline?'offline':(x.lagGrowth>0?'+'+fmt(x.lagGrowth):'0')+(sim?' · '+(x.simLag||0):'');
  let h=`<div class="kp-box" data-k="kparts"><div class="kp-h">${L('Партиции топика','Topic partitions')} <b>${esc(k.topic)}</b> · ${P} × ${fmt(k.partCap)} rps</div>`;
  h+=`<div class="kp-row kp-hdr"><span>P</span><span>${L('загрузка','load')}</span><span>λ rps</span><span title="${L('рост лага (модель) · текущий лаг в сообщениях (симуляция)','lag growth (model) · current lag in messages (simulation)')}">${sim?'Δ/s · msg':L('лаг Δ/s','lag Δ/s')}</span></div>`;
  h+=list.map(x=>{const pct=Math.round(x.rho*100), w=Math.min(100,pct);
    return `<div class="kp-row${x.hot?' kp-hot':''}${x.offline?' kp-off':''}" data-p="${x.index}"><span>P${x.index}${x.hot?' 🔥':''}</span><span class="kp-bar"><i class="kp-${sev(x.rho)}" style="width:${w}%"></i><em>${pct}%</em></span><span>${fmt(x.lambda)}</span><span class="${x.lagGrowth>0?'kp-lag':''}">${lagTxt(x)}</span></div>`;}).join('');
  if(P>MAX)h+=`<div class="kp-more">${L('показаны '+(MAX-1)+' самых загруженных из '+P,'showing top '+(MAX-1)+' of '+P)}</div>`;
  const hot=k.hotPart>=0?k.parts[k.hotPart]:null;
  if(hot)h+=`<div class="kp-note kp-n-${sev(hot.rho)}">🔥 ${L('Горячая партиция P'+hot.index+': '+Math.round(hot.share*100)+'% трафика, '+Math.round(hot.rho*100)+'% её ёмкости. Новые партиции её не разгрузят — смените ключ (by-entity) или солите горячий ключ.','Hot partition P'+hot.index+': '+Math.round(hot.share*100)+'% of traffic, '+Math.round(hot.rho*100)+'% of its capacity. More partitions won\'t help — change the key (by-entity) or salt the hot key.')}</div>`;
  const lagP=k.parts.filter(x=>x.lagGrowth>0);
  if(lagP.length){
    const g=(k.groups||[]).find(x=>x.gid===lagP[0].lagGid), full=g&&g.instances>=P, pl=lagP.map(x=>'P'+x.index).join(', ');
    const fix=hot&&lagP.length===1&&lagP[0].hot?L('разгрузите горячую партицию (смените ключ)','relieve the hot partition (change the key)')
      :full?L('реплик уже ≥ партиций (лишние простаивают) — добавьте партиций или ускорьте консьюмер','replicas ≥ partitions already (extra ones idle) — add partitions or speed up the consumer')
      :L('добавьте консьюмеру реплик (до '+P+' — по числу партиций)','add consumer replicas (up to '+P+' — one per partition)');
    h+=`<div class="kp-note kp-n-warn">⏳ ${L('Лаг растёт на '+pl+' (группа '+lagP[0].lagGid+'): консьюмер не успевает читать — ','Lag grows on '+pl+' (group '+lagP[0].lagGid+'): the consumer can\'t keep up — ')+fix}.</div>`;
  }
  return h+'</div>';
}
function rtExtraHtml(b){
  if(b.type==='kafka')return kafkaPartsHtml(b);
  const rows=rtExtraRows(b); if(!rows.length)return '';
  const clr=c=>c==='error'?'#c0392b':c==='warn'?'#a86400':'';
  let h='<div class="metric-box rt-extra">'+rows.map(r=>`<div class="metric" data-k="${r.id}"><span>${esc(r.k)}</span><b${r.c?` style="color:${clr(r.c)}"`:''}>${esc(r.v)}</b></div>`).join('')+'</div>';
  const rt=b.rt||{}, L=(ru,en)=>tTask({ru,en});
  if(rt.writeBound)h+=`<div class="card warn rt-wb">📝 ${L('Упор в запись: реплики ускоряют только чтение, а запись идёт на праймари. Ещё реплики не помогут — шардируйте или снизьте долю записи.','Write-bound: replicas speed up reads only, writes go to the primary. More replicas won\'t help — shard or cut the write share.')}</div>`;
  if(rt.replLag>=200)h+=`<div class="card warn rt-lag">⏳ ${L('Реплики отстают ('+(rt.replLag>=5000?'> 5 с':rt.replLag+' мс')+'): чтение с реплик может вернуть устаревшие данные (read-your-writes — читать с праймари).','Replicas lag ('+(rt.replLag>=5000?'> 5 s':rt.replLag+' ms')+'): replica reads may be stale (read-your-writes — read from the primary).')}</div>`;
  if(b.type==='redis'&&rt.hitRate!=null){const fill=(typeof redisFill==='function')?redisFill(b):0;
    if(rt.oomErr)h+=`<div class="card error rt-oom">💥 ${fixHint(b)}</div>`;
    else if(fill>1)h+=`<div class="card warn rt-evict">♻ ${L('Данные не влезают в maxmemory — вытеснение снижает hit rate, больше промахов уходит в БД.','Data exceeds maxmemory — eviction lowers the hit rate, more misses reach the DB.')}</div>`;}
  return h;
}
function rtTipText(b){
  const rt=b.rt||{}, d=EL[b.type]||{}, lines=[(b.customLabel||d.lbl||b.type)];
  if(rt.cap&&isFinite(rt.cap))lines.push(`${fmt(rt.lambdaIn||0)} / ${fmt(rt.cap)} rps · ${Math.round((rt.rho||0)*100)}%`);
  rtExtraRows(b).forEach(r=>lines.push(r.k+': '+r.v));
  return lines.join('\n');
}
// Доп. проблемы для общего списка «Анализ» (вместо безликого «перегрузка N%»)
function rtIssues(b){
  const rt=b.rt||{}, n=b.customLabel||EL[b.type]?.lbl, L=(ru,en)=>tTask({ru,en}), out=[];
  if(b.type==='redis'&&rt.oomErr)out.push({s:'error',n,m:'OOM '+Math.round(rt.oomErr*100)+'% — '+fixHint(b)});
  else if(b.type==='redis'&&rt.hitRate!=null&&typeof redisFill==='function'&&redisFill(b)>1&&rt.health!=='error')out.push({s:'warn',n,m:L('hit rate упал до ','hit rate dropped to ')+Math.round(rt.hitRate*100)+'% — '+L('данные не влезают в maxmemory','data exceeds maxmemory')});
  if(b.type==='kafka'&&rt.kafka&&rt.kafka.parts){
    const k=rt.kafka, hot=k.hotPart>=0?k.parts[k.hotPart]:null, lagP=k.parts.filter(x=>x.lagGrowth>0);
    if(hot&&hot.rho>=0.6)out.push({s:hot.rho>=0.9?'error':'warn',n,m:L('горячая партиция P','hot partition P')+hot.index+' — '+Math.round(hot.share*100)+L('% трафика, загрузка ','% of traffic, load ')+Math.round(hot.rho*100)+'%'});
    else if(rt.health==='error')out.push({s:'error',n,m:t('an_issue_overload')+' '+Math.round(rt.rho*100)+'% — '+fixHint(b)});
    if(lagP.length)out.push({s:'warn',n,m:L('лаг консьюмеров растёт на ','consumer lag grows on ')+lagP.map(x=>'P'+x.index).join(', ')+' ('+lagP[0].lagGid+')'});
  }
  if((b.type==='postgresql'||b.type==='mysql')&&rt.health==='error')out.push({s:'error',n,m:t('an_issue_overload')+' '+Math.round(rt.rho*100)+'% — '+fixHint(b)});
  else if((b.type==='postgresql'||b.type==='mysql')&&rt.replLag>=200)out.push({s:'warn',n,m:L('лаг реплик ','replica lag ')+(rt.replLag>=5000?'> 5 s':rt.replLag+' ms')+L(' — праймари перегружен записью',' — primary is write-saturated')});
  return out;
}
