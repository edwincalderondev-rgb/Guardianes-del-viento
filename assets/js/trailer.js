/* ==========================================================================
   GUARDIANES DEL VIENTO — reproductor del tráiler
   Tres modos, según assets/js/trailer-data.js:
     · video          → reproduce el video final dentro del marco.
     · previsualización → las ocho escenas del storyboard sincronizadas con la
                          locución real (lo que se ve mientras el video se produce).
     · próximamente   → solo la portada.
   Todo lo que se pinta es función del tiempo del medio: adelantar, retroceder
   o saltar de capítulo deja siempre la escena y los textos en su sitio.
   ========================================================================== */
(function () {
  'use strict';

  var T = window.TRAILER;
  var doc = document;
  var root = doc.documentElement;
  var player = doc.getElementById('player');
  if (!T || !player) return;

  var byId = function (id) { return doc.getElementById(id); };
  var slot = byId('playerSlot');
  var stage = byId('trailer');
  var frameWrap = player.querySelector('.frame-wrap');
  var frame = byId('frame');
  var scenesEl = byId('scenes');
  var video = byId('trailerVideo');
  var badge = byId('frameBadge');
  var captionsEl = byId('captions');
  var endEl = byId('frameEnd');
  var ctlPlay = byId('ctlPlay');
  var ctlNow = byId('ctlNow');
  var ctlCc = byId('ctlCc');
  var ctlMute = byId('ctlMute');
  var ctlCinema = byId('ctlCinema');
  var ctlFull = byId('ctlFull');
  var scrub = byId('scrub');
  var scrubInput = byId('scrubInput');
  var scrubWave = byId('scrubWave');
  var scrubTicks = byId('scrubTicks');
  var chaptersList = byId('chapters');
  var nowPlaying = byId('nowPlaying');
  var transcript = byId('transcript');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var useVideo = !!(T.video && T.video.src);
  var usePreview = !useVideo && T.preview !== false && !!T.audio;
  var scenes = T.scenes || [];
  // Entre frases la locutora respira 0,2–0,5 s: el subtítulo se sostiene hasta la
  // siguiente para que el texto no parpadee; solo se oculta en los silencios largos.
  var cues = (useVideo && T.video.captions === false ? [] : T.captions || []).map(function (c, i, all) {
    var next = all[i + 1];
    return { start: c.start, end: next && next.start - c.end < 0.6 ? next.start : c.end, text: c.text };
  });
  var duration = T.duration || (scenes.length ? scenes[scenes.length - 1].end : 0);

  var STORE_KEY = 'gv-trailer';
  var UI_HIDE_MS = 2600;
  var SEEK_STEP = 5;

  var media = null;
  var state = 'idle';
  var raf = 0;
  var uiTimer = 0;
  var dragging = false;
  var current = -1;
  var cueIndex = -2;
  var lastSecond = -1;
  var stageInView = true;
  var lastFocus = null;
  var sceneMap = [];
  var chapterEls = [];
  var prefs = readPrefs();
  var badgeHtml = badge.innerHTML;
  var badgeDirty = false;

  /* --- Utilidades --------------------------------------------------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function fmt(t) {
    t = Math.max(0, Math.floor(t));
    var s = t % 60;
    return Math.floor(t / 60) + ':' + (s < 10 ? '0' : '') + s;
  }

  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }

  function readPrefs() {
    var p = { cc: false, muted: false, volume: 1 };
    try {
      var raw = JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
      if (typeof raw.cc === 'boolean') p.cc = raw.cc;
      if (typeof raw.muted === 'boolean') p.muted = raw.muted;
      if (typeof raw.volume === 'number') p.volume = clamp(raw.volume, 0, 1);
    } catch (e) { /* almacenamiento bloqueado: se sigue con los valores por defecto */ }
    return p;
  }

  function savePrefs() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch (e) { /* sin almacenamiento */ }
  }

  function isCinema() { return player.classList.contains('is-cinema'); }

  /* --- Estado -------------------------------------------------------------- */
  function setState(next) {
    if (state === next) return;
    state = next;
    player.setAttribute('data-state', next);
    var playing = next === 'playing' || next === 'loading';
    ctlPlay.setAttribute('aria-label', playing ? 'Pausar' : next === 'ended' ? 'Ver de nuevo' : 'Reproducir');
    endEl.hidden = next !== 'ended';
    root.classList.toggle('is-trailer-playing', next === 'playing');
    updateNowPlaying();
    if (next !== 'playing') {
      window.clearTimeout(uiTimer);
      player.classList.add('is-ui');
    }
  }

  /* --- Preparación del marco ---------------------------------------------- */
  function buildWave() {
    var peaks = T.peaks && T.peaks.length ? T.peaks : null;
    var n = peaks ? peaks.length : 120;
    var W = 480, H = 40, step = W / n, bar = step * 0.56;
    var d = '';
    for (var i = 0; i < n; i++) {
      var h = Math.max(2, (peaks ? peaks[i] : 0.12) * (H - 2));
      var x = i * step + (step - bar) / 2;
      var y = (H - h) / 2;
      d += 'M' + x.toFixed(2) + ' ' + y.toFixed(2) + 'h' + bar.toFixed(2) + 'v' + h.toFixed(2) + 'h-' + bar.toFixed(2) + 'z';
    }
    var ns = 'http://www.w3.org/2000/svg';
    ['wave-base', 'wave-prog'].forEach(function (cls) {
      var p = doc.createElementNS(ns, 'path');
      p.setAttribute('class', cls);
      p.setAttribute('d', d);
      scrubWave.appendChild(p);
    });
  }

  function buildTicks() {
    scrubTicks.textContent = '';
    for (var i = 1; i < scenes.length; i++) {
      var s = doc.createElement('span');
      s.style.left = (scenes[i].start / duration) * 100 + '%';
      scrubTicks.appendChild(s);
    }
  }

  function updateLabels() {
    var total = fmt(duration);
    Array.prototype.forEach.call(doc.querySelectorAll('[data-trailer-duration]'), function (el) {
      el.textContent = total;
    });
    scrubInput.max = duration.toFixed(1);
    chapterEls.forEach(function (el, i) {
      var time = el.querySelector('.chapter-time');
      if (time && scenes[i]) time.textContent = fmt(scenes[i].start);
    });
  }

  function mapScenes() {
    chapterEls = Array.prototype.slice.call(chaptersList.querySelectorAll('.chapter'));
    scenes.forEach(function (sc, i) {
      var el = scenesEl.querySelector('.scene[data-scene="' + sc.n + '"]');
      if (!el) { sceneMap[i] = null; return; }
      var items = Array.prototype.map.call(el.querySelectorAll('[data-in]'), function (node) {
        return { el: node, a: parseFloat(node.getAttribute('data-in')), b: parseFloat(node.getAttribute('data-out')), on: false };
      });
      var counters = Array.prototype.map.call(el.querySelectorAll('[data-ov-count]'), function (node) {
        var host = node.closest('[data-in]');
        return { el: node, target: parseFloat(node.getAttribute('data-ov-count')), a: host ? parseFloat(host.getAttribute('data-in')) : 0, val: -1 };
      });
      sceneMap[i] = { el: el, items: items, counters: counters };
    });
  }

  // Las imágenes de las escenas no se piden hasta la primera reproducción
  function loadSceneImages() {
    Array.prototype.forEach.call(scenesEl.querySelectorAll('img[data-src]'), function (img) {
      img.sizes = '(min-width: 1100px) 92vw, 100vw';
      img.srcset = img.getAttribute('data-srcset');
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
    });
  }

  /* --- Medio --------------------------------------------------------------- */
  function ensureMedia() {
    if (media) return media;
    if (useVideo) {
      media = video;
      video.hidden = false;
      scenesEl.hidden = true;
      if (T.video.poster) video.poster = T.video.poster;
      video.preload = 'auto';
      video.src = T.video.src;
    } else {
      media = new Audio();
      media.preload = 'auto';
      media.src = T.audio;
      loadSceneImages();
    }
    media.volume = prefs.volume;
    media.muted = prefs.muted;

    media.addEventListener('loadedmetadata', function () {
      if (isFinite(media.duration) && media.duration > 0) {
        duration = media.duration;
        updateLabels();
        buildTicks();
      }
    });
    media.addEventListener('playing', function () {
      if (badgeDirty) {
        badgeDirty = false;
        badge.innerHTML = badgeHtml;
        badge.hidden = !usePreview;
      }
      setState('playing');
      startLoop();
      pokeUi();
    });
    media.addEventListener('pause', function () {
      stopLoop();
      if (!media.ended) setState('paused');
      render(media.currentTime);
    });
    media.addEventListener('ended', function () {
      stopLoop();
      render(duration);
      setState('ended');
      if (isCinema()) {
        var first = endEl.querySelector('a, button');
        if (first) first.focus({ preventScroll: true });
      }
    });
    media.addEventListener('volumechange', function () {
      prefs.muted = media.muted;
      prefs.volume = media.volume;
      savePrefs();
      syncMute();
    });
    media.addEventListener('error', function () {
      stopLoop();
      exitCinema();
      setState('idle');
      badge.hidden = false;
      badge.textContent = 'No fue posible cargar el tráiler. Revise la conexión e inténtelo de nuevo.';
      badgeDirty = true;
      // El audio se vuelve a crear en el siguiente intento; el <video> es el mismo
      // elemento del documento y se reutiliza (play() lo recarga si quedó en error)
      if (!useVideo) media = null;
    });
    setupMediaSession();
    return media;
  }

  function play(at) {
    if (state === 'soon') return;
    ensureMedia();
    if (typeof at === 'number') seek(at);
    else if (state === 'ended') seek(0);
    if (state === 'idle' || state === 'ended') setState('loading');
    if (media.error) media.load();
    var p = media.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        if (err && err.name === 'AbortError') return;
        var back = media && media.currentTime > 0 ? 'paused' : 'idle';
        setState(back);
        // Si no llegó a arrancar no hay nada que ver: no se deja a nadie encerrado en el modo cine
        if (back === 'idle') exitCinema();
      });
    }
  }

  function pause() {
    if (media && !media.paused) media.pause();
  }

  function toggle() {
    if (state === 'playing' || state === 'loading') pause();
    else play();
  }

  function seek(t) {
    if (!media) return;
    t = clamp(t, 0, Math.max(0, duration - 0.05));
    try { media.currentTime = t; } catch (e) { /* aún sin metadatos: el navegador lo aplica al cargarlos */ }
    // Mover la barra después del final vuelve a dejar el tráiler en pausa, sin la tarjeta de cierre
    if (state === 'ended') setState('paused');
    render(t);
  }

  /* --- Pintado -------------------------------------------------------------- */
  function sceneAt(t) {
    for (var i = scenes.length - 1; i >= 0; i--) {
      if (t >= scenes[i].start) return i;
    }
    return scenes.length ? 0 : -1;
  }

  function switchScene(i) {
    if (current >= 0 && sceneMap[current]) sceneMap[current].el.classList.remove('is-on');
    current = i;
    if (i >= 0 && sceneMap[i]) sceneMap[i].el.classList.add('is-on');
    chapterEls.forEach(function (el, k) {
      el.classList.toggle('is-current', k === i);
      el.classList.toggle('is-done', k < i);
      if (k === i) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
      if (k !== i) el.style.removeProperty('--cp');
    });
    var active = chapterEls[i];
    if (active && chaptersList.scrollWidth > chaptersList.clientWidth) {
      var li = active.parentNode;
      chaptersList.scrollTo({ left: Math.max(0, li.offsetLeft - 24), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  }

  function paintScene(i, f) {
    var S = sceneMap[i];
    if (!S) return;
    if (!reduceMotion.matches) S.el.style.setProperty('--p', f.toFixed(4));
    var k, it;
    for (k = 0; k < S.items.length; k++) {
      it = S.items[k];
      var on = f >= it.a && f < it.b;
      if (on !== it.on) {
        it.on = on;
        it.el.classList.toggle('on', on);
      }
    }
    for (k = 0; k < S.counters.length; k++) {
      var c = S.counters[k];
      var val = Math.round(c.target * easeOut(clamp((f - c.a) / 0.14, 0, 1)));
      if (val !== c.val) {
        c.val = val;
        c.el.textContent = val;
      }
    }
  }

  function paintCaption(t) {
    if (!prefs.cc || !cues.length) {
      if (!captionsEl.hidden) captionsEl.hidden = true;
      cueIndex = -2;
      return;
    }
    if (captionsEl.hidden) captionsEl.hidden = false;
    var hit = -1;
    var c = cues[cueIndex];
    if (c && t >= c.start && t < c.end) hit = cueIndex;
    else {
      for (var i = 0; i < cues.length; i++) {
        if (t >= cues[i].start && t < cues[i].end) { hit = i; break; }
      }
    }
    if (hit === cueIndex) return;
    cueIndex = hit;
    // Entre frases el elemento queda vacío (no oculto): así conserva su sitio
    captionsEl.textContent = hit < 0 ? '' : cues[hit].text;
  }

  function render(t) {
    var i = sceneAt(t);
    if (i !== current) switchScene(i);
    var f = 0;
    if (i >= 0) {
      var sc = scenes[i];
      f = clamp((t - sc.start) / Math.max(0.001, sc.end - sc.start), 0, 1.2);
      if (!useVideo) paintScene(i, f);
      if (chapterEls[i]) chapterEls[i].style.setProperty('--cp', clamp(f, 0, 1).toFixed(3));
    }
    paintCaption(t);

    scrub.style.setProperty('--prog', (clamp(t / duration, 0, 1) * 100).toFixed(2) + '%');
    if (!dragging) scrubInput.value = t.toFixed(1);
    var sec = Math.floor(t);
    if (sec !== lastSecond) {
      lastSecond = sec;
      ctlNow.textContent = fmt(t);
      var where = i >= 0 ? ', escena ' + scenes[i].n + ': ' + scenes[i].title : '';
      scrubInput.setAttribute('aria-valuetext', fmt(t) + ' de ' + fmt(duration) + where);
    }
  }

  function tick() {
    render(media.currentTime);
    raf = window.requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!raf) raf = window.requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  /* --- Controles visibles solo mientras hay actividad ---------------------- */
  function hideUi() {
    uiTimer = 0;
    if (state !== 'playing') return;
    // Si alguien navega con teclado por los controles, no se le esconden: se
    // vuelve a mirar más tarde, por si el foco ya salió
    var a = doc.activeElement;
    var keyboard = a && a !== doc.body && player.contains(a) && a.matches(':focus-visible');
    if (keyboard) uiTimer = window.setTimeout(hideUi, UI_HIDE_MS);
    else player.classList.remove('is-ui');
  }

  function pokeUi() {
    player.classList.add('is-ui');
    window.clearTimeout(uiTimer);
    uiTimer = state === 'playing' ? window.setTimeout(hideUi, UI_HIDE_MS) : 0;
  }

  function syncMute() {
    var muted = media ? media.muted || media.volume === 0 : prefs.muted;
    // Nombre fijo + aria-pressed: un lector anuncia «Silenciar, presionado», sin contradicción
    ctlMute.setAttribute('aria-pressed', String(muted));
  }

  function syncCc() {
    ctlCc.setAttribute('aria-pressed', String(prefs.cc));
    player.classList.toggle('has-cc', prefs.cc && cues.length > 0);
    ctlCc.hidden = !cues.length;
  }

  /* --- Modo cine ------------------------------------------------------------ */
  // Anima el marco desde donde estaba hasta donde queda (FLIP): una sola transformación.
  function flip(first) {
    if (reduceMotion.matches || !frameWrap.animate) return;
    var last = frameWrap.getBoundingClientRect();
    if (!first.width || !last.width) return;
    frameWrap.animate(
      [
        {
          transformOrigin: '0 0',
          transform:
            'translate(' + (first.left - last.left) + 'px,' + (first.top - last.top) + 'px) scale(' +
            first.width / last.width + ',' + first.height / last.height + ')',
        },
        { transformOrigin: '0 0', transform: 'none' },
      ],
      { duration: 720, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
  }

  /* En modo cine el reproductor es un diálogo modal: el resto de la página queda
     inerte, también para el cursor de un lector de pantalla. */
  var inertNodes = [];

  function setModal(on) {
    if (on) {
      player.setAttribute('role', 'dialog');
      player.setAttribute('aria-modal', 'true');
      var nodes = [byId('siteHeader'), byId('menu'), doc.querySelector('.site-footer'), byId('alisio'),
        stage.querySelector('.stage-copy'), stage.querySelector('.scroll-cue')];
      Array.prototype.forEach.call(doc.querySelectorAll('main > *'), function (el) {
        if (el !== stage) nodes.push(el);
      });
      inertNodes = nodes.filter(function (el) { return el && !el.hasAttribute('inert'); });
      inertNodes.forEach(function (el) { el.setAttribute('inert', ''); });
    } else {
      player.setAttribute('role', 'region');
      player.removeAttribute('aria-modal');
      inertNodes.forEach(function (el) { el.removeAttribute('inert'); });
      inertNodes = [];
    }
  }

  function enterCinema() {
    if (isCinema()) return;
    lastFocus = doc.activeElement;
    var first = frameWrap.getBoundingClientRect();
    // El hueco del héroe conserva su alto: la página no se mueve debajo
    slot.style.height = player.offsetHeight + 'px';
    player.classList.add('is-cinema');
    root.classList.add('is-cinema');
    ctlCinema.setAttribute('aria-pressed', 'true');
    setModal(true);
    if (stageInView) flip(first);
    ctlPlay.focus({ preventScroll: true });
    updateNowPlaying();
    doc.dispatchEvent(new CustomEvent('trailer:cinema', { detail: { on: true } }));
  }

  function exitCinema() {
    if (!isCinema()) return;
    if (doc.fullscreenElement && doc.exitFullscreen) doc.exitFullscreen().catch(function () {});
    var first = frameWrap.getBoundingClientRect();
    player.classList.remove('is-cinema');
    root.classList.remove('is-cinema');
    slot.style.height = '';
    ctlCinema.setAttribute('aria-pressed', 'false');
    // Antes de devolver el foco: quien lo recibe puede estar en una zona que quedó inerte
    setModal(false);
    // Solo se anima la vuelta si el héroe está a la vista; si no, el marco «volaría» desde fuera
    if (stageInView) flip(first);
    // El foco vuelve a quien abrió el modo cine; si ya no está a la vista (la portada
    // desaparece al empezar), queda en el botón de reproducir del marco
    var visible = lastFocus && doc.contains(lastFocus) && lastFocus.offsetParent !== null &&
      getComputedStyle(lastFocus).visibility !== 'hidden';
    (visible ? lastFocus : ctlPlay).focus({ preventScroll: true });
    lastFocus = null;
    updateNowPlaying();
    doc.dispatchEvent(new CustomEvent('trailer:cinema', { detail: { on: false } }));
  }

  function toggleFullscreen() {
    if (doc.fullscreenElement) {
      doc.exitFullscreen();
      return;
    }
    enterCinema();
    if (player.requestFullscreen) player.requestFullscreen().catch(function () {});
  }

  function trapFocus(e) {
    if (!isCinema() || e.key !== 'Tab') return;
    var list = Array.prototype.filter.call(
      player.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.disabled && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'; }
    );
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!player.contains(doc.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  /* --- Aviso en la cabecera --------------------------------------------------- */
  function updateNowPlaying() {
    if (!nowPlaying) return;
    var active = (state === 'playing' || state === 'paused') && !stageInView && !isCinema();
    nowPlaying.hidden = !active;
    nowPlaying.classList.toggle('is-paused', state !== 'playing');
    if (active) {
      nowPlaying.setAttribute('aria-label', (state === 'playing' ? 'Tráiler en curso' : 'Tráiler en pausa') + '. Volver al tráiler');
    }
  }

  function setupMediaSession() {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: 'Tráiler',
        artist: 'Guardianes del Viento',
        artwork: [{ src: T.poster, type: 'image/webp', sizes: '1100x619' }],
      });
      navigator.mediaSession.setActionHandler('play', function () { play(); });
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('seekbackward', function () { if (media) seek(media.currentTime - SEEK_STEP); });
      navigator.mediaSession.setActionHandler('seekforward', function () { if (media) seek(media.currentTime + SEEK_STEP); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { if (media) seek(scenes[Math.max(0, current - 1)].start); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { if (media) seek(scenes[Math.min(scenes.length - 1, current + 1)].start); });
    } catch (e) { /* acción no admitida por este navegador */ }
  }

  /* --- Eventos ----------------------------------------------------------------- */
  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var inside = player.contains(e.target);
    if (!isCinema() && !inside) return;
    var tag = e.target.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target !== scrubInput)) return;
    var key = e.key;
    var onButton = tag === 'BUTTON' || tag === 'A';
    // Escape va primero: tiene que sacar del modo cine aunque el tráiler no haya arrancado
    if (key === 'Escape') {
      if (isCinema() && !doc.fullscreenElement) {
        e.preventDefault();
        exitCinema();
      }
      return;
    }
    if (state === 'idle' || state === 'soon') return;
    if ((key === ' ' || key === 'Enter') && onButton) return;

    var handled = true;
    if (key === ' ' || key === 'k' || key === 'K') toggle();
    else if (key === 'ArrowLeft') seek(media.currentTime - SEEK_STEP);
    else if (key === 'ArrowRight') seek(media.currentTime + SEEK_STEP);
    else if (key === 'ArrowUp') media.volume = clamp(media.volume + 0.1, 0, 1);
    else if (key === 'ArrowDown') media.volume = clamp(media.volume - 0.1, 0, 1);
    else if (key === 'm' || key === 'M') media.muted = !media.muted;
    else if ((key === 'c' || key === 'C') && cues.length) toggleCc();
    else if (key === 'f' || key === 'F') toggleFullscreen();
    else if (key === 'Home') seek(0);
    else if (key >= '1' && key <= '9' && scenes[+key - 1]) seek(scenes[+key - 1].start);
    else handled = false;

    if (handled) {
      e.preventDefault();
      pokeUi();
    }
  }

  function toggleCc() {
    prefs.cc = !prefs.cc;
    savePrefs();
    syncCc();
    if (media) paintCaption(media.currentTime);
  }

  function bind() {
    // Cualquier «ver el tráiler» de la página: reproduce en modo cine, sin mover el scroll
    doc.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-trailer-play]');
      if (trigger) {
        if (state === 'soon') return;
        e.preventDefault();
        var inside = player.contains(trigger);
        if (state === 'playing' && !inside) { enterCinema(); return; }
        play();
        enterCinema();
        return;
      }
      if (e.target.closest('[data-trailer-replay]')) {
        play(0);
        return;
      }
      // «Conocer el proyecto»: sale del modo cine y deja que el enlace haga su salto
      if (e.target.closest('[data-trailer-exit]')) exitCinema();
    });

    // En táctil el primer toque solo muestra los controles. Hay que mirar si estaban
    // ocultos ANTES de que el propio toque los muestre: por eso este oyente va en fase
    // de captura (corre antes que el pokeUi del reproductor) y el clic solo lo consulta.
    var uiWasHidden = false;
    frame.addEventListener('pointerdown', function (e) {
      uiWasHidden = e.pointerType === 'touch' && state === 'playing' && !player.classList.contains('is-ui');
    }, true);
    frame.addEventListener('click', function (e) {
      if (state === 'idle' || state === 'soon' || state === 'ended') return;
      if (e.target.closest('button, a, input')) return;
      if (uiWasHidden) {
        uiWasHidden = false;
        pokeUi();
        return;
      }
      toggle();
    });
    frame.addEventListener('dblclick', function (e) {
      if (state === 'idle' || state === 'soon' || e.target.closest('button, a, input')) return;
      toggleFullscreen();
    });

    ctlPlay.addEventListener('click', toggle);
    ctlMute.addEventListener('click', function () {
      if (media) media.muted = !media.muted;
    });
    ctlCc.addEventListener('click', toggleCc);
    ctlCinema.addEventListener('click', function () {
      if (isCinema()) exitCinema();
      else enterCinema();
    });
    if (doc.fullscreenEnabled) ctlFull.addEventListener('click', toggleFullscreen);
    else ctlFull.hidden = true;

    scrubInput.addEventListener('input', function () {
      dragging = true;
      seek(parseFloat(scrubInput.value));
    });
    scrubInput.addEventListener('change', function () { dragging = false; });
    scrubInput.addEventListener('pointerup', function () { dragging = false; });

    chaptersList.addEventListener('click', function (e) {
      var btn = e.target.closest('.chapter');
      if (!btn || state === 'soon') return;
      var i = chapterEls.indexOf(btn);
      if (i < 0 || !scenes[i]) return;
      var wasIdle = state === 'idle';
      play(scenes[i].start + 0.01);
      if (wasIdle) enterCinema();
    });
    chaptersList.addEventListener('scroll', function () {
      var end = chaptersList.scrollLeft + chaptersList.clientWidth >= chaptersList.scrollWidth - 4;
      chaptersList.classList.toggle('is-end', end && chaptersList.scrollLeft > 4);
    }, { passive: true });

    ['pointermove', 'pointerdown', 'focusin'].forEach(function (type) {
      player.addEventListener(type, pokeUi, { passive: true });
    });
    player.addEventListener('keydown', trapFocus);
    doc.addEventListener('keydown', onKey);

    if (nowPlaying) {
      nowPlaying.addEventListener('click', function () {
        stage.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
        ctlPlay.focus({ preventScroll: true });
      });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        stageInView = entries[0].isIntersecting;
        updateNowPlaying();
      }, { threshold: 0.2 }).observe(frameWrap);
    }

    if (transcript && transcript.showModal) {
      var open = byId('transcriptOpen');
      var close = byId('transcriptClose');
      if (open) open.addEventListener('click', function () { transcript.showModal(); });
      if (close) close.addEventListener('click', function () { transcript.close(); });
      // Un clic en el velo (fuera de la tarjeta) también cierra
      transcript.addEventListener('click', function (e) {
        if (e.target === transcript) transcript.close();
      });
    } else if (byId('transcriptOpen')) {
      byId('transcriptOpen').hidden = true;
    }
  }

  /* --- Arranque ------------------------------------------------------------------ */
  function init() {
    mapScenes();
    buildWave();
    buildTicks();
    updateLabels();
    syncMute();
    syncCc();
    bind();

    if (!useVideo && !usePreview) {
      setState('soon');
      badge.hidden = false;
      badge.textContent = 'Próximamente · el video ocupará este lugar';
      return;
    }
    if (usePreview) badge.hidden = false;
    player.classList.add('is-ui');
    render(0);
  }

  init();

  // Para depurar desde la consola y para las pruebas automatizadas
  window.Trailer = {
    play: play,
    pause: pause,
    toggle: toggle,
    seek: seek,
    enterCinema: enterCinema,
    exitCinema: exitCinema,
    get state() { return state; },
    get time() { return media ? media.currentTime : 0; },
    get mode() { return useVideo ? 'video' : usePreview ? 'preview' : 'soon'; },
  };
})();
