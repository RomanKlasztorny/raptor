// BPMN-XML — экспорт/импорт BPMN 2.0 XML, совместимый с bpmn.io / Camunda Modeler.
// Экспорт: collaboration + participant на каждый Pool (свой process), laneSet,
// узлы, sequence/message flow, артефакты и ассоциации, BPMNDI с координатами
// фигур и ломаными стрелок из ортогонального роутера.
// Импорт: DOMParser → элементы РАПТОРа (позиции из BPMNDI), новые id be/bf,
// новая диаграмма в списке. Неизвестные/лишние конструкции BPMN сводятся к
// ближайшему типу палитры, исходный тип сохраняется в el.origType.

const BPMN_NS = {
  bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
  bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
  dc: 'http://www.omg.org/spec/DD/20100524/DC',
  di: 'http://www.omg.org/spec/DD/20100524/DI',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  raptor: 'http://raptor.local/schema/bpmn',
};

// тип РАПТОРа → [тег BPMN, eventDefinition|null]
const BPMN_XML_TAG = {
  start: ['startEvent', null], end: ['endEvent', null],
  event_message: ['intermediateCatchEvent', 'messageEventDefinition'],
  event_timer: ['intermediateCatchEvent', 'timerEventDefinition'],
  event_signal: ['intermediateCatchEvent', 'signalEventDefinition'],
  event_error: ['endEvent', 'errorEventDefinition'], // ошибка в BPMN бывает только end/boundary/start
  task: ['task', null], task_user: ['userTask', null], task_service: ['serviceTask', null],
  task_script: ['scriptTask', null], subprocess: ['subProcess', null],
  gateway_xor: ['exclusiveGateway', null], gateway_and: ['parallelGateway', null],
  gateway_or: ['inclusiveGateway', null], gateway_event_based: ['eventBasedGateway', null],
  gateway_complex: ['complexGateway', null],
  boundary_timer: ['boundaryEvent', 'timerEventDefinition'],
  boundary_error: ['boundaryEvent', 'errorEventDefinition'],
  boundary_message: ['boundaryEvent', 'messageEventDefinition'],
};

function bpmnXmlEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\r?\n/g, '&#10;');
}
function bpmnXmlId(id) { const s = String(id).replace(/[^A-Za-z0-9_.-]/g, '_'); return /^[A-Za-z_]/.test(s) ? s : '_' + s; }

// ─── ЭКСПОРТ ────────────────────────────────────────────────────
function bpmnToXml(diag) {
  diag = diag || getCurrentBpmn();
  const els = diag.elements, byId = new Map(els.map(e => [e.id, e]));
  const X = bpmnXmlId, A = bpmnXmlEsc;
  const r = v => Math.round(Number(v) || 0);
  const inside = (o, c) => { const p = bpmnCenter(o); return p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h; };
  const pools = els.filter(e => e.type === 'pool').sort((a, b) => a.y - b.y);
  const lanes = els.filter(e => e.type === 'lane');
  const nodes = els.filter(e => !bpmnIsContainer(e.type));
  const defId = 'Definitions_' + X(diag.id);

  // процесс для каждого элемента
  const procs = pools.length
    ? pools.map(p => ({ id: 'Process_' + X(p.id), pool: p, name: p.label, nodes: [], lanes: [], flows: [], arts: [] }))
    : [{ id: 'Process_' + X(diag.id), pool: null, name: diag.name, nodes: [], lanes: [], flows: [], arts: [] }];
  const procOf = new Map();
  const procFor = el => {
    if (bpmnIsBoundary(el.type) && byId.get(el.attachedTo)) el = byId.get(el.attachedTo);
    if (!pools.length) return procs[0];
    const pi = pools.findIndex(p => inside(el, p));
    return procs[pi >= 0 ? pi : 0]; // вне пулов — в первый процесс (DI сохраняет позицию)
  };
  nodes.forEach(e => { const p = procFor(e); procOf.set(e.id, p); (bpmnIsArtifact(e.type) ? p.arts : p.nodes).push(e); });
  lanes.forEach(l => { const p = pools.length ? (procs[pools.findIndex(pp => inside(l, pp))] || procs[0]) : procs[0]; p.lanes.push(l); });

  // связи
  const incoming = new Map(), outgoing = new Map(), dataIn = new Map(), dataOut = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const msgFlows = [], skipped = [];
  diag.flows.forEach(f => {
    const a = byId.get(f.from), b = byId.get(f.to);
    if (!a || !b || a.type === 'lane' || b.type === 'lane') { skipped.push(f); return; }
    if (bpmnIsArtifact(a.type) || bpmnIsArtifact(b.type)) {
      const art = bpmnIsArtifact(a.type) ? a : b, other = art === a ? b : a;
      const isAct = /^task|^subprocess/.test(other.type);
      if (art.type !== 'annotation' && isAct && !bpmnIsArtifact(other.type)) {
        if (art === b) add(dataOut, a.id, { f, target: b }); else add(dataIn, b.id, { f, source: a });
      } else (procOf.get(other.id) || procs[0]).flows.push({ kind: 'assoc', f });
      return;
    }
    const pa = a.type === 'pool' ? null : procOf.get(a.id), pb = b.type === 'pool' ? null : procOf.get(b.id);
    if (!pa || !pb || pa !== pb) { if (pools.length) msgFlows.push(f); else skipped.push(f); return; }
    pa.flows.push({ kind: 'seq', f });
    add(outgoing, a.id, f.id); add(incoming, b.id, f.id);
  });

  let x = '<?xml version="1.0" encoding="UTF-8"?>\n';
  x += `<bpmn:definitions xmlns:bpmn="${BPMN_NS.bpmn}" xmlns:bpmndi="${BPMN_NS.bpmndi}" xmlns:dc="${BPMN_NS.dc}" xmlns:di="${BPMN_NS.di}" xmlns:xsi="${BPMN_NS.xsi}" xmlns:raptor="${BPMN_NS.raptor}" id="${defId}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="RAPTOR" exporterVersion="1.0">\n`;
  const collabId = 'Collaboration_' + X(diag.id);
  if (pools.length) {
    x += `  <bpmn:collaboration id="${collabId}">\n`;
    procs.forEach(p => { x += `    <bpmn:participant id="${X(p.pool.id)}" name="${A(p.pool.label)}" processRef="${p.id}" />\n`; });
    msgFlows.forEach(f => { x += `    <bpmn:messageFlow id="${X(f.id)}"${f.label ? ` name="${A(f.label)}"` : ''} sourceRef="${X(f.from)}" targetRef="${X(f.to)}" />\n`; });
    x += '  </bpmn:collaboration>\n';
  }
  const hasErrOut = el => (outgoing.get(el.id) || []).length > 0;
  procs.forEach(p => {
    x += `  <bpmn:process id="${p.id}"${p.name ? ` name="${A(p.name)}"` : ''} isExecutable="false">\n`;
    if (p.lanes.length) {
      x += `    <bpmn:laneSet id="LaneSet_${p.id}">\n`;
      p.lanes.sort((a, b) => a.y - b.y).forEach(l => {
        x += `      <bpmn:lane id="${X(l.id)}" name="${A(l.label)}">\n`;
        p.nodes.filter(n => !bpmnIsArtifact(n.type) && inside(bpmnIsBoundary(n.type) && byId.get(n.attachedTo) ? byId.get(n.attachedTo) : n, l))
          .forEach(n => { x += `        <bpmn:flowNodeRef>${X(n.id)}</bpmn:flowNodeRef>\n`; });
        x += '      </bpmn:lane>\n';
      });
      x += '    </bpmn:laneSet>\n';
    }
    p.nodes.forEach(n => {
      let [tag, def] = BPMN_XML_TAG[n.type] || ['task', null];
      if (n.type === 'event_error' && hasErrOut(n)) { tag = 'intermediateThrowEvent'; def = null; } // end не может иметь исходящих
      let attrs = ` id="${X(n.id)}"`;
      if (n.label) attrs += ` name="${A(n.label)}"`;
      if (tag === 'boundaryEvent') attrs += ` attachedToRef="${X(n.attachedTo)}"`;
      if (n.type === 'event_error') attrs += ` raptor:type="event_error"`; // иначе при импорте станет обычным End
      let body = '';
      (incoming.get(n.id) || []).forEach(id => { body += `      <bpmn:incoming>${X(id)}</bpmn:incoming>\n`; });
      (outgoing.get(n.id) || []).forEach(id => { body += `      <bpmn:outgoing>${X(id)}</bpmn:outgoing>\n`; });
      (dataIn.get(n.id) || []).forEach(({ f, source }) => {
        body += `      <bpmn:dataInputAssociation id="${X(f.id)}">\n        <bpmn:sourceRef>${X(source.id)}</bpmn:sourceRef>\n      </bpmn:dataInputAssociation>\n`;
      });
      (dataOut.get(n.id) || []).forEach(({ f, target }) => {
        body += `      <bpmn:dataOutputAssociation id="${X(f.id)}">\n        <bpmn:targetRef>${X(target.id)}</bpmn:targetRef>\n      </bpmn:dataOutputAssociation>\n`;
      });
      if (def) body += `      <bpmn:${def} id="${X(n.id)}_ed" />\n`;
      x += body ? `    <bpmn:${tag}${attrs}>\n${body}    </bpmn:${tag}>\n` : `    <bpmn:${tag}${attrs} />\n`;
    });
    p.flows.filter(o => o.kind === 'seq').forEach(({ f }) => {
      x += `    <bpmn:sequenceFlow id="${X(f.id)}"${f.label ? ` name="${A(f.label)}"` : ''} sourceRef="${X(f.from)}" targetRef="${X(f.to)}" />\n`;
    });
    p.arts.forEach(a => {
      if (a.type === 'annotation') x += `    <bpmn:textAnnotation id="${X(a.id)}">\n      <bpmn:text>${A(a.label)}</bpmn:text>\n    </bpmn:textAnnotation>\n`;
      else if (a.type === 'data_object') x += `    <bpmn:dataObjectReference id="${X(a.id)}" name="${A(a.label)}" dataObjectRef="DataObject_${X(a.id)}" />\n    <bpmn:dataObject id="DataObject_${X(a.id)}" />\n`;
      else if (a.type === 'data_store') x += `    <bpmn:dataStoreReference id="${X(a.id)}" name="${A(a.label)}" />\n`;
    });
    p.flows.filter(o => o.kind === 'assoc').forEach(({ f }) => {
      x += `    <bpmn:association id="${X(f.id)}" sourceRef="${X(f.from)}" targetRef="${X(f.to)}" />\n`;
    });
    x += '  </bpmn:process>\n';
  });

  // DI
  x += `  <bpmndi:BPMNDiagram id="BPMNDiagram_${X(diag.id)}" name="${A(diag.name)}">\n`;
  x += `    <bpmndi:BPMNPlane id="BPMNPlane_${X(diag.id)}" bpmnElement="${pools.length ? collabId : procs[0].id}">\n`;
  const shape = (e, extra) => `      <bpmndi:BPMNShape id="${X(e.id)}_di" bpmnElement="${X(e.id)}"${extra || ''}>\n        <dc:Bounds x="${r(e.x)}" y="${r(e.y)}" width="${r(e.w)}" height="${r(e.h)}" />\n      </bpmndi:BPMNShape>\n`;
  pools.forEach(p => { x += shape(p, ' isHorizontal="true"'); });
  lanes.forEach(l => { x += shape(l, ' isHorizontal="true"'); });
  nodes.filter(n => !bpmnIsBoundary(n.type)).forEach(n => {
    x += shape(n, n.type === 'subprocess' ? ' isExpanded="false"' : n.type === 'gateway_xor' ? ' isMarkerVisible="true"' : '');
  });
  nodes.filter(n => bpmnIsBoundary(n.type)).forEach(n => { x += shape(n); }); // поверх хоста
  diag.flows.forEach(f => {
    if (skipped.includes(f)) return;
    const pts = bpmnFlowPoints(diag, f); if (!pts || pts.length < 2) return;
    x += `      <bpmndi:BPMNEdge id="${X(f.id)}_di" bpmnElement="${X(f.id)}">\n`;
    pts.forEach(pt => { x += `        <di:waypoint x="${r(pt.x)}" y="${r(pt.y)}" />\n`; });
    x += '      </bpmndi:BPMNEdge>\n';
  });
  x += '    </bpmndi:BPMNPlane>\n  </bpmndi:BPMNDiagram>\n</bpmn:definitions>\n';
  bpmnToXml.lastSkipped = skipped.length;
  return x;
}

function bpmnExportXml() {
  const diag = getCurrentBpmn();
  const xml = bpmnToXml(diag);
  const name = (String(diag.name || 'process').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'process') + '.bpmn';
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const sk = bpmnToXml.lastSkipped;
  toast('⬇ ' + name + (sk ? ' — ' + tTask({ ru: 'пропущено связей: ', en: 'flows skipped: ' }) + sk : ''));
}

// ─── ИМПОРТ ─────────────────────────────────────────────────────
const BPMN_XML_IMPORT_MAP = {
  startEvent: 'start', endEvent: 'end',
  task: 'task', manualTask: 'task', receiveTask: 'task', sendTask: 'task_service', businessRuleTask: 'task_service',
  userTask: 'task_user', serviceTask: 'task_service', scriptTask: 'task_script',
  subProcess: 'subprocess', callActivity: 'subprocess', transaction: 'subprocess', adHocSubProcess: 'subprocess',
  exclusiveGateway: 'gateway_xor', parallelGateway: 'gateway_and', inclusiveGateway: 'gateway_or',
  eventBasedGateway: 'gateway_event_based', complexGateway: 'gateway_complex',
  dataObjectReference: 'data_object', dataStoreReference: 'data_store', textAnnotation: 'annotation',
};

function bpmnFromXml(text, fallbackName) {
  const doc = new DOMParser().parseFromString(String(text), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(tTask({ ru: 'XML не разобран', en: 'XML parse error' }));
  const NS = BPMN_NS.bpmn;
  const root = doc.documentElement;
  if (root.namespaceURI !== NS || root.localName !== 'definitions') throw new Error(tTask({ ru: 'это не BPMN 2.0 (нет bpmn:definitions)', en: 'not a BPMN 2.0 file' }));
  const all = [...root.getElementsByTagNameNS(NS, '*')];
  const kids = (el, name) => [...el.children].filter(c => c.namespaceURI === NS && (!name || c.localName === name));
  const defOf = el => { const d = kids(el).find(c => /EventDefinition$/.test(c.localName)); return d ? d.localName.replace('EventDefinition', '') : null; };

  // DI: bounds фигур (первое вхождение)
  const bounds = new Map();
  [...root.getElementsByTagNameNS(BPMN_NS.bpmndi, 'BPMNShape')].forEach(s => {
    const ref = s.getAttribute('bpmnElement'); if (!ref || bounds.has(ref)) return;
    const b = s.getElementsByTagNameNS(BPMN_NS.dc, 'Bounds')[0]; if (!b) return;
    bounds.set(ref, { x: +b.getAttribute('x'), y: +b.getAttribute('y'), w: +b.getAttribute('width'), h: +b.getAttribute('height') });
  });

  const idMap = new Map(); // id XML → id РАПТОРа
  const newEl = () => 'be' + (S.nid++);
  const elements = [], flows = [], notes = [];
  let auto = 0;
  const place = (xmlId, type) => {
    const def = BPMN_EL[type], b = bounds.get(xmlId);
    if (b && [b.x, b.y, b.w, b.h].every(isFinite) && b.w > 0 && b.h > 0) return b;
    const i = auto++; // нет DI — раскладываем сеткой
    const y0 = bounds.size ? Math.max(...[...bounds.values()].map(v => v.y + v.h)) + 60 : 80; // под нарисованной частью
    const x0 = bounds.size ? Math.min(...[...bounds.values()].map(v => v.x)) : 80;
    return { x: x0 + (i % 6) * 160, y: y0 + Math.floor(i / 6) * 120, w: def.w, h: def.h };
  };
  const pushEl = (xmlEl, type, extra) => {
    const xmlId = xmlEl.getAttribute('id'); if (!xmlId || idMap.has(xmlId)) return null;
    const p = place(xmlId, type);
    const rt = xmlEl.getAttributeNS(BPMN_NS.raptor, 'type');
    const el = Object.assign({ id: newEl(), type: (rt && BPMN_EL[rt] && !BPMN_EL[rt].cat.match(/container/)) ? rt : type,
      label: xmlEl.getAttribute('name') || '', x: p.x, y: p.y, w: p.w, h: p.h }, extra || {});
    if (!rt && BPMN_XML_TAG[type] && BPMN_XML_TAG[type][0] !== xmlEl.localName) el.origType = xmlEl.localName;
    idMap.set(xmlId, el.id); elements.push(el);
    return el;
  };

  // пулы
  all.filter(e => e.localName === 'participant').forEach(p => {
    if (!bounds.has(p.getAttribute('id'))) return; // «чёрный ящик» без DI
    pushEl(p, 'pool');
    const proc = p.getAttribute('processRef');
    if (proc && !idMap.has(proc)) idMap.set(proc, idMap.get(p.getAttribute('id'))); // messageFlow может ссылаться на процесс
  });
  // дорожки: только листовые (вложенные laneSet раскладываем плоско)
  all.filter(e => e.localName === 'lane').forEach(l => {
    const child = kids(l, 'childLaneSet')[0];
    if (child && kids(child, 'lane').length) return;
    if (bounds.has(l.getAttribute('id'))) pushEl(l, 'lane');
  });
  // узлы
  const boundaries = [];
  all.forEach(e => {
    const ln = e.localName;
    let type = BPMN_XML_IMPORT_MAP[ln];
    if (ln === 'intermediateCatchEvent' || ln === 'intermediateThrowEvent') {
      const d = defOf(e);
      type = d === 'timer' ? 'event_timer' : d === 'signal' ? 'event_signal' : d === 'error' ? 'event_error' : 'event_message';
      if (!d || !['message', 'timer', 'signal', 'error'].includes(d)) {
        const el = pushEl(e, type); if (el && !el.origType) el.origType = ln + (d ? ':' + d : ''); return;
      }
    } else if (ln === 'boundaryEvent') { boundaries.push(e); return; }
    if (!type) return;
    const el = pushEl(e, type);
    if (!el) return;
    if (type === 'annotation') { const t = kids(e, 'text')[0]; el.label = t ? t.textContent : ''; }
    if ((ln === 'startEvent' || ln === 'endEvent') && defOf(e) && !el.origType && el.type === type) el.origType = ln + ':' + defOf(e);
  });
  boundaries.forEach(e => {
    const host = idMap.get(e.getAttribute('attachedToRef'));
    const d = defOf(e);
    const type = d === 'timer' ? 'boundary_timer' : d === 'error' || d === 'escalation' || d === 'compensate' ? 'boundary_error' : 'boundary_message';
    if (!host) { notes.push('boundary ' + e.getAttribute('id')); return; }
    const el = pushEl(e, type, { attachedTo: host });
    if (el && d && !['timer', 'error', 'message'].includes(d)) el.origType = 'boundaryEvent:' + d;
  });
  // связи
  const addFlow = (xmlId, src, tgt, label) => {
    const a = idMap.get(src), b = idMap.get(tgt);
    if (!a || !b) { notes.push(xmlId || '?'); return; }
    const f = { id: 'bf' + (S.nid++), from: a, to: b };
    if (label) f.label = label;
    if (xmlId) idMap.set(xmlId, f.id);
    flows.push(f);
  };
  all.forEach(e => {
    const ln = e.localName;
    if (ln === 'sequenceFlow' || ln === 'messageFlow' || ln === 'association') {
      let label = e.getAttribute('name') || '';
      if (!label && ln === 'sequenceFlow') { const c = kids(e, 'conditionExpression')[0]; if (c) label = c.textContent.trim(); }
      addFlow(e.getAttribute('id'), e.getAttribute('sourceRef'), e.getAttribute('targetRef'), label);
    } else if (ln === 'dataInputAssociation' || ln === 'dataOutputAssociation') {
      const act = e.parentElement && e.parentElement.getAttribute('id');
      const refs = n => kids(e, n).map(c => c.textContent.trim());
      if (ln === 'dataInputAssociation') refs('sourceRef').forEach(s => addFlow(null, s, act));
      else refs('targetRef').forEach(t => addFlow(null, act, t));
    }
  });
  if (!elements.length) throw new Error(tTask({ ru: 'в файле нет элементов BPMN', en: 'no BPMN elements in file' }));

  // сдвиг в видимую область
  const minX = Math.min(...elements.map(e => e.x)), minY = Math.min(...elements.map(e => e.y));
  const dx = 60 - minX, dy = 60 - minY;
  elements.forEach(e => { e.x = Math.round(e.x + dx); e.y = Math.round(e.y + dy); e.w = Math.round(e.w); e.h = Math.round(e.h); });

  const dg = root.getElementsByTagNameNS(BPMN_NS.bpmndi, 'BPMNDiagram')[0];
  const nameEl = (dg && dg.getAttribute('name') ? dg : null) || all.find(e => e.localName === 'process' && e.getAttribute('name')) || all.find(e => e.localName === 'participant' && e.getAttribute('name'));
  const name = (nameEl && nameEl.getAttribute('name')) || fallbackName || 'Imported process';
  return { diagram: { id: 'bp' + (S.nid++), name, elements, flows, scenarios: [] }, skipped: notes.length };
}

function bpmnImportXmlText(text, fileName) {
  const { diagram, skipped } = bpmnFromXml(text, fileName ? fileName.replace(/\.(bpmn|xml)$/i, '') : null);
  if (typeof bpmnSyncBoundaries === 'function') bpmnSyncBoundaries(diagram);
  S.bpmn.diagrams.push(diagram);
  if (typeof bpmnStepStop === 'function') bpmnStepStop(true);
  S.bpmnSim = { active: false };
  if (typeof bpmnAnimStop === 'function') bpmnAnimStop();
  S.bpmn.currentDiagramId = diagram.id;
  S.selected = null; S.bpmnMulti = [];
  bpmnSanitizeState();
  pushHist();
  if (typeof updateBpmnSimUI === 'function') updateBpmnSimUI();
  render();
  toast('⬆ ' + diagram.name + ': ' + diagram.elements.length + ' / ' + diagram.flows.length +
    (skipped ? ' — ' + tTask({ ru: 'пропущено: ', en: 'skipped: ' }) + skipped : ''), 3500);
  return diagram;
}

function bpmnImportXmlPick() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.bpmn,.xml,application/xml,text/xml';
  inp.onchange = () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { bpmnImportXmlText(rd.result, file.name); }
      catch (e) { toast('⚠ ' + e.message, 4000); }
    };
    rd.readAsText(file);
  };
  inp.click();
}
