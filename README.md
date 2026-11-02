# Entreno Semanal · Fuerza, Cardio y Lumbar

App web progresiva (PWA) para seguir un plan semanal de entrenamiento con tres bloques: **fuerza**, **cardio de bajo impacto** y **salud lumbar**. Funciona sin conexión, se instala en el celular como una app más y guarda todo en el dispositivo.

## Qué hace

- **Vista semanal**: muestra la semana actual (o anteriores/siguientes), el progreso de cada día y el avance hacia las metas semanales (Fuerza 3–4, Cardio 3, Lumbar 2–3 días).
- **Fuerza + Caminata**: registro libre de ejercicios, series y cargas, más los 50 min de caminata (ida y vuelta al gimnasio).
- **Cardio bajo impacto**, con temporizador en pantalla:
  - **HIIT** de 16–20 min (rondas, trabajo y descanso configurables) con 4 ejercicios sin salto.
  - **AMRAP** de 15 min con contador de rondas.
- **Salud lumbar**: puente de glúteo, bird-dog y plancha en rodillas, con marcado de series, temporizador de plancha y de descanso.
- **Alertas**: sonido, vibración (Android) y pantalla siempre encendida mientras corre un temporizador.
- **Ajustes**: plan semanal por día, alertas, exportar/importar los datos en JSON y borrar registros.

## Estructura

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | Toda la app: HTML, CSS y JavaScript sin dependencias ni build. |
| `sw.js` | Service worker: cachea la app para usarla offline (stale-while-revalidate). |
| `manifest.webmanifest` | Nombre, colores e íconos para instalarla como app. |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Íconos. |
| `.nojekyll` | Para que GitHub Pages sirva los archivos tal cual. |

## Datos

Todo se guarda en `localStorage` del navegador: no hay servidor ni cuenta. Eso implica que:

- Los datos viven **solo en ese dispositivo y ese navegador**.
- Si se borran los datos del sitio o se desinstala la app, se pierden. Conviene usar **Ajustes → Exportar** cada tanto como backup; con **Importar** se recuperan (o se pasan a otro dispositivo).

## Correr en local

No necesita instalación. El service worker requiere `http(s)`, así que conviene levantar un servidor estático en la carpeta:

```bash
npx serve .
# o
python -m http.server 8000
```

y abrir `http://localhost:8000`. Abriendo `index.html` directo con doble clic también funciona, pero sin modo offline.

## Publicar

Es un sitio estático: alcanza con subir los archivos a cualquier hosting con HTTPS. Con GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / root*.

**Al publicar cambios**, subir la versión de caché en `sw.js` (`entreno-v1` → `entreno-v2`, etc.) para que los celulares que ya la tienen instalada tomen la nueva versión.

## Instalar en el celular

- **Android (Chrome)**: abrir la URL → menú ⋮ → *Instalar app* / *Agregar a la pantalla principal*.
- **iPhone (Safari)**: abrir la URL → botón *Compartir* → *Agregar a inicio*. En iOS la vibración no está disponible.
