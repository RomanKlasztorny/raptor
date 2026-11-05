// BPMN-ROUTE — ортогональный роутинг стрелок BPMN без пересечения фигур.
// A* по разреженной ортогональной сетке: линии сетки проходят по границам
// фигур-препятствий (с отступом), по выходным «усам» портов и посередине
// между источником и целью. Цена = длина + штраф за каждый поворот, так что
// побеждают короткие маршруты с минимумом изломов. Результат кэшируется по
// геометрии, поэтому перерисовка во время перетаскивания остаётся быстрой.

const BPMN_ROUTE_MARGIN = 14;      // отступ стрелки от фигур
const BPMN_ROUTE_BEND = 26;        // штраф за поворот (в пикселях длины)
const BPMN_ROUTE_REGION = 220;     // насколько расширять зону поиска вокруг пары фигур
let BPMN_ROUTE_CACHE = new Map();

function bpmnRouteSides(el) {
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  return [
    { side: 'E', x: el.x + el.w, y: cy, dx: 1, dy: 0 },
    { side: 'W', x: el.x,        y: cy, dx: -1, dy: 0 },
    { side: 'N', x: cx,          y: el.y, dx: 0, dy: -1 },
    { side: 'S', x: cx,          y: el.y + el.h, dx: 0, dy: 1 },
  ];
}

function bpmnRouteRectHit(r, x, y) { return x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1; }

// Препятствия для стрелки: все «твёрдые» фигуры, кроме контейнеров и
// артефактов-аннотаций. Источник и цель тоже препятствия (чтобы стрелка не
// проходила сквозь них), но с отступом чуть меньше — их «усы» остаются снаружи.
function bpmnRouteObstacles(bpmn, from, to) {
  const m = BPMN_ROUTE_MARGIN;
  const skipHost = bpmnIsBoundary(from.type) ? from.attachedTo : null;
  const out = [];
  bpmn.elements.forEach(e => {
    if (bpmnIsContainer(e.type) || e.type === 'annotation') return;
    if (e.id === skipHost) return;
    if (bpmnIsBoundary(e.type) && e !== from && e !== to) return; // малы и сидят на хосте
    const pad = m - 1; // «усы» портов (ровно m) остаются снаружи
    out.push({ id: e.id, x0: e.x - pad, y0: e.y - pad, x1: e.x + e.w + pad, y1: e.y + e.h + pad });
  });
  return out;
}

function bpmnRouteKey(from, to, obs) {
  let k = from.x + ',' + from.y + ',' + from.w + ',' + from.h + '|' + to.x + ',' + to.y + ',' + to.w + ',' + to.h + '|' + from.type + '|';
  obs.forEach(o => { k += o.x0 + ',' + o.y0 + ',' + o.x1 + ',' + o.y1 + ';'; });
  return k;
}

// Форма фигуры для расчёта точки касания: круг (события), ромб (шлюзы), прямоугольник.
function bpmnRouteShape(el) {
  const t = el.type;
  if (t === 'start' || t === 'end' || t.startsWith('event_') || t.startsWith('boundary_')) return 'circle';
  if (t.startsWith('gateway_')) return 'diamond';
  return 'rect';
}
// Точка на контуре фигуры на горизонтали y (dir=+1 — правая сторона) /
// вертикали x (для вертикального выхода).
function bpmnRouteEdgeAt(el, axis, v, dir) {
  const sh = bpmnRouteShape(el), cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  if (axis === 'h') { // горизонтальный луч на высоте v
    if (sh === 'rect') return dir > 0 ? el.x + el.w : el.x;
    const r = el.w / 2, d = Math.abs(v - cy);
    const off = sh === 'circle' ? Math.sqrt(Math.max(0, r * r - d * d)) : Math.max(0, r - d * (el.w / el.h));
    return cx + dir * off;
  }
  if (sh === 'rect') return dir > 0 ? el.y + el.h : el.y;
  const r = el.h / 2, d = Math.abs(v - cx);
  const off = sh === 'circle' ? Math.sqrt(Math.max(0, r * r - d * d)) : Math.max(0, r - d * (el.h / el.w));
  return cy + dir * off;
}
// Прямая стрелка без изломов, если фигуры перекрываются по высоте (или
// ширине) и между ними чисто. Иначе небольшой рассинхрон центров (из-за
// привязки к сетке) давал лишний «зигзаг» через нижние порты.
function bpmnRouteStraight(from, to, obs) {
  if (bpmnIsBoundary(from.type)) return null;
  const inset = el => bpmnRouteShape(el) === 'rect' ? Math.min(10, el.h / 3) : el.h * 0.34;
  const insetW = el => bpmnRouteShape(el) === 'rect' ? Math.min(10, el.w / 3) : el.w * 0.34;
  const clear = (x0, y0, x1, y1) => !obs.some(o => o.id !== from.id && o.id !== to.id &&
    Math.max(x0, x1) > o.x0 && Math.min(x0, x1) < o.x1 && Math.max(y0, y1) > o.y0 && Math.min(y0, y1) < o.y1);
  const pick = (lo, hi, a, b) => (a >= lo && a <= hi) ? a : (b >= lo && b <= hi) ? b : (lo + hi) / 2;
  const fcy = from.y + from.h / 2, tcy = to.y + to.h / 2, fcx = from.x + from.w / 2, tcx = to.x + to.w / 2;
  // горизонтально
  const lo = Math.max(from.y + inset(from), to.y + inset(to)), hi = Math.min(from.y + from.h - inset(from), to.y + to.h - inset(to));
  if (lo <= hi) {
    const dir = to.x >= from.x + from.w + 16 ? 1 : to.x + to.w + 16 <= from.x ? -1 : 0;
    if (dir) {
      const y = Math.round(pick(lo, hi, tcy, fcy));
      const x0 = bpmnRouteEdgeAt(from, 'h', y, dir), x1 = bpmnRouteEdgeAt(to, 'h', y, -dir);
      if (clear(x0, y - 0.5, x1, y + 0.5)) return [{ x: x0, y }, { x: x1, y }];
    }
  }
  // вертикально
  const lo2 = Math.max(from.x + insetW(from), to.x + insetW(to)), hi2 = Math.min(from.x + from.w - insetW(from), to.x + to.w - insetW(to));
  if (lo2 <= hi2) {
    const dir = to.y >= from.y + from.h + 16 ? 1 : to.y + to.h + 16 <= from.y ? -1 : 0;
    if (dir) {
      const x = Math.round(pick(lo2, hi2, tcx, fcx));
      const y0 = bpmnRouteEdgeAt(from, 'v', x, dir), y1 = bpmnRouteEdgeAt(to, 'v', x, -dir);
      if (clear(x - 0.5, y0, x + 0.5, y1)) return [{ x, y: y0 }, { x, y: y1 }];
    }
  }
  return null;
}

// Главная точка входа: массив точек [{x,y},...] от границы `from` до границы `to`.
function bpmnRouteFlow(bpmn, from, to) {
  if (from === to) return bpmnRouteSelfLoop(from);
  const all = bpmnRouteObstacles(bpmn, from, to);
  const bx0 = Math.min(from.x, to.x) - BPMN_ROUTE_REGION, by0 = Math.min(from.y, to.y) - BPMN_ROUTE_REGION;
  const bx1 = Math.max(from.x + from.w, to.x + to.w) + BPMN_ROUTE_REGION, by1 = Math.max(from.y + from.h, to.y + to.h) + BPMN_ROUTE_REGION;
  const obs = all.filter(o => o.x1 > bx0 && o.x0 < bx1 && o.y1 > by0 && o.y0 < by1);
  const key = bpmnRouteKey(from, to, obs);
  const hit = BPMN_ROUTE_CACHE.get(key);
  if (hit) return hit;
  let pts = bpmnRouteStraight(from, to, obs) || bpmnRouteAStar(from, to, obs);
  if (!pts) pts = bpmnRouteFallback(from, to);
  if (BPMN_ROUTE_CACHE.size > 2000) BPMN_ROUTE_CACHE = new Map();
  BPMN_ROUTE_CACHE.set(key, pts);
  return pts;
}

function bpmnRouteSelfLoop(el) {
  const m = BPMN_ROUTE_MARGIN * 2;
  const x1 = el.x + el.w, yc = el.y + el.h / 2;
  return [{ x: x1, y: yc }, { x: x1 + m, y: yc }, { x: x1 + m, y: el.y - m }, { x: el.x + el.w / 2, y: el.y - m }, { x: el.x + el.w / 2, y: el.y }];
}

// Простой Z-маршрут на случай, если A* не нашёл пути (фигуры перекрываются).
function bpmnRouteFallback(from, to) {
  const a = { x: from.x + from.w / 2, y: from.y + from.h / 2 }, b = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const { p1, p2 } = bpmnFlowEnds(from, to);
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    const mx = (p1.x + p2.x) / 2;
    return bpmnRouteSimplify([p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2]);
  }
  const my = (p1.y + p2.y) / 2;
  return bpmnRouteSimplify([p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2]);
}

function bpmnRouteAStar(from, to, obs) {
  const m = BPMN_ROUTE_MARGIN;
  const fromBoundary = bpmnIsBoundary(from.type);
  // Boundary-события по конвенции BPMN выпускают поток вниз
  const srcSides = bpmnRouteSides(from).filter(s => !fromBoundary || s.side === 'S');
  const dstSides = bpmnRouteSides(to);
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 }, tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const blocked = (x, y) => obs.some(o => bpmnRouteRectHit(o, x, y));

  const xsSet = new Set(), ysSet = new Set();
  const stubs = [];
  srcSides.forEach(s => { s.sx = s.x + s.dx * m; s.sy = s.y + s.dy * m; xsSet.add(s.sx); ysSet.add(s.sy); stubs.push(s); });
  dstSides.forEach(s => { s.sx = s.x + s.dx * m; s.sy = s.y + s.dy * m; xsSet.add(s.sx); ysSet.add(s.sy); });
  obs.forEach(o => { xsSet.add(o.x0 - 1); xsSet.add(o.x1 + 1); ysSet.add(o.y0 - 1); ysSet.add(o.y1 + 1); });
  xsSet.add((fc.x + tc.x) / 2); ysSet.add((fc.y + tc.y) / 2);
  const xs = [...xsSet].sort((a, b) => a - b), ys = [...ysSet].sort((a, b) => a - b);
  const xi = new Map(xs.map((v, i) => [v, i])), yi = new Map(ys.map((v, i) => [v, i]));
  const W = xs.length, H = ys.length;
  if (W * H > 40000) return null;
  const free = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) free[j * W + i] = blocked(xs[i], ys[j]) ? 0 : 1;
  const segFree = (i1, j1, i2, j2) => !blocked((xs[i1] + xs[i2]) / 2, (ys[j1] + ys[j2]) / 2);

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const dirIdx = (dx, dy) => dx === 1 ? 0 : dx === -1 ? 1 : dy === 1 ? 2 : 3;
  const targets = new Map(); // node index → требуемое направление входа (внутрь фигуры)
  dstSides.forEach(s => {
    const i = xi.get(s.sx), j = yi.get(s.sy);
    if (free[j * W + i]) targets.set(j * W + i, { dir: dirIdx(-s.dx, -s.dy), side: s });
  });
  if (!targets.size) return null;
  const tgtList = [...targets.values()].map(t => t.side);
  const h = (i, j) => Math.min(...tgtList.map(s => Math.abs(xs[i] - s.sx) + Math.abs(ys[j] - s.sy)));

  // Бинарная куча
  const heap = [];
  const push = n => { heap.push(n); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p].f <= heap[k].f) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let s = k; if (l < heap.length && heap[l].f < heap[s].f) s = l; if (r < heap.length && heap[r].f < heap[s].f) s = r; if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s; } } return top; };

  const best = new Float64Array(W * H * 4).fill(Infinity);
  const prev = new Int32Array(W * H * 4).fill(-1);
  const startState = new Map();
  stubs.forEach(s => {
    const i = xi.get(s.sx), j = yi.get(s.sy);
    if (!free[j * W + i]) return;
    const d = dirIdx(s.dx, s.dy);
    // лёгкий штраф за выход стороной, которая «смотрит» от цели
    const away = (s.dx * (tc.x - fc.x) + s.dy * (tc.y - fc.y)) < 0 ? BPMN_ROUTE_BEND : 0;
    const st = (j * W + i) * 4 + d;
    const g = m + away;
    if (g < best[st]) { best[st] = g; startState.set(st, s); push({ st, g, f: g + h(i, j) }); }
  });

  let goal = -1, goalCost = Infinity;
  let guard = 0;
  while (heap.length && guard++ < 200000) {
    const cur = pop();
    if (cur.g > best[cur.st]) continue;
    if (cur.f >= goalCost) break;           // эвристика допустима — лучше уже не будет
    const node = cur.st >> 2, d = cur.st & 3;
    const i = node % W, j = (node / W) | 0;
    const t = targets.get(node);
    if (t && d !== (t.dir ^ 1)) {
      // финальный «ус» к порту; поворот перед входом — со штрафом
      const gEnd = cur.g + m + (t.dir === d ? 0 : BPMN_ROUTE_BEND);
      if (gEnd < goalCost) { goalCost = gEnd; goal = cur.st; }
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d ^ 1)) continue;          // без разворотов на 180°
      const ni = i + DIRS[nd][0], nj = j + DIRS[nd][1];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nn = nj * W + ni;
      if (!free[nn] || !segFree(i, j, ni, nj)) continue;
      const g = cur.g + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + (nd === d ? 0 : BPMN_ROUTE_BEND);
      const ns = nn * 4 + nd;
      if (g < best[ns]) { best[ns] = g; prev[ns] = cur.st; push({ st: ns, g, f: g + h(ni, nj) }); }
    }
  }
  if (goal < 0) return null;
  const chain = [];
  for (let s = goal; s >= 0; s = prev[s]) chain.push(s);
  chain.reverse();
  const first = startState.get(chain[0]);
  const lastNode = chain[chain.length - 1] >> 2;
  const tgt = targets.get(lastNode).side;
  const pts = [{ x: first.x, y: first.y }];
  chain.forEach(s => { const n = s >> 2; pts.push({ x: xs[n % W], y: ys[(n / W) | 0] }); });
  pts.push({ x: tgt.x, y: tgt.y });
  return bpmnRouteSimplify(pts);
}

function bpmnRouteSimplify(pts) {
  const out = [];
  pts.forEach(p => {
    const q = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
    const last = out[out.length - 1];
    if (last && last.x === q.x && last.y === q.y) return;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      if ((a.x === last.x && last.x === q.x) || (a.y === last.y && last.y === q.y)) { out[out.length - 1] = q; return; }
    }
    out.push(q);
  });
  return out;
}

function bpmnPolyD(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' '); }

function bpmnPolyLen(pts) { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return l; }

// Точка на ломаной на доле t ∈ [0,1] её длины — для анимации токенов.
function bpmnPolyAt(pts, t) {
  const total = bpmnPolyLen(pts);
  let want = total * Math.max(0, Math.min(1, t));
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= l || i === pts.length - 1) { const k = l ? Math.min(1, want / l) : 0; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; }
    want -= l;
  }
  return pts[pts.length - 1];
}

// Середина самого длинного сегмента — место для подписи стрелки.
// Позиция подписи связи: на самом длинном сегменте, СБОКУ от линии.
// label (необязательно) — оценка ширины текста: если сегмент короче подписи, подпись уходит дальше
// от линии и на ту сторону, где нет соседнего сегмента/стрелки (иначе текст налезал на стрелку).
function bpmnPolyLabelPos(pts, label) {
  let bi = 1, bl = -1;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (l > bl) { bl = l; bi = i; } }
  const a = pts[bi - 1], b = pts[bi];
  const horiz = Math.abs(b.y - a.y) < 0.5;
  const tw = label ? String(label).length * 5.4 : 0;           // ~ширина текста 9.5px
  const short = label ? bl < tw + 24 : false;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const prev = pts[bi - 2], next = pts[bi + 1];
  if (horiz) {
    // соседние вертикальные сегменты идут вверх → подпись снизу
    const up = (prev && prev.y < a.y - 0.5) || (next && next.y < b.y - 0.5);
    const down = (prev && prev.y > a.y + 0.5) || (next && next.y > b.y + 0.5);
    const below = up && !down;
    const off = short ? 13 : 9;
    return { x: mx, y: my + (below ? off : -off), anchor: 'middle' };
  }
  // вертикальный/наклонный: подпись справа, а если справа уходит соседний сегмент — слева
  const right = (prev && prev.x > a.x + 0.5) || (next && next.x > b.x + 0.5);
  const left = (prev && prev.x < a.x - 0.5) || (next && next.x < b.x - 0.5);
  const onLeft = right && !left;
  const off = short ? 10 : 7;
  return { x: mx + (onLeft ? -off : off), y: my, anchor: onLeft ? 'end' : 'start' };
}

function bpmnDistToPoly(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    let t = L ? ((x - a.x) * dx + (y - a.y) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  return best;
}
