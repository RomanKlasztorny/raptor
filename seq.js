// SEQUENCE EDITOR — text → UML diagram (business language + tech details under //)
// Syntax:
//   actor Student                       → stick figure
//   participant "API Gateway" as GW     → rectangle
//   Student -> Web: Opens profile       (business meaning above the arrow)
//   Web -> GW: // GET /api/v1/profile   (tech detail below the arrow)
//   GW --> Web: 200 OK                  (dashed — response)
//   Service -) Kafka: publish(event)    (async — open arrowhead)
//   alt / opt / loop / else / end

const SEQ_EXAMPLES_RU = {
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

const SEQ_EXAMPLES_EN = {
  payment: `actor Student
participant Web
participant "API Gateway" as GW
participant "Payment Service" as Payment
participant "Payment Gateway" as EXT
participant "User Service" as User

Student -> Web: Pays for the course
Web -> GW: // POST /api/v1/courses/{id}/payments
GW -> Payment: Validates and routes
Payment -> User: Requests user data
alt User not found
  User --> Payment: Responds "not found"
  Payment --> GW: 404 Not Found
  GW --> Web: 404 Not Found
  Web --> Student: Shows an error message
else User found
  User --> Payment: Returns profile
  Payment -> EXT: Initiates payment
  alt Payment succeeded
    EXT --> Payment: Confirms payment
    Payment --> GW: 201 Created
    GW --> Web: 201 Created
    Web --> Student: Shows "Course paid"
  else Payment failed
    EXT --> Payment: Reports an error
    Payment --> Web: 402 Payment Required
    Web --> Student: Shows a payment error
  end
end`,

  progress: `actor Mentor
participant Web
participant "API Gateway" as GW
participant "Analytics Service" as Analysis
participant PostgreSQL

Mentor -> Web: Opens student progress
Web -> GW: // GET /api/v1/students/{id}/analysis
GW -> Analysis: Validates token and routes
Analysis -> PostgreSQL: Requests student data
alt Student not in database
  PostgreSQL --> Analysis: Returns "not found"
  Analysis --> GW: 404 Not Found
  GW --> Web: 404 Not Found
  Web --> Mentor: Shows an error message
else Student found
  PostgreSQL --> Analysis: Returns profile and history
  Analysis --> GW: 200 OK (analytics)
  GW --> Web: 200 OK
  Web --> Mentor: Shows progress
end`,

  kafka: `actor User
participant "Mobile App" as App
participant "API Gateway" as GW
participant "Orders Service" as Orders
participant Kafka
participant "Notification Service" as Notify

User -> App: Places an order
App -> GW: // POST /api/v1/orders
GW -> Orders: Validates and routes
Orders -> Orders: Saves the order in the DB
Orders -) Kafka: // publish: order.created
note over Kafka: Kafka stores the event in the topic
Orders --> GW: 201 Created (order accepted)
GW --> App: 201 Created
App --> User: Shows "Order placed"

== Async processing ==
Kafka -) Notify: // consume: order.created
Notify -> User: Sends email confirmation`,

  blank: `actor User
participant Service

User -> Service: Opens a section
Service --> User: Shows data`,
};

const SEQ_EXAMPLES = new Proxy({}, { get: (_, k) => (CURR_LANG === 'ru' ? SEQ_EXAMPLES_RU : SEQ_EXAMPLES_EN)[k] });

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
  let refCollect=null; // для многострочного ref over ... end ref
  let noteCollect=null; // многострочный note over X … end note
  const boxes=[];let curBox=null; // box "Имя" #цвет … end box — группа участников (C4-контейнер)
  const noteTargets=s=>s.split(/\s*,\s*/).map(t=>laneIdx(t.trim())).filter(i=>i!=null);
  text.split(/\r?\n/).forEach((raw,lineNum)=>{
    const line=raw.trim();if(!line||line.startsWith('#'))return;
    if(line.startsWith('//')) return;
    // ── Многострочный ref: собираем строки до "end ref" ──
    if(refCollect!==null){
      if(/^end\s+ref$/i.test(line)){
        events.push({type:'ref',lanes:refCollect.lanes,label:refCollect.lines.join('\n'),lineNum:refCollect.lineNum});
        refCollect=null;
      } else {
        refCollect.lines.push(line);
      }
      return;
    }
    if(noteCollect!==null){
      if(/^end\s*note$/i.test(line)){noteCollect.text=noteCollect.lines.join('\n');delete noteCollect.lines;events.push(noteCollect);noteCollect=null;}
      else noteCollect.lines.push(line);
      return;
    }
    let m;
    if(!/-[->)]/.test(line)&&(m=line.match(/^box(?:\s+"([^"]*)"|\s+([^#\s][^#]*?))?\s*(#\S+)?$/i))){curBox={label:(m[1]||m[2]||'').trim(),color:seqBoxColor(m[3]),lanes:[],lineNum};boxes.push(curBox);return;}
    if(/^end\s+box$/i.test(line)){curBox=null;return;}
    if(m=line.match(/^(actor|participant|database|queue|boundary|control|entity|collections)\s+(?:"([^"]+)"|(\S+))(?:\s+as\s+(\S+))?(?:\s+order\s+(\d+))?(?:\s+(#\S+))?$/i)){
      const kind=m[1].toLowerCase();const disp=m[2]||m[3];const alias=m[4]||disp;const isActor=kind==='actor';const order=m[5]!=null?+m[5]:null;const color=seqColor(m[6]);
      let i=lanes.findIndex(l=>l.alias===alias||l.name===disp);
      if(i<0)lanes.push({name:disp,alias:alias,actor:isActor,kind,color,order,lineNum});
      else{lanes[i].actor=lanes[i].actor||isActor;lanes[i].alias=alias;lanes[i].kind=kind;if(color)lanes[i].color=color;if(order!=null)lanes[i].order=order;lanes[i].lineNum=lineNum;}
      if(curBox){const li=i<0?lanes.length-1:i;if(!curBox.lanes.includes(li))curBox.lanes.push(li);}
      return;
    }
    if(m=line.match(/^==\s*(.+?)\s*==$/)){events.push({type:'divider',label:m[1],lineNum});return;}
    if(line==='|||'||line==='||'){events.push({type:'spacer',lineNum});return;}
    if(line.startsWith('~~~')){events.push({type:'wave',label:line.slice(3).replace(/~~~$/,'').trim(),lineNum});return;}
    if(/^autonumber\s+stop$/i.test(line)){events.push({type:'autonumber-stop',lineNum});return;}
    if(/^autonumber\s+resume$/i.test(line)){events.push({type:'autonumber-resume',lineNum});return;}
    if(m=line.match(/^autonumber(?:\s+(\d+))?(?:\s+(\d+))?$/i)){events.push({type:'autonumber',start:m[1]?+m[1]:1,step:m[2]?+m[2]:1,lineNum});return;}
    if(m=line.match(/^\.\.\.(.*?)\.\.\.$/)){events.push({type:'delay',label:m[1].trim(),lineNum});return;}
    if(/^group\b/i.test(line)){events.push({type:'frag',kind:'group',label:line.replace(/^group\s*/i,''),lineNum});return;}
    if(m=line.match(/^activate\s+(?:"([^"]+)"|(\S+))(?:\s+(#\S+))?$/i)){events.push({type:'activate',lane:laneIdx(m[1]||m[2]),color:seqColor(m[3]),lineNum});return;}
    if(m=line.match(/^deactivate\s+(?:"([^"]+)"|(\S+))$/i)){events.push({type:'deactivate',lane:laneIdx(m[1]||m[2]),lineNum});return;}
    if(/^alt\b/i.test(line)){events.push({type:'frag',kind:'alt',label:line.replace(/^alt\s*/i,''),lineNum});return;}
    if(/^opt\b/i.test(line)){events.push({type:'frag',kind:'opt',label:line.replace(/^opt\s*/i,''),lineNum});return;}
    if(/^loop\b/i.test(line)){events.push({type:'frag',kind:'loop',label:line.replace(/^loop\s*/i,''),lineNum});return;}
    if(/^par\b/i.test(line)){events.push({type:'frag',kind:'par',label:line.replace(/^par\s*/i,''),lineNum});return;}
    if(/^break\b/i.test(line)){events.push({type:'frag',kind:'break',label:line.replace(/^break\s*/i,''),lineNum});return;}
    if(/^critical\b/i.test(line)){events.push({type:'frag',kind:'critical',label:line.replace(/^critical\s*/i,''),lineNum});return;}
    if(/^else\b/i.test(line)){events.push({type:'else',label:line.replace(/^else\s*/i,''),lineNum});return;}
    if(/^end\b/i.test(line)){events.push({type:'end',lineNum});return;}
    if(m=line.match(/^note\s+(over|left\s+of|right\s+of)\s+(.+?)\s*:\s*(.*)$/i)){
      const tg=noteTargets(m[2]);const pos=/^left/i.test(m[1])?'left':/^right/i.test(m[1])?'right':'over';
      events.push({type:'note',pos,target:tg[0],targets:tg,text:m[3],lineNum});return;}
    if(m=line.match(/^note\s+(over|left\s+of|right\s+of)\s+(.+?)$/i)){
      const tg=noteTargets(m[2]);const pos=/^left/i.test(m[1])?'left':/^right/i.test(m[1])?'right':'over';
      noteCollect={type:'note',pos,target:tg[0],targets:tg,lines:[],lineNum};return;}
    // ref однострочный: ref over A, B : label
    if(m=line.match(/^ref\s+over\s+(.+?)\s*:\s*(.+)$/i)){const targets=m[1].split(/\s*,\s*/).map(t=>laneIdx(t.trim()));events.push({type:'ref',lanes:targets,label:m[2].trim(),lineNum});return;}
    // ref многострочный: ref over A, B  (без : — открывает блок до end ref)
    if(m=line.match(/^ref\s+over\s+(.+?)$/i)){const targets=m[1].trim().split(/\s*,\s*/).map(t=>laneIdx(t.trim()));refCollect={lanes:targets,lines:[],lineNum};return;}
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
  return {lanes,events,boxes};
}

function seqEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const SEQ_COLORS={red:'#e06c75',orange:'#e0935a',grey:'#9aa0aa',gray:'#9aa0aa',white:'#dbe7f3',lightgreen:'#9ece6a',green:'#73b06f',pink:'#d98ab0',yellow:'#d9c264',skyblue:'#6fb3d9',blue:'#7aa2f7',lightblue:'#7fb0d9',purple:'#a98ad0',brown:'#a9785f'};
function seqColor(c){if(!c)return null;c=String(c).replace(/^#/,'').toLowerCase();if(SEQ_COLORS[c])return SEQ_COLORS[c];return /^[0-9a-f]{3,6}$/.test(c)?'#'+c:null;}
function seqBoxColor(c){if(!c)return null;const v=String(c).replace(/^#/,'');if(/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v))return '#'+v;const k=v.toLowerCase();const map={lightblue:'#eaf2fb',lightgreen:'#eaf6ea',lightyellow:'#fdf8e3',lightgrey:'#f1f2f4',lightgray:'#f1f2f4',pink:'#fbecf2',white:'#ffffff',aliceblue:'#f0f8ff',lavender:'#f1edfb'};return map[k]||null;}
function seqKwFor(cat){return cat==='actor'?'actor':(cat==='db'||cat==='cache')?'database':(cat==='broker'||cat==='queue')?'queue':cat==='external'?'boundary':'participant';}

// ═══════════════════════════════════════════════════════════════
// LAYOUT ENGINE v2
//  • ширина колонок — по реальной ширине подписей (canvas.measureText + кэш)
//  • перенос длинных подписей (сообщения, заметки, имена участников)
//  • стек активаций: sync-запрос открывает бар получателя, ответ закрывает бар отправителя,
//    self-call — вложенный бар со смещением; стрелки упираются в край бара
//  • вложенные alt/else/opt/loop/par/break/critical/group — отступ на каждый уровень вложенности
//  • нумерация (autonumber) — бейдж у начала стрелки
//  • box "Имя" … end box — группировка участников (C4-контейнер)
//  • все стили — CSS-классы sq-* (встроены в SVG, чтобы экспорт SVG/PNG был автономным)
// ═══════════════════════════════════════════════════════════════
const SEQ_FONT={
  biz:'600 12px Arial, Helvetica, sans-serif',
  tech:'10px Consolas, "DejaVu Sans Mono", monospace',
  head:'700 12px Arial, Helvetica, sans-serif',
  note:'11px Arial, Helvetica, sans-serif',
  frag:'600 11px Arial, Helvetica, sans-serif',
  fragKw:'700 11px Arial, Helvetica, sans-serif',
  div:'700 11px Arial, Helvetica, sans-serif',
  ref:'700 12px Arial, Helvetica, sans-serif',
};
const SQ={
  pad:24, msgWrap:240, msgWrapMax:520, noteWrap:200, headWrap:150,
  headGap:22, labelPad:14, actW:10, actNest:5, bizLH:15, techLH:13, noteLH:14, headLH:14,
  fragInset:9, fragPad:16, selfW:34,
};
// CSS-классы диаграммы. Для будущего редизайна (Win95 neo-retro) достаточно переопределить их.
const SEQ_SVG_CSS=`
.sq-bg{fill:#ffffff}
.sq-life{stroke:#b8c1cf;stroke-width:1;stroke-dasharray:4 4}
.sq-life.k-boundary{stroke:#cfcfc6;stroke-dasharray:3 7}
.sq-act{fill:#dde5f2;stroke:#7d8aa3;stroke-width:.8}
.sq-msg{stroke:#3d4555;stroke-width:1.3;fill:none}
.sq-msg.k-ret{stroke-dasharray:6 4;stroke:#5d6577}
.sq-msg.k-async{stroke:#6a4fb3}
.sq-ah{fill:#3d4555}.sq-aho{fill:none;stroke:#6a4fb3;stroke-width:1.4}
.sq-biz{font:${SEQ_FONT.biz};fill:#1e2030}
.sq-tech{font:${SEQ_FONT.tech};fill:#7c8296}
.sq-hit{fill:transparent}
.sq-num{fill:#3d5a99}.sq-num-t{font:700 9px Arial, sans-serif;fill:#fff}
.sq-head{fill:#dbe7f3;stroke:#7fa8cc;stroke-width:1.2}
.sq-head,.sq-head rect{filter:drop-shadow(1px 1px 0 rgba(0,0,0,.19))}
.sq-head.k-database{fill:#dbe7f3}.sq-head-top{fill:#eaf2fa;stroke:#7fa8cc;stroke-width:1.2}
.sq-head.k-queue{fill:#e6dff5;stroke:#9a86c8}.sq-head-top.k-queue{fill:#efeafb;stroke:#9a86c8}
.sq-head.k-boundary{fill:#f7f6f0;stroke:#a8a8a0;stroke-dasharray:5 3}
.sq-head.k-control,.sq-head.k-entity,.sq-head.k-collections{fill:#e3efe3;stroke:#7fae86}
.sq-actor{fill:none;stroke:#456;stroke-width:1.8}
.sq-head-t{font:${SEQ_FONT.head};fill:#234}
.sq-head-t.k-boundary{fill:#555}
.sq-stereo{font:italic 8.5px Arial, sans-serif;fill:#888}
.sq-frag-bg{fill-opacity:.38}
.sq-frag{fill:none;stroke-width:1.2}
.sq-frag-tag{stroke-width:1}
.sq-frag-kw{font:${SEQ_FONT.fragKw}}
.sq-frag-l{font:${SEQ_FONT.frag};fill:#3a4252}
.sq-else{stroke-width:1;stroke-dasharray:5 3}
.k-alt.sq-frag-bg{fill:#fff3c4}.k-alt.sq-frag,.k-alt.sq-else{stroke:#c9a83a}.k-alt.sq-frag-tag{fill:#f3e3a6;stroke:#c9a83a}.k-alt.sq-frag-kw{fill:#7a6216}
.k-opt.sq-frag-bg{fill:#dcefdc}.k-opt.sq-frag,.k-opt.sq-else{stroke:#6aaa7b}.k-opt.sq-frag-tag{fill:#c8e6cd;stroke:#6aaa7b}.k-opt.sq-frag-kw{fill:#2f6b3d}
.k-loop.sq-frag-bg{fill:#dfe6ff}.k-loop.sq-frag,.k-loop.sq-else{stroke:#7a96e0}.k-loop.sq-frag-tag{fill:#cdd8fb;stroke:#7a96e0}.k-loop.sq-frag-kw{fill:#2d4a9a}
.k-par.sq-frag-bg{fill:#efe4ff}.k-par.sq-frag,.k-par.sq-else{stroke:#a98ad8}.k-par.sq-frag-tag{fill:#e2d3fb;stroke:#a98ad8}.k-par.sq-frag-kw{fill:#5b3a91}
.k-break.sq-frag-bg{fill:#ffe1e1}.k-break.sq-frag,.k-break.sq-else{stroke:#d77a7a}.k-break.sq-frag-tag{fill:#f8cccc;stroke:#d77a7a}.k-break.sq-frag-kw{fill:#8f2d2d}
.k-critical.sq-frag-bg{fill:#ffe8d6}.k-critical.sq-frag,.k-critical.sq-else{stroke:#d9935a}.k-critical.sq-frag-tag{fill:#f9d8bd;stroke:#d9935a}.k-critical.sq-frag-kw{fill:#8a4a17}
.k-group.sq-frag-bg{fill:#eef1f6}.k-group.sq-frag,.k-group.sq-else{stroke:#8a93a8}.k-group.sq-frag-tag{fill:#dde2ec;stroke:#8a93a8}.k-group.sq-frag-kw{fill:#3a4252}
.sq-note{fill:#fff7d6;stroke:#d9c97a;stroke-width:1}
.sq-note-t{font:${SEQ_FONT.note};fill:#5b5340}
.sq-div{stroke:#aeb6c4;stroke-width:1}.sq-div-box{fill:#e7ecf3;stroke:#aeb6c4}.sq-div-t{font:${SEQ_FONT.div};fill:#3a4252}
.sq-delay{stroke:#aeb6c4;stroke-width:1;stroke-dasharray:2 5}.sq-delay-t{font:italic 10px Arial, sans-serif;fill:#778}
.sq-wave{fill:none;stroke:#9aa0aa;stroke-width:1.3}
.sq-box{fill:#f3f6fb;stroke:#c3cede;stroke-width:1;stroke-dasharray:6 3}.sq-box-t{font:700 11px Arial, sans-serif;fill:#5b6780}
.sq-ref{fill:#eef3ff;stroke:#7aa2f7;stroke-width:1.5}.sq-ref-tag{fill:#c9d8fb;stroke:#7aa2f7}.sq-ref-kw{font:700 9.5px Arial, sans-serif;fill:#1e2030}
.sq-ref-t{font:${SEQ_FONT.ref};fill:#1e2030}.sq-ref-t2{font:10.5px Arial, sans-serif;fill:#1e2030}
[data-line]{cursor:pointer}
`;

// ── Измерение текста: canvas.measureText с кэшем, без DOM — оценка по символам ──
const _seqMeasure={ctx:null,cache:new Map()};
function seqTextW(t,font){
  t=String(t==null?'':t);if(!t)return 0;
  const k=font+'\u0001'+t;
  let w=_seqMeasure.cache.get(k);if(w!=null)return w;
  if(_seqMeasure.ctx===null){
    try{_seqMeasure.ctx=(typeof document!=='undefined'&&document.createElement('canvas').getContext('2d'))||false;}catch(e){_seqMeasure.ctx=false;}
  }
  if(_seqMeasure.ctx){_seqMeasure.ctx.font=font;w=_seqMeasure.ctx.measureText(t).width;}
  else{
    const px=parseFloat((font.match(/([\d.]+)px/)||[0,12])[1]);const mono=/mono|consolas/i.test(font);
    w=0;for(const ch of t)w+=px*(mono?0.6:/[A-ZА-ЯЁЖШЩМЮЫWМ@%]/.test(ch)?0.7:/[ilj.,:;'|!()\[\] ]/.test(ch)?0.32:0.56);
    if(/^[67]00/.test(font))w*=1.07;
  }
  if(_seqMeasure.cache.size>8000)_seqMeasure.cache.clear();
  _seqMeasure.cache.set(k,w);return w;
}
// Перенос по словам; литерал \n — принудительный перенос (как в PlantUML)
function seqWrap(text,maxW,font){
  const out=[];
  String(text||'').split(/\\n|\n/).forEach(par=>{
    const words=par.split(/\s+/).filter(Boolean);
    if(!words.length){if(out.length)out.push('');return;}
    let cur='';
    words.forEach(w=>{
      while(w.length>1&&seqTextW(w,font)>maxW){
        // слишком длинное «слово» (URI, SQL) — режем, предпочитая / . _ - ,
        let n=w.length;while(n>1&&seqTextW(w.slice(0,n),font)>maxW)n--;
        const soft=Math.max(w.lastIndexOf('/',n-1),w.lastIndexOf('.',n-1),w.lastIndexOf('_',n-1),w.lastIndexOf('-',n-1),w.lastIndexOf(',',n-1));
        if(soft>n*0.5)n=soft+1;
        if(cur){out.push(cur);cur='';}
        out.push(w.slice(0,n));w=w.slice(n);
      }
      const t=cur?cur+' '+w:w;
      if(cur&&seqTextW(t,font)>maxW){out.push(cur);cur=w;}else cur=t;
    });
    if(cur)out.push(cur);
  });
  return out;
}
const _seqMaxW=(lines,font)=>lines.reduce((m,l)=>Math.max(m,seqTextW(l,font)),0);
const _f1=v=>(Math.round(v*10)/10);

// order N у участников: пересортировать лайны и переметить индексы в событиях/box-ах
function seqNormalize(model){
  let lanes=model.lanes||[],events=model.events||[],boxes=model.boxes||[];
  if(lanes.some(l=>l.order!=null)){
    const idx=lanes.map((l,i)=>({l,i}));
    idx.sort((a,b)=>{const ka=a.l.order!=null?a.l.order:1000+a.i,kb=b.l.order!=null?b.l.order:1000+b.i;return ka-kb||a.i-b.i;});
    const map={};idx.forEach((x,ni)=>map[x.i]=ni);
    lanes=idx.map(x=>x.l);
    events=events.map(e=>{const c={...e};
      ['from','to','lane','target'].forEach(k=>{if(typeof c[k]==='number')c[k]=map[c[k]];});
      if(Array.isArray(c.targets))c.targets=c.targets.map(t=>map[t]);
      if(Array.isArray(c.lanes))c.lanes=c.lanes.map(t=>map[t]);
      return c;});
    boxes=boxes.map(b=>({...b,lanes:b.lanes.map(t=>map[t])}));
  }
  return {lanes,events,boxes};
}

function seqLayout(model){
  const {lanes,events,boxes}=seqNormalize(model);
  const n=lanes.length;
  if(!n)return null;
  const E=seqEsc;
  const DL=ln=>ln!=null?` data-line="${ln}"`:'';

  // ── 1. Шапки участников ─────────────────────────────────────
  const heads=lanes.map(l=>{
    const kind=l.kind||(l.actor?'actor':'participant');
    const lines=seqWrap(l.name,SQ.headWrap,SEQ_FONT.head);
    const tw=_seqMaxW(lines,SEQ_FONT.head);
    const w=Math.max(kind==='actor'?56:84,tw+(kind==='queue'?34:kind==='database'?28:24));
    return {kind,lines,w,color:l.color};
  });
  const maxHL=Math.max(1,...heads.map(h=>h.lines.length));
  const hasBoundary=heads.some(h=>h.kind==='boundary');
  const shapeH=Math.max(36,18+maxHL*SQ.headLH+(hasBoundary?10:0));
  const actorH=44+maxHL*SQ.headLH;
  const HH=heads.some(h=>h.kind==='actor')?Math.max(shapeH,actorH):shapeH;
  const boxTitleH=boxes.length?22:0;
  const headTop=12+boxTitleH;
  const headBottom=headTop+HH;
  const laneBox=lanes.map(()=>-1);
  boxes.forEach((b,bi)=>b.lanes.forEach(li=>{if(li!=null&&li>=0&&li<n)laneBox[li]=bi;}));

  // ── 2. Предпроход: метрики текста, номера, диапазоны фрагментов ──
  const ev=events.map(e=>({...e}));
  let AN=null;const fstack=[];const frags=[];
  const hasExplicit=ev.some(e=>e.type==='activate'||e.type==='deactivate'||(e.type==='msg'&&(e.actFrom||e.actTo)));
  const touch=(arr)=>{fstack.forEach(f=>arr.forEach(l=>{if(l!=null&&l>=0&&l<n){f.minL=Math.min(f.minL,l);f.maxL=Math.max(f.maxL,l);}}));};
  ev.forEach(e=>{
    if(e.type==='autonumber'){AN={n:e.start||1,step:e.step||1};return;}
    if(e.type==='autonumber-stop'){if(AN)AN.off=true;return;}
    if(e.type==='autonumber-resume'){if(AN)AN.off=false;else AN={n:1,step:1};return;}
    if(e.type==='msg'){
      if(AN&&!AN.off){e.num=AN.n;AN.n+=AN.step;}
      e.biz=seqWrap(e.text,SQ.msgWrap,SEQ_FONT.biz);
      e.tech=seqWrap(e.note,SQ.msgWrap,SEQ_FONT.tech);
      e.labelW=Math.max(_seqMaxW(e.biz,SEQ_FONT.biz),_seqMaxW(e.tech,SEQ_FONT.tech));
      touch([e.from,e.to]);return;
    }
    if(e.type==='note'){
      e.lines=seqWrap(e.text,SQ.noteWrap,SEQ_FONT.note);
      e.w=Math.max(40,_seqMaxW(e.lines,SEQ_FONT.note)+18);
      touch(e.targets||[e.target]);return;
    }
    if(e.type==='ref'){
      e.lines=String(e.label||'').split('\n').filter(Boolean);
      e.w=Math.max(120,...e.lines.map((l,i)=>seqTextW(l,i?'10.5px Arial':SEQ_FONT.ref)+56));
      touch(e.lanes||[]);return;
    }
    if(e.type==='frag'){
      const f={kind:e.kind,label:e.label,lineNum:e.lineNum,minL:Infinity,maxL:-Infinity,inner:0,elses:[],depth:fstack.length};
      f.kwW=seqTextW(e.kind,SEQ_FONT.fragKw)+18;
      f.headW=f.kwW+(e.label?seqTextW('['+e.label+']',SEQ_FONT.frag)+18:12);
      e._f=f;frags.push(f);fstack.push(f);return;
    }
    if(e.type==='else'){
      const f=fstack[fstack.length-1];e._f=f;
      if(f){const w=e.label?seqTextW('['+e.label+']',SEQ_FONT.frag)+24:0;f.elseW=Math.max(f.elseW||0,w);}
      return;
    }
    if(e.type==='end'){
      const f=fstack.pop();e._f=f;
      if(f&&fstack.length){const p=fstack[fstack.length-1];p.inner=Math.max(p.inner,f.inner+1);
        if(f.minL<=f.maxL){p.minL=Math.min(p.minL,f.minL);p.maxL=Math.max(p.maxL,f.maxL);}}
      return;
    }
  });
  // незакрытые фрагменты закрываем в конце
  while(fstack.length){const f=fstack.pop();const e={type:'end',_f:f,synthetic:true};ev.push(e);
    if(fstack.length){const p=fstack[fstack.length-1];p.inner=Math.max(p.inner,f.inner+1);}}
  const fragPad=f=>SQ.fragPad+SQ.fragInset*f.inner;

  // ── 3. Горизонталь: зазоры между соседними лайнами ───────────
  const gap=[];
  for(let i=0;i<n-1;i++){
    gap[i]=heads[i].w/2+heads[i+1].w/2+SQ.headGap;
    if(laneBox[i]!==laneBox[i+1])gap[i]+=16;
  }
  const spans=[];
  const need=(a,b,w)=>{
    if(a==null||b==null||a===b)return;
    if(a>b){const t=a;a=b;b=t;}
    if(b===a+1)gap[a]=Math.max(gap[a],w);else spans.push({a,b,w});
  };
  let rightSelf=0;
  ev.forEach(e=>{
    if(e.type==='msg'){
      const numW=e.num!=null?24:0;
      if(e.from===e.to){
        const w=SQ.selfW+12+e.labelW+16+SQ.actNest*2;
        if(e.from<n-1)gap[e.from]=Math.max(gap[e.from],w+8);else rightSelf=Math.max(rightSelf,w);
      } else need(e.from,e.to,e.labelW+SQ.labelPad*2+SQ.actW*2+numW);
      return;
    }
    if(e.type==='frag'||e.type==='else'){
      const f=e._f;if(!f||!(f.minL<f.maxL))return;
      const w=(e.type==='frag'?f.headW:(f.elseW||0))-2*fragPad(f)+8;
      if(w>0)need(f.minL,f.maxL,w);
    }
  });
  spans.sort((p,q)=>(p.b-p.a)-(q.b-q.a));
  spans.forEach(s=>{
    let cur=0;for(let i=s.a;i<s.b;i++)cur+=gap[i];
    if(cur<s.w){const add=(s.w-cur)/(s.b-s.a);for(let i=s.a;i<s.b;i++)gap[i]+=add;}
  });
  const cx=[0];for(let i=1;i<n;i++)cx[i]=cx[i-1]+gap[i-1];

  // Перенос подписей по реальной ширине пролёта (широкий пролёт — меньше строк)
  ev.forEach(e=>{
    if(e.type!=='msg'||e.from===e.to)return;
    const span=Math.abs(cx[e.to]-cx[e.from])-SQ.labelPad*2-SQ.actW*2-(e.num!=null?24:0);
    const ww=Math.min(SQ.msgWrapMax,span);
    if(ww>SQ.msgWrap+8){
      e.biz=seqWrap(e.text,ww,SEQ_FONT.biz);
      e.tech=seqWrap(e.note,ww,SEQ_FONT.tech);
    }
  });

  // ── 4. Вертикаль: проход с активациями ──────────────────────
  let minX=cx[0]-heads[0].w/2,maxX=cx[n-1]+heads[n-1].w/2;
  const open=[];      // открытые фрагменты (для границ контента)
  const ext=(a,b)=>{if(a>b){const t=a;a=b;b=t;}minX=Math.min(minX,a);maxX=Math.max(maxX,b);
    open.forEach(f=>{f.cMin=Math.min(f.cMin,a);f.cMax=Math.max(f.cMax,b);});};
  const stk=lanes.map(()=>[]);const bars=[];const lastY=lanes.map(()=>null);
  const noAutoAct=k=>k==='actor'||k==='queue';
  const edgeX=(l,dir)=>{const d=stk[l].length;return d?cx[l]+(d-1)*SQ.actNest+dir*SQ.actW/2:cx[l];};
  const push=(l,y,color)=>{stk[l].push({y,color:color||lanes[l].color});};
  const pop=(l,y)=>{const a=stk[l].pop();if(!a)return;bars.push({l,d:stk[l].length,y0:a.y,y1:Math.max(y,a.y+8),color:a.color});};
  const actv=(l,y)=>{lastY[l]=Math.max(lastY[l]||0,y);};
  // отложенное восстановление активаций в ветке else: бар появляется, только когда участник реально задействован
  const pend=lanes.map(()=>[]);
  const wake=(l,y)=>{if(pend[l].length){pend[l].forEach(c=>push(l,y,c));pend[l]=[];}};
  const out=[];const fragOut=[];const fullW=[];
  let y=headBottom+18;

  ev.forEach(e=>{
    switch(e.type){
    case 'spacer':y+=36;return;
    case 'wave':fullW.push({t:'wave',y:y+8,label:e.label,ln:e.lineNum});y+=26;return;
    case 'delay':fullW.push({t:'delay',y:y+10,label:e.label,ln:e.lineNum});y+=34;return;
    case 'divider':fullW.push({t:'div',y:y+14,label:e.label,ln:e.lineNum});y+=34;return;
    case 'activate':push(e.lane,y,e.color);actv(e.lane,y);return;
    case 'deactivate':pop(e.lane,y);actv(e.lane,y);return;
    case 'frag':{
      const f=e._f;y+=8;f.y0=y;y+=26;f.cMin=Infinity;f.cMax=-Infinity;
      f.snap=stk.map(s=>s.slice());open.push(f);return;
    }
    case 'else':{
      const f=e._f;if(!f)return;y+=6;
      f.elses.push({y,label:e.label,ln:e.lineNum});
      // каждая ветка начинается с тех же активаций, что были на входе во фрагмент
      if(!hasExplicit&&f.snap){
        stk.forEach((s,l)=>{
          while(s.length>f.snap[l].length)pop(l,y);
          pend[l]=[];
          for(let k=s.length;k<f.snap[l].length;k++)pend[l].push(f.snap[l][k].color);
        });
      }
      y+=e.label?22:10;return;
    }
    case 'end':{
      const f=e._f;if(!f)return;
      const oi=open.lastIndexOf(f);if(oi>=0)open.splice(oi,1);
      y+=6;f.y1=y;y+=12;
      const pad=fragPad(f);
      let x0,x1;
      if(f.minL<=f.maxL){x0=cx[f.minL]-pad;x1=cx[f.maxL]+pad;}
      else{x0=cx[0]-pad;x1=x0+f.headW;}
      if(f.cMin<Infinity){x0=Math.min(x0,f.cMin-8-SQ.fragInset*f.inner);x1=Math.max(x1,f.cMax+8+SQ.fragInset*f.inner);}
      x1=Math.max(x1,x0+f.headW,x0+(f.elseW||0));
      f.x0=x0;f.x1=x1;ext(x0,x1);fragOut.push(f);
      return;
    }
    case 'note':{
      const tg=(e.targets&&e.targets.length?e.targets:[e.target]).filter(t=>t!=null&&t>=0&&t<n);
      if(!tg.length)return;
      y+=6;
      const h=e.lines.length*SQ.noteLH+10;
      let x0,w=e.w;
      const lo=Math.min(...tg.map(t=>cx[t])),hi=Math.max(...tg.map(t=>cx[t]));
      if(e.pos==='left'){x0=lo-14-w;}
      else if(e.pos==='right'){x0=hi+14;}
      else{if(tg.length>1){w=Math.max(w,hi-lo+40);}x0=(lo+hi)/2-w/2;}
      const fx=Math.min(8,h/2);
      out.push(`<g${DL(e.lineNum)}><path class="sq-note" d="M${_f1(x0)} ${_f1(y)}h${_f1(w-fx)}l${fx} ${fx}v${_f1(h-fx)}h${_f1(-w)}z"/>`+
        e.lines.map((l,i)=>`<text class="sq-note-t" x="${_f1(x0+9)}" y="${_f1(y+15+i*SQ.noteLH)}">${E(l)}</text>`).join('')+'</g>');
      ext(x0,x0+w);tg.forEach(t=>actv(t,y+h));
      y+=h+8;return;
    }
    case 'ref':{
      const ls=(e.lanes||[]).filter(t=>t!=null&&t>=0&&t<n);if(!ls.length)return;
      y+=6;
      const lo=Math.min(...ls),hi=Math.max(...ls);
      let x0=cx[lo]-heads[lo].w/2-6,x1=cx[hi]+heads[hi].w/2+6;
      if(x1-x0<e.w){const m=(x0+x1)/2;x0=m-e.w/2;x1=m+e.w/2;}
      const h=Math.max(46,28+e.lines.length*15);
      const mx=(x0+x1)/2;const d=DL(e.lineNum);
      let s=`<rect class="sq-ref" x="${_f1(x0)}" y="${_f1(y)}" width="${_f1(x1-x0)}" height="${h}" rx="2"${d}/>`;
      s+=`<path class="sq-ref-tag" d="M${_f1(x0)} ${_f1(y)}h32v15l-8 8h-24z"/><text class="sq-ref-kw" x="${_f1(x0+7)}" y="${_f1(y+15)}">ref</text>`;
      const fy=y+h/2-(e.lines.length*15)/2+11;
      e.lines.forEach((l,i)=>{s+=`<text class="${i?'sq-ref-t2':'sq-ref-t'}" x="${_f1(mx)}" y="${_f1(fy+i*15)}" text-anchor="middle"${d}>${E(l)}</text>`;});
      out.push(s);ext(x0,x1);ls.forEach(t=>actv(t,y+h));
      y+=h+10;return;
    }
    case 'msg':{
      const a=e.from,b=e.to;if(a==null||b==null)return;
      const d=DL(e.lineNum);
      const bizH=e.biz.length*SQ.bizLH,techH=e.tech.length*SQ.techLH;
      const cls='sq-msg'+(e.dashed?' k-ret':'')+(e.async?' k-async':'');
      const head=e.async?'url(#sqHeadO)':'url(#sqHead)';
      wake(a,y+4);wake(b,y+4);
      if(e.actFrom==='++')push(a,y);
      if(a===b){
        // ── self-call ──
        y+=8;
        const x=edgeX(a,1);
        const textH=bizH+techH;
        const lt=y+4,lh=Math.max(22,textH+2),lb=lt+lh;
        const selfAct=!hasExplicit&&!e.dashed&&!e.async;
        if(selfAct)push(a,lb-2);
        if(e.actTo==='++')push(a,lb-2);
        const xe=edgeX(a,1);
        let s=`<rect class="sq-hit" x="${_f1(x)}" y="${_f1(lt-4)}" width="${_f1(SQ.selfW+16+e.labelW)}" height="${_f1(lh+8)}"${d}/>`;
        s+=`<path class="${cls}" d="M${_f1(x)} ${_f1(lt)}h${SQ.selfW}V${_f1(lb)}H${_f1(xe+1)}" marker-end="${head}"/>`;
        const tx=x+SQ.selfW+10;
        e.biz.forEach((l,i)=>{s+=`<text class="sq-biz" x="${_f1(tx)}" y="${_f1(lt+12+i*SQ.bizLH)}"${d}>${E(l)}</text>`;});
        e.tech.forEach((l,i)=>{s+=`<text class="sq-tech" x="${_f1(tx)}" y="${_f1(lt+12+bizH+i*SQ.techLH)}"${d}>${E(l)}</text>`;});
        if(e.num!=null)s+=seqBadge(x+10,lt,e.num);
        out.push(s);ext(x-2,tx+e.labelW+4);
        if(selfAct)pop(a,lb+14);
        if(e.actTo==='--'||e.actFrom==='--')pop(a,lb);
        actv(a,lb+14);
        y=lb+(selfAct?22:14);return;
      }
      // ── обычная стрелка: бизнес-текст НАД стрелкой, техдеталь ПОД ──
      y+=8;
      const arrowY=y+bizH+(bizH?5:4);
      const dir=cx[b]>cx[a]?1:-1;
      const x1=edgeX(a,dir);
      if(!hasExplicit){
        if(e.dashed)pop(a,arrowY);
        else if(!noAutoAct(heads[b].kind))push(b,arrowY);
      }
      if(e.actTo==='++')push(b,arrowY);
      const x2=edgeX(b,-dir);
      const numW=e.num!=null?22:0;
      const ta=Math.min(x1,x2)+(dir>0?numW:0),tb=Math.max(x1,x2)-(dir<0?numW:0);
      const mx=(ta+tb)/2;
      let s=`<rect class="sq-hit" x="${_f1(Math.min(x1,x2))}" y="${_f1(y-2)}" width="${_f1(Math.abs(x2-x1))}" height="${_f1(arrowY-y+techH+8)}"${d}/>`;
      s+=`<line class="${cls}" x1="${_f1(x1)}" y1="${_f1(arrowY)}" x2="${_f1(x2-dir)}" y2="${_f1(arrowY)}" marker-end="${head}"/>`;
      e.biz.forEach((l,i)=>{s+=`<text class="sq-biz" x="${_f1(mx)}" y="${_f1(y+11+i*SQ.bizLH)}" text-anchor="middle"${d}>${E(l)}</text>`;});
      e.tech.forEach((l,i)=>{s+=`<text class="sq-tech" x="${_f1(mx)}" y="${_f1(arrowY+12+i*SQ.techLH)}" text-anchor="middle"${d}>${E(l)}</text>`;});
      if(e.num!=null)s+=seqBadge(x1+dir*11,arrowY,e.num);
      out.push(s);
      const lw=e.labelW/2;ext(Math.min(x1,x2,mx-lw),Math.max(x1,x2,mx+lw));
      if(e.actTo==='--')pop(b,arrowY);
      if(e.actFrom==='--')pop(a,arrowY);
      actv(a,arrowY);actv(b,arrowY);
      y=arrowY+(techH?techH+4:0)+8;return;
    }
    }
  });
  const bottomY=y+14;
  // висячие активации закрываем на последней активности лайна
  stk.forEach((s,l)=>{while(s.length){const yEnd=lastY[l]!=null?Math.min(lastY[l]+10,bottomY-6):bottomY-6;pop(l,yEnd);}});
  // C4-box-ы
  const boxR=boxes.map(bx=>{
    const ls=bx.lanes.filter(t=>t!=null&&t>=0&&t<n);if(!ls.length)return null;
    const lo=Math.min(...ls),hi=Math.max(...ls);
    const x0=cx[lo]-heads[lo].w/2-10,x1=Math.max(cx[hi]+heads[hi].w/2+10,x0+seqTextW(bx.label||'',SEQ_FONT.div)+20);
    ext(x0,x1);return {x0,x1,label:bx.label,color:bx.color};
  }).filter(Boolean);
  if(rightSelf)maxX=Math.max(maxX,cx[n-1]+rightSelf);

  // ── 5. Сборка слоёв ────────────────────────────────────────
  minX-=SQ.pad;maxX+=SQ.pad;
  const W=Math.ceil(maxX-minX),H=Math.ceil(bottomY+16);
  const offX=-minX;
  let L_box='',L_fragBg='',L_life='',L_act='',L_frag='',L_full='',L_heads='';
  boxR.forEach(b=>{
    const st=b.color?` style="fill:${b.color}"`:'';
    L_box+=`<rect class="sq-box" x="${_f1(b.x0)}" y="6" width="${_f1(b.x1-b.x0)}" height="${H-12}" rx="6"${st}/>`;
    L_box+=`<text class="sq-box-t" x="${_f1((b.x0+b.x1)/2)}" y="21" text-anchor="middle">${E(b.label||'')}</text>`;
  });
  fragOut.sort((p,q)=>p.depth-q.depth);
  fragOut.forEach(f=>{
    const k=' k-'+(FRAG_KINDS.includes(f.kind)?f.kind:'group');
    const h=f.y1-f.y0;
    L_fragBg+=`<rect class="sq-frag-bg${k}" x="${_f1(f.x0)}" y="${_f1(f.y0)}" width="${_f1(f.x1-f.x0)}" height="${_f1(h)}" rx="4"/>`;
    let s=`<rect class="sq-frag${k}" x="${_f1(f.x0)}" y="${_f1(f.y0)}" width="${_f1(f.x1-f.x0)}" height="${_f1(h)}" rx="4"/>`;
    s+=`<path class="sq-frag-tag${k}" d="M${_f1(f.x0)} ${_f1(f.y0)}h${_f1(f.kwW)}v12l-7 7h${_f1(-f.kwW+7)}z"${DL(f.lineNum)}/>`;
    s+=`<text class="sq-frag-kw${k}" x="${_f1(f.x0+7)}" y="${_f1(f.y0+14)}"${DL(f.lineNum)}>${E(f.kind)}</text>`;
    if(f.label)s+=`<text class="sq-frag-l" x="${_f1(f.x0+f.kwW+8)}" y="${_f1(f.y0+14)}"${DL(f.lineNum)}>[${E(f.label)}]</text>`;
    f.elses.forEach(el=>{
      s+=`<line class="sq-else${k}" x1="${_f1(f.x0)}" y1="${_f1(el.y)}" x2="${_f1(f.x1)}" y2="${_f1(el.y)}"/>`;
      if(el.label)s+=`<text class="sq-frag-l" x="${_f1(f.x0+10)}" y="${_f1(el.y+15)}"${DL(el.ln)}>[${E(el.label)}]</text>`;
    });
    L_frag+=s;
  });
  lanes.forEach((l,i)=>{L_life+=`<line class="sq-life k-${heads[i].kind}" x1="${_f1(cx[i])}" y1="${headBottom}" x2="${_f1(cx[i])}" y2="${bottomY}"/>`;});
  bars.sort((p,q)=>p.d-q.d).forEach(b=>{
    const x=cx[b.l]+b.d*SQ.actNest-SQ.actW/2;
    L_act+=`<rect class="sq-act" x="${_f1(x)}" y="${_f1(b.y0)}" width="${SQ.actW}" height="${_f1(b.y1-b.y0)}" rx="1.5"${b.color?` style="fill:${b.color}"`:''}/>`;
  });
  const fx0=minX+SQ.pad/2,fx1=maxX-SQ.pad/2;
  fullW.forEach(o=>{
    const mx=(fx0+fx1)/2,d=DL(o.ln);
    if(o.t==='div'){
      const tw=seqTextW(o.label,SEQ_FONT.div)+28;
      L_full+=`<line class="sq-div" x1="${_f1(fx0)}" y1="${o.y}" x2="${_f1(fx1)}" y2="${o.y}"/><rect class="sq-div-box" x="${_f1(mx-tw/2)}" y="${o.y-10}" width="${_f1(tw)}" height="20" rx="3"${d}/><text class="sq-div-t" x="${_f1(mx)}" y="${o.y+4}" text-anchor="middle"${d}>${E(o.label)}</text>`;
    } else if(o.t==='delay'){
      L_full+=`<line class="sq-delay" x1="${_f1(fx0)}" y1="${o.y-6}" x2="${_f1(fx1)}" y2="${o.y-6}"/><line class="sq-delay" x1="${_f1(fx0)}" y1="${o.y+6}" x2="${_f1(fx1)}" y2="${o.y+6}"/>`;
      if(o.label){const tw=seqTextW(o.label,'italic 10px Arial')+16;L_full+=`<rect class="sq-bg" x="${_f1(mx-tw/2)}" y="${o.y-7}" width="${_f1(tw)}" height="14"/><text class="sq-delay-t" x="${_f1(mx)}" y="${o.y+4}" text-anchor="middle"${d}>${E(o.label)}</text>`;}
    } else {
      let p=`M${_f1(fx0)} ${o.y}`;for(let x=fx0;x<fx1-20;x+=20)p+=` c5 -4,15 4,20 0`;
      L_full+=`<path class="sq-wave" d="${p}"/>`;
      if(o.label)L_full+=`<text class="sq-delay-t" x="${_f1(fx1-4)}" y="${o.y-6}" text-anchor="end"${d}>${E(o.label)}</text>`;
    }
  });
  heads.forEach((h,i)=>{L_heads+=seqHead(lanes[i],h,cx[i],headTop,headBottom,shapeH);});

  const defs=`<defs><style>${SEQ_SVG_CSS}</style>`+
    `<marker id="sqHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="sq-ah" d="M0 0L10 5L0 10z"/></marker>`+
    `<marker id="sqHeadO" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path class="sq-aho" d="M0 0L10 5L0 10"/></marker></defs>`;
  const g=s=>`<g transform="translate(${_f1(offX)},0)">${s}</g>`;
  const open_=(h,cls)=>`<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" font-family="Arial, Helvetica, sans-serif">`;
  const svg=open_(H,'sq-svg')+defs+`<rect class="sq-bg" width="100%" height="100%"/>`+
    g(L_box+L_fragBg+L_life+L_act+`<g class="sq-frags">${L_frag}</g>`+`<g class="sq-body">${L_full}${out.join('')}</g>`+`<g class="sq-heads">${L_heads}</g>`)+'</svg>';
  const hh=headBottom+6;
  const headSvg=open_(hh,'sq-svg sq-svg-head')+defs+`<rect class="sq-bg" width="100%" height="100%"/>`+
    g(L_box+L_life+`<g class="sq-heads">${L_heads}</g>`)+'</svg>';
  return {svg,headSvg,W,H,headH:hh,cx:cx.map(x=>x+offX),lanes,laneW:heads.map(h=>h.w)};
}
const FRAG_KINDS=['alt','opt','loop','par','break','critical','group'];
function seqBadge(x,y,num){
  const s=String(num),r=s.length>2?9.5:8;
  return `<circle class="sq-num" cx="${_f1(x)}" cy="${_f1(y)}" r="${r}"/><text class="sq-num-t" x="${_f1(x)}" y="${_f1(y+3.2)}" text-anchor="middle">${s}</text>`;
}
function seqHead(l,h,x,top,bottom,shapeH){
  const E=seqEsc,d=l.lineNum!=null?` data-line="${l.lineNum}"`:'';
  const k=h.kind,w=h.w,kc=' k-'+k;
  const st=h.color?` style="fill:${h.color}33;stroke:${h.color}"`:'';
  const txt=(y0)=>h.lines.map((t,i)=>`<text class="sq-head-t${kc}" x="${_f1(x)}" y="${_f1(y0+i*SQ.headLH)}" text-anchor="middle"${d}>${E(t)}</text>`).join('');
  const nl=h.lines.length,textH=nl*SQ.headLH;
  if(k==='actor'){
    const ay=bottom-textH-46;const sk=h.color?` style="stroke:${h.color}"`:'';
    return `<g class="sq-head-g"><g class="sq-actor"${sk}><circle cx="${_f1(x)}" cy="${ay+8}" r="7"/><path d="M${_f1(x)} ${ay+15}v17M${_f1(x-10)} ${ay+21}h20M${_f1(x)} ${ay+32}l-9 12M${_f1(x)} ${ay+32}l9 12"/></g>${txt(bottom-textH+9)}</g>`;
  }
  const y0=bottom-shapeH,cy=(bottom+y0)/2;
  if(k==='database'){
    const ry=6,lx=x-w/2;
    return `<g class="sq-head-g"><path class="sq-head${kc}" d="M${_f1(lx)} ${y0+ry}V${bottom-ry}A${w/2} ${ry} 0 0 0 ${_f1(lx+w)} ${bottom-ry}V${y0+ry}"${st}/><ellipse class="sq-head-top${kc}" cx="${_f1(x)}" cy="${y0+ry}" rx="${_f1(w/2)}" ry="${ry}"${st}/>${txt(cy-textH/2+14)}</g>`;
  }
  if(k==='queue'){
    const rx=8,lx=x-w/2;
    return `<g class="sq-head-g"><path class="sq-head${kc}" d="M${_f1(lx+rx)} ${y0}H${_f1(lx+w-rx)}A${rx} ${shapeH/2} 0 0 1 ${_f1(lx+w-rx)} ${bottom}H${_f1(lx+rx)}A${rx} ${shapeH/2} 0 0 1 ${_f1(lx+rx)} ${y0}z"${st}/><ellipse class="sq-head-top${kc}" cx="${_f1(lx+w-rx)}" cy="${_f1(cy)}" rx="${rx}" ry="${_f1(shapeH/2)}"${st}/>${txt(cy-textH/2+11)}</g>`;
  }
  if(k==='boundary'){
    return `<g class="sq-head-g"><rect class="sq-head${kc}" x="${_f1(x-w/2)}" y="${y0}" width="${_f1(w)}" height="${shapeH}" rx="3"${st}/><text class="sq-stereo" x="${_f1(x)}" y="${y0+11}" text-anchor="middle">&lt;&lt;external&gt;&gt;</text>${txt(cy-textH/2+16)}</g>`;
  }
  return `<g class="sq-head-g"><rect class="sq-head${kc}" x="${_f1(x-w/2)}" y="${y0}" width="${_f1(w)}" height="${shapeH}" rx="4"${st}/>${txt(cy-textH/2+11)}</g>`;
}

function renderSeqSVG(model){
  const lay=seqLayout(model);
  if(!lay)return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><text x="20" y="40" font-family="Arial" font-size="13" fill="#888">Опиши участников и сообщения слева…</text></svg>';
  window._seqRenderState={cx:lay.cx,lanes:lay.lanes.map(l=>({name:l.name,alias:l.alias})),laneW:lay.laneW,headH:lay.headH,W:lay.W,H:lay.H};
  return lay.svg;
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
  sel.innerHTML=srcs.map(s=>`<option value="${esc(s.id)}">${bLabel(s)}</option>`).join('')||'<option value="">нет источников</option>';
}

function seqFromCanvas(startId){
  if(SEQ_SCEN){const s=(S.scenarios||[]).find(x=>x.id===SEQ_SCEN);if(s)s.umlEdited=false;const t=generateSeqFromScenario(SEQ_SCEN);document.getElementById('seq-input').value=t||'';renderSeq();return;}
  if(!startId){const sel=document.getElementById('seq-start');startId=sel&&sel.value;}
  const b=(typeof gb==='function')?gb(startId):null;
  const t=(b&&b.scenario&&b.scenario.trim())?b.scenario:generateSeqFromCanvas(startId);
  document.getElementById('seq-input').value=t||'';
  if(!SEQ_ACTOR)localStorage.removeItem('arch4_seq');
  renderSeq();
  if(!t)alert(tTask({ru:'Сначала построй схему на холсте (актор → … → БД) — UML соберётся из неё.',en:'First build a diagram on the canvas (actor → … → DB) — the UML will be generated from it.'}));
}

// ── Банк типичных ошибок для alt-блоков (4xx / 5xx) ────────
const ALT_ERROR_BANK=[
  // 4xx — client errors
  {condition:tTask({ru:'токен невалидный или истёк',en:'token is invalid or expired'}),      resp:'401 Unauthorized',          userMsg:tTask({ru:'Показывает «Войдите заново»',en:'Shows "Please sign in again"'}),              verbs:['GET','POST','PATCH','PUT','DELETE']},
  {condition:tTask({ru:'нет прав доступа к ресурсу',en:'no permission to access the resource'}),      resp:'403 Forbidden',             userMsg:tTask({ru:'Показывает «Доступ запрещён»',en:'Shows "Access denied"'}),             verbs:['GET','PATCH','PUT','DELETE']},
  {condition:tTask({ru:'запись не найдена',en:'record not found'}),               resp:'404 Not Found',             userMsg:tTask({ru:'Показывает «Не найдено»',en:'Shows "Not found"'}),                  verbs:['GET','PATCH','PUT','DELETE']},
  {condition:tTask({ru:'запись уже существует (дубликат)',en:'record already exists (duplicate)'}),resp:'409 Conflict',              userMsg:tTask({ru:'Показывает «Уже существует»',en:'Shows "Already exists"'}),              verbs:['POST','PUT']},
  {condition:tTask({ru:'конфликт при обновлении данных',en:'conflict while updating data'}),  resp:'409 Conflict',              userMsg:tTask({ru:'Показывает «Данные изменились, обнови»',en:'Shows "Data changed, please refresh"'}),   verbs:['PATCH','PUT']},
  {condition:tTask({ru:'ошибка валидации полей',en:'field validation error'}),          resp:'422 Unprocessable Entity',  userMsg:tTask({ru:'Показывает список ошибок форм',en:'Shows a list of form errors'}),            verbs:['POST','PATCH','PUT']},
  {condition:tTask({ru:'неверный формат запроса',en:'malformed request'}),         resp:'400 Bad Request',           userMsg:tTask({ru:'Показывает «Неверный запрос»',en:'Shows "Bad request"'}),             verbs:['POST','PATCH','PUT']},
  {condition:tTask({ru:'превышен rate limit',en:'rate limit exceeded'}),             resp:'429 Too Many Requests',     userMsg:tTask({ru:'Показывает «Слишком много запросов»',en:'Shows "Too many requests"'}),      verbs:['GET','POST','PATCH','PUT','DELETE']},
  // 5xx — server errors
  {condition:tTask({ru:'ошибка БД / timeout запроса',en:'DB error / request timeout'}),     resp:'500 Internal Server Error', userMsg:tTask({ru:'Показывает «Что-то пошло не так»',en:'Shows "Something went wrong"'}),        verbs:['GET','POST','PATCH','PUT','DELETE']},
  {condition:tTask({ru:'сервис временно недоступен',en:'service temporarily unavailable'}),     resp:'503 Service Unavailable',   userMsg:tTask({ru:'Показывает «Сервис недоступен, попробуй позже»',en:'Shows "Service unavailable, try again later"'}), verbs:['GET','POST','PATCH','PUT','DELETE']},
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

// ── UML-генератор из сценария (v4) ──────────────────────────────
// Структура:
//   участники (сервис + его БД — в одной box-рамке = C4-контейнер)
//   ФАЗА 1: sync-цепочка вперёд; publish в брокер — async «-)», брокер не отвечает
//   ФАЗА 2: alt Успех (ответы в обратном порядке) / else Ошибка: <pickAltError> / end
//   ФАЗА 3: == Асинхронная обработка == → Broker -) Consumer → цепочка консьюмера
function generateSeqFromScenario(id){
  const s=(S.scenarios||[]).find(x=>x.id===id);
  if(!s||!s.path||s.path.length<2)return '';
  if(typeof ensureScenSteps==='function')ensureScenSteps(s);

  const path=s.path;
  const steps=s.steps||[];
  const nm=nid=>{const b=gb(nid);return b?(b.customLabel||EL[b.type]?.lbl||nid):nid;};
  const q=n=>/\s/.test(n)?'"'+n+'"':n;
  const Q=nid=>q(nm(nid));
  const cat=nid=>EL[gb(nid)?.type]?.cat;
  const isBrk=c=>c==='broker'||c==='queue';
  const isDb=c=>c==='db'||c==='cache';
  const isSvc=c=>c==='svc'||c==='bff'||c==='gw'||c==='auth'||c==='net';
  const isUser=c=>c==='actor'||c==='client';
  const sqlRx=/^(SELECT\b|INSERT\s+INTO\b|UPDATE\b|DELETE\s+FROM\b)/i;
  const RU=(typeof CURR_LANG==='undefined')||CURR_LANG!=='en';
  // steps[i] = сообщение на ребре path[i] → path[i+1]
  const stepAt=i=>steps[i]||{};
  const pathSet=new Set(path);
  // Собственная БД сервиса, не стоящая в path (инъекция «сервис → своя БД»)
  const ownDb=nid=>{
    if(!isSvc(cat(nid)))return null;
    const c=(S.conns||[]).find(c=>c.from===nid&&isDb(cat(c.to))&&!pathSet.has(c.to));
    return c?gb(c.to):null;
  };

  // ── Участники ────────────────────────────────────────────────
  const seen=[];const seenSet=new Set();
  const addP=nid=>{if(nid&&!seenSet.has(nid)&&gb(nid)){seenSet.add(nid);seen.push(nid);}};
  path.forEach(nid=>{addP(nid);const d=ownDb(nid);if(d)addP(d.id);});
  // external — в конец (стабильно)
  const ordered=seen.filter(n=>cat(n)!=='external').concat(seen.filter(n=>cat(n)==='external'));
  // C4-группировка: сервис + следующие за ним хранилища, в которые он ходит
  const owner={};
  ordered.forEach((nid,k)=>{
    if(!isSvc(cat(nid))||cat(nid)==='gw'||cat(nid)==='net')return;
    for(let j=k+1;j<ordered.length&&isDb(cat(ordered[j]));j++){
      const dbId=ordered[j];
      const linked=(S.conns||[]).some(c=>c.from===nid&&c.to===dbId)||path.some((p,pi)=>p===nid&&path[pi+1]===dbId);
      if(!linked||owner[dbId])break;
      owner[dbId]=nid;
    }
  });
  const L=['# UML сценария: '+s.name,''];
  const decl=nid=>`${seqKwFor(cat(nid))} ${Q(nid)}`;
  for(let k=0;k<ordered.length;k++){
    const nid=ordered[k];
    const members=ordered.slice(k+1).filter(d=>owner[d]===nid);
    if(members.length){
      L.push(`box "${nm(nid).replace(/"/g,"'")}" #F3F6FB`);
      L.push(decl(nid));members.forEach(d=>L.push(decl(d)));
      L.push('end box');
      k+=members.length;
    } else L.push(decl(nid));
  }
  L.push('autonumber','');

  // ── Граница sync/async: первый видимый хоп В брокер ───────────
  let brkIdx=-1;
  for(let i=0;i<path.length-1;i++){
    if(stepAt(i)._hidden)continue;
    if(isBrk(cat(path[i+1]))){brkIdx=i;break;}
  }
  const syncLast=brkIdx>=0?brkIdx:path.length-2;
  // Продюсер — ближайший сервис слева от брокера (DB не публикует)
  let publisherNid=brkIdx>=0?path[brkIdx]:null;
  if(publisherNid&&!isSvc(cat(publisherNid))){
    for(let i=brkIdx-1;i>=0;i--){if(isSvc(cat(path[i]))){publisherNid=path[i];break;}}
  }

  // ── Forward-стрелка i → i+1 ───────────────────────────────────
  function fwd(i){
    const st=stepAt(i);
    if(st._hidden)return null;
    const a=path[i],b=path[i+1];
    const ba=gb(a),bb=gb(b);
    if(!ba||!bb)return null;
    const fc=cat(a),tc=cat(b);
    const gwCtx=(fc==='gw'&&isSvc(tc))?{gwAuthMode:ba.settings?.auth_mode}:null;
    // Публикация в брокер — всегда async, брокер НЕ отвечает
    if(isBrk(tc)){
      const evt=st.uri||((tc==='queue'?'enqueue: ':'publish: ')+apiSlug(nm(b))+'.event');
      const biz=(st.name&&!sqlRx.test(st.name))?st.name:(tc==='queue'?'Ставит задачу в очередь':'Публикует событие');
      const pub=isSvc(fc)?a:(publisherNid||a);
      return `${Q(pub)} -) ${Q(b)}: ${biz}${evt&&evt!==biz?' // '+evt:''}`;
    }
    if(isDb(fc))return null;
    // Доставка из брокера консьюмеру — async
    if(isBrk(fc)){
      const biz=st.name&&!/^consume/i.test(st.name)?st.name:bizVerb(fc,tc,false);
      const tech=st.uri||'consume(event)';
      return `${Q(a)} -) ${Q(b)}: ${biz} // ${tech}`;
    }
    if(isUser(fc)){
      const biz0=st.name||bizVerb(fc,tc,false,gwCtx);
      const tech0=(tc==='client')?'':((st.verb||st.uri)?`${st.verb||''} ${st.uri||''}`.trim():'');
      return `${Q(a)} -> ${Q(b)}: ${biz0}${tech0?' // '+tech0:''}`;
    }
    const isStore=isDb(tc);
    const isSql=isStore&&!st.uri&&sqlRx.test(st.name||'');
    const biz=isSql
      ?(/^SELECT/i.test(st.name)?'Читает данные':/^INSERT/i.test(st.name)?'Сохраняет данные'
        :/^(UPDATE|DELETE)/i.test(st.name)?'Обновляет данные':'Запрашивает данные')
      :(st.name||bizVerb(fc,tc,false,gwCtx));
    const v=st.verb||'GET';
    const apiTech=apiFor(ba,bb,v);
    const tech=isStore
      ?(isSql?st.name:(st.uri||apiTech))
      :tc==='external'
        ?(st.uri||apiTech)
        :((st.verb||st.uri)?`${st.verb||''} ${st.uri||''}`.trim():apiTech);
    return `${Q(a)} -> ${Q(b)}: ${biz}${tech?' // '+tech:''}`;
  }

  // ── Return-стрелка i+1 → i (структурно: для alt/else) ─────────
  function retObj(i){
    const st=stepAt(i);
    if(st._hidden)return null;
    const call=path[i],resp=path[i+1];
    const rc=cat(resp),tc=cat(call);
    if(isBrk(rc)||isBrk(tc))return null;   // брокер не отвечает синхронно
    if(isDb(tc))return null;               // в БД не «возвращают»
    const isKey=isUser(tc)||isSvc(tc);
    if(!st.resp&&!isKey&&rc!=='external')return null;
    const biz=isUser(tc)?'Показывает результат':bizVerb(rc,tc,true);
    const tech=st.resp||(rc==='external'?'ok':'');
    return {from:resp,to:call,line:`${Q(resp)} --> ${Q(call)}: ${biz}${tech?' // '+tech:''}`};
  }
  // Инъекция «сервис → своя БД»
  function injectDb(svcNid,verb,out){
    const d=ownDb(svcNid);if(!d)return;
    const v=verb||'GET';
    const biz=/^(POST|PUT|PATCH)$/i.test(v)?'Сохраняет данные':v==='DELETE'?'Удаляет запись':'Запрашивает данные';
    out.push(`${Q(svcNid)} -> ${q(nm(d.id))}: ${biz} // ${apiFor(gb(svcNid),d,v)}`);
    out.push(`${q(nm(d.id))} --> ${Q(svcNid)}: Отдаёт данные`);
  }

  // ── ФАЗА 1: sync вперёд (+ publish) ──────────────────────────
  const handled=new Set();
  let mainVerb=null;
  for(let i=0;i<=syncLast;i++){const v=stepAt(i).verb;if(v&&!stepAt(i)._hidden){mainVerb=v;break;}}
  for(let i=0;i<=syncLast;i++){
    // DB → Kafka в path: сначала ответ БД продюсеру, потом publish
    if(i===brkIdx&&isDb(cat(path[i]))&&i>0){
      const r0=retObj(i-1);
      if(r0){L.push(r0.line);handled.add(i-1);}
    }
    const r=fwd(i);if(r)L.push(r);
    if(i===brkIdx){
      L.push(`note over ${Q(path[i+1])}: ${RU?'хранит событие в топике':'stores the event in the topic'}`);
    } else if(isSvc(cat(path[i+1]))){
      injectDb(path[i+1],stepAt(i).verb,L);
    }
  }

  // ── ФАЗА 2: ответы — alt Успех / else Ошибка ─────────────────
  const rets=[];
  for(let i=syncLast;i>=0;i--){
    if(handled.has(i))continue;
    const r=retObj(i);if(r)rets.push(r);
  }
  const errChain=rets.filter(r=>isSvc(cat(r.from)));
  if(rets.length&&errChain.length){
    const err=pickAltError(mainVerb||'GET',s.id);
    L.push('alt '+(RU?'Успех':'Success'));
    rets.forEach(r=>L.push('  '+r.line));
    L.push('else '+(RU?'Ошибка: ':'Error: ')+err.condition);
    errChain.forEach(r=>{
      const biz=cat(r.to)==='actor'?err.userMsg:isUser(cat(r.to))?(RU?'Передаёт ошибку клиенту':'Passes the error to the client'):(RU?'Возвращает ошибку':'Returns an error');
      L.push(`  ${Q(r.from)} --> ${Q(r.to)}: ${biz} // ${err.resp}`);
    });
    // Последний хоп до пользователя, если он не сервисный (например client → actor)
    rets.filter(r=>!isSvc(cat(r.from))&&isUser(cat(r.to))&&!isDb(cat(r.from))&&cat(r.from)!=='external').forEach(r=>{
      L.push(`  ${Q(r.from)} --> ${Q(r.to)}: ${err.userMsg} // ${err.resp}`);
    });
    L.push('end');
  } else rets.forEach(r=>L.push(r.line));

  // ── ФАЗА 3: асинхронная обработка консьюмером ────────────────
  if(brkIdx>=0&&brkIdx<path.length-2){
    L.push('','== '+(RU?'Асинхронная обработка':'Async processing')+' ==');
    for(let i=brkIdx+1;i<path.length-1;i++){
      const r=fwd(i);if(r)L.push(r);
      if(isSvc(cat(path[i+1])))injectDb(path[i+1],stepAt(i).verb||'POST',L);
    }
    for(let i=path.length-2;i>brkIdx;i--){const r=retObj(i);if(r)L.push(r.line);}
    const con=path[brkIdx+2];
    if(con&&isSvc(cat(con))&&cat(path[brkIdx+1])==='broker')
      L.push(`note over ${Q(con)}: commit offset`);
  }
  return L.join('\n');
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
  if(tc==='external'){
    const lbl=(to.customLabel||'').toLowerCase();
    if(/smtp|email|mail/.test(lbl)) return '';  // SMTP/Email — не HTTP-протокол
    return 'POST /external/api';
  }
  const slug=apiSlug(to.customLabel||EL[to.type]?.lbl);
  return `${v==='POST'?'POST':'GET'} /api/v1/${slug}${v!=='POST'?'/{id}':''}`;
}

// ── UI ──────────────────────────────────────────────────────
let SEQ_TXT='',SEQ_ACTOR=null,SEQ_SCEN=null;

function openSeq(){
  SEQ_ACTOR=null;SEQ_SCEN=null;
  document.getElementById('seq-modal').style.display='flex';
  document.getElementById('seq-title').textContent='🔀 Sequence-диаграмма';
  renderSeqLibPanel();
  populateSeqStart();
  populateSeqAddScenario();
  const ta=document.getElementById('seq-input');
  const saved=localStorage.getItem('arch4_seq');
  if(saved&&saved.trim())ta.value=saved;
  else ta.value=generateSeqFromCanvas();
  renderSeq();
}
// ── Добавить готовый сценарий в текущую UML-диаграмму (объединение слоёв) ──
// Декларации участников мержатся (без дублей), сообщения дописываются под разделителем ==Имя сценария==.
// Так несколько построенных кликами сценариев можно свести в одну большую диаграмму без ручного текста.
function populateSeqAddScenario(){
  const sel=document.getElementById('seq-add-scen');if(!sel)return;
  const others=(S.scenarios||[]).filter(x=>x.id!==SEQ_SCEN);
  sel.innerHTML='<option value="">'+tTask({ru:'+ добавить сценарий…',en:'+ add scenario…'})+'</option>'+
    others.map(s=>`<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
}
function appendScenarioToSeq(id){
  if(!id)return;
  const addTxt=generateSeqFromScenario(id);if(!addTxt)return;
  const declLines=[],bodyLines=[];
  addTxt.split('\n').forEach(l=>{
    const t=l.trim();
    if(!t||/^#/.test(t)||t==='autonumber')return;
    if(/^box\b/i.test(t)||/^end\s+box$/i.test(t))return; // box-рамки добавляемого сценария не переносим (участники — плоско)
    if(/^(actor|participant|database|queue|boundary|control|entity|collections)\s+/i.test(t)){declLines.push(l);return;}
    bodyLines.push(l);
  });
  const ta=document.getElementById('seq-input');
  const curLines=ta.value.split('\n');
  const existingDecls=new Set(curLines.map(l=>l.trim()).filter(t=>/^(actor|participant|database|queue|boundary|control|entity|collections)\s+/i.test(t)));
  const newDecls=declLines.filter(l=>!existingDecls.has(l.trim()));
  if(newDecls.length){
    const anIdx=curLines.findIndex(l=>l.trim()==='autonumber');
    if(anIdx>=0)curLines.splice(anIdx,0,...newDecls);else curLines.unshift(...newDecls);
  }
  const s=(S.scenarios||[]).find(x=>x.id===id);
  const label='== '+(s?s.name:tTask({ru:'Сценарий',en:'Scenario'}))+' ==';
  const cur=curLines.join('\n').replace(/\n+$/,'');
  const body=bodyLines.join('\n').replace(/^\n+/,'');
  ta.value=cur+'\n\n'+label+'\n'+body;
  renderSeq(true);
  populateSeqAddScenario();
}
function openSeqForScenario(id){
  const s=(S.scenarios||[]).find(x=>x.id===id);if(!s)return;
  SEQ_ACTOR=null;SEQ_SCEN=id;
  document.getElementById('seq-modal').style.display='flex';
  document.getElementById('seq-title').textContent='📜 UML сценария: '+s.name;
  renderSeqLibPanel();
  populateSeqStart();
  populateSeqAddScenario();
  const ta=document.getElementById('seq-input');
  // Если в сценарии есть готовый UML (написанный вручную или AI) — используем его.
  // Генерируем из path+steps только когда uml пустой.
  ta.value=(s.uml&&s.uml.trim())?s.uml:generateSeqFromScenario(id);
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
  hint.textContent=tTask({ru:'Enter — применить · Esc — отмена',en:'Enter — apply · Esc — cancel'});
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

// ── Масштаб холста (Ctrl+колесо, кнопки −/100%/+/⤢) ──
let SEQ_ZOOM=(()=>{const z=parseFloat(localStorage.getItem('raptor_seq_zoom'));return z>=0.25&&z<=3?z:1;})();
let _seqLastLay=null,_seqRaf=0;
function seqApplyZoom(){
  const canvas=document.getElementById('seq-canvas');if(!canvas||!_seqLastLay)return;
  const z=SEQ_ZOOM,L=_seqLastLay;
  const main=canvas.querySelector('svg.sq-svg:not(.sq-svg-head)'),head=canvas.querySelector('svg.sq-svg-head'),st=canvas.querySelector('.seq-sticky');
  if(main){main.setAttribute('width',Math.round(L.W*z));main.setAttribute('height',Math.round(L.H*z));}
  if(head){head.setAttribute('width',Math.round(L.W*z));head.setAttribute('height',Math.round(L.headH*z));}
  if(st){st.style.height=Math.round(L.headH*z)+'px';st.style.marginBottom=-Math.round(L.headH*z)+'px';}
  const lbl=document.getElementById('seq-zoom-lbl');if(lbl)lbl.textContent=Math.round(z*100)+'%';
}
function seqSetZoom(z,anchor){
  const canvas=document.getElementById('seq-canvas');
  z=Math.max(0.25,Math.min(3,Math.round(z*100)/100));
  const old=SEQ_ZOOM;if(z===old)return;
  // держим точку под курсором на месте
  let ax=0,ay=0,sx=0,sy=0;
  if(canvas){const r=canvas.getBoundingClientRect();ax=anchor?anchor.x-r.left:canvas.clientWidth/2;ay=anchor?anchor.y-r.top:canvas.clientHeight/2;sx=canvas.scrollLeft;sy=canvas.scrollTop;}
  SEQ_ZOOM=z;localStorage.setItem('raptor_seq_zoom',String(z));
  seqApplyZoom();
  if(canvas){const k=z/old;canvas.scrollLeft=(sx+ax)*k-ax;canvas.scrollTop=(sy+ay)*k-ay;}
}
function seqZoomStep(d){const steps=[0.25,0.33,0.5,0.67,0.75,0.9,1,1.1,1.25,1.5,1.75,2,2.5,3];
  const z=SEQ_ZOOM;const nx=d>0?steps.find(s=>s>z+0.001):[...steps].reverse().find(s=>s<z-0.001);seqSetZoom(nx||z);}
function seqZoomFit(){
  const canvas=document.getElementById('seq-canvas');if(!canvas||!_seqLastLay)return;
  const avail=canvas.clientWidth-40;seqSetZoom(Math.min(1,Math.floor(avail/_seqLastLay.W*100)/100));
}
// перерисовка не чаще кадра — ввод в textarea не тормозит на больших схемах
function seqScheduleRender(){if(_seqRaf)return;_seqRaf=requestAnimationFrame(()=>{_seqRaf=0;renderSeq(true);});}

function renderSeq(fromUser){
  const ta=document.getElementById('seq-input');SEQ_TXT=ta.value;
  if(SEQ_SCEN){const s=(S.scenarios||[]).find(x=>x.id===SEQ_SCEN);if(s){s.uml=SEQ_TXT;if(fromUser)s.umlEdited=true;}}
  else if(SEQ_ACTOR){const b=gb(SEQ_ACTOR);if(b)b.scenario=SEQ_TXT;}
  else localStorage.setItem('arch4_seq',SEQ_TXT);
  const canvas=document.getElementById('seq-canvas');
  try{
    const model=parseSeq(SEQ_TXT);
    const lay=seqLayout(model);
    if(!lay){_seqLastLay=null;canvas.innerHTML='<div class="seq-stage">'+renderSeqSVG(model)+'</div>';return;}
    _seqLastLay=lay;
    window._seqRenderState={cx:lay.cx,lanes:lay.lanes.map(l=>({name:l.name,alias:l.alias})),laneW:lay.laneW,headH:lay.headH,W:lay.W,H:lay.H};
    const sl=canvas.scrollLeft,stp=canvas.scrollTop;
    canvas.innerHTML='<div class="seq-stage"><div class="seq-sticky">'+lay.headSvg+'</div>'+lay.svg+'</div>';
    seqApplyZoom();canvas.scrollLeft=sl;canvas.scrollTop=stp;
    _seqStuck(canvas);
    // ── Навесить обработчики на кликабельные элементы ──
    canvas.querySelectorAll('[data-line]').forEach(el=>{
      const ln=parseInt(el.dataset.line);
      el.addEventListener('click',e=>{
        if(e._seqDragMoved) return; // подавить клик после перетаскивания
        e.stopPropagation();
        seqHighlightLine(ln);
        el.classList.add('sq-flash');
        setTimeout(()=>el.classList.remove('sq-flash'),600);
      });
      el.addEventListener('dblclick',e=>{
        e.stopPropagation();
        e.preventDefault();
        seqInlineEdit(el,ln);
      });
    });
    // ── Обработчики холста (один раз): ref-drag, Ctrl+колесо, липкая шапка ──
    if(!canvas.dataset.dragInit){
      canvas.dataset.dragInit='1';_initSeqRefDrag(canvas);
      canvas.addEventListener('wheel',e=>{
        if(!(e.ctrlKey||e.metaKey))return;
        e.preventDefault();
        seqSetZoom(SEQ_ZOOM*Math.exp(-e.deltaY*0.0015),{x:e.clientX,y:e.clientY});
      },{passive:false});
      canvas.addEventListener('scroll',()=>_seqStuck(canvas),{passive:true});
    }
  }catch(err){
    canvas.innerHTML='<div class="seq-err">'+tTask({ru:'Ошибка разбора: ',en:'Parse error: '})+seqEsc(err.message)+'</div>';
  }
}
function _seqStuck(canvas){const st=canvas.querySelector('.seq-sticky');if(st)st.classList.toggle('stuck',canvas.scrollTop>4);}
// ── Drag-to-reorder: перетаскивание ref-блока мышью ─────────────
// Вертикально (вверх/вниз) — меняет порядок ref в диаграмме
// Горизонтально (влево/вправо) — меняет участников в «ref over A, B»
function _initSeqRefDrag(canvas){
  let drag=null,indicator=null;

  canvas.addEventListener('mousedown',e=>{
    const el=e.target.closest?e.target.closest('[data-line]'):e.target;
    if(!el||!el.dataset||!el.dataset.line)return;
    const ln=parseInt(el.dataset.line);
    const ta=document.getElementById('seq-input');
    const lines=ta.value.split('\n');
    const refLine=(lines[ln]||'').trim();
    if(!/^ref\s+over/i.test(refLine))return;

    let endLn=ln;
    if(!/^ref\s+over\s+.+?:\s*.+$/i.test(refLine)){
      for(let i=ln+1;i<lines.length;i++){if(/^end\s+ref$/i.test(lines[i].trim())){endLn=i;break;}}
    }
    drag={lineStart:ln,lineEnd:endLn,startY:e.clientY,startX:e.clientX,moved:false,axis:null};
    e.preventDefault();
  },{passive:false});

  document.addEventListener('mousemove',e=>{
    if(!drag)return;
    const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY;

    // Фиксируем ось по первому значимому движению
    if(!drag.axis&&(Math.abs(dx)>8||Math.abs(dy)>8)){
      drag.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
    }
    if(drag.axis&&!drag.moved){
      drag.moved=true;
      document.body.style.cursor='grabbing';
      const cr=canvas.getBoundingClientRect();
      indicator=document.createElement('div');
      if(drag.axis==='y'){
        indicator.style.cssText=`position:fixed;left:${cr.left+8}px;width:${cr.width-16}px;height:3px;background:#7aa2f7;border-radius:2px;box-shadow:0 0 8px #7aa2f780;z-index:99999;pointer-events:none;transition:top .05s`;
      } else {
        indicator.style.cssText=`position:fixed;top:${cr.top+8}px;height:${cr.height-16}px;width:3px;background:#e0af68;border-radius:2px;box-shadow:0 0 8px #e0af6880;z-index:99999;pointer-events:none`;
      }
      document.body.appendChild(indicator);
    }
    if(drag.moved&&indicator){
      if(drag.axis==='y') indicator.style.top=e.clientY+'px';
      else indicator.style.left=e.clientX+'px';
    }
  });

  document.addEventListener('mouseup',e=>{
    if(!drag)return;
    const wasMoved=drag.moved;
    if(wasMoved){
      const ta=document.getElementById('seq-input');
      const cr=canvas.getBoundingClientRect();
      const lines=ta.value.split('\n');

      if(drag.axis==='y'){
        // ── Вертикальный дроп: меняем порядок строк ──
        const dropY=e.clientY-cr.top;
        const elems=[...canvas.querySelectorAll('[data-line]')]
          .map(el=>({ln:parseInt(el.dataset.line),y:el.getBoundingClientRect().top+el.getBoundingClientRect().height/2-cr.top}))
          .filter(x=>x.ln<drag.lineStart||x.ln>drag.lineEnd)
          .sort((a,b)=>a.ln-b.ln);
        let insertAfterLn=-1;
        for(const {ln,y} of elems){if(y<dropY)insertAfterLn=ln;}
        const block=lines.splice(drag.lineStart,drag.lineEnd-drag.lineStart+1);
        const nRemoved=block.length;
        let insertAt;
        if(insertAfterLn<0){insertAt=0;}
        else if(insertAfterLn>drag.lineEnd){insertAt=insertAfterLn-nRemoved+1;}
        else{insertAt=insertAfterLn+1;}
        insertAt=Math.max(0,Math.min(insertAt,lines.length));
        lines.splice(insertAt,0,...block);
        ta.value=lines.join('\n');
      } else {
        // ── Горизонтальный дроп: меняем «ref over A, B» ──
        const rs=window._seqRenderState;
        if(rs&&rs.cx&&rs.cx.length){
          // координаты SVG: учитываем отступ сцены, прокрутку и масштаб
          const svgEl=canvas.querySelector('svg.sq-svg:not(.sq-svg-head)');
          const sr=svgEl?svgEl.getBoundingClientRect():cr;
          const toCanvasX=(clientX)=>(clientX-sr.left)/SEQ_ZOOM;
          const nearestLane=(cx)=>{let bi=0,bd=Infinity;rs.cx.forEach((x,i)=>{const d=Math.abs(x-cx);if(d<bd){bd=d;bi=i;}});return bi;};
          const iStart=nearestLane(toCanvasX(drag.startX));
          const iDrop =nearestLane(toCanvasX(e.clientX));
          const iMin=Math.min(iStart,iDrop), iMax=Math.max(iStart,iDrop);
          const alias=(i)=>{const l=rs.lanes[i];return(l.alias||l.name||'').trim();};
          const q=(n)=>/\s/.test(n)?`"${n}"`:n;
          const newOver=iMin===iMax?q(alias(iMin)):`${q(alias(iMin))}, ${q(alias(iMax))}`;

          // Обновляем ref over в первой строке блока
          const refLine=lines[drag.lineStart]||'';
          if(/^ref\s+over\s+.+?:\s*.+$/i.test(refLine.trim())){
            // Однострочный: «ref over A, B : label»
            const labelPart=refLine.replace(/^ref\s+over\s+.+?\s*:/i,'').trim();
            lines[drag.lineStart]=`ref over ${newOver} : ${labelPart}`;
          } else {
            // Многострочный: «ref over A, B»
            lines[drag.lineStart]=`ref over ${newOver}`;
          }
          ta.value=lines.join('\n');
        }
      }

      e._seqDragMoved=true;
      renderSeq(true);
    }
    if(indicator){indicator.remove();indicator=null;}
    document.body.style.cursor='';
    drag=null;
  });
}

function seqExample(k){document.getElementById('seq-input').value=SEQ_EXAMPLES[k]||SEQ_EXAMPLES.blank;renderSeq();}
function seqInsert(snippet){
  const ta=document.getElementById('seq-input');
  const s=ta.selectionStart,e=ta.selectionEnd;
  ta.value=ta.value.slice(0,s)+snippet+ta.value.slice(e);
  ta.focus();ta.selectionStart=ta.selectionEnd=s+snippet.length;
  renderSeq(true);
}

// ═══════════════════════════════════════════════════════════════
// УМНАЯ ВСТАВКА — кнопки работают с реальными участниками текущей
// диаграммы, а не с шаблонными «A»/«B», которые ломали рендер.
// ═══════════════════════════════════════════════════════════════
function _seqQ(n){return /\s/.test(n)?'"'+n+'"':n;}
// Текущие участники из текста (в порядке объявления/появления)
function _seqLanes(){
  try{return parseSeq(document.getElementById('seq-input').value).lanes;}catch(e){return [];}
}
// Уникальное имя: База, База2, База3…
function _seqUniqueName(base){
  const names=new Set(_seqLanes().map(l=>l.name));
  if(!names.has(base))return base;
  let i=2;while(names.has(base+i))i++;return base+i;
}
// Пара «откуда → куда» для новой стрелки: продолжаем с последнего сообщения,
// иначе первые два участника; совсем пусто — заглушки Клиент/Сервис.
function _seqLastPair(){
  const ta=document.getElementById('seq-input');
  let model;try{model=parseSeq(ta.value);}catch(e){return null;}
  const msgs=model.events.filter(e=>e.type==='msg'&&e.from!==e.to);
  if(msgs.length){
    const m=msgs[msgs.length-1];
    return {from:model.lanes[m.from]?.name,to:model.lanes[m.to]?.name,dashed:m.dashed};
  }
  if(model.lanes.length>=2)return {from:model.lanes[0].name,to:model.lanes[1].name,dashed:false};
  return null;
}
// Вставка ЦЕЛЫХ строк: по границе строки после курсора (не разрывая строку)
function _seqInsertLines(lines){
  const ta=document.getElementById('seq-input');
  const txt=ta.value;
  let pos=ta.selectionEnd!=null?ta.selectionEnd:txt.length;
  const nl=txt.indexOf('\n',pos);
  pos=nl<0?txt.length:nl; // конец текущей строки
  const before=txt.slice(0,pos),after=txt.slice(pos);
  const chunk=(before&&!before.endsWith('\n')?'\n':'')+lines.join('\n');
  ta.value=before+chunk+after;
  ta.focus();
  const cp=(before+chunk).length;
  ta.selectionStart=ta.selectionEnd=cp;
  renderSeq(true);
}
// Объявление участника — после последнего объявления (или в начало), не туда где курсор
function _seqInsertDecl(line){
  const ta=document.getElementById('seq-input');
  const lines=ta.value.split('\n');
  let lastDecl=-1;
  lines.forEach((l,i)=>{if(/^\s*(actor|participant|database|queue|boundary|control|entity|collections)\s+/i.test(l))lastDecl=i;});
  if(lastDecl<0){
    // после ведущих комментариев/пустых строк
    let i=0;while(i<lines.length&&(!lines[i].trim()||lines[i].trim().startsWith('#')))i++;
    lines.splice(i,0,line);
  }else lines.splice(lastDecl+1,0,line);
  ta.value=lines.join('\n');
  renderSeq(true);
}

function seqSmart(kind){
  const ta=document.getElementById('seq-input');if(!ta)return;
  const RU=CURR_LANG!=='en';
  const pair=_seqLastPair();
  const F=pair?_seqQ(pair.from):_seqQ(RU?'Клиент':'Client');
  const T=pair?_seqQ(pair.to):_seqQ(RU?'Сервис':'Service');

  if(kind==='actor'){
    const n=_seqUniqueName(RU?'Пользователь':'User');
    _seqInsertDecl('actor '+_seqQ(n));return;
  }
  if(kind==='role'){
    const n=_seqUniqueName(RU?'Сервис':'Service');
    _seqInsertDecl('participant '+_seqQ(n));return;
  }
  if(kind==='request'){
    _seqInsertLines([`${F} -> ${T}: ${RU?'Действие':'Action'} // GET /api/v1/path`]);return;
  }
  if(kind==='response'){
    // ответ — разворот последней стрелки
    _seqInsertLines([`${T} --> ${F}: ${RU?'Возвращает результат':'Returns result'} // 200 OK`]);return;
  }
  if(kind==='kafka'){
    // найти существующий брокер среди участников, иначе объявить
    const lanes=_seqLanes();
    let brk=lanes.find(l=>l.kind==='queue'||/kafka|broker|queue|rabbit|nats/i.test(l.name));
    if(!brk){_seqInsertDecl('queue Kafka');brk={name:'Kafka'};}
    _seqInsertLines([`${T} -) ${_seqQ(brk.name)}: ${RU?'Публикует событие':'Publishes event'} // topic.event`]);return;
  }
  if(kind==='alt'||kind==='opt'||kind==='loop'||kind==='group'){
    const label={alt:RU?'условие':'condition',opt:RU?'условие':'condition',loop:RU?'пока условие':'while condition',group:RU?'Название':'Name'}[kind];
    // если выделены целые строки — оборачиваем их
    const s=ta.selectionStart,e=ta.selectionEnd;
    if(e>s){
      const txt=ta.value;
      let ls=txt.lastIndexOf('\n',s-1)+1;
      let le=txt.indexOf('\n',e);if(le<0)le=txt.length;
      const selLines=txt.slice(ls,le).split('\n').map(l=>'  '+l);
      const wrapped=[kind+' '+label,...selLines,'end'];
      if(kind==='alt')wrapped.splice(wrapped.length-1,0,'else '+(RU?'иначе':'otherwise'),`  ${F} -> ${T}: ${RU?'Действие':'Action'}`);
      ta.value=txt.slice(0,ls)+wrapped.join('\n')+txt.slice(le);
      ta.focus();renderSeq(true);return;
    }
    // без выделения — скелет с реальными участниками
    const body=[`  ${F} -> ${T}: ${RU?'Действие':'Action'}`];
    const block=kind==='alt'
      ?[`alt ${label}`,...body,'else '+(RU?'иначе':'otherwise'),...body,'end']
      :[`${kind} ${label}`,...body,'end'];
    _seqInsertLines(block);return;
  }
  if(kind==='pause'){_seqInsertLines([`...${RU?'ожидание':'waiting'}...`]);return;}
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
// Наш синтаксис почти совместим с PlantUML — конвертируем расхождения так,
// чтобы картинка в PlantUML совпадала с нашей отрисовкой:
//   # коммент / // коммент → ' коммент;   -) и --) → ->> / -->> (async);
//   «биз // тех» → «биз\nтех» (в PlantUML // — курсив);   ~~~ подпись → ...подпись...;
//   имена с дефисами/точками берутся в кавычки, алиасы — нормализуются;
//   hide footbox + maxMessageSize — как у нас: шапка одна, длинные подписи переносятся.
function seqToPlantUML(text){
  const out=['@startuml','hide footbox','skinparam maxMessageSize 240','skinparam sequenceMessageAlign center','skinparam responseMessageBelowArrow false'];
  const WORD=/^[\wА-Яа-яЁё]+$/;
  const aliasMap={};
  const Q=n=>{n=String(n).trim();if(!n)return n;if(/^".*"$/.test(n))return n;if(aliasMap[n])return aliasMap[n];return WORD.test(n)?n:'"'+n.replace(/"/g,"'")+'"';};
  const endp=raw=>{const m=String(raw).trim().match(/^(.*?)\s*(\+\+|--|\*\*|!!)?$/);return Q(m[1])+(m[2]||'');};
  const bizTech=lbl=>{const mi=lbl.indexOf('//');return mi>=0?lbl.slice(0,mi).trimEnd()+'\\n'+lbl.slice(mi+2).trim():lbl;};
  const arrowOf=a=>a==='--)'?'-->>':a==='-)'?'->>':a;
  let inRef=false,inNote=false;
  String(text||'').split(/\r?\n/).forEach(raw=>{
    const t=raw.trim();
    const ind=(raw.match(/^\s*/)||[''])[0];
    if(!t){out.push('');return;}
    if(inRef||inNote){out.push(raw);if(/^end\s*(ref|note)$/i.test(t)){inRef=inNote=false;}return;}
    if(t.startsWith('#')){out.push("' "+t.replace(/^#\s?/,''));return;}
    if(t.startsWith('//')){out.push("' "+t.replace(/^\/\/\s?/,''));return;}
    if(t.startsWith('~~~')){const l=t.slice(3).replace(/~~~$/,'').trim();out.push(ind+(l?'...'+l+'...':'...'));return;}
    let m;
    if(m=t.match(/^(actor|participant|database|queue|boundary|control|entity|collections)\s+(?:"([^"]+)"|(\S+))(?:\s+as\s+(\S+))?(.*)$/i)){
      const disp=m[2]||m[3];let alias=m[4];
      if(alias&&!WORD.test(alias)){const a2=alias.replace(/[^\wА-Яа-яЁё]/g,'_');aliasMap[alias]=a2;alias=a2;}
      out.push(ind+m[1]+' '+(m[2]||!WORD.test(disp)?'"'+disp+'"':disp)+(alias?' as '+alias:'')+m[5]);return;
    }
    if(/^ref\s+over\s+[^:]+$/i.test(t)){inRef=true;out.push(ind+'ref over '+t.replace(/^ref\s+over\s+/i,'').split(/\s*,\s*/).map(Q).join(', '));return;}
    if(m=t.match(/^ref\s+over\s+(.+?)\s*:\s*(.+)$/i)){out.push(ind+'ref over '+m[1].split(/\s*,\s*/).map(Q).join(', ')+' : '+m[2]);return;}
    if(m=t.match(/^note\s+(over|left\s+of|right\s+of)\s+(.+?)(\s*:\s*(.*))?$/i)){
      if(m[3]==null)inNote=true;
      out.push(ind+'note '+m[1].replace(/\s+/g,' ')+' '+m[2].split(/\s*,\s*/).map(Q).join(', ')+(m[3]!=null?' : '+m[4]:''));return;
    }
    if(m=t.match(/^(activate|deactivate)\s+(?:"([^"]+)"|(\S+))(.*)$/i)){out.push(ind+m[1]+' '+Q(m[2]?'"'+m[2]+'"':m[3])+m[4]);return;}
    if(m=t.match(/^(.+?)\s*(-->>|--\)|-->|->>|-\)|->)\s*([^:]+?)\s*(?::\s*(.*))?$/)){
      out.push(ind+endp(m[1])+' '+arrowOf(m[2])+' '+endp(m[3])+(m[4]!=null?': '+bizTech(m[4]):''));return;
    }
    out.push(raw);
  });
  out.push('@enduml');
  return out.join('\n');
}
// ── Библиотека sub-flows (ref) ────────────────────────────────
const SEQ_LIB_KEY='raptor_seq_library';
function seqLibLoad(){try{return JSON.parse(localStorage.getItem(SEQ_LIB_KEY)||'[]');}catch{return [];}}
function _seqLibSave(lib){localStorage.setItem(SEQ_LIB_KEY,JSON.stringify(lib));}

function seqSaveAsRef(){
  const ta=document.getElementById('seq-input');
  const rawTitle=document.getElementById('seq-title').textContent.replace(/^[^\:]*:\s*/,'').trim()||tTask({ru:'Без названия',en:'Untitled'});
  const name=prompt(tTask({ru:'Название sub-flow (будет вставляться как ref):',en:'Sub-flow name (will be inserted as a ref):'}),rawTitle);
  if(!name||!name.trim())return;
  const lib=seqLibLoad();
  const ei=lib.findIndex(x=>x.name===name.trim());
  if(ei>=0)lib[ei]={name:name.trim(),text:ta.value};
  else lib.push({name:name.trim(),text:ta.value});
  _seqLibSave(lib);
  renderSeqLibPanel();
  if(typeof toast==='function')toast(tTask({ru:'Sub-flow «'+name.trim()+'» сохранён',en:'Sub-flow "'+name.trim()+'" saved'}));
}

function seqInsertRef(name){
  const ta=document.getElementById('seq-input');
  // Собираем все объявленные участники (включая actor), возвращаем alias или имя в кавычках
  const q=n=>/\s/.test(n)?`"${n}"`:n;
  const parts=ta.value.split('\n')
    .map(l=>{const m=l.match(/^(?:actor|participant|database|queue|boundary)\s+(?:"([^"]+)"|(\S+))(?:\s+as\s+(\S+))?/i);if(!m)return null;const raw=m[3]||m[2]||m[1];return q(raw);})
    .filter(Boolean);
  const over=parts.length>=2?parts[0]+', '+parts[parts.length-1]:parts[0]||tTask({ru:'Участник',en:'Participant'});
  seqInsert('\nref over '+over+': '+name);
}

function seqDeleteRef(name){
  if(!confirm(tTask({ru:'Удалить sub-flow «'+name+'»?',en:'Delete sub-flow "'+name+'"?'})))return;
  _seqLibSave(seqLibLoad().filter(x=>x.name!==name));
  renderSeqLibPanel();
}

function seqOpenRef(name){
  const item=seqLibLoad().find(x=>x.name===name);if(!item)return;
  SEQ_ACTOR=null;SEQ_SCEN=null;
  document.getElementById('seq-title').textContent='📎 Sub-flow: '+item.name;
  document.getElementById('seq-input').value=item.text;
  renderSeq();
}

function renderSeqLibPanel(){
  const panel=document.getElementById('seq-lib-panel');if(!panel)return;
  const lib=seqLibLoad();
  if(!lib.length){panel.innerHTML='<span style="font-size:10px;color:var(--txt2);font-style:italic">'+tTask({ru:'нет — нажми «Сохранить sub-flow»',en:'none — click "Save sub-flow"'})+'</span>';return;}
  panel.innerHTML=lib.map(x=>`<span style="display:inline-flex;align-items:center;gap:2px;background:#1e2235;border:1px solid #3d4468;border-radius:4px;padding:1px 3px 1px 7px;font-size:10.5px">
    <span onclick="seqOpenRef(${escJs(x.name)})" style="cursor:pointer;color:#c0caf5" title="${tTask({ru:'Открыть',en:'Open'})}">${seqEsc(x.name)}</span>
    <button class="btn" onclick="seqInsertRef(${escJs(x.name)})" title="${tTask({ru:'Вставить ref в текущую диаграмму',en:'Insert ref into the current diagram'})}" style="padding:0 4px;font-size:10px;margin-left:2px">ref ↩</button>
    <button class="btn" onclick="seqDeleteRef(${escJs(x.name)})" style="padding:0 3px;font-size:10px;color:#f7768e">✕</button>
  </span>`).join('');
}

function seqCopyPlantUML(){
  const src=document.getElementById('seq-input');if(!src)return;
  const txt=seqToPlantUML(src.value);
  const done=()=>toast('📋 PlantUML скопирован — вставляй в Confluence или plantuml.com');
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,()=>prompt('Скопируй вручную:',txt));
  else prompt('Скопируй вручную:',txt);
}
