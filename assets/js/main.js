/* ==========================================================================
   GUARDIANES DEL VIENTO — interacciones de la página
   Cabecera, menú, revelado al desplazarse, cifras, figuras interactivas y
   visor de fotos. Cada bloque es independiente: si su marcado no está, no hace
   nada. Sin dependencias y como script clásico (funciona abierto con file://).
   ========================================================================== */
(function () {
  'use strict';

  // El <head> espera esta señal: si no llega, deja todo el contenido a la vista
  window.__gvReady = true;

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var $ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  // Sin movimiento: lo pide el sistema o lo pidió la persona con «Pausar animaciones»
  var calm = function () { return reduceMotion.matches || root.classList.contains('is-still'); };
  var easeOut = function (k) { return 1 - Math.pow(1 - k, 3); };

  /* ------------------------------------------------------------------------
     Scroll: una sola lectura por cuadro para todo lo que depende de él
     --------------------------------------------------------------------- */
  var header = $('#siteHeader');
  var progress = $('#scrollProgress');
  var parallaxEls = $$('[data-parallax]').map(function (img) {
    return { img: img, host: img.parentNode, k: parseFloat(img.getAttribute('data-parallax')) || 0.1, on: false };
  });
  var lastY = window.scrollY;
  var ticking = false;
  var menuOpen = false;

  function onFrame() {
    ticking = false;
    var y = window.scrollY;
    var max = Math.max(1, doc.documentElement.scrollHeight - window.innerHeight);

    if (progress) progress.style.transform = 'scaleX(' + clamp(y / max, 0, 1).toFixed(4) + ')';

    if (header) {
      header.classList.toggle('is-scrolled', y > 24);
      // Se retira al bajar leyendo y vuelve al primer gesto hacia arriba
      var dy = y - lastY;
      if (menuOpen || y < 480 || header.contains(doc.activeElement)) header.classList.remove('is-away');
      else if (dy > 6) header.classList.add('is-away');
      else if (dy < -6) header.classList.remove('is-away');
    }
    lastY = y;

    if (!calm()) {
      var vh = window.innerHeight;
      for (var i = 0; i < parallaxEls.length; i++) {
        var p = parallaxEls[i];
        if (!p.on) continue;
        var r = p.host.getBoundingClientRect();
        var offset = (r.top + r.height / 2 - vh / 2) * -p.k;
        p.img.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
      }
    }
  }

  function requestFrame() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onFrame);
    }
  }

  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame, { passive: true });
  if (header) header.addEventListener('focusin', function () { header.classList.remove('is-away'); });
  onFrame();

  var hasIO = 'IntersectionObserver' in window;

  if (hasIO && parallaxEls.length) {
    var parallaxIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        for (var i = 0; i < parallaxEls.length; i++) {
          if (parallaxEls[i].host === en.target) parallaxEls[i].on = en.isIntersecting;
        }
      });
      requestFrame();
    }, { rootMargin: '20% 0px 20% 0px' });
    parallaxEls.forEach(function (p) { parallaxIO.observe(p.host); });
  }

  /* ------------------------------------------------------------------------
     Navegación: enlace activo según la sección que cruza el centro de la pantalla
     --------------------------------------------------------------------- */
  var NAV_GROUP = {
    riesgo: 'riesgo',
    solucion: 'solucion', servicio: 'solucion', tecnologia: 'solucion',
    cambio: 'impacto', seleccion: 'impacto', impacto: 'impacto',
    modelo: 'piloto', piloto: 'piloto', gobernanza: 'piloto', controles: 'piloto',
    inversion: 'inversion', finanzas: 'inversion',
    territorio: 'territorio',
    preguntas: 'preguntas',
  };
  var navLinks = $$('.site-nav a');

  function setActive(id) {
    var group = NAV_GROUP[id] || '';
    navLinks.forEach(function (a) {
      if (a.getAttribute('href') === '#' + group) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  if (hasIO && navLinks.length) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) setActive(en.target.id);
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    $$('main section[id]').forEach(function (s) { navIO.observe(s); });
  }

  /* ------------------------------------------------------------------------
     Menú a pantalla completa
     --------------------------------------------------------------------- */
  var menu = $('#menu');
  var menuToggle = $('#menuToggle');

  if (menu && menuToggle) {
    var menuLinks = $$('a, button', menu);
    var label = $('.visually-hidden', menuToggle);
    $$('li', menu).forEach(function (li, i) { li.style.setProperty('--n', i); });

    var setMenu = function (open, restoreFocus) {
      if (open === menuOpen) return;
      menuOpen = open;
      menuToggle.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Cerrar el menú' : 'Abrir el menú';
      root.classList.toggle('is-menu-open', open);
      if (open) {
        menu.hidden = false;
        // Fuerza un cuadro con el estado inicial para que la transición corra
        void menu.offsetWidth;
        menu.classList.add('is-open');
        if (header) header.classList.remove('is-away');
      } else {
        menu.classList.remove('is-open');
        window.setTimeout(function () { if (!menuOpen) menu.hidden = true; }, reduceMotion.matches ? 0 : 320);
        if (restoreFocus) menuToggle.focus();
      }
    };

    menuToggle.addEventListener('click', function () { setMenu(!menuOpen, true); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false, false);
    });
    doc.addEventListener('keydown', function (e) {
      if (!menuOpen) return;
      if (e.key === 'Escape') {
        setMenu(false, true);
        return;
      }
      if (e.key !== 'Tab' || !menuLinks.length) return;
      // El foco circula entre el botón y los enlaces del menú
      var first = menuToggle;
      var last = menuLinks[menuLinks.length - 1];
      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!menu.contains(doc.activeElement) && doc.activeElement !== first) {
        e.preventDefault();
        menuLinks[0].focus();
      }
    });
    window.matchMedia('(min-width: 1100px)').addEventListener('change', function (mq) {
      if (mq.matches) setMenu(false, false);
    });
  }

  /* ------------------------------------------------------------------------
     Revelado al desplazarse y cifras que cuentan
     --------------------------------------------------------------------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (!isFinite(target)) return;
    var t0 = 0;
    var dur = 1500;
    function step(now) {
      if (!t0) t0 = now;
      var k = clamp((now - t0) / dur, 0, 1);
      el.textContent = Math.round(target * easeOut(k));
      if (k < 1) window.requestAnimationFrame(step);
    }
    el.textContent = '0';
    window.requestAnimationFrame(step);
  }

  var revealEls = $$('[data-reveal]');
  if (!hasIO) {
    root.classList.add('no-reveal');
  } else if (revealEls.length) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        revealIO.unobserve(el);
        el.classList.add('is-in');
        if (!calm()) $$('[data-count]', el).forEach(countUp);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  }

  /* ------------------------------------------------------------------------
     Figura «tres versiones del mismo territorio»
     Es una ilustración conceptual (el motivo de la escena 1 del guion), no datos.
     --------------------------------------------------------------------- */
  (function versions() {
    var fig = $('#versions');
    var svg = $('#versionsSvg');
    var range = $('#versionsRange');
    var stateEl = $('#versionsState');
    if (!fig || !svg || !range) return;

    var W = 960, H = 220, N = 72;
    var paths = $$('.v-line', svg);
    var LINES = [
      { base: 0.26, amp: 30, freq: 1.45, phase: 0.4, speed: 0.21 },
      { base: 0.52, amp: 40, freq: 2.05, phase: 2.3, speed: -0.17 },
      { base: 0.77, amp: 28, freq: 1.2, phase: 4.2, speed: 0.13 },
    ];
    var STATES = [
      'Sin evidencia compartida crecen la desconfianza, el conflicto y las paralizaciones.',
      'Con participación comunitaria, protocolos técnicos y validación independiente, las versiones se acercan.',
      'Una misma evidencia, reconocida por las partes, permite actuar antes y decidir con menor incertidumbre.',
    ];
    var SHORT = ['versiones distintas', 'las versiones se acercan', 'una misma evidencia'];
    var t = 0;
    var stateIndex = -1;
    var visible = false;
    var raf = 0;

    function shared(x) {
      return H / 2 + 9 * Math.sin((x / W) * Math.PI * 2 * 0.9 + 0.6);
    }

    function draw(time) {
      var k = t * t * (3 - 2 * t);
      var out = ['', '', '', ''];
      for (var i = 0; i <= N; i++) {
        var x = (i / N) * W;
        var one = shared(x);
        var cmd = (i ? 'L' : 'M') + x.toFixed(1) + ' ';
        for (var j = 0; j < 3; j++) {
          var L = LINES[j];
          var own = H * L.base + L.amp * Math.sin((x / W) * Math.PI * 2 * L.freq + L.phase + time * L.speed);
          out[j] += cmd + (own + (one - own) * k).toFixed(1);
        }
        out[3] += cmd + one.toFixed(1);
      }
      for (var p = 0; p < 4; p++) paths[p].setAttribute('d', out[p]);
    }

    function sync() {
      t = range.value / 100;
      range.style.setProperty('--p', range.value + '%');
      fig.style.setProperty('--one', clamp((t - 0.8) / 0.2, 0, 1).toFixed(3));
      var idx = t < 0.34 ? 0 : t < 0.85 ? 1 : 2;
      if (idx !== stateIndex) {
        stateIndex = idx;
        stateEl.textContent = STATES[idx];
      }
      // Corto: la frase completa la anuncia la región viva solo al cambiar de tramo
      range.setAttribute('aria-valuetext', range.value + ' %, ' + SHORT[idx]);
    }

    function loop(now) {
      draw(now / 1000);
      raf = visible && !calm() ? window.requestAnimationFrame(loop) : 0;
    }

    function wake() {
      if (!raf) raf = window.requestAnimationFrame(loop);
    }

    range.addEventListener('input', function () {
      sync();
      if (!raf) draw(performance.now() / 1000);
    });

    sync();
    draw(0);

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !calm()) wake();
      }, { rootMargin: '10% 0px 10% 0px' }).observe(fig);
    }
    doc.addEventListener('motion:change', function () {
      if (visible && !calm()) wake();
    });
  })();

  /* ------------------------------------------------------------------------
     Pestañas de las cinco funciones (patrón ARIA de tablist)
     --------------------------------------------------------------------- */
  (function tabs() {
    var host = $('#functions');
    if (!host) return;
    var tabsEls = $$('[role="tab"]', host);
    var panels = $$('[role="tabpanel"]', host);

    function select(i, focus) {
      tabsEls.forEach(function (tab, k) {
        var on = k === i;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      if (focus) tabsEls[i].focus();
      var tab = tabsEls[i];
      var list = tab.parentNode;
      if (list.scrollWidth > list.clientWidth) {
        list.scrollTo({ left: tab.offsetLeft - 16, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
    }

    tabsEls.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, false); });
      tab.addEventListener('keydown', function (e) {
        var n = tabsEls.length;
        var to = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (i - 1 + n) % n;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = n - 1;
        if (to < 0) return;
        e.preventDefault();
        select(to, true);
      });
    });
  })();

  /* ------------------------------------------------------------------------
     Análisis de sensibilidad: pesos por escenario y calificación de Guardianes
     --------------------------------------------------------------------- */
  (function sensitivity() {
    var host = $('#sens');
    if (!host) return;
    var DATA = {
      base: { w: [35, 35, 30], score: '4,48' },
      innovacion: { w: [60, 20, 20], score: '4,56' },
      viabilidad: { w: [20, 60, 20], score: '4,34' },
      sostenibilidad: { w: [20, 20, 60], score: '4,56' },
    };
    var KEYS = ['innovacion', 'viabilidad', 'sostenibilidad'];
    var buttons = $$('[data-sens]', host);
    var score = $('#sensScore');

    function choose(btn, focus) {
      var d = DATA[btn.getAttribute('data-sens')];
      if (!d) return;
      buttons.forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      KEYS.forEach(function (key, i) {
        var bar = $('[data-w="' + key + '"]', host);
        var val = $('[data-wv="' + key + '"]', host);
        if (bar) bar.style.setProperty('--w', d.w[i]);
        if (val) val.textContent = d.w[i] + ' %';
      });
      if (score.textContent !== d.score) {
        score.textContent = d.score;
        score.classList.remove('is-swap');
        void score.offsetWidth;
        score.classList.add('is-swap');
      }
      if (focus) btn.focus();
    }

    buttons.forEach(function (btn, i) {
      btn.addEventListener('click', function () { choose(btn, false); });
      btn.addEventListener('keydown', function (e) {
        var n = buttons.length;
        var to = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (i - 1 + n) % n;
        if (to < 0) return;
        e.preventDefault();
        choose(buttons[to], true);
      });
    });
  })();

  /* ------------------------------------------------------------------------
     Visor de fotos de campo
     Se construye al primer uso y se cuelga de <body>: dentro de una sección con
     transform (el revelado) un position:fixed dejaría de cubrir la pantalla.
     --------------------------------------------------------------------- */
  (function lightbox() {
    var links = $$('#gallery a[data-lightbox]');
    if (!links.length) return;

    var box, img, caption, count, index = 0, opener = null, startX = null, closeTimer = 0;

    function icon(name) {
      return '<svg aria-hidden="true"><use href="#' + name + '"/></svg>';
    }

    function build() {
      box = doc.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Fotografías de campo');
      box.hidden = true;
      box.innerHTML =
        '<div class="lightbox-stage">' +
        '<img class="lightbox-img" alt="">' +
        '<button type="button" class="lightbox-btn lightbox-btn--close" aria-label="Cerrar el visor">' + icon('i-close') + '</button>' +
        '</div>' +
        '<div class="lightbox-bar">' +
        '<button type="button" class="lightbox-btn lightbox-btn--prev" aria-label="Foto anterior">' + icon('i-arrow') + '</button>' +
        '<p class="lightbox-caption" aria-live="polite"></p>' +
        '<span class="lightbox-count"></span>' +
        '<button type="button" class="lightbox-btn lightbox-btn--next" aria-label="Foto siguiente">' + icon('i-arrow') + '</button>' +
        '</div>';
      doc.body.appendChild(box);
      img = $('.lightbox-img', box);
      caption = $('.lightbox-caption', box);
      count = $('.lightbox-count', box);

      $('.lightbox-btn--close', box).addEventListener('click', close);
      $('.lightbox-btn--prev', box).addEventListener('click', function () { show(index - 1); });
      $('.lightbox-btn--next', box).addEventListener('click', function () { show(index + 1); });
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target.classList.contains('lightbox-stage')) close();
      });
      img.addEventListener('load', function () { img.classList.remove('is-loading'); });
      box.addEventListener('pointerdown', function (e) { startX = e.clientX; });
      box.addEventListener('pointerup', function (e) {
        if (startX === null) return;
        var dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 60) show(index + (dx < 0 ? 1 : -1));
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowRight') show(index + 1);
        else if (e.key === 'ArrowLeft') show(index - 1);
        else if (e.key === 'Tab') {
          var btns = $$('button', box);
          var first = btns[0];
          var last = btns[btns.length - 1];
          if (e.shiftKey && doc.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && doc.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });
    }

    function show(i) {
      index = (i + links.length) % links.length;
      var link = links[index];
      var thumb = $('img', link);
      img.classList.add('is-loading');
      img.alt = thumb ? thumb.alt : '';
      img.src = link.getAttribute('href');
      caption.textContent = thumb ? thumb.alt : '';
      count.textContent = index + 1 + ' / ' + links.length;
      // Deja lista la siguiente para que el paso sea inmediato
      var next = links[(index + 1) % links.length];
      new Image().src = next.getAttribute('href');
    }

    function open(i, from) {
      if (!box) build();
      // Un cierre a medio terminar no puede ocultar el visor que se acaba de reabrir
      window.clearTimeout(closeTimer);
      opener = from;
      box.hidden = false;
      void box.offsetWidth;
      box.classList.add('is-open');
      root.classList.add('is-locked');
      show(i);
      $('.lightbox-btn--close', box).focus();
    }

    function close() {
      box.classList.remove('is-open');
      root.classList.remove('is-locked');
      closeTimer = window.setTimeout(function () {
        if (!box.classList.contains('is-open')) box.hidden = true;
      }, reduceMotion.matches ? 0 : 320);
      if (opener) opener.focus({ preventScroll: true });
    }

    links.forEach(function (link, i) {
      link.addEventListener('click', function (e) {
        // Con una tecla modificadora se respeta «abrir en otra pestaña»
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        open(i, link);
      });
    });
  })();

  /* ------------------------------------------------------------------------
     «Pausar animaciones»: detiene todo lo que se mueve solo (fondo, rotor,
     figuras) y lo recuerda. Es el control que pide WCAG 2.2.2 para el movimiento
     que arranca sin que nadie lo pida; el tráiler tiene su propia pausa.
     --------------------------------------------------------------------- */
  (function motion() {
    var KEY = 'gv-motion';
    var buttons = $$('[data-motion-toggle]');

    function apply(still, remember) {
      root.classList.toggle('is-still', still);
      var label = still ? 'Reanudar animaciones' : 'Pausar animaciones';
      buttons.forEach(function (btn) {
        var text = $('.motion-label', btn);
        if (text) text.textContent = label;
        else {
          btn.setAttribute('aria-label', label);
          btn.title = label;
        }
        btn.classList.toggle('is-on', still);
      });
      if (window.Fondo && window.Fondo.set) window.Fondo.set({ still: still });
      if (remember) {
        try { window.localStorage.setItem(KEY, still ? 'off' : 'on'); } catch (e) { /* sin almacenamiento */ }
      }
      doc.dispatchEvent(new CustomEvent('motion:change', { detail: { still: still } }));
    }

    // La clase ya viene puesta desde el <head> si la persona lo había pedido antes
    apply(root.classList.contains('is-still'), false);
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () { apply(!root.classList.contains('is-still'), true); });
    });
  })();

  /* ------------------------------------------------------------------------
     Fondo vivo: más presente en el escenario, más quieto durante la lectura
     --------------------------------------------------------------------- */
  (function ambient() {
    if (!hasIO) return;
    var stage = $('#trailer');
    if (!stage) return;
    new IntersectionObserver(function (entries) {
      if (window.Fondo && window.Fondo.set) window.Fondo.set({ intensity: entries[0].isIntersecting ? 1 : 0.62 });
    }, { threshold: 0.25 }).observe(stage);
  })();
})();
