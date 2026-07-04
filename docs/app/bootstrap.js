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
  let h=`<button onclick="saveCheckpoint()" style="width:100%;padding:6px;margin-bottom:8px;border:1px solid var(--blue);border-radius:6px;background:#1e4a9022;color:var(--blue);cursor:pointer;font-size:11.5px">${t('menu_save')}</button>
  <button onclick="exportJSON()" style="width:100%;padding:6px;margin-bottom:4px;border:1px solid var(--brd2);border-radius:6px;background:transparent;color:var(--txt2);cursor:pointer;font-size:11px">${t('menu_export_json')}</button>
  <button onclick="$('fi').click()" style="width:100%;padding:6px;margin-bottom:12px;border:1px solid var(--brd2);border-radius:6px;background:transparent;color:var(--txt2);cursor:pointer;font-size:11px">${t('menu_import_json')}</button>`;
  sv.forEach((s,i)=>h+=`<div class="save-item" onclick="loadSave(${i})"><span class="save-name">${s.name}<div class="save-meta">${s.date}</div></span><span class="save-del" onclick="delSave(${i},event)">✕</span></div>`);
  if(!sv.length)h+=`<div style="color:var(--txt2);font-size:11px">${t('saves_empty')}</div>`;
  c.innerHTML=h;
}
function exportJSON(){
  const b=new Blob([JSON.stringify({blocks:S.blocks.map(b=>({...b})),conns:S.conns,scenarios:S.scenarios||[],meta:S.meta||defaultMeta()},null,2)],{type:'application/json'});
  const name=(S.meta?.systemName||'arch').replace(/[\\/:*?"<>|]/g,'').trim()||'arch';
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${name}.json`;a.click();
}
function normalizeScenarios(scenarios){
  var colors=['#7aa2f7','#9ece6a','#e0af68','#f7768e','#bb9af7','#2ac3de','#ff9e64','#73daca'];
  return (scenarios||[]).map(function(s,i){
    if(!s.id)s.id='sc'+(Date.now()+i);
    if(!s.color)s.color=colors[i%colors.length];
    if(!s.steps)s.steps=[];
    return s;
  });
}
function openPasteJSON(){
  var existing = document.getElementById('paste-json-modal');
  if(existing){ existing.style.display='flex'; document.getElementById('json-paste-area').focus(); return; }
  var ov = document.createElement('div');
  ov.id = 'paste-json-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:#0007;z-index:400;display:flex;align-items:center;justify-content:center';
  ov.innerHTML =
    '<div class="modal-box" style="width:500px;max-width:94%">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
        '<h2>' + (t('paste_json_label')||'📋 Вставить JSON') + '</h2>' +
        '<button class="modal-btn" onclick="document.getElementById(\'paste-json-modal\').style.display=\'none\'">✕</button>' +
      '</div>' +
      '<textarea id="json-paste-area" placeholder="' + (t('paste_json_ph')||'Вставь JSON схемы…') + '" ' +
        'style="width:100%;height:220px;resize:vertical;font-size:11px;font-family:Consolas,monospace;' +
        'background:var(--bg1);color:var(--txt);border:1px solid var(--brd2);padding:8px;box-sizing:border-box;margin-bottom:10px"></textarea>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="modal-btn" style="background:#2a6010;color:#fff;font-weight:700" onclick="importJSONText()">' + (t('paste_json_btn')||'Загрузить') + '</button>' +
        '<button class="modal-btn" onclick="document.getElementById(\'paste-json-modal\').style.display=\'none\'">Отмена</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  setTimeout(function(){ document.getElementById('json-paste-area').focus(); }, 50);
}

function importJSONText(){
  var ta=document.getElementById('json-paste-area');
  if(!ta||!ta.value.trim()){toast('⚠ Вставь JSON в поле выше');return;}
  try{
    var raw=ta.value.trim();
    // Вырезаем JSON из ```json ... ``` если вставили с маркдауном
    var md=raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if(md)raw=md[1].trim();
    var d=JSON.parse(raw);
    // Используем unwrapData из raptor-ai.js если доступен
    if(typeof AI!=='undefined'&&typeof AI.mergeJSON==='function'){
      AI.loadJSON(d);
    } else {
      S.blocks=(d.blocks||[]).map(function(b){return Object.assign({settings:{},patterns:[]},b);});
      S.conns=d.conns||[];
      S.scenarios=normalizeScenarios(d.scenarios);
      S.nid=2000;S.meta=d.meta||defaultMeta();S.selected=null;
      pushHist();analyze();
      if(typeof renderRoutesPanel==='function')renderRoutesPanel();
      toast('📂 Загружено: '+S.blocks.length+' блоков');
    }
    ta.value='';
    var modal = document.getElementById('paste-json-modal');
    if(modal) modal.style.display='none';
  }catch(e){toast('❌ Ошибка JSON: '+e.message);}
}

$('fi').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{try{
    const d=JSON.parse(ev.target.result);
    S.blocks=(d.blocks||[]).map(b=>({...b,settings:b.settings||{},patterns:b.patterns||[]}));
    S.conns=d.conns||[];S.scenarios=normalizeScenarios(d.scenarios);S.nid=2000;S.meta=d.meta||defaultMeta();S.selected=null;
    pushHist();analyze();if(typeof renderRoutesPanel==='function')renderRoutesPanel();toast('📂 OK');
  }catch{toast('Ошибка импорта');}};
  r.readAsText(f);e.target.value='';
};

document.addEventListener('keydown',e=>{
  const inField=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable;
  const ctrl=e.ctrlKey||e.metaKey;

  // Routing mode — раньше всего
  if(S.mode==='routing'&&!inField){
    if(e.key==='Enter'){e.preventDefault();if(!document.getElementById('step-popup'))finishRouteDraw();return;}
    if(e.key==='Escape'){e.preventDefault();if(document.getElementById('step-popup'))skipStepPopup();else cancelRouteDraw();return;}
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
      <b style="font-size:13px;color:var(--txt)">${t('hotkeys_title')}</b>
      <span onclick="document.getElementById('hotkeys-modal').remove()" style="cursor:pointer;font-size:16px;color:var(--txt2)">✕</span>
    </div>
    ${[
      ['Ctrl+Z',t('hotkey_undo')],
      ['Ctrl+Y / Ctrl+Shift+Z',t('hotkey_redo')],
      ['Ctrl+S',t('hotkey_save')],
      ['Ctrl+L',t('hotkey_layout')],
      ['Ctrl+D',t('hotkey_dup')],
      ['Delete / Backspace',t('hotkey_del')],
      ['Escape',t('hotkey_esc')],
      ['?',t('hotkey_show_hint')],
    ].map(([k,d])=>`<div style="display:flex;gap:16px;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span style="min-width:160px;font-weight:700;color:var(--blue);font-family:Consolas,monospace">${k}</span>
      <span style="color:var(--txt)">${d}</span>
    </div>`).join('')}
    <div style="margin-top:12px;font-size:10px;color:var(--txt2)">${t('hotkey_note')}</div>
  </div>`;
}

function openHelp(){
  const box=document.getElementById('help-modal-box');
  if(!box)return;
  const rows=[
    ['help_palette','help_palette_d'],['help_click','help_click_d'],['help_drag','help_drag_d'],
    ['help_dblclick','help_dblclick_d'],['help_arrow','help_arrow_d'],['help_c4','help_c4_d'],
    ['help_auto','help_auto_d'],['help_db','help_db_d'],
  ].map(([k,d])=>`<div class="help-row"><span class="kbd">${t(k)}</span><span>${t(d)}</span></div>`).join('');
  box.innerHTML=`
    <h2>${t('help_title')}</h2><div style="height:8px"></div>
    ${rows}
    <div style="margin-top:12px;padding:11px;background:var(--bg1);border-radius:8px;font-size:11.5px;line-height:1.7;color:var(--txt2)">
      <b style="color:var(--green)">${t('help_bidir')}</b> ${t('help_bidir_d')}<br>
      <b style="color:var(--purple)">${t('help_kafka')}</b> ${t('help_kafka_d')}<br>
      <b style="color:var(--blue)">${t('help_uml')}</b> ${t('help_uml_d')}<br>
      <b style="color:var(--yellow)">${t('help_collision')}</b> ${t('help_collision_d')}
    </div>
    <button class="modal-btn primary" onclick="document.getElementById('help-modal').style.display='none'">${t('help_ok')}</button>`;
  document.getElementById('help-modal').style.display='flex';
  menuClose();
}

function autosave(){
  try{localStorage.setItem('arch4_auto',JSON.stringify({blocks:S.blocks.map(b=>({...b})),conns:S.conns,scenarios:S.scenarios||[],nid:S.nid,meta:S.meta||defaultMeta()}));}catch{}
}
window.addEventListener('beforeunload',autosave);
setInterval(autosave,20000);

// ── Инициализация ──────────────────────────────────────────────
if(typeof applyLocale==='function'){
  applyLocale();
  var _flags={ru:'🇷🇺',en:'🇬🇧',ua:'🇺🇦',pl:'🇵🇱',es:'🇪🇸',de:'🇩🇪'};
  var _lb=document.getElementById('lang-btn');
  if(_lb)_lb.textContent=(_flags[CURR_LANG]||'🌐')+' '+(CURR_LANG||'ru').toUpperCase();
}
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
  S.conns=_a.conns;S.scenarios=normalizeScenarios(_a.scenarios);S.nid=_a.nid||1000;
  S.meta=_a.meta||defaultMeta();
  analyze();toast('⏱ Восстановлен');
}
