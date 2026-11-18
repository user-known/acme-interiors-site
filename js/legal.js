/* Acme Interiors — terms & privacy pages: highlights the current section in the contents list */
(function(){
  const secs = [...document.querySelectorAll('.ldoc section')], links = [...document.querySelectorAll('.toc a')];
  const spy = new IntersectionObserver(es => es.forEach(en => {
    if(en.isIntersecting){ const i = secs.indexOf(en.target); links.forEach((l,j) => l.classList.toggle('cur', i === j)); }
  }), {rootMargin:'-40% 0px -55% 0px'});
  secs.forEach(s => spy.observe(s));
})();
