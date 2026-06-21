// LAYOUT — авторасстановка блоков по слоям

// Слои: 0=клиенты, 1=сеть(gw/lb/cdn/ws), 2=сервисы, 3=брокеры, 4=хранилища, 5=внешние
function layerOf(b){
  const cat=BASE[b.type]?.cat;
  if(cat==='client'||cat==='actor') return 0;
  if(cat==='gw'||cat==='net') return 1;
  if(cat==='svc') return 2;
  if(cat==='broker'||cat==='queue') return 3;
  if(cat==='db'||cat==='cache') return 4;
  if(cat==='external') return 5;
  return 2;
}

function autoLayout(){
  if(!S.blocks.length){toast('Нет блоков');return;}

  const layers=[[], [], [], [], [], []];
  S.blocks.forEach(b=>{
    const l=layerOf(b);
    layers[l].push(b);
  });

  const startX=60, startY=40;
  const layerGap=190;  // горизонтальный шаг между слоями
  const blockGap=70;   // вертикальный шаг внутри слоя

  layers.forEach((layerBlocks,li)=>{
    if(!layerBlocks.length)return;
    const x=startX+li*layerGap;
    const totalH=layerBlocks.length*(BH+blockGap)-blockGap;
    let y=startY+Math.max(0,(400-totalH)/2); // центрировать по вертикали
    layerBlocks.forEach(b=>{
      b.x=x;
      b.y=Math.round(y);
      y+=bh(b)+blockGap;
    });
  });

  pushHist();analyze();toast('📐 Авто-расстановка применена');
}
