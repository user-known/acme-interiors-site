/* Acme Interiors — careers page: open roles from data/careers.json (managed in admin.html), team filter, apply shortcut */
(async () => {
  const { esc } = AcmeData;
  const rolesEl = document.getElementById('roles'), rfil = document.getElementById('rfil'), rolesel = document.getElementById('rolesel');
  const countEl = document.getElementById('rolecount');
  let data;
  try { data = await AcmeData.careers(); }
  catch (e) { rolesEl.innerHTML = `<p class="mono" style="padding:24px 0;color:var(--mute)">Roles couldn't be loaded. ${esc(e.message)}</p>`; return; }
  const roles = data.roles.filter(r => r.open !== false);
  const deptOf = id => data.departments.find(d => d.id === id) || { name: id || 'General', color: '#999' };

  roles.forEach(r => { const o = document.createElement('option'); o.textContent = r.title; rolesel.appendChild(o); });

  function render(dep = 'all') {
    const list = roles.filter(r => dep === 'all' || r.department === dep);
    countEl.textContent = list.length ? `${list.length} open position${list.length === 1 ? '' : 's'}` : 'No open positions right now';
    rolesEl.innerHTML = list.map(r => { const d = deptOf(r.department); return `
      <details class="role">
        <summary><h3>${esc(r.title)}</h3><span class="dep mono"><i style="--c:${esc(d.color)}"></i>${esc(d.name)}</span><span class="mono">${[r.type, r.experience].filter(Boolean).map(esc).join(' · ')}</span><span class="pm">+</span></summary>
        <div class="rb"><p>${esc(r.summary)}</p><div>
          ${r.responsibilities?.length ? `<h4>What you'll do</h4><ul>${r.responsibilities.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          ${r.requirements?.length ? `<h4>What you'll need</h4><ul>${r.requirements.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          <button class="btn acc" type="button" data-apply="${esc(r.title)}">Apply for this role <span class="arr">→</span></button>
        </div></div>
      </details>`; }).join('');
    rolesEl.querySelectorAll('[data-apply]').forEach(b => b.onclick = () => {
      rolesel.value = b.dataset.apply; document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });
    });
  }
  const used = data.departments.filter(d => roles.some(r => r.department === d.id));
  if (used.length > 1) [{ id: 'all', name: 'All teams' }, ...used].forEach((d, i) => {
    const b = document.createElement('button'); b.textContent = d.name; if (!i) b.classList.add('on');
    b.onclick = () => { rfil.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); render(d.id); };
    rfil.appendChild(b);
  });
  render();
})();
document.getElementById('cv').addEventListener('change', e => {
  const f = e.target.files[0]; document.getElementById('fname').textContent = f ? f.name : 'Choose a PDF or Word file';
});
