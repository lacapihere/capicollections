(function () {
  var html = document.documentElement;
  var frame = document.getElementById('frame');
  var scroller = document.getElementById('scroller');
  var nav = document.getElementById('nav');
  var menuBtn = document.querySelector('.menu-btn');

  /* ---------- language ---------- */
  var titles = {
    en: 'Gabriela Briceño Immigration Law, PLLC',
    es: 'Gabriela Briceño Immigration Law, PLLC — Abogada de Inmigración'
  };

  function setLang(lang, persist) {
    if (lang !== 'en' && lang !== 'es') lang = 'en';
    html.setAttribute('data-lang', lang);
    html.setAttribute('lang', lang);
    document.title = titles[lang];
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang));
    });
    if (persist) { try { localStorage.setItem('gb-lang', lang); } catch (e) {} }
  }

  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-set-lang'), true); });
  });

  var saved = null;
  try { saved = localStorage.getItem('gb-lang'); } catch (e) {}
  if (!saved && /^es\b/i.test(navigator.language || '')) saved = 'es';
  if (saved) setLang(saved, false);

  /* ---------- mobile menu ---------- */
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- active section (nav + rail) ---------- */
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a, .rail a'));

  function mark(id) {
    links.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
    });
  }

  if ('IntersectionObserver' in window) {
    var desktop = window.matchMedia('(min-width: 961px)');
    var observer = null;

    function observe() {
      if (observer) observer.disconnect();
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) mark(en.target.id);
        });
      }, { root: desktop.matches ? scroller : null, threshold: 0.55 });
      panels.forEach(function (p) { observer.observe(p); });
    }
    observe();
    if (desktop.addEventListener) desktop.addEventListener('change', observe);
  }

  /* ---------- practice deck ---------- */
  var deck = document.querySelector('[data-deck]');
  if (deck) {
    var cards = Array.prototype.slice.call(deck.querySelectorAll('.area'));
    var dots = Array.prototype.slice.call(deck.querySelectorAll('[data-deck-to]'));
    var n = cards.length;
    var current = 0;

    function show(i) {
      current = ((i % n) + n) % n;
      cards.forEach(function (card, idx) {
        var rel = ((idx - current) % n + n) % n;         // 0 centre, 1 right, n-1 left
        card.classList.remove('is-center', 'is-left', 'is-right');
        card.classList.add(rel === 0 ? 'is-center' : rel === 1 ? 'is-right' : 'is-left');
        card.setAttribute('aria-hidden', String(rel !== 0));
      });
      dots.forEach(function (d, idx) { d.setAttribute('aria-selected', String(idx === current)); });
    }

    deck.querySelector('[data-deck-prev]').addEventListener('click', function () { show(current - 1); });
    deck.querySelector('[data-deck-next]').addEventListener('click', function () { show(current + 1); });
    dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.getAttribute('data-deck-to')); }); });
    cards.forEach(function (card, idx) {
      card.querySelector('.area-hit').addEventListener('click', function () { show(idx); });
    });
    deck.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(current - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { show(current + 1); e.preventDefault(); }
    });
    show(0);
  }

  /* ---------- contact form ---------- */
  var form = document.querySelector('.form');
  if (form) {
    var status = form.querySelector('.form-status');
    var copy = {
      en: {
        required: 'Please fill in this field.',
        email: 'Enter a valid email address.',
        sending: 'Sending…',
        sent: 'Message sent. We will reply as soon as possible.',
        failed: 'The message could not be sent. Email us directly at gabriela@gbimmigrationlaw.com.'
      },
      es: {
        required: 'Completa este campo.',
        email: 'Escribe un correo electrónico válido.',
        sending: 'Enviando…',
        sent: 'Mensaje enviado. Responderemos lo antes posible.',
        failed: 'No se pudo enviar el mensaje. Escríbenos directamente a gabriela@gbimmigrationlaw.com.'
      }
    };
    function t(key) { return copy[html.getAttribute('data-lang') || 'en'][key]; }

    function setError(field, msg) {
      var wrap = field.closest('.field');
      var err = wrap.querySelector('.error');
      if (msg) {
        if (!err) { err = document.createElement('p'); err.className = 'error'; wrap.appendChild(err); }
        err.textContent = msg;
        wrap.classList.add('is-invalid');
        field.setAttribute('aria-invalid', 'true');
      } else {
        if (err) err.remove();
        wrap.classList.remove('is-invalid');
        field.removeAttribute('aria-invalid');
      }
    }

    function validate() {
      var ok = true, first = null;
      form.querySelectorAll('input:not([type=hidden]):not(.botcheck), textarea').forEach(function (f) {
        var msg = '';
        if (f.required && !f.value.trim()) msg = t('required');
        else if (f.type === 'email' && f.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value)) msg = t('email');
        setError(f, msg);
        if (msg) { ok = false; if (!first) first = f; }
      });
      if (first) first.focus();
      return ok;
    }

    form.querySelectorAll('input, textarea').forEach(function (f) {
      f.addEventListener('input', function () { if (f.closest('.field').classList.contains('is-invalid')) setError(f, ''); });
    });

    // message box grows with its content (fallback where field-sizing isn't supported)
    var msg = form.querySelector('textarea');
    if (msg && !CSS.supports || !CSS.supports('field-sizing', 'content')) {
      var grow = function () {
        msg.style.height = 'auto';
        msg.style.height = Math.min(msg.scrollHeight, 14 * 16) + 'px';
      };
      msg.addEventListener('input', grow);
      grow();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      status.textContent = t('sending');

      var data = new FormData(form);
      data.delete('botcheck');
      fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.success !== false }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error('failed');
          form.classList.add('is-sent');
          status.textContent = t('sent');
        })
        .catch(function () {
          status.textContent = t('failed');
          btn.disabled = false;
        });
    });
  }
})();
