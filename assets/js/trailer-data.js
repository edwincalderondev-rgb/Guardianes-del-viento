/* ==========================================================================
   GUARDIANES DEL VIENTO — datos del tráiler
   ES EL ÚNICO ARCHIVO QUE HAY QUE TOCAR CUANDO LLEGUE EL VIDEO FINAL.

   1. Copie el video en assets/video/ (MP4 H.264, 16:9, 1080p).
   2. Escriba su ruta en video.src (y, si quiere, una portada en video.poster).
   3. Si los cortes del video final no coinciden con los de la locución,
      ajuste los tiempos de «scenes»: de ahí salen los capítulos.

   Mientras video.src esté vacío, la página muestra una previsualización del
   storyboard: las ocho escenas del guion sincronizadas con la voz real del
   tráiler (preview: true). Con preview: false queda solo la portada con el
   aviso «Próximamente».

   Va en .js y no en .json a propósito: un fetch() de JSON falla cuando la
   página se abre como archivo local (file://).
   ========================================================================== */
window.TRAILER = {
  title: 'Guardianes del Viento · Tráiler',

  // Video final (2026-10-14): lleva la misma locución, sin desfase ni deriva (medido
  // por correlación con narracion.m4a), así que subtítulos, capítulos y onda sirven tal cual.
  video: {
    src: 'assets/video/guardianes-del-viento.mp4',
    poster: 'assets/video/portada-1920.webp',
    // true si el video final conserva la misma locución: se reutilizan estos subtítulos
    captions: true,
  },

  preview: true,
  audio: 'assets/audio/narracion.m4a',
  poster: 'assets/video/portada-1100.webp',

  duration: 119.953991,

  // Las ocho escenas del guion, con los cortes medidos en la locución real (no los
  // tiempos objetivo del storyboard: la voz se desvía de ellos hasta 8,5 s).
  scenes: [
    { n: 1, title: 'La promesa y la tensión', start: 0, end: 19.01 },
    { n: 2, title: 'El riesgo global aterriza', start: 19.01, end: 38.06 },
    { n: 3, title: 'La pregunta de giro', start: 38.06, end: 44.34 },
    { n: 4, title: 'La innovación', start: 44.34, end: 66.53 },
    { n: 5, title: 'Teoría de cambio', start: 66.53, end: 75.08 },
    { n: 6, title: 'Impacto hacia 2030', start: 75.08, end: 91.32 },
    { n: 7, title: 'La inversión como alianza', start: 91.32, end: 107.5 },
    { n: 8, title: 'Decisión y llamado', start: 107.5, end: 119.907846 },
  ],

  // Subtítulos: el texto del guion alineado palabra por palabra con la voz.
  captions: [
    { start: 1.9, end: 5.36, text: "En La Guajira, una joven wayuu observa un parque eólico." },
    { start: 5.72, end: 8.23, text: "Su territorio promete energía para Colombia," },
    { start: 8.63, end: 12.62, text: "pero comunidad, empresa y Estado reciben versiones distintas." },
    { start: 13.04, end: 14.48, text: "Sin evidencia compartida," },
    { start: 14.81, end: 18.83, text: "crecen la desconfianza, el conflicto y las paralizaciones." },
    { start: 19.19, end: 23.17, text: "El Global Risks Report 2025 ubica la desinformación" },
    { start: 23.43, end: 25.24, text: "entre las amenazas inmediatas" },
    { start: 25.54, end: 29.33, text: "y los riesgos ambientales entre los más severos de la próxima década." },
    { start: 29.68, end: 35.3, text: "La Guajira concentra cerca del 98 % de los proyectos eólicos del país:" },
    { start: 35.66, end: 37.86, text: "allí, ambos riesgos convergen." },
    { start: 38.26, end: 40.66, text: "¿Y si ella, junto con su comunidad," },
    { start: 40.97, end: 44.08, text: "pudiera producir y gobernar esa evidencia?" },
    { start: 44.59, end: 48.85, text: "Guardianes del Viento es una cooperativa wayuu sin ánimo de lucro." },
    { start: 49.21, end: 53.34, text: "Forma monitores locales y combina conocimiento territorial," },
    { start: 53.66, end: 56.01, text: "sensores, información satelital," },
    { start: 56.29, end: 59.19, text: "inteligencia artificial y tableros bilingües." },
    { start: 59.57, end: 61.75, text: "La comunidad gobierna los datos" },
    { start: 62.12, end: 66.36, text: "y reinvierte los excedentes en formación y proyectos ambientales." },
    { start: 66.69, end: 69.99, text: "La cadena es clara: datos legítimos activan alertas;" },
    { start: 70.26, end: 71.94, text: "las alertas aceleran respuestas;" },
    { start: 72.22, end: 74.91, text: "y mejores decisiones reducen controversias." },
    { start: 75.25, end: 77.43, text: "Hacia el año 2030, buscamos vincular" },
    { start: 77.68, end: 81.67, text: "a 24 personas wayuu como monitores para cubrir cuatro parques," },
    { start: 82, end: 84.58, text: "reducir 50 % el tiempo de verificación" },
    { start: 84.87, end: 87.27, text: "y 30 % los días de paralización" },
    { start: 87.27, end: 91.1, text: "relacionados con controversias de información." },
    { start: 91.53, end: 94.93, text: "El piloto requiere 650 millones de pesos" },
    { start: 95.3, end: 98.54, text: "y alianzas con autoridades wayuu, dos parques," },
    { start: 98.7, end: 101.37, text: "una universidad y un laboratorio validador." },
    { start: 101.69, end: 105.06, text: "Apoyarlo reduce incertidumbre, protege proyectos" },
    { start: 105.36, end: 107.26, text: "y deja capacidades en La Guajira." },
    { start: 107.73, end: 109.44, text: "Invierta en Guardianes del Viento." },
    { start: 109.77, end: 112.32, text: "Hagamos que la evidencia llegue primero." },
    { start: 112.67, end: 116.63, text: "La transición energética necesita confianza." },
  ],

  // Envolvente de la locución (240 tramos de medio segundo) para dibujar la forma de onda.
  peaks: [
    0.01, 0.01, 0.03, 0.33, 0.92, 0.69, 0.69, 0.85, 0.58, 0.59, 0.51, 0.37, 0.7, 0.64, 0.68, 0.72, 0.51, 0.56, 0.73, 0.56,
    0.58, 0.5, 0.74, 0.65, 0.62, 0.32, 0.85, 0.59, 0.87, 0.32, 0.56, 0.63, 0.53, 0.64, 0.68, 0.54, 0.76, 0.42, 0.54, 0.71,
    0.64, 0.69, 0.72, 0.63, 0.73, 0.56, 0.53, 0.63, 0.6, 0.93, 0.41, 0.67, 0.65, 0.61, 0.49, 0.7, 0.68, 0.69, 0.4, 0.54,
    0.73, 0.61, 0.51, 0.77, 0.63, 0.7, 0.38, 0.63, 0.74, 0.57, 0.55, 0.76, 0.52, 0.68, 0.65, 0.56, 0.45, 0.9, 0.54, 0.68,
    0.96, 0.18, 0.84, 0.83, 0.55, 0.79, 0.54, 0.85, 0.29, 0.68, 0.89, 0.61, 0.75, 0.83, 0.71, 0.68, 0.93, 0.74, 0.52, 0.72,
    0.72, 0.7, 0.48, 0.76, 0.74, 0.6, 0.62, 0.42, 0.63, 0.57, 0.54, 0.69, 0.57, 0.64, 0.62, 0.6, 0.75, 0.84, 0.46, 0.63,
    0.86, 0.68, 0.8, 0.39, 0.63, 0.73, 0.62, 0.47, 0.63, 0.6, 0.71, 0.61, 0.57, 0.46, 0.7, 0.34, 0.69, 0.84, 0.65, 0.62,
    0.37, 0.73, 0.66, 0.55, 0.58, 0.71, 0.68, 0.6, 0.63, 0.6, 0.31, 0.84, 0.79, 0.64, 0.8, 0.48, 0.6, 0.67, 1, 0.75,
    0.34, 0.61, 0.7, 0.37, 0.64, 0.61, 0.63, 0.76, 0.64, 0.47, 0.64, 0.67, 0.57, 0.73, 0.63, 0.7, 0.5, 0.57, 0.71, 0.42,
    0.72, 0.67, 0.23, 0.65, 0.75, 0.43, 0.67, 0.64, 0.72, 0.71, 0.52, 0.77, 0.63, 0.71, 0.92, 0.4, 0.56, 0.68, 0.82, 0.32,
    0.84, 0.76, 0.76, 0.42, 0.82, 0.75, 0.88, 0.55, 0.57, 0.68, 0.55, 0.64, 0.77, 0.67, 0.54, 0.59, 0.79, 0.61, 0.71, 0.31,
    0.67, 0.75, 0.51, 0.65, 0.67, 0.46, 0.61, 0.68, 0.4, 0.46, 0.67, 0.07, 0.71, 0.3, 0, 0, 0, 0, 0, 0,
  ],
};
