/* Acme Interiors — shared behaviour for every page */
(function(){
  // Highlight the current page in the nav
  const page = document.body.dataset.page;
  document.querySelectorAll('.navlinks a').forEach(a => { if(a.dataset.nav === page) a.classList.add('cur'); });

  // Fade-in on scroll for anything with .reveal (also used by pages that render content later)
  const io = new IntersectionObserver(es => es.forEach(en => {
    if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
  }), {threshold:.15});
  window.observeReveals = (root = document) => root.querySelectorAll('.reveal:not(.in)').forEach((el,i) => {
    el.style.transitionDelay = (i%3)*.08 + 's'; io.observe(el);
  });
  observeReveals();

  // Single-choice chip groups (e.g. project size on the contact form)
  document.querySelectorAll('.chips').forEach(group => group.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    group.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on');
  }));

  // Forms: sent to the Google Apps Script endpoint in js/config.js, which files each form in its own sheet.
  const endpoint = (window.ACME_CONFIG || {}).formsEndpoint;
  const FORMS = {
    form:    { kind: 'enquiries',    ok: "Thanks, we've received your enquiry and will be in touch within two working days.",
               preview: 'Preview only: add your forms endpoint in js/config.js to start receiving enquiries.' },
    appform: { kind: 'applications', ok: "Thanks for applying! We read every application and will reply within a week.",
               preview: 'Preview only: add your forms endpoint in js/config.js to start receiving applications.' },
  };
  const MAX_FILE = 5 * 1024 * 1024;
  const toBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
  Object.entries(FORMS).forEach(([id, cfg]) => {
    const f = document.getElementById(id); if (!f) return;
    const note = f.querySelector('.note'), btn = f.querySelector('button[type=submit]');
    const say = (msg, bad) => { if (note) { note.textContent = msg; note.style.color = bad ? '#C0392B' : ''; } };
    f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!endpoint) { say(cfg.preview); return; }
      const data = {};
      new FormData(f).forEach((v, k) => { if (!(v instanceof File)) data[k] = String(v).trim(); });
      f.querySelectorAll('.chips').forEach(g => { const on = g.querySelector('.on'); if (on) data[g.dataset.name || 'choice'] = on.textContent; });
      let file = null;
      const fileInput = f.querySelector('input[type=file]');
      if (fileInput && fileInput.files[0]) {
        const fl = fileInput.files[0];
        if (fl.size > MAX_FILE) { say('That file is over 5 MB. Please upload a smaller PDF or Word file.', true); return; }
        file = { name: fl.name, type: fl.type || 'application/octet-stream', data: await toBase64(fl) };
      }
      btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = 'Sending…';
      try {
        // text/plain keeps this a "simple" request, so Apps Script doesn't need a CORS preflight
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ form: cfg.kind, data, file, page: location.pathname }) });
        const out = await r.json().catch(() => ({}));
        if (!r.ok || out.ok === false) throw new Error(out.error || 'Something went wrong');
        f.reset(); f.querySelectorAll('#fname').forEach(n => n.textContent = 'Choose a PDF or Word file');
        say(cfg.ok);
      } catch (err) {
        say("Sorry, that didn't go through. Please try again, or email us directly.", true);
      } finally { btn.disabled = false; btn.innerHTML = label; }
    });
  });
})();
