// LAYOUT — авторасстановка блоков по слоям
// Вертикаль сверху вниз: роли → клиенты → шлюзы → сервисы → БД; брокеры — правая колонка

function layerOf(b){
  const cat=BASE[b.type]?.cat;
  if(cat==='actor')                   return 0;
  if(cat==='client')                  return 1;
  if(cat==='gw'||cat==='net')         return 2;
  if(cat==='svc')                     return 3;
  if(cat==='broker'||cat==='queue')   return -1; // правая колонка
  if(cat==='db'||cat==='cache')       return 4;
  if(cat==='external')                return 5;
  return 3;
}

function autoLayout(){
  if(!S.blocks.length){toast(t('layout_no_blocks'));return;}

  const hGap=56, vGap=96;
  const startX=60, startY=40;

  // Разделяем категории
  const isBroker=b=>BASE[b.type]?.cat==='broker'||BASE[b.type]?.cat==='queue';
  const isDb=b=>BASE[b.type]?.cat==='db'||BASE[b.type]?.cat==='cache';

  const brokers  = S.blocks.filter(isBroker);
  const dbBlocks = S.blocks.filter(isDb);
  const main     = S.blocks.filter(b=>!isBroker(b)&&!isDb(b));

  // Группируем основные блоки по рядам 0..5
  const rows={};
  main.forEach(b=>{
    const l=layerOf(b);
    if(l<0)return;
    (rows[l]||(rows[l]=[])).push(b);
  });

  // Расставляем ряды сверху вниз
  const rowNums=Object.keys(rows).map(Number).sort((a,b)=>a-b);
  const rowYMap={};
  let curY=startY;
  rowNums.forEach(rn=>{
    rowYMap[rn]=curY;
    const maxBh=Math.max(...rows[rn].map(b=>bh(b)));
    curY+=maxBh+vGap;
  });

  // Ширина самого широкого ряда → по ней выравниваем остальные
  const rowWidth=rn=>rows[rn].length*(BW+hGap)-hGap;
  const maxW=Math.max(1,...rowNums.map(rowWidth));

  rowNums.forEach(rn=>{
    const blocks=rows[rn];
    const totalW=rowWidth(rn);
    let x=startX+Math.round((maxW-totalW)/2);
    blocks.forEach(b=>{
      b.x=x;
      b.y=Math.round(rowYMap[rn]);
      x+=BW+hGap;
    });
  });

  // ── БД: под своими сервисами, остальные — отдельный ряд ──────────
  const svcBlocks=rows[3]||[];

  // Собираем связи svc↔db (в обоих направлениях)
  const svcToDb={};
  S.conns.forEach(c=>{
    const fb=gb(c.from),tb=gb(c.to);if(!fb||!tb)return;
    const fc=BASE[fb.type]?.cat,tc=BASE[tb.type]?.cat;
    if(fc==='svc'&&(tc==='db'||tc==='cache')){
      const a=svcToDb[fb.id]||(svcToDb[fb.id]=new Set());a.add(tb.id);
    }
    if(tc==='svc'&&(fc==='db'||fc==='cache')){
      const a=svcToDb[tb.id]||(svcToDb[tb.id]=new Set());a.add(fb.id);
    }
  });

  const dbY=curY;
  curY+=BH+vGap;
  const placed=new Set();

  // Для каждого сервиса — его БД ровно под ним
  svcBlocks.forEach(svc=>{
    const dbs=[...(svcToDb[svc.id]||[])]
      .map(id=>dbBlocks.find(d=>d.id===id)).filter(Boolean)
      .filter(d=>!placed.has(d.id));
    if(!dbs.length)return;
    const totalW=dbs.length*(BW+hGap)-hGap;
    let x=svc.x+Math.round((BW-totalW)/2);
    dbs.forEach(db=>{
      db.x=x;
      db.y=dbY;
      placed.add(db.id);
      x+=BW+hGap;
    });
  });

  // Несвязанные БД — после остальных в том же ряду
  let freeX=startX;
  dbBlocks.filter(d=>!placed.has(d.id)).forEach(db=>{
    db.x=freeX;
    db.y=dbY;
    placed.add(db.id);
    freeX+=BW+hGap;
  });

  // ── Брокеры: правая колонка ───────────────────────────────────────
  // X = правее самого широкого ряда + отступ
  const rightX=startX+maxW+90;
  let by=startY;
  brokers.forEach(b=>{
    b.x=rightX;
    b.y=Math.round(by);
    by+=bh(b)+60;
  });

  pushHist();analyze();toast(t('layout_applied'));
}
