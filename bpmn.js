// BPMN — Business Process Model and Notation 2.0 elements, rendering and interaction
// Mirrors the C4 interaction model in interact.js/render.js but operates on S.bpmn
// instead of S.blocks/S.conns, and stays fully isolated from the C4 canvas.

// ═══════════════════════════════════════════════════════════════
// CATALOG — element defaults (per bpmb.de BPMN 2.0 poster)
// ═══════════════════════════════════════════════════════════════
const BPMN_EL = {
  start:         { lbl: 'Start Event',       clr: '#9ece6a', cat: 'event',    w: 44,  h: 44,  shape: 'circle',
    desc: 'Marks where the process begins. Every process needs exactly one (or one per valid trigger).' },
  end:           { lbl: 'End Event',         clr: '#f7768e', cat: 'event',    w: 44,  h: 44,  shape: 'circle',
    desc: 'Marks where a path through the process finishes. Thick border, per BPMN convention.' },
  event_message: { lbl: 'Message Event',     clr: '#2ac3de', cat: 'event',    w: 44,  h: 44,  shape: 'circle',
    desc: 'Sending or receiving a message. Used mid-process, it means "wait here for a message to arrive."' },
  event_timer:   { lbl: 'Timer Event',       clr: '#e0af68', cat: 'event',    w: 44,  h: 44,  shape: 'circle',
    desc: 'A scheduled point in time, or a delay/timeout. Used mid-process, it means "wait here until the timer fires."' },
  event_error:   { lbl: 'Error Event',       clr: '#f7768e', cat: 'event',    w: 44,  h: 44,  shape: 'circle',
    desc: 'Raises or catches a named error, interrupting the normal flow.' },
  event_signal:  { lbl: 'Signal Event',      clr: '#9ece6a', cat: 'event',    w: 44,  h: 44,  shape: 'circle',
    desc: 'Broadcasts or catches a signal. Unlike a message, a signal has no specific addressee — anyone listening reacts.' },
  task:          { lbl: 'Task',              clr: '#7aa2f7', cat: 'activity', w: 110, h: 64,  shape: 'rect',
    desc: 'A single unit of work performed by a role or system.' },
  task_user:     { lbl: 'User Task',         clr: '#7aa2f7', cat: 'activity', w: 110, h: 64,  shape: 'rect',
    desc: 'Work a HUMAN does through some interface: approve a request, fill a form, review a document.' },
  task_service:  { lbl: 'Service Task',      clr: '#7aa2f7', cat: 'activity', w: 110, h: 64,  shape: 'rect',
    desc: 'Work an automated SYSTEM does: call an API, charge a card, send to a queue. No human involved.' },
  task_script:   { lbl: 'Script Task',       clr: '#7aa2f7', cat: 'activity', w: 110, h: 64,  shape: 'rect',
    desc: 'A script the process engine itself executes: transform data, compute a value, format a message.' },
  subprocess:    { lbl: 'Sub-Process',       clr: '#bb9af7', cat: 'activity', w: 130, h: 74,  shape: 'rect',
    desc: 'A task that can be broken down into its own smaller process (marked with the + at the bottom).' },
  gateway_xor:   { lbl: 'Exclusive Gateway', clr: '#e0af68', cat: 'gateway',  w: 50,  h: 50,  shape: 'diamond',
    desc: 'Exclusive (XOR): on branching, routes the token down exactly ONE outgoing path — the first branch whose condition is true. On merging, it just passes each arriving token straight through (no waiting).' },
  gateway_and:   { lbl: 'Parallel Gateway',  clr: '#e0af68', cat: 'gateway',  w: 50,  h: 50,  shape: 'diamond',
    desc: 'Parallel (AND): on branching, activates ALL outgoing paths at once. On merging, it WAITS until a token has arrived on every incoming path before continuing.' },
  gateway_or:    { lbl: 'Inclusive Gateway', clr: '#e0af68', cat: 'gateway',  w: 50,  h: 50,  shape: 'diamond',
    desc: 'Inclusive (OR): on branching, activates ONE OR MORE outgoing paths — every branch whose condition is true runs. On merging, it waits for all the branches that were actually activated.' },
  gateway_event_based: { lbl: 'Event-based Gateway', clr: '#e0af68', cat: 'gateway', w: 50, h: 50, shape: 'diamond',
    desc: 'Event-based: doesn\'t evaluate data conditions — instead it waits to see WHICH event happens first (a message arrives, a timer fires…) and follows only that branch. Must be followed by catching events or receive tasks, not plain tasks.' },
  gateway_complex: { lbl: 'Complex Gateway', clr: '#e0af68', cat: 'gateway', w: 50, h: 50, shape: 'diamond',
    desc: 'Complex: for split/merge rules that don\'t fit XOR/AND/OR (e.g. "any 2 of these 3 branches"). Write the exact rule in the label — the shape alone can\'t express it.' },
  boundary_timer: { lbl: 'Boundary Timer',  clr: '#e0af68', cat: 'boundary', w: 32,  h: 32,  shape: 'circle',
    desc: 'Attach to a Task: if the timer fires before the task finishes, the task is INTERRUPTED and flow continues along the boundary path (timeout/escalation). Click a Task to attach.' },
  boundary_error: { lbl: 'Boundary Error',  clr: '#f7768e', cat: 'boundary', w: 32,  h: 32,  shape: 'circle',
    desc: 'Attach to a Task: if the task throws this error, it is interrupted and flow continues along the boundary path (error handling). Click a Task to attach.' },
  boundary_message: { lbl: 'Boundary Message', clr: '#2ac3de', cat: 'boundary', w: 32, h: 32, shape: 'circle',
    desc: 'Attach to a Task: if a message arrives while the task runs, the task is interrupted and flow continues along the boundary path (e.g. "order cancelled while packing"). Click a Task to attach.' },
  data_object:   { lbl: 'Data Object',       clr: '#c0caf5', cat: 'artifact', w: 36,  h: 46,  shape: 'doc',
    desc: 'A document or piece of data the process reads or produces (an order, an invoice, a report). Connect with dotted associations — it does NOT carry the token flow.' },
  data_store:    { lbl: 'Data Store',        clr: '#c0caf5', cat: 'artifact', w: 52,  h: 44,  shape: 'cylinder',
    desc: 'A persistent store (database, archive) the process reads from or writes to. Associations to it are dotted and carry no token flow.' },
  annotation:    { lbl: 'Annotation',        clr: '#9a9488', cat: 'artifact', w: 150, h: 44,  shape: 'annotation',
    desc: 'A free-text comment pinned to the diagram. Purely explanatory — no effect on the process.' },
  pool:          { lbl: 'Pool',              clr: '#c8c0ac', cat: 'container',w: 560, h: 260, shape: 'pool',
    desc: 'A whole separate system, organization, or external participant. Put Lanes inside it to show the roles within that system. A flow that crosses between two different Pools is drawn as a dashed Message Flow automatically — that\'s the "who sends what to whom" signal.' },
  lane:          { lbl: 'Lane',              clr: '#d8d0be', cat: 'container',w: 480, h: 140, shape: 'lane',
    desc: 'A role, team, or sub-system WITHIN one Pool. Flows between Lanes in the same Pool stay solid Sequence Flows — only crossing a Pool boundary makes a flow a Message Flow. Drag its corner handle to resize once selected.' },
};

const BPMN_CATS = [
  { key: 'Events',     emoji: '◎', els: ['start', 'end', 'event_message', 'event_timer', 'event_error', 'event_signal'] },
  { key: 'Activities', emoji: '▭', els: ['task', 'task_user', 'task_service', 'task_script', 'subprocess'] },
  { key: 'Boundary',   emoji: '◉', els: ['boundary_timer', 'boundary_error', 'boundary_message'] },
  { key: 'Gateways',   emoji: '◇', els: ['gateway_xor', 'gateway_and', 'gateway_or', 'gateway_event_based', 'gateway_complex'] },
  { key: 'Artifacts',  emoji: '🗎', els: ['data_object', 'data_store', 'annotation'] },
  { key: 'Containers', emoji: '▦', els: ['pool', 'lane'] },
];

// ═══════════════════════════════════════════════════════════════
// DIAGRAM STATE
// ═══════════════════════════════════════════════════════════════
function getCurrentBpmn() {
  if (!S.bpmn.diagrams.length || !S.bpmn.currentDiagramId) {
    const diag = { id: 'bp' + (S.nid++), name: 'Process 1', elements: [], flows: [] };
    S.bpmn.diagrams.push(diag);
    S.bpmn.currentDiagramId = diag.id;
  }
  let d = S.bpmn.diagrams.find(x => x.id === S.bpmn.currentDiagramId);
  if (!d) { d = S.bpmn.diagrams[0]; S.bpmn.currentDiagramId = d.id; } // битая ссылка на диаграмму
  return d;
}

// Приводит загруженные данные к рабочему виду: старые проекты без w/h,
// неизвестные типы, флоу на удалённые элементы, отсутствующие массивы.
// Без этого рендер падал (NaN в атрибутах, `def.lbl` of undefined).
// Заодно поднимает S.nid выше всех занятых id — иначе после импорта
// JSON (где S.nid сбрасывается) новые элементы получали дубли id.
const BPMN_SANITIZE_LOG = new WeakMap(); // диаграмма → сколько мусора выкинуто при загрузке
function bpmnSanitizeDiagram(d) {
  if (!d || typeof d !== 'object') return d;
  if (!Array.isArray(d.elements)) d.elements = [];
  if (!Array.isArray(d.flows)) d.flows = [];
  if (!Array.isArray(d.scenarios)) d.scenarios = [];
  if (!d.name) d.name = 'Process';
  const keep = (arr, pred) => { const out = arr.filter(pred); return out.length === arr.length ? arr : out; };
  const n0 = d.elements.length, f0 = d.flows.length;
  d.elements = keep(d.elements, e => e && typeof e === 'object' && e.id != null);
  d.elements.forEach(e => {
    e.id = String(e.id);
    if (!BPMN_EL[e.type]) { e.origType = e.origType || e.type; e.type = /gateway/i.test(e.type || '') ? 'gateway_xor' : /event/i.test(e.type || '') ? 'event_message' : 'task'; }
    const def = BPMN_EL[e.type];
    ['x', 'y'].forEach(k => { e[k] = Number(e[k]); if (!isFinite(e[k])) e[k] = 0; });
    ['w', 'h'].forEach(k => { e[k] = Number(e[k]); if (!isFinite(e[k]) || e[k] <= 0) e[k] = def[k]; });
    if (e.label == null) e.label = def.lbl;
    e.label = String(e.label);
  });
  const ids = new Set(d.elements.map(e => e.id));
  d.elements = keep(d.elements, e => !bpmnIsBoundary(e.type) || ids.has(e.attachedTo));
  const ids2 = new Set(d.elements.map(e => e.id));
  d.flows = keep(d.flows, f => f && ids2.has(String(f.from)) && ids2.has(String(f.to)));
  if (d.elements.length !== n0 || d.flows.length !== f0) {
    const log = BPMN_SANITIZE_LOG.get(d) || { els: 0, flows: 0 };
    log.els += n0 - d.elements.length; log.flows += f0 - d.flows.length;
    BPMN_SANITIZE_LOG.set(d, log);
  }
  d.flows.forEach(f => { f.id = String(f.id || ('bf' + (S.nid++))); f.from = String(f.from); f.to = String(f.to); if (f.label != null) f.label = String(f.label); });
  return d;
}

function bpmnSanitizeState() {
  if (!S.bpmn || typeof S.bpmn !== 'object') S.bpmn = { diagrams: [], currentDiagramId: null };
  if (!Array.isArray(S.bpmn.diagrams)) S.bpmn.diagrams = [];
  let maxN = 0;
  const num = id => { const m = /(\d+)$/.exec(String(id || '')); if (m) maxN = Math.max(maxN, +m[1]); };
  S.bpmn.diagrams.forEach(d => {
    bpmnSanitizeDiagram(d); num(d.id);
    d.elements.forEach(e => num(e.id)); d.flows.forEach(f => num(f.id));
    d.scenarios.forEach(sc => num(sc.id));
  });
  if (!(S.nid > maxN)) S.nid = maxN + 1;
}

function bEl(elId) { return getCurrentBpmn().elements.find(e => e.id === elId); }
function bFlow(flowId) { return getCurrentBpmn().flows.find(f => f.id === flowId); }

// ═══════════════════════════════════════════════════════════════
// NOTATION SWITCHING — keeps C4 and BPMN fully isolated
// ═══════════════════════════════════════════════════════════════
function switchNotation(mode) {
  if (S.notationMode === mode) return;
  if (S.bpmnSim && S.bpmnSim.active) { S.bpmnSim = { active: false }; bpmnAnimStop(); } // scenarios don't survive leaving BPMN
  S.notationMode = mode;
  S.selected = null;
  S.bpmnHovered = null;
  S.bpmnMulti = [];

  document.querySelectorAll('[id^="notation-"]').forEach(el => {
    el.classList.toggle('on', el.id === 'notation-' + mode);
  });

  if (mode === 'bpmn') getCurrentBpmn(); // ensure at least one diagram exists
  toggleC4OnlyControls(mode === 'c4');

  if (typeof buildPalette === 'function') buildPalette();
  if (typeof switchTab === 'function') switchTab('analysis');
  if (mode === 'c4' && typeof updateSidebar === 'function') updateSidebar();
  else if (mode === 'bpmn' && typeof renderBpmnPanel === 'function') renderBpmnPanel();
  if (typeof render === 'function') render();
  if (typeof updateStatus === 'function') updateStatus();

  toast(mode === 'c4' ? '📐 C4 Architecture' : '📊 BPMN Processes');
}

// Hide simulation/C4-only toolbar controls in BPMN mode (rps, run/pause/stop,
// auto-layout, edge style, C4 view level, health legend). Undo/redo and the
// canvas theme toggle stay — they're notation-agnostic.
function toggleC4OnlyControls(showC4) {
  document.querySelectorAll('.c4-only').forEach(el => {
    // Wrapper spans use display:contents to stay transparent in the flex row;
    // restoring '' would fall back to inline and break the flex item layout.
    const wasContents = el.getAttribute('data-contents') === '1' || el.style.display === 'contents';
    if (wasContents) el.setAttribute('data-contents', '1');
    el.style.display = showC4 ? (wasContents ? 'contents' : '') : 'none';
  });
  document.querySelectorAll('.bpmn-only').forEach(el => { el.style.display = showC4 ? 'none' : ''; });
  const bpmnLabel = $('bpmn-toolbar-label');
  if (bpmnLabel) bpmnLabel.style.display = showC4 ? 'none' : '';
  if (!showC4) updateBpmnSimUI(); // fixes up which of run/stop shows, since the loop above just unhid both
}

// ═══════════════════════════════════════════════════════════════
// GEOMETRY / HIT-TESTING (mirrors core.js blockAt() pattern)
// ═══════════════════════════════════════════════════════════════
function bpmnHitTest(el, x, y) {
  const type = el.type;
  if (type === 'start' || type === 'end' || type.startsWith('event_')) {
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2, r = el.w / 2;
    return Math.hypot(x - cx, y - cy) <= r;
  }
  if (type.startsWith('gateway_')) {
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2, rx = el.w / 2, ry = el.h / 2;
    return Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;
  }
  return x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h;
}

function bpmnIsContainer(type) { return type === 'lane' || type === 'pool'; }
function bpmnIsBoundary(type) { return type.startsWith('boundary_'); }
function bpmnIsArtifact(type) { return type === 'data_object' || type === 'data_store' || type === 'annotation'; }
function bpmnCanHostBoundary(type) { return type.startsWith('task') || type === 'subprocess'; }

// Boundary events ride on their host task's border: slots along the bottom
// edge, right-to-left. Re-synced any time the host may have moved.
function bpmnSyncBoundaries(bpmn) {
  const byHost = {};
  bpmn.elements.forEach(el => {
    if (!bpmnIsBoundary(el.type) || !el.attachedTo) return;
    (byHost[el.attachedTo] = byHost[el.attachedTo] || []).push(el);
  });
  Object.entries(byHost).forEach(([hostId, evs]) => {
    const host = bpmn.elements.find(e => e.id === hostId);
    evs.forEach((ev, i) => {
      if (!host) return; // host gone — cleanup happens on delete, not here
      ev.x = host.x + host.w - 26 - i * 38 - ev.w / 2;
      ev.y = host.y + host.h - ev.h / 2;
    });
  });
}
function bpmnBoundariesOf(elId) {
  return getCurrentBpmn().elements.filter(e => bpmnIsBoundary(e.type) && e.attachedTo === elId);
}

// Pools form ONE sticky vertical block: aligned to the same X, stacked with a
// fixed gap. Whenever any pool grows/shrinks/moves, the block re-snaps — the
// gap between pools can never drift. The topmost pool anchors the block.
const BPMN_POOL_GAP = 0; // pools sit flush, one solid block — no drifting gap
// `master` (optional) is the pool whose width the whole block adopts — pass
// the pool being resized; defaults to the topmost pool.
function bpmnRestackPools(master) {
  const bpmn = getCurrentBpmn();
  const pools = bpmn.elements.filter(e => e.type === 'pool').sort((a, b) => a.y - b.y);
  if (pools.length < 2) return;
  const blockW = (master && master.type === 'pool' ? master : pools[0]).w;
  // First-pool-wins content claim: while one pool has just grown, it can
  // transiently overlap the next pool — without claiming, the lower pool
  // would steal elements (e.g. a fresh lane) out of the grown one.
  const claimed = new Set();
  const contents = new Map(pools.map(p => {
    const own = bpmn.elements.filter(o =>
      o !== p && o.type !== 'pool' && !bpmnIsBoundary(o.type) && !claimed.has(o.id) && (() => {
        const c = bpmnCenter(o); return c.x >= p.x && c.x <= p.x + p.w && c.y >= p.y && c.y <= p.y + p.h;
      })());
    own.forEach(o => claimed.add(o.id));
    return [p, own];
  }));
  const anchor = pools[0];
  let y = anchor.y + anchor.h + BPMN_POOL_GAP;
  for (let i = 1; i < pools.length; i++) {
    const p = pools[i];
    const dx = anchor.x - p.x, dy = y - p.y;
    p.x += dx; p.y += dy;
    if (dx || dy) contents.get(p).forEach(o => { o.x += dx; o.y += dy; });
    y = p.y + p.h + BPMN_POOL_GAP;
  }
  // One block = one width: every pool takes blockW, lanes re-fit inside
  pools.forEach(p => {
    p.w = blockW;
    contents.get(p).forEach(o => {
      if (o.type === 'lane') { o.x = p.x + 8; o.w = p.w - 16; }
    });
  });
  bpmnSyncBoundaries(bpmn);
}

// Lanes geometrically inside a pool, top to bottom
function bpmnPoolLanes(pool) {
  const bpmn = getCurrentBpmn();
  return bpmn.elements
    .filter(l => l.type === 'lane' && (() => { const c = bpmnCenter(l); return c.x >= pool.x && c.x <= pool.x + pool.w && c.y >= pool.y && c.y <= pool.y + pool.h; })())
    .sort((a, b) => a.y - b.y);
}

// Re-fit the whole lane stack to the pool: full inner width, stacked from the
// top, contents travel with their lane, pool grows to hold the stack. This is
// what makes pools "sticky" — after any resize or dock nothing needs manual
// alignment.
function bpmnRestackPool(pool) {
  const bpmn = getCurrentBpmn();
  const lanes = bpmnPoolLanes(pool);
  if (!lanes.length) { bpmnRestackPools(pool); return; } // still keep the pool block glued
  const contents = new Map(lanes.map(l => [l, bpmn.elements.filter(o =>
    o !== l && !bpmnIsContainer(o.type) && !bpmnIsBoundary(o.type) && (() => {
      const oc = bpmnCenter(o); return oc.x >= l.x && oc.x <= l.x + l.w && oc.y >= l.y && oc.y <= l.y + l.h;
    })())]));
  let y = pool.y + 28;
  lanes.forEach(l => {
    l.x = pool.x + 8;
    l.w = pool.w - 16;
    const dy = y - l.y;
    l.y = y; y += l.h;
    if (dy) contents.get(l).forEach(o => { o.y += dy; });
  });
  // Pool with lanes shrink-wraps its stack exactly (grow AND shrink): height
  // is a function of the lanes, so no dead space ever opens below the stack.
  // Want a taller pool? Resize a lane — the pool follows.
  pool.h = y - pool.y + 10;
  bpmnSyncBoundaries(bpmn);
  bpmnRestackPools(pool); // pool changed — keep the block glued, same width
}

// "+ Lane": appends a lane at the bottom of the pool's stack, growing the pool
function bpmnAddLaneToPool(poolId) {
  const bpmn = getCurrentBpmn();
  const pool = bpmn.elements.find(e => e.id === poolId); if (!pool) return;
  const lanes = bpmnPoolLanes(pool);
  const lane = {
    id: 'be' + (S.nid++), type: 'lane', label: 'Lane ' + (lanes.length + 1),
    x: pool.x + 8, y: pool.y + 28 + lanes.reduce((s, l) => s + l.h, 0), w: pool.w - 16, h: 120,
  };
  // Grow the pool FIRST so the new lane's center falls inside it — otherwise
  // bpmnPoolLanes won't count the lane as belonging to this pool.
  const needed = 28 + lanes.reduce((s, l) => s + l.h, 0) + lane.h + 10;
  if (pool.h < needed) pool.h = needed;
  bpmn.elements.push(lane);
  bpmnRestackPool(pool);
  S.selected = lane.id;
  pushHist();
  if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
  render();
}

// "+ Pool": stamps a sibling pool right below, same x/width
function bpmnAddPoolBelow(poolId) {
  const bpmn = getCurrentBpmn();
  const pool = bpmn.elements.find(e => e.id === poolId); if (!pool) return;
  const pools = bpmn.elements.filter(e => e.type === 'pool');
  const el = {
    id: 'be' + (S.nid++), type: 'pool', label: 'Pool ' + (pools.length + 1),
    x: pool.x, y: pool.y + pool.h + BPMN_POOL_GAP, w: pool.w, h: BPMN_EL.pool.h,
  };
  bpmn.elements.push(el);
  bpmnRestackPools();
  S.selected = el.id;
  pushHist();
  if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
  render();
}

// A Lane dropped inside a Pool docks into it: full inner width, below the
// header, top edge snapped to the pool top or to the bottom of the lane
// stack already there — so lanes read as proper horizontal slices instead
// of arbitrary rectangles floating over the pool.
function bpmnDockLane(lane) {
  const bpmn = getCurrentBpmn();
  const c = bpmnCenter(lane);
  const pool = bpmn.elements.find(p => p.type === 'pool' && c.x >= p.x && c.x <= p.x + p.w && c.y >= p.y && c.y <= p.y + p.h);
  if (!pool) return;
  lane.x = pool.x + 8;
  lane.w = pool.w - 16;
  const siblings = bpmn.elements
    .filter(l => l.type === 'lane' && l !== lane && bpmnCenter(l).x >= pool.x && bpmnCenter(l).x <= pool.x + pool.w
                 && bpmnCenter(l).y >= pool.y && bpmnCenter(l).y <= pool.y + pool.h)
    .sort((a, b) => a.y - b.y);
  const top = pool.y + 28;
  if (!siblings.length) { lane.y = top; return; }
  // insert into the stack at the drop position, then restack everything
  const stack = [...siblings];
  const insertAt = stack.findIndex(l => c.y < l.y + l.h / 2);
  if (insertAt < 0) stack.push(lane); else stack.splice(insertAt, 0, lane);
  // capture each existing lane's contents BEFORE restacking so they shift along
  const contents = new Map(stack.map(l => [l, l === lane ? [] : bpmn.elements.filter(o =>
    o !== l && !bpmnIsContainer(o.type) && !bpmnIsBoundary(o.type) && (() => {
      const oc = bpmnCenter(o); return oc.x >= l.x && oc.x <= l.x + l.w && oc.y >= l.y && oc.y <= l.y + l.h;
    })())]));
  let y = top;
  stack.forEach(l => {
    const dy = y - l.y;
    l.y = y; y += l.h;
    if (dy) contents.get(l).forEach(o => { o.y += dy; });
  });
  bpmnSyncBoundaries(bpmn);
  // grow the pool if the stack runs past its bottom edge
  if (y > pool.y + pool.h - 6) pool.h = y - pool.y + 10;
}

// Top-most element under point. Containers are drawn behind everything else,
// and a Lane (nested, more specific) beats a Pool (outer, larger) so clicking
// inside a Lane selects the Lane, not the Pool it sits in.
function bpmnElementAt(pt) {
  const bpmn = getCurrentBpmn();
  const regular = [], lanes = [], pools = [];
  for (const el of bpmn.elements) {
    if (el.type === 'pool') pools.push(el);
    else if (el.type === 'lane') lanes.push(el);
    else regular.push(el);
  }
  for (let i = regular.length - 1; i >= 0; i--) if (bpmnHitTest(regular[i], pt.x, pt.y)) return regular[i].id;
  for (let i = lanes.length - 1; i >= 0; i--) if (bpmnHitTest(lanes[i], pt.x, pt.y)) return lanes[i].id;
  for (let i = pools.length - 1; i >= 0; i--) if (bpmnHitTest(pools[i], pt.x, pt.y)) return pools[i].id;
  return null;
}

// Which Pool (if any) geometrically contains this element — the basis for
// deciding Sequence Flow (same Pool) vs Message Flow (different Pools).
function bpmnElementPoolId(el) { return bpmnElementPoolIdIn(getCurrentBpmn(), el); }
function bpmnElementPoolIdIn(bpmn, el) {
  if (el.type === 'pool') return el.id;
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const pool = bpmn.elements.find(p => p.type === 'pool' && cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h);
  return pool ? pool.id : null;
}

// Connect-port anchor point on an element's right edge (matches C4's port UX)
function bpmnPortPoint(el) {
  return { x: el.x + el.w, y: el.y + el.h / 2 };
}

// All four connect ports (E/W/N/S). Connections can start from any of them.
function bpmnPorts(el) {
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  return [
    { x: el.x + el.w, y: cy },
    { x: el.x,        y: cy },
    { x: cx,          y: el.y },
    { x: cx,          y: el.y + el.h },
  ];
}

// Anchor point on the element's boundary facing `toward` — so flows leave from
// whichever side actually points at the target instead of always the right edge.
function bpmnEdgePoint(el, toward) {
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const dx = toward.x - cx, dy = toward.y - cy;
  const type = el.type;
  if (type === 'start' || type === 'end' || type.startsWith('event_') || bpmnIsBoundary(type)) {
    const d = Math.hypot(dx, dy) || 1, r = el.w / 2;
    return { x: cx + dx / d * r, y: cy + dy / d * r };
  }
  // Rect and diamond both anchor at the side-center facing the target: for the
  // diamond that side-center is its vertex, which is exactly where BPMN
  // connects gateway flows.
  if (Math.abs(dx) >= Math.abs(dy)) return { x: dx >= 0 ? el.x + el.w : el.x, y: cy };
  return { x: cx, y: dy >= 0 ? el.y + el.h : el.y };
}
function bpmnCenter(el) { return { x: el.x + el.w / 2, y: el.y + el.h / 2 }; }
// Both endpoints of a flow between two elements, each on its facing side.
function bpmnFlowEnds(from, to) {
  return { p1: bpmnEdgePoint(from, bpmnCenter(to)), p2: bpmnEdgePoint(to, bpmnCenter(from)) };
}

// Вид связи: 'assoc' (к артефакту), 'message' (между разными пулами) или 'seq'.
function bpmnFlowKind(bpmn, flow) {
  const from = bpmn.elements.find(e => e.id === flow.from), to = bpmn.elements.find(e => e.id === flow.to);
  if (!from || !to) return 'seq';
  if (bpmnIsArtifact(from.type) || bpmnIsArtifact(to.type)) return 'assoc';
  const fp = bpmnElementPoolIdIn(bpmn, from), tp = bpmnElementPoolIdIn(bpmn, to);
  if (from.type === 'pool' || to.type === 'pool') return 'message';
  return fp && tp && fp !== tp ? 'message' : 'seq';
}

// Ломаная, по которой рисуется связь (ортогональный роутинг, см. bpmn-route.js)
function bpmnFlowPoints(bpmn, flow) {
  const from = bpmn.elements.find(e => e.id === flow.from), to = bpmn.elements.find(e => e.id === flow.to);
  if (!from || !to) return null;
  if (typeof bpmnRouteFlow === 'function' && S.bpmnRouting !== 'straight') return bpmnRouteFlow(bpmn, from, to);
  const { p1, p2 } = bpmnFlowEnds(from, to);
  return [p1, p2];
}

// Ломаная «шага» симуляции from→to: по реальной связи, если она есть
function bpmnHopPoints(bpmn, fromId, toId) {
  const f = bpmn.flows.find(x => x.from === fromId && x.to === toId);
  if (f) { const pts = bpmnFlowPoints(bpmn, f); if (pts) return pts; }
  const a = bpmn.elements.find(e => e.id === fromId), b = bpmn.elements.find(e => e.id === toId);
  if (!a || !b) return null;
  const { p1, p2 } = bpmnFlowEnds(a, b);
  return [p1, p2];
}

// Связь под точкой (расстояние до ломаной ≤ tol)
function bpmnFlowAt(pt, tol) {
  const bpmn = getCurrentBpmn();
  const z = S.zoom || 1;
  const lim = (tol || 6) / z;
  let best = null, bd = Infinity;
  bpmn.flows.forEach(f => {
    const pts = bpmnFlowPoints(bpmn, f); if (!pts) return;
    const d = bpmnDistToPoly(pts, pt.x, pt.y);
    if (d <= lim && d < bd) { bd = d; best = f.id; }
  });
  return best;
}

// ═══════════════════════════════════════════════════════════════
// SIMULATION — auto-walks EVERY scenario in the process from Start to End
// by itself: at each XOR/OR gateway it forks into a separate scenario per
// outgoing flow, so "куда ведут развилки и при каких условиях" is answered
// by just running it — no invented probabilities, no manual clicking.
// Each discovered scenario gets its own color (same palette as C4 routes)
// and is drawn as a colored trail on the diagram simultaneously.
// AND gateways stay parallel WITHIN one scenario (both branches, same run).
// Every discovered scenario converts in one click into a UML Sequence
// diagram via the existing seq.js renderer (see bpmnViewScenarioSeq).
// ═══════════════════════════════════════════════════════════════
const BPMN_SCEN_MAX = 12, BPMN_SCEN_MAX_STEPS = 200, BPMN_LOOP_VISITS = 2;

function bpmnSimStart() { bpmnAutoRunScenarios(); }

// ONE deterministic token run. `choices` replays decisions already made at
// XOR/OR/boundary choice points; any point past the recorded prefix takes
// option 0 and reports its option count in `fresh` so the enumerator can
// schedule sibling runs. Semantics:
//   AND split  — token forks, all branches live in the SAME scenario
//   AND join   — arriving tokens park until every incoming flow delivered one
//   OR  split  — a choice point: each single branch, or all-true at once
//   OR  join   — fires when no other live token can still reach it
//   loops      — an element entered more than BPMN_LOOP_VISITS+1 times ends
//                that branch as "↻ loop" instead of walking forever
//   boundaries — a task with boundary events is a choice point: complete
//                normally, or get interrupted down each boundary path
function bpmnRunOnce(bpmn, choices) {
  const fresh = [];
  let ci = 0;
  const choose = n => { if (ci < choices.length) return choices[ci++]; fresh.push(n); return 0; };

  const branches = [];
  const newBranch = hist => { const b = { history: hist, dead: false, joined: false, loop: false }; branches.push(b); return b; };
  // Associations to artifacts carry data, not tokens — the walker ignores them.
  // Message flows (между пулами) — не ветвление: отправка сообщения порождает
  // отдельный токен у получателя, а отправитель продолжает свой путь.
  const isArtifactId = id => { const e = bEl(id); return e && bpmnIsArtifact(e.type); };
  const kindOf = f => bpmnFlowKind(bpmn, f);
  const flowsFrom = id => bpmn.flows.filter(f => f.from === id && !isArtifactId(f.to));
  const seqFrom = id => flowsFrom(id).filter(f => kindOf(f) !== 'message');
  const msgFrom = id => flowsFrom(id).filter(f => kindOf(f) === 'message');
  const flowsTo = id => bpmn.flows.filter(f => f.to === id && !isArtifactId(f.from) && kindOf(f) !== 'message');

  // Несколько стартов — выбор точки входа (раньше учитывался только первый).
  // Старт, который сам ждёт message flow, отдельной точкой входа не считается.
  const allStarts = bpmn.elements.filter(e => e.type === 'start');
  const entryStarts = allStarts.filter(st => !bpmn.flows.some(f => f.to === st.id && kindOf(f) === 'message'));
  const starts = entryStarts.length ? entryStarts : allStarts;
  const start = starts.length > 1 ? starts[choose(starts.length)] : starts[0];
  const tokens = [{ elId: start.id, done: false, br: newBranch([{ elId: start.id, label: start.label, cond: null }]) }];
  const joinArrivals = {};
  const visits = {};
  const msgSent = new Set();
  const joinFired = {};

  // Can a token standing at fromId still reach gwId? (OR-join firing rule)
  function reachable(fromId, gwId) {
    const seen = new Set([fromId]); const q = [fromId];
    while (q.length) {
      const cur = q.shift();
      if (cur === gwId) return true;
      flowsFrom(cur).forEach(f => { if (!seen.has(f.to)) { seen.add(f.to); q.push(f.to); } });
      bpmn.elements.forEach(e => {
        if (bpmnIsBoundary(e.type) && e.attachedTo === cur && !seen.has(e.id)) { seen.add(e.id); q.push(e.id); }
      });
    }
    return false;
  }

  // Move a token along `flow`; returns the target element, or null when the
  // token parked at a join / hit a missing target.
  function arrive(token, flow) {
    const target = bEl(flow.to);
    if (!target) { token.br.dead = true; return null; }
    const isJoin = (target.type === 'gateway_and' || target.type === 'gateway_or') && flowsTo(target.id).length > 1;
    if (isJoin) {
      joinArrivals[target.id] = (joinArrivals[target.id] || 0) + 1;
      const andReady = target.type === 'gateway_and' && joinArrivals[target.id] >= flowsTo(target.id).length;
      const others = tokens.filter(t => t !== token && !t.done);
      const orReady = target.type === 'gateway_or' && !others.some(t => reachable(t.elId, target.id));
      if (!andReady && !orReady) {
        token.br.history.push({ elId: target.id, label: target.label, cond: 'joined' });
        token.br.joined = true;
        token.br.parkedAt = target.id;
        return null;
      }
      joinFired[target.id] = true;
    }
    token.br.history.push({ elId: target.id, label: target.label, cond: flow.label || null });
    token.elId = target.id;
    return target;
  }

  let steps = 0;
  while (steps++ < BPMN_SCEN_MAX_STEPS) {
    const token = tokens.find(t => !t.done);
    if (!token) break;
    const el = bEl(token.elId);
    if (!el || el.type === 'end') { token.done = true; continue; }

    visits[el.id] = (visits[el.id] || 0) + 1;
    if (visits[el.id] > BPMN_LOOP_VISITS + 1) { token.br.loop = true; token.done = true; continue; }

    if (bpmnCanHostBoundary(el.type)) {
      const bounds = bpmnBoundariesOf(el.id).filter(b => flowsFrom(b.id).length);
      if (bounds.length) {
        const k = choose(bounds.length + 1); // 0 = task completes normally
        if (k > 0) {
          const bev = bounds[k - 1];
          const bcond = bev.type === 'boundary_timer' ? '⏱ timeout' : bev.type === 'boundary_message' ? '✉ message' : '⚡ error';
          token.br.history.push({ elId: bev.id, label: bev.label, cond: bcond });
          token.elId = bev.id;
          continue;
        }
      }
    }

    // Исходящие сообщения: по токену на каждого получателя (однократно за прогон)
    msgFrom(el.id).forEach(mf => {
      if (msgSent.has(mf.id)) return;
      msgSent.add(mf.id);
      const tm = { elId: el.id, done: false, br: newBranch([...token.br.history]) };
      tm.br.viaMessage = true;
      tokens.push(tm);
      const tgt = bEl(mf.to);
      if (!tgt) { tm.done = true; return; }
      tm.br.history.push({ elId: tgt.id, label: tgt.label, cond: mf.label || '✉' });
      tm.elId = tgt.id;
      // Получатель — пул «чёрный ящик» или узел, к которому и так придёт свой
      // токен по sequence flow (catch-событие/receive): только отметка доставки.
      if (bpmnIsContainer(tgt.type) || flowsTo(tgt.id).length) { tm.br.delivered = true; tm.done = true; }
    });

    const outs = seqFrom(el.id);
    if (!outs.length) {
      if (msgFrom(el.id).length) { token.done = true; continue; } // отправитель только шлёт сообщение
      token.br.dead = true; token.done = true; continue;
    }

    let taken;
    if (outs.length === 1) taken = [outs[0]];
    else if (el.type === 'gateway_and') taken = outs;
    else if (el.type === 'gateway_or') {
      const k = choose(outs.length + 1);
      taken = k < outs.length ? [outs[k]] : outs; // last option = every branch true
    } else {
      taken = [outs[choose(outs.length)]];
    }

    if (taken.length === 1) {
      if (!arrive(token, taken[0])) token.done = true;
    } else {
      // Parallel split: this token/branch takes the first flow, siblings fork
      // with a copy of the shared prefix (so animation shows them split apart
      // exactly at this gateway).
      const histBase = token.br.history;
      taken.slice(1).forEach(flow => {
        const t2 = { elId: el.id, done: false, br: newBranch([...histBase]) };
        tokens.push(t2);
        if (!arrive(t2, flow)) t2.done = true;
      });
      if (!arrive(token, taken[0])) token.done = true;
    }
  }
  tokens.forEach(t => { if (!t.done) { t.br.loop = true; } }); // step-guard hit
  // AND-join, который так и не сработал (часть веток не пришла) — дедлок
  branches.forEach(b => {
    const gw = b.parkedAt && bEl(b.parkedAt);
    if (gw && gw.type === 'gateway_and' && !joinFired[gw.id]) { b.dead = true; b.deadlock = true; }
  });

  return { branches, fresh };
}

function bpmnAutoRunScenarios() {
  const bpmn = getCurrentBpmn();
  bpmnSyncBoundaries(bpmn);
  const starts = bpmn.elements.filter(e => e.type === 'start');
  if (!starts.length) { toast('⚠ Add a Start Event first'); return; }

  // Enumerate scenario variants: run once, then for every fresh choice point
  // seen in that run schedule sibling prefixes taking each other option.
  const runs = [];
  const queue = [[]];
  let guard = 0;
  while (queue.length && runs.length < BPMN_SCEN_MAX * 2 && guard++ < 300) {
    const choices = queue.shift();
    const r = bpmnRunOnce(bpmn, choices);
    runs.push(r.branches);
    r.fresh.forEach((nOpts, i) => {
      const zeros = new Array(i).fill(0);
      for (let k = 1; k < nOpts; k++) queue.push([...choices, ...zeros, k]);
    });
  }

  // Dedup identical outcomes (different choices can converge on the same path)
  const seen = new Set();
  const found = [];
  runs.forEach(branches => {
    const key = JSON.stringify(branches.map(b => b.history.map(h => h.elId + '|' + (h.cond || ''))));
    if (seen.has(key)) return;
    seen.add(key);
    found.push(branches);
  });

  if (!found.length) { toast('⚠ No path found from Start to End'); return; }

  // Clean runs first; loop-unroll variants mostly repeat each other, so keep
  // just a few as "this process can cycle" evidence rather than a wall of them.
  const rank = branches => branches.some(b => b.loop) ? 2 : branches.some(b => b.dead) ? 1 : 0;
  found.sort((a, b) => rank(a) - rank(b));
  let loopsKept = 0;
  const trimmed = found.filter(branches => rank(branches) < 2 || ++loopsKept <= 2);

  bpmn.scenarios = trimmed.slice(0, BPMN_SCEN_MAX).map((branches, i) => {
    const dead = branches.some(b => b.dead && !b.deadlock), loop = branches.some(b => b.loop), lock = branches.some(b => b.deadlock);
    return {
      id: 'bsc' + (S.nid++),
      name: 'Scenario ' + (i + 1) + (lock ? ' ⛔ deadlock' : '') + (dead ? ' ⚠ dead end' : '') + (loop ? ' ↻ loop' : ''),
      color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      branches,
    };
  });

  bpmnStepStop(true);
  S.bpmnSim = { active: true };
  S.selected = null;
  pushHist();
  updateBpmnSimUI();
  render();
  bpmnAnimStart();
  toast(`▶ Found ${found.length} scenario${found.length > 1 ? 's' : ''}`);
}

function bpmnSimReset() {
  S.bpmnSim = { active: false };
  bpmnStepStop(true);
  bpmnAnimStop();
  updateBpmnSimUI();
  render();
}

// ═══════════════════════════════════════════════════════════════
// BALL ANIMATION — one flying ball per scenario branch, same color as its
// scenario. Balls that share a common prefix travel together, then visibly
// split apart at the exact gateway where their scenarios diverge — this is
// "наша фишка" from the C4 simulation, reused here (requestAnimationFrame +
// SVG dots in #anim-layer, same technique as sim.js).
// ═══════════════════════════════════════════════════════════════
let BPMN_ANIM = { running: false, rafId: null, dots: {}, reqs: {} };

function bpmnAnimStart() {
  bpmnAnimStop();
  const bpmn = getCurrentBpmn();
  if (!bpmn.scenarios || !bpmn.scenarios.length) return;
  BPMN_ANIM.running = true;
  let n = 0;
  bpmn.scenarios.forEach(sc => {
    sc.branches.forEach(branch => {
      if (branch.history.length < 2) return;
      const id = 'ba' + (n++);
      BPMN_ANIM.reqs[id] = { history: branch.history, idx: 0, t: Math.random() * 0.3, speed: 0.01 + Math.random() * 0.006, color: sc.color, done: false };
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '6');
      dot.style.fill = sc.color;
      dot.style.filter = `drop-shadow(0 0 5px ${sc.color})`;
      dot.style.opacity = '0';
      $('anim-layer').appendChild(dot);
      BPMN_ANIM.dots[id] = dot;
    });
  });
  BPMN_ANIM.rafId = requestAnimationFrame(bpmnAnimLoop);
}

function bpmnAnimStop() {
  if (BPMN_ANIM.rafId) cancelAnimationFrame(BPMN_ANIM.rafId);
  Object.values(BPMN_ANIM.dots).forEach(d => d && d.remove());
  BPMN_ANIM = { running: false, rafId: null, dots: {}, reqs: {} };
}

// Each ball travels its scenario's path exactly once, then stops and fades
// at wherever it ends (End event or dead end) — no re-spawning, no loop.
function bpmnAnimLoop() {
  if (!BPMN_ANIM.running) return;
  let anyActive = false;
  Object.entries(BPMN_ANIM.reqs).forEach(([id, req]) => {
    if (req.done) return;
    const dot = BPMN_ANIM.dots[id];
    if (!dot) return;

    const from = bEl(req.history[req.idx].elId);
    const nextStep = req.history[req.idx + 1];
    const to = nextStep ? bEl(nextStep.elId) : null;
    if (!from || !to) {
      req.done = true;
      dot.style.opacity = '0';
      return;
    }
    anyActive = true;

    req.t += req.speed;
    if (req.t >= 1) { req.idx++; req.t = 0; }

    const tClamped = Math.min(req.t, 1);
    // anim-layer получает тот же transform (pan+zoom), что и диаграмма — см. renderBpmnDiagram
    const cur = req.history[req.idx], nxt = req.history[req.idx + 1];
    const pts = nxt ? bpmnHopPoints(getCurrentBpmn(), cur.elId, nxt.elId) : null;
    const p = pts ? bpmnPolyAt(pts, tClamped) : bpmnCenter(from);
    dot.setAttribute('cx', p.x.toFixed(1));
    dot.setAttribute('cy', p.y.toFixed(1));
    dot.style.opacity = '1';
  });
  if (anyActive) BPMN_ANIM.rafId = requestAnimationFrame(bpmnAnimLoop);
  else BPMN_ANIM.running = false; // every ball has arrived — animation ends itself
}

// ── Пошаговая симуляция: токены выбранного сценария двигаются по шагу ──
// S.bpmnStep = { active, scId, k }  (k — глобальный «такт»: ветка i стоит
// на history[min(k, len-1)]; ветки AND-форка начинаются с общего префикса).
let BPMN_STEP_TIMER = null;
function bpmnStepScenario() {
  const st = S.bpmnStep; if (!st || !st.active) return null;
  return (getCurrentBpmn().scenarios || []).find(sc => sc.id === st.scId) || null;
}
function bpmnStepMax(sc) { return Math.max(0, ...sc.branches.map(b => b.history.length - 1)); }
function bpmnStepRecalc() {
  const st = S.bpmnStep, sc = bpmnStepScenario();
  if (!st || !sc) return;
  st.activeIds = new Set(); st.visitedIds = new Set();
  sc.branches.forEach(b => {
    const k = Math.min(st.k, b.history.length - 1);
    for (let i = 0; i < k; i++) st.visitedIds.add(b.history[i].elId);
    st.activeIds.add(b.history[k].elId);
  });
}
function bpmnStepStart(scId) {
  const sc = (getCurrentBpmn().scenarios || []).find(x => x.id === scId);
  if (!sc) return;
  bpmnAnimStop();
  S.bpmnSim = { active: true };
  S.bpmnStep = { active: true, scId, k: 0 };
  bpmnStepRecalc();
  updateBpmnSimUI(); render();
}
function bpmnStepGo(delta) {
  const sc = bpmnStepScenario(); if (!sc) return;
  const st = S.bpmnStep;
  st.k = Math.max(0, Math.min(bpmnStepMax(sc), st.k + delta));
  bpmnStepRecalc();
  if (st.k >= bpmnStepMax(sc)) bpmnStepPause();
  if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
  render();
}
function bpmnStepPlay() {
  const sc = bpmnStepScenario(); if (!sc) return;
  if (BPMN_STEP_TIMER) { bpmnStepPause(); return; }
  if (S.bpmnStep.k >= bpmnStepMax(sc)) S.bpmnStep.k = -1;
  BPMN_STEP_TIMER = setInterval(() => bpmnStepGo(1), 650);
  bpmnStepGo(1);
}
function bpmnStepPause() {
  if (BPMN_STEP_TIMER) clearInterval(BPMN_STEP_TIMER);
  BPMN_STEP_TIMER = null;
}
function bpmnStepStop(silent) {
  bpmnStepPause();
  const was = S.bpmnStep && S.bpmnStep.active;
  S.bpmnStep = { active: false };
  if (!silent && was) { bpmnAnimStart(); updateBpmnSimUI(); render(); }
}

function updateBpmnSimUI() {
  const active = S.bpmnSim && S.bpmnSim.active;
  const runBtn = $('bpmn-sim-run-btn'), stopBtn = $('bpmn-sim-stop-btn');
  if (runBtn) runBtn.style.display = active ? 'none' : '';
  if (stopBtn) stopBtn.style.display = active ? '' : 'none';
  if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
}

function bpmnDeleteScenario(scenarioId) {
  const bpmn = getCurrentBpmn();
  bpmn.scenarios = (bpmn.scenarios || []).filter(s => s.id !== scenarioId);
  if (S.bpmnStep && S.bpmnStep.scId === scenarioId) bpmnStepStop();
  pushHist();
  if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
  render(); // раньше след удалённого сценария оставался на холсте до следующей перерисовки
}

// ═══════════════════════════════════════════════════════════════
// KILLER FEATURE — one click turns a captured scenario run into a UML
// Sequence diagram, reusing Raptor's existing seq.js renderer untouched.
// Participants = Lanes the visited elements sit in (geometric containment);
// same-lane steps become "note over" (internal work), cross-lane steps
// become real arrows (a handoff), intermediate wait events become "...text...".
// ═══════════════════════════════════════════════════════════════
// Participants come from real BPMN structure when it's there: a Lane (role
// inside a Pool) is the most specific, then the Pool itself, via geometric
// containment. Without any Lane/Pool, everything would otherwise collapse
// onto a single "Process" column full of notes — unreadable — so we fall
// back to a 2-participant Client/Process story: Client kicks the process off
// at Start and gets the reply at End, internal steps stay as notes on Process.
function bpmnParticipantFor(el, hasContainers) {
  if (!hasContainers) return el.type === 'start' || el.type === 'end' ? 'Client' : 'Process';
  const bpmn = getCurrentBpmn();
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const lane = bpmn.elements.find(l => l.type === 'lane' && cx >= l.x && cx <= l.x + l.w && cy >= l.y && cy <= l.y + l.h);
  if (lane) return lane.label || 'Lane';
  const pool = bpmn.elements.find(p => p.type === 'pool' && cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h);
  if (pool) return pool.label || 'Pool';
  return 'Process';
}
function bpmnSeqQ(s) { return /\s/.test(s) ? '"' + s + '"' : s; }

function bpmnScenarioToSeqText(scenario) {
  const bpmn = getCurrentBpmn();
  const hasContainers = bpmn.elements.some(e => e.type === 'lane' || e.type === 'pool');
  const lines = ['# ' + scenario.name, ''];

  // Gateways are pure routing — they'd only add "note over X: split/join"
  // noise, so they're dropped; a branch condition on a gateway hop carries
  // over to the next visible step. Artifacts and joined-stub tails drop too.
  function visibleSteps(history) {
    const out = [];
    let pendingCond = null;
    for (const step of history) {
      const el = bEl(step.elId);
      if (!el) continue;
      const cond = step.cond && step.cond !== 'joined' ? step.cond : null;
      if (el.type.startsWith('gateway_')) { if (cond) pendingCond = cond; continue; }
      if (bpmnIsArtifact(el.type)) continue;
      out.push({ elId: step.elId, label: step.label, cond: cond || pendingCond });
      pendingCond = null;
    }
    return out;
  }

  const branchSteps = scenario.branches.map(br => visibleSteps(br.history));

  // Branches copy their shared prefix at the split — emit it ONCE up front,
  // and put only the genuinely diverging suffixes inside the par block.
  let prefixLen = branchSteps.length ? branchSteps[0].length : 0;
  for (let b = 1; b < branchSteps.length; b++) {
    let i = 0;
    while (i < prefixLen && i < branchSteps[b].length && branchSteps[b][i].elId === branchSteps[0][i].elId) i++;
    prefixLen = i;
  }
  const prefix = branchSteps.length ? branchSteps[0].slice(0, prefixLen) : [];
  const suffixes = branchSteps.map(steps => steps.slice(prefixLen)).filter(sfx => sfx.length);

  const partFor = el => bpmnParticipantFor(el, hasContainers);
  const seenLanes = [];
  [prefix, ...suffixes].forEach(steps => steps.forEach(s => {
    const el = bEl(s.elId); if (!el) return;
    const p = partFor(el);
    if (!seenLanes.includes(p)) seenLanes.push(p);
  }));
  if (!seenLanes.length) seenLanes.push('Process');
  // Client first when present, so it renders as the leftmost/initiating column
  seenLanes.sort((a, b) => (a === 'Client' ? -1 : b === 'Client' ? 1 : 0));
  seenLanes.forEach(lane => lines.push('participant ' + bpmnSeqQ(lane)));
  lines.push('autonumber', '');

  let globalFirst = true;
  function emitSteps(steps, startLane) {
    let prevLane = startLane;
    steps.forEach(step => {
      const el = bEl(step.elId);
      const lane = el ? partFor(el) : 'Process';
      const label = (el ? el.label : step.label) || '';
      const cond = step.cond;
      const isWait = el && (el.type.startsWith('event_') || bpmnIsBoundary(el.type)) && !globalFirst;
      globalFirst = false;
      if (isWait) {
        lines.push('...' + (cond && !label.includes(cond) ? cond + ': ' : '') + label + '...');
        prevLane = lane;
        return;
      }
      if (!hasContainers && el && el.type === 'start') {
        lines.push(`${bpmnSeqQ(lane)} -> ${bpmnSeqQ('Process')}: ${label}`);
        prevLane = 'Process';
        return;
      }
      if (!hasContainers && el && el.type === 'end') {
        lines.push(`${bpmnSeqQ(prevLane || 'Process')} --> ${bpmnSeqQ(lane)}: ${label}`);
        prevLane = lane;
        return;
      }
      if (prevLane === null || prevLane === lane) {
        lines.push(`note over ${bpmnSeqQ(lane)}: ${label}${cond ? ` (${cond})` : ''}`);
      } else {
        lines.push(`${bpmnSeqQ(prevLane)} -> ${bpmnSeqQ(lane)}: ${label}${cond ? ` // ${cond}` : ''}`);
      }
      prevLane = lane;
    });
    return prevLane;
  }

  const laneAfterPrefix = emitSteps(prefix, null);

  if (suffixes.length === 1) {
    emitSteps(suffixes[0], laneAfterPrefix);
  } else if (suffixes.length > 1) {
    lines.push('par parallel branches');
    suffixes.forEach((sfx, i) => {
      if (i > 0) lines.push('else branch ' + (i + 1));
      emitSteps(sfx, laneAfterPrefix);
    });
    lines.push('end');
  }
  return lines.join('\n');
}

function bpmnViewScenarioSeq(scenarioId) {
  const bpmn = getCurrentBpmn();
  const scenario = (bpmn.scenarios || []).find(s => s.id === scenarioId);
  if (!scenario) return;
  const text = bpmnScenarioToSeqText(scenario);
  if (typeof SEQ_ACTOR !== 'undefined') SEQ_ACTOR = null;
  if (typeof SEQ_SCEN !== 'undefined') SEQ_SCEN = null;
  const modal = $('seq-modal'); if (!modal) return;
  modal.style.display = 'flex';
  $('seq-title').textContent = '🔀 ' + scenario.name;
  $('seq-input').value = text;
  renderSeq();
}

// ═══════════════════════════════════════════════════════════════
// SIMULATION RENDERING — canvas overlay: every discovered scenario drawn
// as its own colored trail, all at once, so branches and their outcomes
// are visible in a single glance instead of one click-through at a time.
// ═══════════════════════════════════════════════════════════════
function drawBpmnSimOverlay(g, fG) {
  const sim = S.bpmnSim;
  if (!sim || !sim.active) return;
  const bpmn = getCurrentBpmn();
  const step = S.bpmnStep && S.bpmnStep.active ? S.bpmnStep : null;
  const scenarios = (bpmn.scenarios || []).filter(sc => !step || sc.id === step.scId);

  scenarios.forEach(sc => {
    sc.branches.forEach(branch => {
      const upTo = step ? Math.min(step.k, branch.history.length - 1) : branch.history.length - 1;
      for (let i = 0; i < upTo; i++) {
        const from = bEl(branch.history[i].elId), to = bEl(branch.history[i + 1].elId);
        if (!from || !to) continue;
        const pts = bpmnHopPoints(bpmn, from.id, to.id);
        if (!pts) continue;
        mkEl('path', { d: bpmnPolyD(pts), class: 'bpmn-sim-trail', fill: 'none', stroke: sc.color, 'stroke-width': 3.5, opacity: '0.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, fG);
        // condition label at the midpoint, when this hop was a gateway branch
        const cond = branch.history[i + 1].cond;
        if (cond && cond !== 'joined') {
          const lp = bpmnPolyLabelPos(pts);
          const mx = lp.x, my = lp.y + 18;
          const tw = cond.length * 5.6 + 8;
          mkEl('rect', { x: (mx - tw / 2).toFixed(1), y: (my - 8).toFixed(1), width: tw.toFixed(1), height: 14, rx: 3, fill: '#faf4e8', stroke: sc.color }, fG);
          mkTxt(mx, my - 1, cond, `font-size:9px;fill:${sc.color};font-weight:700`, fG);
        }
      }
      if (step) { // пошаговый режим: «токен» на текущем элементе ветки
        const cur = bEl(branch.history[upTo].elId);
        if (cur) {
          const c = bpmnCenter(cur), r = Math.max(cur.w, cur.h) / 2 + 9;
          const parked = branch.history[upTo].cond === 'joined';
          mkEl('circle', { cx: c.x, cy: c.y, r, class: 'bpmn-token-ring' + (parked ? ' is-waiting' : ''), fill: 'none', stroke: sc.color, 'stroke-width': 3, 'stroke-dasharray': parked ? '4 3' : 'none' }, g);
          mkEl('circle', { cx: cur.x + cur.w, cy: cur.y, r: 6, class: 'bpmn-token', fill: sc.color, stroke: '#faf4e8', 'stroke-width': 1.5 }, g);
        }
        return;
      }
      // marker at the branch's final element
      const last = bEl(branch.history[branch.history.length - 1].elId);
      if (last) {
        const cx = last.x + last.w / 2, cy = last.y + last.h / 2;
        mkEl('circle', { cx, cy, r: Math.max(last.w, last.h) / 2 + 7, fill: 'none', stroke: sc.color, 'stroke-width': 2.2, 'stroke-dasharray': branch.dead ? '2 3' : 'none' }, g);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// MOUSE INTERACTION — delegated from interact.js when S.notationMode==='bpmn'
// ═══════════════════════════════════════════════════════════════
function bpmnMouseDown(e) {
  if (e.button !== 0) return;
  if (S.bpmnSim && S.bpmnSim.active) { toast('⏹ Editing is frozen while scenario colors are shown — press Stop first'); return; }
  const pt = svgPt(e);
  const bpmn = getCurrentBpmn();

  // Placing a new element chosen from the palette
  if (S.bpmnPalSel) {
    const type = S.bpmnPalSel;
    const def = BPMN_EL[type];
    let el;
    if (bpmnIsBoundary(type)) {
      // Boundary events don't stand alone — they attach to the Task clicked
      const hostId = bpmnElementAt(pt);
      const host = hostId ? bEl(hostId) : null;
      if (!host || !bpmnCanHostBoundary(host.type)) { toast('⚠ Click a Task or Sub-Process to attach the boundary event'); return; }
      el = { id: 'be' + (S.nid++), type, label: def.lbl, attachedTo: host.id, x: 0, y: 0, w: def.w, h: def.h };
      bpmn.elements.push(el);
      bpmnSyncBoundaries(bpmn);
    } else {
      el = { id: 'be' + (S.nid++), type, label: def.lbl, x: bpmnSnap(pt.x - def.w / 2), y: bpmnSnap(pt.y - def.h / 2), w: def.w, h: def.h };
      bpmn.elements.push(el);
      if (type === 'lane') bpmnDockLane(el);
      if (type === 'pool') bpmnRestackPools(); // dropped pool snaps into the block
    }
    S.bpmnPalSel = null;
    S.selected = el.id;
    S.bpmnMulti = [];
    if (typeof buildPalette === 'function') buildPalette();
    pushHist();
    if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
    render();
    return;
  }

  const elId = bpmnElementAt(pt);
  // Связь выбирается раньше пула/дорожки: раньше клик по стрелке внутри пула
  // выделял дорожку (контейнер перехватывал mousedown, а hit-линия терялась
  // при перерисовке).
  const hitEl = elId ? bEl(elId) : null;
  if (!hitEl || bpmnIsContainer(hitEl.type)) {
    const fid = bpmnFlowAt(pt);
    if (fid) {
      S.selected = fid; S.bpmnMulti = [];
      if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
      render();
      return;
    }
  }
  if (elId) {
    const el = bEl(elId);
    // Connection can start from any of the four side ports
    if (!bpmnIsContainer(el.type)) {
      const pr = 9 / (S.zoom || 1);
      const port = bpmnPorts(el).find(p => Math.hypot(pt.x - p.x, pt.y - p.y) <= pr);
      if (port) {
        S.mode = 'bpmn-connecting';
        S.bpmnConnFrom = elId;
        S.tempX = pt.x; S.tempY = pt.y;
        render();
        return;
      }
    }
    S.mode = 'bpmn-dragging';
    S.bpmnDragId = elId;
    S.dragOx = e.clientX; S.dragOy = e.clientY;
    S.bpmnDragMulti = (S.bpmnMulti || []).includes(elId);
    if (!S.bpmnDragMulti) S.bpmnMulti = [];
    // Исходные позиции всей перетаскиваемой группы — смещение считается от них,
    // чтобы привязка к сетке/выравнивание не накапливали ошибку.
    const grp = S.bpmnDragMulti ? (S.bpmnMulti || []).map(bEl).filter(Boolean) : bpmnDragGroup(el);
    S.bpmnDragOrig = { x: e.clientX, y: e.clientY, pos: grp.map(m => ({ id: m.id, x: m.x, y: m.y })) };
    S.bpmnDragMoved = false;
    if (S.selected !== elId) { S.selected = elId; if (typeof renderBpmnPanel === 'function') renderBpmnPanel(); }
    render();
    return;
  }

  // Empty canvas: start a marquee (rubber-band) selection
  S.mode = 'bpmn-marquee';
  S.bpmnMarq = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
  if (S.selected !== null || (S.bpmnMulti || []).length) {
    S.selected = null; S.bpmnMulti = [];
    if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
  }
  render();
}

const BPMN_GRID = 10;
const BPMN_ALIGN_TOL = 6; // px экрана — порог «прилипания» к соседу
function bpmnSnap(v) { return Math.round(v / BPMN_GRID) * BPMN_GRID; }

// Смарт-направляющие: подбирает смещение (dx,dy) так, чтобы центр/край
// перетаскиваемого элемента совпал с центром/краем соседнего. Если соседа
// рядом нет — привязка к сетке. Alt отключает и то и другое.
function bpmnAlignDelta(el, orig, dx, dy, movedIds, free) {
  const guides = [];
  if (free) return { dx, dy, guides };
  const bpmn = getCurrentBpmn();
  const tol = BPMN_ALIGN_TOL / (S.zoom || 1);
  const nx = orig.x + dx, ny = orig.y + dy;
  let bestX = null, bestY = null;
  if (!bpmnIsContainer(el.type)) {
    const mine = { xs: [nx + el.w / 2, nx, nx + el.w], ys: [ny + el.h / 2, ny, ny + el.h] };
    bpmn.elements.forEach(o => {
      if (movedIds.has(o.id) || bpmnIsContainer(o.type) || bpmnIsBoundary(o.type)) return;
      const ox = [o.x + o.w / 2, o.x, o.x + o.w], oy = [o.y + o.h / 2, o.y, o.y + o.h];
      for (let k = 0; k < 3; k++) {
        const ddx = ox[k] - mine.xs[k];
        if (Math.abs(ddx) <= tol && (!bestX || Math.abs(ddx) < Math.abs(bestX.d))) bestX = { d: ddx, at: ox[k], o };
        const ddy = oy[k] - mine.ys[k];
        if (Math.abs(ddy) <= tol && (!bestY || Math.abs(ddy) < Math.abs(bestY.d))) bestY = { d: ddy, at: oy[k], o };
      }
    });
  }
  let rx, ry;
  if (bestX) { rx = dx + bestX.d; const o = bestX.o; guides.push({ x1: bestX.at, y1: Math.min(o.y, ny) - 12, x2: bestX.at, y2: Math.max(o.y + o.h, ny + el.h) + 12 }); }
  else rx = bpmnSnap(orig.x + dx) - orig.x;
  if (bestY) { ry = dy + bestY.d; const o = bestY.o; guides.push({ x1: Math.min(o.x, nx) - 12, y1: bestY.at, x2: Math.max(o.x + o.w, nx + el.w) + 12, y2: bestY.at }); }
  else ry = bpmnSnap(orig.y + dy) - orig.y;
  return { dx: rx, dy: ry, guides };
}

// Выравнивание и распределение выделенной группы (кнопки в панели)
function bpmnAlignSelection(mode) {
  const els = (S.bpmnMulti || []).map(bEl).filter(e => e && !bpmnIsContainer(e.type) && !bpmnIsBoundary(e.type));
  if (els.length < 2) return;
  const minX = Math.min(...els.map(e => e.x)), maxR = Math.max(...els.map(e => e.x + e.w));
  const minY = Math.min(...els.map(e => e.y)), maxB = Math.max(...els.map(e => e.y + e.h));
  if (mode === 'left') els.forEach(e => { e.x = minX; });
  else if (mode === 'right') els.forEach(e => { e.x = maxR - e.w; });
  else if (mode === 'top') els.forEach(e => { e.y = minY; });
  else if (mode === 'bottom') els.forEach(e => { e.y = maxB - e.h; });
  else if (mode === 'hcenter') { const c = els.reduce((a, e) => a + e.x + e.w / 2, 0) / els.length; els.forEach(e => { e.x = Math.round(c - e.w / 2); }); }
  else if (mode === 'vcenter') { const c = els.reduce((a, e) => a + e.y + e.h / 2, 0) / els.length; els.forEach(e => { e.y = Math.round(c - e.h / 2); }); }
  else if (mode === 'hdist' && els.length > 2) {
    const sorted = [...els].sort((a, b) => a.x - b.x);
    const total = sorted.reduce((a, e) => a + e.w, 0);
    const gap = (maxR - minX - total) / (sorted.length - 1);
    let x = minX; sorted.forEach(e => { e.x = Math.round(x); x += e.w + gap; });
  } else if (mode === 'vdist' && els.length > 2) {
    const sorted = [...els].sort((a, b) => a.y - b.y);
    const total = sorted.reduce((a, e) => a + e.h, 0);
    const gap = (maxB - minY - total) / (sorted.length - 1);
    let y = minY; sorted.forEach(e => { e.y = Math.round(y); y += e.h + gap; });
  }
  bpmnSyncBoundaries(getCurrentBpmn());
  pushHist();
  render();
}

// Everything a drag of `el` carries along: a container drags its contents,
// an activity drags its boundary events. Returns array of elements to move.
function bpmnDragGroup(el) {
  const bpmn = getCurrentBpmn();
  let group = [el];
  if (el.type === 'pool') {
    // Pools are ONE sticky block: dragging any pool moves every pool plus
    // everything sitting inside any of them.
    const pools = bpmn.elements.filter(o => o.type === 'pool');
    const inAnyPool = o => pools.some(p => {
      const c = bpmnCenter(o); return c.x >= p.x && c.x <= p.x + p.w && c.y >= p.y && c.y <= p.y + p.h;
    });
    group = group.concat(bpmn.elements.filter(o => o !== el && (o.type === 'pool' || inAnyPool(o))));
  } else if (el.type === 'lane') {
    group = group.concat(bpmn.elements.filter(o => o !== el && !bpmnIsContainer(o.type) && (() => {
      const c = bpmnCenter(o); return c.x >= el.x && c.x <= el.x + el.w && c.y >= el.y && c.y <= el.y + el.h;
    })()));
  }
  return group;
}

function bpmnMouseMove(e, pt) {
  if (S.mode === 'bpmn-resizing') {
    const el = bEl(S.bpmnResizeId);
    if (el) {
      const z = S.zoom || 1;
      el.w = Math.max(120, Math.round(S.rsW + (e.clientX - S.rsOx) / z));
      el.h = Math.max(80, Math.round(S.rsH + (e.clientY - S.rsOy) / z));
      if (!e.altKey) { el.w = Math.max(120, bpmnSnap(el.w)); el.h = Math.max(80, bpmnSnap(el.h)); }
      // Sticky containers: pool resize re-fits its lane stack live; lane
      // resize restacks siblings below and grows the pool.
      if (el.type === 'pool') bpmnRestackPool(el);
      else if (el.type === 'lane') {
        const c = bpmnCenter(el);
        const pool = getCurrentBpmn().elements.find(p => p.type === 'pool' && c.x >= p.x && c.x <= p.x + p.w && c.y >= p.y && c.y <= p.y + p.h);
        if (pool) bpmnRestackPool(pool);
      }
    }
    render();
    return;
  }
  if (S.mode === 'bpmn-dragging') {
    const el = bEl(S.bpmnDragId);
    const O = S.bpmnDragOrig;
    if (el && O && !bpmnIsBoundary(el.type)) { // boundaries ride their host, not the mouse
      const z = S.zoom || 1;
      const rawDx = (e.clientX - O.x) / z, rawDy = (e.clientY - O.y) / z;
      if (Math.abs(rawDx) + Math.abs(rawDy) > 2 / z) S.bpmnDragMoved = true;
      const orig = O.pos.find(p => p.id === el.id) || { x: el.x, y: el.y };
      const movedIds = new Set(O.pos.map(p => p.id));
      const a = bpmnAlignDelta(el, orig, rawDx, rawDy, movedIds, e.altKey);
      S.bpmnGuides = a.guides;
      O.pos.forEach(p => { const m = bEl(p.id); if (m && !bpmnIsBoundary(m.type)) { m.x = p.x + a.dx; m.y = p.y + a.dy; } });
      bpmnSyncBoundaries(getCurrentBpmn());
    }
    render();
    return;
  }
  if (S.mode === 'bpmn-connecting') {
    S.tempX = pt.x; S.tempY = pt.y;
    render();
    return;
  }
  if (S.mode === 'bpmn-marquee') {
    S.bpmnMarq.x1 = pt.x; S.bpmnMarq.y1 = pt.y;
    render();
    return;
  }
  const elId = bpmnElementAt(pt);
  if (elId !== S.bpmnHovered) { S.bpmnHovered = elId; render(); }
}

function bpmnMouseUp(e) {
  if (S.mode === 'bpmn-resizing') {
    pushHist();
    S.mode = 'idle'; S.bpmnResizeId = null;
    return;
  }
  if (S.mode === 'bpmn-connecting') {
    const pt = svgPt(e);
    const bpmn = getCurrentBpmn();
    const targetId = bpmnElementAt(pt);
    if (targetId && targetId !== S.bpmnConnFrom
        && !bpmnIsContainer(bEl(targetId).type)
        && !bpmnIsBoundary(bEl(targetId).type) // boundary events only emit flows, never receive
        && !bpmn.flows.find(f => f.from === S.bpmnConnFrom && f.to === targetId)) {
      bpmn.flows.push({ id: 'bf' + (S.nid++), from: S.bpmnConnFrom, to: targetId });
      pushHist();
    }
    S.mode = 'idle'; S.bpmnConnFrom = null;
    if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
    render();
    return;
  }
  if (S.mode === 'bpmn-dragging') {
    // Snap whatever was dragged to the grid, then settle boundaries on hosts
    // Сетка/выравнивание уже применены в bpmnMouseMove (от исходных позиций)
    const bpmn = getCurrentBpmn();
    const el = bEl(S.bpmnDragId);
    if (el && !bpmnIsBoundary(el.type) && S.bpmnDragMoved) {
      if (el.type === 'lane') bpmnDockLane(el); // dropped into a pool → dock into the lane stack
      bpmnSyncBoundaries(bpmn);
    }
    if (S.bpmnDragMoved) pushHist(); // простой клик не плодит шаг истории
    S.mode = 'idle'; S.bpmnDragId = null; S.bpmnDragMulti = false; S.bpmnDragOrig = null; S.bpmnGuides = null;
    render();
    return;
  }
  if (S.mode === 'bpmn-marquee') {
    const m = S.bpmnMarq;
    const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1);
    const y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
    const bpmn = getCurrentBpmn();
    S.bpmnMulti = bpmn.elements
      .filter(el => !bpmnIsContainer(el.type) && !bpmnIsBoundary(el.type))
      .filter(el => { const c = bpmnCenter(el); return c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1; })
      .map(el => el.id);
    S.selected = S.bpmnMulti.length === 1 ? S.bpmnMulti[0] : null;
    if (S.bpmnMulti.length === 1) S.bpmnMulti = [];
    S.mode = 'idle'; S.bpmnMarq = null;
    if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
    render();
    return;
  }
  S.mode = 'idle';
}

// Duplicate current selection (single element or marquee group) with flows
// between the copied elements; boundary events follow their copied host.
function bpmnDuplicateSelection() {
  const bpmn = getCurrentBpmn();
  let ids = (S.bpmnMulti || []).length ? [...S.bpmnMulti]
    : (S.selected && S.selected.startsWith('be')) ? [S.selected] : [];
  if (!ids.length) return;
  // boundaries of copied hosts come along
  bpmn.elements.forEach(el => {
    if (bpmnIsBoundary(el.type) && ids.includes(el.attachedTo) && !ids.includes(el.id)) ids.push(el.id);
  });
  const map = {};
  const copies = ids.map(id => bEl(id)).filter(Boolean).map(src => {
    const copy = { ...src, id: 'be' + (S.nid++), x: src.x + 24, y: src.y + 24 };
    map[src.id] = copy.id;
    return copy;
  });
  copies.forEach(c => { if (c.attachedTo && map[c.attachedTo]) c.attachedTo = map[c.attachedTo]; });
  bpmn.elements.push(...copies);
  bpmn.flows.filter(f => map[f.from] && map[f.to]).forEach(f => {
    bpmn.flows.push({ ...f, id: 'bf' + (S.nid++), from: map[f.from], to: map[f.to] });
  });
  bpmnSyncBoundaries(bpmn);
  S.bpmnMulti = copies.filter(c => !bpmnIsBoundary(c.type)).map(c => c.id);
  S.selected = S.bpmnMulti.length === 1 ? S.bpmnMulti[0] : null;
  pushHist();
  if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
  render();
  toast('⧉ Duplicated ' + copies.length + ' element' + (copies.length > 1 ? 's' : ''));
}

function bpmnDblClick(e) {
  if (S.bpmnSim && S.bpmnSim.active) return;
  const pt = svgPt(e);
  const elId = bpmnElementAt(pt);
  const el = elId ? bEl(elId) : null;
  if (!el || bpmnIsContainer(el.type)) {
    const fid = bpmnFlowAt(pt);
    if (fid) { bpmnStartRename(fid); return; }
  }
  if (elId) bpmnStartRename(elId);
}

// Inline-переименование элемента или подписи связи.
// Исправлено: Enter/blur больше не вызывают done() дважды (падало
// «Failed to execute 'remove'»), Escape теперь отменяет правку, позиция
// поля учитывает зум.
function bpmnStartRename(id) {
  const bpmn = getCurrentBpmn();
  const el = bEl(id), flow = el ? null : bFlow(id);
  if (!el && !flow) return;
  const r = svgRct(), z = S.zoom || 1;
  let bx, by, bw;
  if (el) { bx = el.x + 4; by = el.y + el.h / 2; bw = Math.max(60, el.w - 8); }
  else {
    const pts = bpmnFlowPoints(bpmn, flow); if (!pts) return;
    const lp = bpmnPolyLabelPos(pts); bw = 120; bx = lp.x - bw / 2; by = lp.y;
  }
  const inp = document.createElement('input');
  inp.className = 'bpmn-rename-input';
  inp.style.left = (r.left + bx * z + S.panX) + 'px';
  inp.style.top = (r.top + by * z + S.panY - 11) + 'px';
  inp.style.width = Math.max(60, bw * z) + 'px';
  inp.value = el ? el.label : (flow.label || '');
  if (!el) inp.placeholder = 'condition…';
  document.body.appendChild(inp);
  inp.focus(); inp.select();
  let finished = false;
  const finish = commit => {
    if (finished) return;
    finished = true;
    const v = inp.value.trim();
    if (inp.parentNode) inp.remove();
    if (!commit) return;
    if (el) { if (!v || v === el.label) return; el.label = v; }
    else { if (v === (flow.label || '')) return; flow.label = v; }
    pushHist();
    if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
    render();
  };
  inp.onblur = () => finish(true);
  inp.onkeydown = ev => {
    ev.stopPropagation(); // Delete/Backspace в поле не должны удалять элемент
    if (ev.key === 'Enter') finish(true);
    else if (ev.key === 'Escape') finish(false);
  };
}

// Delete currently selected BPMN element or flow (wired from bootstrap.js keydown)
function bpmnDeleteSelected() {
  const bpmn = getCurrentBpmn();
  const ids = (S.bpmnMulti || []).length ? [...S.bpmnMulti] : (S.selected ? [S.selected] : []);
  if (!ids.length) return;
  const elIds = new Set(ids.filter(id => id.startsWith('be')));
  // deleting a host takes its boundary events with it
  bpmn.elements.forEach(el => { if (bpmnIsBoundary(el.type) && elIds.has(el.attachedTo)) elIds.add(el.id); });
  const flowIds = new Set(ids.filter(id => id.startsWith('bf')));
  bpmn.elements = bpmn.elements.filter(x => !elIds.has(x.id));
  bpmn.flows = bpmn.flows.filter(f => !flowIds.has(f.id) && !elIds.has(f.from) && !elIds.has(f.to));
  S.selected = null;
  S.bpmnMulti = [];
  pushHist();
  if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
  render();
}

// ═══════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════
let BPMN_ISSUES = [], BPMN_ISSUE_BY_ID = {};

function renderBpmnDiagram() {
  bpmnSanitizeState(); // старые/импортированные проекты: неизвестные типы, NaN-размеры, висячие связи, коллизии id
  const bpmn = getCurrentBpmn();
  bpmnSyncBoundaries(bpmn);
  BPMN_ISSUES = bpmnValidate(bpmn);
  BPMN_ISSUE_BY_ID = {};
  BPMN_ISSUES.forEach(iss => {
    if (!iss.id) return;
    if (!BPMN_ISSUE_BY_ID[iss.id] || iss.sev === 'error') BPMN_ISSUE_BY_ID[iss.id] = iss;
  });
  const g = $('block-layer');
  const fG = $('conn-layer');
  g.innerHTML = '';
  fG.innerHTML = '';
  // Раньше BPMN игнорировал S.zoom, а svgPt() делит на него — после зума в C4
  // клики/перетаскивание в BPMN промахивались. Теперь все три слоя в одной системе.
  const tf = `translate(${S.panX},${S.panY}) scale(${S.zoom || 1})`;
  g.setAttribute('transform', tf);
  fG.setAttribute('transform', tf);
  const A = $('anim-layer'); if (A) A.setAttribute('transform', tf);
  bpmnEnsureMarkers(fG);

  // Containers drawn first, behind everything: Pool is the outer/lowest
  // layer, Lane nests inside it.
  bpmn.elements.filter(el => el.type === 'pool').forEach(el => drawPool(g, el));
  bpmn.elements.filter(el => el.type === 'lane').forEach(el => drawLane(g, el));

  // Sequence / Message flows (kind decided dynamically from Pool membership)
  bpmn.flows.forEach(flow => drawFlow(fG, bpmn, flow));

  // Temp connecting line
  if (S.mode === 'bpmn-connecting' && S.bpmnConnFrom) {
    const from = bEl(S.bpmnConnFrom);
    if (from) {
      const p = bpmnEdgePoint(from, { x: S.tempX, y: S.tempY });
      mkEl('line', { x1: p.x, y1: p.y, x2: S.tempX, y2: S.tempY, class: 'bpmn-flow-temp', stroke: '#1e4a90', 'stroke-width': '1.8', 'stroke-dasharray': '5 4' }, fG);
    }
  }

  // Regular (non-container) elements on top; boundary events above their hosts
  bpmn.elements.filter(el => !bpmnIsContainer(el.type) && !bpmnIsBoundary(el.type)).forEach(el => drawBpmnElement(g, el));
  bpmn.elements.filter(el => bpmnIsBoundary(el.type)).forEach(el => drawBpmnElement(g, el));

  drawBpmnSimOverlay(g, fG);

  // Смарт-направляющие выравнивания во время перетаскивания
  (S.bpmnGuides || []).forEach(gd => mkEl('line', { ...gd, class: 'bpmn-guide', stroke: '#e0489a', 'stroke-width': 1 / (S.zoom || 1), 'stroke-dasharray': '4 3', 'pointer-events': 'none' }, g));

  // Marquee selection rectangle
  if (S.mode === 'bpmn-marquee' && S.bpmnMarq) {
    const m = S.bpmnMarq;
    mkEl('rect', {
      x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1),
      width: Math.abs(m.x1 - m.x0), height: Math.abs(m.y1 - m.y0),
      fill: '#1e4a9014', stroke: '#1e4a90', 'stroke-width': 1, 'stroke-dasharray': '4 3',
    }, g);
  }
  if (typeof updateStatus === 'function') updateStatus();
}

function drawLane(g, el) {
  const selected = S.selected === el.id;
  // Transparent body: conn-layer (flows) sits BELOW block-layer (lanes+elements) in
  // the shared SVG stack, so an opaque pool fill would hide any connection line
  // running underneath it. Only the border and the small label header stay solid.
  mkEl('rect', { x: el.x, y: el.y, width: el.w, height: el.h, class: 'bpmn-lane' + (selected ? ' is-selected' : ''), 'data-el-id': el.id, fill: 'none', stroke: '#6c7086', 'stroke-width': selected ? '2.5' : '1.5' }, g);
  mkEl('rect', { x: el.x, y: el.y, width: 34, height: el.h, class: 'bpmn-lane-header', fill: BPMN_EL.lane.clr, 'fill-opacity': '0.85', stroke: '#6c7086', 'stroke-width': '1' }, g);
  const label = document.createElementNS(NS, 'text');
  label.setAttribute('x', el.x + 17);
  label.setAttribute('y', el.y + el.h / 2);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('dominant-baseline', 'central');
  label.setAttribute('font-size', '11');
  label.setAttribute('font-weight', '600');
  label.setAttribute('fill', '#1a1410');
  label.setAttribute('pointer-events', 'none');
  label.setAttribute('transform', `rotate(-90 ${el.x + 17} ${el.y + el.h / 2})`);
  label.textContent = el.label || BPMN_EL.lane.lbl;
  g.appendChild(label);

  if (selected) drawContainerResizeHandle(g, el);
}

// Pool = the outer container (a whole separate system/organization). Header
// bar runs along the TOP (vs. Lane's LEFT bar) so the two read as distinct
// nesting levels at a glance — a Pool typically holds several Lanes.
function drawPool(g, el) {
  const selected = S.selected === el.id;
  const hovered = S.bpmnHovered === el.id;
  mkEl('rect', { x: el.x, y: el.y, width: el.w, height: el.h, class: 'bpmn-pool' + (selected ? ' is-selected' : ''), 'data-el-id': el.id, fill: 'none', stroke: '#4a4030', 'stroke-width': selected ? '3' : '2' }, g);
  mkEl('rect', { x: el.x, y: el.y, width: el.w, height: 24, class: 'bpmn-pool-header', fill: BPMN_EL.pool.clr, 'fill-opacity': '0.85', stroke: '#4a4030', 'stroke-width': '1' }, g);
  mkTxt(el.x + el.w / 2, el.y + 12, el.label || BPMN_EL.pool.lbl, 'font-size:12px;font-weight:700;fill:#1a1410', g);
  if (selected || hovered) {
    // In the header bar, right side — never overlaps lanes or the next pool
    drawPoolButton(g, el.x + el.w - 118, el.y + 3.5, '+ Lane', () => bpmnAddLaneToPool(el.id));
    drawPoolButton(g, el.x + el.w - 60, el.y + 3.5, '+ Pool', () => bpmnAddPoolBelow(el.id));
  }
  if (selected) drawContainerResizeHandle(g, el);
}

// Small click-button drawn on the canvas (used for the sticky-pool controls)
function drawPoolButton(g, x, y, label, onClick) {
  const w = label.length * 6.4 + 14;
  const btn = document.createElementNS(NS, 'g');
  btn.setAttribute('class', 'bpmn-pool-btn');
  btn.style.cursor = 'pointer';
  mkEl('rect', { x, y, width: w, height: 17, rx: 4, fill: '#1e4a90', stroke: 'none', opacity: '0.92' }, btn);
  mkTxt(x + w / 2, y + 9, label, 'font-size:10px;font-weight:700;fill:#ffffff', btn);
  btn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
  btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
  g.appendChild(btn);
}

function drawContainerResizeHandle(g, el) {
  const rh = mkEl('rect', { x: el.x + el.w - 7, y: el.y + el.h - 7, width: 14, height: 14, rx: 2, class: 'bpmn-resize-handle', fill: '#bb9af7', stroke: '#1a1410', 'stroke-width': '1.2' }, g);
  rh.style.cursor = 'nwse-resize';
  rh.addEventListener('mousedown', e => {
    e.stopPropagation(); e.preventDefault();
    S.mode = 'bpmn-resizing'; S.bpmnResizeId = el.id;
    S.rsOx = e.clientX; S.rsOy = e.clientY; S.rsW = el.w; S.rsH = el.h;
  });
}

// Свои маркеры стрелок BPMN (закрашенный треугольник у sequence flow,
// открытый — у message flow), чтобы не зависеть от C4-маркера #arr.
function bpmnEnsureMarkers(fG) {
  const defs = mkEl('defs', {}, fG);
  const mk = (id, fill, stroke) => {
    const m = mkEl('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' }, defs);
    m.setAttribute('markerWidth', '10'); m.setAttribute('markerHeight', '10');
    mkEl('path', { d: 'M1 1L9 5L1 9z', fill, stroke, 'stroke-width': '1.2', 'stroke-linejoin': 'round' }, m);
  };
  mk('bpmn-arr', '#6c7086', '#6c7086');
  mk('bpmn-arr-sel', '#1e4a90', '#1e4a90');
  mk('bpmn-arr-err', '#d4383a', '#d4383a');
  mk('bpmn-arr-msg', '#faf4e8', '#8839ef');
}

function drawFlow(fG, bpmn, flow) {
  const from = bpmn.elements.find(e => e.id === flow.from);
  const to = bpmn.elements.find(e => e.id === flow.to);
  if (!from || !to) return;
  const pts = bpmnFlowPoints(bpmn, flow);
  if (!pts || pts.length < 2) return;
  const selected = S.selected === flow.id;

  // Message Flow (dashed, per BPMN spec) vs Sequence Flow (solid): decided
  // dynamically from which Pool each end sits in right now, so dragging an
  // element into a different Pool immediately recolors its flows correctly.
  const kind = bpmnFlowKind(bpmn, flow);
  const isAssoc = kind === 'assoc', isMessage = kind === 'message';
  const issue = BPMN_ISSUE_BY_ID[flow.id];

  // Выбор связи — через bpmnFlowAt() в bpmnMouseDown (геометрический хит-тест),
  // а не click-листенер на прозрачной линии: тот перехватывали пул/дорожка.
  const grp = mkEl('g', { class: 'bpmn-flow bpmn-flow--' + kind + (selected ? ' is-selected' : '') + (issue ? ' has-issue' : ''), 'data-flow-id': flow.id }, fG);
  const d = bpmnPolyD(pts);
  mkEl('path', { d, class: 'bpmn-flow-hit', fill: 'none', stroke: 'transparent', 'stroke-width': '12' }, grp);

  const baseColor = issue ? '#d4383a' : isAssoc ? '#9a9488' : isMessage ? '#8839ef' : (selected ? '#1e4a90' : '#6c7086');
  if (selected) mkEl('path', { d, class: 'bpmn-flow-halo', fill: 'none', stroke: '#1e4a90', 'stroke-opacity': '0.18', 'stroke-width': '7', 'stroke-linejoin': 'round' }, grp);
  mkEl('path', {
    d, class: 'bpmn-flow-line', fill: 'none',
    stroke: baseColor,
    'stroke-width': selected ? '2.4' : isAssoc ? '1.3' : '1.6',
    'stroke-linejoin': 'round',
    'stroke-dasharray': isAssoc ? '2 3' : isMessage ? '6 4' : 'none', // dotted = BPMN association
    'marker-end': isAssoc ? 'none' : `url(#${isMessage ? 'bpmn-arr-msg' : issue ? 'bpmn-arr-err' : selected ? 'bpmn-arr-sel' : 'bpmn-arr'})`,
  }, grp);
  const p1 = pts[0];
  if (isMessage) {
    // Small open circle at the source end is the BPMN Message Flow marker
    mkEl('circle', { cx: p1.x, cy: p1.y, r: 3.5, class: 'bpmn-flow-msgstart', fill: '#faf4e8', stroke: baseColor, 'stroke-width': 1.4 }, grp);
  } else if (!isAssoc && flow.label && !from.type.startsWith('gateway_') && !from.type.startsWith('start') && bpmn.flows.filter(f => f.from === from.id && bpmnFlowKind(bpmn, f) === 'seq').length > 1) {
    // условный поток из активности — ромбик у начала (BPMN conditional flow)
    const p2 = pts[1], len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, ux = (p2.x - p1.x) / len, uy = (p2.y - p1.y) / len;
    const c = { x: p1.x + ux * 7, y: p1.y + uy * 7 };
    mkEl('path', { d: `M${p1.x} ${p1.y}L${c.x - uy * 4} ${c.y + ux * 4}L${p1.x + ux * 14} ${p1.y + uy * 14}L${c.x + uy * 4} ${c.y - ux * 4}Z`, class: 'bpmn-flow-cond', fill: '#faf4e8', stroke: baseColor, 'stroke-width': 1.2 }, grp);
  }

  if (flow.label) {
    const lp = bpmnPolyLabelPos(pts, flow.label);
    const t = mkTxt(lp.x, lp.y, flow.label, `font-size:9.5px;fill:${isMessage ? '#5a2d99' : '#1a1410'};font-weight:600`, grp);
    t.setAttribute('class', 'bpmn-flow-label');
    t.setAttribute('text-anchor', lp.anchor);
    t.setAttribute('paint-order', 'stroke');
    t.setAttribute('stroke', '#faf4e8'); t.setAttribute('stroke-width', '3'); t.setAttribute('stroke-linejoin', 'round');
  }
}

function drawBpmnElement(g, el) {
  const type = el.type;
  const def = BPMN_EL[type];
  const clr = def.clr;
  const label = el.label || def.lbl;
  const selected = S.selected === el.id || (S.bpmnMulti || []).includes(el.id);
  const hovered = S.bpmnHovered === el.id;
  const sw = selected ? 2.5 : 1.5;
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;

  const wrap = document.createElementNS(NS, 'g');
  wrap.style.cursor = 'move';
  // Классы — под будущую тему (Win95 neo-retro): цвета пока остаются
  // атрибутами как fallback (PNG-экспорт сериализует SVG без внешнего CSS).
  const tok = S.bpmnStep && S.bpmnStep.active ? S.bpmnStep : null;
  wrap.setAttribute('class', ['bpmn-el', 'bpmn-el--' + type, def.cat ? 'bpmn-cat--' + def.cat : '',
    selected ? 'is-selected' : '', hovered ? 'is-hovered' : '',
    tok && tok.activeIds && tok.activeIds.has(el.id) ? 'is-token' : '',
    tok && tok.visitedIds && tok.visitedIds.has(el.id) ? 'is-visited' : '',
    BPMN_ISSUE_BY_ID[el.id] ? 'has-issue has-issue--' + BPMN_ISSUE_BY_ID[el.id].sev : ''].filter(Boolean).join(' '));
  wrap.setAttribute('data-el-id', el.id);

  if (bpmnIsBoundary(type)) {
    // Boundary event: double ring (intermediate-event notation), opaque fill so
    // it reads cleanly sitting on top of its host task's border
    const r = el.w / 2;
    mkEl('circle', { cx, cy, r, fill: '#faf4e8', stroke: '#1a1410', 'stroke-width': selected ? 2.2 : 1.4 }, wrap);
    mkEl('circle', { cx, cy, r: r - 3, fill: clr + '33', stroke: '#1a1410', 'stroke-width': 1.2 }, wrap);
    bpmnGloss('circle', { cx, cy, r: r - 3 }, wrap);
    if (type === 'boundary_timer') {
      mkEl('circle', { cx, cy, r: r - 7, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.1 }, wrap);
      mkEl('line', { x1: cx, y1: cy, x2: cx, y2: cy - (r - 10), stroke: '#1a1410', 'stroke-width': 1.2 }, wrap);
      mkEl('line', { x1: cx, y1: cy, x2: cx + (r - 11), y2: cy, stroke: '#1a1410', 'stroke-width': 1.2 }, wrap);
    } else if (type === 'boundary_message') {
      mkEl('rect', { x: cx - 7, y: cy - 4.5, width: 14, height: 9, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.1 }, wrap);
      mkEl('path', { d: `M ${cx - 7} ${cy - 4.5} L ${cx} ${cy + 1} L ${cx + 7} ${cy - 4.5}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.1 }, wrap);
    } else {
      mkEl('path', { d: `M ${cx - 6} ${cy + 6} L ${cx - 1.5} ${cy - 4.5} L ${cx + 1.5} ${cy + 1.5} L ${cx + 6} ${cy - 6}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, wrap);
    }
  }
  else if (type === 'start' || type === 'end' || type.startsWith('event_')) {
    // Per BPMN spec: start = thin border, end = thick border, intermediate = double ring
    const isEnd = type === 'end';
    mkEl('circle', { cx, cy, r: el.w / 2, fill: clr + '33', stroke: '#1a1410', 'stroke-width': isEnd ? 3.5 : 1.6 }, wrap);
    bpmnGloss('circle', { cx, cy, r: el.w / 2 }, wrap);
    if (type === 'event_message') {
      mkEl('rect', { x: cx - 10, y: cy - 6, width: 20, height: 12, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.3 }, wrap);
      mkEl('path', { d: `M ${cx - 10} ${cy - 6} L ${cx} ${cy + 2} L ${cx + 10} ${cy - 6}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.3 }, wrap);
    } else if (type === 'event_timer') {
      mkEl('circle', { cx, cy, r: el.w / 2 - 5, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.2 }, wrap);
      mkEl('line', { x1: cx, y1: cy, x2: cx, y2: cy - (el.w / 2 - 9), stroke: '#1a1410', 'stroke-width': 1.3 }, wrap);
      mkEl('line', { x1: cx, y1: cy, x2: cx + (el.w / 2 - 12), y2: cy, stroke: '#1a1410', 'stroke-width': 1.3 }, wrap);
    } else if (type === 'event_error') {
      mkEl('path', { d: `M ${cx - 8} ${cy + 8} L ${cx - 2} ${cy - 6} L ${cx + 2} ${cy + 2} L ${cx + 8} ${cy - 8}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, wrap);
    } else if (type === 'event_signal') {
      mkEl('polygon', { points: `${cx},${cy - 8} ${cx + 8},${cy + 6} ${cx - 8},${cy + 6}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, wrap);
    }
  }
  else if (type === 'data_object') {
    // Document with a folded top-right corner
    const fx = el.x + el.w - 10;
    mkEl('path', { d: `M ${el.x} ${el.y} L ${fx} ${el.y} L ${el.x + el.w} ${el.y + 10} L ${el.x + el.w} ${el.y + el.h} L ${el.x} ${el.y + el.h} Z`, fill: clr + '33', stroke: '#1a1410', 'stroke-width': sw }, wrap);
    mkEl('path', { d: `M ${fx} ${el.y} L ${fx} ${el.y + 10} L ${el.x + el.w} ${el.y + 10}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.1 }, wrap);
  }
  else if (type === 'data_store') {
    const ry = 7;
    mkEl('path', { d: `M ${el.x} ${el.y + ry} A ${el.w / 2} ${ry} 0 0 1 ${el.x + el.w} ${el.y + ry} L ${el.x + el.w} ${el.y + el.h - ry} A ${el.w / 2} ${ry} 0 0 1 ${el.x} ${el.y + el.h - ry} Z`, fill: clr + '33', stroke: '#1a1410', 'stroke-width': sw }, wrap);
    mkEl('path', { d: `M ${el.x} ${el.y + ry} A ${el.w / 2} ${ry} 0 0 0 ${el.x + el.w} ${el.y + ry}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.1 }, wrap);
  }
  else if (type === 'annotation') {
    // Open square bracket on the left, per BPMN spec; text inside, no fill
    mkEl('path', { d: `M ${el.x + 12} ${el.y} L ${el.x} ${el.y} L ${el.x} ${el.y + el.h} L ${el.x + 12} ${el.y + el.h}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.4 }, wrap);
  }
  else if (type.startsWith('gateway_')) {
    const r = el.w / 2;
    mkEl('polygon', { points: `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`, fill: clr + '33', stroke: '#1a1410', 'stroke-width': sw }, wrap);
    bpmnGloss('polygon', { points: `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}` }, wrap);
    if (type === 'gateway_xor') {
      mkEl('line', { x1: cx - 9, y1: cy - 9, x2: cx + 9, y2: cy + 9, stroke: '#1a1410', 'stroke-width': 2.2 }, wrap);
      mkEl('line', { x1: cx - 9, y1: cy + 9, x2: cx + 9, y2: cy - 9, stroke: '#1a1410', 'stroke-width': 2.2 }, wrap);
    } else if (type === 'gateway_and') {
      mkEl('line', { x1: cx, y1: cy - 10, x2: cx, y2: cy + 10, stroke: '#1a1410', 'stroke-width': 2.2 }, wrap);
      mkEl('line', { x1: cx - 10, y1: cy, x2: cx + 10, y2: cy, stroke: '#1a1410', 'stroke-width': 2.2 }, wrap);
    } else if (type === 'gateway_or') {
      mkEl('circle', { cx, cy, r: 9, fill: 'none', stroke: '#1a1410', 'stroke-width': 2.2 }, wrap);
    } else if (type === 'gateway_event_based') {
      mkEl('circle', { cx, cy, r: 10, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.4 }, wrap);
      mkEl('polygon', { points: bpmnPentaPoints(cx, cy, 6), fill: 'none', stroke: '#1a1410', 'stroke-width': 1.2 }, wrap);
    } else if (type === 'gateway_complex') {
      [0, 45, 90, 135].forEach(deg => {
        const rad = deg * Math.PI / 180;
        const dx = 9 * Math.cos(rad), dy = 9 * Math.sin(rad);
        mkEl('line', { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, stroke: '#1a1410', 'stroke-width': 2 }, wrap);
      });
    }
  }
  else if (type === 'subprocess') {
    mkEl('rect', { x: el.x, y: el.y, width: el.w, height: el.h, rx: 6, fill: clr + '33', stroke: '#1a1410', 'stroke-width': sw }, wrap);
    bpmnGloss('rect', { x: el.x, y: el.y, width: el.w, height: el.h, rx: 6 }, wrap);
    const bx = cx, by = el.y + el.h - 11;
    mkEl('rect', { x: bx - 6, y: by - 6, width: 12, height: 12, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.3 }, wrap);
    mkEl('line', { x1: bx - 3.5, y1: by, x2: bx + 3.5, y2: by, stroke: '#1a1410', 'stroke-width': 1.3 }, wrap);
    mkEl('line', { x1: bx, y1: by - 3.5, x2: bx, y2: by + 3.5, stroke: '#1a1410', 'stroke-width': 1.3 }, wrap);
  }
  else {
    // Task (plain or typed) — typed variants carry a small marker top-left
    mkEl('rect', { x: el.x, y: el.y, width: el.w, height: el.h, rx: 6, fill: clr + '33', stroke: '#1a1410', 'stroke-width': sw }, wrap);
    bpmnGloss('rect', { x: el.x, y: el.y, width: el.w, height: el.h, rx: 6 }, wrap);
    const mx = el.x + 7, my = el.y + 6;
    if (type === 'task_user') {
      mkEl('circle', { cx: mx + 5, cy: my + 3.5, r: 3, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.1 }, wrap);
      mkEl('path', { d: `M ${mx} ${my + 12} A 5 5 0 0 1 ${mx + 10} ${my + 12}`, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.1 }, wrap);
    } else if (type === 'task_service') {
      mkEl('circle', { cx: mx + 5, cy: my + 6, r: 3, fill: 'none', stroke: '#1a1410', 'stroke-width': 1.1 }, wrap);
      [0, 45, 90, 135].forEach(deg => {
        const rad = deg * Math.PI / 180, dx = 5.5 * Math.cos(rad), dy = 5.5 * Math.sin(rad);
        mkEl('line', { x1: mx + 5 - dx, y1: my + 6 - dy, x2: mx + 5 + dx, y2: my + 6 + dy, stroke: '#1a1410', 'stroke-width': 1 }, wrap);
      });
      mkEl('circle', { cx: mx + 5, cy: my + 6, r: 1.4, fill: '#faf4e8', stroke: '#1a1410', 'stroke-width': 0.8 }, wrap);
    } else if (type === 'task_script') {
      [0, 4, 8].forEach(dy => mkEl('line', { x1: mx, y1: my + 3 + dy, x2: mx + 10, y2: my + 3 + dy, stroke: '#1a1410', 'stroke-width': 1.1 }, wrap));
    }
  }

  // Label — events and gateways carry an icon inside the shape, so the label
  // goes below to avoid overlapping it (per BPMN convention). Tasks have no
  // inner icon, so their label sits centered inside.
  if (type === 'start' || type === 'end' || type.startsWith('event_') || type.startsWith('gateway_') || bpmnIsBoundary(type)
      || type === 'data_object' || type === 'data_store') {
    mkTxt(cx, el.y + el.h + 12, label.substring(0, 18), 'font-size:10px;fill:#1a1410', wrap);
  } else if (type === 'annotation') {
    const tx = el.x + 12 + (el.w - 12) / 2;
    const [l1, l2] = wrap2Lines(label, Math.max(8, Math.floor((el.w - 20) / 5.6)));
    mkTxt(tx, cy - (l2 ? 7 : 0), l1, 'font-size:10px;fill:#1a1410;font-style:italic', wrap);
    if (l2) mkTxt(tx, cy + 7, l2, 'font-size:10px;fill:#1a1410;font-style:italic', wrap);
  } else {
    const maxChars = Math.max(8, Math.floor((el.w - 14) / 6.4));
    if (label.length <= maxChars) {
      mkTxt(cx, cy, label, 'font-size:11px;font-weight:600;fill:#1a1410', wrap);
    } else {
      const [l1, l2] = wrap2Lines(label, maxChars);
      mkTxt(cx, cy - 7, l1, 'font-size:10.5px;font-weight:600;fill:#1a1410', wrap);
      mkTxt(cx, cy + 7, l2, 'font-size:10.5px;font-weight:600;fill:#1a1410', wrap);
    }
  }

  // Connect ports on all four sides (shown on hover)
  if (hovered && !bpmnIsContainer(type)) {
    bpmnPorts(el).forEach(p => {
      mkEl('circle', { cx: p.x, cy: p.y, r: 6, fill: '#faf4e8', stroke: '#1e4a90', 'stroke-width': 2 }, wrap);
    });
  }

  if (selected) {
    mkEl('rect', { x: el.x - 4, y: el.y - 4, width: el.w + 8, height: el.h + 8, fill: 'none', stroke: '#1e4a90', 'stroke-width': 1, 'stroke-dasharray': '3 2', rx: 4 }, wrap);
  }

  // Validation badge — red/amber ⚠ at the top-right corner
  const issue = BPMN_ISSUE_BY_ID[el.id];
  if (issue) {
    const ix = el.x + el.w + 2, iy = el.y - 4;
    const iclr = issue.sev === 'error' ? '#c43a3a' : '#b8860b';
    mkEl('circle', { cx: ix, cy: iy, r: 8, fill: '#faf4e8', stroke: iclr, 'stroke-width': 1.6 }, wrap);
    mkTxt(ix, iy + 1, '!', `font-size:11px;font-weight:800;fill:${iclr}`, wrap);
    const t = document.createElementNS(NS, 'title');
    t.textContent = issue.msg;
    wrap.appendChild(t);
  }

  g.appendChild(wrap);
}

// ═══════════════════════════════════════════════════════════════
// MODEL VALIDATION — structural checks drawn as ⚠ badges on the canvas
// and listed in the sidebar panel.
// ═══════════════════════════════════════════════════════════════
// Валидация. Sequence flow и message flow теперь считаются раздельно:
// раньше message-старт («Получить заказ» из другого пула) получал ложные
// «у Start не должно быть входящих», а отправитель — «тупик».
function bpmnValidate(bpmn) {
  const issues = [];
  const T = (ru, en) => tTask({ ru, en });
  const els = bpmn.elements;
  const byId = Object.fromEntries(els.map(e => [e.id, e]));
  const nm = el => el.label || (BPMN_EL[el.type] || {}).lbl || el.type;
  const kindOf = new Map(bpmn.flows.map(f => [f.id, bpmnFlowKind(bpmn, f)]));
  const seq = bpmn.flows.filter(f => kindOf.get(f.id) === 'seq');
  const msg = bpmn.flows.filter(f => kindOf.get(f.id) === 'message');
  const seqOut = id => seq.filter(f => f.from === id), seqIn = id => seq.filter(f => f.to === id);
  const nonC = els.filter(e => !bpmnIsContainer(e.type) && !bpmnIsArtifact(e.type));

  const log = BPMN_SANITIZE_LOG.get(bpmn);
  if (log && (log.flows || log.els)) issues.push({ sev: 'warn', msg: T(`При загрузке отброшено: связей без концов — ${log.flows}, элементов — ${log.els}`, `Dropped on load: ${log.flows} dangling flow(s), ${log.els} element(s)`) });
  if (!nonC.length) return issues; // empty canvas — nothing to nag about

  const starts = els.filter(e => e.type === 'start');
  const ends = els.filter(e => e.type === 'end');
  if (!starts.length) issues.push({ sev: 'error', msg: T('Нет Start Event — процессу неоткуда начаться', 'No Start Event — the process has no entry point') });
  if (!ends.length) issues.push({ sev: 'error', msg: T('Нет End Event — процессу негде закончиться', 'No End Event — the process has no exit point') });

  // ── Висячие / некорректные связи ──
  const pairSeen = new Set();
  bpmn.flows.forEach(f => {
    const a = byId[f.from], b = byId[f.to];
    if (!a || !b) return;
    const k = kindOf.get(f.id);
    if (a.type === 'lane' || b.type === 'lane') issues.push({ id: f.id, sev: 'error', msg: T(`Связь «${nm(a)}» → «${nm(b)}» висит на дорожке — подключите её к элементу`, `Flow "${nm(a)}" → "${nm(b)}" is attached to a lane — connect it to an element`) });
    else if ((a.type === 'pool' || b.type === 'pool') && k !== 'message') issues.push({ id: f.id, sev: 'error', msg: T(`Sequence flow не может вести в собственный пул «${nm(a.type === 'pool' ? a : b)}»`, `A sequence flow cannot target its own pool "${nm(a.type === 'pool' ? a : b)}"`) });
    if (f.from === f.to) issues.push({ id: f.id, sev: 'warn', msg: T(`«${nm(a)}»: связь сама на себя`, `"${nm(a)}": flow loops onto itself`) });
    const key = f.from + '>' + f.to;
    if (pairSeen.has(key)) issues.push({ id: f.id, sev: 'warn', msg: T(`Дублирующая связь «${nm(a)}» → «${nm(b)}»`, `Duplicate flow "${nm(a)}" → "${nm(b)}"`) });
    pairSeen.add(key);
    if (k === 'message' && (a.type.startsWith('gateway_') || b.type.startsWith('gateway_'))) issues.push({ id: f.id, sev: 'error', msg: T(`Message flow не может начинаться/заканчиваться на шлюзе`, `A message flow cannot start or end at a gateway`) });
  });

  // Reachability from Start по sequence + message flow (+ boundary-побеги)
  const reach = new Set();
  if (starts.length) {
    const q = starts.map(s => s.id);
    starts.forEach(s => reach.add(s.id));
    const live = seq.concat(msg);
    while (q.length) {
      const cur = q.shift();
      live.forEach(f => { if (f.from === cur && !reach.has(f.to)) { reach.add(f.to); q.push(f.to); } });
      els.forEach(e => { if (bpmnIsBoundary(e.type) && e.attachedTo === cur && !reach.has(e.id)) { reach.add(e.id); q.push(e.id); } });
    }
  }

  // ── Ближайший split выше по потоку (для баланса AND/XOR) ──
  const splitKind = e => e.type.startsWith('gateway_') ? e.type
    : (seqOut(e.id).some(f => (f.label || '').trim()) ? 'gateway_or' : 'gateway_and'); // неявный split из активности
  const upSplit = (fromId, seen) => {
    let cur = fromId, guard = 0;
    while (cur && guard++ < 80) {
      if (seen.has(cur)) return null;
      seen.add(cur);
      const e = byId[cur]; if (!e) return null;
      if (seqOut(cur).length > 1) return e;
      const ins = seqIn(cur);
      if (ins.length > 1) { // вложенный join — перепрыгиваем его блок целиком
        const sp = upSplit(ins[0].from, seen); if (!sp) return null;
        const spIn = seqIn(sp.id); cur = spIn.length ? spIn[0].from : null; continue;
      }
      if (!ins.length) { cur = bpmnIsBoundary(e.type) ? e.attachedTo : null; continue; }
      cur = ins[0].from;
    }
    return null;
  };

  nonC.forEach(el => {
    const name = nm(el);
    const sIn = seqIn(el.id).length, sOut = seqOut(el.id).length;
    const mIn = msg.filter(f => f.to === el.id).length, mOut = msg.filter(f => f.from === el.id).length;
    const isGw = el.type.startsWith('gateway_');
    if (el.type === 'start' && sIn) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: у Start не должно быть входящих sequence flow`, `"${name}": a Start must not have incoming sequence flows`) });
    if (el.type === 'start' && !sOut) issues.push({ id: el.id, sev: 'error', msg: T(`«${name}»: из Start ничего не выходит`, `"${name}": nothing leaves this Start`) });
    if (el.type === 'end' && sOut) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: у End не должно быть исходящих sequence flow`, `"${name}": an End must not have outgoing sequence flows`) });
    if (el.type !== 'start' && !bpmnIsBoundary(el.type) && !sIn && !mIn) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: нет входящих связей`, `"${name}": no incoming flows`) });
    if (isGw) {
      if (!sOut) issues.push({ id: el.id, sev: 'error', msg: T(`«${name}»: у шлюза нет выходов`, `"${name}": gateway has no outgoing flows`) });
      else if (sIn === 1 && sOut === 1) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: шлюз с одним входом и одним выходом ничего не решает`, `"${name}": gateway with one input and one output is redundant`) });
      else if (sIn > 1 && sOut > 1) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: шлюз одновременно сливает и разветвляет — разделите на join и split`, `"${name}": gateway both merges and splits — split it into a join and a split`) });
    } else if (el.type !== 'end' && el.type !== 'start' && !bpmnIsBoundary(el.type) && !sOut) {
      if (mOut) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: после отправки сообщения процесс неявно завершается — добавьте End`, `"${name}": the process ends implicitly after sending — add an End`) });
      else issues.push({ id: el.id, sev: 'error', msg: T(`«${name}»: тупик — нет исходящих связей`, `"${name}": dead end — no outgoing flows`) });
    }
    if (bpmnIsBoundary(el.type) && !sOut) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: boundary-событие без пути обработки`, `"${name}": boundary event has no handling path`) });
    if ((el.type === 'gateway_xor' || el.type === 'gateway_or') && sOut > 1) {
      const unlabeled = seqOut(el.id).filter(f => !(f.label || '').trim()).length;
      if (unlabeled) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: ${unlabeled} ветк${unlabeled === 1 ? 'а' : 'и'} без условия на стрелке`, `"${name}": ${unlabeled} branch${unlabeled === 1 ? '' : 'es'} with no condition label`) });
    }
    if (el.type === 'gateway_event_based' && sOut) {
      const bad = seqOut(el.id).map(f => byId[f.to]).filter(t => t && !/^event_(message|timer|signal)$/.test(t.type));
      if (bad.length) issues.push({ id: el.id, sev: 'error', msg: T(`«${name}»: после event-based шлюза должны идти catch-события (сообщение/таймер/сигнал), а не «${nm(bad[0])}»`, `"${name}": an event-based gateway must lead to catch events (message/timer/signal), not "${nm(bad[0])}"`) });
      if (sOut < 2) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: event-based шлюзу нужно ≥ 2 альтернативных события`, `"${name}": an event-based gateway needs ≥ 2 alternative events`) });
    }
    // Баланс параллельности
    if (isGw && sIn > 1) {
      const splits = seqIn(el.id).map(f => upSplit(f.from, new Set()));
      const kinds = splits.map(sp => sp ? splitKind(sp) : null);
      if (el.type === 'gateway_and') {
        const bi = kinds.findIndex(k => k === 'gateway_xor' || k === 'gateway_event_based');
        if (bi >= 0) issues.push({ id: el.id, sev: 'error', msg: T(`«${name}»: AND-join ждёт все ветки, но они расходятся из «${nm(splits[bi])}» (XOR) — придёт только одна, дедлок`, `"${name}": AND-join waits for all branches, but they come from XOR "${nm(splits[bi])}" — only one arrives, deadlock`) });
        else if (kinds.includes('gateway_or')) issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: AND-join после OR-split — если выбраны не все ветки, будет дедлок; используйте OR-join`, `"${name}": AND-join after an OR-split deadlocks if not all branches fire; use an OR-join`) });
      } else if (el.type === 'gateway_xor') {
        const sp0 = splits[0];
        if (sp0 && splits.every(sp => sp === sp0) && splitKind(sp0) === 'gateway_and') issues.push({ id: el.id, sev: 'warn', msg: T(`«${name}»: XOR-join сливает параллельные ветки AND «${nm(sp0)}» — продолжение выполнится ${sIn} раза; нужен AND-join`, `"${name}": XOR-join merges parallel branches of AND "${nm(sp0)}" — downstream runs ${sIn} times; use an AND-join`) });
      }
    }
    if (starts.length && el.type !== 'start' && !reach.has(el.id)) issues.push({ id: el.id, sev: 'error', msg: T(`«${name}»: недостижим от Start`, `"${name}": unreachable from Start`) });
  });

  // AND-split без парного join — предупреждение, только если ветки сходятся в XOR (выше) — тут не дублируем.

  const pools = els.filter(e => e.type === 'pool');
  if (pools.length) {
    nonC.forEach(el => {
      if (bpmnIsBoundary(el.type)) return;
      if (!bpmnElementPoolIdIn(bpmn, el)) issues.push({ id: el.id, sev: 'warn', msg: T(`«${nm(el)}»: вне пула, хотя пулы на диаграмме есть`, `"${nm(el)}": outside any pool, though pools exist on the diagram`) });
    });
    // Пул с содержимым, но без своего входа (Start или входящего сообщения)
    pools.forEach(p => {
      const inside = nonC.filter(e => !bpmnIsBoundary(e.type) && bpmnElementPoolIdIn(bpmn, e) === p.id);
      if (!inside.length) return; // «чёрный ящик»
      const hasEntry = inside.some(e => e.type === 'start') || inside.some(e => msg.some(f => f.to === e.id) && !seqIn(e.id).length);
      if (!hasEntry) issues.push({ id: p.id, sev: 'warn', msg: T(`Пул «${nm(p)}»: нет Start Event — процесс пула не запустится`, `Pool "${nm(p)}": no Start Event — its process never starts`) });
    });
  }
  return issues;
}

function bpmnSelectIssue(elId) {
  if (!elId) return;
  S.selected = elId;
  S.bpmnMulti = [];
  if (typeof renderBpmnPanel === 'function') renderBpmnPanel();
  render();
}

// Pentagon-in-circle is the BPMN symbol for an Event-based Gateway.
function bpmnPentaPoints(cx, cy, r) {
  const pts = [];
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * 2 * Math.PI / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function wrap2Lines(s, max) {
  if (s.length <= max) return [s, ''];
  const words = s.split(' ');
  let l1 = '', l2 = '';
  for (const w of words) { if (!l2 && (l1 ? l1 + ' ' + w : w).length <= max) l1 = l1 ? l1 + ' ' + w : w; else l2 = l2 ? l2 + ' ' + w : w; }
  if (!l1) { l1 = s.slice(0, max); l2 = s.slice(max); }
  if (l2.length > max) l2 = l2.slice(0, max - 1) + '…';
  return [l1, l2];
}

// ═══════════════════════════════════════════════════════════════
// PALETTE — real BPMN shape icons instead of colored squares
// ═══════════════════════════════════════════════════════════════
function bpmnPaletteIconFlat(type) {
  const def = BPMN_EL[type];
  const clr = def.clr;
  const s = 16;
  if (def.shape === 'circle') {
    const isEnd = type === 'end';
    let inner = '';
    if (type === 'event_message') inner = `<path d="M4 6 L8 9 L12 6" fill="none" stroke="#1a1410" stroke-width="1"/><rect x="4" y="5" width="8" height="6" fill="none" stroke="#1a1410" stroke-width="1"/>`;
    else if (type === 'event_timer') inner = `<circle cx="8" cy="8" r="4.5" fill="none" stroke="#1a1410" stroke-width="0.9"/><line x1="8" y1="8" x2="8" y2="5" stroke="#1a1410" stroke-width="1"/><line x1="8" y1="8" x2="10" y2="8" stroke="#1a1410" stroke-width="1"/>`;
    else if (type === 'event_error') inner = `<path d="M5 11 L7 6 L9 9 L11 4" fill="none" stroke="#1a1410" stroke-width="1.2" stroke-linejoin="round"/>`;
    else if (type === 'event_signal') inner = `<polygon points="8,4.5 11.5,10.5 4.5,10.5" fill="none" stroke="#1a1410" stroke-width="1" stroke-linejoin="round"/>`;
    else if (type === 'boundary_timer') inner = `<circle cx="8" cy="8" r="4.7" fill="none" stroke="#1a1410" stroke-width="0.8"/><circle cx="8" cy="8" r="3" fill="none" stroke="#1a1410" stroke-width="0.8"/><line x1="8" y1="8" x2="8" y2="5.8" stroke="#1a1410" stroke-width="0.9"/>`;
    else if (type === 'boundary_error') inner = `<circle cx="8" cy="8" r="4.7" fill="none" stroke="#1a1410" stroke-width="0.8"/><path d="M6 10.5 L7.3 6 L8.7 8.5 L10 5.5" fill="none" stroke="#1a1410" stroke-width="1" stroke-linejoin="round"/>`;
    else if (type === 'boundary_message') inner = `<circle cx="8" cy="8" r="4.7" fill="none" stroke="#1a1410" stroke-width="0.8"/><rect x="5" y="6" width="6" height="4" fill="none" stroke="#1a1410" stroke-width="0.7"/><path d="M5 6 L8 8.5 L11 6" fill="none" stroke="#1a1410" stroke-width="0.7"/>`;
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="${clr}66" stroke="#1a1410" stroke-width="${isEnd ? 2.2 : 1.2}"/>${inner}</svg>`;
  }
  if (def.shape === 'diamond') {
    let inner = '';
    if (type === 'gateway_xor') inner = `<line x1="5" y1="5" x2="11" y2="11" stroke="#1a1410" stroke-width="1.4"/><line x1="5" y1="11" x2="11" y2="5" stroke="#1a1410" stroke-width="1.4"/>`;
    else if (type === 'gateway_and') inner = `<line x1="8" y1="4" x2="8" y2="12" stroke="#1a1410" stroke-width="1.4"/><line x1="4" y1="8" x2="12" y2="8" stroke="#1a1410" stroke-width="1.4"/>`;
    else if (type === 'gateway_or') inner = `<circle cx="8" cy="8" r="3" fill="none" stroke="#1a1410" stroke-width="1.3"/>`;
    else if (type === 'gateway_event_based') inner = `<circle cx="8" cy="8" r="4" fill="none" stroke="#1a1410" stroke-width="1"/><polygon points="${bpmnPentaPoints(8, 8, 2.3)}" fill="none" stroke="#1a1410" stroke-width="0.8"/>`;
    else if (type === 'gateway_complex') inner = `<line x1="8" y1="4" x2="8" y2="12" stroke="#1a1410" stroke-width="1.3"/><line x1="4" y1="8" x2="12" y2="8" stroke="#1a1410" stroke-width="1.3"/><line x1="5" y1="5" x2="11" y2="11" stroke="#1a1410" stroke-width="1.3"/><line x1="5" y1="11" x2="11" y2="5" stroke="#1a1410" stroke-width="1.3"/>`;
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="${clr}66" stroke="#1a1410" stroke-width="1.2"/>${inner}</svg>`;
  }
  if (type === 'lane') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="12" fill="none" stroke="#1a1410" stroke-width="1.2"/><rect x="1" y="2" width="4" height="12" fill="${clr}" stroke="#1a1410" stroke-width="0.8"/></svg>`;
  }
  if (type === 'pool') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="12" fill="none" stroke="#1a1410" stroke-width="1.4"/><rect x="1" y="2" width="14" height="4" fill="${clr}" stroke="#1a1410" stroke-width="0.8"/></svg>`;
  }
  if (type === 'subprocess') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="2" fill="${clr}66" stroke="#1a1410" stroke-width="1.2"/><rect x="6.5" y="10" width="3" height="3" fill="none" stroke="#1a1410" stroke-width="0.9"/><line x1="8" y1="10.7" x2="8" y2="12.3" stroke="#1a1410" stroke-width="0.9"/><line x1="7.2" y1="11.5" x2="8.8" y2="11.5" stroke="#1a1410" stroke-width="0.9"/></svg>`;
  }
  if (type === 'data_object') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M3 1 L10 1 L13 4 L13 15 L3 15 Z" fill="${clr}66" stroke="#1a1410" stroke-width="1.1"/><path d="M10 1 L10 4 L13 4" fill="none" stroke="#1a1410" stroke-width="0.9"/></svg>`;
  }
  if (type === 'data_store') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M2 4 A6 2.4 0 0 1 14 4 L14 12 A6 2.4 0 0 1 2 12 Z" fill="${clr}66" stroke="#1a1410" stroke-width="1.1"/><path d="M2 4 A6 2.4 0 0 0 14 4" fill="none" stroke="#1a1410" stroke-width="0.9"/></svg>`;
  }
  if (type === 'annotation') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M6 2 L2 2 L2 14 L6 14" fill="none" stroke="#1a1410" stroke-width="1.3"/><line x1="5" y1="6" x2="13" y2="6" stroke="#1a1410" stroke-width="0.9"/><line x1="5" y1="9" x2="13" y2="9" stroke="#1a1410" stroke-width="0.9"/></svg>`;
  }
  // task (plain or typed)
  let marker = '';
  if (type === 'task_user') marker = `<circle cx="5" cy="6.5" r="1.6" fill="none" stroke="#1a1410" stroke-width="0.8"/><path d="M2.8 10.5 A2.6 2.6 0 0 1 7.2 10.5" fill="none" stroke="#1a1410" stroke-width="0.8"/>`;
  else if (type === 'task_service') marker = `<circle cx="5.5" cy="8" r="2" fill="none" stroke="#1a1410" stroke-width="0.8"/><line x1="5.5" y1="4.8" x2="5.5" y2="11.2" stroke="#1a1410" stroke-width="0.7"/><line x1="2.3" y1="8" x2="8.7" y2="8" stroke="#1a1410" stroke-width="0.7"/>`;
  else if (type === 'task_script') marker = `<line x1="4" y1="6" x2="12" y2="6" stroke="#1a1410" stroke-width="0.9"/><line x1="4" y1="8.5" x2="12" y2="8.5" stroke="#1a1410" stroke-width="0.9"/><line x1="4" y1="11" x2="9" y2="11" stroke="#1a1410" stroke-width="0.9"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="2" fill="${clr}66" stroke="#1a1410" stroke-width="1.2"/>${marker}</svg>`;
}

// UI-2: иконки палитры BPMN в стиле «фигурок» (как icons95): плотная заливка-пластик,
// общие бесцветные градиенты блика/тени из спрайта #i3d-defs, контур — тёмный тон цвета.
function bpmnPaletteIcon(type) {
  const flat = bpmnPaletteIconFlat(type);
  const def = BPMN_EL[type];
  const clr = def && def.clr;
  if (!/^#[0-9a-fA-F]{6}$/.test(clr || '') || typeof _lt !== 'function' || typeof _dk !== 'function') return flat;
  const base = _lt(clr, .25), line = _dk(clr, .42);
  let done = false;
  let out = flat.replace(/<(circle|polygon|rect|path)\b([^>]*?)fill="(#[0-9a-fA-F]{6})(66)?"([^>]*?)\/>/, (m, tag, a, f, al, b) => {
    if (f.toLowerCase() !== clr.toLowerCase()) return m;
    done = true;
    const geo = (a + b).replace(/\s(stroke|stroke-width|stroke-linejoin)="[^"]*"/g, '');
    const ov = tag === 'circle' ? 'url(#i3-s)' : 'url(#i3-v)';
    return `<${tag}${a}fill="${base}"${b}/><${tag}${geo} fill="${ov}" stroke="none"/>`;
  });
  if (!done) return flat;
  out = out.replace(/#1a1410/g, line).replace('<svg ', '<svg class="i3d bp3d" ');
  return out;
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR PANEL
// ═══════════════════════════════════════════════════════════════
// Экранирование для innerHTML панели: имена диаграмм/элементов/сценариев
// раньше вставлялись как есть → XSS из чужого JSON/XML-файла.
function bpmnEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Панель BPMN. Вся стилизация — классами из bpmn.css (под будущую тему Win95).
function renderBpmnPanel() {
  const body = $('side-analysis');
  if (!body) return;
  const cur = getCurrentBpmn();
  const E = bpmnEsc;
  let h = '<div class="bpmn-panel">';
  h += '<div class="bpmn-sec">';
  h += '<div class="bpmn-sec-title">📊 Diagrams</div>';
  h += '<select id="bpmn-select" class="bpmn-input bpmn-select" onchange="switchBpmnDiagram(this.value)">';
  S.bpmn.diagrams.forEach(d => { h += `<option value="${E(d.id)}" ${d.id === S.bpmn.currentDiagramId ? 'selected' : ''}>${E(d.name)}</option>`; });
  h += '</select>';
  h += '<div class="bpmn-btn-row">';
  h += '<button class="bpmn-btn bpmn-btn--primary" onclick="addBpmnDiagram()">+ New Diagram</button>';
  if (S.bpmn.diagrams.length > 1) h += '<button class="bpmn-btn bpmn-btn--danger" onclick="deleteBpmnDiagram()">Delete current</button>';
  h += '</div>';
  if (typeof bpmnExportXml === 'function') {
    h += '<div class="bpmn-btn-row">';
    h += '<button class="bpmn-btn" id="bpmn-xml-export" onclick="bpmnExportXml()" title="BPMN 2.0 XML для Camunda Modeler / bpmn.io">⬇ Export .bpmn</button>';
    h += '<button class="bpmn-btn" id="bpmn-xml-import" onclick="bpmnImportXmlPick()" title="Открыть .bpmn / .xml (Camunda, bpmn.io)">⬆ Import .bpmn</button>';
    h += '</div>';
  }
  h += `<label class="bpmn-check"><input type="checkbox" id="bpmn-route-toggle" ${S.bpmnRouting === 'straight' ? '' : 'checked'} onchange="bpmnSetRouting(this.checked)"> Ортогональные связи (обход фигур)</label>`;
  h += '</div>';

  h += '<div class="bpmn-stats">';
  h += `<div><b>Elements:</b> ${cur.elements.length}</div>`;
  h += `<div><b>Flows:</b> ${cur.flows.length}</div>`;
  h += '</div>';

  // Scenario/UML library sits right up top, always — this is where "▶ Run
  // Scenario" results land, so it shouldn't require scrolling to find.
  h += renderBpmnScenarioLibrary();
  h += renderBpmnValidationSection(cur);

  if ((S.bpmnMulti || []).length > 1) {
    h += '<div class="bpmn-card">';
    h += `<div class="bpmn-card-text"><b>${S.bpmnMulti.length}</b> elements selected — drag any of them to move the group. Ctrl+D duplicates, Delete removes.</div>`;
    h += '<div class="bpmn-sec-title">Выравнивание</div>';
    h += '<div class="bpmn-align-grid">';
    [['left', '⇤', 'По левому краю'], ['hcenter', '↔', 'По центру (гориз.)'], ['right', '⇥', 'По правому краю'],
     ['top', '⤒', 'По верхнему краю'], ['vcenter', '↕', 'По середине (верт.)'], ['bottom', '⤓', 'По нижнему краю'],
     ['hdist', '⋯', 'Распределить по горизонтали'], ['vdist', '⋮', 'Распределить по вертикали']].forEach(([m, ic, t]) => {
      h += `<button class="bpmn-btn bpmn-btn--icon" data-align="${m}" title="${t}" onclick="bpmnAlignSelection('${m}')">${ic}</button>`;
    });
    h += '</div>';
    h += '<button class="bpmn-btn bpmn-btn--primary bpmn-btn--block" onclick="bpmnDuplicateSelection()">⧉ Duplicate group</button>';
    h += '<button class="bpmn-btn bpmn-btn--danger bpmn-btn--block" onclick="bpmnDeleteSelected()">🗑 Delete group</button>';
    h += '</div>';
  } else if (S.bpmnSim && S.bpmnSim.active) {
    h += renderBpmnSimTokensSection();
  } else if (S.selected) {
    const el = cur.elements.find(e => e.id === S.selected);
    const flow = cur.flows.find(f => f.id === S.selected);
    if (el) {
      h += '<div class="bpmn-card">';
      h += `<div class="bpmn-card-kind">${E(BPMN_EL[el.type].lbl)}${el.origType ? ' <span class="bpmn-muted">(' + E(el.origType) + ')</span>' : ''}</div>`;
      h += `<input type="text" id="bpmn-label-input" class="bpmn-input" value="${E(el.label || '')}" onchange="bpmnRenameSelected(this.value)">`;
      h += '<button class="bpmn-btn bpmn-btn--danger bpmn-btn--block" onclick="bpmnDeleteSelected()">🗑 Delete</button>';
      h += '</div>';
    } else if (flow) {
      const kind = bpmnFlowKind(cur, flow);
      h += '<div class="bpmn-card">';
      h += `<div class="bpmn-card-kind">${kind === 'message' ? 'Message Flow' : kind === 'assoc' ? 'Association' : 'Sequence Flow'}</div>`;
      h += `<input type="text" id="bpmn-flow-label-input" class="bpmn-input" placeholder="condition label…" value="${E(flow.label || '')}" onchange="bpmnLabelFlow(this.value)">`;
      h += '<button class="bpmn-btn bpmn-btn--danger bpmn-btn--block" onclick="bpmnDeleteSelected()">🗑 Delete</button>';
      h += '</div>';
    }
  } else {
    h += '<div class="bpmn-hint">Click a palette item, then click the canvas to place it. Hover an element → drag from a side port to connect. Double-click an element or a flow to rename. Drag snaps to the grid and to neighbours (Alt — free move). Delete key removes the selection.</div>';
  }
  h += '</div>';
  body.innerHTML = h;
}

function bpmnSetRouting(on) {
  S.bpmnRouting = on ? 'ortho' : 'straight';
  render();
}

function renderBpmnValidationSection(bpmn) {
  const issues = bpmnValidate(bpmn);
  if (!issues.length) {
    if (!bpmn.elements.length) return '';
    return '<div class="bpmn-valid-ok">✅ Model is valid — no structural issues.</div>';
  }
  const errs = issues.filter(i => i.sev === 'error').length;
  let h = `<div class="bpmn-sec-title">⚠ Validation (${issues.length}${errs ? ', ' + errs + ' errors' : ''})</div>`;
  h += '<div class="bpmn-issues">';
  issues.slice(0, 14).forEach(iss => {
    const attrs = iss.id ? ` data-id="${bpmnEsc(iss.id)}" onclick="bpmnSelectIssue(this.dataset.id)" title="Click to select on canvas"` : '';
    h += `<div class="bpmn-issue bpmn-issue--${iss.sev}${iss.id ? ' is-link' : ''}"${attrs}>${bpmnEsc(iss.msg)}</div>`;
  });
  if (issues.length > 14) h += `<div class="bpmn-muted">…and ${issues.length - 14} more</div>`;
  h += '</div>';
  return h;
}

function renderBpmnSimTokensSection() {
  const bpmn = getCurrentBpmn();
  const n = (bpmn.scenarios || []).length;
  const sc = bpmnStepScenario();
  let h = '<div class="bpmn-card bpmn-card--sim">';
  if (sc) {
    const max = bpmnStepMax(sc), k = S.bpmnStep.k;
    const names = [...new Set(sc.branches.map(b => { const st = b.history[Math.min(k, b.history.length - 1)]; const e = bEl(st.elId); return e ? (e.label || BPMN_EL[e.type].lbl) + (st.cond === 'joined' ? ' ⏸' : '') : '?'; }))];
    h += `<div class="bpmn-card-text"><span class="bpmn-swatch" style="background:${bpmnEsc(sc.color)}"></span><b>${bpmnEsc(sc.name)}</b> — шаг <b id="bpmn-step-k">${k}</b> / ${max}</div>`;
    h += `<div class="bpmn-card-text bpmn-muted">Токены: ${names.map(bpmnEsc).join(', ')}</div>`;
    h += '<div class="bpmn-btn-row">';
    h += '<button class="bpmn-btn bpmn-btn--icon" id="bpmn-step-first" onclick="bpmnStepGo(-1e9)" title="В начало">⏮</button>';
    h += '<button class="bpmn-btn bpmn-btn--icon" id="bpmn-step-prev" onclick="bpmnStepGo(-1)" title="Шаг назад">◀</button>';
    h += `<button class="bpmn-btn bpmn-btn--icon" id="bpmn-step-play" onclick="bpmnStepPlay()" title="Авто">${BPMN_STEP_TIMER ? '⏸' : '▶'}</button>`;
    h += '<button class="bpmn-btn bpmn-btn--icon" id="bpmn-step-next" onclick="bpmnStepGo(1)" title="Шаг вперёд">▶|</button>';
    h += '<button class="bpmn-btn bpmn-btn--icon" id="bpmn-step-last" onclick="bpmnStepGo(1e9)" title="В конец">⏭</button>';
    h += '</div>';
    h += '<button class="bpmn-btn bpmn-btn--block" onclick="bpmnStepStop()">✕ Выйти из пошагового режима</button>';
  } else {
    h += `<div class="bpmn-card-text">▶ ${n} scenario${n > 1 ? 's' : ''} drawn on canvas, each in its own color — condition labels shown at every branch taken. Click ⏯ next to a scenario to step through it token by token.</div>`;
  }
  h += '<button class="bpmn-btn bpmn-btn--danger bpmn-btn--block" onclick="bpmnSimReset()">⏹ Hide Scenario Colors</button>';
  h += '</div>';
  return h;
}

function renderBpmnScenarioLibrary() {
  const bpmn = getCurrentBpmn();
  const scenarios = bpmn.scenarios || [];
  if (!scenarios.length) {
    return '<div class="bpmn-card bpmn-hint">📚 <b>Scenarios</b> — none yet. Click <b>▶ Run Scenario</b> in the toolbar above to auto-discover every path and its UML Sequence diagram.</div>';
  }
  let h = '<div class="bpmn-sec-title">📚 Scenarios (' + scenarios.length + ')</div>';
  scenarios.forEach(sc => {
    const id = bpmnEsc(sc.id);
    const on = S.bpmnStep && S.bpmnStep.active && S.bpmnStep.scId === sc.id;
    h += `<div class="bpmn-scen${on ? ' is-active' : ''}">`;
    h += `<button class="bpmn-scen-open" data-id="${id}" onclick="bpmnViewScenarioSeq(this.dataset.id)" title="Open as Sequence diagram"><span class="bpmn-swatch" style="background:${bpmnEsc(sc.color || '#7aa2f7')}"></span>${bpmnEsc(sc.name)}</button>`;
    h += `<span class="bpmn-scen-act bpmn-scen-step" data-id="${id}" onclick="bpmnStepStart(this.dataset.id)" title="Пошагово">⏯</span>`;
    h += `<span class="bpmn-scen-act bpmn-scen-del" data-id="${id}" onclick="bpmnDeleteScenario(this.dataset.id)" title="Delete">✕</span>`;
    h += '</div>';
  });
  return h;
}

function bpmnRenameSelected(v) {
  const el = bEl(S.selected); if (!el) return;
  el.label = v.trim() || el.label;
  pushHist(); render();
}
function bpmnLabelFlow(v) {
  const f = bFlow(S.selected); if (!f) return;
  f.label = v.trim();
  pushHist(); render();
}

function addBpmnDiagram() {
  const name = prompt('Diagram name:', 'Process ' + (S.bpmn.diagrams.length + 1));
  if (!name || !name.trim()) return;
  const diag = { id: 'bp' + (S.nid++), name, elements: [], flows: [], scenarios: [] };
  S.bpmn.diagrams.push(diag);
  S.bpmn.currentDiagramId = diag.id;
  S.selected = null;
  S.bpmnSim = { active: false };
  bpmnStepStop(true);
  bpmnAnimStop();
  pushHist(); // раньше новая диаграмма не попадала в историю — Undo её «терял»
  updateBpmnSimUI(); render();
  toast('📊 ' + name);
}

function deleteBpmnDiagram() {
  if (S.bpmn.diagrams.length <= 1) return;
  if (!confirm('Delete this diagram?')) return;
  S.bpmn.diagrams = S.bpmn.diagrams.filter(d => d.id !== S.bpmn.currentDiagramId);
  S.bpmn.currentDiagramId = S.bpmn.diagrams[0].id;
  S.selected = null;
  bpmnStepStop(true);
  S.bpmnSim = { active: false };
  bpmnAnimStop();
  pushHist();
  updateBpmnSimUI(); render();
}

function switchBpmnDiagram(diagramId) {
  S.bpmn.currentDiagramId = diagramId;
  S.selected = null;
  S.bpmnMulti = [];
  bpmnStepStop(true);
  S.bpmnSim = { active: false };
  bpmnAnimStop();
  updateBpmnSimUI();
  render();
}

// «Глянец» BPMN-фигур в стиле холста C4 (UI-3): мягкая тень + блик-накладка той же геометрии
function bpmnGloss(tag, a, wrap) {
  if (typeof ensureMatDefs === 'function') ensureMatDefs();
  const base = wrap.lastChild; if (base) base.setAttribute('filter', 'url(#m-sh)');
  const o = Object.assign({}, a, { fill: 'url(#m-v)', stroke: 'none', 'pointer-events': 'none', class: 'bpmn-gloss' });
  delete o['stroke-width']; mkEl(tag, o, wrap);
}
