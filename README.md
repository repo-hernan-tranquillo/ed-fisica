# Entreno Semanal · Fuerza, Cardio y Lumbar

App web progresiva (PWA) para seguir un plan semanal de entrenamiento con tres bloques: **fuerza**, **cardio de bajo impacto** y **salud lumbar**. Funciona sin conexión, se instala en el celular como una app más y guarda todo en el dispositivo.

## Qué hace

- **Vista semanal**: muestra la semana actual (o anteriores/siguientes), el progreso de cada día y el avance hacia las metas semanales (Fuerza 3–4, Cardio 3, Lumbar 2–3 días).
- **Fuerza + Caminata**: registro libre de ejercicios, series y cargas, más los 50 min de caminata (ida y vuelta al gimnasio).
- **Cardio bajo impacto**, con temporizador en pantalla:
  - **HIIT** de 16–20 min (rondas, trabajo y descanso configurables) con 4 ejercicios sin salto.
  - **AMRAP** de 15 min con contador de rondas.
- **Salud lumbar**: puente de glúteo, bird-dog y plancha en rodillas, con marcado de series, temporizador de plancha y de descanso.
- **Días no cumplidos**: un día (hoy o pasado) se puede marcar como *no cumplido*, con un motivo opcional (lluvia, trabajo…), y pasar sus bloques a otro día de lo que queda de la semana. Se puede deshacer.
- **Alertas**: sonido, vibración (Android) y pantalla siempre encendida mientras corre un temporizador.
- **Ajustes**: plan semanal por día, alertas, exportar/importar los datos en JSON y borrar registros.
- **Comidas** (menú del día):
  - **Objetivo diario**: tope de calorías, proteína mínima y reparto en % entre desayuno, almuerzo, merienda y cena.
  - **Totales del día** contra el objetivo: calorías, proteínas, carbohidratos y grasas.
  - **Armar el día**: arma las cuatro comidas con lo disponible en la despensa, sin pasarse del tope y priorizando la proteína (proteína + carbohidrato + verdura y grasa en almuerzo/cena; proteína o lácteo + carbohidrato + fruta en desayuno/merienda). Lo que sobra o falta en una comida se compensa en las siguientes.
  - Por comida: **Otra opción**, agregar productos a mano, ajustar cantidades y **fijar** la comida para que el armador no la toque (se fija sola al editarla).
- **Despensa** (pestaña aparte):
  - Al escribir el nombre sugiere alimentos de una **base de referencia** (`alimentos.js`, ~90 alimentos) y completa macros, porción y comidas. Conviene revisar los valores con el envase.
  - **Cantidad que tenés**: "1 kg", "500 g", "1,5 l"… (también se puede escribir en el nombre: "pechuga de pollo 1kg"). Muestra la proteína y calorías totales de lo que tenés, cuánto usa el menú de la semana, y el armador no propone más de eso.
  - Tabla nutricional cada 100 g o ml (las calorías se calculan solas si no se ponen), tipo de alimento, porción habitual, comidas en que se usa y tilde de *disponible*.

## Estructura

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La app y el módulo de entrenamiento: HTML, CSS y JavaScript sin dependencias ni build. |
| `alimentos.js` | Base de alimentos de referencia para autocompletar la despensa. |
| `despensa.js` | Pestaña Despensa: productos, cantidades y autocompletado. |
| `menu.js` | Pestaña Comidas: menú del día, totales y armador automático. |
| `comidas.css` | Estilos de Comidas y Despensa. |
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
