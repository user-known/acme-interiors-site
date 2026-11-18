/* Acme Interiors — loads site content from /data/*.json (written by admin.html).
   GitHub Pages caches files for ~10 minutes; the minute-based query string lets updates show up sooner. */
window.AcmeData = (() => {
  const bust = () => 'v=' + Math.floor(Date.now() / 60000);
  const cache = {};
  const load = name => cache[name] || (cache[name] = fetch(`data/${name}.json?${bust()}`).then(r => {
    if (!r.ok) throw new Error(`Could not load data/${name}.json (${r.status})`);
    return r.json();
  }));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return { projects: () => load('projects'), careers: () => load('careers'), esc };
})();
