# Video final del tráiler

Cuando el video esté listo:

1. Cópielo en esta carpeta (MP4 H.264, 16:9, 1080p). Por ejemplo `guardianes-del-viento.mp4`.
2. Abra `assets/js/trailer-data.js` y escriba su ruta en `video.src`:

   ```js
   video: {
     src: 'assets/video/guardianes-del-viento.mp4',
     poster: '',        // opcional: una imagen de portada
     captions: true,    // false si el video final cambia la locución
   },
   ```

3. Si los cortes del video no coinciden con los de la locución, ajuste los tiempos de
   `scenes` en ese mismo archivo: de ahí salen los capítulos del reproductor.

No hay que tocar nada más. Mientras `video.src` esté vacío, la página muestra la
previsualización del storyboard con la voz real del tráiler.

GitHub rechaza archivos de más de 100 MB; un tráiler de dos minutos a 1080p pesa
entre 15 y 40 MB, así que cabe sin problema.
