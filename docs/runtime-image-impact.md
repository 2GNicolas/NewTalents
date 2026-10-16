# Impacto de los gráficos de la aplicación

Auditoría de los **21 recursos preexistentes** de `apps/frontend/assets/` mediante búsqueda de referencias en `apps/frontend/src` y `apps/frontend/app` (2026-10-15). No se retiró ninguno. Las rutas listadas son recursos de ejecución, no evidencia visual archivada.

| Recurso | Uso detectado | Si se retirara sin cambiar código |
|---|---|---|
| `apps/frontend/assets/authentication/liquid-emerald-abstract-v1.png` | Entrada pública; paneles de autenticación, registro, administración, pasaportes, primer partido y espacio del Analista | Los `require` estáticos dejarían de resolverse; fallaría el empaquetado web/nativo de esas pantallas. |
| `apps/frontend/assets/authentication/scouting-player-hero-v1.png` | `auth-hero.tsx`, ilustración de autenticación | El `require` estático impediría empaquetar el hero de autenticación. |
| `apps/frontend/assets/passport/icons/arrow-left.png` | `passport-icon.tsx` → `back` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/ball-football.png` | `passport-icon.tsx` → `football` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/building-community.png` | Sin referencia en `apps/frontend/src` ni `apps/frontend/app` | No se detectó rotura actual; quedaría indisponible para usos futuros. |
| `apps/frontend/assets/passport/icons/calendar.png` | `passport-icon.tsx` → `calendar` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/chart-bar.png` | `passport-icon.tsx` → `chart` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/chart-radar.png` | `passport-icon.tsx` → `radar` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/chevron-right.png` | `passport-icon.tsx` → `next` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/dots-vertical.png` | `passport-icon.tsx` → `more` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/file-description.png` | `passport-icon.tsx` → `history`; `admin-home.tsx` → tarjetas de solicitudes/expedientes | Los `require` estáticos dejarían de resolverse en pasaportes y Inicio administrativo. |
| `apps/frontend/assets/passport/icons/info-circle.png` | `passport-icon.tsx` → `info` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/lock.png` | `passport-icon.tsx` → `lock` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/logout.png` | Sin referencia en `apps/frontend/src` ni `apps/frontend/app` | No se detectó rotura actual; quedaría indisponible para usos futuros. |
| `apps/frontend/assets/passport/icons/map-pin.png` | `passport-icon.tsx` → `location` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/player-play.png` | Sin referencia en `apps/frontend/src` ni `apps/frontend/app` | No se detectó rotura actual; quedaría indisponible para usos futuros. |
| `apps/frontend/assets/passport/icons/shield-star.png` | `passport-icon.tsx` → `academy`; `admin-home.tsx` → custodia sin Analista | Los `require` estáticos dejarían de resolverse en pasaportes y Inicio administrativo. |
| `apps/frontend/assets/passport/icons/shoe.png` | `passport-icon.tsx` → `foot` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/target.png` | `passport-icon.tsx` → `target` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |
| `apps/frontend/assets/passport/icons/users.png` | `passport-icon.tsx` → `team`; `admin-home.tsx` → custodia con Analista | Los `require` estáticos dejarían de resolverse en pasaportes y Inicio administrativo. |
| `apps/frontend/assets/passport/icons/video.png` | `passport-icon.tsx` → `video` | Faltaría la imagen requerida por el módulo de iconos; fallaría el empaquetado del pasaporte. |

`passport-icon.tsx` contiene `require` estáticos: la ausencia de un archivo referenciado causa un error de resolución del módulo incluso si una clave concreta no se muestra en una pantalla. Para los tres recursos sin referencia no se afirma que sean prescindibles para diseños futuros; solo que la búsqueda actual no encontró importaciones.

Además, cinco PNG aprobados de Feature 009 permanecen en `docs/design/feature-009/` porque `first-match-surface.tsx` los carga mediante `require` estáticos. Retirar cualquiera de ellos sin cambiar el componente rompería el empaquetado del hero de primer partido. Sus copias externas también están verificadas. La sexta referencia, `first-match-scheduling-desktop.png`, no tiene importación de runtime y permanece únicamente en el archivo externo. En total quedan **26 imágenes en el repositorio** (21 recursos de aplicación preexistentes + 5 diseños usados en runtime de Feature 009).
