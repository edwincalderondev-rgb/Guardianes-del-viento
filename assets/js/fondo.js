/* ==========================================================================
   GUARDIANES DEL VIENTO — fondo animado: «el viento sobre el territorio»

   Un solo canvas fijo detrás del contenido, con dos capas:
     · El territorio: las curvas de nivel de un relieve de dunas que deriva muy
       despacio (sombreador de fragmentos).
     · El viento: miles de partículas que entran por el nordeste, como los
       alisios, y dejan estelas al cruzar la pantalla; es un mapa de viento, la
       forma en que se dibuja el viento cuando se lo trata como dato. Se curvan
       en remolinos suaves y rodean el cursor.

   Es el marco de un video y de texto de lectura: todo aquí está pensado para
   no competir con ellos.

   API pública: window.Fondo = { supported, running, start(), stop(), set() }
   ========================================================================== */
(function () {
  'use strict';

  /* --- Presupuesto de render ------------------------------------------------
     Una deriva lenta no necesita ni la resolución ni la cadencia de la pantalla:
     se pinta a 3/4 de tamaño, con el devicePixelRatio acotado, a 30 cuadros. */
  var RENDER_SCALES = [0.75, 0.5];
  var DPR_CAP = 1.5;
  var MAX_PIXELS = 1600000;
  var FRAME_MS = 1000 / 30;

  /* La unidad del campo es el lado corto de la ventana, acotado: en el celular
     queda fija aunque la barra del navegador aparezca y desaparezca (el dibujo
     no cambia de escala al desplazarse) y en un monitor grande el relieve no
     crece hasta volverse un par de manchas. */
  var UNIT_MIN = 420;
  var UNIT_MAX = 1000;

  /* Constantes de tiempo (s) de cada transición: ningún valor salta. */
  var TAU_INTENSITY = 0.7;
  var TAU_SPEED = 0.9;
  var TAU_TINT = 1.2;
  var TAU_SCROLL = 0.4;
  var TAU_POINTER = 1.8;
  var TAU_TOUCH = 0.35;

  var CALM_SPEED = 0.05;      // fracción de la deriva que queda con calm:true
  var SCROLL_COOLING = 0.4;   // cuánto se enfría el tono entre el inicio y el pie

  /* --- El viento --------------------------------------------------------------
     Medidas en px CSS y segundos. La densidad es por área: la misma textura en
     un celular que en un monitor ancho. */
  var WIND_X = -0.8660254;    // el alisio llega del nordeste: en pantalla sopla
  var WIND_Y = 0.5;           // hacia la izquierda y hacia abajo
  var WIND_SPEED = 64;        // avance medio
  var WIND_SWIRL = 38;        // cuánto lo tuercen los remolinos: menos que el avance, para que
                              // ondule sin cerrarse en torbellinos (el alisio es un viento constante)
  var FIELD_SCALE = 1 / 520;  // tamaño de las ondulaciones
  var FIELD_DRIFT = 0.035;    // lo despacio que cambia el campo
  var PARTICLE_AREA = 520;    // px² por partícula
  var PARTICLE_MIN = 520;
  var PARTICLE_MAX = 3400;
  var LIFE_MIN = 4;
  var LIFE_MAX = 10;
  var TRAIL_FADE = 0.957;     // lo que queda de la estela en cada cuadro
  var EDGE = 40;              // margen fuera de pantalla antes de renacer
  var POINTER_RADIUS = 190;
  var POINTER_PUSH = 150;
  var PARALLAX = 0.08;        // cuánto acompaña el viento al desplazamiento de la página
  var PREWARM_STEPS = 80;     // cuadros simulados para el fondo fijo (movimiento reducido)

  /* Gobernador de calidad: si el equipo no sostiene ~22 cuadros por segundo
     (WebGL por software, gráfica muy modesta) se baja un escalón de resolución
     y, si tampoco alcanza, el fondo se queda en un cuadro fijo. */
  var PACE_WINDOW_MS = 2000;
  var PACE_SLOW_MS = 45;
  var PACE_IGNORE_MS = 250;

  /* Colores: se leen de tokens.css; el respaldo solo sirve si falta la hoja. */
  var PALETTE = [
    ['uNight', '--night', '#060f0c'],
    ['uBase', '--green-950', '#0a1915'],
    ['uLift', '--green-800', '#153229'],
    ['uGold', '--gold-400', '#e5ae42'],
    ['uSand', '--sand-300', '#e2d1b3'],
    ['uCool', '--green-300', '#86b7a5']
  ];

  var QUAD_VERTEX = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* --- Territorio + composición final ------------------------------------- */
  var SCENE_FRAGMENT = [
    'varying vec2 vUv;',
    'uniform vec2 uRes;',        // búfer, en px
    'uniform float uUnit;',      // px de búfer que mide una unidad del campo
    'uniform float uPx;',        // px de búfer por cada px CSS
    'uniform float uTime;',
    'uniform float uScroll;',
    'uniform vec2 uPointer;',
    'uniform float uIntensity;',
    'uniform float uWarmth;',
    'uniform sampler2D uTrail;', // las estelas del viento
    'uniform vec3 uNight;',
    'uniform vec3 uBase;',
    'uniform vec3 uLift;',
    'uniform vec3 uGold;',
    'uniform vec3 uSand;',
    'uniform vec3 uCool;',

    // El relieve usa el mismo viento que las partículas (aquí con la y hacia arriba).
    'const vec2 WIND = vec2(-0.8660254, -0.5);',
    'const vec2 CROSS = vec2(0.5, -0.8660254);',
    // Semilla fija: el mismo territorio en cada carga.
    'const vec2 SEED = vec2(37.2, 11.7);',
    'const float LEVELS = 18.0;',
    // Pendiente regional a favor del viento: ordena las curvas en frentes largos
    // y sinuosos, de borde a borde, en vez de islas sueltas.
    'const float TILT = 0.34;',
    'const float MASTER = 5.0;',

    // Hash sin senos: el de senos cambia de una gráfica a otra y en el celular
    // pierde precisión; este da el mismo dibujo en todas.
    'vec2 hash2(vec2 p) {',
    '  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));',
    '  q += dot(q, q.yzx + 33.33);',
    '  return fract((q.xx + q.yz) * q.zy);',
    '}',

    // Ruido de gradiente con interpolación quíntica: derivada continua, que es
    // lo que deja las curvas de nivel sin quiebres en los bordes de celda.
    'float gnoise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = p - i;',
    '  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);',
    '  float a = dot(hash2(i) - 0.5, f);',
    '  float b = dot(hash2(i + vec2(1.0, 0.0)) - 0.5, f - vec2(1.0, 0.0));',
    '  float c = dot(hash2(i + vec2(0.0, 1.0)) - 0.5, f - vec2(0.0, 1.0));',
    '  float d = dot(hash2(i + vec2(1.0, 1.0)) - 0.5, f - vec2(1.0, 1.0));',
    '  return 2.0 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',

    // Pocas octavas y ganancia baja: un relieve de dunas es suave; con más
    // detalle las curvas tiemblan y dejan de parecer un mapa.
    'float fbm(vec2 p) {',
    '  float s = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 3; i++) {',
    '    s += a * gnoise(p);',
    '    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;',
    '    a *= 0.36;',
    '  }',
    '  return s;',
    '}',

    // Cobertura de una curva de nivel a partir de la distancia en px, con el
    // borde suavizado por las derivadas de pantalla (sin dientes ni parpadeo).
    'float stroke(float dist, float halfWidth) {',
    '  return 1.0 - smoothstep(halfWidth - 0.75, halfWidth + 0.75, dist);',
    '}',

    'void main() {',
    // Origen arriba y al centro: si cambia el alto de la ventana (barra del
    // navegador en el celular) el dibujo no se corre.
    '  vec2 p = vec2(gl_FragCoord.x - 0.5 * uRes.x, gl_FragCoord.y - uRes.y) / uUnit;',
    '  vec2 travel = vec2(0.0, uScroll * 0.7) - uPointer * 0.012;',
    '  vec2 q = p - travel;',

    // Marco del viento, más apretado a favor que de través: las crestas quedan
    // alargadas y perpendiculares al alisio, como en un campo de dunas.
    '  vec2 w = vec2(dot(q, WIND), dot(q, CROSS));',
    '  vec2 f = w * vec2(1.3, 0.78) + SEED;',
    '  f.x -= uTime * 0.011;',
    // La deformación avanza a otro ritmo que el campo: por eso las curvas
    // cambian de forma al derivar en vez de deslizarse como un mapa rígido.
    '  vec2 warp = vec2(',
    '    gnoise(f * 0.6 + vec2(uTime * 0.007, 4.1)),',
    '    gnoise(f * 0.6 + vec2(-9.2, uTime * 0.006)));',
    '  float h = fbm(f + warp * 0.3);',
    '  float terrain = h + TILT * f.x;',

    '  float v = terrain * LEVELS;',
    '  float slope = max(length(vec2(dFdx(v), dFdy(v))), 1e-5);',   // niveles por px
    '  float minor = abs(fract(v - 0.5) - 0.5) / slope;',
    '  float major = abs(fract(v / MASTER - 0.5) - 0.5) * MASTER / slope;',
    // Donde el terreno se empina las curvas se apelmazarían: ahí se apagan.
    '  float airy = 1.0 - smoothstep(0.16, 0.34, slope);',
    '  float lineMinor = stroke(minor, 0.5 * uPx) * airy;',
    '  float lineMajor = stroke(major, 0.8 * uPx);',

    // Sol bajo, apenas fuera de la esquina por donde entra el viento.
    '  vec2 sun = vec2(0.5 * uRes.x / uUnit + 0.06, 0.1) + uPointer * 0.03;',
    '  float sunDist = length(p - sun);',
    '  float glow = exp(-sunDist * sunDist * 0.85);',
    '  float lit = mix(0.5, 1.0, exp(-sunDist * sunDist * 0.3));',
    '  float warm = clamp(uWarmth, 0.0, 1.0);',

    '  vec3 col = mix(uBase, uLift, smoothstep(-0.4, 0.5, h) * 0.5);',
    '  col += uGold * glow * 0.1 * uWarmth * mix(0.45, 1.0, uIntensity);',
    // Con el viento encima, el relieve baja un punto: es el suelo, no la figura.
    '  col = mix(col, mix(uCool, uSand, warm), lineMinor * 0.075 * lit * uIntensity);',
    '  col = mix(col, mix(uSand, uGold, warm), lineMajor * 0.14 * lit * uIntensity);',

    // El viento: la estela suma luz. Las estelas que se cruzan se encienden más,
    // por eso el tono va de arena a oro con la densidad.
    '  float trail = TEX(uTrail, vUv).r;',
    '  float dense = smoothstep(0.25, 0.9, trail);',
    '  vec3 windColor = mix(mix(uCool, uSand, 0.35 + 0.65 * warm), uGold, dense * (0.35 + 0.5 * warm));',
    '  col += windColor * trail * 0.46 * mix(0.7, 1.0, lit) * uIntensity;',

    '  vec2 e = gl_FragCoord.xy / uRes - 0.5;',
    '  float vignette = smoothstep(0.25, 1.0, dot(e, e) * 2.0) * (1.0 - glow * 0.8);',
    '  col = mix(col, uNight, vignette * 0.55);',

    // Tramado fijo de menos de un nivel: rompe las bandas de un degradado tan
    // oscuro sin moverse (un tramado animado se vería como grano que hierve).
    '  float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
    '  col += (grain - 0.5) / 255.0 * 1.5;',
    '  FRAG_COLOR = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* --- Estelas: lo del cuadro anterior, un poco más apagado ---------------- */
  var FADE_FRAGMENT = [
    'varying vec2 vUv;',
    'uniform sampler2D uTrail;',
    'uniform vec2 uShift;',
    'uniform float uFade;',
    'void main() {',
    '  vec2 uv = vUv + uShift;',
    '  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);',
    // El medio nivel que se resta garantiza que la estela llegue a cero: con 8
    // bits, multiplicar solo deja un velo que nunca termina de irse.
    '  float c = max(TEX(uTrail, uv).r * uFade - 0.5 / 255.0, 0.0) * inside;',
    '  FRAG_COLOR = vec4(c, c, c, 1.0);',
    '}'
  ].join('\n');

  /* --- Partículas: un segmento por partícula, de donde estaba a donde está - */
  var WIND_VERTEX = [
    'attribute vec2 aPos;',
    'attribute float aAlpha;',
    'varying float vAlpha;',
    'void main() {',
    '  vAlpha = aAlpha;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var WIND_FRAGMENT = [
    'varying float vAlpha;',
    'void main() {',
    '  FRAG_COLOR = vec4(vAlpha, vAlpha, vAlpha, 1.0);',
    '}'
  ].join('\n');

  var root = document.documentElement;
  var canvas = null;
  var gl = null;
  var isWebGL2 = false;
  var sceneProgram = null;
  var fadeProgram = null;
  var windProgram = null;
  var quad = null;
  var windBuffer = null;
  var targets = [null, null];   // dos texturas que se turnan: leer de una, escribir en la otra
  var targetIndex = 0;
  var uniforms = {};
  var fadeUniforms = {};
  var palette = {};

  var supported = false;    // hay contexto y los programas enlazan
  var active = false;       // start() sin stop()
  var contextLost = false;
  var reduced = false;      // prefers-reduced-motion
  var frozen = false;       // el gobernador dejó un cuadro fijo
  var adaptive = true;
  var darkVisible = true;
  var rafId = 0;

  var cssWidth = 0;
  var cssHeight = 0;
  var scrollRange = 0;
  var quality = 0;

  var simTime = 0;
  var speed = 1;
  var speedTarget = 1;
  var intensity = 1;
  var intensityTarget = 1;
  var tint = 0;
  var tintTarget = 0;
  var scroll = 0;
  var scrollTarget = 0;
  var pointerX = 0;
  var pointerY = 0;
  var pointerTargetX = 0;
  var pointerTargetY = 0;

  /* Estado del viento */
  var count = 0;
  var px = null;            // posición (px CSS)
  var py = null;
  var age = null;
  var life = null;
  var gain = null;          // brillo y velocidad propios de cada partícula
  var vertices = null;      // x, y, alfa por vértice; dos vértices por partícula
  var mouseX = 0;
  var mouseY = 0;
  var mouseForce = 0;
  var mouseForceTarget = 0;
  var lastMouseMove = 0;
  var lastScrollY = 0;
  var trailShift = 0;       // desplazamiento pendiente de las estelas, en fracción de alto
  var trailsStale = true;   // las texturas no reflejan el estado actual (recién creadas)
  var rngState = 20260713;

  var resumed = true;
  var lastRaf = 0;
  var lastDraw = 0;
  var paceTime = 0;
  var paceFrames = 0;
  var paceWarmup = true;
  var slowWindows = 0;

  var resizeObserver = null;
  var sectionObserver = null;
  var visibleSections = null;
  var motionQuery = null;

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function isNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  /* Generador propio con semilla fija: el fondo arranca igual en cada carga y no
     depende de Math.random. */
  function random() {
    rngState = (rngState + 0x6d2b79f5) | 0;
    var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* --- Campo de viento ------------------------------------------------------
     Ruido de gradiente clásico; el viento es el rotacional de ese potencial, así
     que no tiene fuentes ni sumideros: las partículas no se amontonan ni dejan
     huecos, giran. */
  var PERM = new Uint8Array(512);
  (function buildPermutation() {
    var table = new Uint8Array(256);
    var i, j, swap;
    for (i = 0; i < 256; i++) table[i] = i;
    for (i = 255; i > 0; i--) {
      j = Math.floor(random() * (i + 1));
      swap = table[i];
      table[i] = table[j];
      table[j] = swap;
    }
    for (i = 0; i < 512; i++) PERM[i] = table[i & 255];
  })();

  function gradient(hash, x, y) {
    switch (hash & 7) {
      case 0: return x + y;
      case 1: return x - y;
      case 2: return -x + y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  }

  function noise(x, y) {
    var xi = Math.floor(x);
    var yi = Math.floor(y);
    var xf = x - xi;
    var yf = y - yi;
    var u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    var v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    var X = xi & 255;
    var Y = yi & 255;
    var a = gradient(PERM[PERM[X] + Y], xf, yf);
    var b = gradient(PERM[PERM[X + 1] + Y], xf - 1, yf);
    var c = gradient(PERM[PERM[X] + Y + 1], xf, yf - 1);
    var d = gradient(PERM[PERM[X + 1] + Y + 1], xf - 1, yf - 1);
    var top = a + (b - a) * u;
    return top + (c + (d - c) * u - top) * v;
  }

  function potential(x, y, t) {
    return noise(x + t, y - t * 0.6) + 0.45 * noise(x * 2.3 + 17.1 - t * 1.4, y * 2.3 + 5.3);
  }

  /* --- Color ---------------------------------------------------------------- */

  function parseColor(value) {
    var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
    if (hex) {
      var digits = hex[1];
      if (digits.length === 3) {
        digits = digits[0] + digits[0] + digits[1] + digits[1] + digits[2] + digits[2];
      }
      var packed = parseInt(digits, 16);
      return [(packed >> 16 & 255) / 255, (packed >> 8 & 255) / 255, (packed & 255) / 255];
    }
    var rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value);
    if (rgb) {
      return [clamp(rgb[1] / 255, 0, 1), clamp(rgb[2] / 255, 0, 1), clamp(rgb[3] / 255, 0, 1)];
    }
    return null;
  }

  function readPalette() {
    var styles = window.getComputedStyle(root);
    for (var i = 0; i < PALETTE.length; i++) {
      var entry = PALETTE[i];
      palette[entry[0]] = parseColor(styles.getPropertyValue(entry[1]).trim()) || parseColor(entry[2]);
    }
  }

  /* --- WebGL ---------------------------------------------------------------- */

  function createContext() {
    var attributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power'
    };
    var context = null;
    try {
      context = canvas.getContext('webgl2', attributes);
      if (context) {
        isWebGL2 = true;
        return context;
      }
      context = canvas.getContext('webgl', attributes) || canvas.getContext('experimental-webgl', attributes);
      // Sin derivadas de pantalla no hay forma de trazar las curvas con el borde limpio.
      if (context && !context.getExtension('OES_standard_derivatives')) context = null;
    } catch (error) {
      context = null;
    }
    return context;
  }

  function compile(type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /* Los sombreadores se escriben una vez, en la sintaxis de WebGL 1; unas macros
     los traducen a la de WebGL 2. */
  function link(vertexBody, fragmentBody, attributes) {
    var highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    var precision = 'precision ' + (highp && highp.precision > 0 ? 'highp' : 'mediump') + ' float;\n';
    var vertexSource = isWebGL2
      ? '#version 300 es\n#define attribute in\n#define varying out\n' + vertexBody
      : vertexBody;
    var fragmentSource = isWebGL2
      ? '#version 300 es\n' + precision + '#define varying in\nout vec4 outColor;\n#define FRAG_COLOR outColor\n#define TEX texture\n' + fragmentBody
      : '#extension GL_OES_standard_derivatives : enable\n' + precision + '#define FRAG_COLOR gl_FragColor\n#define TEX texture2D\n' + fragmentBody;

    var vertex = compile(gl.VERTEX_SHADER, vertexSource);
    var fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;

    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    for (var i = 0; i < attributes.length; i++) gl.bindAttribLocation(program, i, attributes[i]);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) return null;
    return program;
  }

  /* Se llama al iniciar y cada vez que el navegador devuelve un contexto perdido:
     con el contexto se pierden programas, búferes, texturas y uniformes. */
  function buildPrograms() {
    sceneProgram = link(QUAD_VERTEX, SCENE_FRAGMENT, ['aPos']);
    fadeProgram = link(QUAD_VERTEX, FADE_FRAGMENT, ['aPos']);
    windProgram = link(WIND_VERTEX, WIND_FRAGMENT, ['aPos', 'aAlpha']);
    if (!sceneProgram || !fadeProgram || !windProgram) return false;

    // Un triángulo que desborda la pantalla hace de quad sin la diagonal en medio.
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    windBuffer = gl.createBuffer();

    gl.useProgram(sceneProgram);
    var names = ['uRes', 'uUnit', 'uPx', 'uTime', 'uScroll', 'uPointer', 'uIntensity', 'uWarmth', 'uTrail'];
    for (var i = 0; i < names.length; i++) {
      uniforms[names[i]] = gl.getUniformLocation(sceneProgram, names[i]);
    }
    for (var j = 0; j < PALETTE.length; j++) {
      var color = palette[PALETTE[j][0]];
      gl.uniform3f(gl.getUniformLocation(sceneProgram, PALETTE[j][0]), color[0], color[1], color[2]);
    }
    gl.uniform1i(uniforms.uTrail, 0);

    gl.useProgram(fadeProgram);
    fadeUniforms.uTrail = gl.getUniformLocation(fadeProgram, 'uTrail');
    fadeUniforms.uShift = gl.getUniformLocation(fadeProgram, 'uShift');
    fadeUniforms.uFade = gl.getUniformLocation(fadeProgram, 'uFade');
    gl.uniform1i(fadeUniforms.uTrail, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    targets[0] = targets[1] = null;
    uploadSize();
    return true;
  }

  function createTarget(width, height) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture: texture, framebuffer: framebuffer };
  }

  function destroyTarget(target) {
    if (!target) return;
    gl.deleteTexture(target.texture);
    gl.deleteFramebuffer(target.framebuffer);
  }

  function uploadSize() {
    var ratio = cssWidth > 0 ? canvas.width / cssWidth : 1;
    var unit = clamp(Math.min(cssWidth, cssHeight), UNIT_MIN, UNIT_MAX);
    gl.useProgram(sceneProgram);
    gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uUnit, unit * ratio);
    gl.uniform1f(uniforms.uPx, ratio);

    destroyTarget(targets[0]);
    destroyTarget(targets[1]);
    targets[0] = createTarget(canvas.width, canvas.height);
    targets[1] = createTarget(canvas.width, canvas.height);
    targetIndex = 0;
    trailsStale = true;
  }

  /* Ajusta el búfer al tamaño CSS del canvas. Devuelve true si cambió: quien
     llama tiene que repintar, porque redimensionar un canvas lo borra. */
  function fitBuffer() {
    if (cssWidth <= 0 || cssHeight <= 0) return false;
    var ratio = Math.min(window.devicePixelRatio || 1, DPR_CAP) * RENDER_SCALES[Math.min(quality, RENDER_SCALES.length - 1)];
    var pixels = cssWidth * cssHeight * ratio * ratio;
    if (pixels > MAX_PIXELS) ratio *= Math.sqrt(MAX_PIXELS / pixels);
    var width = Math.max(1, Math.round(cssWidth * ratio));
    var height = Math.max(1, Math.round(cssHeight * ratio));
    var changed = canvas.width !== width || canvas.height !== height;
    if (changed) {
      canvas.width = width;
      canvas.height = height;
    }
    if (!contextLost && (changed || !targets[0])) uploadSize();
    seedParticles();
    return changed;
  }

  /* --- Partículas ----------------------------------------------------------- */

  function spawn(i, anywhere) {
    px[i] = -EDGE + random() * (cssWidth + EDGE * 2);
    py[i] = -EDGE + random() * (cssHeight + EDGE * 2);
    life[i] = LIFE_MIN + random() * (LIFE_MAX - LIFE_MIN);
    // Al sembrar, cada una nace a media vida: si no, todas parpadearían a la vez
    age[i] = anywhere ? random() * life[i] : 0;
    gain[i] = 0.45 + random() * 0.55;
  }

  function seedParticles() {
    var wanted = Math.round(clamp(cssWidth * cssHeight / PARTICLE_AREA, PARTICLE_MIN, PARTICLE_MAX));
    if (wanted === count && px) return;
    count = wanted;
    px = new Float32Array(count);
    py = new Float32Array(count);
    age = new Float32Array(count);
    life = new Float32Array(count);
    gain = new Float32Array(count);
    vertices = new Float32Array(count * 6);
    for (var i = 0; i < count; i++) spawn(i, true);
    if (gl && !contextLost) {
      gl.bindBuffer(gl.ARRAY_BUFFER, windBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, gl.DYNAMIC_DRAW);
    }
    trailsStale = true;
  }

  /* Avanza todas las partículas y deja listo el búfer de segmentos. */
  function stepParticles(dt, shiftPx) {
    var t = simTime * FIELD_DRIFT;
    var scale = FIELD_SCALE;
    var epsilon = 0.01;
    var toClipX = 2 / cssWidth;
    var toClipY = 2 / cssHeight;
    var spanY = cssHeight + EDGE * 2;
    var radius2 = POINTER_RADIUS * POINTER_RADIUS;
    var push = mouseForce * POINTER_PUSH;
    var o = 0;

    for (var i = 0; i < count; i++) {
      var x = px[i];
      var y = py[i] - shiftPx;
      // La página se desplazó: el viento la acompaña un poco y da la vuelta por el otro borde
      if (y < -EDGE) y += spanY;
      else if (y > cssHeight + EDGE) y -= spanY;

      var nx = x * scale;
      var ny = y * scale;
      var p0 = potential(nx, ny, t);
      var curlX = (potential(nx, ny + epsilon, t) - p0) / epsilon;
      var curlY = -(potential(nx + epsilon, ny, t) - p0) / epsilon;
      var k = gain[i];
      var vx = (WIND_X * WIND_SPEED + curlX * WIND_SWIRL) * (0.55 + k);
      var vy = (WIND_Y * WIND_SPEED + curlY * WIND_SWIRL) * (0.55 + k);

      if (push > 0.5) {
        var dx = x - mouseX;
        var dy = y - mouseY;
        var d2 = dx * dx + dy * dy;
        if (d2 < radius2 && d2 > 1) {
          var d = Math.sqrt(d2);
          var fall = 1 - d / POINTER_RADIUS;
          fall *= fall;
          // Se abre hacia afuera y gira alrededor: el viento rodea el obstáculo
          vx += (dx / d * 0.55 - dy / d) * push * fall;
          vy += (dy / d * 0.55 + dx / d) * push * fall;
        }
      }

      var x2 = x + vx * dt;
      var y2 = y + vy * dt;
      var a = age[i] + dt;
      var l = life[i];
      // Entra y sale fundiéndose: ninguna aparece ni desaparece de golpe
      var alpha = k * Math.min(1, a / 0.9) * Math.min(1, (l - a) / 1.2);
      if (alpha < 0) alpha = 0;

      vertices[o] = x * toClipX - 1;
      vertices[o + 1] = 1 - y * toClipY;
      vertices[o + 2] = alpha * 0.55;
      vertices[o + 3] = x2 * toClipX - 1;
      vertices[o + 4] = 1 - y2 * toClipY;
      vertices[o + 5] = alpha;
      o += 6;

      if (a >= l || x2 < -EDGE || x2 > cssWidth + EDGE || y2 < -EDGE || y2 > cssHeight + EDGE) {
        spawn(i, false);
      } else {
        px[i] = x2;
        py[i] = y2;
        age[i] = a;
      }
    }
  }

  /* Apaga un poco lo que había y dibuja encima los segmentos nuevos. */
  function renderTrails(fade) {
    var source = targets[targetIndex];
    var target = targets[1 - targetIndex];
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.useProgram(fadeProgram);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform2f(fadeUniforms.uShift, 0, trailShift);
    gl.uniform1f(fadeUniforms.uFade, fade);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(windProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, windBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 12, 8);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.LINES, 0, count * 2);
    gl.disable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    targetIndex = 1 - targetIndex;
    trailShift = 0;
    trailsStale = false;
  }

  /* Fondo fijo (movimiento reducido o equipo que no da la cadencia): se simula
     un tramo de viento de una vez para que el cuadro quieto tenga sus estelas. */
  function prewarm() {
    if (!count) return;
    for (var i = 0; i < PREWARM_STEPS; i++) {
      simTime += FRAME_MS / 1000;
      stepParticles(FRAME_MS / 1000, 0);
      renderTrails(TRAIL_FADE);
    }
  }

  /* --- Cuadro --------------------------------------------------------------- */

  function ease(current, target, dt, tau) {
    return current + (target - current) * (1 - Math.exp(-dt / tau));
  }

  function advance(dt) {
    speed = ease(speed, speedTarget, dt, TAU_SPEED);
    intensity = ease(intensity, intensityTarget, dt, TAU_INTENSITY);
    tint = ease(tint, tintTarget, dt, TAU_TINT);
    scroll = ease(scroll, scrollTarget, dt, TAU_SCROLL);
    pointerX = ease(pointerX, pointerTargetX, dt, TAU_POINTER);
    pointerY = ease(pointerY, pointerTargetY, dt, TAU_POINTER);
    // El empuje del cursor se disuelve si el ratón lleva un rato quieto
    if (performance.now() - lastMouseMove > 2200) mouseForceTarget = 0;
    mouseForce = ease(mouseForce, mouseForceTarget, dt, TAU_TOUCH);
    simTime += dt * speed;

    var scrollY = window.scrollY;
    var shiftPx = (scrollY - lastScrollY) * PARALLAX;
    lastScrollY = scrollY;
    // Un salto largo (un ancla, por ejemplo) no se anima: sería un barrido de pantalla
    if (Math.abs(shiftPx) > cssHeight * 0.4) shiftPx = 0;
    trailShift = -shiftPx / cssHeight;

    stepParticles(dt * speed, shiftPx);
    renderTrails(Math.pow(TRAIL_FADE, dt * 30));
  }

  function settle() {
    speed = speedTarget;
    intensity = intensityTarget;
    tint = tintTarget;
    scroll = scrollTarget;
    // Un cuadro fijo no sigue al puntero: saldría distinto según dónde quedó el
    // ratón, y con movimiento reducido eso también es movimiento.
    pointerX = 0;
    pointerY = 0;
    mouseForce = 0;
    lastScrollY = window.scrollY;
  }

  function draw() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(sceneProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(1);
    gl.bindTexture(gl.TEXTURE_2D, targets[targetIndex].texture);
    gl.uniform1f(uniforms.uTime, simTime);
    gl.uniform1f(uniforms.uScroll, scroll);
    gl.uniform2f(uniforms.uPointer, pointerX, pointerY);
    gl.uniform1f(uniforms.uIntensity, intensity);
    gl.uniform1f(uniforms.uWarmth, clamp(1 - SCROLL_COOLING * scroll + 0.5 * tint, 0, 1.5));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* Cuadro suelto, fuera del ritmo del bucle. Con el bucle detenido (movimiento
     reducido, fondo congelado, nada oscuro a la vista) los valores van directo
     a su destino: no hay quien recorra la transición. */
  function paint() {
    if (!supported || contextLost) return;
    if (!rafId) {
      settle();
      if (trailsStale && (reduced || frozen)) prewarm();
    }
    draw();
  }

  function watchPace(gap) {
    if (!adaptive) return;
    if (gap > PACE_IGNORE_MS) {       // la pestaña vuelve de estar suspendida: no cuenta
      paceTime = 0;
      paceFrames = 0;
      return;
    }
    paceTime += gap;
    paceFrames++;
    if (paceTime < PACE_WINDOW_MS) return;
    var slow = paceTime / paceFrames > PACE_SLOW_MS;
    paceTime = 0;
    paceFrames = 0;
    if (paceWarmup) {                 // la primera ventana coincide con la carga de la página
      paceWarmup = false;
      return;
    }
    slowWindows = slow ? slowWindows + 1 : 0;
    if (slowWindows < 2) return;
    slowWindows = 0;
    paceWarmup = true;
    quality++;
    if (quality < RENDER_SCALES.length) {
      if (fitBuffer()) draw();
    } else {
      frozen = true;
      sync();
    }
  }

  function frame(now) {
    rafId = window.requestAnimationFrame(frame);
    if (resumed) {
      // Primer cuadro tras una pausa: se pinta ya y sin avanzar el tiempo.
      resumed = false;
      lastRaf = now;
      lastDraw = now;
      lastScrollY = window.scrollY;
      draw();
      return;
    }
    watchPace(now - lastRaf);
    lastRaf = now;
    if (!rafId) return;               // el gobernador acaba de congelar el fondo

    // Se pinta en el primer refresco que llega a ~33 ms: uno de cada dos a 60 Hz,
    // uno de cada cuatro a 120 Hz. La holgura absorbe el temblor del reloj.
    var elapsed = now - lastDraw;
    if (elapsed < FRAME_MS - 4) return;
    lastDraw = now;
    advance(Math.min(elapsed, 100) / 1000);
    draw();
  }

  /* Único punto que decide si el bucle corre. */
  function sync() {
    var shouldRun = active && supported && !contextLost && !reduced && !frozen && darkVisible && !document.hidden;
    if (shouldRun && !rafId) {
      resumed = true;
      paceTime = 0;
      paceFrames = 0;
      paceWarmup = true;
      slowWindows = 0;
      rafId = window.requestAnimationFrame(frame);
    } else if (!shouldRun && rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
      // Lo que queda a la vista es un cuadro fijo: que tenga sus estelas completas
      if ((reduced || frozen) && supported && !contextLost) {
        trailsStale = true;
        paint();
      }
    }
  }

  /* --- Entradas ------------------------------------------------------------- */

  function measureScrollRange() {
    scrollRange = Math.max(0, root.scrollHeight - window.innerHeight);
    onScroll();
  }

  function onScroll() {
    scrollTarget = scrollRange > 0 ? clamp(window.scrollY / scrollRange, 0, 1) : 0;
  }

  function onPointerMove(event) {
    // Solo el ratón: en táctil el «puntero» salta de un dedo a otro.
    if (event.pointerType !== 'mouse' || cssWidth <= 0 || cssHeight <= 0) return;
    pointerTargetX = clamp(event.clientX / cssWidth * 2 - 1, -1, 1);
    pointerTargetY = clamp(1 - event.clientY / cssHeight * 2, -1, 1);
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseForceTarget = 1;
    lastMouseMove = performance.now();
  }

  function onPointerLeave() {
    mouseForceTarget = 0;
  }

  function onResize(entries) {
    var canvasResized = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].target === canvas) {
        cssWidth = entries[i].contentRect.width;
        cssHeight = entries[i].contentRect.height;
        canvasResized = true;
      }
    }
    measureScrollRange();
    // Se repinta aquí mismo, antes de que el navegador componga: el canvas
    // recién redimensionado está en blanco y esperar al bucle sería un destello.
    if (canvasResized && fitBuffer()) paint();
  }

  function onSections(entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) visibleSections.add(entries[i].target);
      else visibleSections.delete(entries[i].target);
    }
    darkVisible = visibleSections.size > 0;
    sync();
  }

  function onVisibility() {
    sync();
    // Al volver a la pestaña el navegador puede haber descartado la imagen del
    // canvas; si el bucle no va a correr, se repone con un cuadro suelto.
    if (!document.hidden && !rafId) paint();
  }

  function onMotionChange(event) {
    reduced = event.matches;
    sync();
  }

  function onContextLost(event) {
    event.preventDefault();           // sin esto el navegador no intenta devolverlo
    contextLost = true;
    root.classList.add('no-gl');
    sync();
  }

  function onContextRestored() {
    contextLost = false;
    if (!buildPrograms()) {
      supported = false;
      sync();
      return;
    }
    // La clase puede haber ocultado el canvas (display:none): se quita antes de
    // medirlo, o el cuadro de vuelta saldría con las medidas de un canvas vacío.
    root.classList.remove('no-gl');
    cssWidth = canvas.clientWidth;
    cssHeight = canvas.clientHeight;
    count = 0;                        // el búfer de segmentos también se perdió
    fitBuffer();
    paint();
    sync();
  }

  /* Las secciones oscuras son transparentes y dejan ver el canvas; las claras lo
     tapan. Con todo tapado no tiene sentido gastar ni un cuadro. El chat (#alisio)
     flota siempre en pantalla, así que no cuenta como «sección a la vista». */
  function observeSections() {
    var nodes = document.querySelectorAll('[data-tone="dark"]:not([data-fondo-ignore])');
    var chat = document.getElementById('alisio');
    visibleSections = new Set();
    sectionObserver = new IntersectionObserver(onSections);
    var observed = 0;
    for (var i = 0; i < nodes.length; i++) {
      if (chat && chat.contains(nodes[i])) continue;
      sectionObserver.observe(nodes[i]);
      observed++;
    }
    if (!observed) {
      // Página sin secciones marcadas: el canvas se ve siempre.
      sectionObserver.disconnect();
      sectionObserver = null;
      visibleSections = null;
    }
    darkVisible = true;               // hasta la primera notificación del observador
  }

  /* --- API ------------------------------------------------------------------ */

  function start() {
    if (!supported || active) return;
    active = true;

    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced = motionQuery.matches;
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
    else motionQuery.addListener(onMotionChange);

    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(canvas);
    // El alto del documento cambia sin que cambie la ventana (imágenes que cargan,
    // acordeones): se vigila para que el progreso de scroll no quede desfasado.
    resizeObserver.observe(root);
    if (document.body) resizeObserver.observe(document.body);

    observeSections();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    cssWidth = canvas.clientWidth;
    cssHeight = canvas.clientHeight;
    lastScrollY = window.scrollY;
    measureScrollRange();
    fitBuffer();
    paint();
    sync();
  }

  function stop() {
    if (!active) return;
    active = false;
    if (motionQuery.removeEventListener) motionQuery.removeEventListener('change', onMotionChange);
    else motionQuery.removeListener(onMotionChange);
    motionQuery = null;
    resizeObserver.disconnect();
    resizeObserver = null;
    if (sectionObserver) sectionObserver.disconnect();
    sectionObserver = null;
    visibleSections = null;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    sync();
  }

  function set(options) {
    if (!options) return;
    if (isNumber(options.intensity)) intensityTarget = clamp(options.intensity, 0, 1);
    if (isNumber(options.tint)) tintTarget = clamp(options.tint, -1, 1);
    if (typeof options.calm === 'boolean') speedTarget = options.calm ? CALM_SPEED : 1;
    if (typeof options.adaptive === 'boolean') {
      adaptive = options.adaptive;
      if (!adaptive && (frozen || quality > 0)) {
        frozen = false;
        quality = 0;
        if (supported && fitBuffer()) paint();
        sync();
      }
    }
    if (active && !rafId) paint();
  }

  function init() {
    canvas = document.getElementById('fondo');
    if (!canvas) return;
    // Un navegador sin estos observadores tampoco merece el bucle: se queda con
    // el degradado de respaldo, igual que uno sin WebGL.
    if ('ResizeObserver' in window && 'IntersectionObserver' in window) gl = createContext();
    if (gl) {
      readPalette();
      supported = buildPrograms();
    }
    if (!supported) {
      root.classList.add('no-gl');
      return;
    }
    // Estos dos viven lo que viva el canvas: no dependen de start() y stop().
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    start();
  }

  window.Fondo = {
    get supported() { return supported; },
    get running() { return rafId !== 0; },
    get particles() { return count; },
    start: start,
    stop: stop,
    set: set
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
