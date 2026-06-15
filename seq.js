// SEQUENCE-РЕДАКТОР — текст → UML-диаграмма (бизнес-язык + техдетали под //)
// Синтаксис:
//   actor Студент                       → человечек
//   participant "API Gateway" as GW     → прямоугольник
//   Студент -> Web: Открывает профиль   (бизнес-смысл над стрелкой)
//   Web -> GW: // GET /api/v1/profile   (техдеталь под стрелкой)
//   GW --> Web: 200 OK                  (пунктир — ответ)
//   Сервис -) Kafka: publish(event)     (async — открытый наконечник)
//   alt / opt / loop / else / end

const SEQ_EXAMPLES = {
  payment: `actor Студент
participant Web
participant "API Gateway" as GW
participant "Сервис оплаты" as Payment
participant "Платёжный шлюз" as EXT
participant "Сервис пользователей" as User

Студент -> Web: Оплачивает курс
Web -> GW: // POST /api/v1/courses/{id}/payments
GW -> Payment: Проверяет и маршрутизирует
Payment -> User: Запрашивает данные пользователя
alt Пользователь не найден
  User --> Payment: Отвечает «не найден»
  Payment --> GW: 404 Not Found
  GW --> Web: 404 Not Found
  Web --> Студент: Показывает сообщение об ошибке
else Пользователь найден
  User --> Payment: Отдаёт профиль
  Payment -> EXT: Инициирует оплату
  alt Оплата прошла успешно
    EXT --> Payment: Подтверждает оплату
    Payment --> GW: 201 Created
    GW --> Web: 201 Created
    Web --> Студент: Показывает «Курс оплачен»
  else Ошибка оплаты
    EXT --> Payment: Сообщает об ошибке
    Payment --> Web: 402 Payment Required
    Web --> Студент: Показывает ошибку оплаты
  end
end`,

  progress: `actor Ментор
participant Web
participant "API Gateway" as GW
participant "Сервис аналитики" as Analysis
participant PostgreSQL

Ментор -> Web: Открывает прогресс студента
Web -> GW: // GET /api/v1/students/{id}/analysis
GW -> Analysis: Проверяет токен и маршрутизирует
Analysis -> PostgreSQL: Запрашивает данные студента
alt Студента нет в базе
  PostgreSQL --> Analysis: Отдаёт «не найден»
  Analysis --> GW: 404 Not Found
  GW --> Web: 404 Not Found
  Web --> Ментор: Показывает сообщение об ошибке
else Студент найден
  PostgreSQL --> Analysis: Отдаёт профиль и историю
  Analysis --> GW: 200 OK (аналитика)
  GW --> Web: 200 OK
  Web --> Ментор: Показывает прогресс
end`,

  kafka: `actor Пользователь
participant "Mobile App" as App
participant "API Gateway" as GW
participant "Сервис заказов" as Orders
participant Kafka
participant "Сервис уведомлений" as Notify

Пользователь -> App: Оформляет заказ
App -> GW: // POST /api/v1/orders
GW -> Orders: Проверяет и маршрутизирует
Orders -> Orders: Сохраняет заказ в БД
Orders -) Kafka: // publish: order.created
note over Kafka: Kafka хранит событие в топике
Orders --> GW: 201 Created (заказ принят)
GW --> App: 201 Created
App --> Пользователь: Показывает «Заказ оформлен»

== Асинхронная обработка ==
Kafka -) Notify: // consume: order.created
Notify -> Пользователь: Отправляет email-подтверждение`,

  blank: `actor Пользователь
participant Сервис

Пользователь -> Сервис: Открывает раздел
Сервис --> Пользователь: Показывает данные`,
};

function parseSeq(text){
  const lanes=[];
  function laneIdx(n){
    n=String(n).trim().replace(/^"(.*)"$/,'$1');
    let i=lanes.findIndex(l=>l.alias===n||l.name===n);
    if(i<0){lanes.push({name:n,alias:n,actor:false,kind:'participant'});i=lanes.length-1;}
    return i;
  }
  const events=[];
  // Разбить строку на текст (бизнес) и примечание (техдеталь после //)
  const splitNote=s=>{
    const i=s.indexOf('//');
    return i<0?[s.trim(),'']:[s.slice(0,i).trim(),s.slice(i+2).trim()];
  };
  // Срезать суффикс активации ++ / -- с имени участника (PlantUML-стиль: A -> B++)
  const stripAct=s=>{const mm=String(s).trim().match(/^(.*?)\s*(\+\+|--)$/);return mm?[mm[1].trim(),mm[2]]:[String(s).trim(),null];};
  text.split(/\r?\n/).forEach((raw,lineNum)=>{
    const line=raw.trim();if(!line||line.startsWith('#'))return;
    if(line.startsWith('//')) return;
    let m;
    if(m=line.match(/^(actor|participant|database|queue|boundary|control|entity|collections)\s+(?:"([^"]+)"|(\S+))(?:\s+as\s+(\S+))?(?:\s+order\s+(\d+))?(?:\s+(#\S+))?$/i)){
      const kind=m[1].toLowerCase();const disp=m[2]||m[3];const alias=m[4]||disp;const isActor=kind==='actor';const order=m[5]!=null?+m[5]:null;const color=seqColor(m[6]);
      let i=lanes.findIndex(l=>l.alias===alias||l.name===disp);
      if(i<0)lanes.push({name:disp,alias:alias,actor:isActor,kind,color,order,lineNum});
      else{lanes[i].actor=lanes[i].actor||isActor;lanes[i].alias=alias;lanes[i].kind=kind;if(color)lanes[i].color=color;if(order!=null)lanes[i].order=order;lanes[i].lineNum=lineNum;}
      return;
    }
    if(m=line.match(/^==\s*(.+?)\s*==$/)){events.push({type:'divider',label:m[1],lineNum});return;}
    if(line==='|||'||line==='||'){events.push({type:'spacer',lineNum});return;}
    if(m=line.match(/^autonumber(?:\s+(\d+))?(?:\s+(\d+))?$/i)){events.push({type:'autonumber',start:m[1]?+m[1]:1,step:m[2]?+m[2]:1,lineNum});return;}
    if(m=line.match(/^\.\.\.(.*?)\.\.\.$/)){events.push({type:'delay',label:m[1].trim(),lineNum});return;}
    if(/^group\b/i.test(line)){events.push({type:'frag',kind:'group',label:line.replace(/^group\s*/i,''),lineNum});return;}
    if(m=line.match(/^activate\s+(?:"([^"]+)"|(\S+))(?:\s+(#\S+))?$/i)){events.push({type:'activate',lane:laneIdx(m[1]||m[2]),color:seqColor(m[3]),lineNum});return;}
    if(m=line.match(/^deactivate\s+(?:"([^"]+)"|(\S+))$/i)){events.push({type:'deactivate',lane:laneIdx(m[1]||m[2]),lineNum});return;}
    if(/^alt\b/i.test(line)){events.push({type:'frag',kind:'alt',label:line.replace(/^alt\s*/i,''),lineNum});return;}
    if(/^opt\b/i.test(line)){events.push({type:'frag',kind:'opt',label:line.replace(/^opt\s*/i,''),lineNum});return;}
    if(/^loop\b/i.test(line)){events.push({type:'frag',kind:'loop',label:line.replace(/^loop\s*/i,''),lineNum});return;}
    if(/^par\b/i.test(line)){events.push({type:'frag',kind:'par',label:line.replace(/^par\s*/i,''),lineNum});return;}
    if(/^else\b/i.test(line)){events.push({type:'else',label:line.replace(/^else\s*/i,''),lineNum});return;}
    if(/^end\b/i.test(line)){events.push({type:'end',lineNum});return;}
    if(m=line.match(/^note\s+(?:over|left of|right of)\s+(.+?)\s*:\s*(.*)$/i)){events.push({type:'note',target:laneIdx(m[1].trim()),text:m[2],lineNum});return;}
    if(m=line.match(/^(.+?)\s*(-->>|--\)|-->|->>|-\)|->)\s*([^:]+?)\s*:\s*(.*)$/)){
      const [bizText,techNote]=splitNote(m[4]);
      const arrow=m[2];
      const [fromN,actFrom]=stripAct(m[1]);const [toN,actTo]=stripAct(m[3]);
      events.push({type:'msg',from:laneIdx(fromN),to:laneIdx(toN),actFrom,actTo,
        text:bizText,note:techNote,dashed:arrow.includes('--'),async:arrow.includes('>>')||arrow.includes(')'),lineNum});return;
    }
    if(m=line.match(/^(.+?)\s*(-->>|--\)|-->|->>|-\)|->)\s*(.+?)\s*$/)){
      const [fromN,actFrom]=stripAct(m[1]);const [toN,actTo]=stripAct(m[3]);
      events.push({type:'msg',from:laneIdx(fromN),to:laneIdx(toN),actFrom,actTo,text:'',note:'',
        dashed:m[2].includes('--'),async:m[2].includes('>>')||m[2].includes(')'),lineNum});return;
    }
  });
  return {lanes,events};
}

function seqEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const SEQ_COLORS={red:'#e06c75',orange:'#e0935a',grey:'#9aa0aa',gray:'#9aa0aa',white:'#dbe7f3',lightgreen:'#9ece6a',green:'#73b06f',pink:'#d98ab0',yellow:'#d9c264',skyblue:'#6fb3d9',blue:'#7aa2f7',lightblue:'#7fb0d9',purple:'#a98ad0',brown:'#a9785f'};
function seqColor(c){if(!c)return null;c=String(c).replace(/^#/,'').toLowerCase();if(SEQ_COLORS[c])return SEQ_COLORS[c];return /^[0-9a-f]{3,6}$/.test(c)?'#'+c:null;}
function seqKwFor(cat){return cat==='actor'?'actor':(cat==='db'||cat==='cache')?'database':(cat==='broker'||cat==='queue')?'queue':cat==='external'?'boundary':'participant';}

// Цвета фреймов по типу
const FRAG_COLORS={alt:'#fff7e0',opt:'#e6f3e6',loop:'#e0e7ff',par:'#f0e6ff',group:'#eef1f6'};
const FRAG_STROKE={alt:'#d9c264',opt:'#6aaa7b',loop:'#7aa2f7',par:'#bb9af7',group:'#8a93a8'};

function renderSeqSVG(model){
  let {lanes,events}=model;
  // order N у участников (PlantUML): пересортировать лайны + переметить индексы в событиях
  if(lanes.some(l=>l.order!=null)){
    const idx=lanes.map((l,i)=>({l,i}));
    idx.sort((a,b)=>{const ka=a.l.order!=null?a.l.order:1000+a.i,kb=b.l.order!=null?b.l.order:1000+b.i;return ka-kb||a.i-b.i;});
    const map={};idx.forEach((x,ni)=>map[x.i]=ni);
    lanes=idx.map(x=>x.l);
    events=events.map(e=>{const c={...e};
      if(typeof c.from==='number')c.from=map[c.from];
      if(typeof c.to==='number')c.to=map[c.to];
      if(typeof c.lane==='number')c.lane=map[c.lane];
      if(typeof c.target==='number')c.target=map[c.target];
      return c;});
  }
  if(!lanes.length)return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><text x="20" y="40" font-family="Arial" font-size="13" fill="#888">Опиши участников и сообщения слева…</text></svg>';
  const G=Math.max(140,Math.min(220,200)),left=80,top=70,msgGap=46;
  const laneW=lanes.map(l=>Math.max(70,l.name.length*7.5+24));
  const cx=[];
  lanes.forEach((l,i)=>{
    if(i===0)cx[i]=left;
    else cx[i]=cx[i-1]+Math.max(G,laneW[i-1]/2+laneW[i]/2+40);
  });
  const width=cx[cx.length-1]+laneW[laneW.length-1]/2+60;
  let body='',y=top+30;
  const fragStack=[];
  const act=lanes.map(()=>[]);let actSvg='';
  const lastY=lanes.map(()=>null); // последняя активность лайна — чтобы висячие бары не тянулись до низа
  const hasExplicit=events.some(e=>e.type==='activate'||e.type==='deactivate'||(e.type==='msg'&&(e.actFrom||e.actTo)));
  let AN=null; // autonumber: {n, step}
  function actBar(li,y1,y2,a){const x=cx[li]+(a.off||0)*4,w=8,fill=a.color||'#cdd6e6';return `<rect x="${(x-w/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${w}" height="${Math.max(6,y2-y1).toFixed(1)}" fill="${fill}" stroke="#8a93a8" stroke-width="0.8" rx="1.5"/>`;}

  events.forEach(e=>{
    if(e.type==='spacer'){y+=40;return;}
    if(e.type==='autonumber'){AN={n:e.start||1,step:e.step||1};return;}
    if(e.type==='delay'){
      const x1=left-laneW[0]/2-10,x2=width-30,mx=(x1+x2)/2;
      body+=`<line x1="${x1}" y1="${y-2}" x2="${x2}" y2="${y-2}" stroke="#aeb6c4" stroke-width="1" stroke-dasharray="2 5"/>`;
      body+=`<line x1="${x1}" y1="${y+10}" x2="${x2}" y2="${y+10}" stroke="#aeb6c4" stroke-width="1" stroke-dasharray="2 5"/>`;
      if(e.label){const tw=e.label.length*6.2+14;
        body+=`<rect x="${(mx-tw/2).toFixed(1)}" y="${y-4}" width="${tw.toFixed(1)}" height="13" fill="#ffffff"/>`;
        body+=`<text x="${mx}" y="${y+6}" text-anchor="middle" font-family="Arial" font-size="10" font-style="italic" fill="#778">${seqEsc(e.label)}</text>`;}
      y+=msgGap-8;return;
    }
    if(e.type==='divider'){
      y+=8;
      const x1=left-laneW[0]/2-10,x2=width-30,mx=(x1+x2)/2,tw=e.label.length*6.6+24;
      body+=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#aeb6c4" stroke-width="1"/>`;
      body+=`<rect x="${(mx-tw/2).toFixed(1)}" y="${y-9}" width="${tw.toFixed(1)}" height="18" rx="3" fill="#e7ecf3" stroke="#aeb6c4"/>`;
      body+=`<text x="${mx}" y="${y+3}" text-anchor="middle" font-family="Arial" font-size="10.5" font-weight="bold" fill="#3a4252">${seqEsc(e.label)}</text>`;
      y+=msgGap-4;return;
    }
    if(e.type==='activate'){const off=act[e.lane].length;act[e.lane].push({y:y-msgGap+12,color:e.color||lanes[e.lane].color,off});lastY[e.lane]=y;return;}
    if(e.type==='deactivate'){const a=act[e.lane].pop();if(a)actSvg+=actBar(e.lane,a.y,y-msgGap+12,a);lastY[e.lane]=y;return;}
    if(e.type==='frag'){
      y+=10;
      fragStack.push({startY:y-18,kind:e.kind,label:e.label,elses:[]});
      y+=14;return;
    }
    if(e.type==='else'){const f=fragStack[fragStack.length-1];if(f)f.elses.push({y:y,label:e.label});y+=16;return;}
    if(e.type==='end'){
      const f=fragStack.pop();if(f){
        const x1=left-laneW[0]/2-16,x2=width-44,endY=y+6;
        const bgClr=FRAG_COLORS[f.kind]||'#f5f5f5';
        const stClr=FRAG_STROKE[f.kind]||'#9aa';
        let frag=`<rect x="${x1}" y="${f.startY}" width="${x2-x1}" height="${endY-f.startY}" fill="${bgClr}" stroke="${stClr}" stroke-width="1.2" rx="4"/>`;
        // Шапка фрейма
        frag+=`<path d="M${x1} ${f.startY} h50 v16 l-8 8 h-42 z" fill="${stClr}33" stroke="${stClr}" stroke-width="1.2"/>`;
        frag+=`<text x="${x1+6}" y="${f.startY+15}" font-family="Arial" font-size="11" font-weight="bold" fill="${stClr.replace('33','')}">${f.kind}</text>`;
        if(f.label)frag+=`<text x="${x1+58}" y="${f.startY+14}" font-family="Arial" font-size="10.5" fill="#345">[${seqEsc(f.label)}]</text>`;
        f.elses.forEach(el=>{
          frag+=`<line x1="${x1}" y1="${el.y}" x2="${x2}" y2="${el.y}" stroke="${stClr}" stroke-width="1" stroke-dasharray="5 3"/>`;
          frag+=`<text x="${x1+8}" y="${el.y-4}" font-family="Arial" font-size="10" fill="#345">[${seqEsc(el.label)}]</text>`;
        });
        body=frag+body;
        y+=10;
      }return;
    }
    if(e.type==='note'){
      const x=cx[e.target];const w=Math.max(60,e.text.length*6.5+16);
      body+=`<rect x="${x-w/2}" y="${y-12}" width="${w}" height="22" fill="#fff7d6" stroke="#d9c97a" rx="2"/>`;
      body+=`<text x="${x}" y="${y+2}" text-anchor="middle" font-family="Arial" font-size="10.5" fill="#665">${seqEsc(e.text)}</text>`;
      y+=msgGap;return;
    }
    if(e.type==='msg'){
      const x1=cx[e.from],x2=cx[e.to];
      // autonumber: префикс «N.» к бизнес-тексту (PlantUML-стиль)
      const numPfx=AN?(AN.n+'. '):'';if(AN)AN.n+=AN.step;
      const dispText=numPfx+(e.text||'');
      // Ручные активации ++ (PlantUML: A -> B++)
      if(e.actTo==='++'){const off=act[e.to].length;act[e.to].push({y,color:lanes[e.to].color,off});}
      if(e.actFrom==='++'){const off=act[e.from].length;act[e.from].push({y,color:lanes[e.from].color,off});}
      if(e.from===e.to){
        body+=`<path d="M${x1} ${y} h36 v22 h-30" fill="none" stroke="#445" stroke-width="1.3" ${e.dashed?'stroke-dasharray="6 4"':''} marker-end="url(#sqHead)"/>`;
        if(dispText.trim())body+=`<text x="${x1+44}" y="${y+4}" font-family="Arial" font-size="11" fill="#223">${seqEsc(dispText)}</text>`;
        if(e.actTo==='--'||e.actFrom==='--'){const a=act[e.from].pop();if(a)actSvg+=actBar(e.from,a.y,y+22,a);}
        lastY[e.from]=y+22;
        y+=msgGap+8;return;
      }
      // Kafka async (-)) — открытый наконечник
      const markerEnd=e.async?'url(#sqHeadO)':'url(#sqHead)';
      body+=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#445" stroke-width="1.3" ${e.dashed?'stroke-dasharray="6 4"':''} marker-end="${markerEnd}"/>`;
      // БИЗНЕС-СМЫСЛ: над стрелкой (крупно) — кликабельный для редактирования
      if(dispText.trim()){
        const mx=(x1+x2)/2;
        const dl=e.lineNum!=null?` data-line="${e.lineNum}"` : '';
        body+=`<text x="${mx}" y="${y-7}"${dl} text-anchor="middle" font-family="Arial" font-size="11.5" font-weight="600" fill="#1e2030" style="cursor:pointer">${seqEsc(dispText)}</text>`;
      }
      // ТЕХДЕТАЛЬ: под стрелкой (мелко, моноширинный, серый) — тоже кликабельная
      if(e.note){
        const mx=(x1+x2)/2;
        const dl=e.lineNum!=null?` data-line="${e.lineNum}"` : '';
        body+=`<text x="${mx}" y="${y+13}"${dl} text-anchor="middle" font-family="monospace" font-size="9" fill="#8f8fa8" style="cursor:pointer">// ${seqEsc(e.note)}</text>`;
      }
      // Невидимая широкая полоска — зона клика для стрелки без текста
      if(!e.text&&!e.note&&e.lineNum!=null){
        const dl=` data-line="${e.lineNum}"`;
        body+=`<rect x="${Math.min(x1,x2)}" y="${y-8}" width="${Math.abs(x2-x1)}" height="16"${dl} fill="transparent" style="cursor:pointer"/>`;
      }
      // Ручные деактивации --
      if(e.actTo==='--'){const a=act[e.to].pop();if(a)actSvg+=actBar(e.to,a.y,y,a);}
      if(e.actFrom==='--'){const a=act[e.from].pop();if(a)actSvg+=actBar(e.from,a.y,y,a);}
      if(!hasExplicit){
        if(!e.dashed&&!e.async){const off=act[e.to].length;act[e.to].push({y,color:lanes[e.to].color,off});}
        else if(e.dashed){const a=act[e.from].pop();if(a)actSvg+=actBar(e.from,a.y,y,a);}
      }
      lastY[e.from]=y;lastY[e.to]=y;
      y+=msgGap+(e.note?6:0);return;
    }
  });
  const bottomY=y+10;
  // Висячие бары закрываем на ПОСЛЕДНЕЙ активности лайна (а не в самом низу —
  // иначе плашки прошивают alt-рамки и пустоту под диаграммой)
  act.forEach((stack,li)=>{while(stack.length){const a=stack.pop();const yEnd=lastY[li]!=null?Math.min(lastY[li]+10,bottomY-10):bottomY-10;actSvg+=actBar(li,a.y,Math.max(a.y+6,yEnd),a);}});
  body=actSvg+body;

  let heads='';
  lanes.forEach((l,i)=>{
    const x=cx[i],w=laneW[i];
    const kind=l.kind||(l.actor?'actor':'participant');
    const hc=l.color,sk=hc||'#456';
    // Лайфлайн: для external/boundary — серее и реже пунктир
    if(kind==='boundary'){
      heads+=`<line x1="${x}" y1="${top+14}" x2="${x}" y2="${bottomY}" stroke="#c8c8c0" stroke-width="0.8" stroke-dasharray="3 7"/>`;
    }else{
      heads+=`<line x1="${x}" y1="${top+14}" x2="${x}" y2="${bottomY}" stroke="#bcc4d0" stroke-width="1" stroke-dasharray="4 4"/>`;
    }

    const _dl=l.lineNum!=null?` data-line="${l.lineNum}"`:'';
    if(kind==='actor'){
      // Человечек — stick figure (АКТОР = живой человек)
      const ax=x,ay=8;
      heads+=`<circle cx="${ax}" cy="${ay+8}" r="8" fill="none" stroke="${sk}" stroke-width="1.8"/>`;
      heads+=`<line x1="${ax}" y1="${ay+16}" x2="${ax}" y2="${ay+34}" stroke="${sk}" stroke-width="1.8"/>`;
      heads+=`<line x1="${ax-10}" y1="${ay+22}" x2="${ax+10}" y2="${ay+22}" stroke="${sk}" stroke-width="1.8"/>`;
      heads+=`<line x1="${ax}" y1="${ay+34}" x2="${ax-9}" y2="${ay+48}" stroke="${sk}" stroke-width="1.8"/>`;
      heads+=`<line x1="${ax}" y1="${ay+34}" x2="${ax+9}" y2="${ay+48}" stroke="${sk}" stroke-width="1.8"/>`;
      heads+=`<text x="${x}" y="${top+8}"${_dl} text-anchor="middle" font-family="Arial" font-size="11.5" font-weight="bold" fill="#234" style="cursor:pointer">${seqEsc(l.name)}</text>`;
    }else if(kind==='database'){
      // Бочка — БД
      const lx=x-w/2,ty=top-26,ch=36,ry=6;
      heads+=`<rect x="${lx}" y="${ty+ry}" width="${w}" height="${ch-2*ry}" fill="#dbe7f3" stroke="none"/>`;
      heads+=`<ellipse cx="${x}" cy="${ty+ch-ry}" rx="${w/2}" ry="${ry}" fill="#dbe7f3" stroke="#7fa8cc" stroke-width="1.2"/>`;
      heads+=`<line x1="${lx}" y1="${ty+ry}" x2="${lx}" y2="${ty+ch-ry}" stroke="#7fa8cc" stroke-width="1.2"/>`;
      heads+=`<line x1="${lx+w}" y1="${ty+ry}" x2="${lx+w}" y2="${ty+ch-ry}" stroke="#7fa8cc" stroke-width="1.2"/>`;
      heads+=`<ellipse cx="${x}" cy="${ty+ry}" rx="${w/2}" ry="${ry}" fill="#eaf2fa" stroke="#7fa8cc" stroke-width="1.2"/>`;
      heads+=`<text x="${x}" y="${top-2}"${_dl} text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#234" style="cursor:pointer">${seqEsc(l.name)}</text>`;
    }else if(kind==='queue'){
      // Лежачий цилиндр — брокер
      const lx=x-w/2,ty=top-22,ch=30,rx=6,ccy=ty+ch/2;
      heads+=`<rect x="${lx+rx}" y="${ty}" width="${w-2*rx}" height="${ch}" fill="#e6dff5" stroke="none"/>`;
      heads+=`<ellipse cx="${lx+rx}" cy="${ccy}" rx="${rx}" ry="${ch/2}" fill="#efeafb" stroke="#9a86c8" stroke-width="1.2"/>`;
      heads+=`<line x1="${lx+rx}" y1="${ty}" x2="${lx+w-rx}" y2="${ty}" stroke="#9a86c8" stroke-width="1.2"/>`;
      heads+=`<line x1="${lx+rx}" y1="${ty+ch}" x2="${lx+w-rx}" y2="${ty+ch}" stroke="#9a86c8" stroke-width="1.2"/>`;
      heads+=`<ellipse cx="${lx+w-rx}" cy="${ccy}" rx="${rx}" ry="${ch/2}" fill="#e6dff5" stroke="#9a86c8" stroke-width="1.2"/>`;
      heads+=`<text x="${x}" y="${top-2}"${_dl} text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#234" style="cursor:pointer">${seqEsc(l.name)}</text>`;
    }else if(kind==='boundary'){
      heads+=`<rect x="${x-w/2}" y="${top-28}" width="${w}" height="36" rx="3" fill="#f7f6f0" stroke="#aaa" stroke-width="1" stroke-dasharray="5 3"/>`;
      heads+=`<text x="${x}" y="${top-18}" text-anchor="middle" font-family="Arial" font-size="8" fill="#888" font-style="italic">&lt;&lt;external&gt;&gt;</text>`;
      heads+=`<text x="${x}" y="${top-5}"${_dl} text-anchor="middle" font-family="Arial" font-size="10.5" font-weight="bold" fill="#555" style="cursor:pointer">${seqEsc(l.name)}</text>`;
    }else{
      // Роль — прямоугольник
      heads+=`<rect x="${x-w/2}" y="${top-22}" width="${w}" height="32" rx="4" fill="${hc?hc+'33':'#dbe7f3'}" stroke="${hc||'#7fa8cc'}" stroke-width="1.2"/>`;
      heads+=`<text x="${x}" y="${top-4}"${_dl} text-anchor="middle" font-family="Arial" font-size="11.5" font-weight="bold" fill="#234" style="cursor:pointer">${seqEsc(l.name)}</text>`;
    }
  });
  const defs=`<defs>
    <marker id="sqHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#445"/></marker>
    <marker id="sqHeadO" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 0L10 5L0 10" fill="none" stroke="#445" stroke-width="1.4"/></marker>
  </defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(bottomY+20)}" font-family="Arial">${defs}<rect width="100%" height="100%" fill="#ffffff"/>${heads}${body}</svg>`;
}

// ── Бизнес-язык: глаголы для сообщений ──────────────────────
// Правила: человеческие глаголы над стрелкой, техдетали под //
function bizVerb(fc, tc, isResp, ctx){
  if(isResp){
    if(tc==='actor'||tc==='client') return 'Показывает результат';
    if(fc==='db'||fc==='cache') return 'Отдаёт данные';
    if(fc==='broker') return 'Доставляет событие';
    return 'Возвращает ответ';
  }
  // Запрос
  if(fc==='actor'||fc==='client'){
    if(tc==='gw') return 'Отправляет запрос';
    if(tc==='svc') return 'Обращается к сервису';
    return 'Открывает';
  }
  if(fc==='gw'&&tc==='svc'){
    const noAuth=(ctx?.gwAuthMode||'').startsWith('Нет');
    return noAuth?'Маршрутизирует запрос':'Проверяет токен и маршрутизирует';
  }
  if(fc==='svc'&&tc==='db') return 'Запрашивает данные';
  if(fc==='svc'&&tc==='cache') return 'Проверяет кэш';
  if(fc==='svc'&&tc==='broker') return 'Публикует событие';
  if(fc==='svc'&&tc==='queue') return 'Добавляет задачу в очередь';
  if(fc==='broker'&&tc==='svc') return 'Доставляет событие консьюмеру';
  if(fc==='queue'&&tc==='svc') return 'Доставляет задачу воркеру';
  if(fc==='svc'&&tc==='external') return 'Обращается во внешнюю систему';
  if(fc==='gw'&&tc==='external') return 'Перенаправляет во внешний сервис';
  if(fc==='external') return 'Отправляет вебхук';
  if(fc==='svc'&&tc==='svc') return 'Запрашивает данные у сервиса';
  if(fc==='net'&&tc==='svc') return 'Балансировщик выбирает реплику';
  if(fc==='gw'&&tc==='net') return 'Перенаправляет через балансировщик';
  return 'Отправляет запрос';
}

// ── Авто-генерация UML из схемы на холсте ────────────────────
// Дедупликация: путь A → A схлопывается
function dedupPath(events){
  const out=[];
  for(const ev of events){
    const last=out[out.length-1];
    if(last&&ev.kind===last.kind&&ev.from===last.from&&ev.to===last.to&&ev.from===ev.to) continue;
    out.push(ev);
  }
  return out;
}

function defaultMsg(from,to){
  const fc=EL[from.type]?.cat,tc=EL[to.type]?.cat;
  const ctx=(fc==='gw'&&tc==='svc')?{gwAuthMode:from.settings?.auth_mode}:null;
  return bizVerb(fc,tc,false,ctx);
}

function generateSeqFromCanvas(startId){
  if(typeof S==='undefined'||!S.blocks||!S.blocks.length)return '';
  let src=startId?gb(startId):null;
  if(!src){const hasInc=new Set(S.conns.map(c=>c.to));src=S.blocks.find(b=>!hasInc.has(b.id)&&S.conns.some(c=>c.from===b.id))||S.blocks.find(b=>!hasInc.has(b.id));}
  if(!src)return '';
  const rawEvents=(typeof walkCalls==='function')?walkCalls(src.id):[];
  const events=dedupPath(rawEvents);
  const nm=id=>{const b=gb(id);return b?(b.customLabel||EL[b.type]?.lbl||id):id;};
  const seenP=[];const add=id=>{if(!seenP.includes(id))seenP.push(id);};
  add(src.id);events.forEach(e=>{add(e.from);add(e.to);});
  const lines=[
    '# Черновик из схемы. Правь под смысл этого актора.',
    '# Бизнес-смысл — НАД стрелкой. Техдеталь — ПОСЛЕ // на той же строке.',
    '# Пример: Ментор -> Сервис: Открывает профиль // GET /api/v1/profile',
    '',
  ];
  seenP.forEach(id=>{const b=gb(id);if(!b)return;const kw=seqKwFor(EL[b.type]?.cat);const n=nm(id);lines.push(`${kw} ${/\s/.test(n)?'"'+n+'"':n}`);});
  lines.push('autonumber');
  lines.push('');
  events.forEach(e=>{
    if(e.kind==='asyncphase'){lines.push('');lines.push(`== Асинхронная обработка: ${nm(e.from)} ==`);return;}
    const f=gb(e.from),t=gb(e.to);if(!f||!t)return;
    const fc=EL[f.type]?.cat,tc=EL[t.type]?.cat;
    // Kafka: только одна стрелка publish, без ответа
    const isBroker=(tc==='broker'||tc==='queue');
    const isFromBroker=(fc==='broker'||fc==='queue');
    let arrow;
    if(e.kind==='return') arrow='-->';
    else if(isBroker) arrow='-)'  ; // async kafka-style
    else arrow='->';
    const _ctx=(fc==='gw'&&tc==='svc')?{gwAuthMode:f.settings?.auth_mode}:null;
    const biz = e.kind==='return'
      ? bizVerb(fc,tc,true)
      : (isBroker?'Публикует событие':bizVerb(fc,tc,false,_ctx));
    const api=(typeof connApi==='function')?connApi(e.conn):'';
    const resp=(typeof connResp==='function')?connResp(e.conn):'';
    const techDetail = e.kind==='return'
      ? (resp||e.conn?.respLabel||'200 OK')
      : (e.conn?.label||api||e.conn?.reqLabel||apiFor(f,t));
    const fn=nm(e.from),tn=nm(e.to);
    const fnQ=/\s/.test(fn)?'"'+fn+'"':fn;
    const tnQ=/\s/.test(tn)?'"'+tn+'"':tn;
    // Kafka не возвращает 200 — пропускаем return от брокера к сервису если брокер источник
    if(e.kind==='return'&&isFromBroker) return;
    lines.push(`${fnQ} ${arrow} ${tnQ}: ${biz}${techDetail?' // '+techDetail:''}`);
  });
  return lines.join('\n');
}

function populateSeqStart(){
  const sel=document.getElementById('seq-start');if(!sel||typeof S==='undefined')return;
  const hasInc=new Set(S.conns.map(c=>c.to));
  const srcs=S.blocks.filter(b=>!hasInc.has(b.id)&&S.conns.some(c=>c.from===b.id));
  sel.innerHTML=srcs.map(s=>`<option value="${s.id}">${s.customLabel||EL[s.type]?.lbl}</option>`).join('')||'<option value="">нет источников</option>';
}

function seqFromCanvas(startId){
  if(SEQ_SCEN){const s=(S.scenarios||[]).find(x=>x.id===SEQ_SCEN);if(s)s.umlEdited=false;const t=generateSeqFromScenario(SEQ_SCEN);document.getElementById('seq-input').value=t||'';renderSeq();return;}
  if(!startId){const sel=document.getElementById('seq-start');startId=sel&&sel.value;}
  const b=(typeof gb==='function')?gb(startId):null;
  const t=(b&&b.scenario&&b.scenario.trim())?b.scenario:generateSeqFromCanvas(startId);
  document.getElementById('seq-input').value=t||'';
  if(!SEQ_ACTOR)localStorage.removeItem('arch4_seq');
  renderSeq();
  if(!t)alert('Сначала построй схему на холсте (актор → … → БД) — UML соберётся из неё.');
}

// ── Банк типичных ошибок для alt-блоков (4xx / 5xx) ────────
const ALT_ERROR_BANK=[
  // 4xx — ошибки клиента
  {condition:'токен невалидный или истёк',      resp:'401 Unauthorized',          userMsg:'Показывает «Войдите заново»',              verbs:['GET','POST','PATCH','PUT','DELETE']},
  {condition:'нет прав доступа к ресурсу',      resp:'403 Forbidden',             userMsg:'Показывает «Доступ запрещён»',             verbs:['GET','PATCH','PUT','DELETE']},
  {condition:'запись не найдена',               resp:'404 Not Found',             userMsg:'Показывает «Не найдено»',                  verbs:['GET','PATCH','PUT','DELETE']},
  {condition:'запись уже существует (дубликат)',resp:'409 Conflict',              userMsg:'Показывает «Уже существует»',              verbs:['POST','PUT']},
  {condition:'конфликт при обновлении данных',  resp:'409 Conflict',              userMsg:'Показывает «Данные изменились, обнови»',   verbs:['PATCH','PUT']},
  {condition:'ошибка валидации полей',          resp:'422 Unprocessable Entity',  userMsg:'Показывает список ошибок форм',            verbs:['POST','PATCH','PUT']},
  {condition:'неверный формат запроса',         resp:'400 Bad Request',           userMsg:'Показывает «Неверный запрос»',             verbs:['POST','PATCH','PUT']},
  {condition:'превышен rate limit',             resp:'429 Too Many Requests',     userMsg:'Показывает «Слишком много запросов»',      verbs:['GET','POST','PATCH','PUT','DELETE']},
  // 5xx — ошибки сервера
  {condition:'ошибка БД / timeout запроса',     resp:'500 Internal Server Error', userMsg:'Показывает «Что-то пошло не так»',        verbs:['GET','POST','PATCH','PUT','DELETE']},
  {condition:'сервис временно недоступен',      resp:'503 Service Unavailable',   userMsg:'Показывает «Сервис недоступен, попробуй позже»', verbs:['GET','POST','PATCH','PUT','DELETE']},
];
// seed → детерминированный выбор (одна и та же ошибка для одного сценария:
// регенерация UML не должна менять документ)
function pickAltError(verb,seed){
  const pool=ALT_ERROR_BANK.filter(e=>e.verbs.includes(verb||'GET'));
  if(!pool.length)return ALT_ERROR_BANK[0];
  if(seed==null)return pool[Math.floor(Math.random()*pool.length)];
  const h=(typeof hashStr==='function')?Math.abs(hashStr(String(seed))):String(seed).length;
  return pool[h%pool.length];
}

// ╔═══════════════════════════════════════════════════════════════╗
// ║  SEQUENCE ENGINE v2 — UML 2.x стандарт                       ║
// ║  Правила:                                                     ║
// ║  • Return-стрелки опциональны (UML 2.x §17.4.3)              ║
// ║    Показываем только если resp задан или это ключевая граница  ║
// ║  • Async publish (->) — fire & forget, sync return сразу после ║
// ║  • Consumer chain показывается отдельно после == divider ==    ║
// ║  • External → boundary (пунктирный бокс, последний в списке)  ║
// ║  • DB returns опускаем если resp не задан                     ║
// ╚═══════════════════════════════════════════════════════════════╝
function generateSeqFromScenario(id){
  const s=(S.scenarios||[]).find(x=>x.id===id);
  if(!s||!s.path||s.path.length<2)return '';
  if(typeof ensureScenSteps==='function')ensureScenSteps(s);

  const nm=nodeId=>{const b=gb(nodeId);return b?(b.customLabel||EL[b.type]?.lbl||nodeId):nodeId;};
  const q=n=>/\s/.test(n)?'"'+n+'"':n;
  const path=s.path;
  const steps=s.steps||[];

  // ── Вспомогательные функции ──────────────────────────────────
  const catOf=nodeId=>EL[gb(nodeId)?.type]?.cat;
  const isBroker=cat=>cat==='broker'||cat==='queue';
  const isDB=cat=>cat==='db'||cat==='cache';
  const isActor=cat=>cat==='actor'||cat==='client';
  const isService=cat=>cat==='svc'||cat==='bff'||cat==='gw'||cat==='net';

  // ── УЧАСТНИКИ: внешние последними, в остальном порядок пути ──
  const seenP=[];
  path.forEach(id=>{if(!seenP.includes(id))seenP.push(id);});
  const seenSorted=[...seenP].sort((a,b)=>{
    const ca=catOf(a),cb=catOf(b);
    return (ca==='external'?1:0)-(cb==='external'?1:0);
  });

  const lines=[
    '# UML сценария: '+s.name,
    '# Бизнес-смысл над стрелкой, API-детали после //','',
  ];
  seenSorted.forEach(id=>{
    const b=gb(id);if(!b)return;
    const kw=seqKwFor(catOf(id));
    lines.push(`${kw} ${q(nm(id))}`);
  });
  lines.push('autonumber');
  lines.push('');

  // ── Найти первый broker-шаг (граница sync/async) ─────────────
  let brokerStepIdx=-1;
  for(let i=0;i<path.length-1;i++){
    if((steps[i]||{})._hidden)continue;
    if(isBroker(catOf(path[i+1]))){brokerStepIdx=i;break;}
  }
  const syncEnd=brokerStepIdx>=0?brokerStepIdx:path.length-2;

  // ── GENERATOR: одна forward стрелка ─────────────────────────
  // Возвращает строку UML или null (если шаг скрыт/пропустить)
  function makeFwd(i){
    const step=steps[i]||{};
    if(step._hidden)return null;
    const [a,b2]=[path[i],path[i+1]];
    const fb=gb(a),tb=gb(b2);
    if(!fb||!tb)return null;
    const fc=catOf(a),tc=catOf(b2);

    // DB→Service или DB→External — архитектурный разрыв, помечаем
    if(isDB(fc)&&(isService(tc)||tc==='external')){
      return null; // пропускаем — это ошибка моделирования пути
    }

    const _gwCtx=(fc==='gw'&&tc==='svc')?{gwAuthMode:fb.settings?.auth_mode}:null;
    const biz=step.name||bizVerb(fc,tc,false,_gwCtx);
    const isStore=isDB(tc)||isBroker(tc);
    const verb=step.verb||'GET';
    const apiTech=isStore
      ?(step.uri||apiFor(fb,tb,verb))
      :((step.verb||step.uri)?`${step.verb||''} ${step.uri||''}`.trim():apiFor(fb,tb,verb));
    const arrow=isBroker(tc)?'-)':'->';
    return `${q(nm(a))} ${arrow} ${q(nm(b2))}: ${biz}${apiTech?' // '+apiTech:''}`;
  }

  // ── GENERATOR: одна return стрелка ──────────────────────────
  // ret(i) = ответ от path[i+1] назад к path[i]
  // Правило UML 2.x: return опционален. Показываем если:
  //   1. step.resp явно задан
  //   2. Это граница клиент/GW (критически важный ответ)
  //   3. Это ответ от external-системы (нужен явный результат)
  // НЕ показываем: broker→X, X→broker, DB→service без resp
  function makeRet(i){
    const step=steps[i]||{};
    if(step._hidden)return null;
    const [caller,responder]=[path[i],path[i+1]];
    const rc=catOf(responder),tc=catOf(caller);

    if(isBroker(rc)||isBroker(tc))return null; // broker не отвечает

    const resp=step.resp;
    const isKeyBoundary=isActor(tc)||tc==='gw'||tc==='bff'||tc==='svc'; // всегда показываем (svc←svc/db/external)
    const isExternal=rc==='external';                        // внешний → показываем

    // DB: пропускаем return если resp не задан (очевидно из контекста)
    if(isDB(rc)&&!resp)return null;

    // Если resp пустой и это не ключевая граница — пропускаем
    if(!resp&&!isKeyBoundary&&!isExternal)return null;

    const respMsg=resp||bizVerb(rc,tc,true);
    if(!respMsg)return null;
    return `${q(nm(responder))} --> ${q(nm(caller))}: ${respMsg}`;
  }

  // ════════════════════════════════════════════════════════════
  // ФАЗА 1 — Sync forward (от актора до broker-publish включительно)
  // ════════════════════════════════════════════════════════════
  for(let i=0;i<=syncEnd;i++){
    const line=makeFwd(i);
    if(line)lines.push(line);
    // После broker-publish: note о том что брокер хранит событие
    if(i===brokerStepIdx){
      lines.push(`note over ${q(nm(path[i+1]))}: хранит событие в топике`);
    }
  }

  // ════════════════════════════════════════════════════════════
  // ФАЗА 2 — Sync returns в alt Успех / else Ошибка
  // (правило из практики аналитиков: alt всегда с else — обе ветки)
  // Returns идут СРАЗУ после publish, ДО async divider:
  // publisher не ждёт consumer, возвращает 2xx немедленно
  // ════════════════════════════════════════════════════════════
  const retLines=[];
  for(let i=syncEnd;i>=0;i--){
    const line=makeRet(i);
    if(line)retLines.push(line);
  }
  // Verb для подбора ошибки — с шага, зовущего сервис
  let _altVerb='GET';
  for(let i=syncEnd;i>=0;i--){
    const st=steps[i]||{};if(st._hidden)continue;
    const tcv=catOf(path[i+1]);
    if((tcv==='svc'||tcv==='bff')&&st.verb){_altVerb=st.verb;break;}
  }
  const _altErr=pickAltError(_altVerb,s.id);
  // Цепочка ошибки: только видимые svc/gw узлы sync-части в обратном порядке
  const _errChain=[];
  for(let i=syncEnd;i>=0;i--){
    const step=steps[i]||{};if(step._hidden)continue;
    const responder=path[i+1],caller=path[i];
    const rc=catOf(responder);
    if(isDB(rc)||isBroker(rc))continue; // DB/broker не в цепочке ошибки
    if(!_errChain.includes(responder))_errChain.push(responder);
    if(!_errChain.includes(caller))_errChain.push(caller);
  }
  if(retLines.length&&_errChain.length>=2){
    lines.push('alt Успех');
    retLines.forEach(l=>lines.push('  '+l));
    lines.push(`else Ошибка: ${_altErr.condition}`);
    for(let i=0;i<_errChain.length-1;i++){
      const from=_errChain[i],to=_errChain[i+1];
      const msg=isActor(catOf(to))?_altErr.userMsg:_altErr.resp;
      lines.push(`  ${q(nm(from))} --> ${q(nm(to))}: ${msg}`);
    }
    lines.push('end');
  } else retLines.forEach(l=>lines.push(l));

  // ════════════════════════════════════════════════════════════
  // ФАЗА 3 — Async consumer chain (если есть broker в пути)
  // ════════════════════════════════════════════════════════════
  if(brokerStepIdx>=0&&brokerStepIdx<path.length-2){
    lines.push('');
    lines.push('== Асинхронная обработка ==');

    // Async forward: consumer chain
    for(let i=brokerStepIdx+1;i<path.length-1;i++){
      const line=makeFwd(i);
      if(line)lines.push(line);
    }
    // Async returns: только внутри consumer chain
    for(let i=path.length-2;i>brokerStepIdx;i--){
      const line=makeRet(i);
      if(line)lines.push(line);
    }
  }

  return lines.join('\n');
}

function apiSlug(name){return String(name).toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,16)||'res';}
// apiFor — дефолтный техдетейл когда шаг не заполнен вручную
// verb — опциональный HTTP-глагол шага для генерации правильного SQL/URI
function apiFor(from,to,verb){
  const tc=EL[to.type]?.cat;
  const v=verb||'GET';
  if(tc==='db'){
    if(v==='GET')   return 'SELECT * FROM table WHERE id=$1';
    if(v==='POST')  return 'INSERT INTO table (...) RETURNING *';
    if(v==='PUT')   return 'UPDATE table SET ... WHERE id=$1';
    if(v==='PATCH') return 'UPDATE table SET col=$1 WHERE id=$2';
    if(v==='DELETE')return 'DELETE FROM table WHERE id=$1';
    return 'SELECT / INSERT';
  }
  if(tc==='cache') return v==='GET'?'GET key (Redis)':'SET key (Redis)';
  if(tc==='broker')return 'publish(event)';
  if(tc==='queue') return 'enqueue(task)';
  if(tc==='gw'||tc==='net')return 'HTTPS';
  if(tc==='external')return 'POST /external/api';
  const slug=apiSlug(to.customLabel||EL[to.type]?.lbl);
  return `${v==='POST'?'POST':'GET'} /api/v1/${slug}${v!=='POST'?'/{id}':''}`;
}

// ── UI ──────────────────────────────────────────────────────
let SEQ_TXT='',SEQ_ACTOR=null,SEQ_SCEN=null;

function openSeq(){
  SEQ_ACTOR=null;SEQ_SCEN=null;
  document.getElementById('seq-modal').style.display='flex';
  document.getElementById('seq-title').textContent='🔀 Sequence-диаграмма';
  populateSeqStart();
  const ta=document.getElementById('seq-input');
  const saved=localStorage.getItem('arch4_seq');
  if(saved&&saved.trim())ta.value=saved;
  else ta.value=generateSeqFromCanvas();
  renderSeq();
}
function openSeqForScenario(id){
  const s=(S.scenarios||[]).find(x=>x.id===id);if(!s)return;
  SEQ_ACTOR=null;SEQ_SCEN=id;
  document.getElementById('seq-modal').style.display='flex';
  document.getElementById('seq-title').textContent='📜 UML сценария: '+s.name;
  populateSeqStart();
  const ta=document.getElementById('seq-input');
  // Авто-UML всегда генерим свежий (генератор детерминированный).
  // Сохранённый текст берём ТОЛЬКО если пользователь правил его руками.
  ta.value=(s.umlEdited&&s.uml&&s.uml.trim())?s.uml:generateSeqFromScenario(id);
  renderSeq();
}
function openScenario(actorId){
  SEQ_ACTOR=actorId;SEQ_SCEN=null;
  const b=gb(actorId);if(!b)return;
  document.getElementById('seq-modal').style.display='flex';
  document.getElementById('seq-title').textContent='📜 Сценарий: '+(b.customLabel||EL[b.type]?.lbl);
  populateSeqStart();
  const ta=document.getElementById('seq-input');
  ta.value=(b.scenario&&b.scenario.trim())?b.scenario:generateSeqFromCanvas(actorId);
  renderSeq();
}
function closeSeq(){
  const wasBound=SEQ_ACTOR||SEQ_SCEN;SEQ_ACTOR=null;SEQ_SCEN=null;
  document.getElementById('seq-modal').style.display='none';
  if(wasBound&&typeof analyze==='function'){if(typeof pushHist==='function')pushHist();analyze();}
}
// ── Подсветка строки в textarea (одиночный клик на SVG-элемент) ──
function seqHighlightLine(lineNum){
  const ta=document.getElementById('seq-input');
  if(!ta)return;
  const lines=ta.value.split('\n');
  let pos=0;
  for(let i=0;i<lineNum&&i<lines.length;i++) pos+=lines[i].length+1;
  const end=pos+(lines[lineNum]?.length||0);
  ta.focus();
  ta.setSelectionRange(pos,end);
  // Скролл чтобы строка была видна
  const lineH=ta.scrollHeight/Math.max(1,lines.length);
  ta.scrollTop=Math.max(0,lineNum*lineH-ta.clientHeight/2);
}

// ── Инлайн-редактор: двойной клик → плавающий input над SVG-текстом ──
function seqInlineEdit(el,lineNum){
  const ta=document.getElementById('seq-input');
  if(!ta)return;
  const lines=ta.value.split('\n');
  const raw=lines[lineNum]||'';

  // Убираем предыдущий инлайн-редактор если есть
  const prev=document.getElementById('seq-inline-editor');
  if(prev)prev.remove();

  const rect=el.getBoundingClientRect();
  const inp=document.createElement('input');
  inp.id='seq-inline-editor';
  inp.type='text';
  inp.value=raw;
  const w=Math.max(280,rect.width+60);
  inp.style.cssText=`position:fixed;left:${Math.max(4,rect.left-8)}px;top:${rect.top-2}px;
    width:${w}px;z-index:99999;
    background:#1a1b26;color:#c0caf5;
    border:2px solid #7aa2f7;border-radius:5px;
    padding:3px 8px;font-family:Consolas,monospace;font-size:12px;
    outline:none;box-shadow:0 4px 20px #0008`;
  document.body.appendChild(inp);
  inp.select();
  inp.focus();

  // Подсказка внизу
  const hint=document.createElement('div');
  hint.style.cssText=`position:fixed;left:${Math.max(4,rect.left-8)}px;top:${rect.top+24}px;
    z-index:99999;background:#2a2b3d;color:#787c99;font-size:9.5px;
    padding:2px 8px;border-radius:3px;pointer-events:none`;
  hint.textContent='Enter — применить · Esc — отмена';
  document.body.appendChild(hint);

  function commit(){
    lines[lineNum]=inp.value;
    ta.value=lines.join('\n');
    inp.remove();hint.remove();
    renderSeq(true);
    // Возвращаем фокус на textarea и выделяем изменённую строку
    setTimeout(()=>seqHighlightLine(lineNum),50);
  }
  function cancel(){inp.remove();hint.remove();}

  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();commit();}
    if(e.key==='Escape'){cancel();}
  });
  inp.addEventListener('blur',()=>{if(document.body.contains(inp))commit();});
}

function renderSeq(fromUser){
  const ta=document.getElementById('seq-input');SEQ_TXT=ta.value;
  if(SEQ_SCEN){const s=(S.scenarios||[]).find(x=>x.id===SEQ_SCEN);if(s){s.uml=SEQ_TXT;if(fromUser)s.umlEdited=true;}}
  else if(SEQ_ACTOR){const b=gb(SEQ_ACTOR);if(b)b.scenario=SEQ_TXT;}
  else localStorage.setItem('arch4_seq',SEQ_TXT);
  try{
    const svg=renderSeqSVG(parseSeq(SEQ_TXT));
    const canvas=document.getElementById('seq-canvas');
    canvas.innerHTML=svg;
    // ── Навесить обработчики на кликабельные элементы ──
    canvas.querySelectorAll('[data-line]').forEach(el=>{
      const ln=parseInt(el.dataset.line);
      el.addEventListener('click',e=>{
        e.stopPropagation();
        seqHighlightLine(ln);
        // Мини-вспышка чтобы показать что связь работает
        el.style.outline='2px solid #7aa2f7';
        el.style.outlineOffset='2px';
        setTimeout(()=>{el.style.outline='';el.style.outlineOffset='';},600);
      });
      el.addEventListener('dblclick',e=>{
        e.stopPropagation();
        e.preventDefault();
        seqInlineEdit(el,ln);
      });
    });
  }catch(err){
    document.getElementById('seq-canvas').innerHTML='<div style="color:#f7768e;padding:20px;font-size:12px">Ошибка разбора: '+err.message+'</div>';
  }
}
function seqExample(k){document.getElementById('seq-input').value=SEQ_EXAMPLES[k]||SEQ_EXAMPLES.blank;renderSeq();}
function seqInsert(snippet){
  const ta=document.getElementById('seq-input');
  const s=ta.selectionStart,e=ta.selectionEnd;
  ta.value=ta.value.slice(0,s)+snippet+ta.value.slice(e);
  ta.focus();ta.selectionStart=ta.selectionEnd=s+snippet.length;
  renderSeq(true);
}
function seqExportSVG(){
  const svg=renderSeqSVG(parseSeq(document.getElementById('seq-input').value));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));a.download='sequence-'+Date.now()+'.svg';a.click();
}
function seqExportPNG(){
  const svgStr=renderSeqSVG(parseSeq(document.getElementById('seq-input').value));
  const img=new Image();
  const blob=new Blob([svgStr],{type:'image/svg+xml'});const url=URL.createObjectURL(blob);
  img.onload=()=>{
    const sc=2;const cv=document.createElement('canvas');cv.width=img.width*sc;cv.height=img.height*sc;
    const ctx=cv.getContext('2d');ctx.scale(sc,sc);ctx.drawImage(img,0,0);
    URL.revokeObjectURL(url);
    const a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download='sequence-'+Date.now()+'.png';a.click();
  };
  img.src=url;
}

// ── Экспорт в PlantUML (вставка в Confluence / plantuml.com) ────
// Наш синтаксис почти совместим с PlantUML — конвертируем расхождения:
//   # коммент → ' коммент;   -) и --) → ->> (async);
//   «биз // тех» → две строки (\n), т.к. в PlantUML // означает курсив
function seqToPlantUML(text){
  const out=['@startuml'];
  String(text||'').split(/\r?\n/).forEach(raw=>{
    const t=raw.trim();
    if(!t){out.push('');return;}
    if(t.startsWith('#')){out.push("' "+t.replace(/^#\s?/,''));return;}
    let line=raw;
    line=line.replace(/--\)/g,'-->>').replace(/-\)/g,'->>');
    const ci=line.indexOf(':');
    if(ci>0){
      const mi=line.indexOf('//',ci);
      if(mi>ci)line=line.slice(0,mi).trimEnd()+'\\n'+line.slice(mi+2).trim();
    }
    out.push(line);
  });
  out.push('@enduml');
  return out.join('\n');
}
function seqCopyPlantUML(){
  const src=document.getElementById('seq-input');if(!src)return;
  const txt=seqToPlantUML(src.value);
  const done=()=>toast('📋 PlantUML скопирован — вставляй в Confluence или plantuml.com');
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,()=>prompt('Скопируй вручную:',txt));
  else prompt('Скопируй вручную:',txt);
}
