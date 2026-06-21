// DOC-EXPORT — генерация BA-спецификации формата MS-1 в .docx (docx-js через CDN)
// + резервный MD/preview. Структура повторяет эталон MS-1.

// ═══════════════════════════════════════════════════════════════
// MD-ПРЕВЬЮ (для модалки «Документация» — быстрый просмотр)
// ═══════════════════════════════════════════════════════════════
function generateDocMD(){
  ensureMeta();const m=S.meta;
  let md=`# ${m.systemName||'Система'}\n\n`;
  md+=`**Версия:** ${m.version||'—'}  ·  **Автор:** ${m.author||'—'}\n\n`;
  if(m.description)md+=`**Общее описание:** ${m.description}\n\n`;
  // Роли
  (m.userRoles||[]).forEach(r=>{
    md+=`**${r.name} могут:**\n`;
    (r.can||[]).forEach(c=>md+=`- ${c}\n`);
    md+='\n';
  });
  // Требования
  if((m.requirements||[]).length){
    md+=`## Доп. требования\n`;
    m.requirements.forEach(r=>md+=`- ${r.text}${r.card?` (${r.card})`:''}\n`);
    md+='\n';
  }
  // Сервисы
  md+=`## Описание сервисов\n\n`;
  allServices().forEach(svc=>{
    const nm=svc.customLabel||EL[svc.type]?.lbl;
    md+=`### ${nm}\n`;
    md+=`Назначение: ${svc.desc||EL[svc.type]?.role||'—'}\n\n`;
    // Эндпоинты
    const eps=serviceEndpoints(svc.id);
    if(eps.length){
      md+=`**Примеры запросов**\n\n`;
      eps.forEach(ep=>{
        md+=`#### ${ep.verb||'GET'} ${ep.uri||''} — ${ep.desc||ep.name||''}\n\n`;
        if((ep.params||[]).length){
          md+=`| Параметр | Наименование | Тип | Обяз. | Описание | Где |\n|---|---|---|---|---|---|\n`;
          ep.params.forEach(p=>md+=`| ${p.name} | ${p.label||''} | ${p.type||'string'} | ${p.required?'да':'нет'} | ${p.desc||''} | ${p.in||'body'} |\n`);
          md+='\n';
        }
        md+=`Выходные данные: ${ep.success||ep.resp||'200 OK'}\n\n`;
        if((ep.codes||[]).length)md+=`Возможные статус-коды: ${ep.codes.join(', ')}\n\n`;
      });
    }
    // БД сервиса
    serviceDatabases(svc.id).forEach(db=>{
      const tables=schemaTables(db);
      if(!tables.length)return;
      md+=`**ERD: ${db.customLabel||EL[db.type]?.lbl}**\n\n`;
      const fake={name:db.customLabel||'DB',type:db.type,schema:blockSchema(db)};
      md+='```mermaid\n'+schemaToMermaid(fake)+'\n```\n\n';
      md+=`**Описание таблиц**\n\n`;
      tables.forEach(t=>{
        md+=`*${t.name}*\n\n`;
        md+=`| Поле | Наименование | Тип | Ограничения | Описание | Пример |\n|---|---|---|---|---|---|\n`;
        (t.fields||[]).forEach(f=>md+=`| ${f.name} | ${fieldLabel(f)} | ${f.type} | ${fieldConstraints(f)} | ${fieldDesc(f)} | ${fieldExample(f)} |\n`);
        md+='\n';
      });
    });
  });
  return md;
}

function showDoc(){
  $('doc-txt').textContent=generateDocMD();
  $('doc-modal').style.display='flex';
}
function closeDoc(){$('doc-modal').style.display='none';}
function copyDoc(){navigator.clipboard.writeText($('doc-txt').textContent).then(()=>toast('📋 Скопировано'));}
function downloadDoc(){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([$('doc-txt').textContent],{type:'text/markdown'}));
  a.download=`${(S.meta?.systemName||'arch').replace(/\s+/g,'_')}.md`;a.click();
}

// ═══════════════════════════════════════════════════════════════
// WORD (.docx) через docx-js (window.docx)
// ═══════════════════════════════════════════════════════════════
// docx.min.js подключён локально в index.html → window.docx уже доступен (офлайн).
// Резерв: подгрузить с CDN, если локальный файл не нашёлся.
const DOCX_CDN='https://unpkg.com/docx@8.5.0/build/index.umd.js';
function loadDocxLib(){
  return new Promise((resolve,reject)=>{
    if(window.docx)return resolve(window.docx);
    const s=document.createElement('script');
    s.src=DOCX_CDN;
    s.onload=()=>window.docx?resolve(window.docx):reject(new Error('docx не загрузился'));
    s.onerror=()=>reject(new Error('docx.min.js не найден и CDN недоступен'));
    document.head.appendChild(s);
  });
}

// Конвертер текущего SVG-холста (C4-вид) в PNG dataURL — для вставки картинкой
function canvasSvgToPng(scale, opts){
  return new Promise((resolve)=>{
    try{
      const svg=$('canvas');
      // вычислить bbox содержимого
      const layer=$('block-layer');
      const bb=layer.getBBox();
      const pad=40;
      const vb=`${bb.x-pad} ${bb.y-pad} ${bb.width+2*pad} ${bb.height+2*pad}`;
      const clone=svg.cloneNode(true);
      clone.setAttribute('viewBox',vb);
      clone.setAttribute('width',bb.width+2*pad);
      clone.setAttribute('height',bb.height+2*pad);
      // убрать pan-трансформации у слоёв в клоне
      ['conn-layer','block-layer','anim-layer'].forEach(id=>{const g=clone.querySelector('#'+id);if(g)g.removeAttribute('transform');});
      // фон
      const rect=document.createElementNS(NS,'rect');
      rect.setAttribute('x',bb.x-pad);rect.setAttribute('y',bb.y-pad);
      rect.setAttribute('width',bb.width+2*pad);rect.setAttribute('height',bb.height+2*pad);
      rect.setAttribute('fill','#11121a');
      rect.setAttribute('fill', opts&&opts.whiteBg ? '#ffffff' : '#11121a');
      clone.insertBefore(rect,clone.firstChild.nextSibling);
      const str=new XMLSerializer().serializeToString(clone);
      const img=new Image();
      const blob=new Blob([str],{type:'image/svg+xml;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const sc=scale||2;
      img.onload=()=>{
        const cv=document.createElement('canvas');
        cv.width=(bb.width+2*pad)*sc;cv.height=(bb.height+2*pad)*sc;
        const ctx=cv.getContext('2d');ctx.scale(sc,sc);ctx.drawImage(img,0,0);
        URL.revokeObjectURL(url);
        cv.toBlob(b=>{const r=new FileReader();r.onload=()=>resolve({data:r.result,w:cv.width/sc,h:cv.height/sc});r.readAsArrayBuffer(b);},'image/png');
      };
      img.onerror=()=>resolve(null);
      img.src=url;
    }catch(e){resolve(null);}
  });
}

// ═══════════════════════════════════════════════════════════════
// ДИАЛОГ-КОНСТРУКТОР ДОКУМЕНТА — выбираешь что включить
// ═══════════════════════════════════════════════════════════════
function openExportChooser(){
  const existing=document.getElementById('export-chooser-modal');
  if(existing){existing.style.display='flex';return;}
  const ov=document.createElement('div');ov.id='export-chooser-modal';ov.className='modal-ov';
  ov.style.display='flex';
  ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};

  const checks=[
    {k:'title',      lbl:'Шапка (название / версия / автор)',        def:true},
    {k:'description',lbl:'Описание системы и роли пользователей',    def:true},
    {k:'c4',         lbl:'Схема C4 (уровень C2 — контейнеры)',       def:true},
    {k:'gw_table',   lbl:'API Gateway — таблица маршрутизации',      def:true},
    {k:'svc_desc',   lbl:'Описание каждого сервиса',                  def:true},
    {k:'db_schema',  lbl:'Схема БД (6 кол.) + ERD-связи',            def:true},
    {k:'db_examples',lbl:'Примеры строк в таблицах БД (2-3 записи)', def:true},
    {k:'api_table',  lbl:'Таблица API сервиса',                       def:true},
    {k:'input_params',lbl:'Входные параметры каждого эндпоинта',     def:true},
    {k:'output_params',lbl:'Выходные параметры (авто из БД + verb)',  def:true},
    {k:'status_codes',lbl:'Статус-коды ответов',                      def:true},
    {k:'seq_uml',    lbl:'UML Sequence (PlantUML) — в конце документа', def:true},
  ];

  const row=c=>`<label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:12px;color:#c0caf5">
    <input type="checkbox" id="exc_${c.k}" ${c.def?'checked':''} style="width:14px;height:14px;accent-color:#7aa2f7">
    ${c.lbl}
  </label>`;

  ov.innerHTML=`<div class="modal-box" style="max-width:520px;width:96%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h2 style="color:#7aa2f7">📄 Собрать документ Word (MS-формат)</h2>
      <button class="modal-btn" onclick="document.getElementById('export-chooser-modal').style.display='none'">✕</button>
    </div>
    <div style="font-size:10.5px;color:#787c99;margin-bottom:10px">Выбери разделы для включения в документ</div>
    <div style="columns:2;gap:16px;margin-bottom:14px">${checks.map(row).join('')}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="modal-btn primary" onclick="
        const cfg={};
        document.querySelectorAll('#export-chooser-modal input[type=checkbox]').forEach(cb=>{cfg[cb.id.replace('exc_','')]=cb.checked});
        document.getElementById('export-chooser-modal').style.display='none';
        downloadWord(cfg);
      ">📥 Генерировать Word</button>
      <button class="modal-btn" onclick="document.getElementById('export-chooser-modal').style.display='none'">Отмена</button>
      <span style="font-size:10px;color:#787c99;margin-left:auto">Пустые секции пропускаются автоматически</span>
    </div>
  </div>`;
  document.body.appendChild(ov);
}

// ── Авто-генерация выходных параметров из схемы БД + verb ──────
function buildOutputParams(svcId, verb, uri){
  const dbs=serviceDatabases(svcId);
  if(!dbs.length||verb==='DELETE')return [];
  // Найти таблицу по имени ресурса из URI
  const seg=(uri||'').split('/').filter(Boolean).find(s=>!/^{/.test(s)&&s!=='api'&&s!=='v1'&&!/^\d/.test(s));
  const resource=seg||'';
  let mainTable=null;
  for(const db of dbs){
    const tbls=schemaTables(db);
    mainTable=tbls.find(t=>t.name===resource||t.name===resource+'s'||resource.startsWith(t.name)||t.name.startsWith(resource))||tbls[0];
    if(mainTable)break;
  }
  if(!mainTable)return [];
  const isList=verb==='GET'&&!(uri||'').includes('{id}')&&!(uri||'').includes('{');
  const prefix=resource||mainTable.name;
  return (mainTable.fields||[]).map(f=>({
    name:f.name, label:fieldLabel(f), type:f.type,
    required:fieldConstraints(f).includes('PK')||fieldConstraints(f).includes('NN'),
    desc:fieldDesc(f), example:fieldExample(f),
    path:isList?`[].${prefix}.${f.name}`:`${prefix}.${f.name}`,
  }));
}

// ── Генерация 2-3 примеров строк из определения полей ─────────
function generateExampleRows(fields, count=3){
  const variants={
    UUID:['a1b2c3d4-e5f6-7890-abcd-ef1234567890','b2c3d4e5-f6a7-8901-bcde-f01234567891','c3d4e5f6-a7b8-9012-cdef-012345678912'],
    TIMESTAMP:['2026-05-25 14:34:25','2026-05-24 09:12:07','2026-05-23 18:45:33'],
    BOOLEAN:['true','false','true'],
    INTEGER:['1','2','3'],
  };
  const rows=[];
  for(let r=0;r<count;r++){
    const row={};
    (fields||[]).forEach(f=>{
      const ex=fieldExample(f);
      if(ex){
        // Немного варьируем пример
        if(r===0)row[f.name]=ex;
        else if(f.type.includes('UUID'))row[f.name]=variants.UUID[r]||ex;
        else if(f.type.includes('TIMESTAMP'))row[f.name]=variants.TIMESTAMP[r]||ex;
        else if(f.type==='BOOLEAN')row[f.name]=variants.BOOLEAN[r]||ex;
        else if(f.type==='INTEGER'||f.type.includes('INT'))row[f.name]=String(parseInt(ex||'0')+(r));
        else row[f.name]=r===0?ex:`${ex}_${r+1}`;
      }else{
        const fc=fieldConstraints(f);
        if(fc.includes('PK'))row[f.name]=variants.UUID[r];
        else if(f.type.includes('TIMESTAMP'))row[f.name]=variants.TIMESTAMP[r];
        else if(f.type==='BOOLEAN')row[f.name]=variants.BOOLEAN[r];
        else row[f.name]='—';
      }
    });
    rows.push(row);
  }
  return rows;
}

// Рендерит UML-текст через seq.js → SVG → PNG для вставки в Word
function seqUmlToPng(umlText, scale){
  return new Promise((resolve)=>{
    try{
      if(typeof parseSeq!=='function'||typeof renderSeqSVG!=='function'){resolve(null);return;}
      const sc=scale||1.8;
      const model=parseSeq(umlText);
      const svgStr=renderSeqSVG(model);
      const wm=svgStr.match(/width="(\d+(?:\.\d+)?)"/);
      const hm=svgStr.match(/height="(\d+(?:\.\d+)?)"/);
      const sw=wm?parseFloat(wm[1]):900;
      const sh=hm?parseFloat(hm[1]):600;
      // data URL вместо blob — браузер рендерит шрифты без ограничений
      const b64=btoa(unescape(encodeURIComponent(svgStr)));
      const img=new Image();
      img.onload=()=>{
        const cv=document.createElement('canvas');
        cv.width=Math.round(sw*sc);cv.height=Math.round(sh*sc);
        const ctx=cv.getContext('2d');
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);
        ctx.scale(sc,sc);
        try{
          ctx.drawImage(img,0,0);
          cv.toBlob(b=>{
            if(!b){resolve(null);return;}
            const r=new FileReader();
            r.onload=()=>resolve({data:r.result,w:sw,h:sh});
            r.onerror=()=>resolve(null);
            r.readAsArrayBuffer(b);
          },'image/png');
        }catch(ex){resolve(null);}
      };
      img.onerror=()=>resolve(null);
      img.src='data:image/svg+xml;base64,'+b64;
    }catch(e){resolve(null);}
  });
}

async function downloadWord(cfg={}){
  // По умолчанию — всё включено
  const has=k=>cfg[k]!==false&&(Object.keys(cfg).length===0||cfg[k]===true);
  toast('⏳ Генерирую Word…',3000);
  let docx;
  try{ docx=await loadDocxLib(); }
  catch(e){ toast('❌ '+e.message); return; }

  const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,
    AlignmentType,HeadingLevel,BorderStyle,WidthType,ShadingType,
    LevelFormat,ImageRun,PageBreak,TabStopType,TabStopPosition}=docx;

  ensureMeta();const m=S.meta;
  const CW=9360; // ширина контента US Letter, 1" поля
  const border={style:BorderStyle.SINGLE,size:1,color:'AAAAAA'};
  const borders={top:border,bottom:border,left:border,right:border};
  const cellMargins={top:60,bottom:60,left:100,right:100};

  function hcell(text,w){
    return new TableCell({borders,width:{size:w,type:WidthType.DXA},margins:cellMargins,
      shading:{fill:'D5E8F0',type:ShadingType.CLEAR},
      children:[new Paragraph({children:[new TextRun({text,bold:true,size:18})]})]});
  }
  function cell(text,w){
    return new TableCell({borders,width:{size:w,type:WidthType.DXA},margins:cellMargins,
      children:[new Paragraph({children:[new TextRun({text:String(text==null?'':text),size:18})]})]});
  }
  function p(text,opts){return new Paragraph({...(opts||{}),children:[new TextRun({text,...(opts?.run||{})})]});}

  const children=[];
  let ucCounter=1; // счётчик use case

  // ── Титул ──
  if(has('title'))
  children.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun(m.systemName||'Система')]}));
  if(has('title')){
    children.push(new Paragraph({children:[
      new TextRun({text:'Версия: ',bold:true}),new TextRun(m.version||'—'),
      new TextRun('\t'),
      new TextRun({text:'Автор: ',bold:true}),new TextRun(m.author||'—'),
    ],tabStops:[{type:TabStopType.RIGHT,position:TabStopPosition.MAX}]}));
  }

  // ── Описание системы + роли + требования ──
  if(has('description')){
    if(m.description){
      children.push(p('Общее описание системы',{heading:HeadingLevel.HEADING_2}));
      children.push(p(m.description));
    }
    (m.userRoles||[]).forEach(r=>{
      children.push(new Paragraph({spacing:{before:160},children:[new TextRun({text:`${r.name} могут:`,bold:true})]}));
      (r.can||[]).forEach(c=>children.push(new Paragraph({numbering:{reference:'bullets',level:0},children:[new TextRun(c)]})));
    });
    if((m.requirements||[]).length){
      children.push(p('Доп. требования',{heading:HeadingLevel.HEADING_2}));
      m.requirements.forEach(r=>children.push(new Paragraph({numbering:{reference:'bullets',level:0},
        children:[new TextRun(r.text+(r.card?`  (${r.card})`:''))]})));
    }
  }

  // ── Схема C4 ──
  if(has('c4')){
    const wasView=S.view;
    try{
      setC4Level&&setC4Level(2);
      await new Promise(r=>setTimeout(r,80));
      const png=await canvasSvgToPng(2.5,{whiteBg:true});
      if(png){
        children.push(p('Схема C4 (уровень C2)',{heading:HeadingLevel.HEADING_2}));
        // CW=9360 DXA → 9360/1440*96 ≈ 624px при 96dpi — полная ширина страницы
        const maxPx=624,ratio=png.h/png.w,w=Math.min(maxPx,png.w),h=Math.round(w*ratio);
        children.push(new Paragraph({children:[new ImageRun({type:'png',data:png.data,
          transformation:{width:Math.round(w),height:h},
          altText:{title:'C4',description:'Схема C4 уровень Container',name:'c4'}})]}));
      }
    }catch(e){}
    finally{S.view=wasView;if(typeof setC4Level==='function'){S.c4Level=null;}render();}
  }

  // ── API Gateway routing table ──
  if(has('gw_table')){
    const gwConns=S.conns.filter(c=>{
      const fb=gb(c.from),tb=gb(c.to);
      return fb&&tb&&EL[fb.type]?.cat==='gw'&&EL[tb.type]?.cat==='svc'&&c.method?.uri;
    });
    if(gwConns.length){
      children.push(new Paragraph({pageBreakBefore:true,heading:HeadingLevel.HEADING_1,children:[new TextRun('API Gateway')]}));
      children.push(p('Единая точка входа. Маршрутизация запросов по сервисам.'));
      const gwCols=[1400,2800,2200,2960];
      const gwRows=[new TableRow({children:[
        hcell('Метод',gwCols[0]),hcell('URI',gwCols[1]),hcell('Сервис',gwCols[2]),hcell('Описание',gwCols[3]),
      ]})];
      gwConns.forEach(c=>{
        const svcName=gb(c.to)?.customLabel||EL[gb(c.to)?.type]?.lbl||'';
        gwRows.push(new TableRow({children:[
          cell(c.method.verb||'GET',gwCols[0]),cell(c.method.uri||'',gwCols[1]),
          cell(svcName,gwCols[2]),cell(c.method.name||c.method.desc||'',gwCols[3]),
        ]}));
      });
      children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:gwCols,rows:gwRows}));
    }
  }

  // ── Описание сервисов ──
  children.push(new Paragraph({pageBreakBefore:true,heading:HeadingLevel.HEADING_1,children:[new TextRun('Описание сервисов')]}));
  allServices().forEach(svc=>{
    const nm=svc.customLabel||EL[svc.type]?.lbl;
    children.push(p(nm,{heading:HeadingLevel.HEADING_2}));

    if(has('svc_desc'))
      children.push(new Paragraph({children:[new TextRun({text:'Назначение: ',bold:true}),
        new TextRun(svc.desc||EL[svc.type]?.role||'—')]}));

    // ── Схема БД ──
    if(has('db_schema')){
      serviceDatabases(svc.id).forEach(db=>{
        const tables=schemaTables(db);if(!tables.length)return;
        children.push(p(`Схема БД — ${db.customLabel||EL[db.type]?.lbl}`,{heading:HeadingLevel.HEADING_3}));
        const rels=[];
        tables.forEach(t=>(t.fields||[]).filter(f=>f.fk).forEach(f=>rels.push(`${t.name}.${f.name} → ${f.fk.table}.${f.fk.field}`)));
        if(rels.length){
          children.push(p('Связи (FK):',{run:{italics:true,size:18}}));
          rels.forEach(r=>children.push(new Paragraph({numbering:{reference:'bullets',level:0},children:[new TextRun({text:r,size:18})]})));
        }
        tables.forEach(t=>{
          children.push(new Paragraph({spacing:{before:100},children:[new TextRun({text:t.name,bold:true})]}));
          const cols=[1400,1600,1300,1400,2160,1500];
          const dbRows=[new TableRow({children:[
            hcell('Поле',cols[0]),hcell('Наименование',cols[1]),hcell('Тип данных',cols[2]),
            hcell('Ограничения',cols[3]),hcell('Описание',cols[4]),hcell('Пример',cols[5]),
          ]})];
          (t.fields||[]).forEach(f=>dbRows.push(new TableRow({children:[
            cell(f.name,cols[0]),cell(fieldLabel(f),cols[1]),cell(f.type,cols[2]),
            cell(fieldConstraints(f),cols[3]),cell(fieldDesc(f),cols[4]),cell(fieldExample(f),cols[5]),
          ]})));
          children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:cols,rows:dbRows}));
          // Примеры строк
          if(has('db_examples')&&(t.fields||[]).some(f=>fieldExample(f))){
            const exRows=generateExampleRows(t.fields,3);
            children.push(p(`Примеры записей (${t.name}):`,{run:{italics:true,size:16},spacing:{before:60}}));
            const visCols=(t.fields||[]).filter(f=>f.type&&!f.type.toLowerCase().includes('text')).slice(0,6);
            if(visCols.length){
              const ecw=Math.floor(CW/visCols.length);
              const ecws=visCols.map((_,i)=>i<visCols.length-1?ecw:CW-ecw*(visCols.length-1));
              const exTblRows=[new TableRow({children:visCols.map((f,i)=>hcell(f.name,ecws[i]))})];
              exRows.forEach(row=>exTblRows.push(new TableRow({
                children:visCols.map((f,i)=>cell(String(row[f.name]??''),ecws[i]))})));
              children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:ecws,rows:exTblRows}));
            }
          }
        });
      });
    }

    // ── Таблица API ──
    const eps=serviceEndpoints(svc.id);
    if(has('api_table')&&eps.length){
      children.push(p('Таблица API',{heading:HeadingLevel.HEADING_3}));
      const apiCols=[1200,3400,4760];
      const apiRows=[new TableRow({children:[
        hcell('Метод',apiCols[0]),hcell('URI',apiCols[1]),hcell('Описание',apiCols[2]),
      ]})];
      eps.forEach(ep=>apiRows.push(new TableRow({children:[
        cell(ep.verb||'GET',apiCols[0]),cell(ep.uri||'',apiCols[1]),
        cell(ep.desc||ep.name||'',apiCols[2]),
      ]})));
      children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:apiCols,rows:apiRows}));
    }

    // ── Детальное описание каждого эндпоинта ──
    if(eps.length&&(has('input_params')||has('output_params')||has('use_case')||has('status_codes')||has('seq_uml'))){
      if(eps.length) children.push(p('Описание эндпоинтов',{heading:HeadingLevel.HEADING_3}));
      eps.forEach(ep=>{
        children.push(new Paragraph({spacing:{before:160},children:[
          new TextRun({text:`${ep.verb||'GET'} ${ep.uri||''}`,bold:true,size:22,color:'1F3864'}),
          ep.name?new TextRun(`  — ${ep.name}`):new TextRun(''),
        ]}));

        // Входные параметры
        if(has('input_params')&&(ep.params||[]).length){
          children.push(p('Входные данные',{run:{bold:true,size:18}}));
          const cols=[1500,1500,1200,1300,2560,1300];
          const rows=[new TableRow({children:[
            hcell('Параметр',cols[0]),hcell('Наименование',cols[1]),hcell('Тип данных',cols[2]),
            hcell('Обязательность',cols[3]),hcell('Описание',cols[4]),hcell('Тип входного параметра',cols[5]),
          ]})];
          ep.params.forEach(pr=>rows.push(new TableRow({children:[
            cell(pr.name,cols[0]),cell(pr.label||'',cols[1]),cell(pr.type||'string',cols[2]),
            cell(pr.required?'да':'нет',cols[3]),cell(pr.desc||'',cols[4]),cell(pr.in||'body',cols[5]),
          ]})));
          children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:cols,rows}));
        }

        // Выходные данные — только HTTP-код
        if(has('output_params')){
          children.push(p('Выходные данные',{run:{bold:true,size:18},spacing:{before:80}}));
          const respCode=(ep.verb||'GET')==='DELETE'?'204 No Content':(ep.success||ep.resp||'200 OK');
          children.push(p(respCode,{run:{size:18}}));
        }

        // Статус-коды
        if(has('status_codes')){
          const codes=[(ep.success||ep.resp||'200 OK'),...(ep.codes||[])].filter(Boolean);
          if(codes.length){
            children.push(p('Возможные статус-коды',{run:{bold:true,size:18},spacing:{before:80}}));
            const sCols=[2000,7360];
            const sRows=[new TableRow({children:[hcell('Код',sCols[0]),hcell('Описание',sCols[1])]})];
            codes.forEach(code=>{
              const [num,...rest]=code.split(/\s+/);
              sRows.push(new TableRow({children:[cell(num,sCols[0]),cell(rest.join(' ')||code,sCols[1])]}));
            });
            children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:sCols,rows:sRows}));
          }
        }
      });
    }
  });

    // ── UML Sequence — отдельный раздел в конце, каждый сценарий = PNG ──
  if(has('seq_uml')&&(S.scenarios||[]).length){
    children.push(new Paragraph({pageBreakBefore:true,heading:HeadingLevel.HEADING_1,children:[new TextRun('UML Sequence-диаграммы')]}));
    children.push(p('Sequence-диаграммы для каждого бизнес-процесса системы.'));
    for(const sc of (S.scenarios||[])){
      if(!sc.uml)continue;
      children.push(p(sc.name,{heading:HeadingLevel.HEADING_2}));
      // Рендерим UML через seq.js → SVG → PNG
      const seqPng=await seqUmlToPng(sc.uml,1.8);
      // PNG изображение
      if(seqPng){
        const maxPx=624,ratio=seqPng.h/seqPng.w,w=Math.min(maxPx,seqPng.w),h=Math.round(w*ratio);
        children.push(new Paragraph({children:[new ImageRun({type:'png',data:seqPng.data,
          transformation:{width:Math.round(w),height:h},
          altText:{title:sc.name,description:'UML Sequence',name:'seq_'+sc.id}})]}));
      }
      // PlantUML текст (всегда после PNG)
      const umlFull=`@startuml\n${sc.uml.trim()}\n@enduml`;
      children.push(p('PlantUML:',{run:{bold:true,size:16,color:'787c99'},spacing:{before:80}}));
      umlFull.split('\n').forEach(line=>{
        children.push(new Paragraph({spacing:{before:0,after:0},
          children:[new TextRun({text:line,size:14,color:'334455',font:'Consolas'})]}));
      });
      children.push(p('',{spacing:{before:160}}));
    }
  }

  // ── Документ ──
  const doc=new Document({
    styles:{
      default:{document:{run:{font:'Arial',size:22}}},
      paragraphStyles:[
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,
          run:{size:32,bold:true,font:'Arial',color:'1F3864'},paragraph:{spacing:{before:240,after:160},outlineLevel:0}},
        {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,
          run:{size:28,bold:true,font:'Arial',color:'2E4D7B'},paragraph:{spacing:{before:200,after:120},outlineLevel:1}},
        {id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,
          run:{size:24,bold:true,font:'Arial',color:'4472C4'},paragraph:{spacing:{before:160,after:80},outlineLevel:2}},
      ],
    },
    numbering:{config:[
      {reference:'bullets',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,
        style:{paragraph:{indent:{left:560,hanging:280}}}}]},
    ]},
    sections:[{
      properties:{page:{size:{width:12240,height:15840},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
      children,
    }],
  });

  try{
    const blob=await Packer.toBlob(doc);
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`${(m.systemName||'arch').replace(/\s+/g,'_')}.docx`;a.click();
    toast('📥 Word (.docx) скачан');
  }catch(e){ toast('❌ Ошибка генерации: '+e.message); }
}
