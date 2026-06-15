// RENDER — маршрутизация стрелок, отрисовка холста, формы блоков, двунаправленные стрелки

// ═══════════════════════════════════════════════════════════════
// МАРШРУТИЗАЦИЯ СТРЕЛОК (использует bw/bh — учитывает ручной ресайз)
// ═══════════════════════════════════════════════════════════════
function route(conn){
  const f=gb(conn.from),t=gb(conn.to);if(!f||!t)return null;
  const fw=bw(f),fh=bh(f),tw=bw(t),th2=bh(t);
  const fcx=f.x+fw/2,fcy=f.y+fh/2,tcx=t.x+tw/2,tcy=t.y+th2/2,dx=tcx-fcx,dy=tcy-fcy;
  // Вертикальный выход (снизу/сверху) если цель явно ниже/выше (>50px)
  // И вертикальное смещение > 30% горизонтального.
  // Это даёт чистый выход из низа для hub→spoke топологий (Gateway → сервисы).
  const vert=Math.abs(dy)>50&&Math.abs(dy)>Math.abs(dx)*0.18;
  const out=S.conns.filter(c=>c.from===conn.from).sort((a,b)=>{const ta=gb(a.to),tb=gb(b.to);return vert?(ta?.x||0)-(tb?.x||0):(ta?.y||0)-(tb?.y||0);});
  const oi=out.findIndex(c=>c.id===conn.id),oc=out.length;
  const inc=S.conns.filter(c=>c.to===conn.to).sort((a,b)=>{const fa=gb(a.from),fb=gb(b.from);return vert?(fa?.x||0)-(fb?.x||0):(fa?.y||0)-(fb?.y||0);});
  const ii=inc.findIndex(c=>c.id===conn.id),ic=inc.length;
  const isGw=BASE[gb(conn.from)?.type]?.cat==='gw';
  const oSp=(!isGw&&oc>1)?(oi-(oc-1)/2)*Math.min(16,fw/oc):0;
  const iSp=ic>1?(ii-(ic-1)/2)*Math.min(16,tw/ic):0;
  let sx,sy,ex,ey,c1x,c1y,c2x,c2y,axis;
  if(vert&&dy>0) {sx=fcx+oSp;sy=f.y+fh;ex=tcx+iSp;ey=t.y;    axis='v';}
  else if(vert)  {sx=fcx+oSp;sy=f.y;    ex=tcx+iSp;ey=t.y+th2;axis='v';}
  else if(dx>=0) {sx=f.x+fw; sy=fcy+oSp;ex=t.x;     ey=tcy+iSp;axis='h';}
  else           {sx=f.x;    sy=fcy+oSp;ex=t.x+tw;  ey=tcy+iSp;axis='h';}
  // Зажать точки выхода/входа внутри блоков (oSp может выйти за пределы)
  if(axis==='h'){sy=Math.max(f.y+4,Math.min(f.y+fh-4,sy));ey=Math.max(t.y+4,Math.min(t.y+th2-4,ey));}
  if(axis==='v'){sx=Math.max(f.x+4,Math.min(f.x+fw-4,sx));ex=Math.max(t.x+4,Math.min(t.x+tw-4,ex));}

  // ── routeStyle: per-connection routing mode ───────────────
  const _rs=conn.routeStyle;
  if(_rs==='straight'){
    const pts=[{x:sx,y:sy},{x:ex,y:ey}];
    return{sx,sy,ex,ey,c1x:sx,c1y:sy,c2x:ex,c2y:ey,pts,d:`M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`,ortho:true};
  }
  if(_rs==='ortho-h'){
    const pts=[{x:sx,y:sy},{x:ex,y:sy},{x:ex,y:ey}];
    const cl=dedup(pts);
    return{sx,sy,ex,ey,pts:cl,d:'M '+cl.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' L '),ortho:true};
  }
  if(_rs==='ortho-v'){
    const pts=[{x:sx,y:sy},{x:sx,y:ey},{x:ex,y:ey}];
    const cl=dedup(pts);
    return{sx,sy,ex,ey,pts:cl,d:'M '+cl.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' L '),ortho:true};
  }

  if(axis==='v'){const m=(sy+ey)/2;c1x=sx;c1y=m;c2x=ex;c2y=m;}
  else{const m=(sx+ex)/2;c1x=m;c1y=sy;c2x=m;c2y=ey;}
  if((S.edgeStyle||'ortho')==='ortho'){
    let pts;
    if(axis==='v'){
      const stub=Math.min(30,Math.abs(ey-sy)*0.12);
      const bus=sy+(dy>0?stub:-stub);
      pts=[{x:sx,y:sy},{x:sx,y:bus},{x:ex,y:bus},{x:ex,y:ey}];
    } else {
      pts=[{x:sx,y:sy},{x:ex,y:sy},{x:ex,y:ey}];
    }
    const cl=dedup(pts);if(cl.length<2)cl.push({x:ex,y:ey});
    const d='M '+cl.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' L ');
    return {sx,sy,ex,ey,c1x,c1y,c2x,c2y,pts:cl,d,ortho:true};
  }
  return{sx,sy,ex,ey,c1x,c1y,c2x,c2y,d:`M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`};
}
// Убрать дублирующиеся соседние точки пути
function dedup(pts){
  const cl=[];
  for(const p of pts){const last=cl[cl.length-1];if(!last||Math.abs(last.x-p.x)>0.5||Math.abs(last.y-p.y)>0.5)cl.push(p);}
  return cl;
}

function polyMid(pts){
  let tot=0;const seg=[];for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);seg.push(l);tot+=l;}
  let d=tot/2;for(let i=0;i<seg.length;i++){if(d<=seg[i]||i===seg.length-1){const t=seg[i]?d/seg[i]:0;return {x:pts[i].x+(pts[i+1].x-pts[i].x)*t,y:pts[i].y+(pts[i+1].y-pts[i].y)*t};}d-=seg[i];}
  return pts[0];
}
function edgePts(conn){const r=route(conn);if(!r)return null;
  if(r.pts&&r.pts.length>1){
    const seg=[];let tot=0;for(let i=1;i<r.pts.length;i++){const l=Math.hypot(r.pts[i].x-r.pts[i-1].x,r.pts[i].y-r.pts[i-1].y);seg.push(l);tot+=l;}
    const N=28,out=[];
    for(let i=0;i<=N;i++){let d=tot*i/N,si=0;while(si<seg.length-1&&d>seg[si]){d-=seg[si];si++;}
      const a=r.pts[si],b=r.pts[si+1]||a,t=seg[si]?Math.min(1,d/seg[si]):0;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    return out;
  }
  const p=[],N=24;for(let i=0;i<=N;i++){const t=i/N,u=1-t;p.push({x:u*u*u*r.sx+3*u*u*t*r.c1x+3*u*t*t*r.c2x+t*t*t*r.ex,y:u*u*u*r.sy+3*u*u*t*r.c1y+3*u*t*t*r.c2y+t*t*t*r.ey});}return p;}

function getSegPts(from,to){
  const conn=S.conns.find(c=>c.from===from&&c.to===to);
  if(conn){const p=edgePts(conn);return p?{pts:p,connId:conn.id}:null;}
  const rev=S.conns.find(c=>c.from===to&&c.to===from);
  if(rev){const p=edgePts(rev);return p?{pts:[...p].reverse(),connId:rev.id}:null;}
  return null;
}

function isAsync(conn){const t=gb(conn.to);return t&&['broker','queue'].includes(BASE[t.type]?.cat);}

function connText(c){
  if(c.label)return c.label;
  const api=(typeof connApi==='function')?connApi(c):'';
  if(api)return api;
  if(c.dir==='req'&&c.reqLabel)return '→ '+c.reqLabel;
  if(c.dir==='resp'&&c.respLabel)return '◀ '+c.respLabel;
  if(c.reqLabel)return '→ '+c.reqLabel;
  if(c.respLabel)return '◀ '+c.respLabel;
  return '';
}

// ── Определить тип стрелки для двунаправленности ──────────────
// Правило: если между двумя узлами есть обратная связь ИЛИ тип требует двунаправленности
function isBidirectional(conn){
  const f=gb(conn.from), t=gb(conn.to);
  if(!f||!t) return false;
  const fc=BASE[f.type]?.cat, tc=BASE[t.type]?.cat;
  // Сервис ↔ БД, Клиент ↔ Gateway, Gateway ↔ Сервис, Сервис ↔ Сервис
  const biPairs=[
    ['client','gw'],['gw','client'],
    ['gw','svc'],['svc','gw'],
    ['svc','db'],['db','svc'],
    ['svc','cache'],['cache','svc'],
    ['net','svc'],['svc','net'],
    ['gw','net'],['net','gw'],
  ];
  if(biPairs.some(([a,b])=>fc===a&&tc===b)) return true;
  // WebSocket — явно двунаправленный
  if(f.type==='websocket_gw'||t.type==='websocket_gw') return true;
  // Если существует обратная связь
  const rev=S.conns.find(c=>c.from===conn.to&&c.to===conn.from);
  return !!rev;
}

// ── Определить стиль линии ──────────────────────────────────
function connStyle(conn){
  const f=gb(conn.from), t=gb(conn.to);
  if(!f||!t) return {dash:'none',bi:false};
  const tc=BASE[t.type]?.cat, fc=BASE[f.type]?.cat;
  const async=isAsync(conn);
  // WebSocket — пунктир двунаправленный
  if(f.type==='websocket_gw'||t.type==='websocket_gw') return {dash:'8 4',bi:true};
  // Брокер → Сервис: сплошная одна сторона
  if(fc==='broker'&&tc==='svc') return {dash:'none',bi:false};
  // Сервис → Брокер: пунктир одна сторона (асинхрон)
  if(fc==='svc'&&tc==='broker') return {dash:'7 4',bi:false};
  // Двунаправленные — сплошная с двумя стрелками
  if(isBidirectional(conn)) return {dash:'none',bi:true};
  if(async) return {dash:'7 4',bi:false};
  return {dash:'none',bi:false};
}

// ═══════════════════════════════════════════════════════════════
// РЕНДЕР
// ═══════════════════════════════════════════════════════════════
function mkEl(tag,a,p){const e=document.createElementNS(NS,tag);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}
function mkTxt(x,y,t,css,p){const e=document.createElementNS(NS,'text');e.setAttribute('x',x);e.setAttribute('y',y);e.setAttribute('text-anchor','middle');e.setAttribute('dominant-baseline','central');e.style.cssText=css;e.style.pointerEvents='none';e.textContent=t;if(p)p.appendChild(e);return e;}
function render(){renderConns();renderBlocks();$('hint').style.display=S.blocks.length?'none':'block';}

function renderConns(){
  const L=$('conn-layer');L.innerHTML='';L.setAttribute('transform',`translate(${S.panX},${S.panY})`);
  const connSet=((S.view||'workspace')==='c4')?c4Graph().conns:S.conns;
  connSet.forEach(c=>{
    const r=route(c);if(!r)return;
    const t=gb(c.to);const th=t?.rt?.health;
    let stroke='#6c7086',mk='arr';
    if(th==='error'){stroke='#f7768e99';mk='arrE';}else if(th==='warn'){stroke='#e0af6899';mk='arrW';}
    if(S.connWarn?.[c.id]?.sev==='error'){stroke='#f7768e99';mk='arrE';}
    if(S.hovConn===c.id||S.inspConn===c.id){stroke='#bb9af7';mk='arrH';}
    const cs=connStyle(c);
    const bi=cs.bi;
    const g=document.createElementNS(NS,'g');g.style.cursor='pointer';
    mkEl('path',{d:r.d,fill:'none',stroke:'transparent','stroke-width':'18'},g);
    const pathAttrs={d:r.d,fill:'none',stroke,'stroke-width':S.hovConn===c.id?'2.4':'1.6',
      'stroke-linejoin':'round','stroke-linecap':'round','marker-end':`url(#${mk})`};
    if(bi) pathAttrs['marker-start']=`url(#${mk}R)`;
    if(cs.dash!=='none') pathAttrs['stroke-dasharray']=cs.dash;
    mkEl('path',pathAttrs,g);
    g.addEventListener('mouseenter',()=>{S.hovConn=c.id;renderConns();});
    g.addEventListener('mouseleave',()=>{S.hovConn=null;renderConns();});
    g.addEventListener('click',e=>{e.stopPropagation();onConnClick(c.id);});
    g.addEventListener('dblclick',e=>{e.stopPropagation();S.conns=S.conns.filter(x=>x.id!==c.id);pushHist();analyze();});
    const lbl=connText(c);
    // В C2/C4 view подписи не показываем совсем — только в workspace при hover
    const isDocView=(S.view==='c4_level'||S.view==='c4');
    if(lbl&&!isDocView&&(S.hovConn===c.id||S.inspConn===c.id)){let mx=(r.sx+r.ex)/2,my=(r.sy+r.ey)/2;if(r.pts&&r.pts.length>1){const mp=polyMid(r.pts);mx=mp.x;my=mp.y;}const tw=lbl.length*5.6+10;
      mkEl('rect',{x:(mx-tw/2).toFixed(1),y:(my-8).toFixed(1),width:tw.toFixed(1),height:15,rx:4,fill:'#1a1b26ee',stroke:'#bb9af7','stroke-width':'1'},g);
      mkTxt(mx,my,lbl,'font-size:9.5px;fill:#c0caf5;font-weight:600',g);}

    // ── Переключатель роутинга (виден при наведении) ─────────
    if(S.hovConn===c.id){
      const _RSEQ=['auto','straight','ortho-h','ortho-v'];
      const _RLBL={auto:'↙↗',straight:'╱ прямая','ortho-h':'└─ H','ortho-v':'│ V'};
      const _RCLR={auto:'#787c99',straight:'#9ece6a','ortho-h':'#7aa2f7','ortho-v':'#e0af68'};
      const _cur=c.routeStyle||'auto';
      let _rx=(r.sx+r.ex)/2,_ry=(r.sy+r.ey)/2;
      if(r.pts&&r.pts.length>1){const mp=polyMid(r.pts);_rx=mp.x;_ry=mp.y;}
      _ry-=16; // чуть выше центра
      const _bw=46,_bh=15,_clr=_RCLR[_cur];
      const _btn=document.createElementNS(NS,'g');
      mkEl('rect',{x:(_rx-_bw/2).toFixed(1),y:(_ry-_bh/2).toFixed(1),width:_bw,height:_bh,rx:7,fill:'#1a1b26',stroke:_clr,'stroke-width':'1.3'},_btn);
      const _tEl=document.createElementNS(NS,'text');
      _tEl.setAttribute('x',_rx.toFixed(1));_tEl.setAttribute('y',(_ry+1).toFixed(1));
      _tEl.setAttribute('text-anchor','middle');_tEl.setAttribute('dominant-baseline','central');
      _tEl.style.cssText=`font-size:8px;fill:${_clr};pointer-events:none`;
      _tEl.textContent=_RLBL[_cur];_btn.appendChild(_tEl);
      _btn.style.cursor='pointer';
      _btn.addEventListener('click',e=>{
        e.stopPropagation();
        const _ni=(_RSEQ.indexOf(_cur)+1)%_RSEQ.length;
        const _next=_RSEQ[_ni];
        c.routeStyle=_next==='auto'?undefined:_next;
        pushHist();renderConns();
      });
      g.appendChild(_btn);
    }

    L.appendChild(g);
  });
  if((S.view||'workspace')==='workspace'&&typeof renderRouteStripes==='function')renderRouteStripes(L);
  if(S.mode==='connecting'){const fb=gb(S.connFrom);if(fb)mkEl('line',{x1:fb.x+bw(fb),y1:fb.y+bh(fb)/2,x2:S.tempX,y2:S.tempY,stroke:'#bb9af7','stroke-width':'1.8','stroke-dasharray':'5 4'},L);}
}

function wrap2(s,max){
  if(s.length<=max)return [s,''];
  const words=s.split(' ');let l1='',l2='';
  for(const w of words){if(!l2&&(l1?l1+' '+w:w).length<=max)l1=l1?l1+' '+w:w;else l2=l2?l2+' '+w:w;}
  if(!l1){l1=s.slice(0,max);l2=s.slice(max);}
  if(l2.length>max)l2=l2.slice(0,max-1)+'…';
  return [l1,l2];
}
function drawPerson(g,b,W,H,clr){
  const cxv=b.x+W/2,top=b.y+4,figH=H-8;
  const headR=Math.max(6,Math.min(11,figH*0.17));
  const hy=top+headR;const sw='2';
  mkEl('circle',{cx:cxv,cy:hy,r:headR,fill:clr+'22',stroke:clr,'stroke-width':sw},g);
  const neck=hy+headR, hip=top+figH*0.72, foot=top+figH;
  mkEl('line',{x1:cxv,y1:neck,x2:cxv,y2:hip,stroke:clr,'stroke-width':sw},g);
  const armY=neck+(hip-neck)*0.35,armW=W*0.26;
  mkEl('line',{x1:cxv-armW,y1:armY+4,x2:cxv,y2:armY,stroke:clr,'stroke-width':sw},g);
  mkEl('line',{x1:cxv,y1:armY,x2:cxv+armW,y2:armY+4,stroke:clr,'stroke-width':sw},g);
  mkEl('line',{x1:cxv,y1:hip,x2:cxv-W*0.2,y2:foot,stroke:clr,'stroke-width':sw},g);
  mkEl('line',{x1:cxv,y1:hip,x2:cxv+W*0.2,y2:foot,stroke:clr,'stroke-width':sw},g);
}
const AUTH_TYPE_LABEL={oauth2_jwt:'OAuth2+JWT',jwt_only:'JWT',session_based:'Session'};
function drawBlockLabel(g,b,W,H,d,icons,sc,rt){
  const lbl=(b.customLabel||d.lbl)+(icons?' '+icons:'');
  const maxChars=Math.max(8,Math.floor((W-14)/6.6));
  const showLoad=rt.cap&&isFinite(rt.cap)&&rt.lambdaIn>0;
  const isStore=(d.cat==='db'||d.cat==='cache');
  let sub;
  if(showLoad)sub=`${Math.round(rt.rho*100)}% · ${fmt(rt.lambdaIn)}rps`;
  else if(b.type==='auth')sub='🔐 '+(AUTH_TYPE_LABEL[(typeof authType==='function')?authType(b):'jwt_only']||'JWT');
  else if(isStore){
    if(b.customLabel)sub=d.lbl;
    else if(d.cat==='cache')sub='кэш';
    else sub={elasticsearch:'Поиск',s3:'Объекты',clickhouse:'OLAP',cassandra:'NoSQL',mongodb:'NoSQL',redis:'кэш'}[b.type]||'БД';
  }
  else sub=d.sub||d.cat;
  const subClr=showLoad?(sc||'#787c99'):'#787c99';
  if(lbl.length<=maxChars){
    mkTxt(b.x+W/2,b.y+H/2-7,lbl,`font-size:11.5px;font-weight:600;fill:${d.clr}`,g);
    mkTxt(b.x+W/2,b.y+H/2+8,sub,`font-size:9px;fill:${subClr}`,g);
  }else{
    const [l1,l2]=wrap2(lbl,maxChars);
    mkTxt(b.x+W/2,b.y+H/2-9,l1,`font-size:11px;font-weight:600;fill:${d.clr}`,g);
    mkTxt(b.x+W/2,b.y+H/2+3,l2,`font-size:11px;font-weight:600;fill:${d.clr}`,g);
    mkTxt(b.x+W/2,b.y+H/2+15,sub,`font-size:8.5px;fill:${subClr}`,g);
  }
}

function shapeOf(b){
  const d=EL[b.type];if(!d)return'box';
  if(d.shape)return d.shape;
  const cat=d.cat;
  if(cat==='db'||cat==='cache')return'cylinder';
  if(cat==='broker'||cat==='queue')return'queue';
  if(cat==='client')return'app';
  if(cat==='gw')return'hex';
  return'box';
}
function drawCylinder(g,b,W,H,clr,sc,dash){
  const x=b.x,y=b.y,ry=Math.min(9,H*0.16),cx=x+W/2,rx=W/2;
  const st=sc||clr,sw=sc?'1.5':'1.2';
  mkEl('rect',{x,y:y+ry,width:W,height:H-2*ry,fill:clr+'22',stroke:'none'},g);
  mkEl('ellipse',{cx,cy:y+H-ry,rx,ry,fill:clr+'22',stroke:st,'stroke-width':sw,'stroke-dasharray':dash},g);
  mkEl('line',{x1:x,y1:y+ry,x2:x,y2:y+H-ry,stroke:st,'stroke-width':sw},g);
  mkEl('line',{x1:x+W,y1:y+ry,x2:x+W,y2:y+H-ry,stroke:st,'stroke-width':sw},g);
  mkEl('ellipse',{cx,cy:y+ry,rx,ry,fill:clr+'33',stroke:st,'stroke-width':sw},g);
}
function drawQueue(g,b,W,H,clr,sc,dash){
  const x=b.x,y=b.y,rx=Math.min(9,W*0.06),cy=y+H/2,ry=H/2;
  const st=sc||clr,sw=sc?'1.5':'1.2';
  mkEl('rect',{x:x+rx,y,width:W-2*rx,height:H,fill:clr+'22',stroke:'none'},g);
  mkEl('ellipse',{cx:x+rx,cy,rx,ry,fill:clr+'33',stroke:st,'stroke-width':sw},g);
  mkEl('line',{x1:x+rx,y1:y,x2:x+W-rx,y2:y,stroke:st,'stroke-width':sw},g);
  mkEl('line',{x1:x+rx,y1:y+H,x2:x+W-rx,y2:y+H,stroke:st,'stroke-width':sw},g);
  mkEl('ellipse',{cx:x+W-rx,cy,rx,ry,fill:clr+'22',stroke:st,'stroke-width':sw},g);
}
function drawApp(g,b,W,H,clr,sc,dash){
  const x=b.x,y=b.y,bar=11;const st=sc||clr,sw=sc?'1.5':'1.2';
  mkEl('rect',{x,y,width:W,height:H,rx:8,fill:clr+'22',stroke:st,'stroke-width':sw,'stroke-dasharray':dash},g);
  mkEl('path',{d:`M ${x} ${y+bar} Q ${x} ${y} ${x+8} ${y} L ${x+W-8} ${y} Q ${x+W} ${y} ${x+W} ${y+bar} Z`,fill:clr+'33',stroke:'none'},g);
  mkEl('line',{x1:x,y1:y+bar,x2:x+W,y2:y+bar,stroke:st,'stroke-width':'1','opacity':'0.6'},g);
  [0,1,2].forEach(i=>mkEl('circle',{cx:x+9+i*8,cy:y+bar/2+0.5,r:1.8,fill:clr,opacity:'0.7'},g));
}
function drawHex(g,b,W,H,clr,sc,dash){
  const x=b.x,y=b.y,k=Math.min(14,W*0.12);const st=sc||clr,sw=sc?'1.5':'1.2';
  mkEl('path',{d:`M ${x+k} ${y} L ${x+W-k} ${y} L ${x+W} ${y+H/2} L ${x+W-k} ${y+H} L ${x+k} ${y+H} L ${x} ${y+H/2} Z`,
    fill:clr+'22',stroke:st,'stroke-width':sw,'stroke-dasharray':dash},g);
}
function drawBlockShape(g,b,W,H,shape,clr,sc,dash){
  if(shape==='cylinder')return drawCylinder(g,b,W,H,clr,sc,dash);
  if(shape==='queue')return drawQueue(g,b,W,H,clr,sc,dash);
  if(shape==='app')return drawApp(g,b,W,H,clr,sc,dash);
  if(shape==='hex')return drawHex(g,b,W,H,clr,sc,dash);
  mkEl('rect',{x:b.x,y:b.y,width:W,height:H,rx:shape==='ext'?4:9,fill:clr+'22',stroke:sc||clr,'stroke-width':sc?'1.5':'1.2','stroke-dasharray':dash},g);
  if(shape==='box')mkEl('rect',{x:b.x+9,y:b.y,width:W-18,height:3,rx:1.5,fill:clr},g);
}

// ═══════════════════════════════════════════════════════════════
// C4 ПРЕДСТАВЛЕНИЕ (строгая нотация контейнеров)
// ═══════════════════════════════════════════════════════════════
function setView(v){
  S.view=v;
  const ws=$('view-ws'),c4=$('view-c4');
  if(ws)ws.style.color=v==='workspace'?'#7aa2f7':'';
  if(c4)c4.style.color=v==='c4'?'#7aa2f7':'';
  render();
}
function c4Kind(b){const cat=EL[b.type]?.cat;if(cat==='actor'||EL[b.type]?.shape==='person'||EL[b.type]?.shape==='role')return'Person';if(cat==='external'||EL[b.type]?.shape==='ext')return'External System';return'Container';}
function c4Tech(b){const cat=EL[b.type]?.cat;if(b.tech)return b.tech;if(['db','cache','broker','queue'].includes(cat))return EL[b.type]?.lbl;if(cat==='client')return EL[b.type]?.lbl;if(cat==='gw')return'API Gateway';if(cat==='bff')return'BFF';if(cat==='svc')return'Сервис';return EL[b.type]?.lbl||'';}
function c4Desc(b){return b.desc||EL[b.type]?.role||'';}
function c4Graph(){
  const hidden=new Set(S.blocks.filter(b=>EL[b.type]?.cat==='net').map(b=>b.id));
  const blocks=S.blocks.filter(b=>!hidden.has(b.id));
  const conns=[];const seen=new Set();
  const push=c=>{const k=c.from+'>'+c.to;if(!seen.has(k)){seen.add(k);conns.push(c);}};
  S.conns.filter(c=>!hidden.has(c.from)&&!hidden.has(c.to)).forEach(push);
  hidden.forEach(h=>{
    const srcs=S.conns.filter(c=>c.to===h&&!hidden.has(c.from)).map(c=>c.from);
    const tgts=S.conns.filter(c=>c.from===h&&!hidden.has(c.to)).map(c=>c.to);
    srcs.forEach(s=>tgts.forEach(t=>push({id:'c4_'+s+'_'+t,from:s,to:t,synthetic:true})));
  });
  return {blocks,conns,hidden};
}
function clip(s,n){return s&&s.length>n?s.slice(0,n-1)+'…':s;}
function drawC4Label(g,b,W,H,d){
  const cx=b.x+W/2,cy=b.y+H/2;
  const name=b.customLabel||d.lbl;
  const tech=`[${c4Kind(b)}: ${c4Tech(b)}]`;
  const desc=c4Desc(b);
  const maxC=Math.max(8,Math.floor((W-12)/4.7));
  mkTxt(cx,cy-9,clip(name,maxC),`font-size:10.5px;font-weight:700;fill:${d.clr}`,g);
  mkTxt(cx,cy+2,clip(tech,maxC+5),'font-size:7.5px;fill:#9aa5ce',g);
  if(desc)mkTxt(cx,cy+12,clip(desc,maxC),'font-size:7px;fill:#787c99',g);
}
function renderC4(L){
  const {blocks}=c4Graph();
  const inner=blocks.filter(b=>c4Kind(b)==='Container');
  if(inner.length){
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    inner.forEach(b=>{const W=bw(b),H=bh(b);x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+W);y1=Math.max(y1,b.y+H);});
    const pad=28;
    mkEl('rect',{x:x0-pad,y:y0-pad,width:x1-x0+2*pad,height:y1-y0+2*pad,rx:14,fill:'#7aa2f708',stroke:'#7aa2f755','stroke-width':'1.4','stroke-dasharray':'9 5'},L);
    mkTxt(x0-pad+90,y0-pad-9,(S.meta?.systemName||'Система')+'  [Software System]','font-size:10px;fill:#7aa2f7;font-weight:600',L);
  }
  blocks.forEach(b=>{
    const d=EL[b.type];if(!d)return;const W=bw(b),H=bh(b),shape=shapeOf(b);
    const g=document.createElementNS(NS,'g');
    const sel=S.selected===b.id,hov=S.hovered===b.id;
    if(sel)mkEl('rect',{x:b.x-4,y:b.y-4,width:W+8,height:H+8,rx:11,fill:'none',stroke:'#bb9af7','stroke-width':'1.6','stroke-dasharray':'5 3'},g);
    if(shape==='person'||shape==='role'){
      drawPerson(g,b,W,H,d.clr);
      mkTxt(b.x+W/2,b.y+H+9,b.customLabel||d.lbl,`font-size:11px;font-weight:700;fill:${d.clr}`,g);
      mkTxt(b.x+W/2,b.y+H+20,'[Person]','font-size:8px;fill:#9aa5ce',g);
    }else{
      drawBlockShape(g,b,W,H,shape,d.clr,null,shape==='ext'?'6 4':'none');
      drawC4Label(g,b,W,H,d);
    }
    // Порт для связей — справа (b.x + bw(b))
    if(hov){const px=b.x+bw(b);const port=mkEl('circle',{cx:px,cy:b.y+H/2,r:7,fill:'#1a1b26',stroke:d.clr,'stroke-width':'2'},g);port.style.cursor='crosshair';port.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();S.mode='connecting';S.connFrom=b.id;const pt=svgPt(e);S.tempX=pt.x;S.tempY=pt.y;renderConns();});}
    L.appendChild(g);
  });
}

function renderBlocks(){
  const L=$('block-layer');L.innerHTML='';L.setAttribute('transform',`translate(${S.panX},${S.panY})`);
  if((S.view||'workspace')==='c4'){renderC4(L);return;}
  if((S.view||'workspace')==='c4_level'&&typeof renderC4Level==='function'){renderC4Level(L);return;}
  S.blocks.forEach(b=>{
    const d=EL[b.type];if(!d)return;
    const W=bw(b),H=bh(b),shape=shapeOf(b);
    const rt=b.rt||{health:'ok'};const sc=hClr(rt.health);
    const sel=S.selected===b.id,hov=S.hovered===b.id;
    const g=document.createElementNS(NS,'g');
    if(sel)mkEl('rect',{x:b.x-4,y:b.y-4,width:W+8,height:H+8,rx:11,fill:'none',stroke:'#bb9af7','stroke-width':'1.6','stroke-dasharray':'5 3'},g);
    if(rt.cascade)mkEl('rect',{x:b.x-3,y:b.y-3,width:W+6,height:H+6,rx:11,fill:'none',stroke:'#e0af68','stroke-width':'1.4','stroke-dasharray':'2 3',opacity:'0.7'},g);
    // Красная рамка при коллизии
    if(b._collision)mkEl('rect',{x:b.x-3,y:b.y-3,width:W+6,height:H+6,rx:11,fill:'none',stroke:'#f7768e','stroke-width':'2','stroke-dasharray':'none',opacity:'0.9'},g);
    if(S.mode==='routing'&&typeof isRouteCandidate==='function'&&isRouteCandidate(b.id))mkEl('rect',{x:b.x-5,y:b.y-5,width:W+10,height:H+10,rx:12,fill:'none',stroke:'#9ece6a','stroke-width':'2','stroke-dasharray':'4 3',opacity:'0.95'},g);
    const icons=(b.patterns||[]).map(p=>PAT[p]?.icon||'').join('');
    if(shape==='person'||shape==='role'){
      drawPerson(g,b,W,H,d.clr);
      mkTxt(b.x+W/2,b.y+H+9,b.customLabel||d.lbl,`font-size:11.5px;font-weight:600;fill:${d.clr}`,g);
      const hasScen=b.scenario&&b.scenario.trim();
      if(hasScen)mkTxt(b.x+W-6,b.y+4,'📜','font-size:12px;fill:#e0af68',g);
      mkTxt(b.x+W/2,b.y+H+21,hasScen?'сценарий ✓ (2× клик)':'2× клик — сценарий','font-size:8px;fill:#787c99',g);
    }else{
      const dash=rt.health==='error'?'5 3':(shape==='ext'?'6 4':'none');
      drawBlockShape(g,b,W,H,shape,d.clr,sc,dash);
      drawBlockLabel(g,b,W,H,d,icons,sc,rt);
      if(b.type==='auth')mkTxt(b.x+13,b.y+11,'🔐','font-size:11px',g); // всегда видно что это auth
      const s=b.settings||{};const n=s.replicas||s.instances||s.nodes||s.shards;
      if(n>1)mkTxt(b.x+11,b.y+H-6,`×${n}`,'font-size:9px;fill:#9ece6a;font-weight:700',g);
      if(rt.cbOpen)mkTxt(b.x+W-18,b.y+H-6,'⚡CB','font-size:8px;fill:#ff9e64;font-weight:700',g);
      if(sc)mkEl('circle',{cx:b.x+W-8,cy:b.y+8,r:4.5,fill:sc},g);
    }
    // Порт для связей — справа: b.x + bw(b)
    if(hov){const px=b.x+bw(b);const port=mkEl('circle',{cx:px,cy:b.y+H/2,r:7,fill:'#1a1b26',stroke:d.clr,'stroke-width':'2'},g);port.style.cursor='crosshair';port.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();S.mode='connecting';S.connFrom=b.id;const pt=svgPt(e);S.tempX=pt.x;S.tempY=pt.y;renderConns();});}
    if(sel){
      const xc=mkEl('circle',{cx:b.x+W,cy:b.y,r:7.5,fill:'#f7768e'},g);xc.style.cursor='pointer';xc.addEventListener('click',e=>{e.stopPropagation();delBlock(b.id);});mkTxt(b.x+W,b.y+1,'×','font-size:11px;fill:#fff;font-weight:bold',g);
      const rh=mkEl('rect',{x:b.x+W-6,y:b.y+H-6,width:12,height:12,rx:2,fill:'#bb9af7',stroke:'#1a1b26','stroke-width':'1.2'},g);rh.style.cursor='nwse-resize';
      rh.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();S.mode='resizing';S.resizeId=b.id;S.rsOx=e.clientX;S.rsOy=e.clientY;S.rsW=W;S.rsH=H;});
    }
    L.appendChild(g);
  });
}

// Добавить маркеры для обратных стрелок в defs SVG
function ensureBiMarkers(){
  const svg=$('canvas');
  const defs=svg.querySelector('defs');
  if(!defs) return;
  if(defs.querySelector('#arrR')) return;
  ['arr','arrE','arrW','arrH'].forEach(id=>{
    const src=defs.querySelector('#'+id);
    if(!src) return;
    const clone=src.cloneNode(true);
    clone.id=id+'R';
    clone.setAttribute('orient','auto-start-reverse');
    defs.appendChild(clone);
  });
}
