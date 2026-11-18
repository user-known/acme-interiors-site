/* Acme Interiors — project detail template. Every project uses this page: project.html#<project-id>.
   Content comes from data/projects.json (managed in admin.html). */
(async () => {
  const { esc } = AcmeData;
  const pview = document.getElementById('pview');
  let data;
  try { data = await AcmeData.projects(); }
  catch (e) { pview.innerHTML = `<p class="mono" style="color:var(--mute)">This project couldn't be loaded. ${esc(e.message)}</p>`; return; }
  const projects = data.projects;
  const catOf = id => data.categories.find(c => c.id === id) || { name: id || '', color: '#999' };
  const LAYOUT = ['f12', 'f7', 'f5'];   // full width, large half, small half — repeats for any number of images
  const stat = (label, value, unit, color, cls = '') => value ? `<div class="pv-stat ${cls}" style="--c:${color}"><dt>${label}</dt><dd${cls === 'sm' ? ' style="font-size:clamp(22px,2vw,28px)"' : ''}>${esc(value)}${unit ? `<small>${unit}</small>` : ''}</dd></div>` : '';

  function render(p) {
    const c = catOf(p.category), i = projects.indexOf(p), nx = projects[(i + 1) % projects.length];
    const imgs = (p.images || []).filter(im => im.src);
    // a lone half-width image at the end looks unfinished, so give it the full row
    const layoutFor = k => (k === imgs.length - 1 && LAYOUT[k % 3] === 'f7') ? 'f12' : LAYOUT[k % 3];
    pview.innerHTML = `
      <div class="pv-top"><a href="work.html" class="back mono">← All work</a><span class="pv-cat mono"><i style="--c:${esc(c.color)}"></i>${esc(c.name)}${p.year ? ' · ' + esc(p.year) : ''}</span></div>
      <h1 class="pv-title reveal">${esc(p.title)}</h1>
      ${p.hero ? `<figure class="pv-hero" id="pvHero"><img src="${esc(p.hero)}" alt="${esc(p.title)}"></figure>` : ''}
      <div class="pv-body">
        <div class="pv-desc reveal"><span class="mono">About the project</span>${p.lead ? `<p>${esc(p.lead)}</p>` : ''}${String(p.body || '').split(/\n\s*\n/).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}</div>
        <dl class="pv-stats reveal">
          ${stat('Area', p.area, 'sq ft', '#FE7F2D')}
          ${stat('Duration', p.duration, 'weeks', '#233D4D')}
          ${stat('Type of work', p.type, '', '#7FB3D5', 'wide')}
          ${stat('Sector', c.name, '', '#F6C453', 'sm')}
          ${stat('Completed', p.year, '', '#7DAE8A', 'sm')}
        </dl>
      </div>
      <div class="pv-imgs">${imgs.map((im, k) => `<figure class="${layoutFor(k)} reveal"><div class="frame"><img src="${esc(im.src)}" alt="${esc(p.title)}${im.caption ? ': ' + esc(im.caption) : ''}" loading="lazy"></div>${im.caption ? `<figcaption><b>${String(k + 1).padStart(2, '0')}</b>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div>
      <div class="pv-next">
        ${nx && nx !== p ? `<a class="nx" href="project.html#${encodeURIComponent(nx.id)}"><span class="mono">Next project</span><div class="nt">${esc(nx.title)} <span>→</span></div></a>` : '<span></span>'}
        <a href="index.html#contact" class="btn acc">Start a similar project <span class="arr">→</span></a>
      </div>`;
    document.title = `${p.title} — Acme Interiors`;
    observeReveals(pview);
    const hero = document.getElementById('pvHero');
    if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('in')));
  }

  function show() {
    const id = decodeURIComponent(location.hash.slice(1));
    const p = projects.find(x => x.id === id) || (!id && projects[0]);
    if (!p) { location.replace('404.html'); return; }
    render(p);
    document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0); document.documentElement.style.scrollBehavior = '';
  }
  addEventListener('hashchange', show);
  show();
})();
