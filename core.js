// CORE — глобальное состояние S, базовые хелперы (gb, gc, $), analyze()
// (выделено из app.js при разбиении на модули)

// ═══════════════════════════════════════════════════════════════
// СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════
const BW=120,BH=48,NS='http://www.w3.org/2000/svg';
// ширина/высота блока: ручной размер (b.w/b.h) → иначе авто-подбор под длину имени
function blockLabel(b){return b.customLabel||EL[b.type]?.lbl||'';}
function bw(b){if(!b)return BW;if(b.w)return b.w;const lbl=blockLabel(b);return Math.max(BW,Math.min(360,Math.round(lbl.length*7.2+34)));}
function bh(b){return b&&b.h?b.h:BH;}

let S={blocks:[],conns:[],scenarios:[],load:1,loadMode:'sandbox',palSel:null,selected:null,hovered:null,hovConn:null,
  inspConn:null,panX:0,panY:0,mode:'idle',dragId:null,dragOx:0,dragOy:0,
  connFrom:null,tempX:0,tempY:0,panOx:0,panOy:0,nid:1,
  meta:defaultMeta()};
let HIST=[],HI=-1,SPEED_MUL=1;

// ═══════════════════════════════════════════════════════════════
// МЕТАДАННЫЕ ПРОЕКТА (для титула и описания в документе MS-1)
// ═══════════════════════════════════════════════════════════════
function defaultMeta(){
  return {
    systemName:'Платформа менторства',
    version:'v1',
    author:'',
    description:'Система для поиска менторов и прохождения курсов.',
    userRoles:[
      {name:'Студент', can:['Просматривать список менторов','Записываться на обучение','Оплачивать курс','Отслеживать прогресс']},
      {name:'Ментор',  can:['Подтверждать заявки на курс','Создавать и редактировать курсы','Отслеживать прогресс студентов']},
      {name:'Администратор', can:['Редактировать роли пользователей','Блокировать пользователей']},
    ],
    requirements:[
      {text:'Один ментор может работать в разных направлениях', card:'1:M'},
      {text:'За одним студентом закреплён один ментор', card:'M:1'},
    ],
  };
}
function ensureMeta(){ if(!S.meta) S.meta=defaultMeta(); return S.meta; }

// ═══════════════════════════════════════════════════════════════
// ХЕЛПЕРЫ МОДЕЛИ БД И МЕТОДОВ (Фаза 0)
// ═══════════════════════════════════════════════════════════════
// Ограничения поля строкой: из нового f.constraints или из старых флагов pk/fk/notNull/unique
function fieldConstraints(f){
  if(f.constraints) return f.constraints;
  const parts=[];
  if(f.pk===true) parts.push('PK');
  if(f.pk==='clustering') parts.push('CK');
  if(f.fk) parts.push('FK');
  if(f.notNull) parts.push('NN');
  if(f.unique) parts.push('UNIQUE');
  return parts.join(', ')||'';
}
function fieldLabel(f){ return f.label||f.name; }
function fieldDesc(f){ return f.desc||''; }
function fieldExample(f){ return f.example||''; }

// Таблицы схемы блока (универсально: tables / collections)
function schemaTables(b){
  const sc=blockSchema(b); if(!sc) return [];
  return sc.tables||sc.collections||[];
}
// Схема блока: привязанный шаблон DB_TEMPLATES или собственная dbSchema
function blockSchema(b){
  if(!b) return null;
  if(b.dbTemplate && typeof DB_TEMPLATES!=='undefined'){
    const t=DB_TEMPLATES.find(x=>x.id===b.dbTemplate);
    if(t) return t.schema;
  }
  return b.dbSchema||null;
}
// Какому сервису принадлежит БД-блок: сервис, из которого идёт связь в эту БД
function ownerServiceOf(dbBlock){
  if(!dbBlock) return null;
  if(dbBlock.ownerService){const s=gb(dbBlock.ownerService);if(s)return s;}
  const inc=S.conns.find(c=>c.to===dbBlock.id && BASE[gb(c.from)?.type]?.cat==='svc');
  return inc?gb(inc.from):null;
}
// Все БД-блоки, принадлежащие сервису
function serviceDatabases(serviceId){
  return S.conns.filter(c=>c.from===serviceId)
    .map(c=>gb(c.to))
    .filter(b=>b && ['db','cache'].includes(BASE[b.type]?.cat));
}
// Все сервисы (cat svc) на схеме
function allServices(){ return S.blocks.filter(b=>BASE[b.type]?.cat==='svc'); }
// Эндпоинты сервиса для документа = шаги сценариев, чей шаг ведёт В этот сервис.
// (API живёт на шаге сценария, не на связи.)
function serviceEndpoints(serviceId){
  const out=[];const seen=new Set();
  (S.scenarios||[]).forEach(s=>{
    const steps=s.steps||[];
    for(let i=0;i<(s.path||[]).length-1;i++){
      if(s.path[i+1]!==serviceId) continue;
      const st=steps[i]||{};
      if(!(st.uri||st.name)) continue;
      const key=(st.verb||'GET')+' '+(st.uri||st.name);
      if(seen.has(key)) continue; seen.add(key);
      out.push({verb:st.verb||'GET',uri:st.uri||'',desc:st.name||'',name:st.name||'',
        success:st.resp||'',resp:st.resp||'',params:st.params||[],codes:st.codes||[],scenario:s.name});
    }
  });
  return out;
}

const $=id=>document.getElementById(id);
const gb=id=>S.blocks.find(b=>b.id===id);
const gc=id=>S.conns.find(c=>c.id===id);
const fmt=n=>!isFinite(n)?'∞':n>=1e6?(n/1e6).toFixed(n%1e6===0?0:1)+'М':n>=1e3?(n/1e3|0)+'К':String(Math.round(n));
const svgRct=()=>$('canvas').getBoundingClientRect();
function svgPt(e){const r=svgRct();return{x:e.clientX-r.left-S.panX,y:e.clientY-r.top-S.panY};}
function blockAt(pt){return S.blocks.find(b=>pt.x>=b.x&&pt.x<=b.x+bw(b)&&pt.y>=b.y&&pt.y<=b.y+bh(b));}

let _tt=null;
function toast(t,d=2200){const e=$('toast');e.textContent=t;e.classList.add('show');clearTimeout(_tt);_tt=setTimeout(()=>e.classList.remove('show'),d);}

// ИСТОРИЯ
function pushHist(){const s=JSON.stringify({blocks:S.blocks,conns:S.conns,scenarios:S.scenarios||[],nid:S.nid});if(HIST[HI]===s)return;HIST=HIST.slice(0,HI+1);HIST.push(s);if(HIST.length>80)HIST.shift();HI=HIST.length-1;}
function undo(){if(HI<=0)return;HI--;const d=JSON.parse(HIST[HI]);S.blocks=d.blocks;S.conns=d.conns;S.scenarios=d.scenarios||[];S.nid=d.nid;S.selected=null;analyze();if(typeof renderRoutesPanel==='function')renderRoutesPanel();toast('↶');}
function redo(){if(HI>=HIST.length-1)return;HI++;const d=JSON.parse(HIST[HI]);S.blocks=d.blocks;S.conns=d.conns;S.scenarios=d.scenarios||[];S.nid=d.nid;S.selected=null;analyze();if(typeof renderRoutesPanel==='function')renderRoutesPanel();toast('↷');}

// ═══════════════════════════════════════════════════════════════
// АНАЛИЗ через движок
// ═══════════════════════════════════════════════════════════════
// эффективная нагрузка: в DevOps-режиме умножается на множитель спайка
function effLoad(){return Math.round(S.load*(CHAOS.active?CHAOS.loadMul:1));}
function analyze(){
  if(S.loadMode==='realism')computeFlowScenarios(S.blocks,S.conns,S.scenarios);
  else computeFlow(S.blocks,S.conns,effLoad());
  // совет по неправильным связям
  S.connWarn={};
  S.conns.forEach(c=>{
    const f=gb(c.from),t=gb(c.to);if(!f||!t)return;
    const r=badConn(EL[f.type],EL[t.type]);
    if(r)S.connWarn[c.id]=r;
  });
  render();updateSidebar();updateStatus();
}
function badConn(fd,td){
  if(fd.cat==='client'&&(td.cat==='db'||td.cat==='cache'))return{sev:'error',msg:'Клиент не должен лезть в БД напрямую'};
  if(fd.cat==='gw'&&td.cat==='db')return{sev:'error',msg:'Gateway не пишет в БД — нужен сервис'};
  if(fd.cat==='broker'&&td.cat==='db')return{sev:'warn',msg:'Между брокером и БД нужен consumer-сервис'};
  if(fd.cat==='db'&&td.cat==='broker')return{sev:'warn',msg:'БД не публикует события сама (нужен Debezium/Outbox)'};
  if(fd.cat==='net'&&td.cat==='broker')return{sev:'info',msg:'LB перед брокером не нужен — у Kafka своя балансировка'};
  if(fd.cat==='broker'&&td.cat==='net')return{sev:'info',msg:'LB после брокера избыточен — Kafka балансирует через consumer groups'};
  if(fd.cat==='client'&&td.cat==='svc')return{sev:'warn',msg:'Без Gateway сервис открыт всем — нет авторизации'};
  return null;
}
const hClr=h=>h==='error'?'#f7768e':h==='warn'?'#e0af68':null;

