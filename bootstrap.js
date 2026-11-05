// BOOTSTRAP — инициализация приложения (грузится ПОСЛЕДНИМ)

// ═══════════════════════════════════════════════════════════════
// СОХРАНЕНИЯ / ДОК / КЛАВИШИ / INIT
// ═══════════════════════════════════════════════════════════════
function getSaves(){try{return JSON.parse(localStorage.getItem('arch4_sv')||'[]');}catch{return[];}}
function saveCheckpoint(){
  const name=prompt('Name:','Save '+(getSaves().length+1));if(!name)return;
  const sv=getSaves();
  // Save including block w/h (resize) and BPMN data
  sv.unshift({name,date:new Date().toLocaleString(),data:{blocks:S.blocks.map(b=>({...b})),conns:S.conns,scenarios:S.scenarios||[],nid:S.nid,notationMode:S.notationMode||'c4',bpmn:S.bpmn||{diagrams:[],currentDiagramId:null},meta:S.meta||defaultMeta()}});
  if(sv.length>30)sv.pop();
  localStorage.setItem('arch4_sv',JSON.stringify(sv));
  toast('💾 '+name);if(sideTab==='saves')renderSaves();
}
function loadSave(i){
  const s=getSaves()[i];if(!s||!confirm('Load?'))return;
  try{const rep=importProjectData(s.data,'save',{keepNid:true,quiet:true});toast('📂 '+s.name+(rep.droppedConns.length||rep.unknown.length?' · '+importReportText(rep):''));}
  catch(e){toast('❌ '+e.message);}
}
function delSave(i,e){e.stopPropagation();const sv=getSaves();sv.splice(i,1);localStorage.setItem('arch4_sv',JSON.stringify(sv));renderSaves();}
function renderSaves(){
  const c=$('side-saves');const sv=getSaves();
  let h=`<button onclick="saveCheckpoint()" style="width:100%;padding:6px;margin-bottom:8px;border:1px solid var(--blue);border-radius:6px;background:#1e4a9022;color:var(--blue);cursor:pointer;font-size:11.5px">${t('menu_save')}</button>
  <button onclick="exportJSON()" style="width:100%;padding:6px;margin-bottom:4px;border:1px solid var(--brd2);border-radius:6px;background:transparent;color:var(--txt2);cursor:pointer;font-size:11px">${t('menu_export_json')}</button>
  <button onclick="$('fi').click()" style="width:100%;padding:6px;margin-bottom:12px;border:1px solid var(--brd2);border-radius:6px;background:transparent;color:var(--txt2);cursor:pointer;font-size:11px">${t('menu_import_json')}</button>`;
  sv.forEach((s,i)=>h+=`<div class="save-item" onclick="loadSave(${i})"><span class="save-name">${esc(s.name)}<div class="save-meta">${esc(s.date)}</div></span><span class="save-del" onclick="delSave(${i},event)">✕</span></div>`);
  if(!sv.length)h+=`<div style="color:var(--txt2);font-size:11px">${t('saves_empty')}</div>`;
  c.innerHTML=h;
}
function exportJSON(){
  const b=new Blob([JSON.stringify({blocks:S.blocks.map(b=>({...b})),conns:S.conns,scenarios:S.scenarios||[],notationMode:S.notationMode||'c4',bpmn:S.bpmn||{diagrams:[],currentDiagramId:null},meta:S.meta||defaultMeta()},null,2)],{type:'application/json'});
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
  if(!ta||!ta.value.trim()){toast('⚠ Paste JSON above');return;}
  try{
    var raw=ta.value.trim();
    // Strip markdown code fence if pasted
    var md=raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if(md)raw=md[1].trim();
    var d=JSON.parse(raw);
    // Use from raptor-ai.js if available
    if(typeof AI!=='undefined'&&typeof AI.mergeJSON==='function'){
      // «свободный» JSON (от ИИ и т.п.) нормализует raptor-ai.js; затем общие правила импорта:
      // nid = max(id)+1 и новая история
      var _before=S.blocks;AI.loadJSON(d);
      if(S.blocks!==_before){recomputeNidFromState();HIST=[];HI=-1;pushHist();}
    } else {
      importProjectData(d,'paste');
    }
    ta.value='';
    var modal = document.getElementById('paste-json-modal');
    if(modal) modal.style.display='none';
  }catch(e){toast('❌ JSON error: '+e.message);}
}

// Нормализация поля bpmn из внешнего JSON: принимает и канонический объект
// {diagrams:[...],currentDiagramId}, и просто массив диаграмм, и одиночную диаграмму.
function normalizeBpmn(raw){
  if(!raw)return {diagrams:[],currentDiagramId:null};
  if(Array.isArray(raw))return {diagrams:raw,currentDiagramId:raw[0]?.id||null};
  if(raw.diagrams)return {diagrams:raw.diagrams,currentDiagramId:raw.currentDiagramId||raw.diagrams[0]?.id||null};
  if(raw.elements)return {diagrams:[raw],currentDiagramId:raw.id||null}; // одиночная диаграмма без обёртки
  return {diagrams:[],currentDiagramId:null};
}

// ═══════════════════════════════════════════════════════════════
// ИМПОРТ ПРОЕКТА — единая точка для файла, вставки JSON, сохранений и автосейва
// ═══════════════════════════════════════════════════════════════
// Пересчёт S.nid: максимум числового суффикса среди id блоков/связей (+ BPMN) + 1.
// Раньше импорт ставил S.nid=2000 → новые блоки получали id, уже занятые импортированными.
function recomputeNidFromState(){
  let max=0;
  const num=id=>{const m=/^[a-z_]{0,4}(\d{1,9})$/i.exec(String(id==null?'':id));if(m)max=Math.max(max,+m[1]);};
  (S.blocks||[]).forEach(b=>num(b.id));(S.conns||[]).forEach(c=>num(c.id));
  S.nid=Math.max(max+1,1000);
  if(typeof bpmnSanitizeState==='function'){try{bpmnSanitizeState();}catch(e){}}
  return S.nid;
}
// Валидация + загрузка. d — разобранный JSON. opts: {keepNid:bool, quiet:bool}.
// Неизвестный тип блока не роняет приложение: блок остаётся (как «Внешний сервис»),
// исходный тип в b._unknownType, на холсте — красная пунктирная рамка.
// Связь, у которой нет блока на одном из концов, отбрасывается. Возвращает отчёт.
// История (undo) после импорта начинается заново: undo не возвращает прошлый проект.
function importProjectData(d,source,opts){
  opts=opts||{};
  if(!d||typeof d!=='object'||Array.isArray(d))throw new Error(tTask({ru:'ожидался объект проекта {blocks, conns, …}',en:'expected a project object {blocks, conns, …}'}));
  const rep={source:source||'',blocks:0,conns:0,droppedBlocks:0,unknown:[],droppedConns:[],dupIds:0};
  const seen=new Set();const blocks=[];
  (Array.isArray(d.blocks)?d.blocks:[]).forEach((b,i)=>{
    if(!b||typeof b!=='object'||Array.isArray(b)||!b.type){rep.droppedBlocks++;return;}
    b={...b};
    b.id=b.id==null?'':String(b.id);
    if(!b.id||seen.has(b.id)){if(b.id)rep.dupIds++;b.id='imp'+i+'_'+Math.random().toString(36).slice(2,7);}
    seen.add(b.id);
    if(!EL[b.type]){
      rep.unknown.push(String(b.type));
      b._unknownType=String(b.type);b.type='external';
      if(!b.customLabel)b.customLabel=b._unknownType;
    }
    b.x=Number.isFinite(+b.x)?+b.x:60+(i%6)*180;b.y=Number.isFinite(+b.y)?+b.y:60+Math.floor(i/6)*120;
    if(b.customLabel!=null&&typeof b.customLabel!=='string')b.customLabel=String(b.customLabel);
    b.settings=(b.settings&&typeof b.settings==='object')?b.settings:{};
    b.patterns=Array.isArray(b.patterns)?b.patterns.filter(p=>typeof p==='string'):[];
    // b.components (C3, необязательное): ручные компоненты сервиса; мусор отбрасываем
    if('components' in b){const cm=typeof normalizeComponents==='function'?normalizeComponents(b.components):undefined;if(cm&&cm.length)b.components=cm;else delete b.components;}
    blocks.push(b);
  });
  const ids=new Set(blocks.map(b=>b.id));const cseen=new Set();
  const conns=[];
  (Array.isArray(d.conns)?d.conns:[]).forEach((c,i)=>{
    if(!c||typeof c!=='object'){rep.droppedConns.push('#'+i);return;}
    const from=String(c.from),to=String(c.to);
    if(!ids.has(from)||!ids.has(to)){rep.droppedConns.push((c.id||'#'+i)+': '+from+'→'+to);return;}
    c={...c,from,to};
    if(c.id==null||cseen.has(String(c.id)))c.id='cimp'+i;
    c.id=String(c.id);cseen.add(c.id);conns.push(c);
  });
  S.blocks=blocks;S.conns=conns;
  S.scenarios=normalizeScenarios((Array.isArray(d.scenarios)?d.scenarios:[]).filter(s=>s&&typeof s==='object'));
  S.notationMode=d.notationMode==='bpmn'?'bpmn':'c4';
  S.bpmn=normalizeBpmn(d.bpmn);
  S.meta=(d.meta&&typeof d.meta==='object')?d.meta:defaultMeta();
  S.selected=null;
  const prevNid=+d.nid||0;recomputeNidFromState();
  if(opts.keepNid&&prevNid>S.nid)S.nid=prevNid;
  rep.blocks=blocks.length;rep.conns=conns.length;
  HIST=[];HI=-1;pushHist();
  analyze();
  if(typeof renderRoutesPanel==='function')renderRoutesPanel();
  if(typeof buildPalette==='function')buildPalette();
  if(typeof render==='function')render();
  if(!opts.quiet)toast(importReportText(rep));
  return rep;
}
function importReportText(rep){
  let s='📂 '+rep.blocks+' '+tTask({ru:'блоков',en:'blocks'})+', '+rep.conns+' '+tTask({ru:'связей',en:'connections'});
  if(rep.unknown.length)s+=' · ⚠ '+tTask({ru:'неизвестные типы',en:'unknown types'})+': '+[...new Set(rep.unknown)].join(', ');
  if(rep.droppedConns.length)s+=' · ✂ '+tTask({ru:'отброшено битых связей',en:'broken connections dropped'})+': '+rep.droppedConns.length;
  if(rep.droppedBlocks)s+=' · ✂ '+tTask({ru:'пропущено некорректных блоков',en:'invalid blocks skipped'})+': '+rep.droppedBlocks;
  if(rep.droppedConns.length||rep.unknown.length||rep.droppedBlocks)console.warn('[import]',rep);
  return s;
}

$('fi').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{try{
    const d=JSON.parse(ev.target.result);
    importProjectData(d,'file');
  }catch(err){toast('❌ Import error: '+err.message);}};
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
  else if(ctrl&&e.key==='l'&&S.notationMode!=='bpmn'){e.preventDefault();if(typeof autoLayout==='function')autoLayout();}
  else if(ctrl&&e.key==='d'&&S.selected&&S.notationMode!=='bpmn'){
    e.preventDefault();
    const _b=gb(S.selected);
    if(_b){S.blocks.push({...JSON.parse(JSON.stringify(_b)),id:'b'+(S.nid++),x:_b.x+40,y:_b.y+40});pushHist();analyze();}
  }
  else if(ctrl&&e.key==='d'&&S.notationMode==='bpmn'&&(S.selected||(S.bpmnMulti||[]).length)){e.preventDefault();if(typeof bpmnDuplicateSelection==='function')bpmnDuplicateSelection();}
  else if((e.key==='Delete'||e.key==='Backspace')&&(S.selected||(S.bpmnMulti||[]).length)&&S.notationMode==='bpmn'){e.preventDefault();if(typeof bpmnDeleteSelected==='function')bpmnDeleteSelected();}
  else if((e.key==='Delete'||e.key==='Backspace')&&S.selected){e.preventDefault();delBlock(S.selected);}
  else if(e.key==='Escape'){
    if(S.mode==='connecting'){S.mode='idle';S.connFrom=null;render();}
    if(S.mode==='bpmn-connecting'){S.mode='idle';S.bpmnConnFrom=null;render();}
    S.palSel=null;S.bpmnPalSel=null;S.bpmnMulti=[];buildPalette();hideCtx();
    ['set-modal','dot-modal','advice','seq-modal'].forEach(id=>{const el=$(id);if(el)el.style.display='none';});
    if(S.notationMode!=='bpmn'){
      // Esc на C3/C4 — на уровень выше (C4 → C3 → C2)
      const _zl=typeof zsLevel==='function'?zsLevel():2;
      if(S.view!=='c4_level'&&_zl>=3)zsGo(_zl-1);else setC4Level(null);
    }
  }
  else if(e.key==='?'){showHotkeysHint();}
  // C1…C4 — семантический зум (c4-zoom.js)
  else if(!ctrl&&!e.altKey&&/^[1-4]$/.test(e.key)&&S.notationMode!=='bpmn'&&S.mode!=='routing'&&typeof zsGo==='function'){e.preventDefault();zsGo(+e.key);}
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
      ['1 / 2 / 3 / 4',t('hotkey_zs')],
      [t('hotkey_wheel_k'),t('hotkey_wheel')],
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
  // ВАЖНО: bpmn и notationMode тоже в автосейв — иначе BPMN-диаграммы теряются при перезапуске
  try{localStorage.setItem('arch4_auto',JSON.stringify({blocks:S.blocks.map(b=>({...b})),conns:S.conns,scenarios:S.scenarios||[],nid:S.nid,notationMode:S.notationMode||'c4',bpmn:S.bpmn||{diagrams:[],currentDiagramId:null},meta:S.meta||defaultMeta()}));}catch{}
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
if(typeof zsInit==='function')zsInit();
// Добавить маркеры двунаправленных стрелок в SVG defs
if(typeof ensureBiMarkers==='function') ensureBiMarkers();
pushHist();
analyze();

// Восстановить автосейв
// Битый автосейв (обрыв записи, ручная правка, несовместимая версия) не должен ронять
// приложение: сырые данные уходят в arch4_auto_broken, старт с пустого проекта + тост.
(function restoreAutosave(){
  const raw=localStorage.getItem('arch4_auto');if(!raw)return;
  try{
    const _a=JSON.parse(raw);
    if(!(_a?.blocks?.length||_a?.bpmn?.diagrams?.length))return;
    const rep=importProjectData(_a,'autosave',{keepNid:true,quiet:true});
    toast(tTask({ru:'⏱ Восстановлен',en:'⏱ Restored'})+(rep.droppedConns.length||rep.unknown.length?' · '+importReportText(rep):''));
  }catch(e){
    console.warn('[autosave] не удалось восстановить',e);
    try{localStorage.setItem('arch4_auto_broken',raw);}catch(_){}
    localStorage.removeItem('arch4_auto');
    S.blocks=[];S.conns=[];S.scenarios=[];S.bpmn={diagrams:[],currentDiagramId:null};S.meta=defaultMeta();S.notationMode='c4';S.selected=null;
    S.nid=1000;HIST=[];HI=-1;pushHist();
    try{analyze();render();}catch(_){}
    toast(tTask({ru:'⚠ Автосейв повреждён — начат пустой проект. Копия сохранена в localStorage «arch4_auto_broken»',en:'⚠ Autosave is corrupted — started an empty project. A copy is kept in localStorage "arch4_auto_broken"'}),6000);
  }
})();
