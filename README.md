# Guardianes del Viento

Sitio de presentación de la tesis de maestría **Guardianes del Viento**: una cooperativa
wayuu sin ánimo de lucro que produce, valida y gobierna información ambiental y social
alrededor de los parques eólicos de La Guajira.

**Autores:** Paola Andrea Guardiola Núñez, Luis Arturo Flechas Robles y Carlos Humberto Loza
Arenas.

El **tráiler** es la pieza central y la página es su marco: alrededor del video están el
informe para evaluar la inversión, las fotografías de campo y **Alisio**, el asistente de
preguntas.

Sitio publicado: <https://edwincalderondev-rgb.github.io/Guardianes-del-viento/>

## Cómo está hecho

Sitio estático, sin dependencias, sin CDN y sin paso de compilación. Funciona igual
servido por HTTP que abierto como archivo local (`index.html` con doble clic), pensando en
el día de la sustentación: si no hay red, la página sigue completa.

```
index.html
assets/
  css/   tokens.css      colores, tipografía, espacio y movimiento (única fuente de verdad)
         base.css        reinicio, cabecera, botones, utilidades
         sections.css    cada sección, en el orden de la página
         trailer.css     el escenario del tráiler y el modo cine
         alisio.css      el asistente
  js/    trailer-data.js DATOS del tráiler: lo único que se edita cuando llegue el video
         trailer.js      reproductor (video, previsualización o «próximamente»)
         fondo.js        fondo vivo: curvas de nivel + viento de partículas (WebGL)
         main.js         cabecera, menú, revelado, figuras, visor de fotos
         alisio-kb.js    base de conocimiento del asistente
         alisio.js       motor e interfaz del asistente
  fonts/ Fraunces, Instrument Sans e IBM Plex Mono, alojadas en el sitio
  img/   escenas/ (recreaciones del tráiler) · territorio/ (fotos de campo) · alisio/ · og/
  audio/ narracion.m4a   locución del tráiler
  video/ aquí va el video final (ver LEEME.md)
```

## Poner el video final

Hoy la página muestra una **previsualización del storyboard**: las ocho escenas del guion
sincronizadas con la voz real del tráiler. Cuando exista el video:

1. Copiarlo en `assets/video/`.
2. Escribir su ruta en `video.src`, dentro de `assets/js/trailer-data.js`.

Nada más. Los detalles están en `assets/video/LEEME.md`.

## Enseñarle algo a Alisio

Alisio no usa inteligencia artificial ni servidor: responde por coincidencia de palabras,
todo en el navegador. Lo que sabe vive en `assets/js/alisio-kb.js` y su cabecera explica el
formato de una entrada. Las 20 preguntas del documento de preguntas técnicas van textuales.

Para comprobar a qué entrada llega una pregunta, en la consola del navegador:

```js
Alisio.match('cuánto cuesta el piloto')   // ranking con puntajes
Alisio.probe('hola, ¿qué riesgos hay?')   // además dice si responde la capa de charla
```

Regla del contenido: ninguna cifra se presenta como resultado alcanzado. Todas son metas y
supuestos de planeación que deben validarse en el piloto.

## Verlo en local

Basta abrir `index.html`. Si se prefiere un servidor:

```
npx serve .
```

## Publicación

GitHub Pages sirve la rama `gh-pages`. No hay que tocarla a mano: el flujo
`.github/workflows/publicar.yml` la deja idéntica a `main` en cada `git push` a `main`, y el
sitio se actualiza en uno o dos minutos.

Si algún día se prefiere publicar directamente desde `main`, se cambia en
*Settings → Pages → Branch* y se borran la rama `gh-pages` y ese flujo.

## Créditos

- Las imágenes marcadas en la página como «Recreación visual» fueron generadas para este
  proyecto y no representan personas ni hechos reales.
- Las fotografías de la sección «El territorio» son registros de campo tomados en La Guajira.
- Diseño y desarrollo del sitio, identidad visual y asistente: Dual Engineer Edwin Calderón
  Aguilera — The Architect · Soluciones profesionales.
- Tipografías: Fraunces, Instrument Sans e IBM Plex Mono, bajo SIL Open Font License 1.1.
