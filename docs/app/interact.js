// INTERACT — события холста (drag/pan/connect), коллизии, настройки блока

// ═══════════════════════════════════════════════════════════════
// СОБЫТИЯ ХОЛСТА
// ═══════════════════════════════════════════════════════════════
function initCanvas(){
  const svg=$('canvas');
  svg.addEventListener('mousedown',e=>{
    if(e.button===1){e.preventDefault();S.mode='panning';S.panOx=e.clientX-S.panX;S.panOy=e.clientY-S.panY;return;}
    if(e.button!==0||S.mode==='connecting')return;
    const pt=svgPt(e);
    if(S.mode==='routing'){if(typeof routeClickNode==='function')routeClickNode(blockAt(pt));return;}
    if(S.palSel){
      const b={id:'b'+(S.nid++),type:S.palSel,x:pt.x-BW/2,y:pt.y-BH/2,patterns:[],settings:{}};
      S.blocks.push(b);S.palSel=null;buildPalette();pushHist();analyze();return;}
    const b=blockAt(pt);
    if(b){
      S.mode='dragging';S.dragId=b.id;
      S.dragOx=e.clientX;S.dragOy=e.clientY;
      S._dragOrigX=b.x;S._dragOrigY=b.y; // запомнить исходную позицию для отката
      if(S.selected!==b.id){S.selected=b.id;updateSidebar();}render();return;}
    S.selected=null;updateSidebar();render();
  });
  svg.addEventListener('mousemove',e=>{
    const pt=svgPt(e);
    if(S.mode==='routing'){if(typeof setRouteHover==='function')setRouteHover(blockAt(pt)?.id||null);return;}
    if(S.mode==='resizing'){
      const b=gb(S.resizeId);
      if(b){b.w=Math.max(80,Math.round(S.rsW+(e.clientX-S.rsOx)));b.h=Math.max(40,Math.round(S.rsH+(e.clientY-S.rsOy)));}
      render();return;}
    if(S.mode==='dragging'){
      const dx=e.clientX-S.dragOx,dy=e.clientY-S.dragOy;
      const b=gb(S.dragId);
      if(b){b.x+=dx;b.y+=dy;}
      S.dragOx=e.clientX;S.dragOy=e.clientY;
      render();return;}
    if(S.mode==='connecting'){S.tempX=pt.x;S.tempY=pt.y;renderConns();return;}
    if(S.mode==='panning'){S.panX=e.clientX-S.panOx;S.panY=e.clientY-S.panOy;render();return;}
    const nh=blockAt(pt)?.id||null;if(nh!==S.hovered){S.hovered=nh;renderBlocks();}
  });
  svg.addEventListener('mouseup',e=>{
    if(S.mode==='connecting'){
      const pt=svgPt(e);const tgt=blockAt(pt);
      if(tgt&&tgt.id!==S.connFrom&&!S.conns.find(c=>c.from===S.connFrom&&c.to===tgt.id)){
        S.conns.push({id:'c'+(S.nid++),from:S.connFrom,to:tgt.id});
        const f=gb(S.connFrom);const adv=connAdvice(EL[f.type],EL[tgt.type]);if(adv)showAdvice(adv);
        pushHist();analyze();
      }
      S.mode='idle';S.connFrom=null;render();return;
    }
    if(S.mode==='routing')return;
    if(S.mode==='resizing'){pushHist();S.mode='idle';S.resizeId=null;return;}
    if(S.mode==='dragging'){
      // ── ПРОВЕРКА КОЛЛИЗИЙ ──────────────────────────────────
      const b=gb(S.dragId);
      if(b){
        const collision=detectCollision(b);
        if(collision){
          // Откат к исходной позиции
          b.x=S._dragOrigX;b.y=S._dragOrigY;
          b._collision=true;
          render();
          setTimeout(()=>{b._collision=false;render();},1200);
          toast('⛔ Блок перекрывается с «'+(collision.customLabel||EL[collision.type]?.lbl)+'»');
        } else {
          delete b._collision;
        }
      }
      pushHist();S.mode='idle';S.dragId=null;return;
    }
    S.mode='idle';
  });
  svg.addEventListener('mouseleave',()=>{if(S.mode==='connecting'){S.mode='idle';S.connFrom=null;render();}if(S.mode==='panning')S.mode='idle';});
  svg.addEventListener('dblclick',e=>{
    const b=blockAt(svgPt(e));if(!b)return;
    const sh=EL[b.type]?.shape;
    const cat=BASE[b.type]?.cat;
    if((sh==='person'||sh==='role')&&typeof openScenario==='function') openScenario(b.id);
    else if(b.type==='postgresql'&&typeof openDBEditor==='function') openDBEditor(b.id); // 2× клик PostgreSQL → редактор таблиц
    else if(['kafka','rabbitmq','nats','queue'].includes(b.type)) openBrokerInspector(b.id);
    else openSettings(b.id);
  });
  svg.addEventListener('contextmenu',e=>{e.preventDefault();const b=blockAt(svgPt(e));if(b)showCtx(e,b.id);});
}

// Проверить коллизию блока b с остальными. Возвращает первый пересекающийся блок или null.
function detectCollision(b){
  const W=bw(b),H=bh(b);
  const margin=4; // небольшой зазор — вплотную можно
  for(const other of S.blocks){
    if(other.id===b.id) continue;
    const oW=bw(other),oH=bh(other);
    if(b.x+W-margin>other.x+margin &&
       b.x+margin<other.x+oW-margin &&
       b.y+H-margin>other.y+margin &&
       b.y+margin<other.y+oH-margin){
      return other;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// СОВЕТ ПРИ СОЗДАНИИ СВЯЗИ
// ═══════════════════════════════════════════════════════════════
function connAdvice(fd,td){
  const bad=badConn(fd,td);
  if(bad){
    const fixes={
      'Клиент не должен лезть в БД напрямую':'Клиент → Gateway → Сервис → БД',
      'Gateway не пишет в БД — нужен сервис':'Gateway → Сервис → БД',
      'Между брокером и БД нужен consumer-сервис':'Брокер → Consumer-сервис → БД',
      'БД не публикует события сама (нужен Debezium/Outbox)':'Сервис → БД и Сервис → Брокер (параллельно)',
      'LB перед брокером не нужен — у Kafka своя балансировка':'Сервис → Брокер напрямую',
      'LB после брокера избыточен — Kafka балансирует через consumer groups':'Брокер → Consumer-сервис напрямую',
      'Без Gateway сервис открыт всем — нет авторизации':'Клиент → Gateway → Сервис',
    };
    return {sev:bad.sev,title:(bad.sev==='error'?'❌ ':bad.sev==='warn'?'⚠ ':'💡 ')+bad.msg,fix:'Правильно: '+(fixes[bad.msg]||'')};
  }
  const good=goodFlow(fd,td);
  if(good)return{sev:'good',title:'✅ '+good.t,fix:good.f};
  return null;
}
function goodFlow(fd,td){
  if(fd.cat==='client'&&td.cat==='gw')return{t:'Клиент → Gateway',f:'Пользователь шлёт запрос. Gateway проверит авторизацию и направит дальше.'};
  if(fd.cat==='client'&&td.cat==='net')return{t:'Клиент → CDN/LB',f:'Запрос идёт через сеть. CDN отдаст статику, LB распределит нагрузку.'};
  if(fd.cat==='gw'&&(td.cat==='svc'))return{t:'Gateway → Сервис',f:'Gateway роутит запрос в нужный сервис по пути URL.'};
  if(fd.cat==='gw'&&td.cat==='net')return{t:'Gateway → LB',f:'Gateway передаёт балансировщику, тот выберет свободную реплику.'};
  if(fd.cat==='net'&&td.cat==='svc')return{t:'LB → Сервис',f:'Балансировщик выбрал одну из реплик и отправил ей запрос.'};
  if(fd.cat==='svc'&&td.cat==='cache')return{t:'Сервис → Redis',f:'Сервис проверяет кэш: есть готовый ответ? Если да — БД не трогаем.'};
  if(fd.cat==='svc'&&td.cat==='db')return{t:'Сервис → БД',f:'Сервис делает SQL-запрос: читает или пишет данные.'};
  if(fd.cat==='svc'&&td.cat==='broker')return{t:'Сервис → Брокер (async)',f:'Сервис публикует событие и НЕ ждёт ответа. Связь асинхронная (пунктир).'};
  if(fd.cat==='broker'&&td.cat==='svc')return{t:'Брокер → Consumer',f:'Consumer-сервис читает события из брокера в своём темпе. Сервис может одновременно и читать события, и публиковать новые.'};
  if(fd.cat==='svc'&&td.cat==='svc')return{t:'Сервис → Сервис (sync)',f:'⚠ Синхронный вызов — A ЖДЁТ B. Если B упадёт, A зависнет. Добавь Circuit Breaker на A!'};
  return null;
}
const CAT_ACTION={
  client:'показывает результат пользователю на экране',
  gw:'проверяет авторизацию, применяет лимиты и выбирает нужный сервис по адресу',
  net:'распределяет запрос между копиями (репликами), чтобы ни одна не перегрузилась',
  svc:'выполняет бизнес-логику: считает, проверяет, готовит ответ',
  db:'читает или записывает данные на диск (это самый медленный шаг)',
  cache:'мгновенно отдаёт готовый ответ из оперативной памяти (~0.1мс)',
  broker:'складывает событие в лог и СРАЗУ отвечает «принял» — обработают позже',
  queue:'ставит задачу в очередь, worker заберёт её когда освободится',
};
function hopNarrative(f,t,fd,td,async){
  const fn=f.customLabel||fd.lbl, tn=t.customLabel||td.lbl;
  const steps=[
    `<b>${fn}</b> формирует запрос и кладёт его на эту связь.`,
    `🔵 Запрос-кружок летит по линии к <b>${tn}</b> (загрузка ~${Math.round((t.rt?.rho||0)*100)}%).`,
    `<b>${tn}</b> ${CAT_ACTION[td.cat]||'обрабатывает запрос'}.`,
  ];
  const nexts=S.conns.filter(c=>c.from===t.id);
  if(nexts.length)steps.push(`Если нужно — <b>${tn}</b> сам зовёт дальше (${nexts.map(c=>gb(c.to)?.customLabel||EL[gb(c.to)?.type]?.lbl).filter(Boolean).join(', ')}).`);
  let back;
  if(async)back=`Связь <b>асинхронная</b> (пунктир): ответа НЕ будет. <b>${fn}</b> отправил и сразу свободен — не ждёт. Так гасят спайки и развязывают сервисы.`;
  else if(['db','cache'].includes(td.cat))back=`▶ Ответ-треугольник полетит ОБРАТНО тем же путём до <b>${fn}</b> и дальше к пользователю. Цвет ответа = успел/притормозил/упал.`;
  else back=`<b>${tn}</b> обработает и вернёт ответ выше по цепочке. Это синхронный вызов — <b>${fn}</b> ЖДЁТ ответа всё это время.`;
  return {steps,back};
}
function showAdvice(adv){
  const el=$('advice');
  const clr={error:'#f7768e',warn:'#e0af68',info:'#7aa2f7',good:'#9ece6a'}[adv.sev];
  el.style.borderColor=clr;$('adv-title').style.color=clr;$('adv-title').textContent=adv.title;$('adv-fix').textContent=adv.fix;
  el.style.display='block';clearTimeout(el._t);el._t=setTimeout(()=>el.style.display='none',adv.sev==='good'?4000:9000);
}

// ═══════════════════════════════════════════════════════════════
// РЕДАКТИРОВАНИЕ
// ═══════════════════════════════════════════════════════════════
function delBlock(id){S.blocks=S.blocks.filter(b=>b.id!==id);S.conns=S.conns.filter(c=>c.from!==id&&c.to!==id);if(S.selected===id)S.selected=null;pushHist();analyze();}
function startRename(id){
  const b=gb(id);if(!b)return;const d=EL[b.type];const r=svgRct();
  const inp=document.createElement('input');
  inp.style.cssText=`position:fixed;z-index:400;left:${r.left+b.x+S.panX+8}px;top:${r.top+b.y+S.panY+13}px;width:${bw(b)-16}px;padding:3px 5px;border:1.5px solid #7aa2f7;border-radius:5px;background:#1a1b26;color:#c0caf5;font-size:11.5px;text-align:center;outline:none`;
  inp.value=b.customLabel||d.lbl;document.body.appendChild(inp);inp.focus();inp.select();
  const done=()=>{const v=inp.value.trim();if(v&&v!==d.lbl)b.customLabel=v;else if(!v)delete b.customLabel;inp.remove();pushHist();render();};
  inp.onblur=done;inp.onkeydown=ev=>{if(ev.key==='Enter')done();if(ev.key==='Escape')inp.remove();};
}

// ═══════════════════════════════════════════════════════════════
// НАСТРОЙКИ БЛОКА
// ═══════════════════════════════════════════════════════════════
let _setId=null;
function openSettings(id){
  const b=gb(id);if(!b)return;
  _setId=id;if(!b.settings)b.settings={};if(!b.patterns)b.patterns=[];
  const d=EL[b.type];
  $('set-title').textContent='⚙ '+(b.customLabel||d.lbl);
  $('set-sub').textContent=d.role;
  const defs=SETTINGS_DEF[b.type]||[];
  const box=$('set-body');box.innerHTML='';
  if(!defs.length){box.innerHTML='<div style="color:#787c99;font-size:12px">У этого блока нет настраиваемых параметров.</div>';}
  defs.forEach(def=>{
    const row=document.createElement('div');row.className='set-row';
    let ctrl='';
    if(def.type==='pat'){
      const key=def.k.replace('_pat_','');
      const on=b.patterns.includes(key);
      ctrl=`<div class="set-toggle ${on?'on':''}" data-pat="${key}">${on?'ВКЛ':'выкл'}</div>`;
    } else if(def.type==='tog'){
      const on=!!b.settings[def.k];
      ctrl=`<div class="set-toggle ${on?'on':''}" data-tog="${def.k}">${on?'ВКЛ':'выкл'}</div>`;
    } else if(def.type==='num'){
      const v=b.settings[def.k]??def.def;
      ctrl=`<div class="set-num"><button data-num="${def.k}" data-dir="-1">−</button><span id="num-${def.k}">${v}</span><button data-num="${def.k}" data-dir="1">+</button></div>`;
    } else if(def.type==='sel'){
      const v=b.settings[def.k]??def.def;
      ctrl=`<select data-sel="${def.k}">${def.opts.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select>`;
    } else if(def.type==='txt'){
      const v=b.settings[def.k]??def.def??'';
      ctrl=`<input type="text" value="${v}" data-txt="${def.k}" style="padding:5px 8px;background:var(--bg3);border:1px solid var(--brd2);border-radius:6px;color:var(--txt);font-size:11px;width:140px;font-family:inherit" placeholder="${def.def||''}"/>`;
    }
    row.innerHTML=`<div class="set-info"><div class="set-lbl">${def.lbl}</div><div class="set-hint">${def.hint||''}</div></div><div class="set-ctrl">${ctrl}</div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('[data-pat]').forEach(el=>el.onclick=()=>{const k=el.dataset.pat;const i=b.patterns.indexOf(k);if(i<0)b.patterns.push(k);else b.patterns.splice(i,1);el.classList.toggle('on');el.textContent=b.patterns.includes(k)?'ВКЛ':'выкл';pushHist();analyze();updateSetCapacity();});
  box.querySelectorAll('[data-tog]').forEach(el=>el.onclick=()=>{const k=el.dataset.tog;b.settings[k]=!b.settings[k];el.classList.toggle('on');el.textContent=b.settings[k]?'ВКЛ':'выкл';pushHist();analyze();updateSetCapacity();});
  box.querySelectorAll('[data-num]').forEach(el=>el.onclick=()=>{const k=el.dataset.num,dir=+el.dataset.dir;const def=defs.find(d=>d.k===k);let v=(b.settings[k]??def.def)+dir;v=Math.max(def.min,Math.min(def.max,v));b.settings[k]=v;$('num-'+k).textContent=v;pushHist();analyze();updateSetCapacity();});
  box.querySelectorAll('[data-sel]').forEach(el=>el.onchange=()=>{b.settings[el.dataset.sel]=el.value;pushHist();analyze();updateSetCapacity();});
  box.querySelectorAll('[data-txt]').forEach(el=>el.oninput=()=>{b.settings[el.dataset.txt]=el.value;pushHist();analyze();});
  updateSetCapacity();
  $('set-modal').style.display='flex';
}
function updateSetCapacity(){
  const b=gb(_setId);if(!b)return;
  const cap=effCap(b);const base=BASE[b.type].cap;
  const el=$('set-cap');
  if(!isFinite(cap)){el.textContent='Ёмкость: без лимита';return;}
  const mult=cap/base;
  el.innerHTML=`Ёмкость: <b style="color:#9ece6a">${fmt(cap)} rps</b>`+(mult!==1?` <span style="color:#787c99">(база ${fmt(base)} ×${mult.toFixed(1)})</span>`:'');
}
function closeSettings(){$('set-modal').style.display='none';_setId=null;}
