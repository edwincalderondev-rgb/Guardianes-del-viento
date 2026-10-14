# Video del tráiler

`guardianes-del-viento.mp4` es el tráiler publicado (desde el 2026-10-14): 1:59, 1080p a
30 fps, H.264 + AAC, unos 81 MB. Se copió del original sin recomprimir; solo se movió el
índice del MP4 al principio (`-movflags +faststart`) para que el navegador empiece a
reproducirlo mientras se descarga.

Lleva la misma locución que `assets/audio/narracion.m4a`, sin desfase ni deriva (medido por
correlación de las dos pistas), así que los subtítulos, los capítulos y la onda del
reproductor (todo en `assets/js/trailer-data.js`) sirven tal cual.

Las portadas `portada-640/1100/1920.webp` son el segundo 1,6 del video: ya pasó el fundido
de entrada y todavía no aparece el primer texto (entra hacia el segundo 2).

## Cambiar el video por una versión nueva

```
ffmpeg -i "<video nuevo>.mp4" -map 0 -c copy -movflags +faststart assets/video/guardianes-del-viento.mp4
```

1. Si la locución cambió o se movió, hay que volver a medir los subtítulos y los cortes de
   `scenes` en `trailer-data.js` (o poner `captions: false`).
2. Si cambió la primera toma, regenerar las portadas (un cuadro sin texto ni fundido).
3. **GitHub rechaza archivos de más de 100 MB.** Si el video nuevo pesa más, hay que
   comprimirlo: a 5 Mbps un tráiler de 2 minutos queda en ~77 MB sin pérdida visible
   (VMAF 97,9, medido el 2026-10-14). Y cada versión subida queda para siempre en la
   historia del repositorio: solo se suben versiones finales.
