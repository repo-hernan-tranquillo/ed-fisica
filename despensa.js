'use strict';
/* ==========================================================================
   Módulo Despensa: productos con su tabla nutricional, cantidad disponible
   y autocompletado desde la base de referencia (alimentos.js).
   Usa los globales de index.html: db, save, render, actions, ic, esc, toast, P, weekKeys.
   ========================================================================== */

Object.assign(P, {
  box:'<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  shuffle:'<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'
});

const MEALS = [
  { id:'des', n:'Desayuno' }, { id:'alm', n:'Almuerzo' },
  { id:'mer', n:'Merienda' }, { id:'cen', n:'Cena' }
];
const MEAL_SHORT = { des:'Des', alm:'Alm', mer:'Mer', cen:'Cena' };
const mealName = id => MEALS.find(m => m.id === id).n;

const CATS = {
  prot: { n:'Proteína', pl:'Proteínas', meals:['alm', 'cen'] },
  carb: { n:'Carbohidrato', pl:'Carbohidratos', meals:['alm', 'cen'] },
  lac: { n:'Lácteo', pl:'Lácteos', meals:['des', 'mer'] },
  fruit: { n:'Fruta', pl:'Frutas', meals:['des', 'mer'] },
  veg: { n:'Verdura', pl:'Verduras', meals:['alm', 'cen'] },
  fat: { n:'Grasa', pl:'Grasas y frutos secos', meals:['alm', 'cen'] },
  otro: { n:'Otro', pl:'Otros', meals:[] }
};
const CAT_ORDER = Object.keys(CATS);

/* ---------- Cálculos y formatos ---------- */
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) && n >= 0 ? n : 0; };
const n1 = n => n.toLocaleString('es-AR', { maximumFractionDigits:1 });
const n0 = n => Math.round(n).toLocaleString('es-AR');
const nrm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const autoKcal = f => Math.round(4 * f.p + 4 * f.c + 9 * f.f);
const kcalOf = f => f.kcal || autoKcal(f);
// Macros de una cantidad (g o ml) de un producto.
const macrosFor = (f, qty) => ({ kcal:kcalOf(f) * qty / 100, p:f.p * qty / 100, c:f.c * qty / 100, f:f.f * qty / 100 });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const macHTML = m => `<span class="mac"><i class="k">${n0(m.kcal)} kcal</i><i class="p">P ${n1(m.p)}</i><i class="c">C ${n1(m.c)}</i><i class="g">G ${n1(m.f)}</i></span>`;
const fmtQty = (g, unit = 'g') => g >= 1000 ? `${n1(g / 1000)} ${unit === 'ml' ? 'l' : 'kg'}` : `${n1(g)} ${unit}`;

// Tipo de alimento según de dónde vienen sus calorías (se puede cambiar a mano).
function guessCat(f) {
  const k = kcalOf(f) || 1, pS = 4 * f.p / k, cS = 4 * f.c / k, fS = 9 * f.f / k;
  if (fS >= .6) return 'fat';
  if (pS >= .35) return 'prot';
  if (k < 40) return 'veg';
  if (cS >= .6) return k < 100 ? 'fruit' : 'carb';
  return 'otro';
}

// "1 kg", "1,5kg", "500 g", "2 l", "750" → gramos (o ml). null si está vacío, NaN si no se entiende.
const QTY = '(\\d+(?:[.,]\\d+)?)\\s*(kg|kgs|kilos?|k|g|gr|grs|gramos|l|lts?|litros?|ml|cc)?\\.?';
function parseQty(s) {
  if (!String(s || '').trim()) return null;
  const m = String(s).match(new RegExp(`^\\s*${QTY}\\s*$`, 'i'));
  if (!m) return NaN;
  return num(m[1]) * (/^(k|l)/i.test(m[2] || '') ? 1000 : 1);
}
// "Pechuga de pollo 1kg" → { name:'Pechuga de pollo', qty:'1kg' }
function splitNameQty(s) {
  const m = String(s).match(new RegExp(`^(.*?\\S)[\\s,]+(${QTY.replace(/\((?!\?)/g, '(?:')})\\s*$`, 'i'));
  return m && /[a-záéíóúñ]/i.test(m[1]) && /\D/.test(m[2]) ? { name:m[1].trim(), qty:m[2] } : { name:String(s).trim(), qty:null };
}

// Completa campos que agregaron versiones nuevas de la app.
function normFoods() {
  db.foods.forEach(f => {
    if (!f.cat) f.cat = guessCat(f);
    if (!('stock' in f)) f.stock = null;
    if (!f.meals) f.meals = [];
  });
}
const findFood = id => db.foods.find(f => f.id === id);

// Cuánto de un producto usan los menús de la semana actual.
function weekUse(id) {
  return weekKeys(0).reduce((a, k) => {
    const mn = db.menus[k];
    return a + (mn ? MEALS.reduce((b, m) => b + (mn[m.id] || []).filter(it => it.id === id).reduce((s, it) => s + it.g, 0), 0) : 0);
  }, 0);
}

/* ---------- Vista Despensa ---------- */
let foodDraft = null;   // producto en edición (valores como texto, tal cual se tipean)

function stockLine(f) {
  const use = weekUse(f.id);
  let s = '';
  if (f.stock === 0) s = '<span class="bad">Se terminó</span>';
  else if (f.stock != null) {
    const m = macrosFor(f, f.stock);
    s = `Tenés <b>${fmtQty(f.stock, f.unit)}</b>: ${n0(m.p)} g de proteína · ${n0(m.kcal)} kcal`;
  }
  if (use > 0) s += `${s ? '<br>' : ''}En el menú de esta semana: ${fmtQty(use, f.unit)}${f.stock != null && use > f.stock ? ' <span class="bad">(no alcanza)</span>' : ''}`;
  return s ? `<span class="fstock">${s}</span>` : '';
}

function pantryHTML() {
  normFoods();
  const foods = [...db.foods].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const avail = foods.filter(f => f.avail).length;
  const row = f => `<div class="frow ${f.avail ? '' : 'off'}">
      <button class="fmain" data-a="foodEdit" data-id="${f.id}">
        <b>${esc(f.name)}</b>
        ${macHTML({ kcal:kcalOf(f), p:f.p, c:f.c, f:f.f })}
        <span class="fsub">cada 100 ${f.unit}${f.portion ? ` · ${esc(f.portion.n)} = ${n1(f.portion.g)} ${f.unit}` : ''}${f.meals.length ? ` · ${f.meals.map(m => MEAL_SHORT[m]).join(', ')}` : ''}</span>
        ${stockLine(f)}
      </button>
      <button class="fav ${f.avail ? 'on' : ''}" data-a="foodAvail" data-id="${f.id}" aria-pressed="${f.avail}" aria-label="Lo tengo disponible">${ic('check', 22, 3)}</button>
    </div>`;
  const groups = CAT_ORDER.map(c => ({ c, list:foods.filter(f => f.cat === c) })).filter(g => g.list.length);

  const body = foods.length
    ? `<p class="hint" style="margin:0 0 4px">Tocá un producto para editarlo. El tilde marca lo que tenés en casa: el armador del menú usa solo eso.</p>
       ${groups.map(g => `<p class="grp">${CATS[g.c].pl}</p>${g.list.map(row).join('')}`).join('')}`
    : `<p class="hint" style="margin-bottom:12px">Todavía no cargaste productos. Tocá <b>Agregar producto</b> y escribí el nombre: la app sugiere los valores de referencia y vos los ajustás con el envase. También podés cargar algunos de ejemplo para probar.</p>
       <button class="btn sm" data-a="foodExamples">Cargar productos de ejemplo</button>`;

  return `${switchHTML()}
  <header class="top"><div><p class="eyebrow">${foods.length ? `${foods.length} productos · ${avail} disponibles` : 'Vacía'}</p><h1>Despensa</h1></div></header>
  <section class="card">${body}</section>
  <div class="cta"><button class="btn primary" data-a="foodNew">${ic('plus', 22, 2.6)} Agregar producto</button></div>`;
}

/* ---------- Hoja: alta / edición de producto ---------- */
function foodSheetHTML() {
  const d = foodDraft;
  if (!d) return '';
  const fld = (k, label, unit, mode = 'decimal', ph = '') => `<label class="fld ${unit ? 'has-u' : ''}"><small>${label}</small>
    <input data-fd="${k}" inputmode="${mode}" value="${esc(d[k])}" placeholder="${ph}" autocomplete="off">${unit ? `<em>${unit}</em>` : ''}</label>`;
  return `<div class="sheet-bg" data-a="foodClose"></div>
  <div class="sheet" role="dialog" aria-label="Producto"><div class="grab"></div>
    <div class="top" style="margin:0 0 10px"><h2>${d.id ? 'Editar producto' : 'Nuevo producto'}</h2>
      <button class="icon-btn" data-a="foodClose" aria-label="Cerrar">${ic('x')}</button></div>
    ${fld('name', 'Nombre', '', 'text', 'Ej: pechuga de pollo 1 kg')}
    <div id="fd-sug">${sugHTML()}</div>
    <div style="margin-top:12px">${fld('stock', 'Cantidad que tenés (opcional)', '', 'text', 'Ej: 1 kg, 500 g, 1 l')}</div>
    <p class="hint" id="fd-total">${totalHTML()}</p>
    <p class="sub-lbl">Tipo</p>
    <div class="chips" id="fd-cat">${catChips()}</div>
    <p class="sub-lbl">Tabla nutricional, cada 100</p>
    <div class="chips">${['g', 'ml'].map(u => `<button class="chip ${d.unit === u ? 'on' : ''}" data-a="fdUnit" data-u="${u}">${u === 'g' ? 'gramos' : 'mililitros'}</button>`).join('')}</div>
    <div class="grid4" style="margin-top:10px">
      ${fld('p', 'Proteínas', 'g')}${fld('c', 'Carbos', 'g')}${fld('f', 'Grasas', 'g')}${fld('kcal', 'Calorías', '', 'numeric', 'auto')}
    </div>
    <p class="hint" id="fd-auto">${draftAutoText()}</p>
    <p class="sub-lbl">Porción habitual (opcional)</p>
    <div class="grid2" style="margin-top:6px">${fld('pn', 'Nombre', '', 'text', 'Ej: 1 huevo')}${fld('pg', 'Equivale a', d.unit)}</div>
    <p class="sub-lbl">¿En qué comidas lo usás?</p>
    <div class="chips">${MEALS.map(m => `<button class="chip ${d.meals.includes(m.id) ? 'on' : ''}" data-a="fdMeal" data-m="${m.id}">${m.n}</button>`).join('')}</div>
    <p class="hint">Si no marcás ninguna, se puede usar en cualquier comida.</p>
    <button class="btn primary" style="margin-top:18px" data-a="foodSave">${ic('check', 22, 3)} Guardar</button>
    ${d.id ? `<button class="btn sm danger" style="margin-top:8px" data-a="foodDel">Borrar producto</button>` : ''}
  </div>`;
}

const draftFood = () => ({ p:num(foodDraft.p), c:num(foodDraft.c), f:num(foodDraft.f), kcal:Math.round(num(foodDraft.kcal)) });
const draftCat = () => { const f = draftFood(); return foodDraft.cat || (f.p + f.c + f.f + f.kcal ? guessCat(f) : ''); };
const catChips = () => CAT_ORDER.map(c => `<button class="chip ${draftCat() === c ? 'on' : ''}" data-a="fdCat" data-c="${c}">${CATS[c].n}</button>`).join('');

function draftAutoText() {
  const f = draftFood(), a = autoKcal(f);
  if (!f.kcal) return `Si dejás las calorías vacías se calculan solas: 4 × proteínas + 4 × carbos + 9 × grasas = <b>${a} kcal</b>.`;
  return Math.abs(f.kcal - a) > Math.max(25, a * .15)
    ? `<span class="bad">Ojo: por los macros darían unas ${a} kcal. Revisá los números del envase.</span>`
    : `Coincide con los macros (unas ${a} kcal).`;
}

function totalHTML() {
  const d = foodDraft, q = parseQty(d.stock ?? '') ?? parseQty(splitNameQty(d.name).qty || '');
  if (q === null) return 'Con la cantidad, la app calcula cuánta proteína y calorías tiene todo lo que compraste, y el armador no te propone más de lo que hay.';
  if (Number.isNaN(q)) return '<span class="bad">No entiendo la cantidad. Probá con 1 kg, 500 g o 1,5 l.</span>';
  if (q === 0) return 'Queda marcado como terminado.';
  return `Todo lo que tenés (${fmtQty(q, d.unit)}):<br>${macHTML(macrosFor(draftFood(), q))}`;
}

// Sugerencias de la base de referencia mientras se escribe el nombre.
function sugHTML() {
  const d = foodDraft;
  if (!d.sug) return '';
  const words = nrm(splitNameQty(d.name).name).split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return '';
  const q = words.join(' ');
  const hits = FOOD_DB.map((x, i) => ({ x, i, n:nrm(x.name) }))
    .filter(h => words.every(w => h.n.includes(w)))
    .sort((a, b) => (b.n.startsWith(q) - a.n.startsWith(q)) || a.n.length - b.n.length)
    .slice(0, 6);
  if (!hits.length) return `<p class="hint">No está en la base de referencia: cargá los valores del envase.</p>`;
  return `<p class="hint">Tocá una sugerencia para completar los valores de referencia:</p>
    <div class="sug">${hits.map(h => `<button data-a="fdPick" data-i="${h.i}"><b>${esc(h.x.name)}</b>
      <small>${h.x.kcal} kcal · P ${n1(h.x.p)} · C ${n1(h.x.c)} · G ${n1(h.x.f)} c/100 ${h.x.u || 'g'}</small></button>`).join('')}</div>`;
}

function draftFrom(f) {
  const s = v => v ? String(v).replace('.', ',') : '';
  return f ? { id:f.id, name:f.name, unit:f.unit, p:s(f.p), c:s(f.c), f:s(f.f), kcal:s(f.kcal), pn:f.portion ? f.portion.n : '', pg:f.portion ? s(f.portion.g) : '',
      meals:[...f.meals], avail:f.avail, cat:f.cat, stock:f.stock != null ? fmtQty(f.stock, f.unit) : '', sug:false }
    : { id:null, name:'', unit:'g', p:'', c:'', f:'', kcal:'', pn:'', pg:'', meals:[], avail:true, cat:'', stock:'', sug:true };
}
// Producto de la base de referencia → producto de la despensa.
const fromRef = x => ({ name:x.name, unit:x.u || 'g', p:x.p, c:x.c, f:x.f, kcal:x.kcal, cat:x.cat,
  portion:x.pt ? { n:x.pt[0], g:x.pt[1] } : null, meals:[...(x.m || CATS[x.cat].meals)] });

/* ---------- Acciones ---------- */
Object.assign(actions, {
  foodNew() { foodDraft = draftFrom(null); render(); setTimeout(() => { const i = document.querySelector('[data-fd="name"]'); if (i) i.focus(); }, 300); },
  foodEdit(d) { const f = findFood(d.id); if (f) { foodDraft = draftFrom(f); render(); } },
  foodClose() { foodDraft = null; render(); },
  fdUnit(d) { foodDraft.unit = d.u; render(); },
  fdCat(d) { foodDraft.cat = d.c; render(); },
  fdMeal(d) {
    const m = foodDraft.meals;
    foodDraft.meals = MEALS.map(x => x.id).filter(x => x === d.m ? !m.includes(x) : m.includes(x));
    render();
  },
  fdPick(d) {
    const x = fromRef(FOOD_DB[+d.i]), dr = foodDraft, sq = splitNameQty(dr.name);
    const s = v => v ? String(v).replace('.', ',') : '';
    Object.assign(dr, { name:x.name, unit:x.unit, p:s(x.p), c:s(x.c), f:s(x.f), kcal:s(x.kcal), cat:x.cat,
      pn:x.portion ? x.portion.n : '', pg:x.portion ? s(x.portion.g) : '', meals:x.meals, sug:false });
    if (sq.qty && !dr.stock.trim()) dr.stock = sq.qty;
    render();
  },
  foodSave() {
    const d = foodDraft, m = draftFood(), sq = splitNameQty(d.name);
    let name = d.name.trim(), stockTxt = d.stock;
    if (sq.qty && !String(stockTxt).trim()) { name = sq.name; stockTxt = sq.qty; }
    const stock = parseQty(stockTxt);
    if (!name) { toast('Poné un nombre al producto'); return; }
    if (Number.isNaN(stock)) { toast('No entiendo la cantidad: probá con 1 kg o 500 g'); return; }
    if (m.p + m.c + m.f > 101) { toast('Proteínas + carbos + grasas no pueden superar 100 g'); return; }
    const f = { id:d.id || uid(), name, unit:d.unit, ...m, cat:draftCat() || 'otro', stock,
      portion: d.pn.trim() && num(d.pg) ? { n:d.pn.trim(), g:num(d.pg) } : null,
      meals:d.meals, avail:stock === 0 ? false : d.avail };
    const i = db.foods.findIndex(x => x.id === f.id);
    if (i >= 0) db.foods[i] = f; else db.foods.push(f);
    foodDraft = null; save(); render();
    toast(i >= 0 ? 'Producto actualizado ✓' : 'Producto agregado ✓');
  },
  foodDel() {
    const f = findFood(foodDraft.id);
    if (!f || !confirm(`¿Borrar "${f.name}" de la despensa? También se saca de los menús.`)) return;
    db.foods = db.foods.filter(x => x !== f);
    Object.values(db.menus).forEach(mn => MEALS.forEach(m => { if (mn[m.id]) mn[m.id] = mn[m.id].filter(it => it.id !== f.id); }));
    foodDraft = null; save(); render(); toast('Producto borrado');
  },
  foodAvail(d) { const f = findFood(d.id); if (f) { f.avail = !f.avail; save(); render(); } },
  foodExamples() {
    const have = new Set(db.foods.map(f => nrm(f.name)));
    db.foods.push(...FOOD_DB.filter(x => x.ex && !have.has(nrm(x.name))).map(x => ({ ...fromRef(x), id:uid(), avail:true, stock:null })));
    save(); render(); toast('Ejemplos cargados: revisalos con tus envases');
  }
});

/* ---------- Entradas de texto (sin re-renderizar, para no perder el foco) ---------- */
document.addEventListener('input', e => {
  const t = e.target;
  if (!t.dataset.fd || !foodDraft) return;
  foodDraft[t.dataset.fd] = t.value;
  if (t.dataset.fd === 'name') { foodDraft.sug = true; document.getElementById('fd-sug').innerHTML = sugHTML(); }
  document.getElementById('fd-auto').innerHTML = draftAutoText();
  document.getElementById('fd-total').innerHTML = totalHTML();
  document.getElementById('fd-cat').innerHTML = catChips();
});
