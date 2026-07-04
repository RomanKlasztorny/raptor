// BROKER-INSPECTOR — живой инспектор брокера (Kafka/RabbitMQ/NATS/Queue)
// Клик на брокер во время симуляции → панель с топологией + live данные.
// Симуляция НЕ останавливается. Данные обновляются каждые 500мс.

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
  $('bi-topology').innerHTML = renderBrokerTopologySVG(b);
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
        fill="#1a1b26" stroke="#7aa2f7" stroke-width="1.2"/>
        <text x="${midX}" y="${py+4}" text-anchor="middle" font-size="9" fill="#7aa2f7">P${i}</text>`;
    }
    centerSvg += `<text x="${midX}" y="${startY - 8}" text-anchor="middle" font-size="9" fill="#787c99">партиции</text>`;
  } else if (b.type === 'rabbitmq') {
    const ex = s.exchange || 'direct';
    const exShort = { direct:'direct', fanout:'fanout', topic:'topic.*' }[ex] || ex;
    centerSvg = `<rect x="${midX-38}" y="${centerY-22}" width="76" height="44" rx="7"
      fill="#1a1b26" stroke="#ff9e64" stroke-width="1.5"/>
      <text x="${midX}" y="${centerY-7}" text-anchor="middle" font-size="9" fill="#ff9e64">Exchange</text>
      <text x="${midX}" y="${centerY+8}" text-anchor="middle" font-size="10" fill="#e0af68" font-weight="700">${exShort}</text>`;
  } else {
    const col = b.type === 'nats' ? '#9ece6a' : '#bb9af7';
    const lbl = b.type === 'nats' ? 'NATS' : 'Queue';
    centerSvg = `<rect x="${midX-32}" y="${centerY-18}" width="64" height="36" rx="6"
      fill="#1a1b26" stroke="${col}" stroke-width="1.5"/>
      <text x="${midX}" y="${centerY+6}" text-anchor="middle" font-size="10" fill="${col}" font-weight="700">${lbl}</text>`;
  }

  // ── Соединительные линии ──
  let lines = '';
  producers.forEach((_, i) => {
    lines += `<line x1="${prodX+30}" y1="${prodY(i)}" x2="${midX-38}" y2="${centerY}"
      stroke="#7aa2f755" stroke-width="1.3" stroke-dasharray="5,3"/>
      <polygon points="${midX-38},${centerY} ${midX-46},${centerY-4} ${midX-46},${centerY+4}"
      fill="#7aa2f755"/>`;
  });
  consumers.forEach((_, i) => {
    lines += `<line x1="${midX+38}" y1="${centerY}" x2="${consX-30}" y2="${consY(i)}"
      stroke="#9ece6a55" stroke-width="1.3" stroke-dasharray="5,3"/>
      <polygon points="${consX-30},${consY(i)} ${consX-38},${consY(i)-4} ${consX-38},${consY(i)+4}"
      fill="#9ece6a55"/>`;
  });

  // ── Блоки продюсеров ──
  let prodSvg = '';
  if (producers.length) {
    prodSvg += `<text x="${prodX}" y="14" text-anchor="middle" font-size="9" fill="#787c99">Продюсеры</text>`;
  }
  producers.forEach((p, i) => {
    const lbl = (p.customLabel || EL[p.type]?.lbl || p.id).slice(0, 11);
    prodSvg += `<rect x="${prodX-30}" y="${prodY(i)-14}" width="60" height="28" rx="5"
      fill="#24253a" stroke="#3d3f52" stroke-width="1"/>
      <text x="${prodX}" y="${prodY(i)+5}" text-anchor="middle" font-size="9" fill="#c0caf5">${lbl}</text>`;
  });

  // ── Блоки консьюмеров ──
  let consSvg = '';
  if (consumers.length) {
    consSvg += `<text x="${consX}" y="14" text-anchor="middle" font-size="9" fill="#787c99">Консьюмеры</text>`;
  }
  consumers.forEach((c, i) => {
    const lbl = (c.customLabel || EL[c.type]?.lbl || c.id).slice(0, 11);
    consSvg += `<rect x="${consX-30}" y="${consY(i)-14}" width="60" height="28" rx="5"
      fill="#24253a" stroke="#3d3f52" stroke-width="1"/>
      <text x="${consX}" y="${consY(i)+5}" text-anchor="middle" font-size="9" fill="#c0caf5">${lbl}</text>`;
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
    return `<div style="color:#787c99;font-size:12px;text-align:center;padding:20px 0">
      Запустите симуляцию (▶ Запустить) чтобы увидеть живые данные
    </div>`;
  }

  // Баннер "симуляция не запущена" если структура есть, но сообщений ещё не было
  let simIdleBanner = '';
  if (!state.totalProduced) {
    simIdleBanner = `<div style="background:#7aa2f71a;border:1px solid #7aa2f744;padding:7px 12px;margin-bottom:12px;font-size:11px;color:#787c99">
      Структура готова. Нажмите ▶ Запустить — данные появятся здесь в реальном времени.
    </div>`;
  }

  let html = simIdleBanner;

  // ── Счётчики ──
  const dlqN = state.dlq?.length || 0;
  const dlqCol = dlqN ? '#f7768e' : '#787c99';
  const lag = calcTotalLag(state);
  const lagCol = lag > 100 ? '#f7768e' : lag > 10 ? '#e0af68' : '#9ece6a';

  html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px">
    <div class="bi-stat"><div class="bi-sl">Опубликовано</div><div class="bi-sv" style="color:#7aa2f7">${state.totalProduced}</div></div>
    <div class="bi-stat"><div class="bi-sl">Обработано</div><div class="bi-sv" style="color:#9ece6a">${state.totalConsumed}</div></div>
    <div class="bi-stat"><div class="bi-sl">Lag</div><div class="bi-sv" style="color:${lagCol}">${lag}</div></div>
    <div class="bi-stat"><div class="bi-sl">DLQ</div><div class="bi-sv" style="color:${dlqCol}">${dlqN}</div></div>
  </div>`;

  // ── NATS потери ──
  if (state.lostCount) {
    html += `<div style="background:#f7768e1a;border-left:2px solid #f7768e;border-radius:5px;padding:7px 10px;margin-bottom:10px;font-size:11px;color:#f7768e">
      ⚠ Потеряно ${state.lostCount} сообщ. — NATS core без JetStream не хранит сообщения
    </div>`;
  }

  // ── Kafka: топики + партиции + consumer groups ──
  if (b.type === 'kafka') {
    Object.entries(state.topics || {}).forEach(([topicName, parts]) => {
      const total = parts.reduce((a, p) => a + p.messages.length, 0);
      const maxMsg = Math.max(...parts.map(p => p.messages.length), 1);

      html += `<div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#bb9af7;margin-bottom:7px">
          topic: <span style="color:#c0caf5">${topicName}</span>
          <span style="font-weight:400;color:#787c99;margin-left:6px">${total} сообщ. всего</span>
        </div>`;

      // Прогрессбары партиций
      parts.forEach((p, i) => {
        const fill = Math.round((p.messages.length / maxMsg) * 100);
        const barCol = fill > 80 ? '#f7768e' : fill > 50 ? '#e0af68' : '#7aa2f7';
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <div style="font-size:10px;color:#787c99;width:24px;flex-shrink:0">P${i}</div>
          <div style="flex:1;height:14px;background:#1a1b26;border-radius:3px;border:1px solid #3d3f52;overflow:hidden">
            <div style="height:100%;width:${fill}%;background:${barCol};border-radius:2px;transition:width .3s"></div>
          </div>
          <div style="font-size:10px;color:#c0caf5;width:52px;text-align:right;flex-shrink:0">${p.messages.length} msg</div>
        </div>`;
      });

      // Consumer groups
      const groups = Object.entries(state.consumerGroups || {})
        .filter(([, g]) => g.topics && topicName in g.topics);

      if (groups.length) {
        html += `<div style="margin-top:10px">
          <div style="font-size:10.5px;font-weight:700;color:#bb9af7;margin-bottom:5px">Consumer Groups</div>`;
        groups.forEach(([gid, grp]) => {
          const offs = grp.topics?.[topicName] || {};
          const lag = parts.reduce((a, p, i) => a + Math.max(0, p.messages.length - (offs[i] || 0)), 0);
          const lagCol = lag > 100 ? '#f7768e' : lag > 10 ? '#e0af68' : '#9ece6a';
          const pct = total > 0 ? Math.round(((total - lag) / total) * 100) : 100;

          // Offsets по партициям
          const offsetDetail = parts.map((p, i) =>
            `<span style="color:#787c99">P${i}:</span><span style="color:#7aa2f7"> ${offs[i]||0}/${p.messages.length}</span>`
          ).join(' &nbsp;');

          html += `<div style="background:#1a1b26;border-radius:6px;padding:8px 10px;margin-bottom:6px;border:1px solid #3d3f52">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
              <div style="font-size:10.5px;font-weight:700;color:#c0caf5">${gid}</div>
              <div style="font-size:10px;color:${lagCol}">lag: <b>${lag}</b></div>
            </div>
            <div style="height:7px;background:#24253a;border-radius:3px;overflow:hidden;margin-bottom:5px">
              <div style="height:100%;width:${pct}%;background:${lagCol};border-radius:3px;transition:width .3s"></div>
            </div>
            <div style="font-size:9.5px;margin-bottom:6px">${offsetDetail}</div>
            <button onclick="doReplay('${blockId}','${gid}')" style="padding:3px 10px;border:1px solid #7aa2f7;border-radius:4px;background:#7aa2f71a;color:#7aa2f7;cursor:pointer;font-size:9.5px">↺ Replay</button>
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
    html += `<div style="font-size:11px;font-weight:700;color:#ff9e64;margin-bottom:7px">Очереди</div>`;
    queues.forEach(([qname, msgs]) => {
      const fill = Math.round((msgs.length / maxQ) * 100);
      const barCol = fill > 80 ? '#f7768e' : fill > 50 ? '#e0af68' : '#ff9e64';
      html += `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:10.5px;color:#c0caf5">${qname}</div>
          <div style="font-size:10px;color:#e0af68">${msgs.length} ожидают</div>
        </div>
        <div style="height:12px;background:#1a1b26;border-radius:3px;border:1px solid #3d3f52;overflow:hidden">
          <div style="height:100%;width:${fill}%;background:${barCol};border-radius:2px;transition:width .3s"></div>
        </div>
      </div>`;
    });
  }

  // ── DLQ ──
  if (dlqN) {
    html += `<div style="margin-top:10px">
      <div style="font-size:11px;font-weight:700;color:#f7768e;margin-bottom:5px">Dead Letter Queue (${dlqN})</div>`;
    state.dlq.slice(-5).reverse().forEach(msg => {
      html += `<div style="background:#f7768e1a;border-left:2px solid #f7768e;border-radius:4px;padding:5px 8px;margin-bottom:4px;font-size:10px;color:#f7768e">
        ${msg.failReason}: ${JSON.stringify(msg.body || {}).slice(0, 60)}
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
      lag += parts.reduce((a, p, i) => a + Math.max(0, p.messages.length - (offs[i] || 0)), 0);
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

  let html = `<div style="font-size:11px;font-weight:700;color:#7aa2f7;margin-bottom:8px">Настройки</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 14px">`;

  defs.forEach(d => {
    const v = s[d.k] !== undefined ? s[d.k] : d.def;
    const hint = d.hint ? `title="${d.hint.replace(/"/g, "'")}"` : '';

    if (d.type === 'txt') {
      html += `<div ${hint} style="grid-column:1/-1">
        <div style="font-size:9.5px;color:#787c99;margin-bottom:3px">${d.lbl}</div>
        <input type="text" value="${v}" placeholder="${d.def||''}"
          oninput="biChangeSetting('${b.id}','${d.k}',this.value)"
          style="width:100%;padding:5px 7px;background:#1a1b26;border:1px solid #3d3f52;border-radius:5px;color:#c0caf5;font-size:10.5px;box-sizing:border-box;font-family:inherit"/>
      </div>`;
    } else if (d.type === 'sel') {
      html += `<div ${hint}>
        <div style="font-size:9.5px;color:#787c99;margin-bottom:3px">${d.lbl}</div>
        <select onchange="biChangeSetting('${b.id}','${d.k}',this.value)"
          style="width:100%;padding:5px 7px;background:#1a1b26;border:1px solid #3d3f52;border-radius:5px;color:#c0caf5;font-size:10.5px;cursor:pointer;font-family:inherit">
          ${d.opts.map(o => `<option value="${o}"${v===o?' selected':''}>${o}</option>`).join('')}
        </select>
      </div>`;
    } else if (d.type === 'num') {
      html += `<div ${hint}>
        <div style="font-size:9.5px;color:#787c99;margin-bottom:3px">${d.lbl}</div>
        <input type="number" value="${v}" min="${d.min||1}" max="${d.max||200}"
          onchange="biChangeSetting('${b.id}','${d.k}',+this.value)"
          style="width:100%;padding:5px 7px;background:#1a1b26;border:1px solid #3d3f52;border-radius:5px;color:#c0caf5;font-size:10.5px;box-sizing:border-box"/>
      </div>`;
    } else if (d.type === 'tog') {
      html += `<div style="display:flex;align-items:center;gap:8px;padding-top:14px" ${hint}>
        <input type="checkbox" id="bi-tog-${d.k}"${v?' checked':''} onchange="biChangeSetting('${b.id}','${d.k}',this.checked)" style="cursor:pointer;width:14px;height:14px"/>
        <label for="bi-tog-${d.k}" style="font-size:10.5px;color:#c0caf5;cursor:pointer">${d.lbl}</label>
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
  $('bi-topology').innerHTML = renderBrokerTopologySVG(b);
  $('bi-rationale').innerHTML = generateBrokerRationale(b);
}

// ── Обоснование для БА ───────────────────────────────────────────
function generateBrokerRationale(b) {
  const s = b.settings || {};
  const producers = S.conns.filter(c => c.to === b.id).map(c => gb(c.from)).filter(Boolean);
  const consumers = S.conns.filter(c => c.from === b.id).map(c => gb(c.to)).filter(Boolean);
  const lines = [];

  if (b.type === 'kafka') {
    const parts = s.partitions || 3;
    const delivery = s.delivery || 'at-least-once';
    const repl = s.replication || 3;
    const nc = consumers.length || 1;
    const perC = Math.ceil(parts / nc);

    lines.push(`${parts} партиц${parts===1?'ия':parts<5?'ии':'ий'} → ${nc} консьюмер${nc===1?'':nc<5?'а':'ов'} (~${perC} парт./консьюмер).`);
    if (nc > parts) lines.push(`⚠ Консьюмеров (${nc}) > партиций (${parts}): ${nc-parts} будут простаивать.`);
    else if (nc < parts) lines.push(`Добавление до ${parts} консьюмеров даст линейный прирост.`);
    lines.push(`RF=${repl}: кластер выдержит отказ ${repl-1} брокер${repl-1===1?'а':repl-1<5?'ов':'ов'}.`);
    const delivMap = {'at-most-once':'возможны потери','at-least-once':'без потерь, дубли допустимы','exactly-once':'ровно один раз (−50% RPS)'};
    lines.push(`Доставка: ${delivery} — ${delivMap[delivery]||delivery}.`);
    if (producers.length) lines.push(`Продюсеры: ${producers.map(p=>p.customLabel||EL[p.type]?.lbl).join(', ')}.`);
    if (consumers.length) lines.push(`Консьюмеры: ${consumers.map(c=>c.customLabel||EL[c.type]?.lbl).join(', ')}.`);
  }

  if (b.type === 'rabbitmq') {
    const ex = s.exchange || 'direct';
    const exDesc = {direct:'сообщение → одна очередь по routing key', fanout:`копия → каждый из ${consumers.length} консьюмеров (broadcast)`, topic:'маршрутизация по паттерну (order.*)'}[ex] || ex;
    lines.push(`Exchange: ${ex} — ${exDesc}.`);
    if (s.mirrored) lines.push('Mirrored Queues: зеркалирование на все ноды (−30% скорости, надёжнее).');
    if (s.ack === 'manual') lines.push('Ручное ACK: сообщение не удаляется до подтверждения консьюмером.');
  }

  if (b.type === 'nats') {
    if (!s.jetstream) {
      lines.push('NATS core: at-most-once. Нет подписчика → сообщение ТЕРЯЕТСЯ.');
      lines.push('Для персистентности включи JetStream (семантика Kafka).');
    } else {
      lines.push('JetStream: персистентность включена, at-least-once гарантирована.');
    }
  }

  if (b.type === 'queue') {
    const w = s.workers || 1;
    lines.push(`${w} worker${w===1?'':w<5?'а':'ов'} обрабатывают задачи параллельно.`);
    lines.push('Продюсер не ждёт результата — полная асинхронность.');
  }

  if (!lines.length) return '';

  return lines.map(l => {
    const warn = l.startsWith('⚠');
    const col = warn ? '#e0af68' : '#a9b1d6';
    return `<div style="font-size:10.5px;color:${col};margin-bottom:5px;line-height:1.5">${l}</div>`;
  }).join('');
}
