// RAPTOR PET — маскот-раптор.
// Спрайт: raptor-cutout.png в корне проекта — готовый вырез 3D-модели с
// прозрачным фоном (сделан offline из raptor.png, см. соответствующий
// скрипт подготовки). Нет файла — используется SVG-заглушка.
// Поведение: по умолчанию скрыт. Кнопка-коготь (низ, справа, под линией
// бега) призывает его — выпрыгивает из гнезда (правый край) и бегает за
// мышкой, прыгает, кусает. Клик по раптору, ~9с простоя или повторный
// клик по когтю — убегает в гнездо, ложится спать и исчезает.
// Канвас не блокирует: pointer-events только на самом спрайте и кнопке.

(function () {
  const W = 96; // px по ширине — «не прям большой»
  let H = 72;   // пересчитается по факту спрайта

  // ── SVG-заглушка (используется, пока нет raptor.png) ──
  const FALLBACK_SVG = `
<svg width="${W}" height="${H}" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
  <polygon points="2,44 30,38 27,48" fill="#7a7a7a"/><polygon points="2,44 27,48 22,52" fill="#636363"/>
  <polygon points="27,48 30,38 50,36" fill="#8f8f8f"/><polygon points="27,48 50,36 50,52" fill="#747474"/>
  <polygon points="50,36 58,28 72,30" fill="#b0b0b0"/><polygon points="50,36 72,30 50,52" fill="#949494"/>
  <polygon points="50,52 72,30 76,52" fill="#828282"/><polygon points="50,52 76,52 64,60" fill="#5f5f5f"/>
  <polygon points="72,30 86,32 76,52" fill="#9e9e9e"/><polygon points="86,32 94,38 84,50 76,52" fill="#8a8a8a"/>
  <polygon points="86,32 92,16 100,26" fill="#adadad"/><polygon points="86,32 100,26 94,38" fill="#909090"/>
  <polygon points="90,14 108,8 114,16" fill="#c2c2c2"/><polygon points="90,14 114,16 98,24" fill="#a8a8a8"/>
  <polygon points="98,24 114,16 132,22" fill="#9c9c9c"/><polygon points="98,24 132,22 118,29" fill="#868686"/>
  <polygon points="97,15 104,13 103,19 96,19" fill="#c8321e"/>
  <polygon points="100,28 126,30 104,38" fill="#707070"/>
  <polygon points="46,42 60,46 56,62 44,58" fill="#616161"/><polygon points="50,60 58,62 64,76 56,77" fill="#525252"/>
  <polygon points="56,77 64,76 62,88 55,88" fill="#464646"/><polygon points="55,88 62,88 72,91 54,93" fill="#3d3d3d"/>
  <polygon points="52,40 68,44 62,62 50,58" fill="#8a8a8a"/><polygon points="56,60 66,62 72,77 62,78" fill="#787878"/>
  <polygon points="62,78 72,77 70,89 61,89" fill="#696969"/><polygon points="61,89 70,89 82,92 60,95" fill="#575757"/>
</svg>`;

  const css = document.createElement('style');
  css.textContent = `
#raptor-pet{position:fixed;left:24px;bottom:30px;z-index:350;cursor:pointer;pointer-events:auto;
  user-select:none;-webkit-user-select:none;filter:drop-shadow(1px 3px 3px rgba(0,0,0,.28))}
#raptor-pet:hover{filter:drop-shadow(1px 3px 7px rgba(0,0,0,.45))}
#raptor-pet .rp-sprite{display:block;transform-origin:50% 100%}
/* Спит — завален набок на землю (не стоя), пивот у задних лап, чтобы
   бёдра оставались на месте, а корпус лёг вперёд-вниз. */
#raptor-pet.sleep .rp-sprite{animation:rp-lie-breathe 3.6s ease-in-out infinite;
  transform-origin:22% 96%}
#raptor-pet .rp-zzz{position:absolute;top:-16px;right:4px;font:700 14px Tahoma,sans-serif;color:#8a8a8a;
  opacity:0;pointer-events:none;text-shadow:1px 1px 0 #fff8}
#raptor-pet.sleep .rp-zzz{opacity:1;animation:rp-zzz 3.4s ease-in-out infinite;top:-30px}
#raptor-pet.run .rp-sprite{animation:rp-gallop .3s linear infinite}
#raptor-pet.bite .rp-sprite{animation:rp-chomp .38s ease-out}
/* послойный спрайт: корпус + качающиеся ноги + откидная челюсть */
#raptor-pet .rp-layers{position:relative}
#raptor-pet .rp-layers img{position:absolute;left:0;top:0;display:block}
/* Pivot at the HIP (top of the leg slice) — theropod limbs swing from the
   femur head, knee-driven; the foot lifts to clear ground on the swing. */
#raptor-pet .rp-legF{transform-origin:64% 47%}
#raptor-pet .rp-legB{transform-origin:48% 47%;filter:brightness(.82)}
#raptor-pet .rp-jaw{transform-origin:79% 26%}
#raptor-pet .rp-head{transform-origin:66% 24%}
#raptor-pet.run .rp-legF{animation:rp-step .52s cubic-bezier(.45,0,.55,1) infinite}
#raptor-pet.run .rp-legB{animation:rp-step .52s cubic-bezier(.45,0,.55,1) infinite;animation-delay:-.26s}
#raptor-pet.run .rp-head{animation:rp-headbob .52s ease-in-out infinite}
#raptor-pet.bite .rp-jaw{animation:rp-jawopen .38s ease-out}
/* Asymmetric duty cycle: long planted stance (foot down, pushing back) then a
   quick lifted swing forward. Small amplitude — heavy theropod, not gracile. */
@keyframes rp-step{
  0%{transform:rotate(-12deg) translateY(0)}      /* plant, foot forward */
  50%{transform:rotate(12deg) translateY(0)}      /* stance: planted, pushing back (slow half) */
  63%{transform:rotate(12deg) translateY(-3px)}   /* toe-off, lift */
  84%{transform:rotate(-7deg) translateY(-4px)}   /* swing forward, clearing ground (fast) */
  100%{transform:rotate(-12deg) translateY(0)}    /* reach, settling down */
}
@keyframes rp-headbob{0%,100%{transform:translateY(.5px) rotate(.5deg)}50%{transform:translateY(-.5px) rotate(-.5deg)}}
@keyframes rp-jawopen{0%{transform:rotate(0)}30%{transform:rotate(17deg)}75%{transform:rotate(-2deg)}100%{transform:rotate(0)}}
@keyframes rp-lie-breathe{
  0%,100%{transform:rotate(76deg) scaleY(1)}
  50%{transform:rotate(76deg) scaleY(1.035)}
}
@keyframes rp-zzz{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-6px);opacity:1}}
/* Horizontal carriage over the hips: a whisper of vertical bob, no pitch — a
   walking theropod glides, it doesn't hop like a sparrow. */
@keyframes rp-gallop{
  0%,100%{transform:translateY(0)}
  25%{transform:translateY(-1px)}
  50%{transform:translateY(0)}
  75%{transform:translateY(-1px)}
}
@keyframes rp-chomp{0%{transform:translate(0,0) rotate(0)}35%{transform:translate(7px,-3px) rotate(7deg) scaleY(.94)}70%{transform:translate(2px,0) rotate(-2deg)}100%{transform:translate(0,0)}}
#raptor-pet.popin{animation:rp-popin .38s cubic-bezier(.34,1.56,.64,1)}
@keyframes rp-popin{0%{transform:scale(.3) translateY(10px);opacity:0}60%{transform:scale(1.08) translateY(0);opacity:1}100%{transform:scale(1)}}
#raptor-toggle{position:fixed;right:6px;bottom:1px;width:18px;height:18px;z-index:360;cursor:pointer;
  color:#8a8a8a;opacity:.75;transition:color .25s,opacity .2s,filter .25s}
#raptor-toggle:hover{opacity:1}
#raptor-toggle.on{color:#c8321e;opacity:1;filter:drop-shadow(0 0 2px #c8321e88)}
#raptor-toggle svg{display:block;width:100%;height:100%}
`;
  document.head.appendChild(css);

  const pet = document.createElement('div');
  pet.id = 'raptor-pet';
  pet.title = 'Раптор убегает — кликни ещё раз по когтю, чтобы позвать';
  pet.innerHTML = `<div class="rp-sprite">${FALLBACK_SVG}</div><span class="rp-zzz">☾ ⋆</span>`;
  pet.style.display = 'none';
  document.body.appendChild(pet);

  // ── кнопка-коготь: призвать / отпустить раптора ──
  const toggleBtn = document.createElement('div');
  toggleBtn.id = 'raptor-toggle';
  toggleBtn.title = 'Позвать раптора';
  toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 21 L9 3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M9.5 22 L14.5 2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M15 21 L20 3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  </svg>`;
  document.body.appendChild(toggleBtn);

  // ── подхват готового вырезанного спрайта (фон уже убран offline,
  // см. raptor-cutout.png) — без canvas/getImageData, чтобы работало
  // и при открытии index.html напрямую как file:// ──
  const src = new Image();
  src.onload = () => {
    try {
      const url = src.src;
      H = Math.round(W * src.naturalHeight / src.naturalWidth);

      // Послойная сборка из одной картинки через clip-path: корпус с
      // вырезами под ноги и нижнюю челюсть, поверх — подвижные копии этих
      // зон. Ноги качаются в противофазе при беге, челюсть откидывается
      // при укусе (вырез в корпусе даёт реально открытую пасть).
      // Legs are the ONLY legs below CUT_TOP (body cut away there) so their
      // motion is clearly visible. Each leg SLICE starts higher (LEG_TOP) and
      // overlaps intact body down to CUT_TOP — that overlap band always covers
      // the cutout's top corners as the leg rotates, so no hole ever opens.
      const CUT_TOP = 60, LEG_TOP = 44;
      const LEGB_L = 38, LEGB_R = 58, LEGF_L = 54, LEGF_R = 80;
      const JAW_T = 26, JAW_B = 40, JAW_L = 78;
      const HEAD_L = 66, HEAD_B = 24;
      const clips = {
        // body: jaw cutout + a single wide cutout under both legs
        body: `polygon(0% 0%, 100% 0%, 100% ${JAW_T}%, ${JAW_L}% ${JAW_T}%, ${JAW_L}% ${JAW_B}%, 100% ${JAW_B}%, 100% 100%, ${LEGF_R}% 100%, ${LEGF_R}% ${CUT_TOP}%, ${LEGB_L}% ${CUT_TOP}%, ${LEGB_L}% 100%, 0% 100%)`,
        legB: `polygon(${LEGB_L}% ${LEG_TOP}%, ${LEGB_R}% ${LEG_TOP}%, ${LEGB_R}% 100%, ${LEGB_L}% 100%)`,
        legF: `polygon(${LEGF_L}% ${LEG_TOP}%, ${LEGF_R}% ${LEG_TOP}%, ${LEGF_R}% 100%, ${LEGF_L}% 100%)`,
        head: `polygon(${HEAD_L}% 0%, 100% 0%, 100% ${HEAD_B}%, ${HEAD_L}% ${HEAD_B}%)`,
        jaw:  `polygon(${JAW_L}% ${JAW_T}%, 100% ${JAW_T}%, 100% ${JAW_B}%, ${JAW_L}% ${JAW_B}%)`,
      };
      const layers = document.createElement('div');
      layers.className = 'rp-layers';
      layers.style.width = W + 'px';
      layers.style.height = H + 'px';
      ['legB', 'body', 'legF', 'head', 'jaw'].forEach(name => {
        const im = new Image();
        im.src = url;
        im.width = W; im.height = H;
        im.draggable = false;
        im.className = 'rp-' + name;
        im.style.clipPath = clips[name];
        layers.appendChild(im);
      });
      const holder = pet.querySelector('.rp-sprite');
      holder.innerHTML = '';
      holder.appendChild(layers);
    } catch (e) { /* file:// без CORS и т.п. — остаёмся на SVG-заглушке */ }
  };
  src.src = 'raptor-cutout.png?v=1';

  // ── поведение ──────────────────────────────────────────
  // mode: 'hidden' (в гнезде, не виден) | 'chase' (бегает за мышкой) |
  // 'retreat' (бежит домой в гнездо, чтобы лечь спать и исчезнуть)
  let mode = 'hidden';
  let px2 = 24, py = null;
  let vy = 0, jumping = false;
  let facing = 1; // спрайт смотрит ВПРАВО в исходнике
  let mx = 0, my = 0, lastMouseMove = 0, lastBite = 0;
  let rafId = null;

  // «Пол» — верхняя кромка статус-бара (если его нет на странице,
  // отступаем фиксированные 30px от низа окна). Раптор не левитирует —
  // лапы всегда стоят ровно на этой линии.
  function floorY() {
    const sb = document.getElementById('statusbar');
    return sb ? sb.getBoundingClientRect().top : innerHeight - 30;
  }
  function groundY() { return floorY() - H + 6; }
  // Гнездо — у самого правого края, вдоль той же линии бега.
  function nestX() { return innerWidth - W - 16; }

  // Блоки — не магнит и не цель для наведения: это просто твёрдые
  // поверхности. Раптор прыгает сам (кусь-механика ниже), и если его
  // траектория ПАДЕНИЯ проходит через верх блока в диапазоне X — он
  // приземляется на него; если нет — падает на пол как обычно. Никакого
  // автоподтягивания при простой ходьбе под блоком.
  function landingBlockTop(fromY, toY) {
    if (typeof S === 'undefined' || !S.blocks || !S.blocks.length) return null;
    const canvas = document.getElementById('canvas');
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const footX = px2 + W / 2;
    const wx = footX - r.left - (S.panX || 0);
    const feetFrom = fromY + H, feetTo = toY + H;
    let best = null;
    for (const b of S.blocks) {
      const bwv = (typeof bw === 'function') ? bw(b) : (b.w || 140);
      if (wx < b.x || wx > b.x + bwv) continue;
      const topScreen = r.top + (S.panY || 0) + b.y;
      if (topScreen < feetFrom || topScreen > feetTo) continue; // траектория падения не задевает верх блока
      if (best === null || topScreen < best) best = topScreen;
    }
    return best;
  }

  function settleOnFloor() {
    if (mode !== 'hidden') return; // активного/убегающего раптора ресайзом не дёргаем
    py = groundY();
  }
  addEventListener('resize', settleOnFloor);
  // раскладка статус-бара окончательно готова только после полной
  // загрузки страницы — считаем «пол» на следующем кадре после load
  if (document.readyState === 'complete') requestAnimationFrame(settleOnFloor);
  else addEventListener('load', () => requestAnimationFrame(settleOnFloor));

  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    if (mode === 'chase') lastMouseMove = performance.now();
  });

  function updateToggle(active) {
    toggleBtn.classList.toggle('on', active);
    toggleBtn.title = active ? 'Отпустить раптора спать' : 'Позвать раптора';
  }

  // Клик по когтю: в гнезде — выпрыгивает и бегает; иначе — сразу домой спать.
  toggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (mode === 'hidden') summon(); else retreat();
  });

  // Клик по самому раптору — надоел, убегает домой.
  pet.addEventListener('click', e => {
    e.stopPropagation();
    if (mode === 'chase') retreat();
  });

  function summon() {
    if (mode !== 'hidden') return;
    mode = 'chase';
    jumping = false; vy = 0;
    facing = -1; // выходит из гнезда справа — смотрит влево, к центру
    px2 = nestX();
    py = groundY();
    pet.style.display = '';
    pet.style.bottom = 'auto';
    pet.style.left = px2.toFixed(1) + 'px';
    pet.style.top = py.toFixed(1) + 'px';
    pet.style.transform = 'scaleX(-1)';
    pet.classList.remove('sleep');
    pet.classList.add('popin');
    setTimeout(() => pet.classList.remove('popin'), 380);
    lastMouseMove = performance.now();
    updateToggle(true);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  // Убегает в гнездо; там ложится спать и через паузу пропадает совсем.
  function retreat() {
    if (mode === 'hidden' || mode === 'retreat') return;
    mode = 'retreat';
    jumping = false; vy = 0;
    pet.classList.remove('bite');
  }

  function mouthPoint() {
    // пасть — правый верхний квадрант спрайта (при развороте зеркалится)
    const jx = facing === 1 ? px2 + W * 0.85 : px2 + W * 0.15;
    return { x: jx, y: py + H * 0.22 };
  }

  function tick(now) {
    if (mode === 'hidden') return;
    if (mode === 'chase' && now - lastMouseMove > 9000) { retreat(); }

    if (mode === 'retreat') {
      const tx = nestX();
      const dx = tx - px2;
      if (Math.abs(dx) > 4) {
        px2 += Math.sign(dx) * Math.min(Math.abs(dx) * 0.12, 9);
        facing = dx >= 0 ? 1 : -1;
        pet.classList.add('run');
        py = groundY();
      } else {
        // добежал до гнезда — ложится спать и остаётся так на виду
        // (не исчезает), пока коготь не позовёт его снова.
        px2 = tx; py = groundY();
        pet.classList.remove('run');
        pet.classList.add('sleep');
        pet.style.transform = 'scaleX(-1)';
        updateToggle(false);
        mode = 'hidden';
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        pet.style.left = px2.toFixed(1) + 'px';
        pet.style.top = py.toFixed(1) + 'px';
        return;
      }
      pet.style.left = px2.toFixed(1) + 'px';
      pet.style.top = py.toFixed(1) + 'px';
      pet.style.transform = facing === 1 ? '' : 'scaleX(-1)';
      rafId = requestAnimationFrame(tick);
      return;
    }

    const targetX = Math.min(Math.max(mx - W / 2, 4), innerWidth - W - 4);
    const dx = targetX - px2;
    const dist = Math.abs(dx);
    // В прыжке шаг шире — курсор влево/вправо явно тянет раптора в
    // прыжке в свою сторону (эффект leap, а не чисто вертикальный скачок).
    const step = jumping ? Math.min(dist * 0.09, 8) * 1.8 : Math.min(dist * 0.09, 8);

    if (dist > 12) {
      px2 += Math.sign(dx) * step;
      facing = dx >= 0 ? 1 : -1;
      pet.classList.add('run');
    } else if (!jumping) {
      pet.classList.remove('run');
    }

    // ПРЫЖОК: курсор просто где-то над телом раптора (не нужно целиться
    // точно в пасть — широкая зона по X, любая высота выше него).
    const bodyCX = px2 + W / 2;
    const overBody = Math.abs(mx - bodyCX) < W / 2 + 30;
    const above = my < py - 15;
    if (!jumping && overBody && above && now - lastBite > 500) {
      lastBite = now;
      jumping = true;
      vy = -Math.min(16, 7.5 + (py - my) * 0.06);
      pet.classList.remove('bite'); void pet.offsetWidth;
      pet.classList.add('bite');
      setTimeout(() => pet.classList.remove('bite'), 420);
    }

    const floor = groundY();
    if (jumping) {
      const prevPy = py;
      py += vy; vy += 0.9;
      // Приземление ловим только при падении (vy>=0): если траектория
      // прошла через верх блока — встаём на него, иначе летим до пола.
      const landBlock = vy >= 0 ? landingBlockTop(prevPy, py) : null;
      if (landBlock !== null && landBlock - H <= floor) {
        py = landBlock - H; vy = 0; jumping = false;
      } else if (py >= floor) {
        py = floor; vy = 0; jumping = false;
      }
    } else {
      // Стоя (не в прыжке): если под лапами всё ещё та же опора —
      // остаёмся; сошёл с края блока — падаем под гравитацией, а не
      // телепортируемся ни вверх, ни вниз.
      const feetY = py + H;
      const stillSupported = landingBlockTop(feetY - 3, feetY + 3) !== null;
      if (!stillSupported && Math.abs(py - floor) > 2) {
        jumping = true; vy = 0;
      } else if (!stillSupported) {
        py = floor;
      }
    }

    pet.style.left = px2.toFixed(1) + 'px';
    pet.style.top = py.toFixed(1) + 'px';
    pet.style.bottom = 'auto';
    pet.style.transform = facing === 1 ? '' : 'scaleX(-1)';

    rafId = requestAnimationFrame(tick);
  }
})();
