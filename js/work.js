/* Acme Interiors — work page: category filters and project grid, from data/projects.json */
(async () => {
  const { esc } = AcmeData;
  const filtersEl = document.getElementById('filters'), grid = document.getElementById('ggrid');
  let data;
  try { data = await AcmeData.projects(); }
  catch (e) { grid.innerHTML = `<p class="mono" style="grid-column:1/-1;color:var(--mute)">Projects couldn't be loaded. ${esc(e.message)}</p>`; return; }
  const cats = data.categories, projects = data.projects;
  const catOf = id => cats.find(c => c.id === id) || { name: id, color: '#999' };

  [{ id: 'all', name: 'All work' }, ...cats.filter(c => projects.some(p => p.category === c.id))].forEach((c, i) => {
    const b = document.createElement('button');
    b.innerHTML = (c.color ? `<i style="--c:${esc(c.color)}"></i>` : '') + esc(c.name);
    if (!i) b.classList.add('on');
    b.onclick = () => { filtersEl.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); render(c.id); };
    filtersEl.appendChild(b);
  });

  function render(cat = 'all') {
    grid.innerHTML = '';
    const list = projects.filter(p => cat === 'all' || p.category === cat);
    if (!list.length) grid.innerHTML = '<p class="mono" style="grid-column:1/-1;color:var(--mute)">No projects yet.</p>';
    list.forEach(p => {
      const c = catOf(p.category);
      const a = document.createElement('a');
      a.href = 'project.html#' + encodeURIComponent(p.id);
      a.className = 'proj' + (p.featured && cat === 'all' ? ' wide' : '');
      a.innerHTML = `<div class="img" style="--t:var(--sand)">${p.hero ? `<img src="${esc(p.hero)}" alt="${esc(p.title)}" loading="lazy">` : ''}<span class="tagc mono"><i style="--c:${esc(c.color)}"></i>${esc(c.name)}</span></div>
        <div class="meta"><div><h3>${esc(p.title)}</h3><span class="mono">${[p.area && esc(p.area) + ' sq ft', esc(p.year)].filter(Boolean).join(' · ')}</span></div><span class="go">↗</span></div>`;
      grid.appendChild(a);
      setTimeout(() => a.classList.add('in'), 60 + grid.children.length * 70);
    });
  }
  render();
})();
