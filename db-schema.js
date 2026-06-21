// DB-SCHEMA — ERD-диаграмма (Mermaid) + экспорт SQL/JSON + панель шаблонов

// ── SQL генерация ─────────────────────────────────────────────
function schemaToSQL(tmpl){
  if(!tmpl||!tmpl.schema) return '';
  const lines=[];
  const tables=tmpl.schema.tables||tmpl.schema.collections||[];
  // PostgreSQL / MySQL
  if(tmpl.type==='postgresql'||tmpl.type==='mysql'){
    if(tmpl.schema.pgExtension) lines.push(tmpl.schema.pgExtension,'');
    tables.forEach(t=>{
      lines.push(`-- Таблица: ${t.name}`);
      lines.push(`CREATE TABLE ${t.name} (`);
      const cols=[];
      t.fields.forEach(f=>{
        let col=`  ${f.name} ${f.type}`;
        if(f.pk) col+=' PRIMARY KEY';
        if(f.default) col+=` DEFAULT ${f.default}`;
        if(f.notNull&&!f.pk) col+=' NOT NULL';
        if(f.unique&&!f.pk) col+=' UNIQUE';
        cols.push(col);
      });
      // Foreign keys
      t.fields.filter(f=>f.fk).forEach(f=>{
        cols.push(`  CONSTRAINT fk_${t.name}_${f.name} FOREIGN KEY (${f.name}) REFERENCES ${f.fk.table}(${f.fk.field})${f.fk.onDelete?' ON DELETE '+f.fk.onDelete:''}`);
      });
      lines.push(cols.join(',\n'));
      lines.push(');','');
      // Индексы
      (t.indexes||[]).forEach(idx=>lines.push(idx+';'));
      if(t.indexes?.length) lines.push('');
    });
  }
  // MongoDB — команды
  if(tmpl.type==='mongodb'){
    const colls=tmpl.schema.collections||[];
    colls.forEach(c=>{
      lines.push(`// Коллекция: ${c.name}`);
      lines.push(`db.createCollection('${c.name}');`);
      (c.indexes||[]).forEach(idx=>lines.push(idx+';'));
      lines.push('');
    });
  }
  // Cassandra CQL
  if(tmpl.type==='cassandra'){
    tables.forEach(t=>{
      const pks=t.fields.filter(f=>f.pk===true).map(f=>f.name);
      const clusters=t.fields.filter(f=>f.pk==='clustering').map(f=>f.name);
      lines.push(`CREATE TABLE ${t.name} (`);
      t.fields.forEach(f=>lines.push(`  ${f.name} ${f.type},`));
      lines.push(`  PRIMARY KEY (${pks.join(', ')}${clusters.length?', '+clusters.join(', )'):')'})`);
      if(t.cqlExtra) lines[lines.length-1]+=' '+t.cqlExtra;
      lines.push(');','');
    });
  }
  // Redis — описание ключей
  if(tmpl.type==='redis'){
    (tmpl.schema.keys||[]).forEach(k=>{
      lines.push(`-- Ключ: ${k.pattern}`);
      lines.push(`-- Тип: ${k.type}, TTL: ${k.ttl||'нет'}`);
      lines.push(`-- Поля: ${k.fields.join(', ')}`);
      if(k.note) lines.push(`-- Заметка: ${k.note}`);
      lines.push('');
    });
  }
  // ClickHouse
  if(tmpl.type==='clickhouse'){
    tables.forEach(t=>{
      lines.push(`CREATE TABLE ${t.name} (`);
      t.fields.forEach(f=>lines.push(`  ${f.name} ${f.type},`));
      lines[lines.length-1]=lines[lines.length-1].replace(/,$/, '');
      lines.push(`)${t.engine?'\n'+t.engine:''};`,'');
    });
  }
  return lines.join('\n');
}

// ── Mermaid ERD генерация ─────────────────────────────────────
function schemaToMermaid(tmpl){
  if(!tmpl||!tmpl.schema) return '';
  const tables=tmpl.schema.tables||tmpl.schema.collections||[];
  if(!tables.length) return '---\ntitle: '+tmpl.name+'\n---\nerDiagram\n  (нет таблиц)';
  const lines=['---',`title: ${tmpl.name}`,'---','erDiagram'];
  tables.forEach(t=>{
    lines.push(`  ${t.name} {`);
    (t.fields||[]).forEach(f=>{
      const typeSafe=(f.type||'TEXT').replace(/[^a-zA-Z0-9_()]/g,'_').replace(/\s+/g,'_');
      const extra=(f.pk?'PK ':'')+(f.fk?'FK ':'')+f.name;
      lines.push(`    ${typeSafe} ${extra}`);
    });
    lines.push('  }');
  });
  // Отношения
  tables.forEach(t=>{
    (t.fields||[]).filter(f=>f.fk).forEach(f=>{
      lines.push(`  ${t.name} }o--|| ${f.fk.table} : "FK ${f.name}"`);
    });
  });
  return lines.join('\n');
}

// ── JSON экспорт схемы ────────────────────────────────────────
function schemaToJSON(tmpl){
  return JSON.stringify(tmpl.schema||{},null,2);
}

// ── Панель шаблонов БД ────────────────────────────────────────
function openDBTemplates(){
  const existing=document.getElementById('db-tmpl-modal');
  if(existing){existing.style.display='flex';renderDBTemplatesModal();return;}
  const ov=document.createElement('div');ov.id='db-tmpl-modal';ov.className='modal-ov';
  ov.style.display='flex';
  ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};
  ov.innerHTML=`
    <div class="modal-box" style="max-width:760px;width:96%">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="color:#4a90d9">🗄 Шаблоны баз данных (${DB_TEMPLATES.length})</h2>
        <button class="modal-btn" onclick="document.getElementById('db-tmpl-modal').style.display='none'">✕</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap" id="db-tmpl-filter">
        <button class="btn" onclick="filterDBType('')" data-t="">Все</button>
        <button class="btn" onclick="filterDBType('postgresql')" data-t="postgresql">PostgreSQL</button>
        <button class="btn" onclick="filterDBType('mongodb')" data-t="mongodb">MongoDB</button>
        <button class="btn" onclick="filterDBType('redis')" data-t="redis">Redis</button>
        <button class="btn" onclick="filterDBType('cassandra')" data-t="cassandra">Cassandra</button>
        <button class="btn" onclick="filterDBType('clickhouse')" data-t="clickhouse">ClickHouse</button>
      </div>
      <div id="db-tmpl-list" style="max-height:60vh;overflow-y:auto"></div>
    </div>`;
  document.body.appendChild(ov);
  renderDBTemplatesModal();
}

let _dbTypeFilter='';
function filterDBType(t){_dbTypeFilter=t;renderDBTemplatesModal();}
function renderDBTemplatesModal(){
  const list=document.getElementById('db-tmpl-list');if(!list)return;
  const filtered=DB_TEMPLATES.filter(t=>!_dbTypeFilter||t.type===_dbTypeFilter);
  list.innerHTML=filtered.map(tmpl=>`
    <div style="border:1px solid #3d3f52;border-radius:8px;padding:10px;margin-bottom:8px;background:#1a1b26">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:12px;font-weight:700;color:#c0caf5">${tmpl.name}</span>
        <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:#4a90d922;color:#4a90d9">${tmpl.type}</span>
        <div style="margin-left:auto;display:flex;gap:5px">
          <button class="btn" onclick="showDBSchema('${tmpl.id}','sql')" style="font-size:10px;padding:3px 8px">📋 SQL</button>
          <button class="btn" onclick="showDBSchema('${tmpl.id}','mermaid')" style="font-size:10px;padding:3px 8px">🔗 ERD</button>
          <button class="btn" onclick="showDBSchema('${tmpl.id}','json')" style="font-size:10px;padding:3px 8px">{ } JSON</button>
          <button class="btn run" onclick="addDBBlock('${tmpl.id}')" style="font-size:10px;padding:3px 8px">+ На схему</button>
        </div>
      </div>
      <div style="font-size:10px;color:#787c99">${tmpl.schema.tables?.map(t=>t.name).join(', ')||tmpl.schema.collections?.map(t=>t.name).join(', ')||tmpl.schema.keys?.map(k=>k.pattern).join(', ')||''}</div>
    </div>`).join('');
}

let _dbViewId=null,_dbViewMode=null;
function showDBSchema(id,mode){
  _dbViewId=id;_dbViewMode=mode;
  const tmpl=DB_TEMPLATES.find(t=>t.id===id);if(!tmpl)return;
  let content='';
  if(mode==='sql') content='<pre style="font-size:11px;line-height:1.5;white-space:pre-wrap;font-family:Consolas,monospace;color:#c0caf5;max-height:50vh;overflow-y:auto;background:#11121a;padding:12px;border-radius:7px">'+escHtml(schemaToSQL(tmpl))+'</pre>';
  else if(mode==='mermaid') content='<pre style="font-size:11px;line-height:1.5;white-space:pre-wrap;font-family:Consolas,monospace;color:#9ece6a;max-height:50vh;overflow-y:auto;background:#11121a;padding:12px;border-radius:7px">'+escHtml(schemaToMermaid(tmpl))+'</pre>';
  else content='<pre style="font-size:11px;line-height:1.5;white-space:pre-wrap;font-family:Consolas,monospace;color:#7dcfff;max-height:50vh;overflow-y:auto;background:#11121a;padding:12px;border-radius:7px">'+escHtml(schemaToJSON(tmpl))+'</pre>';
  const existing=document.getElementById('db-view-modal');
  if(existing){existing.innerHTML=buildDBViewModal(tmpl,content,mode);existing.style.display='flex';return;}
  const ov=document.createElement('div');ov.id='db-view-modal';ov.className='modal-ov';
  ov.innerHTML=buildDBViewModal(tmpl,content,mode);ov.style.display='flex';
  ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};
  document.body.appendChild(ov);
}
function buildDBViewModal(tmpl,content,mode){
  return `<div class="modal-box" style="max-width:700px;width:96%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h2 style="color:#4a90d9">${tmpl.name} — ${mode.toUpperCase()}</h2>
      <button class="modal-btn" onclick="document.getElementById('db-view-modal').style.display='none'">✕</button>
    </div>
    ${content}
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="modal-btn primary" onclick="copyDBSchema()">📋 Копировать</button>
      <button class="modal-btn" onclick="downloadDBSchema()">⬇ Скачать</button>
      <button class="modal-btn" onclick="document.getElementById('db-view-modal').style.display='none'">Закрыть</button>
    </div>
  </div>`;
}
function copyDBSchema(){
  const tmpl=DB_TEMPLATES.find(t=>t.id===_dbViewId);if(!tmpl)return;
  let text=_dbViewMode==='sql'?schemaToSQL(tmpl):_dbViewMode==='mermaid'?schemaToMermaid(tmpl):schemaToJSON(tmpl);
  navigator.clipboard.writeText(text).then(()=>toast('📋 Скопировано'));
}
function downloadDBSchema(){
  const tmpl=DB_TEMPLATES.find(t=>t.id===_dbViewId);if(!tmpl)return;
  let text=_dbViewMode==='sql'?schemaToSQL(tmpl):_dbViewMode==='mermaid'?schemaToMermaid(tmpl):schemaToJSON(tmpl);
  const ext=_dbViewMode==='json'?'json':_dbViewMode==='mermaid'?'mmd':'sql';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=`${tmpl.id}.${ext}`;a.click();
}

// Добавить блок БД на схему с привязанной схемой
function addDBBlock(id){
  const tmpl=DB_TEMPLATES.find(t=>t.id===id);if(!tmpl)return;
  const typeMap={postgresql:'postgresql',mongodb:'mongodb',redis:'redis',cassandra:'cassandra',clickhouse:'clickhouse',mysql:'mysql'};
  const btype=typeMap[tmpl.type]||'postgresql';
  const r=svgRct();
  const b={
    id:'b'+(S.nid++),
    type:btype,
    x:Math.max(20,Math.round(r.width/2-S.panX-60)),
    y:Math.max(40,Math.round(r.height/3-S.panY)),
    customLabel:tmpl.name.slice(0,20),
    patterns:[],settings:{},
    dbTemplate:id,
    dbSchema:tmpl.schema,
  };
  S.blocks.push(b);
  pushHist();analyze();
  toast('🗄 '+tmpl.name+' добавлена на схему');
  document.getElementById('db-tmpl-modal').style.display='none';
}

// Функция escHtml — может быть уже определена в routes.js
function escHtml(s){return typeof s==='string'?s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):String(s||'');}

// ── Готовая схема ВНУТРЬ выбранного PostgreSQL-блока (не глобально) ──
function applyDBTemplateToBlock(blockId,templateId){
  const b=gb(blockId),t=DB_TEMPLATES.find(x=>x.id===templateId);
  if(!b||!t)return;
  b.dbSchema=JSON.parse(JSON.stringify(t.schema));
  delete b.dbTemplate;
  if(!b.customLabel)b.customLabel=t.name.slice(0,20);
  pushHist();analyze();
  const m=document.getElementById('dbpick-modal');if(m)m.style.display='none';
  toast('🗄 Схема «'+t.name+'» загружена');
}
function openDBSchemaPicker(blockId){
  const b=gb(blockId);if(!b)return;
  const list=DB_TEMPLATES.filter(t=>t.type==='postgresql');
  let ov=document.getElementById('dbpick-modal');
  const inner=`<div class="modal-box" style="max-width:560px;width:96%">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h2 style="color:#4a90d9">📚 Готовая схема для «${escHtml(b.customLabel||EL[b.type].lbl)}»</h2>
      <button class="modal-btn" onclick="document.getElementById('dbpick-modal').style.display='none'">✕</button>
    </div>
    <div style="font-size:10.5px;color:#787c99;margin-bottom:8px">Лучшие практики — загрузка заменит таблицы этого блока.</div>
    <div style="max-height:60vh;overflow-y:auto">
    ${list.map(t=>`<div style="border:1px solid #3d3f52;border-radius:8px;padding:9px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div style="min-width:0"><div style="font-size:12px;font-weight:600;color:#c0caf5">${t.name}</div>
      <div style="font-size:9.5px;color:#787c99;overflow:hidden;text-overflow:ellipsis">${(t.schema.tables||[]).map(x=>x.name).join(', ')}</div></div>
      <button class="btn run" style="flex-shrink:0" onclick="applyDBTemplateToBlock('${blockId}','${t.id}')">Загрузить</button>
    </div>`).join('')}
    </div>
  </div>`;
  if(!ov){ov=document.createElement('div');ov.id='dbpick-modal';ov.className='modal-ov';ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};document.body.appendChild(ov);}
  ov.innerHTML=inner;ov.style.display='flex';
}

// ═══════════════════════════════════════════════════════════════
// РЕДАКТОР СХЕМЫ БД-БЛОКА (таблицы → поля с label/desc/example/ограничениями)
// ═══════════════════════════════════════════════════════════════
// Подсказки типов и ограничений PostgreSQL (datalist — выбор + свой ввод)
const PG_TYPES=['UUID','VARCHAR(255)','VARCHAR(100)','TEXT','INTEGER','BIGINT','SMALLINT','BOOLEAN','TIMESTAMP','TIMESTAMPTZ','DATE','TIME','DECIMAL(12,2)','NUMERIC(10,2)','REAL','DOUBLE PRECISION','JSONB','JSON','BYTEA','SERIAL','BIGSERIAL','INET','CHAR(3)'];
const PG_CONSTRAINTS=['PK','NN','UNIQUE','PK, default gen_random_uuid()','NN, UNIQUE','FK, NN','NN, default NOW()','CHECK (...)'];

let _dbEditId=null;
function openDBEditor(blockId){
  const b=gb(blockId);if(!b)return;
  if(b.type!=='postgresql'){toast('Реляционная схема (таблицы/FK/ACID) — только для PostgreSQL');return;}
  // Если привязан шаблон — скопировать его схему в собственную (чтобы можно было править)
  if(b.dbTemplate && !b.dbSchema){
    const t=DB_TEMPLATES.find(x=>x.id===b.dbTemplate);
    if(t)b.dbSchema=JSON.parse(JSON.stringify(t.schema));
    delete b.dbTemplate;
  }
  if(!b.dbSchema)b.dbSchema={tables:[]};
  if(!b.dbSchema.tables&&b.dbSchema.collections)b.dbSchema.tables=b.dbSchema.collections;
  if(!b.dbSchema.tables)b.dbSchema.tables=[];
  _dbEditId=blockId;
  let ov=$('dbedit-modal');
  if(!ov){ov=document.createElement('div');ov.id='dbedit-modal';ov.className='modal-ov';
    ov.onclick=e=>{if(e.target===ov)closeDBEditor();};document.body.appendChild(ov);}
  ov.style.display='flex';renderDBEditor();
}
function closeDBEditor(){const ov=$('dbedit-modal');if(ov)ov.style.display='none';_dbEditId=null;pushHist();analyze();}
function renderDBEditor(){
  const b=gb(_dbEditId);if(!b)return;const sc=b.dbSchema;const ov=$('dbedit-modal');if(!ov)return;
  const inp='background:#1a1b26;border:1px solid #3d3f52;border-radius:4px;padding:3px 6px;font-size:10.5px;color:#c0caf5;outline:none;font-family:inherit;width:100%';
  const fkOpts=fkOptions(sc);
  const isPG=['postgresql','mysql'].includes(b.type); // реляционная логика — для SQL-БД
  const typeList=`<datalist id="dl-types">${PG_TYPES.map(t=>`<option value="${t}">`).join('')}</datalist>`;
  const consList=`<datalist id="dl-cons">${PG_CONSTRAINTS.map(t=>`<option value="${t}">`).join('')}</datalist>`;
  ov.innerHTML=`<div class="modal-box" style="max-width:900px;width:98%">${typeList}${consList}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h2 style="color:#4a90d9">🗄 Схема: ${escHtml(b.customLabel||EL[b.type]?.lbl)}</h2>
      <button class="modal-btn" onclick="closeDBEditor()">✕</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="modal-btn" style="margin-top:0" onclick="openSQLImport('${_dbEditId}')" title="Создать таблицы вставкой SQL (CREATE TABLE)">📥 Импорт SQL</button>
      ${isPG?'':'<span style="font-size:10px;color:#e0af68;align-self:center">⚠ Реляционная схема рассчитана на PostgreSQL/MySQL</span>'}
    </div>
    <div style="max-height:58vh;overflow-y:auto">
    ${(sc.tables||[]).map((t,ti)=>`
      <div style="border:1px solid #3d3f52;border-radius:8px;padding:10px;margin-bottom:10px;background:#1a1b26">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;color:#787c99">Таблица:</span>
          <input style="${inp};max-width:220px;font-weight:700" value="${escHtml(t.name||'')}" oninput="gb('${_dbEditId}').dbSchema.tables[${ti}].name=this.value">
          <button class="btn" onclick="gb('${_dbEditId}').dbSchema.tables.splice(${ti},1);renderDBEditor()" style="color:#f7768e;margin-left:auto">✕ таблица</button>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <thead><tr style="color:#787c99;text-align:left">
            <th style="padding:2px">Поле</th><th style="padding:2px">Наименование</th><th style="padding:2px">Тип</th>
            <th style="padding:2px">Ограничения</th><th style="padding:2px">Описание</th><th style="padding:2px">Пример</th><th style="padding:2px">FK →</th><th></th>
          </tr></thead><tbody>
          ${(t.fields||[]).map((f,fi)=>`<tr>
            <td style="padding:1px"><input style="${inp}" value="${escHtml(f.name||'')}" oninput="gb('${_dbEditId}').dbSchema.tables[${ti}].fields[${fi}].name=this.value"></td>
            <td style="padding:1px"><input style="${inp}" value="${escHtml(f.label||'')}" oninput="gb('${_dbEditId}').dbSchema.tables[${ti}].fields[${fi}].label=this.value"></td>
            <td style="padding:1px">${dbSel(f.type||'',PG_TYPES,`setFieldType('${_dbEditId}',${ti},${fi},this.value)`,130,false)}</td>
            <td style="padding:1px">${dbSel(dbFieldConstraintsStr(f),PG_CONSTRAINTS,`setFieldCons('${_dbEditId}',${ti},${fi},this.value)`,140,true)}</td>
            <td style="padding:1px"><input style="${inp}" value="${escHtml(f.desc||'')}" oninput="gb('${_dbEditId}').dbSchema.tables[${ti}].fields[${fi}].desc=this.value"></td>
            <td style="padding:1px"><input style="${inp}" value="${escHtml(f.example||'')}" oninput="gb('${_dbEditId}').dbSchema.tables[${ti}].fields[${fi}].example=this.value"></td>
            <td style="padding:1px;white-space:nowrap">
              <select style="${inp};width:115px" onchange="setFieldFk('${_dbEditId}',${ti},${fi},this.value)"><option value="">— нет —</option>${fkOpts.map(o=>`<option ${f.fk&&(f.fk.table+'.'+f.fk.field)===o?'selected':''}>${o}</option>`).join('')}</select>
              ${f.fk?`<select style="${inp};width:56px" title="кардинальность" onchange="setFieldCard('${_dbEditId}',${ti},${fi},this.value)">${['N:1','1:1','1:N','N:M'].map(cc=>`<option ${(f.fk.card||'N:1')===cc?'selected':''}>${cc}</option>`).join('')}</select>`:''}
            </td>
            <td style="padding:1px"><span onclick="gb('${_dbEditId}').dbSchema.tables[${ti}].fields.splice(${fi},1);renderDBEditor()" style="cursor:pointer;color:#f7768e">✕</span></td>
          </tr>`).join('')}
          </tbody></table>
        <button class="btn" onclick="gb('${_dbEditId}').dbSchema.tables[${ti}].fields.push({name:'',label:'',type:'varchar',constraints:'',desc:'',example:''});renderDBEditor()" style="margin-top:5px;font-size:10px">＋ поле</button>
        <div style="margin-top:8px;border-top:1px solid #3d3f52;padding-top:6px">
          <div style="font-size:10px;color:#9ece6a;margin-bottom:4px">📑 Индексы (ускоряют чтение — для реализма симуляции)</div>
          ${(t.indexes||[]).map((idx,xi)=>`<div style="display:flex;gap:5px;margin-bottom:3px">
            <input style="${inp}" value="${escHtml(idx)}" oninput="gb('${_dbEditId}').dbSchema.tables[${ti}].indexes[${xi}]=this.value">
            <span onclick="gb('${_dbEditId}').dbSchema.tables[${ti}].indexes.splice(${xi},1);renderDBEditor()" style="cursor:pointer;color:#f7768e;align-self:center">✕</span>
          </div>`).join('')}
          <button class="btn" onclick="addIndexToTable(${ti})" style="font-size:10px">＋ индекс</button>
        </div>
      </div>`).join('')}
    </div>
    <button class="btn" onclick="gb('${_dbEditId}').dbSchema.tables.push({name:'new_table',fields:[]});renderDBEditor()" style="margin-top:6px">＋ Таблица</button>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="modal-btn primary" onclick="closeDBEditor()">Готово</button>
      <button class="modal-btn" onclick="showERDVisual('${_dbEditId}')">🔗 ERD (схема)</button>
      <button class="modal-btn" onclick="showDBSchemaForBlock('${_dbEditId}','sql')">📋 SQL</button>
      <button class="modal-btn" onclick="showDBSchemaForBlock('${_dbEditId}','mermaid')">📝 Mermaid</button>
      <button class="modal-btn" onclick="showDBSchemaForBlock('${_dbEditId}','json')">{ } JSON</button>
    </div>
  </div>`;
}
// строка ограничений для поля (нормализует старые флаги в строку)
function dbFieldConstraintsStr(f){return (typeof fieldConstraints==='function')?fieldConstraints(f):(f.constraints||'');}

// Добавить индекс таблице (готовый шаблон CREATE INDEX по первому подходящему полю)
function addIndexToTable(ti){
  const b=gb(_dbEditId);if(!b||!b.dbSchema)return;
  const t=b.dbSchema.tables[ti];if(!t)return;
  if(!t.indexes)t.indexes=[];
  const fld=(t.fields||[]).find(f=>/FK|NN/i.test(dbFieldConstraintsStr(f))&&!/PK/i.test(dbFieldConstraintsStr(f)))||(t.fields||[])[0];
  const fn=fld?fld.name:'column';
  t.indexes.push(`CREATE INDEX idx_${t.name}_${fn} ON ${t.name}(${fn})`);
  renderDBEditor();
}

// ── ИМПОРТ СХЕМЫ ПО SQL (CREATE TABLE / CREATE INDEX) ─────────
function splitTopLevel(body){
  const out=[];let depth=0,cur='';
  for(const ch of body){
    if(ch==='(')depth++;else if(ch===')')depth--;
    if(ch===','&&depth===0){out.push(cur);cur='';}else cur+=ch;
  }
  if(cur.trim())out.push(cur);
  return out;
}
function parseSQLToSchema(sql){
  const tables=[];
  const tre=/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi;
  let m;
  while(m=tre.exec(sql)){
    const name=m[1];const fields=[];
    splitTopLevel(m[2]).forEach(part=>{
      const p=part.trim();if(!p)return;
      const up=p.toUpperCase();
      // табличные ограничения
      if(/^(PRIMARY KEY|CONSTRAINT|FOREIGN KEY|UNIQUE|CHECK|INDEX|KEY)\b/.test(up)){
        const fk=p.match(/FOREIGN KEY\s*\(\s*["`]?(\w+)["`]?\s*\)\s*REFERENCES\s+["`]?(\w+)["`]?\s*\(\s*["`]?(\w+)["`]?\s*\)/i);
        if(fk){const f=fields.find(x=>x.name===fk[1]);if(f){f.fk={table:fk[2],field:fk[3]};if(!/FK/i.test(f.constraints))f.constraints=(f.constraints?f.constraints+', ':'')+'FK';}}
        const pk=p.match(/PRIMARY KEY\s*\(\s*["`]?(\w+)/i);
        if(pk){const f=fields.find(x=>x.name===pk[1]);if(f&&!/PK/i.test(f.constraints))f.constraints=(f.constraints?'PK, '+f.constraints:'PK');}
        return;
      }
      const cm=p.match(/^["`]?(\w+)["`]?\s+([A-Za-z][A-Za-z0-9_]*(?:\s*\([\d,\s]+\))?)\s*([\s\S]*)$/);
      if(!cm)return;
      const rest=(cm[3]||'').toUpperCase();
      const cons=[];
      if(/PRIMARY KEY/.test(rest))cons.push('PK');
      if(/NOT NULL/.test(rest))cons.push('NN');
      if(/UNIQUE/.test(rest))cons.push('UNIQUE');
      const field={name:cm[1],label:'',type:cm[2].replace(/\s+/g,''),constraints:cons.join(', '),desc:'',example:''};
      const ref=cm[3]&&cm[3].match(/REFERENCES\s+["`]?(\w+)["`]?\s*\(\s*["`]?(\w+)["`]?\s*\)/i);
      if(ref){field.fk={table:ref[1],field:ref[2]};if(!cons.includes('FK'))field.constraints=(field.constraints?field.constraints+', ':'')+'FK';}
      const def=p.match(/DEFAULT\s+([^,]+?)(?:\s+NOT|\s+UNIQUE|\s*$)/i);
      if(def)field.default=def[1].trim();
      fields.push(field);
    });
    tables.push({name,fields,indexes:[]});
  }
  // индексы
  const ire=/CREATE\s+(?:UNIQUE\s+)?INDEX\s+\w+\s+ON\s+["`]?(\w+)["`]?[^;]*/gi;
  let im;while(im=ire.exec(sql)){const t=tables.find(x=>x.name===im[1]);if(t)t.indexes.push(im[0].trim());}
  return {tables};
}
function openSQLImport(blockId){
  let ov=document.getElementById('sqlimport-modal');
  const inner=`<div class="modal-box" style="max-width:640px;width:96%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <h2 style="color:#4a90d9">📥 Импорт схемы из SQL</h2>
      <button class="modal-btn" onclick="document.getElementById('sqlimport-modal').style.display='none'">✕</button>
    </div>
    <div style="font-size:10.5px;color:#787c99;margin-bottom:8px">Вставь <b>CREATE TABLE</b> (и при желании CREATE INDEX). Распарсю в таблицы/поля/FK/индексы.</div>
    <textarea id="sqlimport-ta" spellcheck="false" style="width:100%;height:240px;background:#11121a;color:#c0caf5;border:1px solid #3d3f52;border-radius:7px;padding:10px;font-family:Consolas,monospace;font-size:11px;outline:none;resize:vertical" placeholder="CREATE TABLE users (&#10;  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),&#10;  email VARCHAR(255) NOT NULL UNIQUE,&#10;  created_at TIMESTAMP DEFAULT NOW()&#10;);"></textarea>
    <div style="margin-top:10px;display:flex;gap:8px">
      <button class="modal-btn primary" onclick="doSQLImport('${blockId}')">Импортировать</button>
      <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#9aa5ce"><input type="checkbox" id="sqlimport-replace"> заменить текущие таблицы</label>
    </div>
  </div>`;
  if(!ov){ov=document.createElement('div');ov.id='sqlimport-modal';ov.className='modal-ov';ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};document.body.appendChild(ov);}
  ov.innerHTML=inner;ov.style.display='flex';
}
function doSQLImport(blockId){
  const b=gb(blockId);if(!b)return;
  const sql=document.getElementById('sqlimport-ta').value;
  const parsed=parseSQLToSchema(sql);
  if(!parsed.tables.length){toast('Не нашёл CREATE TABLE — проверь синтаксис');return;}
  if(!b.dbSchema)b.dbSchema={tables:[]};
  if(!b.dbSchema.tables)b.dbSchema.tables=[];
  const replace=document.getElementById('sqlimport-replace')?.checked;
  if(replace)b.dbSchema.tables=parsed.tables;
  else b.dbSchema.tables=b.dbSchema.tables.concat(parsed.tables);
  delete b.dbTemplate;
  document.getElementById('sqlimport-modal').style.display='none';
  pushHist();renderDBEditor();
  toast(`📥 Импортировано таблиц: ${parsed.tables.length}`);
}

// ═══════════════════════════════════════════════════════════════
// ВИЗУАЛЬНЫЙ ERD (SVG): таблицы-боксы + FK-линии между ними
// ═══════════════════════════════════════════════════════════════
// crow's foot нотация на конце линии. (x,y)=точка у края таблицы, dir=+1 линия уходит вправо, -1 влево.
// kind: 'one' (||) | 'many' (раздвоенная лапка) | 'onemany' опускаем.
function erdEndSymbol(x,y,dir,kind){
  const c='#5a6b8c',sw=1.6;const L=12,sp=6;
  if(kind==='many'){
    // лапка: из точки на расстоянии L три линии в саму точку (веер)
    const bx=x+dir*L;
    return `<line x1="${bx}" y1="${y}" x2="${x}" y2="${y-sp}" stroke="${c}" stroke-width="${sw}"/>`+
           `<line x1="${bx}" y1="${y}" x2="${x}" y2="${y}" stroke="${c}" stroke-width="${sw}"/>`+
           `<line x1="${bx}" y1="${y}" x2="${x}" y2="${y+sp}" stroke="${c}" stroke-width="${sw}"/>`;
  }
  // 'one' — одна поперечная черта чуть в стороне от края
  const ox=x+dir*8;
  return `<line x1="${ox}" y1="${y-sp}" x2="${ox}" y2="${y+sp}" stroke="${c}" stroke-width="${sw}"/>`;
}
function renderERDSvg(schema){
  const tables=(schema&&(schema.tables||schema.collections))||[];
  if(!tables.length)return '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="60"><text x="14" y="34" font-family="Arial" font-size="13" fill="#888">Нет таблиц — добавь через редактор</text></svg>';
  const colW=230,rowH=20,headH=30,gapX=130,gapY=64,perRow=Math.min(3,Math.max(1,tables.length));
  const pos={};const colY=new Array(perRow).fill(30);
  tables.forEach((t,i)=>{
    const col=i%perRow;
    const h=headH+(t.fields||[]).length*rowH+8;
    pos[t.name]={x:30+col*(colW+gapX),y:colY[col],w:colW,h,col,fieldsN:(t.fields||[]).length};
    colY[col]+=h+gapY;
  });
  const totalW=30+perRow*(colW+gapX)+20;
  const totalH=Math.max(...colY)+20;
  let boxes='',lines='';
  // ── боксы таблиц ──
  tables.forEach(t=>{
    const p=pos[t.name];if(!p)return;
    boxes+=`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="7" fill="#ffffff" stroke="#9bb4cf" stroke-width="1.3" filter="url(#erdShadow)"/>`;
    boxes+=`<path d="M${p.x} ${p.y+7} Q ${p.x} ${p.y} ${p.x+7} ${p.y} L ${p.x+p.w-7} ${p.y} Q ${p.x+p.w} ${p.y} ${p.x+p.w} ${p.y+7} L ${p.x+p.w} ${p.y+headH} L ${p.x} ${p.y+headH} Z" fill="#4a90d9"/>`;
    boxes+=`<text x="${p.x+p.w/2}" y="${p.y+19}" text-anchor="middle" font-family="Arial" font-size="12.5" font-weight="bold" fill="#fff">${escHtml(t.name)}</text>`;
    (t.fields||[]).forEach((f,fi)=>{
      const fy=p.y+headH+fi*rowH+14;
      const cons=dbFieldConstraintsStr(f);
      const isPk=/\bPK\b/i.test(cons),isFk=/\bFK\b/i.test(cons)||f.fk;
      const badge=isPk?'🔑':isFk?'🔗':'';
      boxes+=`<text x="${p.x+9}" y="${fy}" font-family="Arial" font-size="10.5" fill="#1e2030" font-weight="${isPk?'bold':'normal'}">${badge?badge+' ':''}${escHtml(f.name)}</text>`;
      boxes+=`<text x="${p.x+p.w-9}" y="${fy}" text-anchor="end" font-family="monospace" font-size="9" fill="#8a93a8">${escHtml((f.type||'').slice(0,16))}</text>`;
      if(fi<(t.fields||[]).length-1)boxes+=`<line x1="${p.x+1}" y1="${p.y+headH+(fi+1)*rowH}" x2="${p.x+p.w-1}" y2="${p.y+headH+(fi+1)*rowH}" stroke="#eef1f5"/>`;
    });
  });
  // ── связи: ортогональная разводка + кардинальность (crow's foot) ──
  tables.forEach(t=>{
    const p=pos[t.name];if(!p)return;
    (t.fields||[]).forEach((f,fi)=>{
      if(!f.fk||!f.fk.table)return;
      const tgt=pos[f.fk.table];if(!tgt)return;
      const card=(f.fk.card||'N:1');
      const sy=p.y+headH+fi*rowH+10;
      // сторона выхода у источника — ближе к цели
      const srcRight=(p.x+p.w/2)<=(tgt.x+tgt.w/2);
      const sx=srcRight?p.x+p.w:p.x; const sdir=srcRight?1:-1;
      // цель: входим в ближнюю сторону, по центру таблицы
      const tgtRight=(tgt.x+tgt.w/2)<(p.x+p.w/2);
      const tx=tgtRight?tgt.x+tgt.w:tgt.x; const tdir=tgtRight?1:-1;
      const ty=tgt.y+headH+Math.min((tgt.fieldsN-1),0)*rowH+10; // у первой строки цели (обычно PK)
      const mx=sx+sdir*Math.max(28,Math.abs(tx-sx)/2);
      // ортогональный путь: H до mx, V до ty, H до tx
      const d=`M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      lines+=`<path d="${d}" fill="none" stroke="#5a6b8c" stroke-width="1.4"/>`;
      // символы кардинальности: source-конец и target-конец
      const srcKind=(card==='N:1'||card==='N:M')?'many':'one';
      const tgtKind=(card==='1:N'||card==='N:M')?'many':'one';
      lines+=erdEndSymbol(sx,sy,sdir,srcKind);
      lines+=erdEndSymbol(tx,ty,tdir,tgtKind);
      // подпись кардинальности у середины
      lines+=`<rect x="${mx-15}" y="${(sy+ty)/2-8}" width="30" height="15" rx="3" fill="#fff" stroke="#cdd6e6"/><text x="${mx}" y="${(sy+ty)/2+3}" text-anchor="middle" font-family="Arial" font-size="9" font-weight="bold" fill="#e0935a">${card}</text>`;
    });
  });
  const defs=`<defs><filter id="erdShadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#9bb4cf" flood-opacity="0.4"/></filter></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(totalW)}" height="${Math.round(totalH)}" font-family="Arial">${defs}<rect width="100%" height="100%" fill="#f3f6fa"/>${lines}${boxes}</svg>`;
}
// ── Интерактивный ERD с перетаскиванием таблиц ──────────────────
const _erd={drag:null,blockId:null};

function showERDVisual(blockId){
  const b=gb(blockId);if(!b)return;
  _erd.blockId=blockId;
  if(!b.dbSchema)b.dbSchema={tables:[]};
  _erdInitPos(b);

  let ov=document.getElementById('erd-modal');
  if(!ov){ov=document.createElement('div');ov.id='erd-modal';ov.className='modal-ov';
    ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};document.body.appendChild(ov);}

  ov.innerHTML=`<div class="modal-box" style="max-width:94vw;width:94vw;padding:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h2 style="color:#4a90d9">🔗 ERD: ${escHtml(b.customLabel||EL[b.type]?.lbl)}</h2>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:10px;color:#787c99">Перетаскивай таблицы</span>
        <button class="modal-btn" style="margin-top:0" onclick="_erdAutoLayout('${blockId}')">📐 Авто</button>
        <button class="modal-btn" onclick="document.getElementById('erd-modal').style.display='none'">✕</button>
      </div>
    </div>
    <div id="erd-wrap" style="overflow:auto;border-radius:8px;background:#f3f6fa;border:1px solid #dde3ee;height:72vh;user-select:none">
      <svg id="erd-svg" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial;display:block"></svg>
    </div>
  </div>`;
  ov.style.display='flex';
  _erdDraw();
}

function _erdInitPos(b){
  const tables=(b.dbSchema?.tables||b.dbSchema?.collections||[]);
  if(!b.dbSchema.positions)b.dbSchema.positions={};
  const colW=250,gap=80,perRow=Math.min(3,Math.max(1,tables.length));
  const rowY=new Array(perRow).fill(30);
  tables.forEach((t,i)=>{
    if(b.dbSchema.positions[t.name])return; // уже есть — не трогаем
    const col=i%perRow;
    const h=30+(t.fields||[]).length*22+10;
    b.dbSchema.positions[t.name]={x:30+col*(colW+gap),y:rowY[col]};
    rowY[col]+=h+50;
  });
}

function _erdAutoLayout(blockId){
  const b=gb(blockId);if(!b?.dbSchema)return;
  delete b.dbSchema.positions;
  _erdInitPos(b);
  _erdDraw();
}

function _erdDraw(){
  const b=gb(_erd.blockId);if(!b)return;
  const svg=document.getElementById('erd-svg');if(!svg)return;
  const tables=(b.dbSchema?.tables||b.dbSchema?.collections||[]);
  const pos=b.dbSchema.positions||{};
  const colW=250,rowH=22,headH=30;

  // вычислить размеры каждой таблицы
  const sz={};
  tables.forEach(t=>{
    const p=pos[t.name]||{x:30,y:30};
    sz[t.name]={x:p.x,y:p.y,w:colW,h:headH+(t.fields||[]).length*rowH+8};
  });

  let maxX=600,maxY=400;
  Object.values(sz).forEach(s=>{maxX=Math.max(maxX,s.x+s.w+40);maxY=Math.max(maxY,s.y+s.h+40);});
  svg.setAttribute('width',maxX);svg.setAttribute('height',maxY);
  svg.setAttribute('viewBox',`0 0 ${maxX} ${maxY}`);

  const defs=`<defs><filter id="es" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#9bb4cf" flood-opacity="0.45"/></filter></defs>`;
  let fkLines='',boxes='';

  // FK-линии
  tables.forEach(t=>{
    const p=sz[t.name];if(!p)return;
    (t.fields||[]).forEach((f,fi)=>{
      if(!f.fk||!f.fk.table)return;
      const tgt=sz[f.fk.table];if(!tgt)return;
      const card=f.fk.card||'N:1';
      const sy=p.y+headH+fi*rowH+11;
      const srcR=(p.x+p.w/2)<=(tgt.x+tgt.w/2);
      const sx=srcR?p.x+p.w:p.x,sdir=srcR?1:-1;
      const tgtR=(tgt.x+tgt.w/2)<(p.x+p.w/2);
      const tx=tgtR?tgt.x+tgt.w:tgt.x,tdir=tgtR?1:-1;
      const ty=tgt.y+headH+11;
      const mx=sx+sdir*Math.max(24,Math.abs(tx-sx)/2);
      fkLines+=`<path d="M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}" fill="none" stroke="#5a6b8c" stroke-width="1.5"/>`;
      const sk=(card==='N:1'||card==='N:M')?'many':'one';
      const tk=(card==='1:N'||card==='N:M')?'many':'one';
      fkLines+=erdEndSymbol(sx,sy,sdir,sk)+erdEndSymbol(tx,ty,tdir,tk);
      fkLines+=`<rect x="${mx-14}" y="${(sy+ty)/2-7}" width="28" height="14" rx="3" fill="#fff" stroke="#cdd6e6"/><text x="${mx}" y="${(sy+ty)/2+4}" text-anchor="middle" font-size="9" font-weight="bold" fill="#e0935a">${card}</text>`;
    });
  });

  // Таблицы
  tables.forEach(t=>{
    const p=sz[t.name];if(!p)return;
    boxes+=`<g data-tbl="${escHtml(t.name)}" style="cursor:grab">`;
    boxes+=`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="7" fill="#fff" stroke="#9bb4cf" stroke-width="1.3" filter="url(#es)"/>`;
    boxes+=`<path d="M${p.x} ${p.y+7} Q ${p.x} ${p.y} ${p.x+7} ${p.y} L ${p.x+p.w-7} ${p.y} Q ${p.x+p.w} ${p.y} ${p.x+p.w} ${p.y+7} L ${p.x+p.w} ${p.y+headH} L ${p.x} ${p.y+headH} Z" fill="#4a90d9"/>`;
    boxes+=`<text x="${p.x+p.w/2}" y="${p.y+19}" text-anchor="middle" font-size="12.5" font-weight="bold" fill="#fff">${escHtml(t.name)}</text>`;
    (t.fields||[]).forEach((f,fi)=>{
      const fy=p.y+headH+fi*rowH+15;
      const cons=dbFieldConstraintsStr(f);
      const isPk=/\bPK\b/i.test(cons),isFk=/\bFK\b/i.test(cons)||f.fk;
      boxes+=`<text x="${p.x+9}" y="${fy}" font-size="10.5" fill="#1e2030" font-weight="${isPk?'bold':'normal'}">${isPk?'🔑 ':isFk?'🔗 ':''}${escHtml(f.name)}</text>`;
      boxes+=`<text x="${p.x+p.w-9}" y="${fy}" text-anchor="end" font-family="monospace" font-size="9" fill="#8a93a8">${escHtml((f.type||'').slice(0,16))}</text>`;
      if(fi<(t.fields||[]).length-1)boxes+=`<line x1="${p.x+1}" y1="${p.y+headH+(fi+1)*rowH}" x2="${p.x+p.w-1}" y2="${p.y+headH+(fi+1)*rowH}" stroke="#eef1f5"/>`;
    });
    boxes+=`</g>`;
  });

  svg.innerHTML=defs+`<rect width="100%" height="100%" fill="#f3f6fa"/>`+fkLines+boxes;

  // Вешаем drag на все группы
  svg.querySelectorAll('g[data-tbl]').forEach(g=>{
    g.addEventListener('mousedown',e=>_erdMD(e,g.dataset.tbl));
  });
}

function _erdPt(e){
  const svg=document.getElementById('erd-svg');if(!svg)return{x:0,y:0};
  const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function _erdMD(e,tname){
  e.preventDefault();
  const b=gb(_erd.blockId);if(!b?.dbSchema?.positions)return;
  const p=_erdPt(e);
  const cur=b.dbSchema.positions[tname]||{x:0,y:0};
  _erd.drag={name:tname,ox:p.x-cur.x,oy:p.y-cur.y};
  const onMove=ev=>{
    if(!_erd.drag)return;
    const mp=_erdPt(ev);
    const b2=gb(_erd.blockId);if(!b2?.dbSchema?.positions)return;
    b2.dbSchema.positions[_erd.drag.name]={x:Math.max(0,mp.x-_erd.drag.ox),y:Math.max(0,mp.y-_erd.drag.oy)};
    _erdDraw();
  };
  const onUp=()=>{
    _erd.drag=null;
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    pushHist();
  };
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
}
// варианты целей для FK: все поля всех таблиц текущей схемы в формате table.field
function fkOptions(schema,exceptTable){
  const tables=(schema&&(schema.tables||schema.collections))||[];
  const opts=[];
  tables.forEach(t=>{(t.fields||[]).forEach(f=>{opts.push(`${t.name}.${f.name}`);});});
  return opts;
}
// установить FK на поле + дописать «FK» в ограничения (+ кардинальность по умолчанию)
function setFieldFk(blockId,ti,fi,val){
  const b=gb(blockId);if(!b||!b.dbSchema)return;
  const f=b.dbSchema.tables?.[ti]?.fields?.[fi];if(!f)return;
  if(!val){delete f.fk;f.constraints=(dbFieldConstraintsStr(f)).replace(/\bFK\b,?\s*/g,'').replace(/,\s*$/,'').trim();}
  else{
    const [table,field]=val.split('.');
    f.fk={table,field,card:(f.fk&&f.fk.card)||'N:1'};
    const cons=dbFieldConstraintsStr(f);
    if(!/\bFK\b/i.test(cons))f.constraints=(cons?cons+', ':'')+'FK';
  }
  renderDBEditor();
}
// тип / ограничения / кардинальность через настоящие <select> (datalist ненадёжен)
function setFieldType(blockId,ti,fi,val){
  const b=gb(blockId);const f=b?.dbSchema?.tables?.[ti]?.fields?.[fi];if(!f)return;
  if(val==='__custom__'){const c=prompt('Тип данных:',f.type||'');if(c!=null)f.type=c;}else f.type=val;
  renderDBEditor();
}
function setFieldCons(blockId,ti,fi,val){
  const b=gb(blockId);const f=b?.dbSchema?.tables?.[ti]?.fields?.[fi];if(!f)return;
  if(val==='__custom__'){const c=prompt('Ограничения (PK, NN, UNIQUE, CHECK ...):',dbFieldConstraintsStr(f));if(c!=null)f.constraints=c;}else f.constraints=val;
  renderDBEditor();
}
function setFieldCard(blockId,ti,fi,val){
  const b=gb(blockId);const f=b?.dbSchema?.tables?.[ti]?.fields?.[fi];if(!f||!f.fk)return;
  f.fk.card=val;renderDBEditor();
}
// построить <select> с инжектом текущего значения и опцией «другое…»
function dbSel(value,options,onchange,width,withEmpty){
  const cur=value||'';
  const opts=options.slice();
  if(cur&&!opts.includes(cur))opts.unshift(cur);
  let html=`<select onchange="${onchange}" style="background:#1a1b26;border:1px solid #3d3f52;border-radius:4px;padding:3px 4px;font-size:10.5px;color:#c0caf5;outline:none;font-family:inherit;width:${width||120}px">`;
  if(withEmpty)html+=`<option value="" ${!cur?'selected':''}>—</option>`;
  html+=opts.map(o=>`<option ${o===cur?'selected':''} value="${escHtml(o)}">${escHtml(o)}</option>`).join('');
  html+=`<option value="__custom__">✏️ другое…</option></select>`;
  return html;
}
// ═══════════════════════════════════════════════════════════════
// РЕДАКТОР ДАННЫХ — визуальный grid: добавить/удалить/редактировать строки
// b.dbRows = { tableName: [{col:val,...},...] }   SQL/Mongo
//           = { __redis__: [{key,type,value,ttl},...] }  Redis
// ═══════════════════════════════════════════════════════════════
const DB_TYPE_CLR = {postgresql:'#7dcfff',mysql:'#7dcfff',mongodb:'#9ece6a',redis:'#f7768e',cassandra:'#bb9af7',clickhouse:'#ff9e64'};
const DB_TYPE_ICON= {postgresql:'🐘',mysql:'🐬',mongodb:'🍃',redis:'⚡',cassandra:'💠',clickhouse:'🟡'};

let _deId=null; // текущий blockId в редакторе данных

function _deCols(b, tname){
  if(b.type==='redis') return ['key','type','value','ttl'];
  const sc=b.dbSchema;const tables=(sc?.tables||sc?.collections||[]);
  const t=tables.find(x=>x.name===tname)||tables[0];
  if(t?.fields?.length) return t.fields.map(f=>f.name);
  // нет схемы — берём ключи из первой строки
  const rows=(b.dbRows||{})[tname]||[];
  if(rows[0]) return Object.keys(rows[0]);
  return ['id','name','value'];
}

function _deTables(b){
  if(b.type==='redis') return ['__redis__'];
  const sc=b.dbSchema;const tables=(sc?.tables||sc?.collections||[]);
  if(tables.length) return tables.map(t=>t.name);
  return Object.keys(b.dbRows||{}).length ? Object.keys(b.dbRows) : ['records'];
}

function openDataEditor(blockId){
  const b=gb(blockId);if(!b)return;
  if(!['db','cache'].includes(EL[b.type]?.cat)){toast('Редактор данных — только для БД и кэша');return;}
  _deId=blockId;
  if(!b.dbRows)b.dbRows={};
  let ov=document.getElementById('data-edit-modal');
  if(!ov){ov=document.createElement('div');ov.id='data-edit-modal';ov.className='modal-ov';
    ov.onclick=e=>{if(e.target===ov)closeDataEditor();};document.body.appendChild(ov);}
  ov.style.display='flex';
  _renderDataEditor();
}

function closeDataEditor(){
  document.getElementById('data-edit-modal').style.display='none';
  _deId=null; pushHist();
}

function _renderDataEditor(){
  const b=gb(_deId);if(!b)return;
  const ov=document.getElementById('data-edit-modal');if(!ov)return;
  const clr=DB_TYPE_CLR[b.type]||'#c0caf5';
  const icon=DB_TYPE_ICON[b.type]||'🗄';
  const name=b.customLabel||EL[b.type]?.lbl;
  const tables=_deTables(b);
  const isRedis=b.type==='redis';

  let tablesHtml=tables.map(tn=>{
    const rows=(b.dbRows[tn]||[]);
    const cols=_deCols(b,tn);
    const inp='background:#11121a;border:1px solid #2a2b3d;border-radius:3px;padding:3px 5px;font-size:10.5px;color:#c0caf5;outline:none;font-family:inherit;width:100%';
    const label=isRedis?'Redis Keys':`Таблица: <b style="color:${clr}">${escHtml(tn)}</b>`;

    const headerCells=cols.map(c=>`<th style="padding:4px 6px;text-align:left;font-size:10px;color:#787c99;font-weight:600;white-space:nowrap">${escHtml(c)}</th>`).join('');
    const bodyRows=rows.map((row,ri)=>{
      const cells=cols.map(c=>`<td style="padding:2px 3px"><input style="${inp}" value="${escHtml(String(row[c]??''))}" oninput="_deSetCell('${tn}',${ri},'${c}',this.value)"></td>`).join('');
      return `<tr>
        <td style="padding:2px 4px;white-space:nowrap">
          <button onclick="_deMoveRow('${tn}',${ri},-1)" title="Выше" style="background:none;border:none;color:#787c99;cursor:pointer;font-size:11px;padding:1px 3px">↑</button>
          <button onclick="_deMoveRow('${tn}',${ri},1)"  title="Ниже" style="background:none;border:none;color:#787c99;cursor:pointer;font-size:11px;padding:1px 3px">↓</button>
          <button onclick="_deDelRow('${tn}',${ri})" title="Удалить" style="background:none;border:none;color:#f7768e;cursor:pointer;font-size:12px;padding:1px 4px">✕</button>
        </td>${cells}</tr>`;
    }).join('');

    const emptyHint=!rows.length?`<tr><td colspan="${cols.length+1}" style="padding:10px;text-align:center;color:#787c99;font-size:11px">Нет строк — нажми ＋ Строка</td></tr>`:'';

    return `<div style="margin-bottom:18px">
      <div style="font-size:11px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
        <span>${label}</span>
        <span style="color:#787c99;font-size:10px">${rows.length} строк</span>
        <button onclick="_deAddRow('${tn}')" style="margin-left:auto;padding:3px 10px;border:1px solid ${clr};border-radius:5px;background:${clr}18;color:${clr};cursor:pointer;font-size:10.5px">＋ Строка</button>
        ${!isRedis&&rows.length?`<button onclick="_deCopySql('${tn}')" style="padding:3px 8px;border:1px solid #4a4c6a;border-radius:5px;background:transparent;color:#787c99;cursor:pointer;font-size:10px">📋 SQL</button>`:''}
      </div>
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <thead><tr><th style="padding:4px 6px;width:72px"></th>${headerCells}</tr></thead>
        <tbody>${bodyRows}${emptyHint}</tbody>
      </table></div>
    </div>`;
  }).join('');

  ov.innerHTML=`<div class="modal-box" style="max-width:900px;width:98%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h2 style="color:${clr}">${icon} Данные: ${escHtml(name)}</h2>
      <button class="modal-btn" onclick="closeDataEditor()">✕</button>
    </div>
    <div style="max-height:62vh;overflow-y:auto;padding-right:4px">${tablesHtml}</div>
    <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="modal-btn primary" onclick="closeDataEditor()">✓ Готово</button>
      <button class="modal-btn" onclick="_deCopyAll()" style="color:#9aa5ce">📋 Экспорт ${isRedis?'Redis':'SQL'}</button>
      <span style="font-size:10px;color:#4a4c6a;margin-left:auto">Данные сохраняются в блок и экспортируются вместе с проектом</span>
    </div>
  </div>`;
}

function _deSetCell(tname,ri,col,val){
  const b=gb(_deId);if(!b)return;
  if(!b.dbRows[tname])b.dbRows[tname]=[];
  if(!b.dbRows[tname][ri])b.dbRows[tname][ri]={};
  b.dbRows[tname][ri][col]=val;
}
function _deAddRow(tname){
  const b=gb(_deId);if(!b)return;
  if(!b.dbRows[tname])b.dbRows[tname]=[];
  const cols=_deCols(b,tname);
  const row={};cols.forEach(c=>row[c]='');
  b.dbRows[tname].push(row);
  _renderDataEditor();
}
function _deDelRow(tname,ri){
  const b=gb(_deId);if(!b)return;
  b.dbRows[tname].splice(ri,1);
  _renderDataEditor();
}
function _deMoveRow(tname,ri,dir){
  const b=gb(_deId);if(!b)return;
  const arr=b.dbRows[tname];if(!arr)return;
  const ni=ri+dir;if(ni<0||ni>=arr.length)return;
  [arr[ri],arr[ni]]=[arr[ni],arr[ri]];
  _renderDataEditor();
}
function _deCopySql(tname){
  const b=gb(_deId);if(!b)return;
  const rows=b.dbRows[tname]||[];if(!rows.length)return toast('Нет данных');
  const cols=_deCols(b,tname);
  const sql=rows.map(r=>`INSERT INTO ${tname} (${cols.join(', ')})\nVALUES (${cols.map(c=>{const v=r[c]??'';return isNaN(v)||v===''?`'${String(v).replace(/'/g,"''")}'`:v;}).join(', ')});`).join('\n');
  navigator.clipboard.writeText(sql).then(()=>toast('📋 SQL скопирован'));
}
function _deCopyAll(){
  const b=gb(_deId);if(!b)return;
  const isRedis=b.type==='redis';
  let out='';
  if(isRedis){
    (b.dbRows['__redis__']||[]).forEach(r=>{
      out+=r.ttl?`SET ${r.key} '${r.value}' EX ${r.ttl}\n`:`SET ${r.key} '${r.value}'\n`;
    });
  } else {
    Object.entries(b.dbRows||{}).forEach(([tn,rows])=>{
      if(!rows.length)return;
      const cols=_deCols(b,tn);
      rows.forEach(r=>{out+=`INSERT INTO ${tn} (${cols.join(', ')}) VALUES (${cols.map(c=>{const v=r[c]??'';return isNaN(v)||v===''?`'${String(v).replace(/'/g,"''")}'`:v;}).join(', ')});\n`;});
    });
  }
  if(!out.trim())return toast('Нет данных для экспорта');
  navigator.clipboard.writeText(out.trim()).then(()=>toast('📋 Скопировано'));
}

// Показать данные блока кратко (из других мест)
function showBlockData(blockId){
  const b=gb(blockId);
  if(!b||!b.dbRows||!Object.keys(b.dbRows).length) return openDataEditor(blockId);
  openDataEditor(blockId);
}

// Показать SQL/ERD для собственной схемы блока
function showDBSchemaForBlock(blockId,mode){
  const b=gb(blockId);if(!b)return;
  const fake={name:b.customLabel||EL[b.type]?.lbl,type:b.type,schema:b.dbSchema||blockSchema(b)};
  const text=mode==='sql'?schemaToSQL(fake):mode==='json'?schemaToJSON(fake):schemaToMermaid(fake);
  const clr=mode==='sql'?'#c0caf5':mode==='json'?'#7dcfff':'#9ece6a';
  let ov=$('db-view-modal');
  const inner=`<div class="modal-box" style="max-width:700px;width:96%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h2 style="color:#4a90d9">${escHtml(fake.name)} — ${mode.toUpperCase()}</h2>
      <button class="modal-btn" onclick="document.getElementById('db-view-modal').style.display='none'">✕</button></div>
    <pre style="font-size:11px;line-height:1.5;white-space:pre-wrap;font-family:Consolas,monospace;color:${clr};max-height:50vh;overflow-y:auto;background:#11121a;padding:12px;border-radius:7px">${escHtml(text)}</pre>
    <div style="margin-top:10px"><button class="modal-btn primary" onclick="navigator.clipboard.writeText(document.querySelector('#db-view-modal pre').textContent).then(()=>toast('Скопировано'))">📋 Копировать</button></div>
  </div>`;
  if(!ov){ov=document.createElement('div');ov.id='db-view-modal';ov.className='modal-ov';ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};document.body.appendChild(ov);}
  ov.innerHTML=inner;ov.style.display='flex';
}
