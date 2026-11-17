# CLAUDE.md — Entreno Semanal (PWA)

Instrucciones para Claude Code al trabajar en este repositorio.
El README describe las funciones para el usuario; este archivo, lo que hace falta para tocar el código.

---

## 1. Contexto

PWA **offline, de un solo usuario**, para seguir un plan semanal de entrenamiento
(fuerza, cardio de bajo impacto, salud lumbar) y, desde la rama `comidas`, armar
el menú del día con lo que hay en la despensa. Se usa principalmente desde el
celular, instalada como app. Todo en español rioplatense (UI, commits, README).

## 2. Stack (decidido — no re-litigar sin motivo)

- **HTML + CSS + JavaScript vanilla**, sin dependencias, sin build, sin framework.
- Scripts clásicos (no módulos ES), cargados al final de `index.html` en este orden:
  `alimentos.js` → `despensa.js` → `menu.js`. Comparten globales con el script inline de `index.html`.
- Persistencia: **`localStorage`**, una sola clave `entreno-lumbar-v1` con un objeto `db`
  (`plan`, `logs`, `cfg`, `foods`, `nut`, `menus`). Se lee con `load()` / se guarda con `save()`
  en `index.html`. Campos nuevos: agregarlos a `defaults()` y, si son objetos anidados,
  al merge de `withDefaults()` para no romper datos ya guardados.
- Sin servidor ni cuentas. Backup = Ajustes → Exportar/Importar JSON: exporta `db` entero e
  importa pasando por `withDefaults()`, así que cualquier campo nuevo de `db` viaja solo.
- Hosting: GitHub Pages desde `main` / root (`.nojekyll`).

## 3. Archivos

| Archivo | Rol |
|---|---|
| `index.html` | App completa del módulo de entrenamiento (HTML + CSS + JS inline), navegación por pestañas, persistencia, ajustes. |
| `alimentos.js` | Base de referencia (~90 alimentos) para autocompletar la despensa. Solo datos. |
| `despensa.js` | Pestaña Despensa: productos, cantidades ("1 kg", "500 g"), autocompletado. |
| `menu.js` | Pestaña Comidas: objetivo diario, totales, armador automático, fijar comidas. |
| `comidas.css` | Estilos de Comidas y Despensa. |
| `sw.js` | Service worker, stale-while-revalidate. |

## 4. Reglas al hacer cambios

- **Subir la versión de caché en `sw.js`** (`const CACHE = 'entreno-vN'`) en cada cambio
  que se vaya a publicar; si no, los celulares con la app instalada no ven la versión nueva.
- **Archivo nuevo** que use la app → agregarlo a `SHELL` en `sw.js` (si no, no anda offline).
- Mantener el README al día cuando cambian funciones visibles (sección "Qué hace" y tabla de estructura).
- Probar en local con `npx serve .` o `python -m http.server 8000` (el SW necesita http).
- Pensar en mobile primero: pantallas chicas, uso con una mano.

## 5. Estado actual

_(Actualizar al cerrar cada sesión de trabajo.)_

- **2026-11-17** — Rama `comidas` con 2 commits **sin mergear a `main`** (ya pusheada a `origin/comidas`):
  "Días no cumplidos" y "Comidas y Despensa". Caché en `entreno-v3`.
  Próximo paso: probar en el celular y mergear/abrir PR a `main` para publicar.
