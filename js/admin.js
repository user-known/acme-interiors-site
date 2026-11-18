/* Acme Interiors — admin panel.
   Content (projects, roles, images) is committed to the GitHub repo through the GitHub API.
   Form submissions are read from the Google Apps Script endpoint (see apps-script/Code.gs). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const CONF = window.ACME_CONFIG || {};
  const PROJECTS_FILE = 'data/projects.json', CAREERS_FILE = 'data/careers.json';
  const LAYOUT_NAMES = ['Full width', 'Large half', 'Small half'];
  const ROLE_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

  /* ---------------- settings (kept only in this browser) ---------------- */
  const STORE = 'acme-admin';
  function detectRepo() {
    const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
    if (!m) return {};
    const seg = location.pathname.split('/').filter(Boolean)[0];
    return { owner: m[1], repo: seg && !seg.includes('.') ? seg : `${m[1]}.github.io` };
  }
  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(STORE) || sessionStorage.getItem(STORE) || '{}'); } catch {}
    const auto = detectRepo(), g = CONF.github || {};
    return {
      owner: s.owner || g.owner || auto.owner || '', repo: s.repo || g.repo || auto.repo || '',
      branch: s.branch || g.branch || 'main', token: s.token || '',
      endpoint: s.endpoint || CONF.formsEndpoint || '', key: s.key || '', remember: s.remember !== false,
    };
  }
  function saveSettings() {
    try {
      localStorage.removeItem(STORE); sessionStorage.removeItem(STORE);
      (S.cfg.remember ? localStorage : sessionStorage).setItem(STORE, JSON.stringify(S.cfg));
    } catch {}
  }

  const S = {
    cfg: loadSettings(), projects: null, careers: null, writable: false, source: '',
    subs: { enquiries: null, applications: null }, previews: {}, dirty: false,
  };

  /* ---------------- UI helpers ---------------- */
  let toastT;
  function toast(msg, bad) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : '');
    clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', bad ? 7000 : 3800);
  }
  function busy(text) { $('#busy').classList.toggle('on', !!text); if (text) $('#busytext').textContent = text; }
  function modal(html) {
    $('#mbody').innerHTML = html; $('#modal').classList.add('on'); $('#modal').setAttribute('aria-hidden', 'false');
    return $('#mbody');
  }
  function closeModal() { $('#modal').classList.remove('on'); $('#modal').setAttribute('aria-hidden', 'true'); }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  function confirmBox(title, text, okLabel = 'Delete', danger = true) {
    return new Promise(res => {
      const m = modal(`<h2>${esc(title)}</h2><p>${text}</p><div class="mact"><button class="btn ghost" data-r="0">Cancel</button><button class="btn ${danger ? 'danger' : 'acc'}" data-r="1">${esc(okLabel)}</button></div>`);
      m.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { closeModal(); res(b.dataset.r === '1'); });
    });
  }
  function head(title, crumb, actions = '') {
    $('#vtitle').textContent = title; $('#crumb').innerHTML = crumb || '';
    $('#vactions').innerHTML = actions; document.title = `${title} — Admin — Acme Interiors`;
  }
  function banner(html, cls = '') { $('#banner').innerHTML = html ? `<div class="banner ${cls}">${html}</div>` : ''; }
  const imgSrc = p => S.previews[p] || p || '';
  function setConn() {
    const c = $('#conn');
    c.className = 'conn ' + (S.writable ? 'ok' : S.projects ? 'ro' : '');
    c.querySelector('span').textContent = S.writable ? `${S.cfg.owner}/${S.cfg.repo}` : S.projects ? 'Read-only' : 'Not connected';
  }
  function counts() {
    $('#cnt-projects').textContent = S.projects ? S.projects.projects.length : '';
    $('#cnt-careers').textContent = S.careers ? S.careers.roles.filter(r => r.open !== false).length : '';
    $('#cnt-enquiries').textContent = S.subs.enquiries ? S.subs.enquiries.length : '';
    $('#cnt-applications').textContent = S.subs.applications ? S.subs.applications.length : '';
  }
  const readonlyNote = () => S.writable ? '' :
    banner(`<span><b>Read-only.</b> ${S.cfg.token ? "The saved token can't write to this repository." : 'Connect your GitHub repository to add, edit or delete content.'}</span><a class="btn sm acc" href="#settings">Open settings</a>`);

  /* ---------------- images: resize in the browser before upload ---------------- */
  async function processImage(file, max) {
    if (!/^image\//.test(file.type)) throw new Error(`${file.name} isn't an image.`);
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.84));
    return { file: blob, preview: URL.createObjectURL(blob) };
  }
  const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
  const usedImages = d => new Set(d.projects.flatMap(p => [p.hero, ...(p.images || []).map(i => i.src)]).filter(Boolean));
  const removable = (paths, d) => { const used = usedImages(d); return [...new Set(paths)].filter(p => p && p.startsWith('img/') && !used.has(p)); };

  /* ---------------- data ---------------- */
  async function loadData() {
    GitHub.configure(S.cfg);
    S.writable = false;
    if (GitHub.ready) {
      try {
        const info = await GitHub.test();
        S.writable = info.canWrite;
        [S.projects, S.careers] = await Promise.all([GitHub.readJSON(PROJECTS_FILE), GitHub.readJSON(CAREERS_FILE)]);
        S.source = 'github';
        if (!info.canWrite) toast("Connected, but this token can't write to the repo.", true);
      } catch (e) { toast(e.message, true); }
    }
    if (!S.projects || !S.careers) {
      try {
        const get = f => fetch(f + '?t=' + Date.now(), { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
        [S.projects, S.careers] = await Promise.all([get(PROJECTS_FILE), get(CAREERS_FILE)]);
        S.source = 'site';
      } catch { S.projects = S.projects || { categories: [], projects: [] }; S.careers = S.careers || { departments: [], roles: [] }; }
    }
    setConn(); counts();
  }

  /** Re-reads the file from GitHub, applies the change, and commits it together with any extra files. */
  async function publish(message, file, mutate, extraFiles = []) {
    if (!S.writable) { toast('Connect GitHub with a write token in Settings first.', true); return null; }
    busy('Publishing to GitHub…');
    try {
      const fresh = await GitHub.readJSON(file);
      const out = mutate(fresh) || {};
      const files = [...extraFiles, { path: file, text: JSON.stringify(fresh, null, 2) + '\n' },
        ...(out.deletes || []).map(p => ({ path: p, delete: true }))];
      await GitHub.commit(message, files);
      if (file === PROJECTS_FILE) S.projects = fresh; else S.careers = fresh;
      counts();
      return fresh;
    } catch (e) { toast(e.message, true); return null; }
    finally { busy(false); }
  }

  /* ================= PROJECTS ================= */
  const catOf = id => (S.projects.categories.find(c => c.id === id) || { name: id || '—', color: '#bbb' });
  function viewProjects() {
    head('Projects', 'Content', `<a class="btn ghost sm" href="work.html" target="_blank" rel="noopener">View work page ↗</a>${S.writable ? '<a class="btn acc sm" href="#project/new">+ New project</a>' : ''}`);
    readonlyNote();
    const list = S.projects.projects;
    if (!list.length) { $('#view').innerHTML = `<div class="empty"><b>No projects yet</b>Add your first project to show it on the work page.</div>`; return; }
    $('#view').innerHTML = `<table class="tbl"><thead><tr><th></th><th>Project</th><th class="hide-sm">Sector</th><th class="hide-sm">Year</th><th class="hide-sm">Images</th><th class="hide-sm" title="Large tile on the work page">Featured</th><th></th></tr></thead><tbody>
      ${list.map((p, i) => `<tr class="click" data-id="${esc(p.id)}">
        <td>${p.hero ? `<img class="thumb" src="${esc(imgSrc(p.hero))}" alt="">` : '<div class="thumb"></div>'}</td>
        <td><div class="t">${esc(p.title)}</div><div class="sub">project.html#${esc(p.id)}</div></td>
        <td class="hide-sm"><span class="pill" style="--c:${esc(catOf(p.category).color)}"><i></i>${esc(catOf(p.category).name)}</span></td>
        <td class="hide-sm">${esc(p.year)}</td>
        <td class="hide-sm">${(p.images || []).length}</td>
        <td class="hide-sm">${p.featured ? '<span class="star">★</span>' : ''}</td>
        <td><div class="row-actions">
          ${S.writable ? `<button class="ib" data-act="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="ib" data-act="down" title="Move down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>` : ''}
          <a class="ib" href="project.html#${encodeURIComponent(p.id)}" target="_blank" rel="noopener" title="View on site" data-act="view">↗</a>
          ${S.writable ? '<button class="ib del" data-act="del" title="Delete">✕</button>' : ''}
        </div></td></tr>`).join('')}</tbody></table>`;
    $$('#view tr[data-id]').forEach(tr => tr.addEventListener('click', async e => {
      const id = tr.dataset.id, act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'view') return;
      if (act === 'up' || act === 'down') {
        e.stopPropagation();
        const ok = await publish('Reorder projects', PROJECTS_FILE, d => {
          const i = d.projects.findIndex(p => p.id === id), j = i + (act === 'up' ? -1 : 1);
          if (i < 0 || j < 0 || j >= d.projects.length) return;
          [d.projects[i], d.projects[j]] = [d.projects[j], d.projects[i]];
        });
        if (ok) { toast('Order updated.'); viewProjects(); }
        return;
      }
      if (act === 'del') {
        e.stopPropagation();
        const p = S.projects.projects.find(x => x.id === id);
        if (!await confirmBox('Delete this project?', `<b>${esc(p.title)}</b> and its images will be removed from the website. This can't be undone here, but the change stays in the repo's history.`)) return;
        const ok = await publish(`Delete project: ${p.title}`, PROJECTS_FILE, d => {
          const i = d.projects.findIndex(x => x.id === id); if (i < 0) return;
          const [gone] = d.projects.splice(i, 1);
          return { deletes: removable([gone.hero, ...(gone.images || []).map(x => x.src)], d) };
        });
        if (ok) { toast('Project deleted.'); viewProjects(); }
        return;
      }
      location.hash = '#project/' + encodeURIComponent(id);
    }));
  }

  let ED = null;
  function editProject(id) {
    const isNew = id === 'new';
    const p = isNew ? null : S.projects.projects.find(x => x.id === id);
    if (!isNew && !p) { toast('Project not found.', true); location.hash = '#projects'; return; }
    if (isNew && !S.writable) { location.hash = '#projects'; return; }
    ED = {
      isNew, origId: p?.id || '', idTouched: false,
      title: p?.title || '', id: p?.id || '', category: p?.category || S.projects.categories[0]?.id || '__new',
      featured: !!p?.featured, area: p?.area || '', duration: p?.duration || '', type: p?.type || '', year: p?.year || String(new Date().getFullYear()),
      lead: p?.lead || '', body: p?.body || '',
      hero: p?.hero ? { src: p.hero } : null,
      images: (p?.images || []).map(im => ({ src: im.src, caption: im.caption || '' })),
      newCatName: '', newCatColor: '#FE7F2D',
    };
    S.dirty = false;
    head(isNew ? 'New project' : p.title, `<a href="#projects">Projects</a> / ${isNew ? 'new' : 'edit'}`,
      isNew ? '' : `<a class="btn ghost sm" href="project.html#${encodeURIComponent(p.id)}" target="_blank" rel="noopener">View on site ↗</a>`);
    readonlyNote();
    const ro = S.writable ? '' : 'disabled';
    const types = [...new Set(['Design & build', 'Interior design', 'Turnkey fit-out', 'Furniture & FF&E', 'Space planning', ...S.projects.projects.map(x => x.type).filter(Boolean)])];
    $('#view').innerHTML = `
    <div class="editor">
      <div>
        <div class="panel">
          <h3>Project details</h3><p class="hint">Shown at the top of the project page and on its card on the work page.</p>
          <div class="fgrid">
            <label class="f full"><span>Project title <em>*</em></span><input data-k="title" value="${esc(ED.title)}" maxlength="90" ${ro} placeholder="e.g. Fintech headquarters"></label>
            <label class="f full"><span>Page address</span><div class="with"><input data-k="id" value="${esc(ED.id)}" ${isNew ? '' : 'readonly'} ${ro}></div><small>${isNew ? 'Filled in from the title. Lowercase letters, numbers and hyphens.' : 'Fixed after the project is created, so existing links keep working.'} Link: project.html#<b id="idprev">${esc(ED.id || '…')}</b></small></label>
            <label class="f"><span>Sector</span><select data-k="category" ${ro}>${S.projects.categories.map(c => `<option value="${esc(c.id)}" ${c.id === ED.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new" ${ED.category === '__new' ? 'selected' : ''}>+ New sector…</option></select>
              <div class="newcat ${ED.category === '__new' ? 'on' : ''}" id="newcat"><input data-k="newCatName" placeholder="Sector name" value=""><input type="color" data-k="newCatColor" value="${ED.newCatColor}" title="Colour"></div></label>
            <label class="f"><span>Type of work</span><input data-k="type" list="typelist" value="${esc(ED.type)}" ${ro}><datalist id="typelist">${types.map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>
            <label class="f"><span>Area (sq ft)</span><input data-k="area" value="${esc(ED.area)}" ${ro} placeholder="e.g. 12,500"></label>
            <label class="f"><span>Duration (weeks)</span><input data-k="duration" value="${esc(ED.duration)}" ${ro} placeholder="e.g. 10"></label>
            <label class="f"><span>Year completed</span><input data-k="year" value="${esc(ED.year)}" ${ro} maxlength="4"></label>
            <label class="f" style="justify-content:flex-end"><span class="check"><input type="checkbox" data-k="featured" ${ED.featured ? 'checked' : ''} ${ro}> Featured (large tile on the work page)</span></label>
          </div>
        </div>
        <div class="panel">
          <h3>Description</h3><p class="hint">The intro appears large; the description below it. Leave a blank line between paragraphs.</p>
          <div class="fgrid">
            <label class="f full"><span>Intro sentence</span><textarea data-k="lead" maxlength="300" ${ro}>${esc(ED.lead)}</textarea></label>
            <label class="f full"><span>Description</span><textarea class="tall" data-k="body" ${ro}>${esc(ED.body)}</textarea></label>
          </div>
        </div>
      </div>
      <div>
        <div class="panel">
          <h3>Hero image</h3><p class="hint">Cover photo for the gallery card and the top of the project page. Landscape works best. Images are resized to 2400 px before upload.</p>
          <label class="drop ${ED.hero ? 'has' : ''}" id="herodrop">${ED.hero ? `<img src="${esc(imgSrc(ED.hero.src) || ED.hero.preview)}" alt="">` : ''}<span class="dl"><b>Drop an image or click to upload</b>${ED.hero ? 'Replace image' : 'JPG, PNG or WebP'}</span><input type="file" accept="image/*" ${ro}></label>
        </div>
        <div class="panel">
          <h3>Project images</h3><p class="hint">Shown below the description, in a repeating full-width / large half / small half layout. Drag files onto the button, or click it.</p>
          <div class="imgs" id="imgs"></div>
          ${S.writable ? '<button class="addimg" id="addimg" type="button">+ Add images</button><input type="file" id="addinput" accept="image/*" multiple hidden>' : ''}
        </div>
      </div>
    </div>
    ${S.writable ? `<div class="savebar"><span class="mono" id="dirtynote">No changes yet</span><div class="actions">${isNew ? '' : '<button class="btn danger sm" id="delproj">Delete project</button>'}<a class="btn ghost sm" href="#projects">Cancel</a><button class="btn acc sm" id="saveproj">${isNew ? 'Publish project' : 'Save & publish'}</button></div></div>` : ''}`;

    const markDirty = () => { S.dirty = true; const n = $('#dirtynote'); if (n) n.textContent = 'Unsaved changes'; };
    $$('#view [data-k]').forEach(el => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = el.dataset.k; ED[k] = el.type === 'checkbox' ? el.checked : el.value; markDirty();
      if (k === 'title' && isNew && !ED.idTouched) { ED.id = slug(ED.title); $('[data-k=id]').value = ED.id; }
      if (k === 'id') { ED.idTouched = true; ED.id = slug(el.value); }
      if (k === 'title' || k === 'id') $('#idprev').textContent = ED.id || '…';
      if (k === 'category') $('#newcat').classList.toggle('on', ED.category === '__new');
    }));

    // hero upload
    const hd = $('#herodrop'), hin = hd.querySelector('input');
    const setHero = async f => {
      if (!f) return;
      try { busy('Preparing image…'); ED.hero = await processImage(f, 2400); markDirty(); }
      catch (e) { toast(e.message, true); } finally { busy(false); }
      hd.classList.add('has');
      hd.innerHTML = `<img src="${ED.hero.preview}" alt=""><span class="dl">Replace image <span class="new-badge">NEW</span></span><input type="file" accept="image/*">`;
      hd.querySelector('input').onchange = e => setHero(e.target.files[0]);
    };
    hin.onchange = e => setHero(e.target.files[0]);
    if (S.writable) dropTarget(hd, files => setHero(files[0]));

    // gallery images
    const renderImgs = () => {
      const box = $('#imgs');
      box.innerHTML = ED.images.length ? ED.images.map((im, i) => `
        <div class="imgrow" data-i="${i}">
          <img src="${esc(im.preview || imgSrc(im.src))}" alt="">
          <div><span class="lay">${String(i + 1).padStart(2, '0')} · ${LAYOUT_NAMES[i % 3]}${im.file ? '<span class="new-badge">NEW</span>' : ''}</span><input value="${esc(im.caption)}" placeholder="Caption (optional)" data-cap="${i}" ${ro}></div>
          ${S.writable ? `<div class="ctl"><button class="ib" data-m="-1" ${i === 0 ? 'disabled' : ''} title="Move up">↑</button><button class="ib" data-m="1" ${i === ED.images.length - 1 ? 'disabled' : ''} title="Move down">↓</button><button class="ib del" data-x title="Remove">✕</button></div>` : ''}
        </div>`).join('') : '<p class="hint" style="margin:0">No images yet.</p>';
      $$('[data-cap]', box).forEach(inp => inp.oninput = () => { ED.images[+inp.dataset.cap].caption = inp.value; markDirty(); });
      $$('.imgrow', box).forEach(row => {
        const i = +row.dataset.i;
        row.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const j = i + +b.dataset.m; [ED.images[i], ED.images[j]] = [ED.images[j], ED.images[i]]; markDirty(); renderImgs(); });
        const x = row.querySelector('[data-x]'); if (x) x.onclick = () => { ED.images.splice(i, 1); markDirty(); renderImgs(); };
      });
    };
    renderImgs();
    const addImgs = async files => {
      files = [...files].filter(f => /^image\//.test(f.type)); if (!files.length) return;
      busy(`Preparing ${files.length} image${files.length > 1 ? 's' : ''}…`);
      try { for (const f of files) { const im = await processImage(f, 2000); ED.images.push({ ...im, caption: '' }); } markDirty(); }
      catch (e) { toast(e.message, true); } finally { busy(false); renderImgs(); }
    };
    if (S.writable) {
      $('#addimg').onclick = () => $('#addinput').click();
      $('#addinput').onchange = e => { addImgs(e.target.files); e.target.value = ''; };
      dropTarget($('#addimg'), addImgs);
      $('#saveproj').onclick = saveProject;
      const del = $('#delproj');
      if (del) del.onclick = () => { S.dirty = false; location.hash = '#projects'; setTimeout(() => $(`#view tr[data-id="${CSS.escape(ED.origId)}"] [data-act=del]`)?.click(), 50); };
    }
  }

  function dropTarget(el, onFiles) {
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('over'); onFiles(e.dataTransfer.files); });
  }

  async function saveProject() {
    const title = ED.title.trim(), id = slug(ED.id || ED.title);
    if (!title) { toast('Add a project title.', true); $('[data-k=title]').focus(); return; }
    if (!id) { toast('The page address needs at least one letter or number.', true); return; }
    if (ED.isNew && S.projects.projects.some(p => p.id === id)) { toast(`A project already uses the address "${id}". Change the address.`, true); return; }
    let category = ED.category;
    let newCat = null;
    if (category === '__new') {
      const name = ED.newCatName.trim();
      if (!name) { toast('Name the new sector, or pick an existing one.', true); return; }
      category = slug(name); newCat = { id: category, name, color: ED.newCatColor };
    }
    if (!ED.hero && !await confirmBox('Publish without a hero image?', 'The project card on the work page will be blank until you add one.', 'Publish anyway', false)) return;

    busy('Preparing images…');
    const extra = [], stamp = Date.now().toString(36), dir = `img/projects/${id}`;
    const place = async (item, name) => {
      if (!item) return '';
      if (!item.file) return item.src;
      const path = `${dir}/${name}-${stamp}.jpg`;
      extra.push({ path, base64: await blobToB64(item.file) });
      S.previews[path] = item.preview;
      return path;
    };
    let record;
    try {
      const hero = await place(ED.hero, 'hero');
      const images = [];
      for (let i = 0; i < ED.images.length; i++) images.push({ src: await place(ED.images[i], String(i + 1).padStart(2, '0')), caption: ED.images[i].caption.trim() });
      record = { id, title, category, featured: !!ED.featured, area: ED.area.trim(), duration: ED.duration.trim(), type: ED.type.trim(), year: ED.year.trim(), lead: ED.lead.trim(), body: ED.body.trim(), hero, images };
    } catch (e) { busy(false); toast(e.message, true); return; }

    const res = await publish(`${ED.isNew ? 'Add' : 'Update'} project: ${title}`, PROJECTS_FILE, d => {
      if (newCat && !d.categories.some(c => c.id === newCat.id)) d.categories.push(newCat);
      const i = d.projects.findIndex(p => p.id === (ED.isNew ? id : ED.origId));
      if (ED.isNew && i >= 0) throw new Error(`A project already uses the address "${id}".`);
      const old = i >= 0 ? d.projects[i] : null;
      if (old) d.projects[i] = record; else d.projects.unshift(record);
      return { deletes: old ? removable([old.hero, ...(old.images || []).map(x => x.src)], d) : [] };
    }, extra);
    if (res) { S.dirty = false; toast('Published. The live site updates in about a minute.'); location.hash = '#projects'; }
  }

  /* ================= CAREERS ================= */
  const deptOf = id => (S.careers.departments.find(d => d.id === id) || { name: id || '—', color: '#bbb' });
  function viewCareers() {
    head('Careers', 'Content', `<a class="btn ghost sm" href="careers.html" target="_blank" rel="noopener">View careers page ↗</a>${S.writable ? '<a class="btn acc sm" href="#role/new">+ New role</a>' : ''}`);
    readonlyNote();
    const list = S.careers.roles;
    if (!list.length) { $('#view').innerHTML = `<div class="empty"><b>No roles yet</b>Add a role to list it on the careers page.</div>`; return; }
    $('#view').innerHTML = `<table class="tbl"><thead><tr><th>Role</th><th class="hide-sm">Team</th><th class="hide-sm">Type</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((r, i) => `<tr class="click" data-id="${esc(r.id)}">
        <td><div class="t">${esc(r.title)}</div><div class="sub">${esc(r.experience || '')}</div></td>
        <td class="hide-sm"><span class="pill" style="--c:${esc(deptOf(r.department).color)}"><i></i>${esc(deptOf(r.department).name)}</span></td>
        <td class="hide-sm">${esc(r.type)}</td>
        <td><button class="pill ${r.open !== false ? 'open' : 'closed'}" data-act="toggle" style="border:0;cursor:${S.writable ? 'pointer' : 'default'}" title="${S.writable ? 'Click to ' + (r.open !== false ? 'close' : 'open') : ''}">${r.open !== false ? 'Open' : 'Closed'}</button></td>
        <td><div class="row-actions">
          ${S.writable ? `<button class="ib" data-act="up" ${i === 0 ? 'disabled' : ''} title="Move up">↑</button><button class="ib" data-act="down" ${i === list.length - 1 ? 'disabled' : ''} title="Move down">↓</button><button class="ib del" data-act="del" title="Delete">✕</button>` : ''}
        </div></td></tr>`).join('')}</tbody></table>
      <p class="hint" style="margin-top:12px;font-size:13px;color:var(--mute)">Closed roles stay here but are hidden from the careers page.</p>`;
    $$('#view tr[data-id]').forEach(tr => tr.addEventListener('click', async e => {
      const id = tr.dataset.id, act = e.target.closest('[data-act]')?.dataset.act;
      const r = S.careers.roles.find(x => x.id === id);
      if (act && !S.writable) return;
      if (act === 'toggle') {
        e.stopPropagation();
        const ok = await publish(`${r.open !== false ? 'Close' : 'Open'} role: ${r.title}`, CAREERS_FILE, d => { const x = d.roles.find(y => y.id === id); if (x) x.open = x.open === false; });
        if (ok) { toast('Role updated.'); viewCareers(); }
        return;
      }
      if (act === 'up' || act === 'down') {
        e.stopPropagation();
        const ok = await publish('Reorder roles', CAREERS_FILE, d => {
          const i = d.roles.findIndex(x => x.id === id), j = i + (act === 'up' ? -1 : 1);
          if (i >= 0 && j >= 0 && j < d.roles.length) [d.roles[i], d.roles[j]] = [d.roles[j], d.roles[i]];
        });
        if (ok) viewCareers();
        return;
      }
      if (act === 'del') {
        e.stopPropagation();
        if (!await confirmBox('Delete this role?', `<b>${esc(r.title)}</b> will be removed from the careers page. To hide it for now, close it instead.`)) return;
        const ok = await publish(`Delete role: ${r.title}`, CAREERS_FILE, d => { d.roles = d.roles.filter(x => x.id !== id); });
        if (ok) { toast('Role deleted.'); viewCareers(); }
        return;
      }
      location.hash = '#role/' + encodeURIComponent(id);
    }));
  }

  function editRole(id) {
    const isNew = id === 'new';
    const r = isNew ? null : S.careers.roles.find(x => x.id === id);
    if (!isNew && !r) { location.hash = '#careers'; return; }
    if (isNew && !S.writable) { location.hash = '#careers'; return; }
    const R = {
      title: r?.title || '', department: r?.department || S.careers.departments[0]?.id || '__new', type: r?.type || 'Full-time',
      experience: r?.experience || '', open: r ? r.open !== false : true, summary: r?.summary || '',
      responsibilities: (r?.responsibilities || []).join('\n'), requirements: (r?.requirements || []).join('\n'),
      newDeptName: '', newDeptColor: '#7FB3D5',
    };
    S.dirty = false;
    head(isNew ? 'New role' : r.title, `<a href="#careers">Careers</a> / ${isNew ? 'new' : 'edit'}`);
    readonlyNote();
    const ro = S.writable ? '' : 'disabled';
    $('#view').innerHTML = `
      <div class="panel" style="max-width:860px">
        <div class="fgrid">
          <label class="f full"><span>Job title <em>*</em></span><input data-k="title" value="${esc(R.title)}" ${ro} maxlength="90"></label>
          <label class="f"><span>Team</span><select data-k="department" ${ro}>${S.careers.departments.map(d => `<option value="${esc(d.id)}" ${d.id === R.department ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}<option value="__new" ${R.department === '__new' ? 'selected' : ''}>+ New team…</option></select>
            <div class="newcat ${R.department === '__new' ? 'on' : ''}" id="newdept"><input data-k="newDeptName" placeholder="Team name"><input type="color" data-k="newDeptColor" value="${R.newDeptColor}" title="Colour"></div></label>
          <label class="f"><span>Employment type</span><select data-k="type" ${ro}>${[...new Set([...ROLE_TYPES, R.type])].map(t => `<option ${t === R.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
          <label class="f"><span>Experience</span><input data-k="experience" value="${esc(R.experience)}" placeholder="e.g. 3+ years" ${ro}></label>
          <label class="f" style="justify-content:flex-end"><span class="check"><input type="checkbox" data-k="open" ${R.open ? 'checked' : ''} ${ro}> Open: show on the careers page</span></label>
          <label class="f full"><span>Summary</span><textarea data-k="summary" ${ro} maxlength="400">${esc(R.summary)}</textarea></label>
          <label class="f full"><span>What you'll do</span><textarea class="tall" data-k="responsibilities" ${ro} placeholder="One point per line">${esc(R.responsibilities)}</textarea><small>One point per line.</small></label>
          <label class="f full"><span>What you'll need</span><textarea class="tall" data-k="requirements" ${ro} placeholder="One point per line">${esc(R.requirements)}</textarea><small>One point per line.</small></label>
        </div>
      </div>
      ${S.writable ? `<div class="savebar"><span class="mono" id="dirtynote">No changes yet</span><div class="actions"><a class="btn ghost sm" href="#careers">Cancel</a><button class="btn acc sm" id="saverole">${isNew ? 'Publish role' : 'Save & publish'}</button></div></div>` : ''}`;
    $$('#view [data-k]').forEach(el => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      R[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; S.dirty = true; $('#dirtynote') && ($('#dirtynote').textContent = 'Unsaved changes');
      if (el.dataset.k === 'department') $('#newdept').classList.toggle('on', R.department === '__new');
    }));
    if (!S.writable) return;
    $('#saverole').onclick = async () => {
      const title = R.title.trim(); if (!title) { toast('Add a job title.', true); return; }
      let dept = R.department, newDept = null;
      if (dept === '__new') { const n = R.newDeptName.trim(); if (!n) { toast('Name the new team, or pick an existing one.', true); return; } dept = slug(n); newDept = { id: dept, name: n, color: R.newDeptColor }; }
      const lines = s => s.split('\n').map(x => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
      let rid = r?.id || slug(title);
      if (isNew) { let n = 2; const base = rid; while (S.careers.roles.some(x => x.id === rid)) rid = `${base}-${n++}`; }
      const record = { id: rid, title, department: dept, type: R.type, experience: R.experience.trim(), open: !!R.open, summary: R.summary.trim(), responsibilities: lines(R.responsibilities), requirements: lines(R.requirements) };
      const ok = await publish(`${isNew ? 'Add' : 'Update'} role: ${title}`, CAREERS_FILE, d => {
        if (newDept && !d.departments.some(x => x.id === newDept.id)) d.departments.push(newDept);
        const i = d.roles.findIndex(x => x.id === record.id);
        if (i >= 0 && !isNew) d.roles[i] = record; else d.roles.unshift(record);
      });
      if (ok) { S.dirty = false; toast('Published. The careers page updates in about a minute.'); location.hash = '#careers'; }
    };
  }

  /* ================= SUBMISSIONS ================= */
  const FORMS = {
    enquiries: { title: 'Enquiries', from: 'Contact form on the home page', cols: [['submitted', 'Received'], ['name', 'Name'], ['company', 'Company'], ['email', 'Email'], ['area', 'Area'], ['message', 'Message']] },
    applications: { title: 'Applications', from: 'Application form on the careers page', cols: [['submitted', 'Received'], ['name', 'Name'], ['role', 'Role'], ['email', 'Email'], ['phone', 'Phone'], ['cv_url', 'CV']] },
  };
  const LABELS = { submitted: 'Received', name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', area: 'Project size', role: 'Role', portfolio: 'Portfolio', message: 'Message', cv_name: 'CV', page: 'Sent from' };
  const fmtDate = s => { const d = new Date(s); return isNaN(d) ? esc(s) : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const safeUrl = u => /^https:\/\//i.test(String(u || '')) ? String(u) : '';
  async function formsApi(body) {
    const r = await fetch(S.cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, key: S.cfg.key }) });
    const j = await r.json().catch(() => ({ ok: false, error: `Unexpected response (${r.status}). Check the web-app URL.` }));
    if (!j.ok) throw new Error(j.error || 'Request failed');
    return j;
  }

  async function viewSubs(form, refresh) {
    const F = FORMS[form];
    head(F.title, `Form submissions · ${F.from}`, S.cfg.endpoint && S.cfg.key ? `<button class="btn ghost sm" id="csv">Export CSV</button><button class="btn acc sm" id="refresh">Refresh</button>` : '');
    banner('');
    if (!S.cfg.endpoint || !S.cfg.key) {
      $('#view').innerHTML = `<div class="empty"><b>Form storage isn't connected yet</b>Add the Google Apps Script URL and admin key in Settings to see submissions here.<br><br><a class="btn acc sm" href="#settings">Open settings</a></div>`;
      return;
    }
    if (!S.subs[form] || refresh) {
      $('#view').innerHTML = `<div class="empty"><b>Loading ${F.title.toLowerCase()}…</b></div>`;
      try { S.subs[form] = (await formsApi({ action: 'list', form })).rows || []; counts(); }
      catch (e) { $('#view').innerHTML = `<div class="empty"><b>Couldn't load submissions</b>${esc(e.message)}</div>`; return; }
    }
    if (location.hash.slice(1) !== form) return; // navigated away while loading
    const rows = S.subs[form];
    $('#refresh').onclick = () => viewSubs(form, true);
    $('#csv').onclick = () => exportCsv(form, rows);
    $('#view').innerHTML = `<div class="subtools"><input type="search" id="q" placeholder="Search name, email, message…"><span class="mono" id="qcount"></span></div><div id="subtable"></div>`;
    const draw = q => {
      const ql = q.toLowerCase();
      const list = rows.filter(r => !ql || Object.values(r).some(v => String(v).toLowerCase().includes(ql)));
      $('#qcount').textContent = `${list.length} of ${rows.length}`;
      $('#subtable').innerHTML = list.length ? `<table class="tbl"><thead><tr>${F.cols.map(([, l], i) => `<th class="${i > 3 ? 'hide-sm' : ''}">${l}</th>`).join('')}</tr></thead><tbody>
        ${list.map(r => `<tr class="click" data-id="${esc(r.id)}">${F.cols.map(([k], i) => `<td class="${i > 3 ? 'hide-sm' : ''}">${
          k === 'submitted' ? `<span class="sub" style="margin:0">${fmtDate(r[k])}</span>` :
          k === 'name' ? `<div class="t" style="font-size:14px">${esc(r[k])}</div>` :
          k === 'cv_url' ? (safeUrl(r[k]) ? '<span class="pill open">CV attached</span>' : '<span class="sub">—</span>') :
          k === 'message' ? `<div class="clip">${esc(r[k])}</div>` : esc(r[k])}</td>`).join('')}</tr>`).join('')}
        </tbody></table>` : `<div class="empty"><b>${rows.length ? 'No matches' : 'No submissions yet'}</b>${rows.length ? 'Try a different search.' : 'New submissions from the website will appear here.'}</div>`;
      $$('#subtable tr[data-id]').forEach(tr => tr.onclick = () => openSub(form, rows.find(r => r.id === tr.dataset.id)));
    };
    $('#q').oninput = e => draw(e.target.value.trim());
    draw('');
  }

  function openSub(form, r) {
    const fields = Object.keys(LABELS).filter(k => r[k] !== '' && r[k] != null && k !== 'name');
    const m = modal(`<span class="mono" style="color:var(--acc-d)">${FORMS[form].title.replace(/s$/, '')}</span><h2>${esc(r.name)}</h2>
      <dl class="dl2">${fields.map(k => `<dt>${LABELS[k]}</dt><dd>${
        k === 'submitted' ? fmtDate(r[k]) :
        k === 'email' ? `<a href="mailto:${esc(r[k])}">${esc(r[k])}</a>` :
        k === 'portfolio' && safeUrl(r[k]) ? `<a href="${esc(safeUrl(r[k]))}" target="_blank" rel="noopener noreferrer">${esc(r[k])}</a>` :
        k === 'cv_name' && safeUrl(r.cv_url) ? `<a href="${esc(safeUrl(r.cv_url))}" target="_blank" rel="noopener noreferrer">${esc(r[k])} ↗</a>` : esc(r[k])}</dd>`).join('')}</dl>
      <div class="mact"><button class="btn danger sm" id="sdel">Delete</button><a class="btn ghost sm" href="mailto:${esc(r.email)}?subject=${encodeURIComponent(form === 'applications' ? `Your application${r.role ? ' for ' + r.role : ''} — Acme Interiors` : 'Your enquiry — Acme Interiors')}">Reply by email</a><button class="btn acc sm" id="sclose">Close</button></div>`);
    $('#sclose', m).onclick = closeModal;
    $('#sdel', m).onclick = async () => {
      closeModal();
      if (!await confirmBox('Delete this submission?', `The ${form === 'applications' ? 'application' : 'enquiry'} from <b>${esc(r.name)}</b> will be removed from the sheet.${r.cv_url ? ' The CV file stays in your Drive folder.' : ''}`)) return;
      busy('Deleting…');
      try { await formsApi({ action: 'delete', form, id: r.id }); S.subs[form] = S.subs[form].filter(x => x.id !== r.id); counts(); toast('Submission deleted.'); viewSubs(form); }
      catch (e) { toast(e.message, true); } finally { busy(false); }
    };
  }

  function exportCsv(form, rows) {
    const keys = ['submitted', ...Object.keys(LABELS).filter(k => k !== 'submitted'), 'cv_url'];
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [keys.map(k => cell(LABELS[k] || k)).join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `acme-${form}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ================= SETTINGS ================= */
  function viewSettings() {
    head('Settings', 'Setup'); banner('');
    const c = S.cfg;
    $('#view').innerHTML = `
      <div class="editor">
        <div class="panel">
          <h3>GitHub repository</h3><p class="hint">Projects, roles and images are saved to this repository. GitHub Pages then republishes the site, usually within a minute.</p>
          <ol class="steps-help">
            <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained tokens → Generate new token</a>.</li>
            <li>Repository access: <b>Only select repositories</b> → this site's repo.</li>
            <li>Permissions → Repository → <b>Contents: Read and write</b>. Nothing else is needed.</li>
            <li>Generate it, copy it and paste it below. Set an expiry date and make a new token when it runs out.</li>
          </ol>
          <div class="fgrid">
            <label class="f"><span>Owner (user or organisation)</span><input id="s-owner" value="${esc(c.owner)}" placeholder="e.g. acme-interiors"></label>
            <label class="f"><span>Repository</span><input id="s-repo" value="${esc(c.repo)}" placeholder="e.g. website"></label>
            <label class="f"><span>Branch</span><input id="s-branch" value="${esc(c.branch)}"></label>
            <label class="f"><span>Personal access token</span><div class="with"><input id="s-token" type="password" value="${esc(c.token)}" placeholder="github_pat_…" autocomplete="off"><button class="ib" type="button" id="s-show" title="Show or hide" style="height:42px;width:42px">👁</button></div></label>
            <label class="f full"><span class="check"><input type="checkbox" id="s-remember" ${c.remember ? 'checked' : ''}> Remember on this device (only tick this on your own computer)</span></label>
          </div>
          <div class="actions" style="margin-top:18px"><button class="btn acc sm" id="s-save">Save & connect</button><button class="btn ghost sm" id="s-forget">Forget token</button></div>
          <div class="result" id="s-res"></div>
        </div>
        <div class="panel">
          <h3>Form submissions</h3><p class="hint">Enquiries and job applications are stored in a private Google Sheet through a Google Apps Script web app (apps-script/Code.gs). They never go into the public repo. The same URL goes in <code>js/config.js</code> so the website forms can send to it.</p>
          <div class="fgrid">
            <label class="f full"><span>Web-app URL</span><input id="f-url" value="${esc(c.endpoint)}" placeholder="https://script.google.com/macros/s/…/exec"></label>
            <label class="f full"><span>Admin key</span><input id="f-key" type="password" value="${esc(c.key)}" autocomplete="off"><small>The ADMIN_KEY script property you set in Apps Script.</small></label>
          </div>
          <div class="actions" style="margin-top:18px"><button class="btn acc sm" id="f-save">Save & test</button></div>
          <div class="result" id="f-res"></div>
          ${CONF.formsEndpoint ? '' : '<p class="hint" style="margin:14px 0 0">Reminder: <code>formsEndpoint</code> in js/config.js is still empty, so the website forms are in preview mode.</p>'}
        </div>
      </div>`;
    $('#s-show').onclick = () => { const t = $('#s-token'); t.type = t.type === 'password' ? 'text' : 'password'; };
    $('#s-save').onclick = async () => {
      Object.assign(S.cfg, { owner: $('#s-owner').value.trim(), repo: $('#s-repo').value.trim(), branch: $('#s-branch').value.trim() || 'main', token: $('#s-token').value.trim(), remember: $('#s-remember').checked });
      saveSettings();
      const res = $('#s-res'); res.className = 'result'; res.textContent = 'Connecting…';
      GitHub.configure(S.cfg);
      try {
        const info = await GitHub.test();
        await loadData();
        res.className = 'result ' + (info.canWrite ? 'ok' : 'bad');
        res.textContent = info.canWrite ? `Connected to ${info.name}. You can now edit content.` : `Connected to ${info.name}, but this token can't write. Give it "Contents: Read and write".`;
      } catch (e) { res.className = 'result bad'; res.textContent = e.message; S.writable = false; setConn(); }
    };
    $('#s-forget').onclick = () => { S.cfg.token = ''; saveSettings(); $('#s-token').value = ''; S.writable = false; GitHub.configure(S.cfg); setConn(); $('#s-res').className = 'result'; $('#s-res').textContent = 'Token removed from this browser.'; };
    $('#f-save').onclick = async () => {
      S.cfg.endpoint = $('#f-url').value.trim(); S.cfg.key = $('#f-key').value.trim(); saveSettings();
      S.subs = { enquiries: null, applications: null }; counts();
      const res = $('#f-res'); res.className = 'result'; res.textContent = 'Testing…';
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(S.cfg.endpoint)) { res.className = 'result bad'; res.textContent = 'That doesn\'t look like an Apps Script web-app URL (it should start with https://script.google.com/).'; return; }
      try { await formsApi({ action: 'ping' }); res.className = 'result ok'; res.textContent = 'Connected. Submissions will show under Enquiries and Applications.'; }
      catch (e) { res.className = 'result bad'; res.textContent = e.message; }
    };
  }

  /* ================= ROUTER ================= */
  let lastHash = location.hash;
  async function route() {
    if (S.dirty && location.hash !== lastHash) {
      const go = location.hash;
      history.replaceState(null, '', lastHash || '#projects');
      if (!await confirmBox('Discard your changes?', 'You have unsaved changes on this page.', 'Discard', true)) return;
      S.dirty = false; location.hash = go; return;
    }
    lastHash = location.hash;
    const [view, arg] = decodeURIComponent(location.hash.slice(1) || 'projects').split('/');
    $$('.side>a[data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === (view === 'project' ? 'projects' : view === 'role' ? 'careers' : view)));
    banner(''); closeModal(); scrollTo(0, 0);
    if (view === 'project') return editProject(arg);
    if (view === 'careers') return viewCareers();
    if (view === 'role') return editRole(arg);
    if (view === 'enquiries' || view === 'applications') return viewSubs(view);
    if (view === 'settings') return viewSettings();
    return viewProjects();
  }
  addEventListener('hashchange', route);
  addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  (async () => {
    head('Loading…', '');
    await loadData();
    if (!S.cfg.token && !location.hash) location.hash = '#settings';
    route();
  })();
})();
