// BROKER-INSPECTOR — живой инспектор брокера (Kafka/RabbitMQ/NATS/Queue)
// Клик на брокер во время симуляции → панель с топологией + live данные.
// Симуляция НЕ останавливается. Данные обновляются каждые 500мс.
// Цвета инспектора — из токенов theme.css (--bi-*), чтобы тема была в одном месте.
const _BIC_FALLBACK={bg:'#ffffff',panel:'#eef0f3',line:'#a7aeb8',txt:'#14171c',txt2:'#4c5462',txt3:'#7a828e',blue:'#2457c5',green:'#25883a',red:'#c4262f',amber:'#a86a00',purple:'#7a36b8',orange:'#d0660f',cyan:'#147fa6',teal:'#17807f'};
let _bicCache=null;
const BIC=new Proxy({},{get:(_,k)=>{if(!_bicCache){_bicCache={};const cs=(typeof getComputedStyle==='function'&&typeof document!=='undefined')?getComputedStyle(document.documentElement):null;
  for(const n in _BIC_FALLBACK){const v=cs&&cs.getPropertyValue('--bi-'+n).trim();_bicCache[n]=/^#[0-9a-fA-F]{6}$/.test(v||'')?v:_BIC_FALLBACK[n];}}
  return _bicCache[k];}});

let _biTimer = null;
let _biBlockId = null;

function openBrokerInspector(blockId) {
  const b = gb(blockId); if (!b) return;
  const cat = BASE[b.type]?.cat;
  if (cat !== 'broker' && cat !== 'queue') return;

  _biBlockId = blockId;
  const name = b.customLabel || EL[b.type]?.lbl;
  const typeIcon = { kafka:'📨', rabbitmq:'🐇', nats:'⚡', queue:'📋' }[b.type] || '📦';

  // Пре-инициализируем состояние — чтобы структура была видна до запуска симуляции
  if (!BROKER_STATE[blockId]) initBrokerState(b);

  $('bi-title').textContent = typeIcon + ' ' + name;
  // Kafka: топология живая и широкая (брокеры → топики → партиции → группы → консьюмеры)
  const leftCol = $('bi-topology') && $('bi-topology').parentElement && $('bi-topology').parentElement.parentElement;
  if (leftCol) leftCol.style.width = b.type === 'kafka' ? '58%' : '42%';
  const topoWrap = $('bi-topology') && $('bi-topology').parentElement;
  if (topoWrap) { topoWrap.style.maxHeight = b.type === 'kafka' ? '64vh' : ''; topoWrap.style.overflowY = b.type === 'kafka' ? 'auto' : ''; }
  const modalBox = leftCol && leftCol.parentElement && leftCol.parentElement.parentElement;
  if (modalBox && modalBox.parentElement && modalBox.parentElement.id === 'broker-modal') modalBox.style.width = b.type === 'kafka' ? '1240px' : '900px';
  $('bi-topology').innerHTML = b.type === 'kafka' ? renderKafkaTopologySVG(b) : renderBrokerTopologySVG(b);
  $('bi-rationale').innerHTML = generateBrokerRationale(b);
  $('bi-settings').innerHTML = renderBrokerSettings(b);

  $('broker-modal').style.display = 'flex';

  // Сразу и потом каждые 500мс
  refreshBrokerInspector();
  if (_biTimer) clearInterval(_biTimer);
  _biTimer = setInterval(refreshBrokerInspector, 500);
}

function closeBrokerInspector() {
  if (_biTimer) { clearInterval(_biTimer); _biTimer = null; }
  _biBlockId = null;
  $('broker-modal').style.display = 'none';
}

function refreshBrokerInspector() {
  if (!_biBlockId) return;
  const b = gb(_biBlockId);
  if (b && b.type === 'kafka') {
    $('bi-topology').innerHTML = renderKafkaTopologySVG(b);
    $('bi-live').innerHTML = renderKafkaLive(b);
    return;
  }
  $('bi-live').innerHTML = renderBrokerLiveData(_biBlockId);
}

// ── SVG: кто пишет → партиции/очередь → кто читает ─────────────
function renderBrokerTopologySVG(b) {
  const producers = S.conns.filter(c => c.to === b.id).map(c => gb(c.from)).filter(Boolean);
  const consumers = S.conns.filter(c => c.from === b.id).map(c => gb(c.to)).filter(Boolean);
  const s = b.settings || {};

  const W = 400;
  const rowH = 34;
  const rows = Math.max(producers.length, consumers.length, 1);
  const H = Math.max(160, rows * rowH + 60);
  const midX = W / 2, prodX = 56, consX = W - 56;

  const prodY = i => (H / (producers.length + 1)) * (i + 1);
  const consY = i => (H / (consumers.length + 1)) * (i + 1);
  const centerY = H / 2;

  // ── Центральный узел ──
  let centerSvg = '';
  if (b.type === 'kafka') {
    const parts = s.partitions || 3;
    const ph = Math.min(26, (H - 50) / parts);
    const totalPH = ph * parts;
    const startY = centerY - totalPH / 2;
    for (let i = 0; i < parts; i++) {
      const py = startY + i * ph + ph / 2;
      centerSvg += `<rect x="${midX-30}" y="${py - ph/2 + 2}" width="60" height="${ph-4}" rx="3"
        fill="${BIC.bg}" stroke="${BIC.blue}" stroke-width="1.2"/>
        <text x="${midX}" y="${py+4}" text-anchor="middle" font-size="9" fill="${BIC.blue}">P${i}</text>`;
    }
    centerSvg += `<text x="${midX}" y="${startY - 8}" text-anchor="middle" font-size="9" fill="${BIC.txt2}">${t('bi_partitions')}</text>`;
  } else if (b.type === 'rabbitmq') {
    const ex = s.exchange || 'direct';
    const exShort = { direct:'direct', fanout:'fanout', topic:'topic.*' }[ex] || ex;
    centerSvg = `<rect x="${midX-38}" y="${centerY-22}" width="76" height="44" rx="7"
      fill="${BIC.bg}" stroke="${BIC.orange}" stroke-width="1.5"/>
      <text x="${midX}" y="${centerY-7}" text-anchor="middle" font-size="9" fill="${BIC.orange}">Exchange</text>
      <text x="${midX}" y="${centerY+8}" text-anchor="middle" font-size="10" fill="${BIC.amber}" font-weight="700">${exShort}</text>`;
  } else {
    const col = b.type === 'nats' ? BIC.green : BIC.purple;
    const lbl = b.type === 'nats' ? 'NATS' : 'Queue';
    centerSvg = `<rect x="${midX-32}" y="${centerY-18}" width="64" height="36" rx="6"
      fill="${BIC.bg}" stroke="${col}" stroke-width="1.5"/>
      <text x="${midX}" y="${centerY+6}" text-anchor="middle" font-size="10" fill="${col}" font-weight="700">${lbl}</text>`;
  }

  // ── Соединительные линии ──
  let lines = '';
  producers.forEach((_, i) => {
    lines += `<line x1="${prodX+30}" y1="${prodY(i)}" x2="${midX-38}" y2="${centerY}"
      stroke="${BIC.blue}55" stroke-width="1.3" stroke-dasharray="5,3"/>
      <polygon points="${midX-38},${centerY} ${midX-46},${centerY-4} ${midX-46},${centerY+4}"
      fill="${BIC.blue}55"/>`;
  });
  consumers.forEach((_, i) => {
    lines += `<line x1="${midX+38}" y1="${centerY}" x2="${consX-30}" y2="${consY(i)}"
      stroke="${BIC.green}55" stroke-width="1.3" stroke-dasharray="5,3"/>
      <polygon points="${consX-30},${consY(i)} ${consX-38},${consY(i)-4} ${consX-38},${consY(i)+4}"
      fill="${BIC.green}55"/>`;
  });

  // ── Блоки продюсеров ──
  let prodSvg = '';
  if (producers.length) {
    prodSvg += `<text x="${prodX}" y="14" text-anchor="middle" font-size="9" fill="${BIC.txt2}">${t('bi_producers')}</text>`;
  }
  producers.forEach((p, i) => {
    const lbl = esc((p.customLabel || EL[p.type]?.lbl || p.id).slice(0, 11));
    prodSvg += `<rect x="${prodX-30}" y="${prodY(i)-14}" width="60" height="28" rx="5"
      fill="${BIC.panel}" stroke="${BIC.line}" stroke-width="1"/>
      <text x="${prodX}" y="${prodY(i)+5}" text-anchor="middle" font-size="9" fill="${BIC.txt}">${lbl}</text>`;
  });

  // ── Блоки консьюмеров ──
  let consSvg = '';
  if (consumers.length) {
    consSvg += `<text x="${consX}" y="14" text-anchor="middle" font-size="9" fill="${BIC.txt2}">${t('bi_consumers')}</text>`;
  }
  consumers.forEach((c, i) => {
    const lbl = esc((c.customLabel || EL[c.type]?.lbl || c.id).slice(0, 11));
    consSvg += `<rect x="${consX-30}" y="${consY(i)-14}" width="60" height="28" rx="5"
      fill="${BIC.panel}" stroke="${BIC.line}" stroke-width="1"/>
      <text x="${consX}" y="${consY(i)+5}" text-anchor="middle" font-size="9" fill="${BIC.txt}">${lbl}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;max-height:220px">
    ${lines}${centerSvg}${prodSvg}${consSvg}
  </svg>`;
}

// ── Live данные из BROKER_STATE (500мс) ─────────────────────────
function renderBrokerLiveData(blockId) {
  const b = gb(blockId); if (!b) return '';
  const state = BROKER_STATE[blockId];

  const isEmpty = !state ||
    (!Object.keys(state.topics || {}).length &&
     !Object.keys(state.queues || {}).length);

  if (isEmpty) {
    return `<div style="color:${BIC.txt2};font-size:12px;text-align:center;padding:20px 0">
      ${t('bi_run_to_see')}
    </div>`;
  }

  // Баннер "симуляция не запущена" если структура есть, но сообщений ещё не было
  let simIdleBanner = '';
  if (!state.totalProduced) {
    simIdleBanner = `<div style="background:${BIC.blue}1a;border:1px solid ${BIC.blue}44;padding:7px 12px;margin-bottom:12px;font-size:11px;color:${BIC.txt2}">
      ${t('bi_structure_ready')}
    </div>`;
  }

  let html = simIdleBanner;

  // ── Счётчики ──
  const dlqN = state.dlq?.length || 0;
  const dlqCol = dlqN ? BIC.red : BIC.txt2;
  const lag = calcTotalLag(state);
  const lagCol = lag > 100 ? BIC.red : lag > 10 ? BIC.amber : BIC.green;

  html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px">
    <div class="bi-stat"><div class="bi-sl">${t('bi_published')}</div><div class="bi-sv" style="color:${BIC.blue}">${state.totalProduced}</div></div>
    <div class="bi-stat"><div class="bi-sl">${t('bi_consumed')}</div><div class="bi-sv" style="color:${BIC.green}">${state.totalConsumed}</div></div>
    <div class="bi-stat"><div class="bi-sl">${t('bi_lag')}</div><div class="bi-sv" style="color:${lagCol}">${lag}</div></div>
    <div class="bi-stat"><div class="bi-sl">${t('bi_dlq')}</div><div class="bi-sv" style="color:${dlqCol}">${dlqN}</div></div>
  </div>`;

  // ── NATS потери ──
  if (state.lostCount) {
    html += `<div style="background:${BIC.red}1a;border-left:2px solid ${BIC.red};border-radius:5px;padding:7px 10px;margin-bottom:10px;font-size:11px;color:${BIC.red}">
      ⚠ ${tTask({ru:`Потеряно ${state.lostCount} сообщ. — NATS core без JetStream не хранит сообщения`, en:`Lost ${state.lostCount} msg — NATS core without JetStream doesn't store messages`})}
    </div>`;
  }

  // ── Kafka: топики + партиции + consumer groups ──
  if (b.type === 'kafka') {
    Object.entries(state.topics || {}).forEach(([topicName, parts]) => {
      const total = parts.reduce((a, p) => a + p.messages.length, 0);
      const maxMsg = Math.max(...parts.map(p => p.messages.length), 1);

      html += `<div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:${BIC.purple};margin-bottom:7px">
          topic: <span style="color:${BIC.txt}">${esc(topicName)}</span>
          <span style="font-weight:400;color:${BIC.txt2};margin-left:6px">${tTask({ru:`${total} сообщ. всего`, en:`${total} msg total`})}</span>
        </div>`;

      // Прогрессбары партиций
      parts.forEach((p, i) => {
        const fill = Math.round((p.messages.length / maxMsg) * 100);
        const barCol = fill > 80 ? BIC.red : fill > 50 ? BIC.amber : BIC.blue;
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <div style="font-size:10px;color:${BIC.txt2};width:24px;flex-shrink:0">P${i}</div>
          <div style="flex:1;height:14px;background:${BIC.bg};border-radius:3px;border:1px solid ${BIC.line};overflow:hidden">
            <div style="height:100%;width:${fill}%;background:${barCol};border-radius:2px;transition:width .3s"></div>
          </div>
          <div style="font-size:10px;color:${BIC.txt};width:52px;text-align:right;flex-shrink:0">${p.messages.length} msg</div>
        </div>`;
      });

      // Consumer groups
      const groups = Object.entries(state.consumerGroups || {})
        .filter(([, g]) => g.topics && topicName in g.topics);

      if (groups.length) {
        html += `<div style="margin-top:10px">
          <div style="font-size:10.5px;font-weight:700;color:${BIC.purple};margin-bottom:5px">${t('bi_consumer_groups')}</div>`;
        groups.forEach(([gid, grp]) => {
          const offs = grp.topics?.[topicName] || {};
          const lag = parts.reduce((a, p, i) => a + Math.max(0, p.messages.length - (offs[i] || 0)), 0);
          const lagCol = lag > 100 ? BIC.red : lag > 10 ? BIC.amber : BIC.green;
          const pct = total > 0 ? Math.round(((total - lag) / total) * 100) : 100;

          // Offsets по партициям
          const offsetDetail = parts.map((p, i) =>
            `<span style="color:${BIC.txt2}">P${i}:</span><span style="color:${BIC.blue}"> ${offs[i]||0}/${p.messages.length}</span>`
          ).join(' &nbsp;');

          html += `<div style="background:${BIC.bg};border-radius:6px;padding:8px 10px;margin-bottom:6px;border:1px solid ${BIC.line}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
              <div style="font-size:10.5px;font-weight:700;color:${BIC.txt}">${esc(gid)}</div>
              <div style="font-size:10px;color:${lagCol}">lag: <b>${lag}</b></div>
            </div>
            <div style="height:7px;background:${BIC.panel};border-radius:3px;overflow:hidden;margin-bottom:5px">
              <div style="height:100%;width:${pct}%;background:${lagCol};border-radius:3px;transition:width .3s"></div>
            </div>
            <div style="font-size:9.5px;margin-bottom:6px">${offsetDetail}</div>
            <button onclick="doReplay(${escJs(blockId)},${escJs(gid)})" style="padding:3px 10px;border:1px solid ${BIC.blue};border-radius:4px;background:${BIC.blue}1a;color:${BIC.blue};cursor:pointer;font-size:9.5px">↺ Replay</button>
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    });
  }

  // ── RabbitMQ / Queue: очереди ──
  const queues = Object.entries(state.queues || {});
  if (queues.length) {
    const maxQ = Math.max(...queues.map(([,q]) => q.length), 1);
    html += `<div style="font-size:11px;font-weight:700;color:${BIC.orange};margin-bottom:7px">${t('bi_queues')}</div>`;
    queues.forEach(([qname, msgs]) => {
      const fill = Math.round((msgs.length / maxQ) * 100);
      const barCol = fill > 80 ? BIC.red : fill > 50 ? BIC.amber : BIC.orange;
      html += `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:10.5px;color:${BIC.txt}">${esc(qname)}</div>
          <div style="font-size:10px;color:${BIC.amber}">${tTask({ru:`${msgs.length} ожидают`, en:`${msgs.length} waiting`})}</div>
        </div>
        <div style="height:12px;background:${BIC.bg};border-radius:3px;border:1px solid ${BIC.line};overflow:hidden">
          <div style="height:100%;width:${fill}%;background:${barCol};border-radius:2px;transition:width .3s"></div>
        </div>
      </div>`;
    });
  }

  // ── DLQ ──
  if (dlqN) {
    html += `<div style="margin-top:10px">
      <div style="font-size:11px;font-weight:700;color:${BIC.red};margin-bottom:5px">${t('bi_dlq_title')} (${dlqN})</div>`;
    state.dlq.slice(-5).reverse().forEach(msg => {
      html += `<div style="background:${BIC.red}1a;border-left:2px solid ${BIC.red};border-radius:4px;padding:5px 8px;margin-bottom:4px;font-size:10px;color:${BIC.red}">
        ${esc(msg.failReason)}: ${esc(JSON.stringify(msg.body || {}).slice(0, 60))}
      </div>`;
    });
    html += `</div>`;
  }

  return html;
}

function calcTotalLag(state) {
  if (!state) return 0;
  let lag = 0;
  Object.entries(state.consumerGroups || {}).forEach(([gid, grp]) => {
    Object.entries(grp.topics || {}).forEach(([topic, offs]) => {
      const parts = state.topics?.[topic];
      if (!parts) return;
      lag += parts.reduce((a, p, i) => a + Math.max(0, (p.hw != null ? p.hw : p.messages.length) - Math.max(offs[i] || 0, p.base || 0)), 0);
    });
  });
  // Для RabbitMQ/Queue: сумма pending
  Object.values(state.queues || {}).forEach(q => { lag += q.length; });
  return lag;
}

// ── Настройки ────────────────────────────────────────────────────
function renderBrokerSettings(b) {
  const defs = SETTINGS_DEF[b.type] || [];
  if (!defs.length) return '';
  const s = b.settings || {};

  let html = `<div style="font-size:11px;font-weight:700;color:${BIC.blue};margin-bottom:8px">${t('bi_settings')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 14px">`;

  defs.forEach(d => {
    // topic_name: без явной настройки показываем фактическое имя топика (из подписи блока), как в заголовке
    const v = (d.k === 'topic_name' && !s[d.k] && typeof kTopicName === 'function') ? kTopicName(b)
      : (s[d.k] !== undefined ? s[d.k] : d.def);
    const hint = d.hint ? `title="${d.hint.replace(/"/g, "'")}"` : '';

    if (d.type === 'txt') {
      html += `<div ${hint} style="grid-column:1/-1">
        <div style="font-size:9.5px;color:${BIC.txt2};margin-bottom:3px">${d.lbl}</div>
        <input type="text" value="${esc(v)}" placeholder="${esc(d.def||'')}"
          oninput="biChangeSetting(${escJs(b.id)},'${d.k}',this.value)"
          style="width:100%;padding:5px 7px;background:${BIC.bg};border:1px solid ${BIC.line};border-radius:5px;color:${BIC.txt};font-size:10.5px;box-sizing:border-box;font-family:inherit"/>
      </div>`;
    } else if (d.type === 'sel') {
      html += `<div ${hint}>
        <div style="font-size:9.5px;color:${BIC.txt2};margin-bottom:3px">${d.lbl}</div>
        <select onchange="biChangeSetting(${escJs(b.id)},'${d.k}',this.value)"
          style="width:100%;padding:5px 7px;background:${BIC.bg};border:1px solid ${BIC.line};border-radius:5px;color:${BIC.txt};font-size:10.5px;cursor:pointer;font-family:inherit">
          ${d.opts.map(o => `<option value="${o}"${v===o?' selected':''}>${o}</option>`).join('')}
        </select>
      </div>`;
    } else if (d.type === 'num') {
      html += `<div ${hint}>
        <div style="font-size:9.5px;color:${BIC.txt2};margin-bottom:3px">${d.lbl}</div>
        <input type="number" value="${v}" min="${d.min||1}" max="${d.max||200}"
          onchange="biChangeSetting(${escJs(b.id)},'${d.k}',+this.value)"
          style="width:100%;padding:5px 7px;background:${BIC.bg};border:1px solid ${BIC.line};border-radius:5px;color:${BIC.txt};font-size:10.5px;box-sizing:border-box"/>
      </div>`;
    } else if (d.type === 'tog') {
      html += `<div style="display:flex;align-items:center;gap:8px;padding-top:14px" ${hint}>
        <input type="checkbox" id="bi-tog-${d.k}"${v?' checked':''} onchange="biChangeSetting(${escJs(b.id)},'${d.k}',this.checked)" style="cursor:pointer;width:14px;height:14px"/>
        <label for="bi-tog-${d.k}" style="font-size:10.5px;color:${BIC.txt};cursor:pointer">${d.lbl}</label>
      </div>`;
    }
  });

  html += `</div>`;
  return html;
}

function biChangeSetting(blockId, key, value) {
  const b = gb(blockId); if (!b) return;
  if (!b.settings) b.settings = {};
  b.settings[key] = value;
  // Сбрасываем и пересоздаём state — чтобы новые партиции/exchange отразились немедленно
  delete BROKER_STATE[blockId];
  initBrokerState(b);
  pushHist();
  analyze();
  $('bi-settings').innerHTML = renderBrokerSettings(b);
  $('bi-topology').innerHTML = b.type === 'kafka' ? renderKafkaTopologySVG(b) : renderBrokerTopologySVG(b);
  $('bi-rationale').innerHTML = generateBrokerRationale(b);
  refreshBrokerInspector();
}

// ── Обоснование для БА ───────────────────────────────────────────
function generateBrokerRationale(b) {
  const s = b.settings || {};
  const producers = S.conns.filter(c => c.to === b.id).map(c => gb(c.from)).filter(Boolean);
  const consumers = S.conns.filter(c => c.from === b.id).map(c => gb(c.to)).filter(Boolean);
  const lines = [];

  if (b.type === 'kafka') {
    const c = Object.assign({}, kafkaCfg(b)); c.topic = esc(c.topic); // имя топика — пользовательская строка → в HTML только экранированной
    const parts = c.partitions, delivery = c.delivery, repl = c.rf;
    const en = CURR_LANG === 'en';
    lines.push(tTask({ru:`Топик «${c.topic}»: ${parts} партиц${parts===1?'ия':parts<5?'ии':'ий'} × RF=${repl} на ${c.brokers} брокерах. Лидер каждой партиции — на своём брокере, реплики — на соседних.`, en:`Topic "${c.topic}": ${parts} partition${parts===1?'':'s'} × RF=${repl} on ${c.brokers} brokers. Each partition's leader sits on its own broker, replicas on the neighbours.`}));
    consumers.forEach(cb => {
      const n = kInstances(cb), active = Math.min(n, parts), gid = esc(kGroupId(cb));
      lines.push(tTask({ru:`Группа ${gid}: ${n} консьюмер${n===1?'':n<5?'а':'ов'} (реплики сервиса) → активны ${active}${n>parts?`, ⚠ ${n-parts} idle (партиций меньше, чем консьюмеров)`:''}.`, en:`Group ${gid}: ${n} consumer${n===1?'':'s'} (service replicas) → ${active} active${n>parts?`, ⚠ ${n-parts} idle (fewer partitions than consumers)`:''}.`}));
    });
    if (consumers.length > 1) lines.push(tTask({ru:`${consumers.length} группы читают топик НЕЗАВИСИМО — каждое событие получит каждая группа (pub/sub), а внутри группы — один консьюмер (очередь).`, en:`${consumers.length} groups read the topic INDEPENDENTLY — every group gets every event (pub/sub); within a group only one consumer does (queue).`}));
    const asg = {range:{ru:'range — подряд идущие партиции, первые консьюмеры получают «лишние»', en:'range — contiguous partitions, the first consumers get the extras'}, roundrobin:{ru:'roundrobin — по кругу, ровнее', en:'roundrobin — round robin, more even'}, 'cooperative-sticky':{ru:'cooperative-sticky — при ребалансе переезжают только нужные партиции, остальные продолжают читать', en:'cooperative-sticky — on rebalance only the needed partitions move, the rest keep consuming'}}[c.assignor];
    if (asg) lines.push(tTask({ru:'Назначение: '+asg.ru+'.', en:'Assignment: '+asg.en+'.'}));
    if (c.keyStrategy === 'hot-key') lines.push(tTask({ru:'⚠ Горячий ключ: ~55% сообщений в ОДНОЙ партиции → её консьюмер перегружен, масштабирование группы не помогает. Лечится солью ключа или пересмотром ключа.', en:'⚠ Hot key: ~55% of messages land in ONE partition → its consumer is overloaded and scaling the group does not help. Fix with key salting or a different key.'}));
    else if (c.keyStrategy === 'null') lines.push(tTask({ru:'Ключ null: равномерно по партициям, но без гарантии порядка для сущности.', en:'Null key: even spread, but no per-entity ordering.'}));
    else lines.push(tTask({ru:'Ключ = id сущности: hash(key) % партиций → порядок событий одной сущности сохраняется.', en:'Key = entity id: hash(key) % partitions → per-entity ordering is preserved.'}));
    const wTol = c.acks === 'all' ? Math.max(0, repl - c.minIsr) : repl - 1;
    lines.push(tTask({ru:`Отказоустойчивость: acks=${c.acks}, min.insync=${c.minIsr} → запись переживёт падение ${wTol} брокер${wTol===1?'а':'ов'}, чтение — ${repl-1}.`, en:`Fault tolerance: acks=${c.acks}, min.insync=${c.minIsr} → writes survive ${wTol} broker failure${wTol===1?'':'s'}, reads survive ${repl-1}.`}));
    if (repl === 1) lines.push(tTask({ru:'⚠ RF=1: падение брокера = партиция offline и потеря данных.', en:'⚠ RF=1: a broker failure means an offline partition and data loss.'}));
    const delivMap = en
      ? {'at-most-once':'possible loss','at-least-once':'no loss, duplicates possible','exactly-once':'exactly once (−50% RPS)'}
      : {'at-most-once':'возможны потери','at-least-once':'без потерь, дубли допустимы','exactly-once':'ровно один раз (−50% RPS)'};
    lines.push(tTask({ru:`Доставка: ${delivery} — ${delivMap[delivery]||delivery}.`, en:`Delivery: ${delivery} — ${delivMap[delivery]||delivery}.`}));
    lines.push(c.retryDlq
      ? tTask({ru:`Ошибки консьюмера → ${c.topic}.&lt;группа&gt;.retry — свой retry-топик у каждой группы (backoff 1→2→4 тика) → после ${c.maxRetries} попыток ${c.topic}.dlq.`, en:`Consumer errors → ${c.topic}.&lt;group&gt;.retry — a retry topic per group (backoff 1→2→4 ticks) → after ${c.maxRetries} attempts ${c.topic}.dlq.`})
      : tTask({ru:'⚠ Без DLQ: упавшее сообщение не коммитится и доставляется снова (дубли, poison pill блокирует партицию).', en:'⚠ No DLQ: a failed message is not committed and is redelivered (duplicates, a poison pill blocks the partition).'}));
    lines.push(c.cleanup === 'compact'
      ? tTask({ru:'cleanup=compact: хранится последнее значение каждого ключа — топик как таблица состояния.', en:'cleanup=compact: the latest value per key is kept — the topic works as a state table.'})
      : tTask({ru:`retention: ${c.retention} msg/партиция — не прочитанное вовремя удаляется (лаг > retention = потеря).`, en:`retention: ${c.retention} msg/partition — anything not read in time is deleted (lag > retention = loss).`}));
    if (producers.length) lines.push(tTask({ru:`Продюсеры: ${producers.map(p=>bLabel(p)).join(', ')}.`, en:`Producers: ${producers.map(p=>bLabel(p)).join(', ')}.`}));
  }

  if (b.type === 'rabbitmq') {
    const ex = s.exchange || 'direct';
    const exDesc = CURR_LANG === 'en'
      ? ({direct:'message → single queue by routing key', fanout:`copy → each of ${consumers.length} consumers (broadcast)`, topic:'routing by pattern (order.*)'}[ex] || ex)
      : ({direct:'сообщение → одна очередь по routing key', fanout:`копия → каждый из ${consumers.length} консьюмеров (broadcast)`, topic:'маршрутизация по паттерну (order.*)'}[ex] || ex);
    lines.push(tTask({ru:`Exchange: ${ex} — ${exDesc}.`, en:`Exchange: ${ex} — ${exDesc}.`}));
    if (s.mirrored) lines.push(tTask({ru:'Mirrored Queues: зеркалирование на все ноды (−30% скорости, надёжнее).', en:'Mirrored Queues: mirrored to all nodes (−30% speed, more reliable).'}));
    if (s.ack === 'manual') lines.push(tTask({ru:'Ручное ACK: сообщение не удаляется до подтверждения консьюмером.', en:'Manual ACK: message isn\'t removed until acknowledged by the consumer.'}));
  }

  if (b.type === 'nats') {
    if (!s.jetstream) {
      lines.push(tTask({ru:'NATS core: at-most-once. Нет подписчика → сообщение ТЕРЯЕТСЯ.', en:'NATS core: at-most-once. No subscriber → the message is LOST.'}));
      lines.push(tTask({ru:'Для персистентности включи JetStream (семантика Kafka).', en:'Enable JetStream for persistence (Kafka-like semantics).'}));
    } else {
      lines.push(tTask({ru:'JetStream: персистентность включена, at-least-once гарантирована.', en:'JetStream: persistence enabled, at-least-once guaranteed.'}));
    }
  }

  if (b.type === 'queue') {
    const w = s.workers || 1;
    lines.push(tTask({ru:`${w} worker${w===1?'':w<5?'а':'ов'} обрабатывают задачи параллельно.`, en:`${w} worker${w===1?'':'s'} process tasks in parallel.`}));
    lines.push(tTask({ru:'Продюсер не ждёт результата — полная асинхронность.', en:'The producer doesn\'t wait for a result — fully async.'}));
  }

  if (!lines.length) return '';

  return lines.map(l => {
    const warn = l.startsWith('⚠');
    const col = warn ? BIC.amber : BIC.txt2;
    return `<div style="font-size:10.5px;color:${col};margin-bottom:5px;line-height:1.5">${l}</div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// KAFKA: живая топология брокеры → топики → партиции → группы → консьюмеры
// ══════════════════════════════════════════════════════════════
const KAFKA_GROUP_COLORS = [BIC.green, BIC.cyan, BIC.amber, BIC.purple, BIC.orange, BIC.teal, BIC.red];
function _kEsc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function _kShort(x, n) { x = String(x || ''); return x.length > n ? x.slice(0, n - 1) + '…' : x; }

function renderKafkaTopologySVG(b) {
  if (!BROKER_STATE[b.id]) initBrokerState(b);
  const st = BROKER_STATE[b.id];
  if (st && st.kafka) kafkaSyncGroups(b, st);
  const d = getBrokerInspectorData(b.id);
  if (!d || !d.kafka) return renderBrokerTopologySVG(b);
  const c = d.cfg;
  const W = 600;
  const producers = S.conns.filter(x => x.to === b.id).map(x => gb(x.from)).filter(Boolean);
  const topics = Object.entries(d.topics).sort((a, z) => ({main:0, retry:1, dlq:2}[a[1].kind] - {main:0, retry:1, dlq:2}[z[1].kind]));
  const groups = Object.entries(d.consumerGroups).filter(([, g]) => g.members && g.members.length || g.blockId);
  const ROW = 19, TOP = 58;
  // ── позиции партиций
  let y = TOP; const partY = {}; const topicBox = [];
  topics.forEach(([tn, tp]) => {
    const y0 = y; y += 16;
    tp.partitions.forEach(p => { partY[tn + '#' + p.index] = y + ROW / 2; y += ROW; });
    topicBox.push({tn, tp, y0, y1: y}); y += 8;
  });
  const hTopics = y;
  // ── позиции консьюмеров
  let gy = TOP; const memY = {}; const grpBox = [];
  groups.forEach(([gid, g], gi) => {
    const y0 = gy; gy += 18;
    const mem = g.members.length ? g.members : [];
    mem.forEach(m => { memY[gid + '|' + m] = gy + 8; gy += 18; });
    if (!mem.length) gy += 16;
    grpBox.push({gid, g, y0, y1: gy, col: KAFKA_GROUP_COLORS[gi % KAFKA_GROUP_COLORS.length]}); gy += 8;
  });
  const H = Math.max(hTopics, gy, TOP + producers.length * 34) + 8;
  let svg = '';
  // ── Брокеры (клик = уронить/поднять)
  const bw = Math.min(92, (W - 20) / d.brokers.length - 8);
  const bx0 = (W - (bw + 8) * d.brokers.length + 8) / 2;
  d.brokers.forEach((br, i) => {
    const x = bx0 + i * (bw + 8);
    const leaders = topics.reduce((a, [, tp]) => a + tp.partitions.filter(p => p.leader === i).length, 0);
    const col = br.up ? BIC.green : BIC.red;
    svg += `<g style="cursor:pointer" onclick="biToggleBroker('${b.id}',${i})"><title>${br.up ? tTask({ru:'Клик — уронить брокер (хаос)', en:'Click — kill broker (chaos)'}) : tTask({ru:'Клик — поднять брокер', en:'Click — restart broker'})}</title>
      <rect x="${x}" y="6" width="${bw}" height="30" rx="5" fill="${col}1f" stroke="${col}" stroke-width="1.3" ${br.up ? '' : 'stroke-dasharray="4,2"'}/>
      <text x="${x + bw / 2}" y="19" text-anchor="middle" font-size="9.5" font-weight="700" fill="${col}">${br.up ? '🖥' : '💥'} broker-${i}</text>
      <text x="${x + bw / 2}" y="31" text-anchor="middle" font-size="8.5" fill="${BIC.txt2}">${br.up ? tTask({ru:`лидер ${leaders} парт.`, en:`leads ${leaders}`}) : 'DOWN'}</text></g>`;
  });
  svg += `<text x="8" y="50" font-size="8.5" fill="${BIC.txt2}">${tTask({ru:'Продюсеры', en:'Producers'})}</text>
    <text x="118" y="50" font-size="8.5" fill="${BIC.txt2}">${tTask({ru:'Топики · партиции (лидер / ISR / лог)', en:'Topics · partitions (leader / ISR / log)'})}</text>
    <text x="420" y="50" font-size="8.5" fill="${BIC.txt2}">${tTask({ru:'Группы → консьюмеры', en:'Groups → consumers'})}</text>`;
  // ── Продюсеры
  const mainTop = topicBox[0];
  producers.forEach((p, i) => {
    const py = TOP + 6 + i * 34;
    svg += `<rect x="6" y="${py}" width="84" height="24" rx="5" fill="${BIC.panel}" stroke="${BIC.blue}" stroke-width="1"/>
      <text x="48" y="${py + 15}" text-anchor="middle" font-size="9" fill="${BIC.txt}">${_kEsc(_kShort(p.customLabel || EL[p.type]?.lbl || p.id, 14))}</text>`;
    if (mainTop) svg += `<path d="M90,${py + 12} C104,${py + 12} 104,${mainTop.y0 + 8} 116,${mainTop.y0 + 8}" fill="none" stroke="${BIC.blue}88" stroke-width="1.2" stroke-dasharray="4,2"/>`;
  });
  // ── Линии назначения партиций → консьюмеры
  grpBox.forEach(gb_ => {
    Object.entries(gb_.g.assignment || {}).forEach(([m, list]) => {
      const my = memY[gb_.gid + '|' + m]; if (my == null) return;
      list.forEach(tp => {
        const py = partY[tp.t + '#' + tp.p]; if (py == null) return;
        svg += `<path d="M372,${py} C396,${py} 396,${my} 420,${my}" fill="none" stroke="${gb_.col}" stroke-opacity="${gb_.g.rebalancing ? 0.25 : 0.6}" stroke-width="1.1" ${gb_.g.rebalancing ? 'stroke-dasharray="3,3"' : ''}/>`;
      });
    });
  });
  // ── Топики и партиции
  topicBox.forEach(({tn, tp, y0, y1}) => {
    const kindCol = tp.kind === 'dlq' ? BIC.red : tp.kind === 'retry' ? BIC.amber : BIC.purple;
    const total = tp.partitions.reduce((a, p) => a + (p.produced || 0), 0);
    const avg = total / Math.max(1, tp.partitions.length);
    svg += `<rect x="116" y="${y0}" width="258" height="${y1 - y0 + 3}" rx="6" fill="${kindCol}0d" stroke="${kindCol}66" stroke-width="1"/>
      <text x="122" y="${y0 + 11}" font-size="9.5" font-weight="700" fill="${kindCol}">${tp.kind === 'dlq' ? '☠ ' : tp.kind === 'retry' ? '↻ ' : '📨 '}${_kEsc(_kShort(tn, 30))}</text>
      <text x="368" y="${y0 + 11}" text-anchor="end" font-size="8.5" fill="${BIC.txt2}">${total} msg</text>`;
    tp.partitions.forEach(p => {
      const py = partY[tn + '#' + p.index];
      const hot = tp.partitions.length > 1 && p.produced > 20 && p.produced > avg * 1.8;
      let maxLag = 0;
      Object.values(d.consumerGroups).forEach(g => { const l = g.partLag && g.partLag[tn] ? g.partLag[tn][p.index] || 0 : 0; if (l > maxLag) maxLag = l; });
      const barX = 196, barW = 110;
      const fill = Math.min(1, p.messages / c.retention);
      const lagW = Math.min(barW * fill, barW * Math.min(1, maxLag / c.retention));
      const lagCol = maxLag > c.retention * 0.6 ? BIC.red : maxLag > 20 ? BIC.amber : BIC.green;
      svg += `<text x="122" y="${py + 3.5}" font-size="9" fill="${p.offline ? BIC.red : BIC.txt}" font-weight="700">P${p.index}${hot ? '🔥' : ''}</text>
        <text x="150" y="${py + 3.5}" font-size="8" fill="${p.offline ? BIC.red : BIC.blue}">${p.offline ? 'OFFLINE' : 'L:b' + p.leader}</text>`;
      // ISR-точки: по каждой реплике
      (p.replicas || []).forEach((r, k) => {
        const inIsr = (p.isr || []).includes(r), isL = p.leader === r;
        svg += `<circle cx="${178 + k * 5.5}" cy="${py - 4.5}" r="2.2" fill="${isL ? BIC.blue : inIsr ? BIC.green : BIC.red}"><title>b${r}: ${isL ? 'leader' : inIsr ? 'in-sync' : 'out of sync'}</title></circle>`;
      });
      svg += `<rect x="${barX}" y="${py - 6}" width="${barW}" height="12" rx="2" fill="${BIC.bg}" stroke="${hot ? BIC.orange : BIC.line}" stroke-width="${hot ? 1.4 : 1}"/>
        <rect x="${barX}" y="${py - 5}" width="${(barW * fill).toFixed(1)}" height="10" fill="${BIC.blue}44"/>
        <rect x="${(barX + barW * fill - lagW).toFixed(1)}" y="${py - 5}" width="${lagW.toFixed(1)}" height="10" fill="${lagCol}aa"/>
        <text x="${barX + barW + 4}" y="${py + 3.5}" font-size="8" fill="${maxLag ? lagCol : BIC.txt3}">${maxLag ? 'lag ' + maxLag : p.highWatermark}</text>`;
    });
  });
  // ── Группы и консьюмеры
  grpBox.forEach(({gid, g, y0, y1, col}) => {
    const gl = g.lag || 0;
    const lagCol = gl > c.retention ? BIC.red : gl > 20 ? BIC.amber : BIC.green;
    svg += `<rect x="416" y="${y0}" width="180" height="${y1 - y0}" rx="6" fill="${col}10" stroke="${col}88" stroke-width="1"/>
      <text x="422" y="${y0 + 12}" font-size="9" font-weight="700" fill="${col}">👥 ${_kEsc(_kShort(gid, 20))}</text>
      <text x="590" y="${y0 + 12}" text-anchor="end" font-size="8.5" fill="${lagCol}">${g.rebalancing ? '⟳ ' : ''}lag ${gl}</text>`;
    if (!g.members.length) svg += `<text x="424" y="${y0 + 28}" font-size="8.5" fill="${BIC.txt3}">${tTask({ru:'нет активных консьюмеров', en:'no active consumers'})}</text>`;
    g.members.forEach(m => {
      const my = memY[gid + '|' + m];
      const list = (g.assignment || {})[m] || [];
      const idle = !list.length;
      const lbl = idle ? 'idle' : list.map(tp => (tp.t.endsWith('.retry') ? 'r' : 'P') + tp.p).join(',');
      svg += `<rect x="420" y="${my - 7}" width="172" height="14" rx="3" fill="${idle ? BIC.bg : BIC.panel}" stroke="${idle ? BIC.line : col}" stroke-width="1" ${idle ? 'stroke-dasharray="3,2"' : ''}/>
        <text x="425" y="${my + 3}" font-size="8.5" fill="${idle ? BIC.txt3 : BIC.txt}">${idle ? '💤' : '⚙'} ${_kEsc(_kShort(m, 16))}</text>
        <text x="588" y="${my + 3}" text-anchor="end" font-size="8" fill="${idle ? BIC.txt3 : col}">${_kEsc(_kShort(lbl, 16))}</text>`;
    });
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:inherit">${svg}</svg>
    <div style="font-size:9px;color:${BIC.txt3};margin-top:4px">${tTask({ru:'● синий — лидер, ● зелёный — в ISR, ● красный — отстал/упал · 🔥 горячая партиция · 💤 idle-консьюмер · клик по брокеру — хаос', en:'● blue — leader, ● green — in ISR, ● red — lagging/down · 🔥 hot partition · 💤 idle consumer · click a broker — chaos'})}</div>`;
}

function renderKafkaLive(b) {
  const d = getBrokerInspectorData(b.id);
  if (!d || !d.kafka) return renderBrokerLiveData(b.id);
  const c = d.cfg;
  const lag = Object.values(d.consumerGroups).reduce((a, g) => a + (g.members && g.members.length ? g.lag : 0), 0);
  const stat = (lbl, v, col) => `<div class="bi-stat"><div class="bi-sl">${lbl}</div><div class="bi-sv" style="color:${col}">${v}</div></div>`;
  let html = '';
  if (!d.totalProduced) html += `<div style="background:${BIC.blue}1a;border:1px solid ${BIC.blue}44;padding:7px 12px;margin-bottom:10px;font-size:11px;color:${BIC.txt2}">${t('bi_structure_ready')}</div>`;
  html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px">
    ${stat(t('bi_published'), d.totalProduced, BIC.blue)}${stat(t('bi_consumed'), d.totalConsumed, BIC.green)}
    ${stat(t('bi_lag'), lag, lag > 100 ? BIC.red : lag > 10 ? BIC.amber : BIC.green)}${stat(t('bi_dlq'), d.dlqCount, d.dlqCount ? BIC.red : BIC.txt2)}
    ${stat('Retry', d.retriedCount || 0, d.retriedCount ? BIC.amber : BIC.txt2)}${stat(tTask({ru:'Истекло (retention)', en:'Expired (retention)'}), d.expiredCount || 0, d.expiredCount ? BIC.red : BIC.txt2)}
    ${stat(tTask({ru:'Отказ записи', en:'Write rejected'}), d.rejectedCount || 0, d.rejectedCount ? BIC.red : BIC.txt2)}${stat(tTask({ru:'Ребалансы', en:'Rebalances'}), d.rebalances || 0, BIC.purple)}
  </div>`;
  // ── Хаос
  const h = kafkaHealth(b);
  html += `<div style="background:${BIC.panel};border:1px solid ${BIC.line};border-radius:6px;padding:8px 10px;margin-bottom:10px">
    <div style="font-size:10.5px;font-weight:700;color:${BIC.red};margin-bottom:6px">💥 ${tTask({ru:'Хаос: падение брокера', en:'Chaos: broker failure'})}</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">
      ${d.brokers.map((br, i) => `<button onclick="biToggleBroker('${b.id}',${i})" style="padding:3px 9px;border:1px solid ${br.up ? BIC.red : BIC.green};border-radius:4px;background:${br.up ? `${BIC.red}1a` : `${BIC.green}1a`};color:${br.up ? BIC.red : BIC.green};cursor:pointer;font-size:9.5px">${br.up ? '💥 ' + tTask({ru:'уронить', en:'kill'}) : '♻ ' + tTask({ru:'поднять', en:'restart'})} b${i}</button>`).join('')}
      ${h ? `<button onclick="biResetChaos('${b.id}')" style="padding:3px 9px;border:1px solid ${BIC.blue};border-radius:4px;background:${BIC.blue}1a;color:${BIC.blue};cursor:pointer;font-size:9.5px">♻ ${tTask({ru:'поднять все', en:'restart all'})}</button>` : ''}
    </div>
    <div style="font-size:10px;color:${h ? (h.writeBlocked || h.offlineParts ? BIC.red : BIC.amber) : BIC.txt2}">${h
      ? tTask({ru:`Живых брокеров ${h.alive}/${h.brokers}. Offline партиций: ${h.offlineParts}. ISR < min.insync: ${h.underMinIsr}. ${h.writeBlocked ? 'Запись с acks=all ОТКЛОНЯЕТСЯ (NOT_ENOUGH_REPLICAS).' : h.offlineParts ? 'Часть записей не проходит (нет лидера).' : 'Лидеры переизбраны из ISR — запись идёт.'}`,
              en:`Alive brokers ${h.alive}/${h.brokers}. Offline partitions: ${h.offlineParts}. ISR < min.insync: ${h.underMinIsr}. ${h.writeBlocked ? 'acks=all writes are REJECTED (NOT_ENOUGH_REPLICAS).' : h.offlineParts ? 'Some writes fail (no leader).' : 'Leaders re-elected from ISR — writes continue.'}`})
      : tTask({ru:'Все брокеры живы. Уроните брокер, чтобы увидеть выборы лидера, сжатие ISR и отказ записи.', en:'All brokers are up. Kill a broker to see leader election, ISR shrink and write rejection.'})}</div>
  </div>`;
  // ── Группы: оценка пропускной способности (computeFlow) + live
  const an = (b.rt && b.rt.kafka && b.rt.kafka.groups) || [];
  Object.entries(d.consumerGroups).forEach(([gid, g]) => {
    if (!g.blockId && !(g.members || []).length) return;
    const a = an.find(x => x.gid === gid);
    const lagCol = g.lag > 100 ? BIC.red : g.lag > 10 ? BIC.amber : BIC.green;
    const idle = Object.values(g.assignment || {}).filter(l => !l.length).length;
    const parts = Object.entries(g.partLag || {}).map(([tn, pl]) => Object.entries(pl).map(([pi, l]) => `<span style="color:${BIC.txt2}">${tn.endsWith('.retry') ? 'r' : 'P'}${pi}:</span><span style="color:${l > 20 ? BIC.amber : BIC.blue}">${l}</span>`).join(' ')).join(' · ');
    html += `<div style="background:${BIC.bg};border-radius:6px;padding:7px 10px;margin-bottom:6px;border:1px solid ${BIC.line}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <div style="font-size:10.5px;font-weight:700;color:${BIC.txt}">👥 ${_kEsc(gid)} <span style="font-weight:400;color:${BIC.txt2}">gen ${g.generation}${g.rebalancing ? ' · ⟳ rebalance' : ''}</span></div>
        <div style="font-size:10px;color:${lagCol}">lag: <b>${g.lag}</b></div>
      </div>
      <div style="font-size:9.5px;color:${BIC.txt2};margin-bottom:3px">${(g.members || []).length} ${tTask({ru:'консьюмер(ов)', en:'consumer(s)'})}${idle ? ` · <span style="color:${BIC.amber}">${idle} idle</span>` : ''} · ${tTask({ru:'обработано', en:'consumed'})} ${g.consumed} · ${tTask({ru:'ошибок', en:'errors'})} ${g.failed}${a ? ` · ≈${a.throughput.toLocaleString()} rps${a.lagGrowth ? ` · <span style="color:${BIC.red}">${tTask({ru:'лаг растёт', en:'lag grows'})} +${a.lagGrowth.toLocaleString()} rps</span>` : ''}` : ''}</div>
      <div style="font-size:9.5px;margin-bottom:5px">${parts}</div>
      <button onclick="doReplay(${escJs(b.id)},${escJs(gid)})" style="padding:2px 9px;border:1px solid ${BIC.blue};border-radius:4px;background:${BIC.blue}1a;color:${BIC.blue};cursor:pointer;font-size:9.5px">↺ Replay</button>
    </div>`;
  });
  // ── DLQ
  if (d.dlqCount) {
    html += `<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <div style="font-size:11px;font-weight:700;color:${BIC.red}">${t('bi_dlq_title')} · ${_kEsc(c.topic)}.dlq (${d.dlqCount})</div>
      <button onclick="biRedriveDlq(${escJs(b.id)})" style="padding:2px 9px;border:1px solid ${BIC.amber};border-radius:4px;background:${BIC.amber}1a;color:${BIC.amber};cursor:pointer;font-size:9.5px">⤴ ${tTask({ru:'перезалить в топик', en:'redrive to topic'})}</button></div>`;
    d.dlq.slice(-4).reverse().forEach(m => {
      html += `<div style="background:${BIC.red}1a;border-left:2px solid ${BIC.red};border-radius:4px;padding:4px 8px;margin-bottom:3px;font-size:9.5px;color:${BIC.red}">key=${_kEsc(m.key)} · P${m.partition}@${m.offset} · ${tTask({ru:'попыток', en:'attempts'})} ${(m.attempt || 0) + 1} · ${_kEsc(m.group || '')}</div>`;
    });
    html += `</div>`;
  }
  // ── Журнал событий кластера
  const LOG_TXT = {
    rebalance: e => tTask({ru:`⟳ ребаланс ${e.gid}: ${e.members} конс. (${e.eager ? 'eager — группа стоит' : 'cooperative'})`, en:`⟳ rebalance ${e.gid}: ${e.members} cons. (${e.eager ? 'eager — group pauses' : 'cooperative'})`}),
    leader: e => tTask({ru:`👑 P${e.partition}: новый лидер b${e.leader}`, en:`👑 P${e.partition}: new leader b${e.leader}`}),
    broker_down: e => tTask({ru:`💥 broker-${e.broker} упал`, en:`💥 broker-${e.broker} down`}),
    broker_up: e => tTask({ru:`♻ broker-${e.broker} поднят, догоняет ISR`, en:`♻ broker-${e.broker} up, catching up ISR`}),
    dlq: e => tTask({ru:`☠ ${e.gid}: в DLQ`, en:`☠ ${e.gid}: to DLQ`}),
    retry: e => tTask({ru:`↻ ${e.gid}: в retry-топик`, en:`↻ ${e.gid}: to retry topic`}),
    expired: () => tTask({ru:'⌛ retention удалил непрочитанные', en:'⌛ retention deleted unread messages'}),
    rejected: e => tTask({ru:`⛔ запись отклонена: ${e.error}`, en:`⛔ write rejected: ${e.error}`}),
    lost: e => tTask({ru:`✗ ${e.gid}: потеря (at-most-once)`, en:`✗ ${e.gid}: lost (at-most-once)`}),
    redeliver: e => tTask({ru:`↺ ${e.gid}: повторная доставка (дубль)`, en:`↺ ${e.gid}: redelivery (duplicate)`}),
  };
  if (d.log && d.log.length) {
    html += `<div style="margin-top:8px;font-size:10.5px;font-weight:700;color:${BIC.purple};margin-bottom:4px">${tTask({ru:'События кластера', en:'Cluster events'})}</div>`;
    d.log.slice().reverse().forEach(e => {
      const f = LOG_TXT[e.type]; if (!f) return;
      html += `<div style="font-size:9.5px;color:${BIC.txt2};margin-bottom:2px"><span style="color:${BIC.txt3}">t${e.tick}</span> ${_kEsc(f(e))}${e.n > 1 ? ` <span style="color:${BIC.txt2}">×${e.n}</span>` : ''}</div>`;
    });
  }
  return html;
}

function biToggleBroker(blockId, idx) {
  const b = gb(blockId); if (!b) return;
  if (!BROKER_STATE[blockId]) initBrokerState(b);
  const st = BROKER_STATE[blockId];
  const up = !(st.brokers[idx] && st.brokers[idx].up);
  kafkaSetBrokerUp(blockId, idx, up);
  if (typeof analyze === 'function') analyze();
  refreshBrokerInspector();
  if (typeof toast === 'function') toast(up ? '♻ broker-' + idx : '💥 broker-' + idx + ' DOWN');
}
function biResetChaos(blockId) { kafkaResetChaos(blockId); if (typeof analyze === 'function') analyze(); refreshBrokerInspector(); }
function biRedriveDlq(blockId) { const n = kafkaRedriveDlq(blockId); if (typeof toast === 'function') toast('⤴ DLQ → topic: ' + n); refreshBrokerInspector(); }
