// BOOTSTRAP — инициализация приложения (грузится ПОСЛЕДНИМ)

// ═══════════════════════════════════════════════════════════════
// СОХРАНЕНИЯ / ДОК / КЛАВИШИ / INIT
// ═══════════════════════════════════════════════════════════════
function getSaves(){try{return JSON.parse(localStorage.getItem('arch4_sv')||'[]');}catch{return[];}}
function saveCheckpoint(){
  const name=prompt('Название:','Сейв '+(getSaves().length+1));if(!name)return;
  const sv=getSaves();
  // Сохраняем включая w/h блоков (ресайз)
  sv.unshift({name,date:new Date().toLocaleString('ru'),data:{blocks:S.blocks.map(b=>({...b})),conns:S.conns,scenarios:S.scenarios||[],nid:S.nid,meta:S.meta||defaultMeta()}});
  if(sv.length>30)sv.pop();
  localStorage.setItem('arch4_sv',JSON.stringify(sv));
  toast('💾 '+name);if(sideTab==='saves')renderSaves();
}
function loadSave(i){
  const s=getSaves()[i];if(!s||!confirm('Загрузить?'))return;
  S.blocks=s.data.blocks.map(b=>({...b,settings:b.settings||{},patterns:b.patterns||[]}));
  S.conns=s.data.conns;S.scenarios=s.data.scenarios||[];S.nid=s.data.nid||1000;
  S.meta=s.data.meta||defaultMeta();
  S.selected=null;HIST=[];HI=-1;pushHist();analyze();
  if(typeof renderRoutesPanel==='function')renderRoutesPanel();toast('📂 '+s.name);
}
function delSave(i,e){e.stopPropagation();const sv=getSaves();sv.splice(i,1);localStorage.setItem('arch4_sv',JSON.stringify(sv));renderSaves();}
function renderSaves(){
  const c=$('side-saves');const sv=getSaves();
  let h=`<button onclick="saveCheckpoint()" style="width:100%;padding:6px;margin-bottom:8px;border:1px solid var(--blue);border-radius:6px;background:#1e4a9022;color:var(--blue);cursor:pointer;font-size:11.5px">💾 Сохранить</button>
  <button onclick="exportJSON()" style="width:100%;padding:6px;margin-bottom:4px;border:1px solid var(--brd2);border-radius:6px;background:transparent;color:var(--txt2);cursor:pointer;font-size:11px">⬇ Экспорт .json</button>
  <button onclick="$('fi').click()" style="width:100%;padding:6px;margin-bottom:12px;border:1px solid var(--brd2);border-radius:6px;background:transparent;color:var(--txt2);cursor:pointer;font-size:11px">📂 Импорт .json</button>`;
  sv.forEach((s,i)=>h+=`<div class="save-item" onclick="loadSave(${i})"><span class="save-name">${s.name}<div class="save-meta">${s.date}</div></span><span class="save-del" onclick="delSave(${i},event)">✕</span></div>`);
  if(!sv.length)h+='<div style="color:var(--txt2);font-size:11px">Нет сохранений</div>';
  c.innerHTML=h;
}
function exportJSON(){
  const b=new Blob([JSON.stringify({blocks:S.blocks.map(b=>({...b})),conns:S.conns,scenarios:S.scenarios||[],meta:S.meta||defaultMeta()},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`arch-${Date.now()}.json`;a.click();
}
$('fi').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{try{
    const d=JSON.parse(ev.target.result);
    S.blocks=(d.blocks||[]).map(b=>({...b,settings:b.settings||{},patterns:b.patterns||[]}));
    S.conns=d.conns||[];S.scenarios=d.scenarios||[];S.nid=2000;S.meta=d.meta||defaultMeta();S.selected=null;
    pushHist();analyze();if(typeof renderRoutesPanel==='function')renderRoutesPanel();toast('📂 OK');
  }catch{toast('Ошибка импорта');}};
  r.readAsText(f);e.target.value='';
};

document.addEventListener('keydown',e=>{
  const inField=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable;
  const ctrl=e.ctrlKey||e.metaKey;

  // Routing mode — раньше всего
  if(S.mode==='routing'&&!inField){
    if(e.key==='Enter'){e.preventDefault();finishRouteDraw();return;}
    if(e.key==='Escape'){e.preventDefault();cancelRouteDraw();return;}
    if(e.key==='Backspace'){e.preventDefault();routeUndoLast();return;}
  }

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y — работают ВСЕГДА кроме текстовых полей
  if(ctrl&&e.key==='z'&&!e.shiftKey){if(!inField){e.preventDefault();undo();}return;}
  if(ctrl&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))){if(!inField){e.preventDefault();redo();}return;}

  // Остальные хоткеи — только вне текстовых полей
  if(inField)return;

  if(ctrl&&e.key==='s'){e.preventDefault();saveCheckpoint();}
  else if(ctrl&&e.key==='l'){e.preventDefault();if(typeof autoLayout==='function')autoLayout();}
  else if(ctrl&&e.key==='d'&&S.selected){
    e.preventDefault();
    const _b=gb(S.selected);
    if(_b){S.blocks.push({...JSON.parse(JSON.stringify(_b)),id:'b'+(S.nid++),x:_b.x+40,y:_b.y+40});pushHist();analyze();}
  }
  else if((e.key==='Delete'||e.key==='Backspace')&&S.selected){e.preventDefault();delBlock(S.selected);}
  else if(e.key==='Escape'){
    if(S.mode==='connecting'){S.mode='idle';S.connFrom=null;render();}
    S.palSel=null;buildPalette();hideCtx();
    ['set-modal','dot-modal','advice','seq-modal'].forEach(id=>{const el=$(id);if(el)el.style.display='none';});
    setC4Level(null);
  }
  else if(e.key==='?'){showHotkeysHint();}
});

function showHotkeysHint(){
  let ov=document.getElementById('hotkeys-modal');
  if(!ov){
    ov=document.createElement('div');
    ov.id='hotkeys-modal';
    ov.style.cssText='position:fixed;inset:0;background:#0006;z-index:99999;display:flex;align-items:center;justify-content:center';
    ov.onclick=e=>{if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }
  ov.innerHTML=`<div style="background:var(--bg1);border:2px solid var(--border);padding:24px 32px;min-width:340px;font-family:Tahoma,sans-serif;box-shadow:4px 4px 0 #0004">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <b style="font-size:13px;color:var(--txt)">Горячие клавиши</b>
      <span onclick="document.getElementById('hotkeys-modal').remove()" style="cursor:pointer;font-size:16px;color:var(--txt2)">✕</span>
    </div>
    ${[
      ['Ctrl+Z','Отменить (undo)'],
      ['Ctrl+Y / Ctrl+Shift+Z','Повторить (redo)'],
      ['Ctrl+S','Сохранить чекпоинт'],
      ['Ctrl+L','Авторасстановка блоков'],
      ['Ctrl+D','Дублировать выбранный блок'],
      ['Delete / Backspace','Удалить выбранный блок'],
      ['Escape','Закрыть модалку / отменить действие'],
      ['?','Показать эту подсказку'],
    ].map(([k,d])=>`<div style="display:flex;gap:16px;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span style="min-width:160px;font-weight:700;color:var(--blue);font-family:Consolas,monospace">${k}</span>
      <span style="color:var(--txt)">${d}</span>
    </div>`).join('')}
    <div style="margin-top:12px;font-size:10px;color:var(--txt2)">Ctrl+Z не работает когда курсор в текстовом поле — кликни на холст.</div>
  </div>`;
}

function autosave(){
  try{localStorage.setItem('arch4_auto',JSON.stringify({blocks:S.blocks.map(b=>({...b})),conns:S.conns,scenarios:S.scenarios||[],nid:S.nid,meta:S.meta||defaultMeta()}));}catch{}
}
window.addEventListener('beforeunload',autosave);
setInterval(autosave,20000);

// ── Инициализация ──────────────────────────────────────────────
buildPalette();
buildExamples();
initCanvas();
// Добавить маркеры двунаправленных стрелок в SVG defs
if(typeof ensureBiMarkers==='function') ensureBiMarkers();
pushHist();
analyze();

// Восстановить автосейв
const _a=JSON.parse(localStorage.getItem('arch4_auto')||'null');
if(_a?.blocks?.length){
  S.blocks=_a.blocks.map(b=>({...b,settings:b.settings||{},patterns:b.patterns||[]}));
  S.conns=_a.conns;S.scenarios=_a.scenarios||[];S.nid=_a.nid||1000;
  S.meta=_a.meta||defaultMeta();
  analyze();toast('⏱ Восстановлен');
}

// RAPTOR v1.1.0
