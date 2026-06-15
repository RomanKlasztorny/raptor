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
  let h=`<button onclick="saveCheckpoint()" style="width:100%;padding:6px;margin-bottom:8px;border:1px solid #7aa2f7;border-radius:6px;background:#7aa2f722;color:#7aa2f7;cursor:pointer;font-size:11.5px">💾 Сохранить</button>
  <button onclick="exportJSON()" style="width:100%;padding:6px;margin-bottom:4px;border:1px solid #4a4c6a;border-radius:6px;background:transparent;color:#787c99;cursor:pointer;font-size:11px">⬇ Экспорт .json</button>
  <button onclick="$('fi').click()" style="width:100%;padding:6px;margin-bottom:12px;border:1px solid #4a4c6a;border-radius:6px;background:transparent;color:#787c99;cursor:pointer;font-size:11px">📂 Импорт .json</button>`;
  sv.forEach((s,i)=>h+=`<div class="save-item" onclick="loadSave(${i})"><span class="save-name">${s.name}<div class="save-meta">${s.date}</div></span><span class="save-del" onclick="delSave(${i},event)">✕</span></div>`);
  if(!sv.length)h+='<div style="color:#787c99;font-size:11px">Нет сохранений</div>';
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
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if(S.mode==='routing'){
    if(e.key==='Enter'){e.preventDefault();finishRouteDraw();return;}
    if(e.key==='Escape'){e.preventDefault();cancelRouteDraw();return;}
    if(e.key==='Backspace'){e.preventDefault();routeUndoLast();return;}
  }
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}
  else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))){e.preventDefault();redo();}
  else if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveCheckpoint();}
  else if(e.key==='Delete'&&S.selected){e.preventDefault();delBlock(S.selected);}
  else if(e.key==='Escape'){
    if(S.mode==='connecting'){S.mode='idle';S.connFrom=null;render();}
    S.palSel=null;buildPalette();hideCtx();
    $('set-modal').style.display='none';$('dot-modal').style.display='none';$('advice').style.display='none';
    setC4Level(null);
  }
});

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
