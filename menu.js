'use strict';
/* ==========================================================================
   Módulo Menú: comidas de cada día, totales contra el objetivo y el
   armador automático que arma el día con lo disponible en la despensa.
   Usa los globales de index.html y de despensa.js.
   ========================================================================== */

let mday = todayKey(), nutOpen = false, pick = null;   // pick: { k, m } cuando se agrega un producto a mano

const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
function getMenu(k) {
  if (!db.menus[k]) db.menus[k] = { des:[], alm:[], mer:[], cen:[], lock:{} };
  return db.menus[k];
}
const peekMenu = k => db.menus[k] || { des:[], alm:[], mer:[], cen:[], lock:{} };
const mealItems = (mn, m) => (mn[m] || []).map(it => ({ ...it, f:findFood(it.id) })).filter(it => it.f);
function sumItems(items) {
  return items.reduce((a, it) => { const x = macrosFor(it.f, it.g); a.kcal += x.kcal; a.p += x.p; a.c += x.c; a.f += x.f; return a; }, { kcal:0, p:0, c:0, f:0 });
}
const dayTotals = mn => sumItems(MEALS.flatMap(m => mealItems(mn, m.id)));
const splitSum = () => db.nut.split.reduce((a, b) => a + b, 0) || 1;
const mealShare = id => db.nut.split[MEALS.findIndex(m => m.id === id)] / splitSum();

/* ---------- Armador ---------- */
const usable = (m, cat) => db.foods.filter(f => f.avail && f.stock !== 0 && f.cat === cat && (!f.meals.length || f.meals.includes(m)));
function pickOne(list, avoid) {
  if (!list.length) return null;
  const fresh = list.filter(f => !avoid.has(f.id)), pool = fresh.length ? fresh : list;
  return pool[Math.floor(Math.random() * pool.length)];
}
// Paso de ajuste de cantidad: una porción (o media, si es grande), o 5–10 g.
const stepOf = f => f.portion ? (f.portion.g >= 80 ? f.portion.g / 2 : f.portion.g) : (f.cat === 'fat' ? 5 : 10);
function limits(f) {
  let max = f.portion ? Math.min(f.portion.g * (f.cat === 'fat' ? 2 : 4), 600) : (f.cat === 'fat' ? 30 : 400);
  if (f.stock != null) max = Math.min(max, f.stock);
  return { min:Math.min(stepOf(f), max), max };
}
function fitQty(f, g) {
  const { min, max } = limits(f), st = stepOf(f);
  const r = Math.round(Math.min(max, Math.max(min, g)) / st) * st;
  return Math.min(max, Math.max(min, r));
}

// Arma una comida con un objetivo de calorías T y de proteína Pt (0 = sin objetivo de proteína).
function buildMeal(m, T, Pt, avoid) {
  const savory = m === 'alm' || m === 'cen', items = [], fixed = [];
  const add = (f, g) => { const it = { f, g:fitQty(f, g) }; items.push(it); return it; };
  let main = pickOne(usable(m, 'prot'), avoid), carb = pickOne(usable(m, 'carb'), avoid);
  if (savory) {
    const veg = pickOne(usable(m, 'veg'), avoid), fat = pickOne(usable(m, 'fat'), avoid);
    if (veg) fixed.push([veg, veg.portion ? veg.portion.g : 150]);
    if (fat) fixed.push([fat, fat.portion ? fat.portion.g : 10]);
  } else {
    const lac = pickOne(usable(m, 'lac'), avoid), fr = pickOne(usable(m, 'fruit'), avoid);
    if (!main) main = lac; else if (lac) fixed.push([lac, lac.portion ? lac.portion.g : 200]);
    if (fr) fixed.push([fr, fr.portion ? fr.portion.g : 150]);
  }
  if (!main && !carb && !fixed.length) return [];
  fixed.forEach(([f, g]) => add(f, g));
  while (items.length && sumItems(items).kcal > T * .4) items.pop();   // los acompañamientos no pueden comerse la comida

  // 1) La fuente de proteína: cubrir la proteína objetivo (o ~1/3 de las calorías si no hay objetivo).
  let mainIt = null, carbIt = null;
  if (main) {
    const base = sumItems(items), room = (T - base.kcal) * (carb ? .65 : 1);
    const byKcal = (savory ? .35 : .3) * T * 100 / kcalOf(main);
    // Con objetivo de proteína se apunta a cubrirlo, pero sin bajar de un piso para que el plato tenga sentido.
    let g = Pt && main.p > 0 ? Math.max(Math.max(0, Pt - base.p) * 100 / main.p, byKcal * .7) : byKcal;
    g = Math.min(g, Math.max(0, room) * 100 / kcalOf(main));
    mainIt = add(main, g);
  }
  // 2) El carbohidrato completa las calorías que faltan.
  if (carb && carb !== main) {
    const R = T - sumItems(items).kcal, g = R * 100 / kcalOf(carb);
    if (g >= limits(carb).min * .6) carbIt = add(carb, g);
  }
  // 3) Ajuste fino: bajar si se pasó, subir el carbohidrato si quedó corto.
  for (const it of [carbIt, mainIt].filter(Boolean)) {
    while (sumItems(items).kcal > T * 1.05 && it.g - stepOf(it.f) >= limits(it.f).min) it.g -= stepOf(it.f);
  }
  // Si quedó corto, se agranda primero el carbohidrato, después los acompañamientos (hasta el doble)
  // y por último la proteína.
  const side = items.filter(it => it !== carbIt && it !== mainIt);
  side.forEach(it => { it.cap = Math.min(limits(it.f).max, it.g * 2); });
  for (const it of [carbIt, ...side, mainIt].filter(Boolean)) {
    while (sumItems(items).kcal < T * .95 && it.g + stepOf(it.f) <= (it.cap || limits(it.f).max)) {
      it.g += stepOf(it.f);
      if (sumItems(items).kcal > T * 1.05) { it.g -= stepOf(it.f); break; }
    }
  }
  return items.sort((a, b) => CAT_ORDER.indexOf(a.f.cat) - CAT_ORDER.indexOf(b.f.cat))
    .map(it => ({ id:it.f.id, g:Math.round(it.g * 10) / 10 }));
}

// Arma las comidas `which` del día k, en orden. Lo que ya está cargado en las demás comidas se
// descuenta del tope; las comidas vacías que no se arman se reservan su parte del reparto.
// Cada comida recibe su parte de lo que queda, así lo que sobra o falta en una se compensa en las siguientes.
function buildDay(k, which) {
  const mn = getMenu(k), cap = db.nut.kcal, prot = db.nut.prot;
  const kept = MEALS.filter(m => !which.includes(m.id) && mealItems(mn, m.id).length);
  const used = sumItems(kept.flatMap(m => mealItems(mn, m.id)));
  let pending = MEALS.map(m => m.id).filter(id => !kept.some(m => m.id === id));
  const avoid = new Set(kept.flatMap(m => mn[m.id].map(it => it.id)));
  MEALS.map(m => m.id).filter(id => which.includes(id)).forEach(id => {
    const w = mealShare(id) / (pending.reduce((a, x) => a + mealShare(x), 0) || 1);
    mn[id] = buildMeal(id, Math.max(0, cap - used.kcal) * w, prot ? Math.max(0, prot - used.p) * w : 0, avoid);
    const t = sumItems(mealItems(mn, id));
    used.kcal += t.kcal; used.p += t.p;
    pending = pending.filter(x => x !== id);
    mn[id].forEach(it => avoid.add(it.id));
  });
}

/* ---------- Vista Comidas ---------- */
function dayLabel(k) {
  const d = parseKey(k), t = todayKey();
  const rel = k === t ? 'Hoy' : k === addDays(t, 1) ? 'Mañana' : k === addDays(t, -1) ? 'Ayer' : DAYS_LONG[wd(k)];
  return { rel, full:`${DAYS_LONG[wd(k)]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}` };
}

function nutEditorHTML() {
  const N = db.nut, sum = N.split.reduce((a, b) => a + b, 0);
  return `<div class="nut">
    <div class="grid2">
      <label class="fld"><small>Tope de calorías</small><input id="nut-kcal" inputmode="numeric" value="${N.kcal || ''}" placeholder="3000"><em>kcal</em></label>
      <label class="fld"><small>Proteína mínima</small><input id="nut-prot" inputmode="numeric" value="${N.prot || ''}" placeholder="opcional"><em>g</em></label>
    </div>
    <p class="hint">Referencia habitual en déficit con entrenamiento de fuerza: 1,6 a 2,2 g de proteína por kilo de peso.</p>
    <p class="sub-lbl" style="margin-bottom:4px">Reparto entre comidas</p>
    ${MEALS.map((m, i) => `<div class="mrow"><span>${m.n}</span>
      <div class="mstep"><button data-a="nutSplit" data-i="${i}" data-d="-5" aria-label="Menos">${ic('minus', 16)}</button>
        <b class="num">${N.split[i]}%</b>
        <button data-a="nutSplit" data-i="${i}" data-d="5" aria-label="Más">${ic('plus', 16)}</button></div>
      <span class="mk num" id="mk-${i}">${n0(N.kcal * N.split[i] / 100)} kcal</span></div>`).join('')}
    ${sum !== 100 ? `<p class="bad" style="font-size:13px;margin-top:8px">El reparto suma ${sum}%: ajustalo para que dé 100%.</p>` : ''}
  </div>`;
}

function totalsHTML(mn) {
  const t = dayTotals(mn), cap = db.nut.kcal, prot = db.nut.prot, left = cap - t.kcal, over = left < -cap * .02;
  const pctK = x => t.kcal ? Math.round(x / t.kcal * 100) : 0;
  const macro = (cls, label, g, kc, goal) => `<div class="mt"><small>${label}</small><b class="num ${cls}">${n0(g)} g</b>
    <span>${goal ? `mín. ${goal} g` : `${pctK(kc)}% kcal`}</span>
    ${goal ? `<div class="bar"><i style="width:${Math.min(100, g / goal * 100)}%;background:${g >= goal * .95 ? 'var(--ok)' : 'var(--c-p)'}"></i></div>` : ''}</div>`;
  return `<section class="card">
    <div class="tot"><div><p class="eyebrow">Total del día</p><p><b class="big num">${n0(t.kcal)}</b> <span class="mu">/ ${n0(cap)} kcal</span></p></div>
      <span class="pill ${over ? 'missed' : t.kcal >= cap * .95 ? 'done' : ''}">${over ? `Te pasaste ${n0(-left)}` : left > 0 ? `Quedan ${n0(left)}` : 'En el tope'}</span></div>
    <div class="bar"><i style="width:${Math.min(100, t.kcal / (cap || 1) * 100)}%;background:${over ? 'var(--bad)' : 'var(--ok)'}"></i></div>
    <div class="mts">${macro('p', 'Proteínas', t.p, t.p * 4, prot)}${macro('c', 'Carbos', t.c, t.c * 4)}${macro('g', 'Grasas', t.f, t.f * 9)}</div>
    ${prot && t.kcal && t.p < prot * .95 ? `<p class="hint">Falta proteína: sumá una porción proteica o cargá más opciones en la despensa.</p>` : ''}
    <button class="chip ${nutOpen ? 'on' : ''}" style="margin-top:12px" data-a="nutToggle">${ic('sliders', 16)} Objetivo y reparto</button>
    ${nutOpen ? nutEditorHTML() : ''}
  </section>`;
}

function itemAmount(it) {
  const f = it.f, base = fmtQty(it.g, f.unit);
  if (!f.portion) return base;
  const u = it.g / f.portion.g;
  return `${base} · ${n1(u)} × ${esc(f.portion.n.replace(/^1\s+/, ''))}`;
}

function mealHTML(mn, m) {
  const items = mealItems(mn, m.id), t = sumItems(items), lock = !!(mn.lock && mn.lock[m.id]);
  const target = db.nut.kcal * mealShare(m.id);
  const rows = items.map((it, i) => `<div class="mi">
      <div><b>${esc(it.f.name)}</b><span>${itemAmount(it)}</span><span class="mac2">${n0(macrosFor(it.f, it.g).kcal)} kcal · P ${n1(macrosFor(it.f, it.g).p)} g</span></div>
      <div class="mstep"><button data-a="miStep" data-m="${m.id}" data-i="${i}" data-d="-1" aria-label="Menos">${ic('minus', 16)}</button>
        <button data-a="miStep" data-m="${m.id}" data-i="${i}" data-d="1" aria-label="Más">${ic('plus', 16)}</button></div>
      <button class="mdel" data-a="miDel" data-m="${m.id}" data-i="${i}" aria-label="Quitar">${ic('x', 16)}</button>
    </div>`).join('');
  return `<section class="card meal">
    <div class="mh"><div><h3>${m.n}</h3><p class="eyebrow num">${items.length ? `${n0(t.kcal)} de ~${n0(target)} kcal · P ${n0(t.p)} g` : `objetivo ~${n0(target)} kcal`}</p></div>
      <button class="lockbtn ${lock ? 'on' : ''}" data-a="mLock" data-m="${m.id}" aria-pressed="${lock}">${ic(lock ? 'lock' : 'unlock', 16)} ${lock ? 'Fijada' : 'Libre'}</button></div>
    ${rows || '<p class="hint" style="margin:6px 0 0">Vacía. Tocá <b>Armar el día</b> o agregá productos a mano.</p>'}
    <div class="chips" style="margin-top:10px">
      <button class="chip" data-a="mAdd" data-m="${m.id}">${ic('plus', 16, 2.6)} Agregar</button>
      <button class="chip" data-a="mReroll" data-m="${m.id}">${ic('shuffle', 16)} Otra opción</button>
      ${items.length ? `<button class="chip" data-a="mClear" data-m="${m.id}">Vaciar</button>` : ''}
    </div>
  </section>`;
}

function menuHTML() {
  normFoods();
  const mn = peekMenu(mday), L = dayLabel(mday);
  const allLocked = MEALS.every(m => mn.lock && mn.lock[m.id]);
  const noFoods = !db.foods.some(f => f.avail);
  return `${switchHTML()}
  <header class="top"><div><p class="eyebrow">Menú · ${L.full}</p><h1>${L.rel === DAYS_LONG[wd(mday)] ? 'Comidas del día' : `Comidas de ${L.rel.toLowerCase()}`}</h1></div></header>
  <div class="weeknav">
    <button class="icon-btn" data-a="mDay" data-d="-1" aria-label="Día anterior">${ic('chevL')}</button>
    <button class="lbl" data-a="mDay" data-d="0">${L.rel}${mday !== todayKey() ? '<small>Volver a hoy</small>' : ''}</button>
    <button class="icon-btn" data-a="mDay" data-d="1" aria-label="Día siguiente">${ic('chevR')}</button>
  </div>
  ${noFoods ? `<section class="card"><p class="hint" style="margin:0 0 10px">Para armar menús primero cargá lo que tenés en la despensa.</p>
    <button class="btn sm" data-a="go" data-v="pantry">${ic('box', 18)} Ir a la despensa</button></section>` : ''}
  ${totalsHTML(mn)}
  ${MEALS.map(m => mealHTML(mn, m)).join('')}
  <p class="hint" style="text-align:center;margin-bottom:8px">Las cantidades son en crudo o como figuran en la despensa. Los valores son aproximados.</p>
  <div class="cta"><button class="btn primary" data-a="mBuild" ${allLocked ? 'disabled' : ''}>${ic('shuffle', 22)} ${allLocked ? 'Todas las comidas están fijadas' : 'Armar el día'}</button></div>`;
}

/* ---------- Hoja: agregar un producto a una comida ---------- */
function pickListHTML(q) {
  const words = nrm(q).split(/\s+/).filter(Boolean);
  const list = [...db.foods].filter(f => words.every(w => nrm(f.name).includes(w)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const fits = f => f.avail && (!f.meals.length || f.meals.includes(pick.m));
  const row = f => `<button class="pk ${f.avail ? '' : 'off'}" data-a="pickFood" data-id="${f.id}"><b>${esc(f.name)}</b>
    <small>${f.portion ? `${esc(f.portion.n)} (${n1(f.portion.g)} ${f.unit}): ${n0(macrosFor(f, f.portion.g).kcal)} kcal · P ${n1(macrosFor(f, f.portion.g).p)}` : `100 ${f.unit}: ${n0(kcalOf(f))} kcal · P ${n1(f.p)}`}</small></button>`;
  const a = list.filter(fits), b = list.filter(f => !fits(f));
  if (!db.foods.length) return `<p class="hint">La despensa está vacía.</p><button class="btn sm" style="margin-top:10px" data-a="go" data-v="pantry">${ic('box', 18)} Ir a la despensa</button>`;
  if (!list.length) return `<p class="hint">No hay productos con ese nombre en la despensa.</p>`;
  return (a.length ? `<p class="grp">Para ${mealName(pick.m).toLowerCase()}</p>${a.map(row).join('')}` : '') +
    (b.length ? `<p class="grp">Otros productos</p>${b.map(row).join('')}` : '');
}

function pickSheetHTML() {
  if (!pick) return '';
  return `<div class="sheet-bg" data-a="pickClose"></div>
  <div class="sheet" role="dialog" aria-label="Agregar producto"><div class="grab"></div>
    <div class="top" style="margin:0 0 10px"><h2>Agregar a ${mealName(pick.m).toLowerCase()}</h2>
      <button class="icon-btn" data-a="pickClose" aria-label="Cerrar">${ic('x')}</button></div>
    <label class="fld"><input id="pick-q" placeholder="Buscar en la despensa" autocomplete="off"><em>${ic('search', 18)}</em></label>
    <div id="pick-list" style="margin-top:6px">${pickListHTML('')}</div>
  </div>`;
}

/* ---------- Acciones ---------- */
const lockMeal = (mn, m, on) => { mn.lock = mn.lock || {}; mn.lock[m] = on; };
Object.assign(actions, {
  go(d) { view = d.v; sheetOpen = false; foodDraft = null; pick = null; render(); scrollTo(0, 0); },
  mDay(d) { mday = +d.d === 0 ? todayKey() : addDays(mday, +d.d); render(); },
  nutToggle() { nutOpen = !nutOpen; render(); },
  nutSplit(d) {
    const s = db.nut.split, i = +d.i;
    s[i] = Math.min(100, Math.max(0, s[i] + +d.d));
    save(); render();
  },
  mBuild() {
    if (!db.foods.some(f => f.avail)) { toast('Primero cargá productos en la despensa'); return; }
    const mn = getMenu(mday), which = MEALS.map(m => m.id).filter(id => !(mn.lock && mn.lock[id]));
    buildDay(mday, which);
    save(); render();
    const t = dayTotals(mn);
    toast(`Día armado: ${n0(t.kcal)} kcal · ${n0(t.p)} g de proteína`);
  },
  mReroll(d) {
    if (!db.foods.some(f => f.avail)) { toast('Primero cargá productos en la despensa'); return; }
    const mn = getMenu(mday), before = JSON.stringify(mn[d.m]);
    lockMeal(mn, d.m, false);
    for (let i = 0; i < 8; i++) { buildDay(mday, [d.m]); if (JSON.stringify(mn[d.m]) !== before) break; }
    if (!mn[d.m].length) toast(`No hay productos disponibles para ${mealName(d.m).toLowerCase()}`);
    save(); render();
  },
  mLock(d) { const mn = getMenu(mday); lockMeal(mn, d.m, !(mn.lock && mn.lock[d.m])); save(); render(); },
  mClear(d) { const mn = getMenu(mday); mn[d.m] = []; lockMeal(mn, d.m, false); save(); render(); },
  mAdd(d) { pick = { k:mday, m:d.m }; render(); },
  pickClose() { pick = null; render(); },
  pickFood(d) {
    const f = findFood(d.id), mn = getMenu(pick.k), m = pick.m;
    const it = mn[m].find(x => x.id === f.id);
    if (it) it.g += stepOf(f);
    else mn[m].push({ id:f.id, g:f.portion ? f.portion.g : f.cat === 'fat' ? 10 : 100 });
    lockMeal(mn, m, true);
    pick = null; save(); render(); toast(`${f.name} agregado ✓`);
  },
  miStep(d) {
    const mn = getMenu(mday), it = mealItems(mn, d.m)[+d.i]; if (!it) return;
    const st = stepOf(it.f), raw = mn[d.m].find(x => x.id === it.id);
    raw.g = Math.max(st, Math.round((raw.g + st * +d.d) * 10) / 10);
    lockMeal(mn, d.m, true); save(); render();
  },
  miDel(d) {
    const mn = getMenu(mday), it = mealItems(mn, d.m)[+d.i]; if (!it) return;
    mn[d.m] = mn[d.m].filter(x => x.id !== it.id);
    lockMeal(mn, d.m, mn[d.m].length > 0); save(); render();
  }
});

/* ---------- Entradas de texto ---------- */
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pick-q' && pick) { document.getElementById('pick-list').innerHTML = pickListHTML(t.value); return; }
  if (t.id === 'nut-kcal' || t.id === 'nut-prot') {
    db.nut[t.id === 'nut-kcal' ? 'kcal' : 'prot'] = Math.round(num(t.value));
    save();
    db.nut.split.forEach((s, i) => { const el = document.getElementById('mk-' + i); if (el) el.textContent = `${n0(db.nut.kcal * s / 100)} kcal`; });
  }
});
// Al salir del campo se actualizan los totales.
document.addEventListener('change', e => { if (e.target.id === 'nut-kcal' || e.target.id === 'nut-prot') render(); });
