// ═══════════════════════════════════════════════════════════════
// DB-VIZ — топология и модель хранения для КАЖДОГО типа БД
//   relational (PostgreSQL/MySQL): primary/replicas/pool + ER с индексами
//   Redis: слоты кластера, мастера/реплики, keyspace по структурам, TTL, eviction
//   Elasticsearch: шарды/реплики по нодам, mapping, инвертированный индекс
//   ClickHouse: шарды×реплики, колонки-полосы, партиции, парты, гранулы
//   MongoDB: mongos/config/shards, дерево документа, shard key
//   Cassandra: token ring + RF/CL, partition/clustering key, write path
//   S3: регион/бакет/AZ, префиксы, версии, lifecycle
// Цвета только в db-viz.css (классы .dbv-*), здесь — ни одного цвета.
// ═══════════════════════════════════════════════════════════════

const DBV_META={
  postgresql:{fam:'rel',icon:'🐘',model:{ru:'Реляционная · строки в heap-страницах 8 КБ, B-tree индексы, WAL',en:'Relational · rows in 8 KB heap pages, B-tree indexes, WAL'}},
  mysql:{fam:'rel',icon:'🐬',model:{ru:'Реляционная · InnoDB: строки лежат в кластерном индексе по PK, redo log + binlog',en:'Relational · InnoDB: rows live in the clustered PK index, redo log + binlog'}},
  redis:{fam:'kv',icon:'⚡',model:{ru:'Key-value в RAM · у каждого ключа своя структура данных, TTL и вытеснение',en:'In-memory key-value · each key has its own data structure, TTL and eviction'}},
  mongodb:{fam:'doc',icon:'🍃',model:{ru:'Документная · BSON-документы с вложенностью, коллекции без жёсткой схемы',en:'Document · nested BSON documents, schema-less collections'}},
  cassandra:{fam:'wide',icon:'👁',model:{ru:'Wide-column · partition key → нода на кольце, clustering key сортирует строки внутри партиции',en:'Wide-column · partition key → ring node, clustering key sorts rows inside a partition'}},
  clickhouse:{fam:'col',icon:'🟨',model:{ru:'Колоночная · каждая колонка — отдельный файл, MergeTree-парты, разреженный индекс по гранулам',en:'Columnar · each column is a separate file, MergeTree parts, sparse granule index'}},
  elasticsearch:{fam:'search',icon:'🔍',model:{ru:'Поисковая · инвертированный индекс Lucene, индекс = набор шардов',en:'Search · Lucene inverted index, an index is a set of shards'}},
  s3:{fam:'obj',icon:'🪣',model:{ru:'Объектная · плоское пространство ключей в бакете, «папки» = префиксы',en:'Object · flat keyspace in a bucket, "folders" are prefixes'}},
};
const DBV={id:null,tab:'topo',pick:0};
const dbvL=(ru,en)=>tTask({ru,en:en||ru});
const dbvE=s=>escHtml(String(s??''));
function dbvIsDB(b){return !!(b&&DBV_META[b.type]);}
// значение настройки: из блока, иначе дефолт из SETTINGS_DEF (старые проекты без ключей)
function dbvS(b,k){
  const v=b.settings?.[k];
  if(v!==undefined&&v!==null&&v!=='')return v;
  const d=(SETTINGS_DEF[b.type]||[]).find(x=>x.k===k);
  return d?d.def:undefined;
}
function dbvNum(b,k,def,min,max){let v=+dbvS(b,k);if(!isFinite(v))v=def;return Math.max(min,Math.min(max,v));}
function dbvName(x){return x?.customLabel||EL[x?.type]?.lbl||x?.type||'?';}
function dbvClients(b){return S.conns.filter(c=>c.to===b.id).map(c=>gb(c.from)).filter(Boolean);}
function dbvHealth(b){const h=b.rt?.health;return h==='error'?' is-error':h==='warn'?' is-warn':'';}
function dbvHash(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
// CRC16/XMODEM — именно им Redis Cluster считает слот (с учётом {hash tag})
function dbvCrc16(str){
  let crc=0;
  for(let i=0;i<str.length;i++){
    crc^=(str.charCodeAt(i)&0xff)<<8;
    for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;
  }
  return crc;
}
function dbvRedisSlot(key){
  const s=key.indexOf('{');
  if(s>=0){const e=key.indexOf('}',s+1);if(e>s+1)key=key.slice(s+1,e);}
  return dbvCrc16(key)%16384;
}
// правдоподобные примерные значения по имени/типу поля
function dbvSample(name,type,i){
  const n=String(name||'').toLowerCase(),t=String(type||'').toLowerCase();
  if(/date|day/.test(n)&&!/time/.test(n)||t==='date')return '2026-11-0'+(1+i%9);
  if(/time|_at$|ts$|bucket/.test(n)||/timestamp|datetime|timeuuid/.test(t))return '2026-11-04 1'+(i%10)+':0'+(i%10);
  if(/uuid/.test(t)||/trace/.test(n))return ['7f3a…','c91e…','04bd…','e5a2…'][i%4];
  if(/_id$/.test(n)||n==='id')return String(1001+i*17);
  if(/user/.test(n))return 'u'+(42+i);
  if(/email/.test(n))return ['ann','bob','eva','max'][i%4]+'@mail.ru';
  if(/price|amount|total|value|score|points/.test(n)||/decimal|float|double|numeric/.test(t))return (19.9+i*7.5).toFixed(1);
  if(/int|number|count|uint/.test(t)||/qty|stock|count|level/.test(n))return String(3+i*4);
  if(/bool/.test(t))return i%2?'false':'true';
  if(/status|state/.test(n))return ['new','paid','shipped','done'][i%4];
  if(/type|level|kind|category/.test(n))return ['click','view','order','error'][i%4];
  if(/name|title/.test(n))return ['alpha','beta','gamma','delta'][i%4];
  return ['a1','b2','c3','d4'][i%4];
}

// ── мини-построитель SVG (только классы, без цветов) ─────────
function dbvSvg(){
  const p=[];let W=0,H=0;
  const ext=(x,y)=>{if(x>W)W=x;if(y>H)H=y;};
  const o={
    r(x,y,w,h,cls,rx){ext(x+w,y+h);p.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx??3}" class="${cls||'dbv-box'}"/>`);return o;},
    t(x,y,s,cls,anc,maxCh){let txt=String(s??'');if(maxCh&&txt.length>maxCh)txt=txt.slice(0,Math.max(1,maxCh-1))+'…';
      const tw=txt.length*6.2;ext(anc==='middle'?x+tw/2:anc==='end'?x:x+tw,y+4);
      p.push(`<text x="${x}" y="${y}" class="${cls||'dbv-t'}"${anc?` text-anchor="${anc}"`:''}>${dbvE(txt)}</text>`);return o;},
    l(x1,y1,x2,y2,cls){ext(Math.max(x1,x2),Math.max(y1,y2));p.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls||'dbv-ln'}"/>`);return o;},
    // прямоугольник ПОД уже нарисованным (фон группы, высота известна после отрисовки)
    rb(x,y,w,h,cls,rx){ext(x+w,y+h);p.unshift(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx??4}" class="${cls||'dbv-group'}"/>`);return o;},
    path(d,cls){p.push(`<path d="${d}" class="${cls||'dbv-ln'}"/>`);return o;},
    c(cx,cy,r,cls){ext(cx+r,cy+r);p.push(`<circle cx="${cx}" cy="${cy}" r="${r}" class="${cls||'dbv-box'}"/>`);return o;},
    a(x1,y1,x2,y2,cls){
      const ang=Math.atan2(y2-y1,x2-x1),hl=7;
      const bx=x2-hl*Math.cos(ang),by=y2-hl*Math.sin(ang);
      o.l(x1,y1,bx,by,'dbv-ln '+(cls||''));
      const px=Math.sin(ang)*3.5,py=-Math.cos(ang)*3.5;
      p.push(`<polygon points="${x2},${y2} ${bx+px},${by+py} ${bx-px},${by-py}" class="dbv-ah ${cls||''}"/>`);return o;
    },
    out(minW,minH){const w=Math.ceil(Math.max(minW||0,W+16)),h=Math.ceil(Math.max(minH||0,H+16));return `<svg class="dbv-svg" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${p.join('')}</svg>`;},
  };
  return o;
}
// узел кластера: прямоугольник + заголовок + подстрока
function dbvNode(g,x,y,w,h,title,sub,cls){
  g.r(x,y,w,h,'dbv-node '+(cls||''));
  g.t(x+w/2,y+(sub?h/2-3:h/2+4),title,'dbv-th','middle',Math.floor(w/7));
  if(sub)g.t(x+w/2,y+h/2+11,sub,'dbv-ts','middle',Math.floor(w/5.6));
}

// ── схема блока: собственная → шаблон → пример того же типа ───
function dbvSchemaInfo(b){
  const sc=(typeof blockSchema==='function')?blockSchema(b):b.dbSchema;
  const has=sc&&(((sc.tables||sc.collections||[]).length)||((sc.keys||[]).length));
  if(has)return {sc,demo:null};
  const t=DB_TEMPLATES.find(x=>x.type===b.type);
  return {sc:t?JSON.parse(JSON.stringify(t.schema)):{tables:[]},demo:t||null};
}
function dbvTables(sc){return (sc&&(sc.tables||sc.collections))||[];}
// флаги поля: pk/unique/notNull бывают и в виде constraints:'PK, NN, UNIQUE'
function dbvNormF(f){
  const c=String(f.constraints||'').toUpperCase();
  return Object.assign({},f,{pk:f.pk||/\bPK\b/.test(c),unique:f.unique||/\bUNIQUE\b|\bUQ\b/.test(c),notNull:f.notNull||/\bNN\b|NOT NULL/.test(c)});
}
function dbvRedisKeys(b){
  const own=b.redisSchema?.patterns||[];
  if(own.length)return {keys:own.map(p=>({key:p.key||'key',type:p.type,ttl:p.ttl,fields:(p.fields||[]).map(f=>f.name||f).filter(x=>typeof x==='string'&&x),note:p.desc})),demo:null};
  const info=dbvSchemaInfo(b);
  return {keys:(info.sc.keys||[]).map(k=>({key:k.pattern||'key',type:k.type,ttl:k.ttl,fields:(k.fields||[]).flatMap(f=>String(f).split(/,\s*/)).filter(Boolean),note:k.note})),demo:info.demo};
}
function dbvPickTable(list){if(DBV.pick>=list.length)DBV.pick=0;return list[DBV.pick];}
const dbvEmpty=(ru,en,demo)=>({svg:`<div class="dbv-empty">${dbvL(ru,en)}</div>`,facts:[],demo});

// ═══ ОТКРЫТИЕ / РЕНДЕР ══════════════════════════════════════
function openDBViz(blockId,tab){
  const b=gb(blockId);if(!dbvIsDB(b))return;
  if(DBV.id!==blockId){DBV.pick=0;DBV.tab='topo';}
  DBV.id=blockId;if(tab)DBV.tab=tab;
  let ov=$('dbv-modal');
  if(!ov){ov=document.createElement('div');ov.id='dbv-modal';ov.className='modal-ov dbv-ov';
    ov.onclick=e=>{if(e.target===ov)closeDBViz();};document.body.appendChild(ov);}
  ov.style.display='flex';
  renderDBViz();
}
// ── экспорт: SVG без внешнего CSS — стили вычисляются и вписываются в атрибуты,
// градиенты/фильтры (url(#dbvg-…)) копируются в собственный <defs> ──
const DBV_EXP_PROPS=['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','stroke-opacity','opacity','filter','font-family','font-size','font-weight','font-style','text-anchor','dominant-baseline'];
function dbvSvgStandalone(svg){
  const cl=svg.cloneNode(true),src=[svg,...svg.querySelectorAll('*')],dst=[cl,...cl.querySelectorAll('*')],refs=new Set();
  src.forEach((el,i)=>{
    const cs=getComputedStyle(el),d=dst[i];
    DBV_EXP_PROPS.forEach(k=>{let v=cs.getPropertyValue(k);if(!v||v==='none'&&k!=='fill'&&k!=='stroke')return;
      v=v.replace(/url\("?(#[^")]+)"?\)/g,(m,id)=>{refs.add(id.slice(1));return `url(${id})`;});
      if(/drop-shadow/.test(v))return; // CSS-фильтры не везде понимаются — тень берём SVG-фильтром ниже
      d.setAttribute(k,v);});
    if(/drop-shadow/.test(cs.filter||''))d.setAttribute('filter','url(#dbvx-sh)');
    d.removeAttribute('class');
  });
  const NSs='http://www.w3.org/2000/svg',defs=document.createElementNS(NSs,'defs');
  refs.forEach(id=>{const g=document.getElementById(id);if(g)defs.appendChild(g.cloneNode(true));});
  if(cl.querySelector('[filter="url(#dbvx-sh)"]')){const t=document.createElementNS(NSs,'svg');
    t.innerHTML='<filter id="dbvx-sh" x="-20%" y="-20%" width="150%" height="160%"><feDropShadow dx="1.5" dy="2" stdDeviation="1.5" flood-color="#1c2230" flood-opacity=".25"/></filter>';defs.appendChild(t.firstChild);}
  const bg=document.createElementNS(NSs,'rect');['x','y'].forEach(k=>bg.setAttribute(k,0));bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill','#f3f6fa');
  cl.insertBefore(bg,cl.firstChild);cl.insertBefore(defs,cl.firstChild);cl.setAttribute('xmlns','http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(cl);
}
function dbvExportSVG(){
  const svg=document.querySelector('#dbv-modal .dbv-svg');if(!svg)return null;
  const str=dbvSvgStandalone(svg),b=gb(DBV.id);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([str],{type:'image/svg+xml;charset=utf-8'}));
  a.download='db-'+String(b?dbvName(b):'viz').replace(/[^\wа-яё-]+/gi,'_')+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);return str;
}
function closeDBViz(){const ov=$('dbv-modal');if(ov)ov.style.display='none';DBV.id=null;}
function dbvRefresh(){const ov=$('dbv-modal');if(DBV.id&&ov&&ov.style.display!=='none')renderDBViz();}
function dbvTab(t){DBV.tab=t;renderDBViz();}
function dbvSetPick(i){DBV.pick=i;renderDBViz();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&DBV.id){const ov=$('dbv-modal');if(ov&&ov.style.display!=='none')closeDBViz();}});

function renderDBViz(){
  const ov=$('dbv-modal');if(!ov)return;
  const b=gb(DBV.id);if(!dbvIsDB(b)){closeDBViz();return;}
  const meta=DBV_META[b.type];
  const R={rel:[dbvTopoRel,dbvModelRel],kv:[dbvTopoRedis,dbvModelRedis],search:[dbvTopoES,dbvModelES],col:[dbvTopoCH,dbvModelCH],
    doc:[dbvTopoMongo,dbvModelMongo],wide:[dbvTopoCass,dbvModelCass],obj:[dbvTopoS3,dbvModelS3]}[meta.fam];
  const modelLbl={rel:dbvL('ER и индексы','ER & indexes'),kv:dbvL('Keyspace и структуры','Keyspace & structures'),search:dbvL('Mapping и инвертированный индекс','Mapping & inverted index'),
    col:dbvL('Колонки, парты, гранулы','Columns, parts, granules'),doc:dbvL('Документы','Documents'),wide:dbvL('Партиции и строки','Partitions & rows'),obj:dbvL('Ключи и версии','Keys & versions')}[meta.fam];
  let res;
  try{res=R[DBV.tab==='model'?1:0](b);}
  catch(err){console.warn('db-viz',err);res={svg:`<div class="dbv-empty">${dbvL('Не удалось построить визуализацию','Failed to build visualization')}: ${dbvE(err.message)}</div>`,facts:[]};}
  const demo=res.demo?`<div class="dbv-demo">ℹ ${dbvL('Схема блока не задана — показан пример','Block schema is empty — showing example')} «${dbvE(tTask(res.demo.name))}».
    <button class="dbv-btn" onclick="applyDBTemplateToBlock('${b.id}','${res.demo.id}')">${dbvL('Взять этот шаблон','Use this template')}</button></div>`:'';
  const picker=res.pick&&res.pick.length>1?`<div class="dbv-pick">${res.pick.map((n,i)=>`<button class="dbv-chip${i===DBV.pick?' on':''}" onclick="dbvSetPick(${i})">${dbvE(n)}</button>`).join('')}</div>`:'';
  const acts=[];
  if(meta.fam==='rel'){
    acts.push(`<button class="modal-btn primary" onclick="openDBEditor('${b.id}')">🗄 ${dbvL('Редактировать схему','Edit schema')}</button>`);
    acts.push(`<button class="modal-btn" onclick="showERDVisual('${b.id}')">🔗 ${dbvL('Интерактивный ERD','Interactive ERD')}</button>`);
  }
  if(b.type==='redis')acts.push(`<button class="modal-btn primary" onclick="openRedisEditor('${b.id}')">⚡ ${dbvL('Redis-схема','Redis schema')}</button>`);
  acts.push(`<button class="modal-btn" onclick="openDBSchemaPicker('${b.id}')">📚 ${dbvL('Готовая схема','Ready-made schema')}</button>`);
  acts.push(`<button class="modal-btn" onclick="showDBSchemaForBlock('${b.id}','sql')">📋 ${['rel','col','wide'].includes(meta.fam)?'DDL':dbvL('Описание','Spec')}</button>`);
  acts.push(`<button class="modal-btn" onclick="openSettings('${b.id}')">⚙ ${dbvL('Настройки','Settings')}</button>`);
  acts.push(`<button class="modal-btn dbv-exp" onclick="dbvExportSVG()" title="${dbvL('Скачать схему как самостоятельный SVG','Download as standalone SVG')}">⬇ SVG</button>`);
  ov.innerHTML=`<div class="modal-box dbv" data-db="${b.type}" data-fam="${meta.fam}">
    <div class="dbv-head">
      <span class="dbv-ico">${meta.icon}</span>
      <div class="dbv-hd">
        <div class="dbv-title">${dbvE(dbvName(b))} <span class="dbv-type">${dbvE(EL[b.type]?.lbl||b.type)}</span></div>
        <div class="dbv-sub">${dbvE(tTask(meta.model))}</div>
      </div>
      <span class="tb95-btns dbv-btns"><button class="tb95-btn" tabindex="-1" aria-hidden="true">_</button><button class="tb95-btn" tabindex="-1" aria-hidden="true">□</button><button class="tb95-btn x dbv-x" onclick="closeDBViz()" title="${dbvL('Закрыть','Close')}">✕</button></span>
    </div>
    <div class="dbv-tabs">
      <button class="dbv-tab${DBV.tab!=='model'?' on':''}" onclick="dbvTab('topo')">🧭 ${dbvL('Топология','Topology')}</button>
      <button class="dbv-tab${DBV.tab==='model'?' on':''}" onclick="dbvTab('model')">🧬 ${modelLbl}</button>
    </div>
    ${demo}${picker}
    <div class="dbv-canvas">${res.svg}</div>
    ${res.facts&&res.facts.length?`<div class="dbv-facts">${res.facts.map(f=>`<div class="dbv-fact">${f}</div>`).join('')}</div>`:''}
    <div class="dbv-actions">${acts.join('')}</div>
  </div>`;
}

// ═══ RELATIONAL (PostgreSQL / MySQL) ════════════════════════
function dbvTopoRel(b){
  const pg=b.type==='postgresql';
  const reps=dbvNum(b,'replicas',0,0,10),pool=!!dbvS(b,'pgbouncer'),iso=dbvS(b,'isolation');
  const g=dbvSvg();
  const cl=dbvClients(b),shown=cl.slice(0,4),cN=Math.max(shown.length,1);
  const colC=16,colP=200,colM=390,colR=660;
  const nR=Math.min(reps,6);
  const midY=Math.max(90,Math.max(nR*64,cN*56)/2+30);
  const cy0=midY-(cN*56)/2+8;
  if(!shown.length)dbvNode(g,colC,cy0,150,40,dbvL('приложение','application'),dbvL('нет входящих связей','no incoming links'),'dbv-ghost');
  shown.forEach((c,i)=>dbvNode(g,colC,cy0+i*56,150,40,dbvName(c),EL[c.type]?.lbl||c.type,'dbv-client'));
  if(cl.length>4)g.t(colC+75,cy0+4*56+10,'+'+(cl.length-4),'dbv-ts','middle');
  for(let i=0;i<cN;i++)g.a(colC+150,cy0+i*56+20,pool?colP:colM,pool?midY:midY-20,'dbv-flow');
  if(pool){
    dbvNode(g,colP,midY-26,140,52,pg?'PgBouncer':'ProxySQL',dbvL('пул соединений','connection pool'),'dbv-proxy');
    g.a(colP+140,midY-10,colM,midY-10,'dbv-w');g.t((colP+140+colM)/2,midY-16,'write','dbv-ts','middle');
  }
  g.r(colM,midY-60,200,120,'dbv-node dbv-primary'+dbvHealth(b));
  g.t(colM+100,midY-40,'Primary (RW)','dbv-th','middle');
  g.t(colM+100,midY-23,pg?'WAL → heap / index pages':'redo log + binlog → InnoDB','dbv-ts','middle');
  g.t(colM+100,midY-8,dbvL('изоляция: ','isolation: ')+iso,'dbv-ts','middle');
  g.r(colM+20,midY+6,160,42,'dbv-disk');
  g.t(colM+100,midY+22,pg?dbvL('base/: страницы 8 КБ','base/: 8 KB pages'):dbvL('*.ibd: страницы 16 КБ','*.ibd: 16 KB pages'),'dbv-ts','middle');
  g.t(colM+100,midY+37,pg?'B-tree / GIN / BRIN':dbvL('кластерный индекс по PK','clustered PK index'),'dbv-ts','middle');
  if(!reps){
    g.r(colR,midY-30,200,60,'dbv-node dbv-ghost');
    g.t(colR+100,midY-8,dbvL('реплик нет','no replicas'),'dbv-th','middle');
    g.t(colR+100,midY+10,dbvL('все чтения на primary · SPOF','all reads on primary · SPOF'),'dbv-ts','middle');
  } else {
    const ry0=midY-(nR*64)/2+6;
    for(let i=0;i<nR;i++){
      const y=ry0+i*64;
      dbvNode(g,colR,y,200,46,'Replica #'+(i+1)+' (RO)',pg?'hot standby · streaming':'async · relay log','dbv-replica');
      g.a(colM+200,midY-30+i*6,colR,y+23,'dbv-repl');
      if(pool)g.path(`M${colP+70},${midY+26} C${colP+70},${midY+140} ${colR-60},${y+46} ${colR},${y+38}`,'dbv-r');
    }
    g.t((colM+200+colR)/2,ry0-8,pg?'WAL stream':'binlog','dbv-ts dbv-b','middle');
    if(pool)g.t(colP+70,midY+48,'read →','dbv-ts','middle');
    if(reps>6)g.t(colR+100,ry0+nR*64+8,'+'+(reps-6),'dbv-ts','middle');
  }
  const facts=[
    `<b>${dbvL('Запись','Writes')}:</b> ${dbvL('только один primary; горизонтально запись не масштабируется без шардинга','single primary; writes don\'t scale out without sharding')} (${pg?'Citus':'Vitess'}).`,
    `<b>${dbvL('Чтение','Reads')}:</b> ${reps?dbvL(`распределяется на ${reps} реплик(и) — возможен replication lag`,`spread over ${reps} replica(s) — replication lag possible`):dbvL('всё на primary','all on primary')}.`,
    `<b>${dbvL('Ёмкость','Capacity')}:</b> ${fmt(effCap(b))} rps${pool?dbvL(' · пул снимает лимит соединений',' · pool removes the connection limit'):''}.`,
  ];
  return {svg:g.out(),facts};
}
// разбор CREATE INDEX → {name,table,cols,unique,method}
function dbvParseIndex(sql){
  const m=/(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)?\s*ON\s+(\w+)\s*(?:USING\s+(\w+)\s*)?\(([^)]*)\)/i.exec(sql||'');
  if(!m)return null;
  return {unique:!!m[1],name:m[2]||'idx',table:m[3],method:(m[4]||'btree').toLowerCase(),cols:m[5].split(',').map(s=>s.trim().split(/\s+/)[0].replace(/["`]/g,'')).filter(Boolean)};
}
function dbvModelRel(b){
  const info=dbvSchemaInfo(b);const tables=dbvTables(info.sc).map(t=>Object.assign({},t,{fields:(t.fields||[]).map(dbvNormF)}));
  if(!tables.length)return dbvEmpty('Нет таблиц — открой редактор схемы или загрузи готовую','No tables — open the schema editor or load a template',info.demo);
  const g=dbvSvg();
  const byName={};tables.forEach(t=>byName[t.name]=t);
  // глубина по FK: таблица, ссылающаяся на другую, стоит правее
  const depth={};
  const dep=(t,seen)=>{if(depth[t.name]!==undefined)return depth[t.name];if(seen.has(t.name))return 0;seen.add(t.name);
    let d=0;(t.fields||[]).forEach(f=>{if(f.fk&&byName[f.fk.table]&&f.fk.table!==t.name)d=Math.max(d,dep(byName[f.fk.table],seen)+1);});return depth[t.name]=d;};
  tables.forEach(t=>dep(t,new Set()));
  const RH=17,HH=24,GAP=26,CG=96;
  const idxOf={};tables.forEach(t=>idxOf[t.name]=(t.indexes||[]).map(dbvParseIndex).filter(Boolean));
  const box={},cols={};
  tables.forEach(t=>{(cols[depth[t.name]]=cols[depth[t.name]]||[]).push(t);});
  let x=10;
  Object.keys(cols).map(Number).sort((a,c)=>a-c).forEach(d=>{
    let y=10,colW=0;
    cols[d].forEach(t=>{
      const w=Math.min(330,Math.max(210,...(t.fields||[]).map(f=>(String(f.name).length+Math.min(18,String(f.type||'').length))*6.3+66),...idxOf[t.name].map(ix=>(ix.name.length+ix.cols.join(', ').length+ix.method.length)*5.6+30)));
      const h=HH+(t.fields||[]).length*RH+(idxOf[t.name].length?16+idxOf[t.name].length*15:0)+6;
      box[t.name]={x,y,w,h};colW=Math.max(colW,w);y+=h+GAP;
    });
    cols[d].forEach(t=>box[t.name].w=colW);
    x+=colW+CG;
  });
  // связи — под таблицами
  tables.forEach(t=>(t.fields||[]).forEach((f,fi)=>{
    if(!f.fk||!box[f.fk.table])return;
    const cb=box[t.name],pb=box[f.fk.table],pt=byName[f.fk.table];
    const pfi=Math.max(0,(pt.fields||[]).findIndex(z=>z.name===f.fk.field));
    const y1=cb.y+HH+fi*RH+RH/2,y2=pb.y+HH+pfi*RH+RH/2;
    const card=f.fk.card||'N:1';
    if(f.fk.table===t.name){const xr=cb.x+cb.w;g.path(`M${xr},${y1} h26 V${y2} h-26`,'dbv-fk');return;}
    const sameCol=cb.x===pb.x;
    const childRight=cb.x>pb.x;
    let x1,x2,s1,s2;
    if(sameCol){x1=cb.x;x2=pb.x;s1=-1;s2=-1;g.path(`M${x1},${y1} C${x1-50},${y1} ${x2-50},${y2} ${x2},${y2}`,'dbv-fk');}
    else{x1=childRight?cb.x:cb.x+cb.w;x2=childRight?pb.x+pb.w:pb.x;s1=childRight?-1:1;s2=childRight?1:-1;
      const mx=(x1+x2)/2;g.path(`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,'dbv-fk');}
    const manyC=card==='N:1'||card==='N:M',manyP=card==='1:N'||card==='N:M';
    const foot=(xx,yy,s,isMany)=>{
      if(isMany){g.l(xx,yy-6,xx+s*11,yy,'dbv-fk-end');g.l(xx,yy+6,xx+s*11,yy,'dbv-fk-end');}
      else g.l(xx+s*6,yy-6,xx+s*6,yy+6,'dbv-fk-end');
      g.l(xx+s*14,yy-6,xx+s*14,yy+6,'dbv-fk-end');};
    foot(x1,y1,s1,manyC);foot(x2,y2,s2,manyP);
    if(!sameCol)g.t((x1+x2)/2,(y1+y2)/2-5,card,'dbv-ts dbv-card','middle');
  }));
  tables.forEach(t=>{
    const {x,y,w,h}=box[t.name];
    const ixCols=new Set();idxOf[t.name].forEach(ix=>ix.cols.forEach(c=>ixCols.add(c)));
    g.r(x,y,w,h,'dbv-er-tbl');g.r(x,y,w,HH,'dbv-er-head',0);
    g.t(x+8,y+16,t.name,'dbv-th dbv-er-title',null,Math.floor(w/8));
    g.t(x+w-6,y+16,(t.fields||[]).length+dbvL(' кол.',' cols'),'dbv-ts dbv-er-title','end');
    (t.fields||[]).forEach((f,i)=>{
      const ry=y+HH+i*RH;
      if(i%2)g.r(x+1,ry,w-2,RH,'dbv-er-zebra',0);
      const tags=[];if(f.pk)tags.push(['PK','dbv-tag-pk']);if(f.fk)tags.push(['FK','dbv-tag-fk']);
      if(f.unique&&!f.pk)tags.push(['UQ','dbv-tag-uq']);if(ixCols.has(f.name)&&!f.pk)tags.push(['IX','dbv-tag-ix']);
      tags.slice(0,2).forEach((tg,k)=>{g.r(x+4+k*21,ry+3,19,RH-6,'dbv-tag '+tg[1],2);g.t(x+13.5+k*21,ry+12,tg[0],'dbv-tag-t','middle');});
      g.t(x+50,ry+12.5,f.name+(f.notNull&&!f.pk?' *':''),f.pk?'dbv-t dbv-b':'dbv-t',null,26);
      g.t(x+w-6,ry+12.5,f.type||'','dbv-ts dbv-mono','end',18);
    });
    if(idxOf[t.name].length){
      const iy=y+HH+(t.fields||[]).length*RH+4;
      g.l(x,iy,x+w,iy,'dbv-sep');
      g.t(x+8,iy+12,dbvL('индексы','indexes'),'dbv-ts dbv-b');
      idxOf[t.name].forEach((ix,k)=>g.t(x+10,iy+27+k*15,`${ix.unique?'UNIQUE ':''}${ix.method} ${ix.name} (${ix.cols.join(', ')})`,'dbv-ts dbv-mono dbv-idx',null,Math.floor(w/5.8)));
    }
  });
  const nFk=tables.reduce((a,t)=>a+(t.fields||[]).filter(f=>f.fk).length,0);
  const nIx=Object.values(idxOf).reduce((a,l)=>a+l.length,0);
  const reps=dbvNum(b,'replicas',0,0,10);
  const facts=[
    `<b>${tables.length}</b> ${dbvL('таблиц','tables')} · <b>${nFk}</b> FK · <b>${nIx}</b> ${dbvL('вторичных индексов','secondary indexes')} · ${dbvL('PK индексируется автоматически','PK is indexed automatically')}.`,
    `${dbvL('Обозначения','Legend')}: <span class="dbv-tag-pk dbv-inl">PK</span> <span class="dbv-tag-fk dbv-inl">FK</span> <span class="dbv-tag-uq dbv-inl">UQ</span> <span class="dbv-tag-ix dbv-inl">IX</span> · * NOT NULL · ${dbvL('«лапка» — сторона «много»','crow\'s foot = "many" side')}.`,
    b.type==='mysql'?dbvL('InnoDB: вторичный индекс хранит значение PK → чтение через него = 2 прохода по B-tree.','InnoDB: a secondary index stores the PK value → lookup = 2 B-tree traversals.')
      :dbvL('PostgreSQL: индекс указывает на ctid строки в heap; UPDATE пишет новую версию строки (MVCC) → нужен VACUUM.','PostgreSQL: indexes point to heap ctid; UPDATE writes a new row version (MVCC) → VACUUM needed.'),
    reps?dbvL(`Физическая репликация: каждая из ${reps} реплик хранит ВСЕ таблицы целиком.`,`Physical replication: each of ${reps} replicas stores ALL tables.`):'',
  ].filter(Boolean);
  return {svg:g.out(),facts,demo:info.demo};
}

// ═══ REDIS ═════════════════════════════════════════════════
function dbvTtlSec(ttl){
  const s=String(ttl??'').toLowerCase().trim();
  if(!s||/never|нет|none|∞|persist/.test(s))return null;
  const m=/([\d.]+)\s*(ms|s|sec|сек|m|min|мин|h|hour|час|d|day|дн|w|week|нед)?/.exec(s);
  if(!m)return -1;
  const mul={ms:0.001,s:1,sec:1,'сек':1,m:60,min:60,'мин':60,h:3600,hour:3600,'час':3600,d:86400,day:86400,'дн':86400,w:604800,week:604800,'нед':604800}[m[2]||'s']||1;
  return +m[1]*mul;
}
function dbvTopoRedis(b){
  const cluster=!!dbvS(b,'cluster');
  const masters=cluster?dbvNum(b,'cluster_shards',3,1,16):1,reps=dbvNum(b,'redis_replicas',1,0,5);
  const pers=dbvS(b,'persistence')||'none',evict=dbvS(b,'eviction'),mm=dbvS(b,'maxmemory');
  const {keys,demo}=dbvRedisKeys(b);
  const g=dbvSvg();const facts=[];
  if(cluster){
    const BW=Math.max(720,masters*130),x0=20,y0=30;
    g.t(x0,y0-12,dbvL('16384 хеш-слота: slot = CRC16(key) mod 16384','16384 hash slots: slot = CRC16(key) mod 16384'),'dbv-ts dbv-b');
    for(let i=0;i<masters;i++){
      const a=Math.floor(i*16384/masters),z=Math.floor((i+1)*16384/masters)-1;
      const xa=x0+a/16384*BW,xb=x0+(z+1)/16384*BW;
      g.r(xa,y0,xb-xa,22,'dbv-slot dbv-k'+(i%6),0);
      g.t((xa+xb)/2,y0+15,a+'–'+z,'dbv-ts dbv-on-k','middle');
    }
    // примеры ключей → слот
    const samp=keys.slice(0,6).map((k,i)=>{const key=k.key.replace(/\{([^}]*)\}/g,(_,v)=>i%2?'{'+dbvSample(v,'',i)+'}':dbvSample(v,'',i));return {key,slot:dbvRedisSlot(key)};});
    samp.forEach((s,i)=>{
      const x=x0+s.slot/16384*BW,y=y0+40+i*16;
      g.l(x,y0+22,x,y-4,'dbv-ln dbv-thin dbv-dash');g.c(x,y0+22,2.5,'dbv-dot');
      g.t(x+4,y,`${s.key} → ${s.slot}`,'dbv-ts dbv-mono',null,44);
    });
    const ny=y0+60+samp.length*16,nw=Math.min(150,BW/masters-14);
    for(let i=0;i<masters;i++){
      const xc=x0+(i+0.5)*BW/masters;
      dbvNode(g,xc-nw/2,ny,nw,44,'Master '+(i+1),Math.floor(i*16384/masters)+'–'+(Math.floor((i+1)*16384/masters)-1),'dbv-primary dbv-k-brd'+(i%6)+dbvHealth(b));
      for(let r=0;r<Math.min(reps,3);r++){
        const ry=ny+70+r*52;
        dbvNode(g,xc-nw/2+10,ry,nw-20,36,'Replica '+(i+1)+'.'+(r+1),'async','dbv-replica');
        g.a(xc,r?ry-16:ny+44,xc,ry,'dbv-repl');
      }
    }
    if(masters>1)g.path(`M${x0+BW/masters/2},${ny-8} H${x0+BW-BW/masters/2}`,'dbv-ln dbv-dash dbv-thin');
    g.t(x0+BW/2,ny-12,'cluster bus (gossip, failover)','dbv-ts','middle');
    facts.push(`<b>Redis Cluster</b>: ${masters} ${dbvL('мастеров','masters')} × ${reps} ${dbvL('реплик','replicas')}. ${dbvL('Клиент сам ходит на нужный мастер (MOVED/ASK). Ключи с одинаковым {hash tag} попадают в один слот — только так работают MULTI и мульти-ключевые команды.','Client routes to the owning master (MOVED/ASK). Keys sharing a {hash tag} land in one slot — the only way MULTI and multi-key commands work.')}`);
  } else {
    dbvNode(g,20,70,150,40,dbvClients(b)[0]?dbvName(dbvClients(b)[0]):dbvL('приложение','application'),'RESP','dbv-client');
    g.r(240,40,210,100,'dbv-node dbv-primary'+dbvHealth(b));
    g.t(345,62,'Master (RW)','dbv-th','middle');
    g.t(345,80,dbvL('однопоточный event loop','single-threaded event loop'),'dbv-ts','middle');
    g.t(345,96,'maxmemory '+mm+' · '+evict,'dbv-ts','middle');
    g.t(345,112,dbvL('весь датасет в RAM','whole dataset in RAM'),'dbv-ts','middle');
    g.a(170,90,240,90,'dbv-w');
    g.r(270,170,150,40,'dbv-disk');
    g.t(345,186,pers==='none'?dbvL('на диск не пишет','no persistence'):pers==='rdb'?'RDB snapshot (fork)':pers==='aof'?'AOF (fsync everysec)':'RDB + AOF','dbv-ts dbv-b','middle');
    g.t(345,201,pers==='none'?dbvL('рестарт = потеря данных','restart = data loss'):dbvL('восстановление при рестарте','restored on restart'),'dbv-ts','middle');
    g.l(345,140,345,170,'dbv-ln dbv-dash'+(pers==='none'?' dbv-ghost':''));
    for(let r=0;r<reps;r++){dbvNode(g,540,30+r*58,170,42,'Replica '+(r+1)+' (RO)','PSYNC · async','dbv-replica');g.a(450,70+r*8,540,51+r*58,'dbv-repl');}
    if(reps){dbvNode(g,540,40+reps*58,170,36,'Sentinel ×3',dbvL('авто-failover','auto failover'),'dbv-proxy');}
    else g.t(625,90,dbvL('реплик нет — SPOF','no replicas — SPOF'),'dbv-ts dbv-warn-t','middle');
    facts.push(`<b>Standalone</b>: ${dbvL('один мастер держит весь keyspace; масштаб записи = одно ядро CPU. Включи cluster, чтобы шардировать по слотам.','one master holds the whole keyspace; write scale = one CPU core. Enable cluster to shard by slots.')}`);
  }
  facts.push(`<b>Eviction</b> <code>${dbvE(evict)}</code> ${dbvL('при достижении','when reaching')} maxmemory ${dbvE(mm)}: ${evict==='noeviction'?dbvL('новые записи получат OOM-ошибку','new writes get OOM errors'):/volatile/.test(evict)?dbvL('вытесняются только ключи с TTL','only keys with a TTL are evicted'):dbvL('может вытесниться любой ключ','any key can be evicted')}.`);
  return {svg:g.out(),facts,demo};
}
// рисунок структуры данных внутри карточки ключа
function dbvRedisStruct(g,x,y,w,k,i){
  const T=String(k.type||'STRING').toUpperCase(),f=k.fields.length?k.fields:['value'];
  if(T==='HASH'){
    f.slice(0,4).forEach((fn,j)=>{g.r(x,y+j*17,w*0.5,15,'dbv-cell dbv-cell-k',1);g.t(x+4,y+j*17+11,fn,'dbv-ts dbv-mono',null,Math.floor(w*0.5/5.6));
      g.r(x+w*0.5+2,y+j*17,w*0.5-2,15,'dbv-cell',1);g.t(x+w*0.5+6,y+j*17+11,dbvSample(fn,'',j+i),'dbv-ts',null,Math.floor(w*0.5/6));});
    return Math.min(4,f.length)*17;
  }
  if(T==='LIST'){
    const n=Math.min(5,Math.max(3,f.length)),cw=(w-30)/n;
    g.t(x,y+11,'L','dbv-ts dbv-b');
    for(let j=0;j<n;j++){g.r(x+12+j*cw,y,cw-3,15,'dbv-cell',1);g.t(x+12+j*cw+(cw-3)/2,y+11,f[j]||('e'+j),'dbv-ts','middle',Math.floor(cw/6));if(j<n-1)g.l(x+12+j*cw+cw-3,y+7.5,x+12+(j+1)*cw,y+7.5,'dbv-ln dbv-thin');}
    g.t(x+w-2,y+11,'R','dbv-ts dbv-b','end');
    g.t(x,y+30,'LPUSH →  … → RPOP','dbv-ts dbv-mono');return 34;
  }
  if(T==='SET'){
    g.r(x,y,w,38,'dbv-cell',14);
    f.slice(0,4).forEach((m,j)=>{const cx=x+16+j*((w-32)/3.2);g.c(cx+12,y+19,12,'dbv-member');g.t(cx+12,y+23,m,'dbv-ts','middle',4);});
    return 42;
  }
  if(T==='ZSET'){
    const mem=f.length>1?f:['alice','bob','eva'];
    mem.slice(0,4).forEach((m,j)=>{const sc=(1000-j*170);const bw=(w-70)*sc/1000;
      g.t(x,y+j*16+11,m,'dbv-ts dbv-mono',null,10);g.r(x+64,y+j*16+2,bw,12,'dbv-score',1);g.t(x+68+bw,y+j*16+11,String(sc),'dbv-ts');});
    g.t(x,y+Math.min(4,mem.length)*16+12,dbvL('skiplist: отсортировано по score','skiplist: sorted by score'),'dbv-ts');
    return Math.min(4,mem.length)*16+16;
  }
  if(T==='STREAM'){
    for(let j=0;j<4;j++){const ex=x+j*(w/4);g.r(ex,y,w/4-6,26,'dbv-cell',1);g.t(ex+3,y+11,'1730'+j+'-0','dbv-ts dbv-mono',null,Math.floor(w/4/5.5));g.t(ex+3,y+22,(f[0]||'field')+'=…','dbv-ts',null,Math.floor(w/4/6));if(j<3)g.a(ex+w/4-6,y+13,ex+w/4,y+13,'dbv-thin');}
    g.t(x,y+40,dbvL('consumer group → XREADGROUP / XACK','consumer group → XREADGROUP / XACK'),'dbv-ts');return 44;
  }
  // STRING и прочее
  g.r(x,y,w,17,'dbv-cell',1);g.t(x+5,y+12,'"'+(f[0]||'value')+'"','dbv-ts dbv-mono',null,Math.floor(w/6));
  return 20;
}
function dbvModelRedis(b){
  const {keys,demo}=dbvRedisKeys(b);
  if(!keys.length)return dbvEmpty('Нет ключей — открой Redis-схему или загрузи готовую','No keys — open the Redis schema or load a template',demo);
  const evict=dbvS(b,'eviction');
  const g=dbvSvg();
  // группировка по namespace (первый сегмент до ':')
  const ns={};keys.forEach(k=>{const n=k.key.split(':')[0]||'?';(ns[n]=ns[n]||[]).push(k);});
  const CW=250,GAP=14;let x=10;const types={};
  Object.entries(ns).forEach(([n,list])=>{
    let y=34;const top=10;
    const cards=list.map((k,i)=>{
      const T=String(k.type||'STRING').toUpperCase();types[T]=(types[T]||0)+1;
      const sec=dbvTtlSec(k.ttl);
      const start=y;
      g.r(x+14,y+8,54,16,'dbv-rt dbv-rt-'+T,2);g.t(x+41,y+20,T,'dbv-rt-t','middle');
      g.t(x+74,y+20,k.key,'dbv-t dbv-mono dbv-b',null,26);
      // TTL-шкала: лог-масштаб от 1 сек до 1 года
      const tl=sec===null?0:sec<0?0.5:Math.max(0.04,Math.min(1,Math.log10(Math.max(1,sec))/Math.log10(31536000)));
      g.r(x+14,y+30,CW-90,6,'dbv-ttl-bg',3);if(sec!==null)g.r(x+14,y+30,(CW-90)*tl,6,'dbv-ttl',3);
      g.t(x+CW-70,y+37,'TTL '+(k.ttl||'∞'),'dbv-ts',null,14);
      const evictable=evict!=='noeviction'&&(!/volatile/.test(evict)||sec!==null);
      g.t(x+14,y+52,evictable?dbvL('может быть вытеснен ('+evict+')','evictable ('+evict+')'):dbvL('не вытесняется','not evicted'),'dbv-ts '+(evictable?'dbv-warn-t':'dbv-ok-t'),null,40);
      const h=dbvRedisStruct(g,x+14,y+60,CW-28,k,i);
      const H=60+h+(k.note?22:8);
      if(k.note)g.t(x+14,y+60+h+14,k.note,'dbv-ts dbv-note',null,38);
      y+=H+10;
      return {start,H};
    });
    // рамки карточек поверх содержимого (fill: none в CSS) — высота известна только после отрисовки
    cards.forEach(c=>g.rb(x+8,c.start,CW-16,c.H,'dbv-card-redis'));
    g.rb(x,top,CW,y-top,'dbv-ns');
    g.t(x+8,top+14,n+':*','dbv-th dbv-mono');
    x+=CW+GAP;
  });
  return {svg:g.out(),facts:[
    `${dbvL('Типы','Types')}: ${Object.entries(types).map(([t,n])=>`<span class="dbv-inl dbv-rt-${t}">${t}</span>×${n}`).join(' ')} · ${dbvL('ключи сгруппированы по namespace (префикс до «:»)','keys grouped by namespace (prefix before ":")')}.`,
    dbvL('Шкала TTL — логарифмическая (1 сек … 1 год). Истёкшие ключи удаляются лениво при обращении + фоновой выборкой.','TTL bar is logarithmic (1 s … 1 y). Expired keys are removed lazily on access + by background sampling.'),
  ],demo};
}

// ═══ ELASTICSEARCH ═════════════════════════════════════════
const DBV_STOP=new Set(['a','an','the','for','of','and','or','to','in','on','is','и','в','на','для','с','по']);
function dbvTokens(s){return String(s||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w&&!DBV_STOP.has(w));}
function dbvTopoES(b){
  const info=dbvSchemaInfo(b);const idx=dbvTables(info.sc);
  const P=dbvNum(b,'shards',3,1,12),R=dbvNum(b,'es_replicas',1,0,3),N=dbvNum(b,'es_nodes',3,1,9);
  const iname=(idx[0]&&idx[0].name)||'index';
  const g=dbvSvg();
  const NW=Math.max(150,Math.min(200,900/N-12)),gap=14,totalW=N*(NW+gap)-gap;
  const x0=20,ny=110;
  dbvNode(g,x0+totalW/2-110,14,220,46,dbvL('Coordinating node','Coordinating node'),dbvL('scatter → gather, merge top-K','scatter → gather, merge top-K'),'dbv-proxy'+dbvHealth(b));
  // раскладка шардов: P на ноде p%N, реплика r на (p+1+r)%N; если R ≥ N — реплика не размещается
  const nodes=Array.from({length:N},()=>[]);const unassigned=[];
  for(let p=0;p<P;p++){
    nodes[p%N].push({p,prim:true});
    for(let r=0;r<R;r++){if(r+1>=N){unassigned.push({p,r});continue;}nodes[(p+1+r)%N].push({p,prim:false});}
  }
  const maxCh=Math.max(1,...nodes.map(n=>n.length));const perRow=Math.max(1,Math.floor((NW-14)/34));
  const NH=50+Math.ceil(maxCh/perRow)*28;
  nodes.forEach((list,i)=>{
    const x=x0+i*(NW+gap);
    g.r(x,ny,NW,NH,'dbv-node dbv-group');
    g.t(x+8,ny+16,'data-node-'+(i+1),'dbv-th');g.t(x+NW-8,ny+16,list.length+dbvL(' шард.',' shards'),'dbv-ts','end');
    g.a(x0+totalW/2,60,x+NW/2,ny,'dbv-r dbv-thin');
    list.forEach((s,j)=>{const cx=x+8+(j%perRow)*34,cy=ny+28+Math.floor(j/perRow)*28;
      g.r(cx,cy,30,22,s.prim?'dbv-esP':'dbv-esR',3);g.t(cx+15,cy+15,(s.prim?'P':'R')+s.p,'dbv-ts dbv-b','middle');});
  });
  const hy=ny+NH+20,health=unassigned.length?'yellow':'green';
  g.r(x0,hy,totalW,24,'dbv-health dbv-health-'+health,4);
  g.t(x0+10,hy+16,`cluster health: ${health.toUpperCase()} · ${P} primary × (1+${R}) = ${P*(1+R)} ${dbvL('шардов','shards')}`+(unassigned.length?` · ${unassigned.length} unassigned`:''),'dbv-t dbv-b');
  if(unassigned.length){
    unassigned.slice(0,10).forEach((u,j)=>{g.r(x0+j*34,hy+34,30,22,'dbv-esR dbv-ghost',3);g.t(x0+j*34+15,hy+49,'R'+u.p,'dbv-ts','middle');});
  }
  const facts=[
    `<b>${dbvL('Индекс','Index')} «${dbvE(iname)}»</b>: ${P} primary ${dbvL('шардов (число фиксируется при создании)','shards (fixed at creation)')}, ${dbvL('у каждого','each has')} ${R} ${dbvL('реплик(и)','replica(s)')}. ${dbvL('Документ → шард: hash(_routing) % число primary.','Doc → shard: hash(_routing) % primaries.')}`,
    `${dbvL('Primary и его реплика никогда не живут на одной ноде','A primary and its replica never share a node')}${R>=N?dbvL(` — при ${N} нодах ${unassigned.length} реплик негде разместить → YELLOW.`,` — with ${N} nodes ${unassigned.length} replicas can't be placed → YELLOW.`):'.'}`,
    dbvL('Поиск: запрос уходит в одну копию КАЖДОГО шарда (P или R), координатор сливает top-K. Реплики масштабируют чтение.','Search hits one copy of EVERY shard (P or R); the coordinator merges top-K. Replicas scale reads.'),
  ];
  if(idx.length>1)facts.push(dbvL('Другие индексы: ','Other indexes: ')+idx.slice(1).map(t=>'<code>'+dbvE(t.name)+'</code>').join(', '));
  return {svg:g.out(),facts,demo:info.demo};
}
function dbvModelES(b){
  const info=dbvSchemaInfo(b);const idx=dbvTables(info.sc);
  if(!idx.length)return dbvEmpty('Нет индексов — загрузи готовую схему','No indexes — load a template',info.demo);
  const t=dbvPickTable(idx);const fields=t.fields||[];
  const g=dbvSvg();
  // 1. mapping
  g.t(10,16,'mapping «'+t.name+'»','dbv-th');
  fields.forEach((f,i)=>{const y=26+i*19,tp=String(f.type||'').toLowerCase();
    const cls=tp==='text'?'dbv-es-text':tp==='keyword'?'dbv-es-kw':'dbv-es-oth';
    g.r(10,y,200,17,'dbv-cell',2);g.t(16,y+12,f.name,'dbv-ts dbv-mono',null,18);
    g.r(132,y+2,74,13,'dbv-estype '+cls,2);g.t(169,y+12,f.type+(f.analyzer?'·'+f.analyzer.slice(0,3):''),'dbv-ts','middle',12);});
  const textF=fields.filter(f=>String(f.type).toLowerCase()==='text').map(f=>f.name);
  const kwF=fields.filter(f=>String(f.type).toLowerCase()==='keyword'&&!f.pk).map(f=>f.name);
  // 2. документы
  let docs=t.docs&&t.docs.length?t.docs:null;
  if(!docs){docs=[0,1,2].map(i=>{const d={};fields.slice(0,4).forEach(f=>d[f.name]=String(f.type)==='text'?['quick red fox','lazy red dog','quick brown fox'][i]:dbvSample(f.name,f.type,i));return d;});}
  docs=docs.slice(0,4);
  const dx=240;g.t(dx,16,dbvL('документы (_source)','documents (_source)'),'dbv-th');
  docs.forEach((d,i)=>{const y=26+i*48;g.r(dx,y,250,42,'dbv-docnode',3);g.t(dx+6,y+13,'_id: '+(i+1),'dbv-ts dbv-b');
    const txt=Object.entries(d).map(([k,v])=>k+': '+v).join(' · ');g.t(dx+6,y+27,txt,'dbv-ts dbv-mono',null,40);g.t(dx+6,y+38,txt.slice(40),'dbv-ts dbv-mono',null,40);});
  // 3. analyzer pipeline
  const py=Math.max(26+fields.length*19,26+docs.length*48)+18;
  g.t(10,py,'analyzer: standard','dbv-th');
  const stages=[[dbvL('исходный текст','raw text'),String(docs[0]?.[textF[0]]||'Quick Red Fox')],['tokenizer',dbvTokens(docs[0]?.[textF[0]]||'Quick Red Fox').join(' | ')||'—'],['lowercase + stop','→ terms']];
  stages.forEach((s,i)=>{const x=10+i*165;g.r(x,py+8,150,36,'dbv-cell',3);g.t(x+6,py+21,s[0],'dbv-ts dbv-b');g.t(x+6,py+36,s[1],'dbv-ts dbv-mono',null,23);if(i<2)g.a(x+150,py+26,x+165,py+26,'dbv-thin');});
  // 4. инвертированный индекс по text-полям
  const ix={};docs.forEach((d,i)=>textF.forEach(fn=>dbvTokens(d[fn]).forEach(tok=>{(ix[tok]=ix[tok]||new Set()).add(i+1);})));
  const terms=Object.keys(ix).sort().slice(0,14);
  const iy=py+64;const ix0=10;
  g.t(ix0,iy,dbvL('инвертированный индекс (text: ','inverted index (text: ')+(textF.join(', ')||'—')+')','dbv-th');
  g.t(ix0,iy+16,'term','dbv-ts dbv-b');g.t(ix0+120,iy+16,'df','dbv-ts dbv-b');g.t(ix0+150,iy+16,'postings → doc ids','dbv-ts dbv-b');
  terms.forEach((tm,i)=>{const y=iy+22+i*18;g.r(ix0,y,110,15,'dbv-term',2);g.t(ix0+5,y+11,tm,'dbv-ts dbv-mono',null,17);
    g.t(ix0+124,y+11,String(ix[tm].size),'dbv-ts');
    [...ix[tm]].forEach((id,k)=>{g.r(ix0+150+k*26,y,22,15,'dbv-docnode',2);g.t(ix0+161+k*26,y+11,String(id),'dbv-ts','middle');});});
  if(!terms.length)g.t(ix0,iy+36,dbvL('нет text-полей — только keyword/числа (doc values)','no text fields — only keyword/numbers (doc values)'),'dbv-ts dbv-note');
  // 5. keyword → точные термы (агрегации)
  const kx=330;
  if(kwF.length){g.t(kx,iy,dbvL('keyword (точное значение, агрегации)','keyword (exact value, aggregations)'),'dbv-th');
    let ky=iy+22;
    kwF.slice(0,3).forEach(fn=>{const vals={};docs.forEach((d,i)=>{const v=d[fn];if(v!==undefined)(vals[v]=vals[v]||[]).push(i+1);});
      const y=ky;ky+=Math.max(1,Object.keys(vals).length)*16+8;g.t(kx,y+10,fn,'dbv-ts dbv-b dbv-mono');
      Object.entries(vals).forEach(([v,ids],k)=>{g.r(kx+90,y+k*16,110,14,'dbv-term dbv-es-kw',2);g.t(kx+95,y+k*16+10,v,'dbv-ts dbv-mono',null,17);g.t(kx+206,y+k*16+10,'['+ids.join(',')+']','dbv-ts');});});}
  return {svg:g.out(),pick:idx.map(x=>x.name),facts:[
    dbvL('<b>text</b> проходит анализатор → токены в инвертированном индексе (полнотекстовый поиск, скоринг BM25). <b>keyword</b> хранится как одно точное значение → фильтры, сортировки, агрегации.','<b>text</b> goes through the analyzer → tokens in the inverted index (full-text, BM25 scoring). <b>keyword</b> is one exact value → filters, sorts, aggregations.'),
    dbvL('Каждый шард — отдельный Lucene-индекс из неизменяемых сегментов; refresh (1 с) делает новые документы видимыми, merge сливает сегменты.','Each shard is a Lucene index of immutable segments; refresh (1 s) makes new docs searchable, merge compacts segments.'),
  ],demo:info.demo};
}

// ═══ CLICKHOUSE ════════════════════════════════════════════
function dbvParseEngine(t){
  const e=String(t.engine||'');
  const pick=re=>{const m=re.exec(e);return m?m[1].trim():'';};
  const engine=pick(/ENGINE\s*=\s*(\w+(?:\([^)]*\))?)/i)||'MergeTree()';
  const orderBy=pick(/ORDER\s+BY\s+(\([^)]*\)|[\w.]+(?:\([^)]*\))?)/i).replace(/^\(|\)$/g,'');
  const partBy=pick(/PARTITION\s+BY\s+([\w.]+(?:\([^)]*\))?)/i);
  const pkx=pick(/PRIMARY\s+KEY\s+(\([^)]*\)|\w+)/i).replace(/^\(|\)$/g,'');
  const gran=+pick(/index_granularity\s*=\s*(\d+)/i)||8192;
  const ttl=pick(/TTL\s+([^S]+?)(?:\s+SETTINGS|$)/i);
  const keyCols=(pkx||orderBy).split(',').map(s=>s.trim().replace(/^.*\(|\).*$/g,'')).filter(Boolean);
  const partCol=(partBy.match(/\((\w+)\)/)||[,partBy])[1];
  return {engine,orderBy,partBy,pk:pkx||orderBy,gran,ttl,keyCols,partCol};
}
function dbvChColW(type){
  const t=String(type||'').replace(/^(Nullable|LowCardinality)\((.*)\)$/,'$2');
  if(/^U?Int8|Bool/.test(t))return 16;if(/^U?Int16/.test(t))return 20;if(/^U?Int32|Float32|^Date$/.test(t))return 26;
  if(/^U?Int64|Float64|DateTime|Decimal/.test(t))return 34;if(/UUID/.test(t))return 40;return 50;
}
function dbvTopoCH(b){
  const info=dbvSchemaInfo(b);const tables=dbvTables(info.sc);
  const S_=dbvNum(b,'shards',1,1,12),R=dbvNum(b,'ch_replicas',1,1,3),sk=dbvS(b,'sharding_key')||'rand()';
  const tn=(tables[0]&&tables[0].name)||'events';
  const g=dbvSvg();
  const CW=Math.max(150,Math.min(190,880/S_-14)),tot=S_*(CW+14)-14,x0=20;
  dbvNode(g,x0+tot/2-140,14,280,48,`${tn}_all · ENGINE = Distributed`,`sharding key: ${sk}`,'dbv-proxy'+dbvHealth(b));
  for(let s=0;s<S_;s++){
    const x=x0+s*(CW+14),y=100;
    g.rb(x,y,CW,30+R*58,'dbv-group');
    g.t(x+8,y+16,'shard '+(s+1),'dbv-th');
    g.a(x0+tot/2,62,x+CW/2,y,'dbv-w dbv-thin');
    for(let r=0;r<R;r++){dbvNode(g,x+8,y+26+r*58,CW-16,48,`replica ${r+1}`,`${tn}_local · Replicated${(dbvParseEngine(tables[0]||{}).engine.match(/^\w+/)||['MergeTree'])[0]}`,r?'dbv-replica':'dbv-primary');}
  }
  if(R>1){const ky=100+30+R*58+16;g.r(x0,ky,tot,30,'dbv-node dbv-proxy');g.t(x0+tot/2,ky+19,dbvL('ClickHouse Keeper (Raft): лог репликации партов, координация мерджей','ClickHouse Keeper (Raft): part replication log, merge coordination'),'dbv-ts','middle');}
  const facts=[
    `<b>${S_}</b> ${dbvL('шард(ов)','shard(s)')} × <b>${R}</b> ${dbvL('реплик(и)','replica(s)')}. ${dbvL('Запрос к Distributed-таблице уходит на все шарды параллельно, каждый агрегирует свою часть — инициатор доагрегирует.','A query to the Distributed table fans out to all shards in parallel; each aggregates its part, the initiator merges.')}`,
    R>1?dbvL('Реплики равноправны (multi-master): вставка в любую, парты скачиваются остальными через Keeper.','Replicas are equal (multi-master): insert anywhere, others fetch parts via Keeper.'):dbvL('Реплик нет — потеря ноды = потеря её шарда.','No replicas — losing a node loses its shard.'),
    dbvL('Вставлять лучше пачками ≥ 10–100 тыс. строк: каждая вставка = новый парт.','Insert in batches of ≥ 10–100k rows: each insert creates a new part.'),
  ];
  return {svg:g.out(),facts,demo:info.demo};
}
function dbvModelCH(b){
  const info=dbvSchemaInfo(b);const tables=dbvTables(info.sc);
  if(!tables.length)return dbvEmpty('Нет таблиц — загрузи готовую схему','No tables — load a template',info.demo);
  const t=dbvPickTable(tables);const cols=t.fields||[];const E=dbvParseEngine(t);
  const g=dbvSvg();
  // 1. движок / ключи
  const chips=[['ENGINE',E.engine],['PARTITION BY',E.partBy||'—'],['ORDER BY',E.orderBy||'tuple()'],['PRIMARY KEY',E.pk||'= ORDER BY'],['granularity',String(E.gran)]];
  let cx=10;chips.forEach(([k,v])=>{const w=Math.max(90,(k.length+v.length)*6.2+18);g.r(cx,8,w,22,'dbv-chipbox',3);g.t(cx+7,23,k+': ','dbv-ts dbv-b');g.t(cx+7+k.length*6.4+6,23,v,'dbv-ts dbv-mono',null,40);cx+=w+8;});
  // 2. партиции и парты
  const months=E.partBy?['202609','202610','202611']:['all'];
  const py=46;g.t(10,py+12,dbvL('партиции → парты (каждый INSERT = парт, фоновый merge сливает)','partitions → parts (each INSERT = a part, background merge combines)'),'dbv-th');
  months.forEach((m,i)=>{const x=10+i*250,y=py+22;
    g.rb(x,y,238,66,'dbv-group');g.t(x+8,y+15,(E.partBy?'partition ':'')+m,'dbv-ts dbv-b dbv-mono');
    if(i<months.length-1||months.length===1){
      ['1_1_0','2_2_0','3_3_0'].forEach((p,k)=>{g.r(x+8+k*48,y+24,42,18,'dbv-part',2);g.t(x+29+k*48,y+37,p,'dbv-ts dbv-mono','middle');});
      g.a(x+152,y+33,x+166,y+33,'dbv-thin');g.r(x+168,y+22,62,22,'dbv-part dbv-part-big',2);g.t(x+199,y+37,'1_3_1','dbv-ts dbv-mono dbv-b','middle');
      g.t(x+8,y+58,'merge: min_max_level','dbv-ts');
    } else {g.r(x+8,y+24,42,18,'dbv-part',2);g.t(x+29,y+37,'4_4_0','dbv-ts dbv-mono','middle');g.t(x+60,y+37,dbvL('свежий INSERT','fresh INSERT'),'dbv-ts');}
  });
  // 3. колонки-полосы внутри одного парта
  const sy=py+110;
  g.t(10,sy,dbvL('внутри парта: каждая колонка — отдельный файл .bin, строки отсортированы по ORDER BY','inside a part: each column is its own .bin file, rows sorted by ORDER BY'),'dbv-th');
  const GR=4,GH=34,top=sy+40;
  // primary.idx — по одной метке на гранулу
  g.r(10,top,70,GR*GH,'dbv-pkidx',2);g.t(45,top-6,'primary.idx','dbv-ts dbv-b','middle');
  for(let k=0;k<GR;k++){g.t(45,top+k*GH+14,'mark '+k,'dbv-ts dbv-mono','middle');g.t(45,top+k*GH+27,'row '+(k*E.gran),'dbv-ts','middle');if(k)g.l(10,top+k*GH,80,top+k*GH,'dbv-sep');}
  const filterCol=E.keyCols[0];const aggCol=(cols.find(c=>/U?Int|Float|Decimal/.test(c.type)&&!E.keyCols.includes(c.name))||{}).name;
  let x=96;const shown=cols.slice(0,12);
  shown.forEach((c,i)=>{
    const w=Math.max(dbvChColW(c.type)+18,Math.min(84,c.name.length*6.2+8)),isKey=E.keyCols.includes(c.name),lc=/LowCardinality/.test(c.type);
    const used=c.name===filterCol||c.name===aggCol;
    g.t(x+w/2,top-20,c.name,'dbv-ts dbv-mono'+(isKey?' dbv-b':''),'middle',Math.floor(w/5.2)+2);
    g.t(x+w/2,top-7,String(c.type).replace(/LowCardinality/,'LC'),'dbv-ts','middle',Math.floor(w/5.2)+2);
    for(let k=0;k<GR;k++){
      const hit=used&&k===1;
      g.r(x,top+k*GH,w,GH-2,'dbv-colstripe dbv-k'+(i%6)+(isKey?' dbv-colkey':'')+(used&&!hit?' dbv-col-skip':'')+(hit?' dbv-hit':''),1);
      if(i<3||isKey)g.t(x+w/2,top+k*GH+19,dbvSample(c.name,c.type,k),'dbv-ts dbv-on-k','middle',Math.floor(w/5.4));
    }
    g.t(x+w/2,top+GR*GH+12+(i%2)*11,(lc?'dict+':'')+c.name+'.bin','dbv-ts dbv-mono','middle',Math.floor(w/5.4)+6);
    x+=w+4;
  });
  if(cols.length>12)g.t(x+4,top+GH,'+'+(cols.length-12),'dbv-ts');
  // подпись запроса
  const qy=top+GR*GH+42;
  if(filterCol){
    g.r(10,qy,Math.max(520,x-10),40,'dbv-chipbox',3);
    g.t(18,qy+15,`SELECT ${aggCol?'sum('+aggCol+')':'count()'} FROM ${t.name} WHERE ${filterCol} = …`,'dbv-ts dbv-mono dbv-b');
    g.t(18,qy+31,dbvL(`читается только ${aggCol?2:1} колонк${aggCol?'и':'а'} и только гранула #1 (8192 строки) — остальные пропущены по разреженному индексу`,`only ${aggCol?2:1} column(s) and only granule #1 (8192 rows) are read — the rest is skipped via the sparse index`),'dbv-ts');
  }
  const facts=[
    dbvL('Колоночное хранение: запрос читает только нужные колонки, каждая сжата отдельно (LZ4/ZSTD), однотипные значения рядом → сжатие 5–20×.','Columnar: a query reads only the columns it needs, each compressed separately (LZ4/ZSTD); similar values adjacent → 5–20× compression.'),
    dbvL(`Разреженный индекс: одна метка на ${E.gran} строк (гранулу), а не на каждую строку — индекс целиком в RAM.`,`Sparse index: one mark per ${E.gran} rows (granule), not per row — the whole index fits in RAM.`),
  ];
  const en=(E.engine.match(/^\w+/)||[''])[0];
  const engNote={SummingMergeTree:dbvL('SummingMergeTree: при merge строки с одинаковым ORDER BY схлопываются, числовые колонки суммируются.','SummingMergeTree: on merge rows with equal ORDER BY collapse, numeric columns are summed.'),
    ReplacingMergeTree:dbvL('ReplacingMergeTree: при merge остаётся последняя версия строки с тем же ORDER BY (дедупликация не мгновенная!).','ReplacingMergeTree: on merge only the latest row per ORDER BY survives (dedup is not instant!).'),
    AggregatingMergeTree:dbvL('AggregatingMergeTree: хранит промежуточные состояния агрегатов (-State / -Merge).','AggregatingMergeTree: stores intermediate aggregate states (-State / -Merge).'),
    CollapsingMergeTree:dbvL('CollapsingMergeTree: пары строк sign=+1/−1 взаимно уничтожаются при merge.','CollapsingMergeTree: +1/−1 sign row pairs cancel out on merge.')}[en];
  if(engNote)facts.push(engNote);
  if(E.partBy)facts.push(dbvL(`PARTITION BY ${E.partBy}: старые партиции удаляются целиком (DROP PARTITION), запрос с фильтром по ${E.partCol} не трогает чужие партиции.`,`PARTITION BY ${E.partBy}: old partitions are dropped whole; a query filtering on ${E.partCol} skips other partitions.`));
  if(E.ttl)facts.push('TTL: <code>'+dbvE(E.ttl)+'</code>');
  return {svg:g.out(),pick:tables.map(x=>x.name),facts,demo:info.demo};
}

// ═══ MONGODB ═══════════════════════════════════════════════
function dbvMongoShardKey(b,coll){
  const s=String(dbvS(b,'shard_key')||'').trim();if(s)return s;
  const f=(coll?.fields||[]).find(x=>/_id$/.test(x.name)&&x.name!=='_id');
  return f?f.name:'_id (hashed)';
}
function dbvTopoMongo(b){
  const info=dbvSchemaInfo(b);const colls=dbvTables(info.sc);
  const sharded=!!dbvS(b,'sharding'),RS=dbvNum(b,'replicas',3,1,7),SH=sharded?dbvNum(b,'shard_count',2,1,12):1;
  const key=dbvMongoShardKey(b,colls[0]);const hashed=/hashed/.test(key);
  const g=dbvSvg();const facts=[];
  const SW=Math.max(170,Math.min(210,880/SH-14)),tot=SH*(SW+14)-14,x0=20;
  const rsBox=(x,y,name)=>{
    const n=Math.min(RS,5);g.rb(x,y,SW,28+n*34+(sharded?44:0),'dbv-group');g.t(x+8,y+16,name,'dbv-th');
    for(let r=0;r<n;r++)dbvNode(g,x+10,y+24+r*34,SW-20,28,r?'Secondary':'Primary',null,r?'dbv-replica':'dbv-primary'+dbvHealth(b));
    for(let r=1;r<n;r++)g.path(`M${x+SW-10},${y+38} C${x+SW+6},${y+38} ${x+SW+6},${y+24+r*34+14} ${x+SW-10},${y+24+r*34+14}`,'dbv-repl dbv-thin');
    return y+28+n*34;
  };
  if(sharded){
    dbvNode(g,x0+tot/2-90,14,180,44,'mongos ×2',dbvL('роутер запросов','query router'),'dbv-proxy');
    dbvNode(g,x0+tot/2+110,14,170,44,'config RS ×3',dbvL('карта чанков','chunk map'),'dbv-proxy');
    g.l(x0+tot/2+90,36,x0+tot/2+110,36,'dbv-ln dbv-dash');
    for(let s=0;s<SH;s++){
      const x=x0+s*(SW+14),y=100;
      g.a(x0+tot/2,58,x+SW/2,y,'dbv-w dbv-thin');
      const yy=rsBox(x,y,'shard'+(s+1)+' (replica set)');
      const lo=hashed?Math.round(-100+s*200/SH):s?('“'+String.fromCharCode(97+Math.floor(s*26/SH))+'”'):'MinKey';
      const hi=hashed?Math.round(-100+(s+1)*200/SH):s<SH-1?('“'+String.fromCharCode(97+Math.floor((s+1)*26/SH))+'”'):'MaxKey';
      g.r(x+10,yy+6,SW-20,30,'dbv-chunk',3);
      g.t(x+SW/2,yy+18,'chunks '+key.replace(' (hashed)',''),'dbv-ts dbv-b','middle',Math.floor(SW/6));
      g.t(x+SW/2,yy+31,hashed?`[${lo}e17 … ${hi}e17)`:`[${lo} … ${hi})`,'dbv-ts dbv-mono','middle');
    }
    facts.push(`<b>${dbvL('Шардинг','Sharding')}</b>: ${SH} ${dbvL('шард(ов), shard key','shard(s), shard key')} <code>${dbvE(key)}</code>. ${hashed?dbvL('Хешированный ключ — равномерная запись, но range-запросы идут на все шарды.','Hashed key — even writes, but range queries hit all shards.'):dbvL('Range-ключ — диапазоны чанков; монотонный ключ (дата, ObjectId) создаёт «горячий» последний шард.','Range key — chunk ranges; a monotonic key (date, ObjectId) creates a hot last shard.')}`);
    facts.push(dbvL('Запрос с shard key → mongos шлёт на один шард (targeted), без него — на все (scatter-gather). Балансировщик двигает чанки между шардами.','A query with the shard key is targeted to one shard; without it — scatter-gather. The balancer moves chunks between shards.'));
  } else {
    dbvNode(g,20,60,150,40,dbvClients(b)[0]?dbvName(dbvClients(b)[0]):dbvL('приложение','application'),'driver','dbv-client');
    g.a(170,80,240,74,'dbv-w');
    rsBox(240,30,'replica set rs0');
    facts.push(dbvL(`Replica set из ${RS}: запись только в Primary (oplog), Secondary тянут oplog асинхронно; при падении Primary выборы за ~10 с.`,`Replica set of ${RS}: writes go to Primary (oplog), Secondaries tail the oplog; on Primary failure an election takes ~10 s.`));
    facts.push(dbvL('Включи «sharding» в настройках, чтобы увидеть mongos, config servers и раскладку чанков.','Enable "sharding" in settings to see mongos, config servers and chunk layout.'));
  }
  facts.push(`writeConcern: <code>${RS>1?'majority':'1'}</code> · readPreference: <code>primary</code>${RS>1?' / secondaryPreferred':''}`);
  return {svg:g.out(),facts,demo:info.demo};
}
function dbvModelMongo(b){
  const info=dbvSchemaInfo(b);const colls=dbvTables(info.sc);
  if(!colls.length)return dbvEmpty('Нет коллекций — загрузи готовую схему','No collections — load a template',info.demo);
  const c=dbvPickTable(colls);const key=dbvMongoShardKey(b,c).replace(' (hashed)','');
  const idxF=new Set();(c.indexes||[]).forEach(s=>{const m=/createIndex\(\{([^}]*)\}/.exec(s);if(m)m[1].split(',').forEach(p=>idxF.add(p.split(':')[0].trim().replace(/["']/g,'')));});
  const others=new Set(colls.map(x=>x.name));
  const g=dbvSvg();
  g.r(10,10,220,30,'dbv-docroot',4);g.t(20,30,'db.'+c.name+'  { document }','dbv-th dbv-mono');
  let y=50;const ROW=24;
  const walk=(fields,depth,px,py)=>{
    fields.forEach((f0,i)=>{
      const f=dbvNormF(f0);const x=20+depth*34;const isObj=/^Object/i.test(f.type)||(f.fields&&f.fields.length);const isArr=/^Array/i.test(f.type);
      const ty=y;
      g.path(`M${px},${py} V${ty+10} H${x}`,'dbv-tree');
      const w=Math.max(150,(f.name.length+String(f.type).length)*6.4+30);
      g.r(x,ty,w,20,'dbv-docnode '+(isObj?'dbv-doc-obj':isArr?'dbv-doc-arr':'dbv-doc-val'),3);
      g.t(x+6,ty+14,f.name,'dbv-ts dbv-mono dbv-b');
      g.t(x+w-6,ty+14,isObj?'{ }':isArr?String(f.type).replace(/^Array/,'[ ]'):String(f.type),'dbv-ts','end');
      const tags=[];
      if(f.name==='_id')tags.push(['_id','dbv-tag-pk']);
      if(f.name===key)tags.push(['shard key','dbv-tag-sk']);
      if(f.unique&&f.name!=='_id')tags.push(['unique','dbv-tag-uq']);
      else if(idxF.has(f.name)&&f.name!=='_id')tags.push(['index','dbv-tag-ix']);
      const ref=/_id$/.test(f.name)&&f.name!=='_id'?f.name.replace(/_id$/,''):null;
      const refColl=ref&&[...others].find(o=>o===ref||o===ref+'s'||o===ref+'es'||o.startsWith(ref));
      if(refColl)tags.push(['→ '+refColl,'dbv-tag-fk']);
      let tx=x+w+8;tags.forEach(([l,cls])=>{const tw=l.length*6+12;g.r(tx,ty+3,tw,14,'dbv-tag '+cls,2);g.t(tx+tw/2,ty+13,l,'dbv-tag-t','middle');tx+=tw+4;});
      g.t(Math.max(tx+6,x+w+12),ty+14,isObj?'':isArr?'':'e.g. '+dbvSample(f.name,f.type,i),'dbv-ts dbv-note',null,24);
      y+=ROW;
      if(f.fields&&f.fields.length)walk(f.fields,depth+1,x+14,ty+20);
    });
  };
  walk(c.fields||[],0,20,40);
  const nested=(c.fields||[]).filter(f=>f.fields&&f.fields.length||/^Array/i.test(f.type)).map(f=>f.name);
  return {svg:g.out(),pick:colls.map(x=>x.name),facts:[
    dbvL('Документ хранится целиком (BSON, до 16 МБ): вложенные объекты и массивы читаются за одно обращение — без JOIN.','A document is stored whole (BSON, ≤ 16 MB): nested objects and arrays are read in one fetch — no JOINs.'),
    nested.length?dbvL('Вложено: ','Embedded: ')+nested.map(n=>'<code>'+dbvE(n)+'</code>').join(', ')+dbvL(' — растущие массивы лучше выносить в отдельную коллекцию.',' — unbounded arrays are better moved to a separate collection.'):dbvL('Плоский документ — вложенностей нет.','Flat document — no nesting.'),
    `${dbvL('Индексы','Indexes')}: ${(c.indexes||[]).length?(c.indexes||[]).map(s=>'<code>'+dbvE(s.replace(/^db\.\w+\./,''))+'</code>').join(' '):'_id'} · shard key: <code>${dbvE(key)}</code>`,
  ],demo:info.demo};
}

// ═══ CASSANDRA ═════════════════════════════════════════════
function dbvCassKeys(t){
  const f=t?.fields||[];
  const pk=f.filter(x=>x.pk===true||/partition/i.test(x.pk||'')).map(x=>x.name);
  const ck=f.filter(x=>x.pk==='clustering').map(x=>x.name);
  const desc=/DESC/i.test((t?.clusteringOrder||'')+(t?.cqlExtra||''));
  const ttl=(/default_time_to_live\s*=\s*(\d+)/i.exec(t?.cqlExtra||'')||[])[1];
  return {pk:pk.length?pk:[f[0]?.name||'id'],ck,desc,ttl:ttl?+ttl:null};
}
function dbvTopoCass(b){
  const info=dbvSchemaInfo(b);const tables=dbvTables(info.sc);const t=tables[0];
  const N=dbvNum(b,'nodes',3,1,12),RF=Math.min(N,dbvNum(b,'rf',3,1,7)),CL=String(dbvS(b,'consistency')||'QUORUM').toUpperCase();
  const K=dbvCassKeys(t);
  const sampleKey=K.pk.map((p,i)=>dbvSample(p,'',i)).join(':');
  const tok=dbvHash(sampleKey)/4294967296;// 0..1 по кольцу
  const need=CL==='ONE'||CL==='LOCAL_ONE'?1:CL==='ALL'?RF:Math.floor(RF/2)+1;
  const g=dbvSvg();
  const cx=260,cy=230,R=170;
  g.c(cx,cy,R,'dbv-ring');
  const ang=p=>p*2*Math.PI-Math.PI/2;
  const pos=p=>[cx+R*Math.cos(ang(p)),cy+R*Math.sin(ang(p))];
  // ноды равномерно; владелец — первая нода по часовой от токена
  const nodeTok=i=>(i+1)/N;
  let owner=0;for(let i=0;i<N;i++){if(nodeTok(i)>=tok){owner=i;break;}}
  const repl=new Set();for(let r=0;r<RF;r++)repl.add((owner+r)%N);
  const acked=new Set([...repl].slice(0,need));
  const [tx,ty]=pos(tok);
  g.c(tx,ty,6,'dbv-token');
  g.t(tx+(tx>cx?10:-10),ty+(ty>cy?16:-10),'token(“'+sampleKey+'”)','dbv-ts dbv-mono dbv-b',tx>cx?null:'end',30);
  g.r(cx-70,cy-28,140,56,'dbv-node dbv-coord'+dbvHealth(b));
  g.t(cx,cy-10,dbvL('координатор','coordinator'),'dbv-th','middle');
  g.t(cx,cy+6,'CL = '+CL,'dbv-ts dbv-b','middle');
  g.t(cx,cy+20,`${dbvL('ждёт','waits')} ${need} / ${RF} ack`,'dbv-ts','middle');
  for(let i=0;i<N;i++){
    const [x,y]=pos(nodeTok(i)%1);
    const isR=repl.has(i),isA=acked.has(i);
    g.c(x,y,22,'dbv-ringnode'+(isR?' dbv-replica-hit':'')+(isA?' dbv-ack':''));
    g.t(x,y+4,'N'+(i+1),'dbv-ts dbv-b','middle');
    g.t(x+(x>=cx?28:-28),y+4,((i+1)/N*100).toFixed(0)+'%',' dbv-ts',x>=cx?null:'end');
    if(isR){const k=0.78;g.a(cx+(x-cx)*0.36,cy+(y-cy)*0.36,cx+(x-cx)*k,cy+(y-cy)*k,isA?'dbv-w':'dbv-r dbv-dash');}
  }
  // легенда
  const lx=cx+R+70;
  [['dbv-ringnode dbv-replica-hit dbv-ack',dbvL('реплика, ack учтён в CL','replica, ack counted for CL')],['dbv-ringnode dbv-replica-hit',dbvL('реплика, пишется асинхронно','replica, written async')],['dbv-ringnode',dbvL('не хранит этот ключ','does not own this key')]]
    .forEach(([c,l],i)=>{g.c(lx,60+i*28,9,c);g.t(lx+16,64+i*28,l,'dbv-ts dbv-legend');});
  g.t(lx,160,'RF = '+RF+' · nodes = '+N,'dbv-t dbv-b');
  g.t(lx,178,'partition key: ('+K.pk.join(', ')+')','dbv-ts dbv-mono');
  g.t(lx,196,'Murmur3Partitioner · vnodes','dbv-ts');
  const facts=[
    `${dbvL('Нет мастера: любая нода — координатор. Токен = Murmur3(partition key) → первая нода по часовой + ещё','Masterless: any node coordinates. Token = Murmur3(partition key) → first node clockwise + next')} ${RF-1} ${dbvL('по кольцу','along the ring')} (RF=${RF}).`,
    `CL=${CL}: ${dbvL('ответ клиенту после','client answered after')} ${need} ack. ${need+need>RF?dbvL('R+W > RF при том же CL на чтении → строгая согласованность.','R+W > RF with the same read CL → strong consistency.'):dbvL('R+W ≤ RF → возможны устаревшие чтения (eventual).','R+W ≤ RF → stale reads possible (eventual).')}`,
    RF>N?dbvL('RF больше числа нод — урезан до N.','RF exceeds node count — capped at N.'):'',
  ].filter(Boolean);
  return {svg:g.out(),facts,demo:info.demo};
}
function dbvModelCass(b){
  const info=dbvSchemaInfo(b);const tables=dbvTables(info.sc);
  if(!tables.length)return dbvEmpty('Нет таблиц — загрузи готовую схему','No tables — load a template',info.demo);
  const t=dbvPickTable(tables);const K=dbvCassKeys(t);const f=t.fields||[];
  const rest=f.filter(x=>!K.pk.includes(x.name)&&!K.ck.includes(x.name));
  const g=dbvSvg();
  g.r(10,8,640,26,'dbv-chipbox',3);
  g.t(18,25,`PRIMARY KEY ((${K.pk.join(', ')})${K.ck.length?', '+K.ck.join(', '):''})${K.ck.length?' · CLUSTERING ORDER '+(K.desc?'DESC':'ASC'):''}`,'dbv-t dbv-mono dbv-b');
  // 3 партиции — широкие строки
  const CWD=96,cols=rest.slice(0,4);
  let y=50;
  for(let p=0;p<3;p++){
    const pkv=K.pk.map(k=>dbvSample(k,'',p)).join(':');
    const rows=K.ck.length?3+(p%2):1;
    const h=22+rows*20+8;
    g.rb(10,y,170+(K.ck.length+cols.length)*CWD+20,h,'dbv-group');
    g.r(16,y+6,150,h-12,'dbv-pkcell',3);
    g.t(24,y+22,'partition','dbv-ts');g.t(24,y+38,pkv,'dbv-t dbv-mono dbv-b',null,20);
    g.t(24,y+54,'token '+(dbvHash(pkv)%1000),'dbv-ts dbv-mono');
    // заголовок колонок
    const hx=180;
    [...K.ck,...cols.map(c=>c.name)].forEach((n,j)=>g.t(hx+j*CWD+4,y+16,n,'dbv-ts dbv-b'+(j<K.ck.length?' dbv-mono':''),null,15));
    for(let r=0;r<rows;r++){
      const ry=y+22+r*20;const ri=K.desc?rows-1-r:r;
      K.ck.forEach((n,j)=>{g.r(hx+j*CWD,ry,CWD-4,17,'dbv-ckcell',2);g.t(hx+j*CWD+4,ry+12,dbvSample(n,(f.find(x=>x.name===n)||{}).type,ri+p),'dbv-ts dbv-mono',null,15);});
      cols.forEach((c,j)=>{const x=hx+(K.ck.length+j)*CWD;g.r(x,ry,CWD-4,17,'dbv-cell',2);g.t(x+4,ry+12,dbvSample(c.name,c.type,r+p),'dbv-ts',null,15);});
    }
    if(K.ck.length)g.t(hx+K.ck.length*CWD+cols.length*CWD+6,y+34,K.desc?'↑ DESC':'↓ ASC','dbv-ts dbv-b');
    y+=h+10;
  }
  // write path
  const wy=y+10;g.t(10,wy,dbvL('путь записи (LSM): append-only, без чтения перед записью','write path (LSM): append-only, no read-before-write'),'dbv-th');
  const st=[['commit log',dbvL('диск, последовательно','disk, sequential')],['memtable','RAM, '+dbvL('отсортировано','sorted')],['SSTable ×N',dbvL('неизменяемые файлы','immutable files')],['compaction','STCS / LCS / TWCS']];
  st.forEach((s,i)=>{const x=10+i*165;g.r(x,wy+10,148,38,i===2?'dbv-disk':'dbv-cell',3);g.t(x+74,wy+26,s[0],'dbv-ts dbv-b','middle');g.t(x+74,wy+40,s[1],'dbv-ts','middle');if(i<3)g.a(x+148,wy+29,x+165,wy+29,'dbv-thin');});
  const facts=[
    dbvL(`Partition key (${K.pk.join(', ')}) решает, НА КАКОЙ НОДЕ лежат данные; clustering key (${K.ck.join(', ')||'—'}) — В КАКОМ ПОРЯДКЕ строки внутри партиции.`,`Partition key (${K.pk.join(', ')}) decides WHICH NODE holds the data; clustering key (${K.ck.join(', ')||'—'}) — the ORDER of rows inside the partition.`),
    dbvL('Запрос обязан указывать partition key; диапазон допустим только по clustering key. Таблица проектируется под запрос (query-first), JOIN нет.','Queries must specify the partition key; ranges only on clustering key. Tables are designed per query (query-first), no JOINs.'),
    dbvL('Держите партицию < 100 МБ: для временных рядов добавляйте bucket (день/час) в partition key.','Keep partitions < 100 MB: for time series add a bucket (day/hour) to the partition key.'),
  ];
  if(K.ttl)facts.push(`default_time_to_live = ${K.ttl} ${dbvL('сек','s')} (${(K.ttl/86400).toFixed(1)} ${dbvL('дн.','d')}) — ${dbvL('истёкшие ячейки становятся tombstone и чистятся компакцией (TWCS).','expired cells become tombstones, purged by compaction (TWCS).')}`);
  return {svg:g.out(),pick:tables.map(x=>x.name),facts,demo:info.demo};
}

// ═══ S3 ════════════════════════════════════════════════════
function dbvTopoS3(b){
  const info=dbvSchemaInfo(b);const buckets=dbvTables(info.sc);
  const ver=!!dbvS(b,'versioning'),cls=dbvS(b,'storage_class')||'STANDARD',crr=!!dbvS(b,'crr');
  const g=dbvSvg();
  dbvNode(g,20,90,150,44,dbvClients(b)[0]?dbvName(dbvClients(b)[0]):dbvL('приложение','application'),'HTTPS · SigV4','dbv-client');
  const bl=buckets.length?buckets:[{name:'bucket',fields:[]}];
  const rx=220,rw=420;
  const rh=40+bl.length*92;
  g.rb(rx,20,rw,rh,'dbv-group');g.t(rx+10,38,'region eu-central-1','dbv-th');
  bl.slice(0,4).forEach((bk,i)=>{
    const y=50+i*92;
    g.r(rx+14,y,rw-28,80,'dbv-bucket'+dbvHealth(b),4);
    g.t(rx+24,y+18,'🪣 '+bk.name,'dbv-t dbv-b dbv-mono',null,34);
    g.t(rx+rw-24,y+18,(bk.fields||[]).length+dbvL(' шаблонов ключей',' key patterns')+(ver?' · versioning':''),'dbv-ts','end');
    ['AZ-a','AZ-b','AZ-c'].forEach((az,k)=>{g.r(rx+24+k*126,y+30,116,40,'dbv-disk',3);g.t(rx+82+k*126,y+47,az,'dbv-ts dbv-b','middle');g.t(rx+82+k*126,y+61,dbvL('копия объектов','object copy'),'dbv-ts','middle');});
    g.a(170,112,rx+14,y+40,'dbv-w dbv-thin');
  });
  if(crr){
    g.rb(rx+rw+40,20,200,110,'dbv-group');g.t(rx+rw+50,38,'region us-east-1','dbv-th');
    g.r(rx+rw+54,50,172,64,'dbv-bucket dbv-replica',4);g.t(rx+rw+140,78,dbvL('реплика бакета','bucket replica'),'dbv-ts dbv-b','middle');g.t(rx+rw+140,94,'CRR · async','dbv-ts','middle');
    g.a(rx+rw,90,rx+rw+54,82,'dbv-repl');
  }
  // lifecycle tiers
  const ty=Math.max(rh+40,170);
  const tiers=['STANDARD','STANDARD_IA','GLACIER','EXPIRE'];
  g.t(20,ty,dbvL('классы хранения / lifecycle','storage classes / lifecycle'),'dbv-th');
  const rules=bl.flatMap(x=>(x.lifecycle||[]).map(r=>({...r,bucket:x.name})));
  tiers.forEach((t,i)=>{const x=20+i*170;g.r(x,ty+10,150,40,'dbv-tier'+(t===cls?' dbv-tier-on':''),3);g.t(x+75,ty+27,t,'dbv-ts dbv-b','middle');
    g.t(x+75,ty+42,{STANDARD:'ms · $$$',STANDARD_IA:dbvL('ms · дешевле, плата за чтение','ms · cheaper, per-read fee'),GLACIER:dbvL('минуты–часы · $','minutes–hours · $'),EXPIRE:dbvL('удаление','deletion')}[t],'dbv-ts','middle',24);
    if(i<3){g.a(x+150,ty+30,x+170,ty+30,'dbv-thin');const r=rules.find(r=>r.to===tiers[i+1]);if(r)g.t(x+160,ty+64,r.prefix+' +'+r.after,'dbv-ts dbv-mono','middle');}});
  const facts=[
    dbvL('Объект сохраняется минимум в 3 зонах доступности региона (11 девяток durability). Сильная read-after-write согласованность.','An object is stored across ≥ 3 AZs in the region (11 nines durability). Strong read-after-write consistency.'),
    `${dbvL('Класс по умолчанию','Default class')}: <b>${dbvE(cls)}</b>${rules.length?' · lifecycle: '+rules.map(r=>`<code>${dbvE(r.bucket)}/${dbvE(r.prefix)}</code> → ${dbvE(r.to)} ${dbvL('через','after')} ${dbvE(r.after)}`).join(', '):''}`,
    crr?dbvL('Cross-Region Replication: асинхронная копия в другой регион (DR), требует versioning.','Cross-Region Replication: async copy to another region (DR), requires versioning.'):dbvL('Без CRR: авария региона = недоступность бакета.','No CRR: a region outage makes the bucket unavailable.'),
  ];
  if(crr&&!ver)facts.push('<span class="dbv-warn-t">⚠ '+dbvL('CRR без versioning в S3 не работает — включи versioning.','CRR requires versioning — enable it.')+'</span>');
  return {svg:g.out(),facts,demo:info.demo};
}
function dbvModelS3(b){
  const info=dbvSchemaInfo(b);const buckets=dbvTables(info.sc);
  if(!buckets.length)return dbvEmpty('Нет бакетов — загрузи готовую схему','No buckets — load a template',info.demo);
  const bk=dbvPickTable(buckets);const ver=!!dbvS(b,'versioning');
  const g=dbvSvg();
  // дерево префиксов
  const root={c:{},objs:[]};
  (bk.fields||[]).forEach(f=>{const parts=String(f.name).split('/');let n=root;parts.slice(0,-1).forEach(p=>{n=n.c[p]=n.c[p]||{c:{},objs:[]};});n.objs.push({name:parts[parts.length-1],f});});
  g.r(10,10,240,26,'dbv-bucket',4);g.t(20,28,'s3://'+bk.name+'/','dbv-th dbv-mono');
  let y=46;
  const walk=(n,depth,px,py)=>{
    Object.entries(n.c).forEach(([k,ch])=>{const x=20+depth*28,ty=y;g.path(`M${px},${py} V${ty+10} H${x}`,'dbv-tree');
      g.r(x,ty,Math.max(90,k.length*6.6+24),20,'dbv-prefix',3);g.t(x+6,ty+14,k+'/','dbv-ts dbv-mono dbv-b');y+=24;walk(ch,depth+1,x+12,ty+20);});
    n.objs.forEach(o=>{const x=20+depth*28,ty=y;g.path(`M${px},${py} V${ty+10} H${x}`,'dbv-tree');
      const w=Math.max(130,o.name.length*6.4+20);g.r(x,ty,w,20,'dbv-object',3);g.t(x+6,ty+14,o.name,'dbv-ts dbv-mono');
      g.t(x+w+8,ty+14,(o.f.type||'')+(o.f.size?' · '+o.f.size:''),'dbv-ts dbv-note');y+=24;});
  };
  walk(root,0,20,36);
  // карточка объекта
  const f0=(bk.fields||[])[0]||{name:'key',type:'application/octet-stream'};
  const ox=520,key=String(f0.name).replace(/\{(\w+)\}/g,(_,v)=>dbvSample(v,'',0));
  g.r(ox,10,300,128,'dbv-docnode',4);
  g.t(ox+10,28,dbvL('объект = ключ + байты + метаданные','object = key + bytes + metadata'),'dbv-th');
  [['Key',key],['Content-Type',f0.type||'—'],['Size',f0.size||'—'],['ETag','"9b2cf5…"'],['x-amz-storage-class',dbvS(b,'storage_class')||'STANDARD'],['x-amz-meta-*',dbvL('пользовательские','user-defined')]]
    .forEach(([k,v],i)=>{g.t(ox+10,48+i*15,k,'dbv-ts dbv-b');g.t(ox+130,48+i*15,v,'dbv-ts dbv-mono',null,28);});
  // версии
  const vy=158;g.t(ox,vy,ver?dbvL('versioning: каждая запись = новая версия','versioning: each write = new version'):dbvL('versioning выключен: PUT перезаписывает','versioning off: PUT overwrites'),'dbv-th');
  if(ver){
    [['v3',dbvL('delete marker','delete marker'),'dbv-delmark'],['v2','PUT 2026-11-03','dbv-version dbv-version-cur'],['v1','PUT 2026-10-20','dbv-version']].forEach(([v,l,c],i)=>{
      g.r(ox+i*10,vy+12+i*30,280-i*10,26,c,3);g.t(ox+i*10+8,vy+29+i*30,v+' · '+l,'dbv-ts dbv-b');});
    g.t(ox,vy+112,dbvL('GET без versionId → 404 (последняя — delete marker), v2 восстанавливается.','GET without versionId → 404 (latest is a delete marker); v2 is recoverable.'),'dbv-ts dbv-note');
  } else {g.r(ox,vy+12,280,26,'dbv-version dbv-version-cur',3);g.t(ox+8,vy+29,dbvL('одна текущая версия','single current version'),'dbv-ts dbv-b');}
  return {svg:g.out(),pick:buckets.map(x=>x.name),facts:[
    dbvL('Пространство ключей плоское: «папок» нет, «/» — просто символ в ключе; ListObjects с prefix+delimiter имитирует каталоги.','The keyspace is flat: no folders, "/" is just a character; ListObjects with prefix+delimiter emulates directories.'),
    dbvL('Объект неизменяем: изменить часть нельзя — только перезаписать целиком (большие файлы — multipart upload частями по 5 МБ+).','Objects are immutable: no partial updates, only full overwrite (big files via multipart upload, 5 MB+ parts).'),
    dbvL('Лимит ~3 500 PUT / 5 500 GET в сек на префикс — горячие ключи разносите по разным префиксам.','~3,500 PUT / 5,500 GET per second per prefix — spread hot keys across prefixes.'),
  ],demo:info.demo};
}
