// METHODS — API-методы на линии (единый источник) + инспектор связи
// (выделено из app.js при разбиении на модули)

// ═══════════════════════════════════════════════════════════════
// МЕТОДЫ API — метод живёт НА ЛИНИИ (c.method): задаёшь его на связи.
// Сервис = агрегат методов со всех входящих линий (итоговая API-таблица для Word).
// Подпись стрелки, UML и таблица Word берут текст отсюда.
// ═══════════════════════════════════════════════════════════════
const VERBS=['GET','POST','PUT','PATCH','DELETE'];
const VERB_CLR={GET:'#2a7014',POST:'#1e4a90',PUT:'#8a5e08',PATCH:'#5a2898',DELETE:'#9a1420',PUBLISH:'#a03c10',CONSUME:'#0e6858',EVENT:'#a03c10',SQL:'#384a88'};
function methodHost(type){return ['svc','bff','gw','external'].includes(EL[type]?.cat);}
function fmtMethod(m){return m?((m.verb||'GET')+' '+(m.uri||'')).trim():'';}
function connApi(c){return c&&c.method?fmtMethod(c.method):'';}
// осмысленный ответ метода (200 Создана · 400 ошибка · 409 уже есть) — для обратного пути
function connResp(c){return c&&c.method&&c.method.resp?c.method.resp:'';}
// все методы сервиса = методы входящих в него линий (для итоговой таблицы)
function serviceMethods(serviceId){return S.conns.filter(c=>c.to===serviceId&&c.method&&(c.method.uri||c.method.name)).map(c=>({m:c.method,from:gb(c.from)}));}

let _methId=null;
// модалка сервиса = ИТОГОВАЯ ТАБЛИЦА (только просмотр). Методы задаются на линиях.
function openMethods(id){
  const b=gb(id);if(!b)return;
  if(!methodHost(b.type)){toast('Методы API задаются у сервисов / Gateway / внешних систем');return;}
  _methId=id;
  const d=EL[b.type];
  $('meth-title').textContent='📡 API «'+(b.customLabel||d.lbl)+'» — итоговая таблица';
  $('meth-sub').textContent='Методы задаются НА ЛИНИЯХ (клик по входящей стрелке). Здесь — что накопилось у сервиса со всех линий (для документа Word).';
  const addBtn=document.querySelector('#meth-modal [onclick="addMethod()"]');if(addBtn)addBtn.style.display='none';
  renderMethods();$('meth-modal').style.display='flex';
}
function renderMethods(){
  const box=$('meth-list');box.innerHTML='';
  const list=serviceMethods(_methId);
  if(!list.length){box.innerHTML='<div style="color:var(--txt2);font-size:11.5px;padding:6px 0;line-height:1.6">У сервиса пока нет методов.<br>Кликни на <b>входящую линию</b> (стрелку, ведущую к этому сервису) и впиши метод прямо там.</div>';return;}
  list.forEach(({m,from})=>{
    const row=document.createElement('div');row.style.cssText='border:1px solid #2a2b3d;border-radius:7px;padding:8px;margin-bottom:7px';
    row.innerHTML=`<div style="display:flex;gap:8px;align-items:baseline">
        <span style="color:${VERB_CLR[m.verb]||'#c0caf5'};font-weight:700;font-size:12px;min-width:54px">${m.verb||'GET'}</span>
        <span style="color:var(--blue);font-size:12px">${escHtml(m.uri||'')}</span>
        <span style="color:var(--txt2);font-size:9.5px;margin-left:auto">← ${escHtml(from?.customLabel||EL[from?.type]?.lbl||'?')}</span>
      </div>
      ${m.name?`<div style="color:var(--txt);font-size:11px;margin-top:3px">${escHtml(m.name)}</div>`:''}
      ${m.resp?`<div style="color:var(--green);font-size:10.5px;margin-top:2px">↩ ${escHtml(m.resp)}</div>`:''}`;
    box.appendChild(row);
  });
}
function addMethod(){toast('Метод задаётся на линии — кликни входящую стрелку к сервису и впиши его там');}
function closeMethods(){$('meth-modal').style.display='none';_methId=null;render();}
// авторинг метода ПРЯМО НА ЛИНИИ: метод хранится на самой связи (c.method).
// без перерисовки инспектора (чтобы не терять фокус ввода).
function authorConnMethod(cid,field,val){
  const c=gc(cid);if(!c)return;const t=gb(c.to);if(!t)return;
  if(!methodHost(t.type)){toast('Метод задаётся у сервиса / Gateway / внешней системы');return;}
  if(!c.method)c.method={verb:'GET',uri:'',name:'',resp:''};
  c.method[field]=val;renderConns();pushHist();
}

// ═══════════════════════════════════════════════════════════════
// РЕДАКТОР ПАРАМЕТРОВ И СТАТУС-КОДОВ МЕТОДА (для таблиц «Входные данные» в Word)
// ═══════════════════════════════════════════════════════════════
let _paramCid=null;
function openParamsEditor(cid){
  const c=gc(cid);if(!c)return;
  if(!c.method)c.method={verb:'GET',uri:'',name:'',resp:''};
  if(!c.method.params)c.method.params=[];
  if(!c.method.codes)c.method.codes=[];
  _paramCid=cid;
  let ov=$('params-modal');
  if(!ov){ov=document.createElement('div');ov.id='params-modal';ov.className='modal-ov';
    ov.onclick=e=>{if(e.target===ov)closeParamsEditor();};document.body.appendChild(ov);}
  ov.style.display='flex';renderParamsEditor();
}
function closeParamsEditor(){const ov=$('params-modal');if(ov)ov.style.display='none';_paramCid=null;pushHist();renderConns();}
function renderParamsEditor(){
  const c=gc(_paramCid);if(!c)return;const m=c.method;const ov=$('params-modal');if(!ov)return;
  const inp='background:#1a1b26;border:1px solid #3d3f52;border-radius:4px;padding:4px 6px;font-size:11px;color:#c0caf5;outline:none;font-family:inherit;width:100%';
  ov.innerHTML=`<div class="modal-box" style="max-width:720px;width:97%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h2 style="color:#7aa2f7">📝 ${m.verb||'GET'} ${escHtml(m.uri||'')}</h2>
      <button class="modal-btn" onclick="closeParamsEditor()">✕</button>
    </div>
    <div style="margin-bottom:10px"><label style="font-size:10px;color:#787c99">Описание метода</label>
      <input style="${inp}" value="${escHtml(m.desc||'')}" placeholder="метод для регистрации пользователей" oninput="gc('${_paramCid}').method.desc=this.value"></div>

    <div style="font-size:12px;font-weight:700;color:#9ece6a;margin:8px 0 6px">Входные данные (параметры)</div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <thead><tr style="color:#787c99;text-align:left">
        <th style="padding:3px">Параметр</th><th style="padding:3px">Наименование</th><th style="padding:3px">Тип</th>
        <th style="padding:3px">Обяз.</th><th style="padding:3px">Описание</th><th style="padding:3px">Где</th><th></th>
      </tr></thead><tbody>
      ${(m.params||[]).map((p,i)=>`<tr>
        <td style="padding:2px"><input style="${inp}" value="${escHtml(p.name||'')}" oninput="gc('${_paramCid}').method.params[${i}].name=this.value"></td>
        <td style="padding:2px"><input style="${inp}" value="${escHtml(p.label||'')}" oninput="gc('${_paramCid}').method.params[${i}].label=this.value"></td>
        <td style="padding:2px"><input style="${inp};width:70px" value="${escHtml(p.type||'string')}" oninput="gc('${_paramCid}').method.params[${i}].type=this.value"></td>
        <td style="padding:2px"><select style="${inp};width:56px" onchange="gc('${_paramCid}').method.params[${i}].required=this.value==='да'"><option ${p.required?'selected':''}>да</option><option ${!p.required?'selected':''}>нет</option></select></td>
        <td style="padding:2px"><input style="${inp}" value="${escHtml(p.desc||'')}" oninput="gc('${_paramCid}').method.params[${i}].desc=this.value"></td>
        <td style="padding:2px"><select style="${inp};width:72px" onchange="gc('${_paramCid}').method.params[${i}].in=this.value">${['body','headers','query','path'].map(o=>`<option ${p.in===o?'selected':''}>${o}</option>`).join('')}</select></td>
        <td style="padding:2px"><span onclick="gc('${_paramCid}').method.params.splice(${i},1);renderParamsEditor()" style="cursor:pointer;color:#f7768e">✕</span></td>
      </tr>`).join('')}
      </tbody></table>
    <button class="btn" onclick="gc('${_paramCid}').method.params.push({name:'',label:'',type:'string',required:true,desc:'',in:'body'});renderParamsEditor()" style="margin-top:6px">＋ Параметр</button>

    <div style="font-size:12px;font-weight:700;color:#e0af68;margin:12px 0 6px">Выходные данные / статус-коды</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <label style="font-size:10px;color:#787c99">Успех:</label>
      <input style="${inp};max-width:200px" value="${escHtml(m.success||m.resp||'200 OK')}" placeholder="201 Created" oninput="gc('${_paramCid}').method.success=this.value">
    </div>
    <div id="codes-list">${(m.codes||[]).map((code,i)=>`<div style="display:flex;gap:6px;margin-bottom:4px">
      <input style="${inp}" value="${escHtml(code)}" oninput="gc('${_paramCid}').method.codes[${i}]=this.value">
      <span onclick="gc('${_paramCid}').method.codes.splice(${i},1);renderParamsEditor()" style="cursor:pointer;color:#f7768e;align-self:center">✕</span>
    </div>`).join('')}</div>
    <button class="btn" onclick="gc('${_paramCid}').method.codes.push('400 Bad Request');renderParamsEditor()">＋ Статус-код</button>

    <div style="margin-top:14px"><button class="modal-btn primary" onclick="closeParamsEditor()">Готово</button></div>
  </div>`;
}

// КОНТЕКСТ
let _ctxId=null;
function showCtx(e,id){
  _ctxId=id;const m=$('ctx');m.style.display='block';m.style.left=e.clientX+'px';m.style.top=e.clientY+'px';
  const b=gb(id);
  const isPG=b&&b.type==='postgresql';
  const isDB=b&&['db','cache'].includes(EL[b.type]?.cat);
  const dbItem=$('ctx-dbedit');if(dbItem)dbItem.style.display=isPG?'block':'none';
  const dataItem=$('ctx-data');if(dataItem)dataItem.style.display=isDB?'block':'none';
}
function hideCtx(){$('ctx').style.display='none';}
function ctxAct(a){const id=_ctxId;hideCtx();if(!id)return;
  if(a==='rename')startRename(id);
  else if(a==='settings'){const b=gb(id);if(b&&['kafka','rabbitmq','nats','queue'].includes(b.type))openBrokerInspector(id);else openSettings(id);}
  else if(a==='dbedit'&&typeof openDBEditor==='function')openDBEditor(id);
  else if(a==='data'&&typeof openDataEditor==='function')openDataEditor(id);
  else if(a==='dup'){const b=gb(id);if(b)S.blocks.push({...JSON.parse(JSON.stringify(b)),id:'b'+(S.nid++),x:b.x+30,y:b.y+30});pushHist();analyze();}
  else if(a==='del')delBlock(id);
}
document.addEventListener('click',e=>{if(!$('ctx').contains(e.target))hideCtx();});

// ═══════════════════════════════════════════════════════════════
// ИНСПЕКЦИЯ СТРЕЛКИ — подробно "что несёт, кто кого зовёт, куда дальше"
// ═══════════════════════════════════════════════════════════════
function onConnClick(cid){
  S.inspConn=cid;const c=gc(cid);if(!c)return;
  if(SIM.running&&!SIM.paused)pauseSim();
  const f=gb(c.from),t=gb(c.to);const fd=EL[f?.type],td=EL[t?.type];
  const async=isAsync(c);
  const flow=goodFlow(fd,td)||{t:fd.lbl+' → '+td.lbl,f:''};
  const warn=S.connWarn?.[cid];
  // нагрузка на этой связи
  const rt=t?.rt||{};
  $('insp-title').textContent=`${f?.customLabel||fd?.lbl} → ${t?.customLabel||td?.lbl}`;
  $('insp-badges').innerHTML=
    `<span class="badge ${async?'async':'sync'}">${async?'⇢ Асинхронно':'→ Синхронно'}</span>`+
    (rt.health?`<span class="badge ${rt.health}">${rt.health==='error'?'Перегрузка':rt.health==='warn'?'Под давлением':'OK'}</span>`:'')+
    (warn?`<span class="badge ${warn.sev}">⚠ ${warn.sev}</span>`:'');
  // живые шарики и треугольники на этой связи
  const allOnLine=Object.values(SIM.reqs).filter(r=>r.connId===cid);
  const dots=allOnLine.filter(r=>!r.isResponse);
  const respDots=allOnLine.filter(r=>r.isResponse);
  const ok=dots.filter(d=>d.color==='#7aa2f7').length,sl=dots.filter(d=>d.color==='#e0af68').length,er=dots.filter(d=>d.color==='#f7768e').length;
  const rok=respDots.filter(d=>d.color==='#7aa2f7').length,rsl=respDots.filter(d=>d.color==='#e0af68').length;
  // куда дальше после t
  const nexts=S.conns.filter(x=>x.from===t?.id).map(x=>gb(x.to)).filter(Boolean);
  const nextTxt=nexts.length?nexts.map(n=>n.customLabel||EL[n.type].lbl).join(', '):(['db','cache','queue','broker'].includes(td?.cat)?'конечная точка (хранилище)':'⚠ тупик — некуда идти');
  const story=(f&&t)?hopNarrative(f,t,fd,td,async):null;
  $('insp-body').innerHTML=`
    <div class="ib-sec"><div class="ib-t">Что несёт связь</div><div class="ib-v">${flow.f||'Передача запроса от '+fd.lbl+' к '+td.lbl}</div></div>
    ${story?`<div class="ib-sec"><div class="ib-t">Что происходит по шагам</div><div class="ib-v" style="line-height:1.7">${story.steps.map((s,i)=>`<div style="margin-bottom:3px"><span style="color:#7aa2f7;font-weight:700">${i+1}.</span> ${s}</div>`).join('')}</div></div>
    <div class="ib-sec"><div class="ib-t">Что вернётся обратно</div><div class="ib-v" style="line-height:1.6;color:${async?'#bb9af7':'#9ece6a'}">${story.back}</div></div>`:''}
    <div class="ib-grid">
      <div><div class="ib-t">Кто кого зовёт</div><div class="ib-v">${f?.customLabel||fd?.lbl} спрашивает ${t?.customLabel||td?.lbl}</div></div>
      <div><div class="ib-t">Тип</div><div class="ib-v">${async?'Асинхронно — отправитель не ждёт':'Синхронно — отправитель ждёт ответа'}</div></div>
    </div>
    <div class="ib-grid">
      <div><div class="ib-t">Нагрузка на ${t?.customLabel||td?.lbl}</div><div class="ib-v" style="color:${hClr(rt.health)||'#9ece6a'}">${rt.lambdaIn?fmt(rt.lambdaIn)+' rps · '+Math.round(rt.rho*100)+'%':'—'}</div></div>
      <div><div class="ib-t">Задержка узла</div><div class="ib-v">${rt.effLat?rt.effLat.toFixed(1)+' мс':'—'}</div></div>
    </div>
    <div class="ib-sec"><div class="ib-t">Куда пойдёт дальше</div><div class="ib-v">→ ${nextTxt}</div></div>
    ${SIM.running?`<div class="ib-sec"><div class="ib-t">На линии сейчас</div><div class="ib-v">${dots.length||respDots.length?
      `${dots.length?`🔵 Запросы: ${ok?'<span style="color:#7aa2f7">●'+ok+' ок</span> ':''}${sl?'<span style="color:#e0af68">●'+sl+' медл.</span> ':''}${er?'<span style="color:#f7768e">●'+er+' ошиб.</span>':''}`:''}`+
      `${respDots.length?`${dots.length?'<br>':''}▶ Ответы: ${rok?'<span style="color:#7aa2f7">▶'+rok+' ок</span> ':''}${rsl?'<span style="color:#e0af68">▶'+rsl+' медл.</span>':''}`:''}`
      :'нет активных'}</div></div>`:''}
    <div class="ib-sec" style="background:#7aa2f714;border-radius:6px;padding:8px 10px">
      <div class="ib-t" style="color:#7aa2f7">📝 API-метод — на шаге сценария</div>
      <div class="ib-v" style="font-size:10.5px;line-height:1.5;color:#9aa5ce">Связь — это только структура (кто с кем соединён). Метод (verb/URI/бизнес-смысл) задаётся на <b>шаге сценария</b>: вкладка «Методы» → у сценария кнопка <b style="color:#9ece6a">📝</b>. Оттуда строится UML.</div>
    </div>
    ${warn?`<div class="ib-warn">${warn.msg}</div>`:''}
    <button onclick="deleteConn('${cid}')" style="margin-top:10px;width:100%;padding:7px;border:1px solid #f7768e66;border-radius:6px;background:#f7768e18;color:#f7768e;cursor:pointer;font-size:11.5px;font-weight:600">✕ Удалить связь</button>
  `;
  $('inspection').classList.add('show');render();
}
// правка подписи связи без перерисовки инспектора (чтобы не терять фокус)
function deleteConn(cid){S.conns=S.conns.filter(x=>x.id!==cid);pushHist();analyze();closeInsp();}
function setConnField(cid,field,val){const c=gc(cid);if(!c)return;if(val)c[field]=val;else delete c[field];renderConns();}
function setConnDir(cid,dir){const c=gc(cid);if(!c)return;c.dir=(c.dir===dir?'':dir);renderConns();onConnClick(cid);}
function closeInsp(){$('inspection').classList.remove('show');S.inspConn=null;render();}

