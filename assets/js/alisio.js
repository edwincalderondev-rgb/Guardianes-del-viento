/* ==========================================================================
   ALISIO — asistente de preguntas de Guardianes del Viento
   --------------------------------------------------------------------------
   Sin API, sin IA y sin servidor: responde por coincidencia de palabras, todo
   en el navegador. Lo que sabe y cómo lo dice vive en alisio-kb.js
   (window.ALISIO_KB); este archivo solo ENTIENDE la pregunta y PINTA la
   respuesta. Para enseñarle algo nuevo no hace falta tocarlo.

   Cómo entiende una pregunta
     1. La normaliza: minúsculas, sin tildes ni signos.
     2. Lleva cada palabra a su forma conocida: sinónimo → término de la base,
        plural → singular, errata de una letra → palabra del vocabulario.
     3. Puntúa cada entrada: frase contenida (mucho), palabra clave y palabra
        del título (medio).
     4. Decide: puntaje alto, responde; medio, responde y ofrece alternativas;
        bajo, admite que no sabe y propone los temas más cercanos.
     La capa de charla (saludos, cortesía, «¿con quién hablo?») solo contesta
     cuando la base no reconoce un tema: nunca tapa una pregunta real.

   Integración (index.html no lleva marcado del chat: se construye aquí)
     window.Alisio = { open(), close(), toggle(), ask(texto), match(texto),
                       probe(texto), isOpen }      // isOpen es una propiedad
     [data-alisio-open]            abre el chat
     [data-alisio-ask="texto"]     lo abre y hace la pregunta
     href="#chat" / "#chat=texto"  lo mismo, también al cargar con ese hash
     Eventos en document: «alisio:open» y «alisio:close».
   ========================================================================== */
(function () {
  'use strict';

  const KB = window.ALISIO_KB;
  if (!KB || !Array.isArray(KB.entries) || document.getElementById('alisio')) return;

  /* La ruta de las imágenes sale de dónde vive este archivo, no de la página
     que lo carga: así el chat funciona igual en una subcarpeta de GitHub
     Pages que abierto como archivo local. */
  const SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  let ROTOR_URL = 'assets/img/alisio/rotor.webp';
  try {
    if (SCRIPT_SRC) ROTOR_URL = new URL('../img/alisio/rotor.webp', SCRIPT_SRC).href;
  } catch (err) { /* se queda la ruta relativa */ }

  const META = KB.meta || {};
  const VOICE = KB.persona || {};
  const SECTIONS = META.sections || {};
  const CATS = new Map((META.categories || []).map((c) => [c.id, c]));
  const BY_ID = new Map(KB.entries.map((e) => [e.id, e]));
  const TOTAL_Q = KB.entries.filter((e) => e.n).length;

  /* Pesos y umbrales. Una frase pesa más cuantas más palabras tiene: lo
     específico («cuánto cuesta el servicio») le gana a lo general («cuánto
     cuesta»). */
  const W = { EXACT: 80, PHRASE: 40, PHRASE_WORD: 14, KEY: 9, TITLE: 7, CONTEXT: 4 };
  const CONFIDENT = 50; // responde directo
  const MAYBE = 16;     // responde ofreciendo alternativas; por debajo, no sabe

  const LIST_VISIBLE = 5;  // preguntas a la vista en la lista de un tema
  const ANCHOR_PAD = 12;   // aire sobre la respuesta al anclarla
  const STORE_KEY = 'alisio-chat-v1';
  const SEEN_KEY = 'alisio-seen';
  const HINT_DELAY = 3500;

  const TEXT = {
    open: 'Pregunte a Alisio, asistente del proyecto',
    close: 'Cerrar el asistente Alisio',
    pill: 'Pregunte a Alisio',
    name: 'Alisio',
    role: 'Asistente del proyecto',
    reset: 'Reiniciar la conversación',
    closePanel: 'Cerrar el asistente',
    log: 'Conversación con Alisio',
    topics: 'Temas del proyecto',
    input: 'Escriba su pregunta para Alisio',
    placeholder: 'Escriba su pregunta…',
    send: 'Enviar la pregunta',
    foot: 'Las cifras son metas y supuestos de planeación, no resultados alcanzados.',
    see: 'Ver en la página',
    next: 'Puede seguir con',
    alt: 'Si no era eso, quizá buscaba',
    start: 'Para empezar',
    you: 'Usted pregunta: ',
    bot: 'Alisio responde: ',
    less: 'Ver menos'
  };

  /* ========================================================================
     1 · ENTENDER LA PREGUNTA
     ======================================================================== */

  /* «¿Cuánto CUESTA el piloto?» y «cuanto cuesta el piloto» deben ser la
     misma cadena. La ñ queda como n a propósito: se escribe «dueno» tanto
     como «dueño». */
  function normalize(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /* Palabras que no distinguen una pregunta de otra. Se descartan al puntuar
     palabra por palabra, NUNCA al buscar frases: «quién paga» sigue siendo una
     frase aunque «quién» esté aquí. */
  const STOP = new Set((
    'a al algo alguna algunas alguno algunos ante antes aqui asi cada como con contra cual cuales cuando ' +
    'cuanta cuantas cuanto cuantos de del desde donde e el ella ellas ello ellos en entre era eran eres es ' +
    'esa esas ese eso esos esta estan estar estas este esto estos fue fueron ha haber habia han hasta hay ' +
    'la las le les lo los mas me mi mis mucho muchos muy nada ni no nos nosotros o os otra otras otro otros ' +
    'para pero poco por porque pues que quien quienes se sea ser seria si sin sobre son su sus tal tambien ' +
    'tampoco tan tanto te tener tiene tienen ti toda todas todo todos tu tus un una uno unos usted ustedes ' +
    'va van y ya yo hola favor gracias buenas buenos dias tardes noches puede puedo pueden podria podrian ' +
    'quiero quisiera saber decir dice digame dime hace hacen hacer'
  ).split(' '));

  /* ¿Se diferencian en una sola letra (cambiada, sobrante o faltante) o en
     dos letras cruzadas? Es todo lo que hace falta para «riezgos» o
     «gobrenanza», y cuesta mucho menos que una distancia de edición general:
     se descartan el prefijo y el sufijo comunes y se mira lo que queda. */
  function within1(a, b) {
    if (a === b) return true;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0;
    while (i < la && i < lb && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    let ea = la - 1;
    let eb = lb - 1;
    while (ea >= i && eb >= i && a.charCodeAt(ea) === b.charCodeAt(eb)) { ea--; eb--; }
    const ra = ea - i + 1;
    const rb = eb - i + 1;
    if (ra <= 1 && rb <= 1) return true;
    return ra === 2 && rb === 2 && a[i] === b[i + 1] && a[i + 1] === b[i];
  }

  /* El índice se arma la primera vez que hace falta (al abrir el chat o al
     consultar la API), no al cargar la página. */
  let engine = null;
  const brain = () => engine || (engine = buildEngine());

  function buildEngine() {
    const words = (text) => { const n = normalize(text); return n ? n.split(' ') : []; };
    const hasDigit = (w) => /\d/.test(w);
    const content = (w) => !STOP.has(w) && (w.length > 1 || hasDigit(w));

    /* Sinónimo → término de la base. Solo palabras sueltas: se compara
       palabra por palabra, así que un valor con espacios no coincidiría. */
    const canonOf = new Map();
    Object.keys(KB.synonyms || {}).forEach((head) => {
      const h = normalize(head);
      KB.synonyms[head].forEach((variant) => {
        const v = normalize(variant);
        if (v && v !== h && v.indexOf(' ') === -1) canonOf.set(v, h);
      });
    });

    /* Vocabulario: toda palabra con significado que la base usa. Es la
       referencia para plurales y erratas. */
    const vocab = new Set();
    const learn = (text) => words(text).forEach((w) => { if (content(w)) vocab.add(w); });
    KB.entries.forEach((e) => {
      [e.k, e.title, e.ask, e.q].forEach(learn);
      (e.p || []).forEach(learn);
    });
    canonOf.forEach((h, v) => { vocab.add(v); vocab.add(h); });

    /* Plural → singular, solo cuando la base usa las dos formas. Con el
       diccionario delante no hay que adivinar si «clientes» pierde «s» o
       «es»: se prueba cuál existe. */
    const fold = new Map();
    vocab.forEach((w) => {
      if (w.length < 4 || hasDigit(w)) return;
      if (w.endsWith('s') && vocab.has(w.slice(0, -1))) fold.set(w, w.slice(0, -1));
      else if (w.endsWith('es') && vocab.has(w.slice(0, -2))) fold.set(w, w.slice(0, -2));
    });

    const canon = (w) => {
      if (canonOf.has(w)) return canonOf.get(w);
      const single = fold.get(w);
      return single ? (canonOf.get(single) || single) : w;
    };

    /* Solo se corrigen palabras de cinco letras o más: en las cortas una
       letra cambia el significado y corregir haría más daño que bien. */
    const longVocab = Array.from(vocab).filter((w) => w.length >= 5 && !hasDigit(w));
    const cache = new Map();

    function nearest(w) {
      const forms = [w];
      if (w.endsWith('s')) forms.push(w.slice(0, -1));
      if (w.endsWith('es')) forms.push(w.slice(0, -2));
      const plural = [w + 's', w + 'es'].concat(forms.slice(1));
      for (const f of plural) if (f.length > 2 && vocab.has(f)) return f;
      for (const f of forms) {
        if (f.length < 5) continue;
        let other = '';
        for (const v of longVocab) {
          if (!within1(v, f)) continue;
          if (v[0] === f[0]) return v;
          other = other || v;
        }
        if (other) return other;
      }
      return '';
    }

    /* Palabra escrita → palabra con la que la base la conoce. */
    function resolve(w) {
      if (STOP.has(w)) return w;
      if (vocab.has(w)) return canon(w);
      let known = cache.get(w);
      if (known === undefined) {
        const near = w.length < 3 || hasDigit(w) ? '' : nearest(w);
        known = near ? canon(near) : w;
        if (cache.size > 400) cache.clear();
        cache.set(w, known);
      }
      return known;
    }

    const index = KB.entries.map((e) => {
      const phrases = [];
      const exact = new Set();
      const seen = new Set();
      const add = (source) => {
        const ws = words(source);
        if (!ws.length) return;
        const raw = ws.join(' ');
        const can = ws.map(canon).join(' ');
        if (/^\s*=/.test(source)) { exact.add(raw); exact.add(can); return; }
        if (seen.has(can)) return;
        seen.add(can);
        phrases.push({ raw: ' ' + raw + ' ', can: ' ' + can + ' ', pts: W.PHRASE + W.PHRASE_WORD * ws.length });
      };
      (e.p || []).forEach(add);
      if (e.ask) add(e.ask);
      if (e.q) add(e.q);
      /* De la más larga a la más corta: al puntuar, una frase contenida en
         otra que ya contó no vuelve a sumar. */
      phrases.sort((a, b) => b.can.length - a.can.length);
      const bag = (text) => new Set(words(text).filter(content).map(canon));
      return { e, phrases, exact, keys: bag(e.k), title: bag(e.title) };
    });

    /* La pregunta se prepara una sola vez para todas las comparaciones. */
    function prepare(text) {
      const ws = words(text);
      const cs = ws.map(resolve);
      const toks = [];
      cs.forEach((c, i) => { if (content(ws[i]) && toks.indexOf(c) === -1) toks.push(c); });
      const norm = ws.join(' ');
      const can = cs.join(' ');
      return { norm, can, raw: ' ' + norm + ' ', pad: ' ' + can + ' ', toks };
    }

    function score(item, q, last) {
      let s = 0;
      if (item.exact.size && (item.exact.has(q.norm) || item.exact.has(q.can))) s += W.EXACT;

      /* La frase se busca en lo que se escribió y en su versión corregida:
         sin lo segundo, «cuanto bale el piloto» perdería la frase entera por
         una letra. */
      const hits = [];
      for (const ph of item.phrases) {
        if (q.raw.indexOf(ph.raw) === -1 && q.pad.indexOf(ph.can) === -1) continue;
        if (hits.some((h) => h.indexOf(ph.can) !== -1)) continue;
        hits.push(ph.can);
        s += ph.pts;
      }

      for (const t of q.toks) {
        if (item.keys.has(t)) s += W.KEY;
        if (item.title.has(t)) s += W.TITLE;
      }

      /* Continuidad: ante un empate se sigue en el tema de la conversación.
         Solo desempata; nunca crea una coincidencia donde no la había. */
      if (s > 0 && last) {
        if (item.e.id === last.id) s += W.CONTEXT / 2;
        else if (item.e.cat === last.cat) s += W.CONTEXT;
      }
      return s;
    }

    function search(text, last) {
      const q = prepare(text);
      const out = [];
      for (const item of index) {
        const s = score(item, q, last);
        if (s > 0) out.push({ entry: item.e, score: s });
      }
      return out.sort((a, b) => b.score - a.score);
    }

    /* Las expresiones de la charla son texto en la base: se compilan aquí,
       una sola vez. */
    const chat = (KB.smalltalk || []).map((rule) => ({ rule, re: new RegExp(rule.re) }));

    return { search, chat };
  }

  /* ========================================================================
     2 · CONVERSAR
     ======================================================================== */

  /* Contestar siempre con las mismas palabras es lo primero que delata a una
     máquina: donde la base trae varias versiones se rota, sin repetir la que
     se acaba de usar. */
  const lastPick = Object.create(null);
  function pick(value, slot) {
    if (!Array.isArray(value)) return value || '';
    if (value.length < 2) return value[0] || '';
    let i;
    let tries = 0;
    do { i = Math.floor(Math.random() * value.length); } while (i === lastPick[slot] && ++tries < 6);
    lastPick[slot] = i;
    return value[i];
  }

  const two = (n) => (n < 10 ? '0' : '') + n;

  /* Hora REAL de quien escribe: un «buenos días» a las once de la noche rompe
     la conversación antes de empezarla. */
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches');
  }

  function fill(html, values) {
    return html.replace(/\{(saludo|hora|fecha|tema|q)\}/g, (all, key) => {
      const now = new Date();
      if (key === 'saludo') return greeting();
      if (key === 'hora') return two(now.getHours()) + ':' + two(now.getMinutes());
      if (key === 'fecha') {
        return now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
      return esc((values && values[key]) || (key === 'tema' ? 'ese tema' : ''));
    });
  }

  /* Qué regla de charla contesta, si alguna. «top» es lo que puntuó el mejor
     tema para esta misma pregunta, y es lo que impide que la cortesía tape el
     dato: una regla normal solo gana si la base no está segura; una weak,
     solo si la base no reconoció nada; una force, siempre. */
  function matchChat(text, top) {
    const norm = normalize(text);
    const count = norm ? norm.split(' ').length : 0;
    for (const { rule, re } of brain().chat) {
      if (!rule.force && top >= (rule.weak ? MAYBE : CONFIDENT)) continue;
      if (rule.max && count > rule.max) continue;
      if (rule.ctx && !last) continue;
      if (re.test(norm)) return rule;
    }
    return null;
  }

  /* Fórmulas con las que se ENVUELVE una pregunta de verdad («¿me podría
     decir…?»). Si la base sabe la respuesta se da el dato; abrirlo con un
     «con gusto» hace que se lea como respuesta y no como resultado de un
     buscador. */
  const COURTESY = /\b(puede|podria|podrian|puedes|podrias|por favor|me dice|me dices|digame|me explica|expliqueme|quisiera|me gustaria|seria tan amable)\b/;
  const courtesy = (text) => (COURTESY.test(normalize(text)) ? pick(VOICE.leads, 'lead') : '');

  /* ========================================================================
     3 · INTERFAZ
     ======================================================================== */

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const ICONS = {
    close: 'M6 6l12 12M18 6 6 18',
    reset: 'M4 12a8 8 0 1 0 2.5-5.8M4 4.5v4.6h4.6',
    send: 'M12 19V5.5M5.8 11.2 12 5l6.2 6.2',
    go: 'M5 12h14M13.5 6.5 19 12l-5.5 5.5',
    down: 'M12 5v14M6.5 13.5 12 19l5.5-5.5',
    chevron: 'M6 9.5l6 6 6-6'
  };
  const icon = (name, size) =>
    '<svg class="al-ico" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
    '" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"' +
    ' aria-hidden="true" focusable="false"><path d="' + ICONS[name] + '"/></svg>';

  /* El avatar es un aerogenerador: cielo, torre y rotor. El rotor es una foto
     de campo recortada; mientras llega —o si no llega— gira el de tres aspas
     dibujado aquí. Las dos capas (.al-rotor y .al-rotor-boost) permiten
     acelerar el giro mientras Alisio «escribe» sin que el ángulo salte: la de
     dentro suma su propia vuelta y, al terminar, se detiene donde esté. */
  const BLADE = 'M-1.7-4C-5.2-13-4.3-27-.8-46.4c.4-1.5 1.7-1.3 1.9.3C2.7-30 3.5-14 2-4Z';
  const ROTOR_DRAWN =
    '<svg class="al-rotor-draw" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">' +
    [0, 120, 240].map((deg) => '<path transform="rotate(' + deg + ')" d="' + BLADE + '"/>').join('') +
    '<circle r="4.4"/></svg>';
  let rotorFailed = false;
  const avatar = (size) =>
    '<span class="al-avatar al-avatar--' + size + '" aria-hidden="true"><span class="al-tower"></span>' +
    '<span class="al-rotor"><span class="al-rotor-boost">' + ROTOR_DRAWN +
    (rotorFailed ? '' : '<img class="al-rotor-img" src="' + esc(ROTOR_URL) + '" alt="" decoding="async" draggable="false">') +
    '</span></span></span>';

  const root = document.createElement('div');
  root.id = 'alisio';
  root.setAttribute('data-tone', 'dark');
  root.innerHTML =
    '<section class="al-panel" id="alisio-panel" role="dialog" aria-modal="false" aria-labelledby="alisio-title" tabindex="-1" inert>' +
      '<header class="al-head">' + avatar('md') +
        '<div class="al-id"><h2 class="al-name" id="alisio-title">' + TEXT.name + '</h2><p class="al-role">' + TEXT.role + '</p></div>' +
        '<button class="al-btn" type="button" data-al="reset" aria-label="' + TEXT.reset + '" title="' + TEXT.reset + '">' + icon('reset') + '</button>' +
        '<button class="al-btn" type="button" data-al="close" aria-label="' + TEXT.closePanel + '" title="' + TEXT.closePanel + '">' + icon('close') + '</button>' +
      '</header>' +
      '<div class="al-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="' + TEXT.log + '" tabindex="0"></div>' +
      '<div class="al-topics" role="group" aria-label="' + TEXT.topics + '"></div>' +
      '<form class="al-form" novalidate>' +
        '<label class="al-sr" for="alisio-input">' + TEXT.input + '</label>' +
        '<input class="al-input" id="alisio-input" type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" maxlength="240" placeholder="' + TEXT.placeholder + '">' +
        '<button class="al-send" type="submit" aria-label="' + TEXT.send + '">' + icon('send', 20) + '</button>' +
      '</form>' +
      '<p class="al-foot">' + TEXT.foot + '</p>' +
    '</section>' +
    '<button class="al-launcher" type="button" aria-haspopup="dialog" aria-controls="alisio-panel" aria-expanded="false" aria-label="' + TEXT.open + '">' +
      '<span class="al-pill"><span>' + TEXT.pill + '</span></span>' +
      '<span class="al-face">' + avatar('lg') + '<span class="al-face-close">' + icon('chevron', 22) + '</span></span>' +
    '</button>';

  const panel = root.querySelector('.al-panel');
  const launcher = root.querySelector('.al-launcher');
  const log = root.querySelector('.al-log');
  const topics = root.querySelector('.al-topics');
  const form = root.querySelector('.al-form');
  const input = root.querySelector('.al-input');

  /* La fila de temas: la entrada destacada y los bloques del documento. */
  (function buildTopics() {
    const featured = BY_ID.get(META.featured);
    let html = featured
      ? '<button class="al-chip al-chip--key" type="button" data-al-entry="' + esc(featured.id) + '">' + esc(featured.title) + '</button>'
      : '';
    CATS.forEach((cat) => {
      if (cat.menu === false) return;
      html += '<button class="al-chip" type="button" data-al-cat="' + esc(cat.id) + '" title="' + esc(cat.label) + '">' +
        esc(cat.short || cat.label) + '</button>';
    });
    topics.innerHTML = html;
  })();

  document.body.appendChild(root);

  /* ---------- Estado ---------- */
  let opened = false;
  let busy = false;
  let last = null;        // última entrada respondida: contexto de la conversación
  let timer = 0;          // respuesta en camino
  let queued = '';        // pregunta que llegó desde la página mientras respondía
  let opener = null;      // a quién devolver el foco al cerrar
  const sent = [];        // lo escrito, para recuperarlo con la flecha ↑
  let sentAt = 0;

  const mqSheet = window.matchMedia('(max-width: 560px)');
  const mqCalm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isSheet = () => mqSheet.matches;
  const calm = () => mqCalm.matches;

  const store = {
    get(key) { try { return window.sessionStorage.getItem(key); } catch (err) { return null; } },
    set(key, value) { try { window.sessionStorage.setItem(key, value); } catch (err) { /* modo privado: sin persistencia */ } },
    del(key) { try { window.sessionStorage.removeItem(key); } catch (err) { /* ídem */ } }
  };

  /* ---------- Piezas de una respuesta ---------- */

  function entriesOf(ids) {
    const seen = new Set();
    const out = [];
    (ids || []).forEach((id) => {
      const e = typeof id === 'string' ? BY_ID.get(id) : id;
      if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
    });
    return out;
  }

  const moreLabel = (n) => 'Ver ' + n + (n === 1 ? ' pregunta más' : ' preguntas más');

  /* Lista de preguntas pulsables. Lo que no cabe queda plegado tras un «Ver N
     más»; el estado viaja en el atributo hidden, así que se guarda y se
     restaura con la conversación sin código aparte. */
  function listHTML(label, entries, visible) {
    if (!entries.length) return '';
    const extra = entries.length - visible;
    return '<div class="al-list">' +
      (label ? '<p class="al-label">' + esc(label) + '</p>' : '') +
      entries.map((e, i) =>
        '<button class="al-sug" type="button" data-al-entry="' + esc(e.id) + '"' + (i >= visible ? ' data-al-extra hidden' : '') + '>' +
        '<span>' + esc(e.ask || e.title) + '</span>' + icon('go', 14) + '</button>').join('') +
      (extra > 0
        ? '<button class="al-more" type="button" data-al-more="' + extra + '" aria-expanded="false">' + moreLabel(extra) + '</button>'
        : '') +
      '</div>';
  }

  /* Enlaces a las secciones de la página. Un ancla que no exista aquí no se
     pinta: mejor ningún enlace que uno que no lleva a ninguna parte. */
  function seeHTML(ids) {
    const found = (ids || []).filter((id) => SECTIONS[id] && document.getElementById(id));
    if (!found.length) return '';
    return '<div class="al-see"><p class="al-label">' + TEXT.see + '</p><div class="al-links">' +
      found.map((id) => '<a class="al-link" href="#' + esc(id) + '">' + esc(SECTIONS[id]) + icon('down', 13) + '</a>').join('') +
      '</div></div>';
  }

  function eyebrow(entry) {
    const cat = CATS.get(entry.cat);
    const where = cat ? (cat.short || cat.label) : '';
    return entry.n ? 'Pregunta ' + entry.n + ' de ' + TOTAL_Q + (where ? ' · ' + where : '') : where;
  }

  function entryHTML(entry, opts) {
    const o = opts || {};
    const alts = o.alts || [];
    const follow = entriesOf((o.also || []).concat(entry.next || [])).filter((e) => e.id !== entry.id).slice(0, 3);
    return (o.hedge ? '<p class="al-hedge">' + esc(o.hedge) + '</p>' : '') +
      (o.lead ? '<p class="al-hedge">' + esc(o.lead) + '</p>' : '') +
      '<p class="al-eyebrow">' + esc(eyebrow(entry)) + '</p>' +
      '<h3 class="al-title">' + esc(entry.title) + '</h3>' +
      '<div class="al-body">' + entry.a + '</div>' +
      seeHTML(entry.see) +
      (alts.length ? listHTML(TEXT.alt, alts, alts.length) : listHTML(TEXT.next, follow, follow.length));
  }

  /* ---------- Registro ---------- */

  function addMessage(kind, html) {
    const node = document.createElement(kind === 'bot' ? 'article' : 'div');
    node.className = 'al-msg al-msg--' + kind + ' al-new';
    node.innerHTML = html;
    log.appendChild(node);
    return node;
  }

  const addUser = (text) => addMessage('user', '<span class="al-sr">' + TEXT.you + '</span>' + esc(text));
  const addBot = (html) => addMessage('bot', '<span class="al-sr">' + TEXT.bot + '</span>' + html);

  function scrollLog(top, instant) {
    const y = Math.max(0, Math.min(top, log.scrollHeight - log.clientHeight));
    if (instant || calm()) log.scrollTop = y;
    else log.scrollTo({ top: y, behavior: 'smooth' });
  }

  /* requestAnimationFrame: la medida se toma una sola vez, cuando el
     navegador ya maquetó lo recién insertado. */
  const toBottom = () => requestAnimationFrame(() => scrollLog(log.scrollHeight));

  /* Deja arriba la PRIMERA línea de la respuesta en vez de bajar al final:
     una respuesta más alta que el panel se leería al revés. Si lo que queda
     por debajo sí cabe, el tope de scrollLog hace lo de siempre (ir al
     fondo). Se mide con offsetTop —posición de maquetación— porque el mensaje
     entra con una animación de transform y su rectángulo mentiría mientras
     dura; por eso .al-log es position: relative. */
  const toMessage = (node, instant) => requestAnimationFrame(() => scrollLog(node.offsetTop - ANCHOR_PAD, instant));

  function toLastAnswer() {
    const bots = log.querySelectorAll('.al-msg--bot');
    if (bots.length) toMessage(bots[bots.length - 1], true);
  }

  function setBusy(on) {
    busy = on;
    root.classList.toggle('al-busy', on);
    log.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  /* La pausa antes de responder es deliberada: una respuesta instantánea se
     lee como un fallo de la página. Corta, proporcional al texto y nula si
     se pidió menos movimiento. */
  function thinkTime(html) {
    if (calm()) return 0;
    return Math.min(900, 340 + html.replace(/<[^>]+>/g, '').length * 1.1);
  }

  function reply(html) {
    setBusy(true);
    const typing = addMessage('typing', '<span class="al-dots"><i></i><i></i><i></i></span>');
    typing.setAttribute('aria-hidden', 'true');
    toBottom();
    timer = window.setTimeout(() => {
      timer = 0;
      typing.remove();
      const node = addBot(html);
      setBusy(false);
      toMessage(node);
      save();
      if (queued) { const next = queued; queued = ''; ask(next); }
    }, thinkTime(html));
  }

  /* ---------- Respuestas ---------- */

  function respondEntry(entry, opts) {
    last = entry;
    reply(entryHTML(entry, opts));
  }

  function respondChat(rule) {
    const fromLast = rule.ctx && last;
    const html = fill(pick(rule.a, 'chat-' + rule.id), { tema: last ? last.title : '' });
    const follow = entriesOf(rule.next || (fromLast ? last.next : [])).slice(0, 3);
    reply('<div class="al-body">' + html + '</div>' +
      seeHTML(rule.see || (fromLast ? last.see : null)) +
      listHTML(follow.length ? TEXT.next : '', follow, follow.length));
  }

  /* No sabe: lo admite, propone lo que más se le pareció —si la base rozó
     algo— y remite a la página. No hay un asesor al que derivar. */
  function respondUnknown(text, results) {
    const near = results.filter((r) => r.score >= MAYBE / 2).slice(0, 3).map((r) => r.entry);
    const picks = near.length >= 2 ? near : entriesOf(near.concat(entriesOf(VOICE.fallback))).slice(0, 4);
    const lead = fill(pick(VOICE.unknown, 'unknown'), { q: text.length > 60 ? text.slice(0, 60) + '…' : text });
    reply('<div class="al-body"><p>' + lead + '</p><p>' + esc(near.length >= 2 ? VOICE.unknownNear : VOICE.unknownFar) + '</p></div>' +
      listHTML('', picks, picks.length) +
      '<p class="al-note">' + esc(VOICE.unknownNote || '') + '</p>' +
      seeHTML(VOICE.unknownSee));
  }

  function ask(text) {
    text = String(text == null ? '' : text).trim().slice(0, 240);
    if (!text) return false;
    if (busy) return false;

    addUser(text);
    const results = brain().search(text, last);
    const top = results.length ? results[0].score : 0;

    const rule = matchChat(text, top);
    if (rule) { respondChat(rule); return true; }
    if (top < MAYBE) { respondUnknown(text, results); return true; }

    const best = results[0];
    if (best.score >= CONFIDENT) {
      /* Si otra entrada también respondía con seguridad, se ofrece primera
         entre las sugerencias: la pregunta admitía las dos lecturas. */
      const second = results[1];
      const also = second && second.score >= CONFIDENT && second.score >= best.score * 0.6 ? [second.entry.id] : [];
      respondEntry(best.entry, { lead: courtesy(text), also });
    } else {
      const alts = results.slice(1, 4).filter((r) => r.score >= best.score * 0.45).map((r) => r.entry);
      respondEntry(best.entry, { hedge: pick(VOICE.hedges, 'hedge'), alts });
    }
    return true;
  }

  /* Un botón de sugerencia no pasa por el buscador: ya se sabe qué entrada
     es. La pregunta queda escrita como si la persona la hubiera hecho. */
  function pickEntry(id) {
    const entry = BY_ID.get(id);
    if (!entry || busy) return;
    addUser(entry.ask || entry.title);
    respondEntry(entry);
  }

  /* Pulsar un tema no «responde» nada: lista sus preguntas. Primero las del
     documento fuente; las de apoyo quedan plegadas. */
  function openCategory(id) {
    const cat = CATS.get(id);
    if (!cat || busy) return;
    const entries = KB.entries.filter((e) => e.cat === id);
    const name = cat.label.charAt(0).toLowerCase() + cat.label.slice(1);
    addUser(cat.label);
    reply('<div class="al-body"><p>Sobre <strong>' + esc(name) + '</strong> puedo responderle esto:</p></div>' +
      listHTML('', entries, LIST_VISIBLE));
  }

  function welcome() {
    const starters = entriesOf(VOICE.starters);
    addBot('<div class="al-body">' + fill(VOICE.welcome || '') + '</div>' + listHTML(TEXT.start, starters, starters.length));
    log.scrollTop = 0;
  }

  /* ---------- Persistencia ----------
     sessionStorage y no localStorage: la conversación sobrevive a una recarga
     en la misma pestaña, y al cerrarla se empieza de cero. */
  function save() {
    store.set(STORE_KEY, JSON.stringify({
      kb: META.version,
      html: log.innerHTML.replace(/(class="al-msg[^"]*?) al-new/g, '$1'),
      last: last ? last.id : null
    }));
  }

  function restore() {
    const raw = store.get(STORE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      /* Una conversación guardada con otra versión de la base puede traer
         botones de entradas que ya no existen: se descarta. */
      if (!data || data.kb !== META.version || typeof data.html !== 'string' || !data.html) return false;
      log.innerHTML = data.html;
      last = BY_ID.get(data.last) || null;
      return true;
    } catch (err) {
      return false;
    }
  }

  function reset() {
    window.clearTimeout(timer);
    timer = 0;
    queued = '';
    setBusy(false);
    last = null;
    log.textContent = '';
    store.del(STORE_KEY);
    welcome();
    input.value = '';
    if (!isSheet()) input.focus({ preventScroll: true });
  }

  /* ========================================================================
     4 · ABRIR, CERRAR Y LA HOJA DEL CELULAR
     ======================================================================== */

  const emit = (name) => document.dispatchEvent(new CustomEvent(name));

  /* En celular el panel es una hoja a pantalla completa: se comporta como un
     diálogo modal (foco atrapado, fondo sin desplazamiento) y se ajusta al
     área visible real, que encoge cuando aparece el teclado. En escritorio
     nada de esto aplica: la página sigue siendo usable con el chat abierto. */
  let lockedOverflow = null;
  let tracking = false;
  let viewportFrame = 0;

  function syncViewport() {
    viewportFrame = 0;
    const vv = window.visualViewport;
    /* Con zoom de pellizco el área visible ya no es la pantalla: no se toca. */
    if (!vv || vv.scale > 1.01) {
      root.style.removeProperty('--al-vh');
      root.style.removeProperty('--al-vt');
      return;
    }
    root.style.setProperty('--al-vh', vv.height + 'px');
    root.style.setProperty('--al-vt', vv.offsetTop + 'px');
  }

  function onViewport() {
    if (!viewportFrame) viewportFrame = requestAnimationFrame(syncViewport);
  }

  function applySheet() {
    const sheet = opened && isSheet();
    panel.setAttribute('aria-modal', sheet ? 'true' : 'false');

    const de = document.documentElement;
    if (sheet && lockedOverflow === null) {
      lockedOverflow = de.style.overflow;
      de.style.overflow = 'hidden';
    } else if (!sheet && lockedOverflow !== null) {
      de.style.overflow = lockedOverflow;
      lockedOverflow = null;
    }

    const vv = window.visualViewport;
    if (!vv || sheet === tracking) return;
    tracking = sheet;
    if (sheet) {
      vv.addEventListener('resize', onViewport);
      vv.addEventListener('scroll', onViewport);
      syncViewport();
    } else {
      vv.removeEventListener('resize', onViewport);
      vv.removeEventListener('scroll', onViewport);
      cancelAnimationFrame(viewportFrame);
      viewportFrame = 0;
      root.style.removeProperty('--al-vh');
      root.style.removeProperty('--al-vt');
    }
  }

  function open(opts) {
    if (opened) return;
    opened = true;
    const active = document.activeElement;
    opener = active && active !== document.body && !root.contains(active) ? active : launcher;

    hideHint();
    store.set(SEEN_KEY, '1');
    root.classList.add('al-open');
    panel.removeAttribute('inert');
    launcher.setAttribute('aria-expanded', 'true');
    launcher.setAttribute('aria-label', TEXT.close);

    const fresh = !log.firstChild && !restore();
    if (fresh) welcome();
    applySheet();

    /* En celular no se enfoca el campo: abriría el teclado y taparía media
       conversación antes de haberla leído. */
    if (!opts || opts.focus !== false) (isSheet() ? panel : input).focus({ preventScroll: true });
    if (!fresh) toLastAnswer();
    emit('alisio:open');
  }

  function close(opts) {
    if (!opened) return;
    opened = false;
    root.classList.remove('al-open');
    panel.setAttribute('inert', '');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-label', TEXT.open);
    applySheet();

    if (!opts || opts.focus !== false) {
      const back = opener && opener.isConnected ? opener : launcher;
      back.focus({ preventScroll: true });
    }
    opener = null;
    emit('alisio:close');
  }

  const toggle = () => (opened ? close() : open());

  /* Pregunta que llega desde la página (un botón, un enlace #chat=, la API).
     Si Alisio está respondiendo, espera su turno en vez de perderse. */
  function askFromPage(text) {
    text = String(text == null ? '' : text).trim();
    open();
    if (!text) return;
    if (busy) queued = text;
    else ask(text);
  }

  /* Enlace a una sección: en celular la hoja se cierra para dejar ver la
     página; el foco queda en la sección, que es donde continúa la lectura. */
  function goTo(target) {
    const behavior = calm() ? 'instant' : 'smooth';
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop);
    if (pad > 0 || margin > 0) {
      /* La página ya reserva el alto de su cabecera: se respeta su cuenta. */
      target.scrollIntoView({ behavior, block: 'start' });
    } else {
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - header - 16, behavior });
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  /* ---------- La pastilla del lanzador ----------
     Aparece sola a los pocos segundos y se recoge en cuanto la persona se
     desplaza: invita una vez, no insiste. Quien ya abrió el chat en esta
     pestaña no la vuelve a ver. */
  let hintTimer = 0;
  let hintFrom = 0;

  function onHintScroll() {
    if (Math.abs(window.scrollY - hintFrom) > 80) hideHint();
  }

  function hideHint() {
    window.clearTimeout(hintTimer);
    hintTimer = 0;
    launcher.classList.remove('al-hint');
    window.removeEventListener('scroll', onHintScroll);
  }

  if (!store.get(SEEN_KEY)) {
    hintTimer = window.setTimeout(() => {
      hintTimer = 0;
      if (opened) return;
      hintFrom = window.scrollY;
      launcher.classList.add('al-hint');
      window.addEventListener('scroll', onHintScroll, { passive: true });
    }, HINT_DELAY);
  }

  /* ========================================================================
     5 · EVENTOS
     Todo por delegación: la conversación restaurada es HTML sin oyentes
     propios y funciona igual que la recién escrita.
     ======================================================================== */

  launcher.addEventListener('click', toggle);

  panel.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-al]');
    if (!btn) return;
    if (btn.getAttribute('data-al') === 'close') close();
    else reset();
  });

  topics.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.al-chip');
    if (!chip) return;
    if (chip.hasAttribute('data-al-cat')) openCategory(chip.getAttribute('data-al-cat'));
    else pickEntry(chip.getAttribute('data-al-entry'));
  });

  log.addEventListener('click', (ev) => {
    const hit = ev.target.closest('a.al-link, [data-al-more], [data-al-entry]');
    if (!hit) return;

    if (hit.matches('a.al-link')) {
      const target = document.getElementById((hit.getAttribute('href') || '').slice(1));
      if (!target) return;
      ev.preventDefault();
      if (isSheet()) close({ focus: false });
      goTo(target);
      return;
    }

    if (hit.hasAttribute('data-al-more')) {
      const expanded = hit.getAttribute('aria-expanded') === 'true';
      hit.parentNode.querySelectorAll('[data-al-extra]').forEach((b) => { b.hidden = expanded; });
      hit.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      hit.textContent = expanded ? moreLabel(Number(hit.getAttribute('data-al-more')) || 0) : TEXT.less;
      save();
      return;
    }

    pickEntry(hit.getAttribute('data-al-entry'));
  });

  /* La clase de entrada se retira al terminar la animación: si quedara, un
     mensaje restaurado volvería a animarse. */
  log.addEventListener('animationend', (ev) => {
    if (ev.target.classList && ev.target.classList.contains('al-new')) ev.target.classList.remove('al-new');
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    /* Mientras responde no se envía ni se borra: lo escrito espera en el campo. */
    if (!text || busy) return;
    sent.push(text);
    sentAt = sent.length;
    input.value = '';
    ask(text);
  });

  /* Flecha ↑ / ↓: recupera lo ya preguntado, como en una terminal. */
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowUp' && sent.length && (!input.value || input.value === sent[sentAt])) {
      sentAt = Math.max(0, sentAt - 1);
      input.value = sent[sentAt];
      ev.preventDefault();
    } else if (ev.key === 'ArrowDown' && sentAt < sent.length && input.value === sent[sentAt]) {
      sentAt += 1;
      input.value = sent[sentAt] || '';
      ev.preventDefault();
    }
  });

  /* Teclado. El oyente vive en el propio widget, no en document: Esc solo
     cierra el chat cuando el foco está en él y no interfiere con el resto de
     la página. */
  root.addEventListener('keydown', (ev) => {
    if (!opened) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      close();
      return;
    }
    if (ev.key !== 'Tab' || !isSheet()) return;
    const stops = Array.prototype.filter.call(
      panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'),
      (el) => el.getClientRects().length > 0
    );
    if (!stops.length) return;
    const first = stops[0];
    const end = stops[stops.length - 1];
    const active = document.activeElement;
    if (ev.shiftKey && (active === first || active === panel)) { ev.preventDefault(); end.focus(); }
    else if (!ev.shiftKey && active === end) { ev.preventDefault(); first.focus(); }
  });

  /* load y error no burbujean; en fase de captura se oyen los de cualquier
     avatar. Si la foto del rotor carga, sustituye al dibujado; si falla, se
     retira y no se vuelve a pedir. */
  root.addEventListener('load', (ev) => {
    if (ev.target.classList && ev.target.classList.contains('al-rotor-img')) root.classList.add('al-has-rotor');
  }, true);
  root.addEventListener('error', (ev) => {
    if (!ev.target.classList || !ev.target.classList.contains('al-rotor-img')) return;
    rotorFailed = true;
    root.querySelectorAll('.al-rotor-img').forEach((img) => img.remove());
  }, true);

  /* Si la ventana cruza el ancho de celular con el chat abierto, la hoja y
     sus bloqueos se ponen o se quitan en el momento. */
  mqSheet.addEventListener('change', applySheet);

  /* ---------- Entradas desde la página ---------- */

  function chatLink(hash) {
    const m = /^#chat(?:=(.*))?$/.exec(hash || '');
    if (!m) return null;
    let text = m[1] || '';
    try { text = decodeURIComponent(text); } catch (err) { /* se usa tal cual */ }
    return { text };
  }

  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || !(ev.target instanceof Element)) return;
    const el = ev.target.closest('[data-alisio-ask], [data-alisio-open], a[href^="#chat"]');
    if (!el || root.contains(el)) return;

    let text = el.getAttribute('data-alisio-ask');
    if (text === null && !el.hasAttribute('data-alisio-open')) {
      const link = chatLink(el.getAttribute('href'));
      if (!link) return;
      text = link.text;
    }
    ev.preventDefault();
    askFromPage(text);
  });

  /* «chat» y no «alisio»: el contenedor tiene id="alisio" y con ese hash el
     navegador saltaría hasta él antes de que corra este código. */
  function fromHash() {
    const link = chatLink(window.location.hash);
    if (!link) return;
    /* Se limpia para que recargar no repita la pregunta. */
    try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); } catch (err) { /* archivo local estricto */ }
    askFromPage(link.text);
  }

  window.addEventListener('hashchange', fromHash);
  if (window.location.hash.indexOf('#chat') === 0) {
    if (document.readyState === 'complete') fromHash();
    else window.addEventListener('load', fromHash, { once: true });
  }

  /* ========================================================================
     6 · API PÚBLICA
     ======================================================================== */

  const view = (r) => ({ id: r.entry.id, title: r.entry.title, score: Math.round(r.score) });

  const api = {
    open: () => open(),
    close: () => close(),
    toggle,
    ask: askFromPage,

    /* Mantenimiento: ranking de entradas para una pregunta, con puntajes.
       Menos de 16 es «no sé»; menos de 50, responde ofreciendo alternativas. */
    match: (text) => brain().search(text, last).slice(0, 6).map(view),

    /* Igual, contando la capa de charla. Si «chat» trae un id, esa regla es
       la que contestaría y results[0] no se usa. */
    probe: (text) => {
      const results = brain().search(text, last);
      const top = results.length ? results[0].score : 0;
      const rule = matchChat(text, top);
      return { chat: rule ? rule.id : null, top: Math.round(top), results: results.slice(0, 5).map(view) };
    }
  };
  Object.defineProperty(api, 'isOpen', { enumerable: true, get: () => opened });
  window.Alisio = api;
})();
