// ICONS95 — объёмные «пластиковые» иконки палитры в духе Rhino / MatrixGold.
// Единая световая схема: свет сверху-слева. Каждая фигурка = базовый цвет +
// общие накладки из спрайта #i3d-defs (тень формы, блик, цилиндрическое
// затенение, сферический блик, тень на «полу»). Цвет — параметр, поэтому
// градиенты не дублируются и id не конфликтуют. viewBox 20×20, рисуются 18px.

const I3D_SIZE=18;
// Общие градиенты (один раз на документ; не display:none — иначе Chrome не рисует url(#…))
function _i3dEnsureDefs(){
  if(typeof document==='undefined'||document.getElementById('i3d-defs'))return;
  const host=document.body||document.documentElement;if(!host)return;
  const d=document.createElement('div');
  d.innerHTML=`<svg id="i3d-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>
  <linearGradient id="i3-v" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".48" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
  <linearGradient id="i3-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".26" stop-color="#fff" stop-opacity=".62"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
  <linearGradient id="i3-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient>
  <linearGradient id="i3-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="i3-s" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".28" stop-color="#fff" stop-opacity=".15"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
  <radialGradient id="i3-f"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="dbvg-node" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f3f5f8"/><stop offset="1" stop-color="#dde1e7"/></linearGradient><linearGradient id="dbvg-primary" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset=".5" stop-color="#dbe7fb"/><stop offset="1" stop-color="#b9cef3"/></linearGradient><linearGradient id="dbvg-replica" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#f5fbf3"/><stop offset=".5" stop-color="#dcf0d7"/><stop offset="1" stop-color="#b9dfb1"/></linearGradient><linearGradient id="dbvg-proxy" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#fbf6fe"/><stop offset=".5" stop-color="#ecdff7"/><stop offset="1" stop-color="#d3bdea"/></linearGradient><linearGradient id="dbvg-client" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f1f2f4"/><stop offset="1" stop-color="#d9dce1"/></linearGradient><linearGradient id="dbvg-disk" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#f7f8fa"/><stop offset=".5" stop-color="#e6e9ee"/><stop offset="1" stop-color="#cdd2d9"/></linearGradient><radialGradient id="dbvg-ball" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef1f5"/><stop offset="1" stop-color="#cfd5de"/></radialGradient><radialGradient id="dbvg-ball-rep" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e2f3df"/><stop offset="1" stop-color="#b5dcae"/></radialGradient><radialGradient id="dbvg-ball-ack" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#7fd08a"/><stop offset=".45" stop-color="#2f9a43"/><stop offset="1" stop-color="#1b6a2a"/></radialGradient><radialGradient id="dbvg-ball-warm" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff4cf"/><stop offset=".5" stop-color="#f5c04a"/><stop offset="1" stop-color="#c98a12"/></radialGradient><linearGradient id="dbvg-warm" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset=".5" stop-color="#fbeccd"/><stop offset="1" stop-color="#efd29a"/></linearGradient>
  </defs></svg>`;
  host.appendChild(d.firstChild);
}
// цветовые помощники
function _hx(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
function _rgb(a){return '#'+a.map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');}
function _dk(h,f){return _rgb(_hx(h).map(c=>c*(f==null?.55:f)));}
function _lt(h,t){return _rgb(_hx(h).map(c=>c+(255-c)*(t==null?.45:t)));}

// Обёртка: svg + тень на полу
function _i3(body,floor){
  _i3dEnsureDefs();
  const fl=floor===false?'':`<ellipse cx="10.5" cy="18.4" rx="${floor||7}" ry="1.5" fill="url(#i3-f)"/>`;
  return `<svg class="i95 i3d" width="${I3D_SIZE}" height="${I3D_SIZE}" viewBox="0 0 20 20" style="vertical-align:-4px;margin-right:6px;flex-shrink:0;overflow:visible">${fl}${body}</svg>`;
}
// Фигура с базовым цветом + накладкой (одна геометрия дважды)
function _sh(tag,attrs,clr,ov){
  const a=Object.entries(attrs).map(([k,v])=>`${k}="${v}"`).join(' ');
  return `<${tag} ${a} fill="${clr}" stroke="${_dk(clr,.5)}" stroke-width=".7"/>`+`<${tag} ${a} fill="url(#${ov||'i3-v'})"/>`;
}
// блик-«зайчик»
const _spec=(x,y,rx,ry,op)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry||rx*.6}" fill="#fff" opacity="${op||.85}"/>`;

// Цилиндр (хранилища)
function _cyl(clr,opt){
  opt=opt||{};const x=4,w=12,y0=4,y1=15.5,ry=2.2;
  const body=`M${x} ${y0}v${y1-y0}a${w/2} ${ry} 0 0 0 ${w} 0v${-(y1-y0)}z`;
  let s=`<path d="${body}" fill="${clr}" stroke="${_dk(clr,.5)}" stroke-width=".7"/><path d="${body}" fill="url(#i3-h)"/>`;
  if(opt.bands)[8,11.8].forEach(y=>{s+=`<path d="M${x} ${y}a${w/2} ${ry} 0 0 0 ${w} 0" fill="none" stroke="${_dk(clr,.55)}" stroke-width=".7" opacity=".8"/>`;});
  s+=`<ellipse cx="10" cy="${y0}" rx="${w/2}" ry="${ry}" fill="${_lt(clr,.35)}" stroke="${_dk(clr,.5)}" stroke-width=".7"/><ellipse cx="10" cy="${y0}" rx="${w/2}" ry="${ry}" fill="url(#i3-t)"/>`;
  s+=`<rect x="6" y="${y0+3}" width="1.4" height="${y1-y0-3.5}" rx=".7" fill="#fff" opacity=".55"/>`;
  return s+(opt.mark||'');
}
// Горизонтальная труба (брокеры)
function _pipe(clr,rings){
  const y=6,h=8,x0=3,x1=16,rx=1.8;
  const body=`M${x0} ${y}h${x1-x0}a${rx} ${h/2} 0 0 1 0 ${h}h${-(x1-x0)}z`;
  let s=`<path d="${body}" fill="${clr}" stroke="${_dk(clr,.5)}" stroke-width=".7"/><path d="${body}" fill="url(#i3-v)"/>`;
  s+=`<rect x="${x0+1}" y="${y+1.3}" width="${x1-x0-2}" height="1.5" rx=".75" fill="#fff" opacity=".6"/>`;
  (rings||[]).forEach(rx_=>{s+=`<rect x="${rx_}" y="${y-.8}" width="2" height="${h+1.6}" rx=".6" fill="${_dk(clr,.72)}" stroke="${_dk(clr,.45)}" stroke-width=".5"/><rect x="${rx_}" y="${y-.8}" width="2" height="${h+1.6}" rx=".6" fill="url(#i3-h)"/>`;});
  s+=`<ellipse cx="${x0}" cy="${y+h/2}" rx="${rx}" ry="${h/2}" fill="${_lt(clr,.3)}" stroke="${_dk(clr,.5)}" stroke-width=".7"/><ellipse cx="${x0}" cy="${y+h/2}" rx="${rx*.55}" ry="${h/2*.6}" fill="${_dk(clr,.45)}"/>`;
  return s;
}
// Изометрический куб
function _cube(clr,cx,cy,r){
  cx=cx||10;cy=cy||10.5;r=r||6.2;const h=r*.55;
  const T=`M${cx} ${cy-r}L${cx+r} ${cy-r+h}L${cx} ${cy-r+2*h}L${cx-r} ${cy-r+h}Z`;
  const L=`M${cx-r} ${cy-r+h}L${cx} ${cy-r+2*h}L${cx} ${cy+r}L${cx-r} ${cy+r-h}Z`;
  const R=`M${cx+r} ${cy-r+h}L${cx} ${cy-r+2*h}L${cx} ${cy+r}L${cx+r} ${cy+r-h}Z`;
  const st=`stroke="${_dk(clr,.5)}" stroke-width=".6" stroke-linejoin="round"`;
  return `<path d="${L}" fill="${clr}" ${st}/><path d="${R}" fill="${_dk(clr,.68)}" ${st}/><path d="${T}" fill="${_lt(clr,.42)}" ${st}/><path d="${T}" fill="url(#i3-t)" opacity=".7"/>`;
}
// Шарик (сфера)
const _ball=(cx,cy,r,clr)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${clr}" stroke="${_dk(clr,.5)}" stroke-width=".6"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#i3-s)"/>`;
// Шестерня
function _gear(clr){
  const n=8,ro=7.4,ri=5.6,cx=10,cy=9.6;let d='';
  for(let i=0;i<n*2;i++){const a0=(i/(n*2))*Math.PI*2-.12,a1=((i+1)/(n*2))*Math.PI*2+.12;const r=i%2?ri:ro;
    d+=(i?'L':'M')+(cx+r*Math.cos(a0)).toFixed(2)+' '+(cy+r*Math.sin(a0)).toFixed(2)+'L'+(cx+r*Math.cos(a1)).toFixed(2)+' '+(cy+r*Math.sin(a1)).toFixed(2);}
  d+='Z';
  return `<path d="${d}" fill="${clr}" stroke="${_dk(clr,.5)}" stroke-width=".7" stroke-linejoin="round"/><path d="${d}" fill="url(#i3-s)"/>`+
    `<circle cx="${cx}" cy="${cy}" r="2.3" fill="${_dk(clr,.45)}"/><circle cx="${cx}" cy="${cy}" r="2.3" fill="url(#i3-v)" transform="rotate(180 ${cx} ${cy})"/>`;
}

const C3={blue:'#2f6fd6',navy:'#26408f',teal:'#169aa6',amber:'#e3a21a',orange:'#ec7a1c',green:'#2fa043',cyan:'#25b4d8',purple:'#8a46d0',red:'#d6303a',grey:'#8e96a3',sky:'#4fb3e8',gold:'#e0b52a',salmon:'#ea8a5a',lime:'#7cbf2e',metal:'#b4bcc8'};

const ICON95={
  // фигурка-«пешка»: шар-голова + колокол-тело
  actor:_i3(_sh('path',{d:'M4.5 17.2c0-4.3 2.4-6.6 5.5-6.6s5.5 2.3 5.5 6.6z'},C3.blue)+_ball(10,6.4,3.4,C3.blue)),
  // монитор
  web_client:_i3(_sh('rect',{x:2.2,y:2.8,width:15.6,height:11,rx:1.4},'#4a515c')+
    `<rect x="3.8" y="4.3" width="12.4" height="8" rx=".6" fill="${C3.teal}"/><rect x="3.8" y="4.3" width="12.4" height="8" rx=".6" fill="url(#i3-v)"/><path d="M4.4 4.9h6.5l-3.8 6.8H4.4z" fill="#fff" opacity=".28"/>`+
    _sh('path',{d:'M8.2 13.8h3.6l.8 2.6H7.4z'},C3.metal)+_sh('rect',{x:5.4,y:16.2,width:9.2,height:1.4,rx:.7},C3.metal),6),
  // смартфон
  mob_client:_i3(_sh('rect',{x:5.6,y:1.8,width:8.8,height:15.6,rx:2},'#3c434e')+
    `<rect x="6.8" y="3.6" width="6.4" height="11" rx=".5" fill="${C3.blue}"/><rect x="6.8" y="3.6" width="6.4" height="11" rx=".5" fill="url(#i3-v)"/><path d="M7.2 4h3.4l-3.4 6z" fill="#fff" opacity=".3"/><circle cx="10" cy="16" r=".6" fill="#9aa2ad"/>`,4.5),
  // ворота-арка
  api_gw:_i3(_sh('rect',{x:3,y:6,width:3.6,height:11.2,rx:.6},C3.amber,'i3-h')+_sh('rect',{x:13.4,y:6,width:3.6,height:11.2,rx:.6},C3.amber,'i3-h')+
    _sh('path',{d:'M1.8 6.6L10 2.2l8.2 4.4z'},_dk(C3.amber,.82))+_sh('rect',{x:2.2,y:6.2,width:15.6,height:2.2,rx:.5},C3.amber)+
    `<rect x="7.4" y="10.4" width="5.2" height="1.2" rx=".6" fill="${C3.navy}"/><path d="M11.2 9.2l2 1.8-2 1.8z" fill="${C3.navy}"/>`),
  // балансировщик: шар-хаб и три ветки к шарикам
  lb:_i3(`<path d="M7 10L14.5 4.5M7 10h7.6M7 10l7.5 5.5" stroke="#5d6572" stroke-width="1.6" stroke-linecap="round"/>`+
    _ball(6.4,10,3.8,C3.orange)+_ball(15.2,4.4,2.2,C3.green)+_ball(15.6,10,2.2,C3.green)+_ball(15.2,15.6,2.2,C3.green),6.5),
  // глобус
  cdn:_i3(_ball(10,9.6,7,C3.green)+`<g fill="none" stroke="${_dk(C3.green,.45)}" stroke-width=".6" opacity=".75"><ellipse cx="10" cy="9.6" rx="3" ry="7"/><path d="M3 9.6h14M4 6h12M4 13.2h12"/></g>`+`<circle cx="10" cy="9.6" r="7" fill="url(#i3-s)" opacity=".6"/>`,6),
  // молния
  websocket_gw:_i3(_sh('path',{d:'M11.6 1.6L4.4 11h4.4l-1.6 7.4 8.4-10.2h-4.6z','stroke-linejoin':'round'},C3.cyan)+`<path d="M10.6 3.2L6.2 9.6h2.2z" fill="#fff" opacity=".6"/>`,5.5),
  // шестерня
  service:_i3(_gear(C3.blue),6.5),
  // слоёный куб (два этажа)
  bff:_i3(_cube(C3.sky,10,12.4,5.6)+_cube(_lt(C3.sky,.15),10,7.6,4.2),6.5),
  // замок
  auth:_i3(`<path d="M6.6 9V6.6a3.4 3.4 0 0 1 6.8 0V9" fill="none" stroke="${_dk(C3.metal,.6)}" stroke-width="2.6" stroke-linecap="round"/><path d="M6.6 9V6.6a3.4 3.4 0 0 1 6.8 0V9" fill="none" stroke="${_lt(C3.metal,.3)}" stroke-width="1.2" stroke-linecap="round"/>`+
    _sh('rect',{x:4.2,y:8.6,width:11.6,height:9,rx:1.6},C3.purple)+`<rect x="5.2" y="9.4" width="9.6" height="1.6" rx=".8" fill="#fff" opacity=".55"/><circle cx="10" cy="12.6" r="1.3" fill="${_dk(C3.purple,.4)}"/><rect x="9.4" y="13" width="1.2" height="2.6" rx=".5" fill="${_dk(C3.purple,.4)}"/>`,6),
  postgresql:_i3(_cyl('#2f62b0',{bands:1})),
  mysql:_i3(_cyl('#14869c',{bands:1})),
  mongodb:_i3(_cyl('#3a9b3a',{mark:`<path d="M10 7.6c1.8 2 1.8 4.6 0 6.6-1.8-2-1.8-4.6 0-6.6z" fill="#fff" opacity=".8"/>`})),
  cassandra:_i3(_cyl('#1fa7cf',{mark:`<circle cx="11" cy="11" r="2.2" fill="none" stroke="#fff" stroke-width="1" opacity=".85"/><circle cx="11" cy="11" r=".8" fill="#fff" opacity=".85"/>`})),
  // столбчатая аналитика на цилиндре
  clickhouse:_i3(_cyl(C3.gold,{mark:`<g fill="#3a2e05" opacity=".75"><rect x="8.2" y="8.6" width="1.2" height="5.4"/><rect x="10.1" y="8.6" width="1.2" height="5.4"/><rect x="12" y="8.6" width="1.2" height="5.4"/><rect x="13.9" y="10.6" width="1" height="1.4"/></g>`})),
  // лупа
  elasticsearch:_i3(`<path d="M12 12l5 5" stroke="${_dk('#5d6572',.8)}" stroke-width="3.2" stroke-linecap="round"/><path d="M12 12l5 5" stroke="#9aa2ad" stroke-width="1.2" stroke-linecap="round"/>`+
    `<circle cx="8.4" cy="8.4" r="6" fill="${C3.gold}" stroke="${_dk(C3.gold,.5)}" stroke-width=".7"/><circle cx="8.4" cy="8.4" r="6" fill="url(#i3-s)"/><circle cx="8.4" cy="8.4" r="3.9" fill="#d9f2ff" stroke="${_dk(C3.gold,.55)}" stroke-width=".6"/><circle cx="8.4" cy="8.4" r="3.9" fill="url(#i3-v)"/>`+_spec(7.2,7,1.3,.8,.9),6),
  // ведро
  s3:_i3(`<path d="M4 6.2L5.6 16.8a4.4 1.6 0 0 0 8.8 0L16 6.2z" fill="${C3.salmon}" stroke="${_dk(C3.salmon,.5)}" stroke-width=".7"/><path d="M4 6.2L5.6 16.8a4.4 1.6 0 0 0 8.8 0L16 6.2z" fill="url(#i3-h)"/>`+
    `<ellipse cx="10" cy="6.2" rx="6" ry="2.1" fill="${_dk(C3.salmon,.55)}" stroke="${_dk(C3.salmon,.45)}" stroke-width=".7"/><ellipse cx="10" cy="6.8" rx="4.8" ry="1.3" fill="${_dk(C3.salmon,.4)}"/><path d="M4 6.2a6 2.1 0 0 0 12 0" fill="none" stroke="${_lt(C3.salmon,.5)}" stroke-width=".8"/>`),
  // кэш: красный цилиндр с молнией
  redis:_i3(_cyl(C3.red,{mark:`<path d="M11.6 7.6l-3 3.8h2l-1 3.2 3.2-4.2h-2.1z" fill="#fff" opacity=".9"/>`})),
  // брокеры = трубы
  kafka:_i3(_pipe(C3.purple,[7,12]),7.5),
  rabbitmq:_i3(_pipe(C3.orange,[9.5]),7.5),
  nats:_i3(_pipe(C3.teal,[]),7.5),
  // очередь: стопка «таблеток»-сообщений
  queue:_i3(_sh('rect',{x:2.4,y:12.4,width:12.4,height:4,rx:2},'#3fb6cc')+_sh('rect',{x:3.8,y:7.8,width:12.4,height:4,rx:2},'#3fb6cc')+_sh('rect',{x:5.2,y:3.2,width:12.4,height:4,rx:2},'#3fb6cc')+
    `<path d="M1 14.4h-0" /><path d="M16.6 14.4h2.4M18 13l1.2 1.4-1.2 1.4" stroke="#26408f" stroke-width="1" fill="none" stroke-linecap="round"/>`,7),
  // внешняя система: облако
  external:_i3(_sh('path',{d:'M5.6 15.6a3.6 3.6 0 0 1-.4-7.2 4.8 4.8 0 0 1 9.2-1.2 3.6 3.6 0 0 1 .4 8.4z'},C3.grey)+`<path d="M6 8.6a4.4 4.4 0 0 1 8-1.8" fill="none" stroke="#fff" stroke-width="1.1" opacity=".7" stroke-linecap="round"/>`+
    `<path d="M9 13.4l4-4M10.4 9.2h2.8V12" stroke="${C3.navy}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,6.5),
};
// Иконки категорий палитры
const ICON95_CAT={
  cat_who:ICON95.actor,
  cat_clients:ICON95.web_client,
  cat_gateways:ICON95.api_gw,
  cat_realtime:ICON95.websocket_gw,
  cat_services:ICON95.service,
  cat_storage:ICON95.postgresql,
  cat_brokers:ICON95.kafka,
  cat_external:ICON95.external,
};
function icon95(type){return ICON95[type]||_i3(_cube(C3.grey));}
function icon95cat(key){return ICON95_CAT[key]||'';}
