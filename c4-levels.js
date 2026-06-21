// C4-LEVELS — уровни C1, C2, C3, C4 с кнопками в тулбаре

// C4 уровень хранится в S.c4Level (1-4 или null = обычный workspace)
// C1: пользователи + внешние системы + граница
// C2: контейнеры с подписями [Container: тип], границы контекстов
// C3: компоненты выбранного сервиса (раскрывает один сервис)
// C4: динамика (sequence диаграмма)

function toggleC4(lvl){ setC4Level(S.c4Level===lvl?null:lvl); }

function setC4Level(level){
  S.c4Level=level;
  // Обновить стиль кнопок
  ['c4-l1','c4-l2','c4-l3','c4-l4'].forEach((id,i)=>{
    const btn=$(id);
    if(btn){ btn.style.color=(level===i+1)?'#7aa2f7':''; btn.style.background=(level===i+1)?'#7aa2f718':''; }
  });
  if(level===4){
    // C4 = динамика → открыть sequence редактор
    openSeq();
    return;
  }
  if(level===null){
    S.view='workspace';
    render();
    return;
  }
  S.view='c4_level';
  render();
}

// Получить текущий C4-уровень для отображения в renderC4Levels
function getC4Level(){return S.c4Level||null;}

// Фильтрация блоков по C4 уровню
function c4LevelBlocks(){
  const level=S.c4Level;
  if(!level) return S.blocks;
  if(level===1){
    // C1: только пользователи (actor, client), внешние системы и gateway
    return S.blocks.filter(b=>{
      const cat=BASE[b.type]?.cat;
      return cat==='actor'||cat==='client'||cat==='external'||cat==='gw';
    });
  }
  if(level===2){
    // C2 Container: все контейнеры включая БД, кэш, брокеры — скрываем только net
    return S.blocks.filter(b=>{
      const cat=BASE[b.type]?.cat;
      return cat!=='net';
    });
  }
  if(level===3){
    // C3: только сервисы и их хранилища (без клиентов и сети)
    return S.blocks.filter(b=>{
      const cat=BASE[b.type]?.cat;
      return cat==='svc'||cat==='db'||cat==='cache'||cat==='broker'||cat==='queue';
    });
  }
  return S.blocks;
}

// Описание уровня для подсказки
const C4_HINTS={
  1:'C1 Context: Пользователи и внешние системы. Покажи ГДЕ находится система в большом мире.',
  2:'C2 Container: Технические блоки системы (сервисы, БД, брокеры). Как общаются между собой.',
  3:'C3 Component: Внутренние компоненты одного сервиса. Покажи архитектуру конкретного микросервиса.',
  4:'C4 Dynamic: Sequence-диаграмма — динамика выполнения конкретного сценария.',
};

// Рендер блока с C4-аннотацией (вызывается из renderBlocks если S.view==='c4_level')
function renderC4Level(L){
  const level=S.c4Level;
  const visibleBlocks=c4LevelBlocks();
  const visibleIds=new Set(visibleBlocks.map(b=>b.id));

  // Граница системы для C1/C2
  if(level===1||level===2){
    const inner=S.blocks.filter(b=>{
      const cat=BASE[b.type]?.cat;
      return !['actor','client','external'].includes(cat);
    }).filter(b=>visibleIds.has(b.id));
    if(inner.length){
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      inner.forEach(b=>{const W=bw(b),H=bh(b);x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+W);y1=Math.max(y1,b.y+H);});
      const pad=32;
      mkEl('rect',{x:x0-pad,y:y0-pad,width:x1-x0+2*pad,height:y1-y0+2*pad,rx:16,fill:'#7aa2f708',stroke:'#7aa2f755','stroke-width':'1.5','stroke-dasharray':'10 5'},L);
      mkTxt(x0-pad+100,y0-pad-10,(S.meta?.systemName||'Система')+`  [C${level} ${level===1?'Context':'Container'}]`,'font-size:11px;fill:var(--blue);font-weight:600',L);
    }
  }

  // C3: рамка для каждого сервиса
  if(level===3){
    visibleBlocks.filter(b=>BASE[b.type]?.cat==='svc').forEach(b=>{
      const W=bw(b),H=bh(b);
      mkEl('rect',{x:b.x-12,y:b.y-12,width:W+24,height:H+24,rx:10,fill:'#7aa2f705',stroke:'#7aa2f744','stroke-width':'1','stroke-dasharray':'6 4'},L);
    });
  }

  // Рисуем блоки
  visibleBlocks.forEach(b=>{
    const d=EL[b.type];if(!d)return;
    const W=bw(b),H=bh(b),shape=shapeOf(b);
    const rt=b.rt||{health:'ok'};const sc=hClr(rt.health);
    const sel=S.selected===b.id,hov=S.hovered===b.id;
    const g=document.createElementNS(NS,'g');
    if(sel)mkEl('rect',{x:b.x-4,y:b.y-4,width:W+8,height:H+8,rx:11,fill:'none',stroke:'#bb9af7','stroke-width':'1.6','stroke-dasharray':'5 3'},g);
    if(shape==='person'||shape==='role'){
      drawPerson(g,b,W,H,d.clr);
      mkTxt(b.x+W/2,b.y+H+9,b.customLabel||d.lbl,`font-size:11px;font-weight:700;fill:${darkFor(d.clr)}`,g);
      const sub=level===1?'[Person]':`[${c4Kind(b)}]`;
      mkTxt(b.x+W/2,b.y+H+20,sub,'font-size:8px;fill:var(--txt2)',g);
    }else{
      drawBlockShape(g,b,W,H,shape,d.clr,sc,shape==='ext'?'6 4':'none');
      // C4-подпись: имя + [Container: тип]
      const name=b.customLabel||d.lbl;
      const tech=`[Container: ${c4Tech(b)}]`;
      const maxC=Math.max(8,Math.floor((W-12)/4.7));
      mkTxt(b.x+W/2,b.y+H/2-7,name.length>maxC?name.slice(0,maxC-1)+'…':name,`font-size:10.5px;font-weight:700;fill:${darkFor(d.clr)}`,g);
      mkTxt(b.x+W/2,b.y+H/2+7,tech,'font-size:7.5px;fill:var(--txt2)',g);
      if(sc)mkEl('circle',{cx:b.x+W-8,cy:b.y+8,r:4.5,fill:sc},g);
    }
    // Порт — справа на b.x+bw(b)
    if(hov){const px=b.x+bw(b);const port=mkEl('circle',{cx:px,cy:b.y+H/2,r:7,fill:'#1a1b26',stroke:d.clr,'stroke-width':'2'},g);port.style.cursor='crosshair';port.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();S.mode='connecting';S.connFrom=b.id;const pt=svgPt(e);S.tempX=pt.x;S.tempY=pt.y;renderConns();});}
    L.appendChild(g);
  });
}

// Хинт уровня — показывается в статусбаре или подсказке
function c4LevelHint(){
  const l=S.c4Level;if(!l)return '';
  return C4_HINTS[l]||'';
}

// RAPTOR v1.1.0
