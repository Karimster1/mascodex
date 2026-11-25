'use strict';
const APP_NAME = 'MascoDex';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), dlg = $('#dlg');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const go = h => { location.hash = h; };
let tt;
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); };

/* ---------- Datos: todo queda en el teléfono (IndexedDB) ---------- */
const dbP = new Promise((ok, no) => {
  const r = indexedDB.open('mascotario', 1) /* nombre interno: no cambiar o se pierde el álbum */;
  r.onupgradeneeded = () => r.result.createObjectStore('pets', { keyPath: 'id' });
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const tx = async (mode, fn) => {
  const db = await dbP;
  return new Promise((ok, no) => {
    const t = db.transaction('pets', mode), q = fn(t.objectStore('pets'));
    t.oncomplete = () => ok(q && q.result); t.onerror = t.onabort = () => no(t.error);
  });
};
const lvl = n => Math.min(5, Math.max(1, Math.round(+n) || 3));
// Lleva las fichas antiguas (photo + gallery) al formato con photos + cover
const norm = p => {
  if (!p) return p;
  const { photo, gallery, ...r } = p;
  r.photos = p.photos || [photo, ...(gallery || [])].filter(Boolean);
  r.cover = Math.min(Math.max(0, p.cover | 0), Math.max(0, r.photos.length - 1));
  r.mega = p.mega === true; r.friend = lvl(p.friend); r.fight = lvl(p.fight);
  return r;
};
const DB = {
  all: async () => (await tx('readonly', s => s.getAll())).map(norm).sort((a, b) => a.num - b.num),
  get: async id => norm(await tx('readonly', s => s.get(id))),
  put: p => tx('readwrite', s => s.put(p)),
  putMany: ps => tx('readwrite', s => { ps.forEach(p => s.put(p)); }),
  del: id => tx('readwrite', s => s.delete(id)),
};

/* ---------- Fotos ---------- */
let urls = [];
const url = b => { const u = URL.createObjectURL(b); urls.push(u); return u; };
async function shrink(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('foto')), 'image/jpeg', .85));
}
function pickPhotos({ camera = false, multiple = false } = {}) {
  return new Promise(ok => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*'; i.multiple = multiple; i.hidden = true;
    if (camera) i.capture = 'environment';
    document.body.append(i);
    i.addEventListener('cancel', () => { i.remove(); ok([]); });
    i.onchange = async () => {
      const out = [];
      for (const f of i.files) { try { out.push(await shrink(f)); } catch { toast('No pude abrir una de las fotos'); } }
      i.remove(); ok(out);
    };
    i.click();
  });
}
const picture = p => p.photos.length ? `<img src="${url(p.photos[p.cover])}" alt="">` : glyph(p.species);
const num = n => 'N.º ' + String(n).padStart(3, '0');
const skin = s => `--c:${s.color};--pat:${FAMILY[s.fam][2].replace(/"/g, '&quot;')}`;
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7 7.500.600-5.700 5 1.700 7.400L12 18l-6.500 4 1.700-7.400-5.700-5L9 9z"/></svg>';
const STATS = [['friend', 'Amistoso'], ['fight', 'Peleador']];
const stats = p => STATS.map(([k, l]) => `<div class="stat"><span>${l}</span><div class="stars" data-k="${k}">${[1, 2, 3, 4, 5].map(n =>
  `<button type="button" data-n="${n}" class="${n <= p[k] ? 'on' : ''}" aria-label="${l}: ${n} de 5" aria-pressed="${n === p[k]}">${STAR}</button>`).join('')}</div></div>`).join('');
function bindStars(p, saved) {
  $$('.stars button').forEach(b => b.onclick = () => {
    const box = b.parentNode; p[box.dataset.k] = +b.dataset.n;
    $$('button', box).forEach(x => { x.classList.toggle('on', +x.dataset.n <= +b.dataset.n); x.setAttribute('aria-pressed', x === b); });
    saved?.();
  });
}

// destellos en posiciones fijas, repartidos por el marco y la foto
const SPARKS = [[2, 68, 21, 1.5], [93, 2, 20, 1.0], [55, 2, 22, 2.4], [78, 98, 17, 0.4], [97, 52, 15, 2.3], [2, 79, 14, 1.9], [26, 32, 36, 0.9], [40, 98, 21, 0.0], [15, 15, 22, 1.1], [97, 28, 22, 0.6], [97, 62, 21, 1.2], [90, 98, 14, 0.5], [11, 32, 40, 2.2], [27, 21, 38, 0.2], [7, 98, 17, 2.1], [97, 13, 25, 0.6], [85, 25, 16, 0.5], [91, 98, 24, 0.1], [2, 11, 23, 1.8], [2, 53, 21, 1.6], [97, 4, 22, 0.2], [97, 75, 24, 0.5], [54, 2, 15, 2.0], [97, 21, 15, 1.3], [44, 2, 21, 1.4], [26, 2, 15, 1.1], [60, 32, 22, 0.0], [44, 27, 18, 0.7], [11, 45, 26, 2.0], [32, 98, 22, 0.7], [81, 18, 30, 1.2], [81, 2, 24, 0.4], [17, 35, 31, 0.4], [60, 44, 36, 1.4], [2, 9, 21, 0.9], [60, 2, 22, 2.1], [2, 13, 21, 1.6], [59, 10, 18, 0.2]];
const sparks = n => `<div class="sparks" aria-hidden="true">${SPARKS.slice(0, n).map(([x, y, z, d]) => `<i style="left:${x}%;top:${y}%;width:${z}px;height:${z}px;animation-delay:${d}s"></i>`).join('')}</div>`;
const mini = p => {
  const s = spOf(p.species);
  return `<button class="pet tex ${p.mega ? 'mega' : ''}" data-go="#/mascota/${esc(p.id)}" style="${skin(s)}">${p.mega ? sparks(9) : ''}<div class="ph w-${s.fam}">${picture(p)}</div><div class="pl"><span><b>${esc(p.name)}</b><small>${num(p.num)}</small></span>${glyph(s.id)}</div></button>`;
};
let listHash = '#/'; // última lista visitada: ahí vuelve la carta

/* ---------- Pantallas ---------- */
async function typeList(sp) {
  const s = SPECIES.find(x => x.id === sp);
  if (!s) return go('#/tipos');
  const pets = (await DB.all()).filter(p => p.species === sp);
  app.innerHTML = `<div class="bar2"><button class="round" data-go="#/tipos" aria-label="Volver a Tipos">${ui('back')}</button><h1>${s.name}</h1><span class="cnt">${pets.length} ${pets.length === 1 ? 'carta' : 'cartas'}</span></div>
    ${pets.length ? `<div class="grid">${pets.map(mini).join('')}</div>` : `<div class="empty">${glyph(sp)}<h2>Aún no tienes ninguna</h2><p>Captura la primera y aparecerá aquí.</p></div>`}
    <button class="fab" data-go="#/nueva/${sp}">${ui('cam')}Capturar</button>`;
}

async function home(tab) {
  const pets = await DB.all(), got = new Set(pets.map(p => p.species));
  let body;
  if (tab === 'tipos') {
    body = Object.entries(FAMILY).map(([f, [label]]) => `<section class="fam"><h3>${label}</h3><div class="sp">${SPECIES.filter(s => s.fam === f).map(s => {
      const n = pets.filter(p => p.species === s.id).length;
      return `<button class="it ${n ? 'got' : 'lock'}" data-go="#/tipo/${s.id}" style="${skin(s)}">${glyph(s.id)}${s.name}${n ? ` × ${n}` : ''}</button>`;
    }).join('')}</div></section>`).join('');
  } else if (!pets.length) {
    body = `<div class="empty">${glyph('gato')}<h2>Tu álbum está vacío</h2><p>Captura tu primera mascota para crear su carta.</p></div>`;
  } else {
    body = `<div class="grid">${pets.map(mini).join('')}</div>`;
  }
  app.innerHTML = `<header class="top"><div class="row"><h1>${APP_NAME}</h1><button class="round ${needCopy(pets) ? 'dot' : ''}" id="cfg" aria-label="Respaldo${needCopy(pets) ? ': conviene hacer una copia' : ''}">${ui('menu')}</button></div>
    <div class="count"><span><b>${pets.length}</b> ${pets.length === 1 ? 'mascota' : 'mascotas'}</span><span><b>${got.size}</b> de ${SPECIES.length} tipos</span></div>
    <div class="bar">${SPECIES.map(s => `<i${got.has(s.id) ? ` style="background:${s.color}"` : ''}></i>`).join('')}</div></header>
    <nav class="tabs"><button data-go="#/" class="${tab ? '' : 'on'}">Mi álbum</button><button data-go="#/tipos" class="${tab ? 'on' : ''}">Tipos</button></nav>
    ${body}<button class="fab" data-go="#/nueva">${ui('cam')}Capturar</button>`;
  $('#cfg').onclick = settings;
}

async function detail(id) {
  const p = await DB.get(id);
  if (!p) return go('#/');
  const s = spOf(p.species);
  const fecha = new Date(p.created).toLocaleDateString('es-CL');
  app.innerHTML = `<div class="bar2"><button class="round" data-go="${listHash}" aria-label="Volver">${ui('back')}</button><h1></h1><button class="round" data-go="#/editar/${esc(p.id)}" aria-label="Editar">${ui('edit')}</button></div>
    <div class="stage" style="${skin(s)}"><article class="card tex ${p.mega ? 'mega' : ''}">${sparks(38)}<div class="tag">${glyph(s.id)}</div><div class="ph w-${s.fam}" id="win"></div>
    <div class="plate"><span class="mx">Mega Shiny EX</span><h2>${esc(p.name)}</h2>${p.desc ? `<p class="line">${esc(p.desc)}</p>` : ''}<p class="sub">${[s.name, FAMILY[s.fam][1]].filter(Boolean).join(' · ')}</p>${stats(p)}<div class="foot"><span>${num(p.num)}</span><span>${fecha}</span></div></div></article></div>
    <div class="sec"><button class="btn megab" id="mg" aria-pressed="${p.mega}">${ui('spark')}<span></span></button></div>
    <section class="sec"><h3>Fotos</h3><p class="hint" id="hint"></p><div class="photos" id="th"></div><div class="two"><button class="btn" id="c1">${ui('cam')}Tomar foto</button><button class="btn" id="c2">${ui('img')}Galería</button></div></section>`;
  const save = async () => { try { await DB.put(p); return true; } catch { toast('No pude guardar: falta espacio'); return false; } };
  const paint = () => {
    $('#win').innerHTML = picture(p);
    $('#th').innerHTML = p.photos.length ? p.photos.map((b, i) => `<button data-ph="${i}" class="${i === p.cover ? 'on' : ''}" aria-label="Foto ${i + 1}${i === p.cover ? ', en la carta' : ''}"><img src="${url(b)}" alt=""></button>`).join('') : '<p>Aún no tiene fotos.</p>';
    $('#hint').textContent = p.photos.length > 1 ? 'Toca una foto para ponerla en la carta.' : '';
    $$('[data-ph]').forEach(b => b.onclick = () => choose(+b.dataset.ph));
  };
  // Cambiar la imagen de la carta siempre pide confirmación
  const choose = i => {
    const on = i === p.cover;
    dlg.className = 'pick-ph';
    dlg.innerHTML = `<h2>${on ? 'Esta foto está en la carta' : '¿Cambiar la imagen de la carta?'}</h2><img src="${url(p.photos[i])}" alt="Foto elegida">
      ${on ? '' : '<button class="btn main" id="yes">Cambiar imagen</button>'}<button class="btn" id="no">${on ? 'Cerrar' : 'Cancelar'}</button><button class="btn bad" id="rm">${ui('trash')}Borrar foto</button>`;
    dlg.showModal();
    $('#no').onclick = () => dlg.close();
    const apply = async (photos, cover) => {
      const old = [p.photos, p.cover];
      p.photos = photos; p.cover = cover;
      const ok = await save();
      if (!ok) [p.photos, p.cover] = old;
      dlg.close(); paint();
      return ok;
    };
    if (!on) $('#yes').onclick = async () => { if (await apply(p.photos, i)) toast('Imagen de la carta cambiada'); };
    $('#rm').onclick = () => {
      if (!confirm('¿Borrar esta foto? No se puede deshacer.')) return;
      apply(p.photos.filter((_, k) => k !== i), on ? 0 : p.cover - (i < p.cover ? 1 : 0));
    };
  };
  paint();
  bindStars(p, save);
  const mg = $('#mg'), label = () => { $('span', mg).textContent = p.mega ? 'Quitar Mega Shiny EX' : 'Activar Mega Shiny EX'; mg.setAttribute('aria-pressed', p.mega); };
  label();
  mg.onclick = async () => {
    p.mega = !p.mega;
    if (!await save()) { p.mega = !p.mega; return; }
    $('.card').classList.toggle('mega', p.mega); $('.card').classList.toggle('boom', p.mega); label();
    if (p.mega) { navigator.vibrate?.([40, 30, 40, 30, 160]); scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const add = async camera => {
    const bs = await pickPhotos({ camera, multiple: !camera });
    if (!bs.length) return;
    const before = p.photos, cover = p.cover;
    p.photos = [...before, ...bs]; // la imagen de la carta no cambia sola
    if (!await save()) { p.photos = before; p.cover = cover; }
    if (location.hash === '#/mascota/' + id) paint();
  };
  $('#c1').onclick = () => add(true);
  $('#c2').onclick = () => add(false);
  // mover el dedo solo inclina la carta y desplaza el brillo
  const st = $('.stage'), card = $('.card');
  st.onpointermove = e => {
    const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--ry', (x - .5) * 14 + 'deg'); card.style.setProperty('--rx', (.5 - y) * 10 + 'deg'); card.style.setProperty('--gx', x * 100 + '%');
  };
  st.onpointerup = st.onpointercancel = st.onpointerleave = () => ['--rx', '--ry', '--gx'].forEach(k => card.style.removeProperty(k));
}

async function editor(id, sp) {
  const old = id && await DB.get(id);
  if (id && !old) return go('#/');
  const d = old ? { ...old, photos: [...old.photos] } : norm({ id: crypto.randomUUID(), species: spOf(sp || 'perro').id, name: '', desc: '', photos: [], created: Date.now() });
  app.innerHTML = `<div class="bar2"><button class="round" data-go="${old ? '#/mascota/' + esc(id) : listHash}" aria-label="Volver">${ui('back')}</button><h1>${old ? 'Editar mascota' : 'Nueva mascota'}</h1></div>
  <form autocomplete="off"><button type="button" class="cam tex" id="cam" aria-label="Tomar foto"></button>
    <div class="two"><button type="button" class="btn" id="b1">${ui('cam')}Tomar foto</button><button type="button" class="btn" id="b2">${ui('img')}Galería</button></div>
    <label class="f" for="nm">Nombre</label><input id="nm" type="text" maxlength="24" value="${esc(d.name)}">
    <label class="f" for="ds">Descripción breve</label><input id="ds" type="text" maxlength="36" value="${esc(d.desc)}">
    <p class="lbl">Tipo</p><div class="sp pick">${SPECIES.map(s => `<button type="button" class="it" data-s="${s.id}" style="${skin(s)}">${glyph(s.id)}${s.name}</button>`).join('')}</div>
    <p class="lbl">Carácter</p>${stats(d)}
    <button class="btn main">${old ? 'Guardar cambios' : 'Capturar'}</button>
    ${old ? `<button type="button" class="btn bad" id="del" style="width:100%;margin-top:12px">${ui('trash')}Eliminar mascota</button>` : ''}</form>`;
  const paint = () => {
    const s = spOf(d.species), c = $('#cam');
    c.style.cssText = `--c:${s.color};--pat:${FAMILY[s.fam][2]}`;
    $('form').style.setProperty('--c', s.color);
    c.innerHTML = `<div class="ph">${picture(d)}</div>`;
    $$('[data-s]').forEach(b => { b.classList.toggle('on', b.dataset.s === d.species); b.setAttribute('aria-pressed', b.dataset.s === d.species); });
  };
  paint(); bindStars(d);
  const photo = async camera => { const [b] = await pickPhotos({ camera }); if (b) { d.photos.push(b); d.cover = d.photos.length - 1; paint(); } };
  $('#cam').onclick = $('#b1').onclick = () => photo(true);
  $('#b2').onclick = () => photo(false);
  $$('[data-s]').forEach(b => b.onclick = () => { d.species = b.dataset.s; paint(); });
  $('form').onsubmit = async e => {
    e.preventDefault();
    d.name = $('#nm').value.trim(); d.desc = $('#ds').value.trim();
    if (!d.name) { toast('Falta ponerle nombre'); $('#nm').focus(); return; }
    const btn = $('.btn.main'); btn.disabled = true;
    try {
      if (!old) d.num = (await DB.all()).reduce((m, p) => Math.max(m, p.num), 0) + 1;
      await DB.put(d);
    } catch { btn.disabled = false; return toast('No pude guardar: falta espacio'); }
    navigator.storage?.persist?.();
    location.replace('#/mascota/' + d.id);
    if (!old) party(d);
  };
  if (old) $('#del').onclick = async () => {
    if (confirm(`¿Eliminar a ${old.name} y todas sus fotos? No se puede deshacer.`)) { await DB.del(id); location.replace('#/'); }
  };
}

function party(p) {
  const s = spOf(p.species), el = document.createElement('div');
  el.className = 'party'; el.style.cssText = `--c:${s.color};--pat:${FAMILY[s.fam][2]}`;
  const src = p.photos[p.cover] && URL.createObjectURL(p.photos[p.cover]);
  el.innerHTML = `<div class="tex"><div class="ph w-${s.fam}">${src ? `<img src="${src}" alt="">` : glyph(s.id)}</div></div><h2>${esc(p.name)}</h2><p>Nueva carta en tu álbum, ${num(p.num)}</p><button class="btn">Ver carta</button>`;
  document.body.append(el);
  navigator.vibrate?.([60, 40, 120]);
  const close = () => { removeEventListener('popstate', close); el.remove(); if (src) URL.revokeObjectURL(src); };
  const b = $('.btn', el); b.onclick = close; b.focus();
  // location.replace también dispara popstate; se escucha después para reaccionar solo al botón atrás
  setTimeout(() => { if (el.isConnected) addEventListener('popstate', close); }, 300);
}

/* ---------- Respaldo ---------- */
const to64 = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(b); });
const from64 = s => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(s || '');
  return m ? new Blob([Uint8Array.from(atob(m[2]), c => c.charCodeAt(0))], { type: m[1] }) : null;
};
const fechaCL = t => new Date(+t).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
const lastCopy = () => +localStorage.getItem('copia') || 0;
const needCopy = pets => pets.length > 0 && Date.now() - lastCopy() > 14 * 864e5;
const copied = () => { localStorage.setItem('copia', Date.now()); $('#cfg')?.classList.remove('dot'); };

// Se arma por partes para no juntar todas las fotos en un solo texto gigante
async function makeBackup() {
  const pets = await DB.all(), parts = ['{"app":"mascodex","v":2,"pets":['];
  for (const [k, p] of pets.entries()) parts.push((k ? ',' : '') + JSON.stringify({ ...p, photos: await Promise.all(p.photos.map(to64)) }));
  parts.push(']}');
  // .txt porque Android no permite compartir archivos .json desde el navegador
  return { n: pets.length, file: new File(parts, `MascoDex-copia-${new Date().toLocaleDateString('sv')}.txt`, { type: 'text/plain' }) };
}
async function restore(file) {
  const { pets } = JSON.parse(await file.text());
  const list = pets.map((p, k) => norm({
    id: String(p.id).replace(/[^\w-]/g, ''), num: +p.num || k + 1, species: spOf(p.species).id,
    name: String(p.name).slice(0, 24), desc: String(p.desc || '').slice(0, 300), created: +p.created || Date.now(),
    cover: p.cover, mega: p.mega, friend: p.friend, fight: p.fight,
    photos: (p.photos || [p.photo, ...(p.gallery || [])]).map(from64).filter(Boolean)
  }));
  if (!list.length || list.some(p => !p.id)) throw new Error('copia');
  const here = await DB.all(), same = list.filter(p => here.some(h => h.id === p.id)).length;
  if (!confirm(`Esta copia trae ${list.length} ${list.length === 1 ? 'mascota' : 'mascotas'}.` + (same ? ` ${same} ya ${same === 1 ? 'está' : 'están'} en este teléfono y se ${same === 1 ? 'reemplazará' : 'reemplazarán'} por la versión de la copia.` : '') + ' ¿Recuperar?')) return;
  // las que no vienen en la copia se conservan; si un número choca, la recuperada toma uno libre
  const ids = new Set(list.map(p => p.id)), used = new Set(here.filter(h => !ids.has(h.id)).map(h => h.num));
  let next = Math.max(0, ...used, ...list.map(p => p.num));
  for (const p of list) { if (used.has(p.num)) p.num = ++next; used.add(p.num); }
  await DB.putMany(list);
  navigator.storage?.persist?.();
  render(); toast(`${list.length === 1 ? '1 mascota recuperada' : list.length + ' mascotas recuperadas'}`);
}
async function settings() {
  const pets = await DB.all();
  dlg.className = '';
  dlg.innerHTML = `<h2>Respaldo</h2><p>Tus cartas y fotos viven solo en este teléfono. Para cambiar de celular, crea una copia aquí y recupérala en el nuevo.</p>
    <p class="cnt">${lastCopy() ? `Última copia: ${fechaCL(lastCopy())}` : 'Todavía no has hecho una copia.'}</p>
    <button class="btn main" id="ex" ${pets.length ? '' : 'disabled'}>Crear copia</button><button class="btn" id="im">Recuperar copia</button><button class="btn" id="ok">Cerrar</button>`;
  dlg.showModal();
  $('#ok').onclick = () => dlg.close();
  $('#ex').onclick = async () => {
    const b = $('#ex'); b.disabled = true; b.textContent = 'Preparando…';
    let c;
    try { c = await makeBackup(); } catch (e) { console.error(e); toast('No pude crear la copia'); dlg.close(); return; }
    if (!dlg.open) return;
    const mb = (c.file.size / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 });
    const canShare = navigator.canShare?.({ files: [c.file] });
    dlg.innerHTML = `<h2>Copia lista</h2><p>${c.n} ${c.n === 1 ? 'mascota' : 'mascotas'} con sus fotos, ${mb} MB. Guárdala fuera del teléfono, por ejemplo en Drive.</p>
      ${canShare ? '<button class="btn main" id="sh">Enviar a Drive, correo…</button>' : ''}<button class="btn ${canShare ? '' : 'main'}" id="dl">Guardar en Descargas</button><button class="btn" id="ok">Cerrar</button>`;
    $('#ok').onclick = () => dlg.close();
    if (canShare) $('#sh').onclick = async () => {
      try { await navigator.share({ files: [c.file], title: 'Copia de MascoDex' }); copied(); dlg.close(); }
      catch (e) { if (e.name !== 'AbortError') toast('No se pudo enviar. Usa Guardar en Descargas.'); }
    };
    $('#dl').onclick = () => {
      const a = document.createElement('a'), u = URL.createObjectURL(c.file);
      a.href = u; a.download = c.file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 6e4); copied(); dlg.close(); toast('Copia guardada en Descargas');
    };
  };
  $('#im').onclick = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.txt,.json,text/plain,application/json';
    i.onchange = () => restore(i.files[0]).catch(e => { console.error(e); toast('Ese archivo no es una copia de MascoDex'); });
    i.click();
  };
}

/* ---------- Navegación ---------- */
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
async function render() {
  const [, a = '', id] = location.hash.split('/');
  if (dlg.open) dlg.close();
  const prev = urls; urls = [];
  try {
    if (a === 'mascota') await detail(id);
    else if (a === 'nueva') await editor(null, id);
    else if (a === 'tipo') { listHash = '#/tipo/' + spOf(id).id; await typeList(id); }
    else if (a === 'editar') await editor(id);
    else { listHash = a === 'tipos' ? '#/tipos' : '#/'; await home(a === 'tipos' ? 'tipos' : ''); }
  } catch (e) { console.error(e); toast('Algo falló al abrir el álbum'); }
  prev.forEach(u => URL.revokeObjectURL(u));
}
addEventListener('hashchange', () => { $('#toast').classList.remove('on'); scrollTo(0, 0); render(); });
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
