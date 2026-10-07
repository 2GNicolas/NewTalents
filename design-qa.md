# QA visual — Feature 005, corrección de Fase 6

Fecha: 2026-09-16. Rama: `feature/005-player-passport-lifecycle`.

## Resultado y alcance

Se reemplazó la presentación escasa por shell atmosférico, identidad persistente, navegación responsive y tarjetas específicas de Resumen, Estadísticas, Partidos y Videos. Los ocho pares fuente/runtime finales fueron abiertos juntos y comparados visualmente; no quedan hallazgos P0/P1/P2 accionables dentro del alcance de presentación y los límites de producto descritos abajo. No se acredita finalización de Feature 005 ni de Fase 7.

Las ocho fuentes se imprimieron y abrieron individualmente a resolución original antes de editar frontend. Chrome local automatizado con Playwright temporal captura Expo Web real; no se agregaron dependencias al proyecto ni se modificaron credenciales o archivos de entorno. El bloqueo histórico de `iab` no aplica a esta ejecución en VS Code.

## Normalización, estado y autoridad

Fuentes móvil: 853 × 1844 px. Viewport CSS móvil: 853 × 1844, DPR 1. Fuentes escritorio: 1487 × 1058 px. Viewport CSS escritorio: 1487 × 1058, DPR 1. Capturas sin chrome del navegador y sin escalado del archivo. Los pares comparativos añaden únicamente etiquetas y separación; los PNG originales no se modifican. Se verificaron también 390/426/720/1024 CSS px, altura 900, movimiento reducido y ausencia de overflow horizontal.

Estado real: Tutor autorizado, pasaporte Activo, origen Tutor, identidad Samuel Ramírez, Delantero, Sub-13, Medellín, Colombia, Derecha; academia no disponible y fotografía neutral. Fixture determinista exclusivo de PostgreSQL local de desarrollo, creado/presentado/aprobado/activado por API real con autorizaciones separadas. Sesiones efímeras, refresh y restauración de Feature 004 reales; ningún password ni token impreso o guardado en disco, ningún response de producción simulado ni fallback de fixture en código frontend.

Las fuentes ilustran datos deportivos y un retrato que NO existen en el contrato entregado. Por tanto, se compara composición, regiones, etiquetas, jerarquía y dirección visual; NO se declara reproducción píxel a píxel de estados de contenido distintos. Diferencias obligatorias, no defectos de fidelidad:

- FR-024 y Principle X de la constitución: navegación vertical debajo de la identidad en la columna izquierda de escritorio, aunque los PNG web muestran pestañas sobre el contenido. El pedido también exige expresamente ese menú vertical.
- FR-035: iniciales locales neutrales en el área fotográfica; sin retrato, carga ni referencia persistida.
- FR-026–028: datos autorizados reales y estados no disponibles; sin radar numérico, barras de rendimiento, partidos, thumbnails, YouTube, comparación, filtros o compartir operables ficticios.
- El estado/historial técnico y el menú de sesión son secundarios. El pasaporte Activo entra a `/passports/{passportId}/sections/resumen`.

## Matriz final: ocho comparaciones

`passportId` del fixture QA: `78435f38-dfbd-401a-a5eb-7ef37a9f43eb`. Cada sección mapea a `/passports/{passportId}/sections/{resumen|estadisticas|partidos|videos}`.

| Sección | Viewport CSS / PNG | Referencia exacta | Captura runtime exacta | Diferencias corregidas | Diferencias restantes | Resultado |
|---|---|---|---|---|---|---|
| Web Resumen | 1487×1058 / DPR 1 | `C:/Proyectos/NewTalents/docs/design/passport-web-summary.png` | `C:/Proyectos/NewTalents/.expo/visual-qa/final/passport-web-summary.png` | Identidad proporcional; fondo; dos regiones de capacidades/rendimiento; jerarquía; menú lateral y ciclo secundario | Diferencias obligatorias anteriores; textura/halo P3 | passed |
| Web Estadísticas | 1487×1058 / DPR 1 | `C:/Proyectos/NewTalents/docs/design/passport-web-statistics.png` | `C:/Proyectos/NewTalents/.expo/visual-qa/final/passport-web-statistics.png` | Cabecera, banda ofensiva, pares creación/aporte y tendencia/lectura; tipografía legible y densidad desktop | Sin cifras, barras, conclusión ni filtros ficticios; textura/halo P3 | passed |
| Web Partidos | 1487×1058 / DPR 1 | `C:/Proyectos/NewTalents/docs/design/passport-web-matches.png` | `C:/Proyectos/NewTalents/.expo/visual-qa/final/passport-web-matches.png` | Tarjeta de recorrido, banda agregada, región de listado con mensaje de ausencia centrado, nota editorial | Región sin filas deportivas por contrato; textura/halo P3 | passed |
| Web Videos | 1487×1058 / DPR 1 | `C:/Proyectos/NewTalents/docs/design/passport-web-videos.png` | `C:/Proyectos/NewTalents/.expo/visual-qa/final/passport-web-videos.png` | Destacado/momentos en dos columnas, categorías, región de completos, regreso funcional a Resumen | Sin thumbnails, URLs ni compartir ficticios; textura/halo P3 | passed |
| Móvil Resumen | 853×1844 / DPR 1 | `C:/Proyectos/NewTalents/docs/design/passport-mobile-summary.png` | `C:/Proyectos/NewTalents/.expo/visual-qa/final/passport-mobile-summary.png` | Identidad horizontal, marcador proporcional, pestañas debajo, ambas tarjetas completas y espaciado corregido | Iniciales y estados no disponibles obligatorios; textura/halo P3 | passed |
| Móvil Estadísticas | 853×1844 / DPR 1 | `C:/Proyectos/NewTalents/docs/design/passport-mobile-statistics.png` | `C:/Proyectos/NewTalents/.expo/visual-qa/final/passport-mobile-statistics.png` | Seis regiones completas, listas compactas, etiquetas sin colisión; tres columnas en banda ofensiva a anchos reales estrechos | Texto de ausencia más largo que cifras del referente; sin controles futuros; textura/halo P3 | passed |
| Móvil Partidos | 853×1844 / DPR 1 | `C:/Proyectos/NewTalents/docs/design/passport-mobile-matches.png` | `C:/Proyectos/NewTalents/.expo/visual-qa/final/passport-mobile-matches.png` | Identidad/pestañas persistentes entre rutas, banda agregada, ausencia diseñada, nota sin datos inventados | No se dibujan filas de partidos inexistentes; textura/halo P3 | passed |
| Móvil Videos | 853×1844 / DPR 1 | `C:/Proyectos/NewTalents/docs/design/passport-mobile-videos.png` | `C:/Proyectos/NewTalents/.expo/visual-qa/final/passport-mobile-videos.png` | Destacado compacto horizontal, momentos apilados, completos y regreso dentro del encuadre; eliminado espacio producido por flex desktop en móvil | Sin evidencia ficticia; textura/halo P3 | passed |

Evidencia conjunta abierta: `C:/Proyectos/NewTalents/.expo/visual-qa/final/compare-{web|mobile}-{summary|statistics|matches|videos}.jpg` (ocho archivos). Detalle de identidad/navegación abierto: `C:/Proyectos/NewTalents/.expo/visual-qa/final/focus-web-identity.jpg` y `C:/Proyectos/NewTalents/.expo/visual-qa/final/focus-mobile-identity.jpg`. Además se inspeccionó `responsive-390.png` y `keyboard-focus.png`; las capturas se conservan en directorio ignorado, no son assets de producción.

## Historial de corrección y evidencia posterior

Cada directorio conserva ocho PNG y ocho pares `compare-*.jpg`, salvo el diagnóstico de consola, que no fue gate visual.

| Iteración / evidencia | Hallazgos | Corrección y comprobación posterior |
|---|---|---|
| Bloqueo histórico | Navegador integrado no disponible; no había capturas | Superado usando Chrome local y Playwright temporal autorizado; no requirió Codex Desktop |
| `.expo/visual-qa/baseline/` | P1: fondo plano, identidad diminuta y circular, presentación técnica, tres secciones como alerta genérica; P2: tipografía, composición, pestañas y superficies | Reconstrucción de shell, identidad, navegación y cuatro cuerpos de sección; evaluación posterior en `iteration-1` |
| `.expo/visual-qa/iteration-1/` | P2: texto desktop diminuto; listas y mensajes móviles demasiado altos; etiquetas estadísticas chocaban | Escala desktop independiente, listas compactas, mensajes horizontales, ancho de texto acotado; recaptura `iteration-2` |
| `.expo/visual-qa/iteration-2/` | P2: Resumen/Estadísticas/Videos móvil cortaban regiones posteriores; densidad desktop insuficiente | Escala de contenido móvil separada de identidad, tipografía secundaria desktop, menos padding en ausencia; recaptura `iteration-3` |
| `.expo/visual-qa/iteration-3/` | P2: Lectura rápida todavía fuera del encuadre; video destacado móvil demasiado alto; proporciones desktop demasiado compactas | Densidad específica de Estadísticas, video vacío compacto en móvil, altura reservada de regiones desktop; recaptura `iteration-4` |
| `.expo/visual-qa/iteration-4/` | P2: flex de tarjetas desktop igualaba alturas apiladas de móvil y dejaba espacio innecesario; mensaje de Partidos desktop no estaba centrado | Flex solo desktop, región de ausencia centrada; recaptura `iteration-5` |
| `.expo/visual-qa/iteration-5/` | Sin P0/P1/P2 visuales. Consola reveló favicon de desarrollo 404, P3 | Diagnóstico identificó exclusivamente `/favicon.ico`; no se ocultaron errores de aplicación. Se distingue de errores de página/API. Mejorados guards de texto corrupto/técnico y mensajes de estado vacío; recaptura `final` |
| `.expo/visual-qa/final/` | Ocho pares y dos detalles inspeccionados tras últimos cambios; sin P0/P1/P2 accionables | Gate visual aprobado; empieza verificación final de frontend, no Fase 7 |

## Cinco superficies de fidelidad

- Tipografía: Arial/Helvetica/sans-serif no redondeada en web y familia de sistema nativa; nombre en negrita, posición lima, categoría atenuada, encabezados separados del cuerpo. Escala desktop independiente; no colisiones ni truncado técnico. Texto largo de ausencia se adapta sin tratarlo como cifra. El referente no entrega una fuente identificada; diferencias ópticas residuales menores son P3.
- Espaciado/composición: márgenes, radios, área fotográfica y pestañas móviles medidos respecto de fuentes; desktop es dos columnas con menú lateral, no móvil estirado. Grid de Estadísticas y Videos independiente. Sin regiones cortadas en los ocho encuadres finales; móviles estrechos usan scroll vertical normal y mantienen sus controles disponibles.
- Colores/superficies: negro/esmeralda, glass oscuro translúcido, difusión del fondo en web, bordes verdes finos, lima y blancos rotos. Tokens de pasaporte aislados; sin cambiar el diseño de autenticación Feature 004.
- Imágenes/iconos: logo existente separado del marcador de jugador; fondo atmosférico local ya aprobado en Feature 004, reutilizado sin modificarlo; iconos outline Tabler MIT, PNG transparentes de 192 px para consumo web/native sin nueva dependencia. Sin retrato de referencia, fake thumbnail ni gráficos deportivos decorativos.
- Contenido: nombre/perfil consumidos del contrato real; Medellín acentuado correctamente. Entradas corruptas o técnicas se presentan No disponible, sin adivinar una reparación. Ausencias explícitas, diferenciación de vacío/restringido, ningún cero, rating, marcador de partido, UUID/fingerprint/documento, valor de fixture o afirmación deportiva inventada en las secciones.

## Interacción y límites de verificación

Chrome: ocho rutas visitadas usando las pestañas; nombre/identidad presente en cada sección. Restauración tras reload de deep link, regreso Videos → Resumen, menú de sesión abre/cierra controles existentes, acceso secundario a estado/historial y entrada `/` del actor QA Activo → Resumen: passed. Tab enfoca Resumen con contorno visible; captura `keyboard-focus.png`. Targets de navegación y acciones de al menos 44 px. Cero errores de página, cero errores de consola de aplicación y cero respuestas API fallidas en el recorrido. Una solicitud al favicon inexistente de Expo devuelve 404, registrado aparte como P3.

Esta verificación visual móvil es Expo Web con viewport móvil, no un emulador Android/iOS ni una auditoría completa con lector de pantalla. Capacidades/estados de todos los roles se cubren con pruebas frontend existentes; la matriz visual usa Tutor Activo representativo. Backend completado se conserva; corrección de dominio adulto/menor permanece pendiente y fuera de alcance. El mapper existente no entrega aún un nombre de academia; el frontend respeta null y no inventa ese dato.

## Seguimiento P3

1. La textura atmosférica reutilizada y la intensidad óptica del halo no son idénticas a las ocho imágenes; la dirección esmeralda/glass y el contraste se conservan. No se extrae fondo con datos/retrato desde los mockups.
2. Afinado óptico de fuente/wordmark una vez que exista el asset/fuente exacto aprobado.
3. Favicon de desarrollo Expo ausente (404), independiente de la presentación de pasaporte.

## Verificación final posterior al gate visual

Resultados ejecutados después de abrir y aprobar los ocho pares finales:

| Comprobación | Resultado |
|---|---|
| Presentación/navegación/accesibilidad/availability focalizadas | 4 suites, 26 pruebas passed |
| `npm run test:frontend` | 33 suites passed; 130 pruebas passed, 2 skipped existentes |
| `npm run typecheck --workspace=@new-talents/frontend` | passed |
| `npm run export:web --workspace=@new-talents/frontend` | passed; 28 rutas estáticas, salida `apps/frontend/dist` ignorada |
| `git diff --check` | passed |

El primer intento de suite + export simultáneos colisionó al limpiar el mismo `dist` (EPERM). La suite contiene un smoke que ejecuta Expo export. Se repitió la suite completa sola y luego la exportación sola: ambas pasaron sin cambios de código ni borrado manual de archivos. Se reconcilió solo el checkpoint afectado de Fase 6 y sus referencias a implementación/pruebas. Los marcadores T066–T070 de Fase 7 continúan sin marcar; no se implementó la corrección adulto/menor, no se hizo commit, push, merge ni deploy.

Entorno: PostgreSQL healthy, cuatro migraciones actuales; NestJS 3000 y Expo Web 8081 en ejecución. URLs comprobadas HTTP 200: `http://localhost:3000/health/live`, `http://localhost:3000/health/ready`, `http://localhost:8081`. La ruta QA requiere relación con su Tutor; una sesión de otro actor no obtiene acceso por conocer su URL.

final result: passed

---

# Design QA — Feature 007 Administrator home

## Evidence

- Sources: `docs/design/admin-custody/administrator-home-desktop.png` and `administrator-home-mobile.png`.
- Runtime: `.runtime/feature-007-visual/home/desktop.png` at 1440x1024 and `.runtime/feature-007-visual/home/mobile.png` at 390x844.
- Route: direct `/admin` inside the existing Administrator shell.

## Result

PASS. Desktop and mobile preserve the approved emerald shell, four-card hierarchy, desktop rail/mobile bottom navigation, Analyst workload, priority actions, typography, glass surfaces, and lime/orange/green status treatment. The 390px runtime document equals the viewport width and has no horizontal overflow; mobile content remains scrollable above the fixed bottom navigation.

The implementation deliberately labels the second card `Expedientes confirmados` and offers consultation only. Counts and workloads come from existing authorized Feature 007 projections; no backend endpoint, mutation, invented production metric, or Feature 006 rule was added. Named semantic actions, text/icon cues beyond color, 44px-or-larger controls, recoverable states, and motion-independent content satisfy the focused accessibility gate.

final result: passed

---

# Visual QA — Feature 006, hallazgos de revisión manual

Fecha: 2026-09-29. Alcance exclusivo: fondo de entrada/formularios, selectores compartidos, alineación de campos, conflicto exacto de documento y salida del estado de solicitud. No se ejecutó Converge ni se revalidaron flujos no relacionados.

## Evidencia y resultado

- Fondo: en Chrome 1920×945 la capa fija y la imagen miden exactamente 1920×945; en 390×844 miden 390×844. Tras desplazamiento conservan `top=0`, cubren el viewport completo y mantienen el gradiente oscuro inferior, sin franja lateral, mosaico ni costura.
- Municipio: el selector compartido se renderiza como capa fija hija de `body`, con fondo `rgb(3,24,17)`, opacidad `1`, `z-index: 10000` y scroll vertical. En el solapamiento escritorio con “Guardar y continuar”, `elementFromPoint` devuelve la opción municipal y no el botón. El selector de tipo de documento usa la misma capa.
- Alineación: todas las ranuras de etiqueta miden 40 px. En la fila del responsable, “Fecha de nacimiento”, “País de la persona responsable”, “Municipio de la persona responsable” y “Teléfono obligatorio” terminan en la misma coordenada vertical aun cuando Municipio ocupa dos líneas.
- Conflicto: con un identificador sintético ya existente, el clic real en “Guardar y continuar” mantuvo el foco en “Número de documento” y mostró “Ya existe un registro con este documento”. No apareció error en correo ni “Error al enviar”.
- Estado: en 390×844 y 1920×945 existe exactamente un botón “Cerrar sesión” y cero acciones “Volver al inicio”. En escritorio el botón ocupa y=896..927 dentro de un viewport de 945 px, por lo que permanece visible.
- Referencias comparadas: `natural-person-academy-information-{desktop|mobile}.png` y `applicant-correction-status-{desktop|mobile}.png`. Se preservaron la composición, jerarquía, superficies esmeralda/glass y acciones aprobadas; los cambios son correctivos, no un rediseño.
- Consola: cero errores de aplicación. Persisten únicamente avisos de desarrollo preexistentes de React Native Web sobre `shadow*` y `pointerEvents`.

## Verificación automatizada

- Frontend focalizado: 4 suites, 64 pruebas, passed.
- Frontend typecheck: passed.
- Backend conflicto exacto: 1 suite, 3 pruebas, passed.
- PostgreSQL concurrencia: 1 suite, 4 pruebas, passed; conserva el aviso deprecado preexistente de `pg` sobre consultas simultáneas en un mismo cliente.

final result: passed

# Responsive correction — Feature 006, T077–T084

Date: 2026-09-25. Route: `/registration`. Browser: Chrome, DPR 1.

## Root cause and correction

The document root was a transparent, fixed-height Expo surface while the React Native `ScrollView` owned the longer content. The journey background used `minHeight: '100%'` beneath ancestors without a reliable dynamic viewport floor, clipped overflow, and let `ImageBackground` size its image layer to the source image's intrinsic 941 px height. On short mobile viewports, a sticky action then covered the options and made the remaining scroll content appear unreachable; viewport transitions could expose the browser's white fallback.

The correction gives `html`, `body`, and `#root` the canvas fallback, applies a `100dvh` floor on web, binds the image layer to the shell's full width and height, retains the bounded `ScrollView` as the single scroll owner, removes sticky overlay positioning from the mobile action, adds safe-area bottom padding, and clips horizontal overflow only. Desktop rail/content behavior is unchanged.

## Source and evidence

- Source visual truth: `docs/design/feature-006/solicitud/request-type-selection-desktop-mobile.png` (1487×1058 source board).
- Final runtime captures: `.tmp/feature006-design-qa/final-selection-{360x640|390x844|424x642|1440x1024}.png`, DPR 1.
- Final scrolled mobile evidence: `.tmp/feature006-design-qa/final-selection-{360x640|390x844|424x642}-bottom.png`.
- Joint normalized comparisons: `.tmp/feature006-design-qa/compare-final-selection-mobile.jpg` and `.tmp/feature006-design-qa/compare-final-selection-desktop.jpg`.
- Full-view comparison checked composition, rail/content proportions, mobile hierarchy, cards, action treatment, emerald background, typography, glass, borders, progress, spacing, and overflow. Focused bottom-state captures were required because short viewports intentionally scroll; they verify the last option, announcement, CTA, and final notice together.

## Runtime matrix

| Viewport | Document | Scroll owner | Final scroll | Horizontal overflow | Reachability/background | Result |
|---:|---:|---:|---:|---:|---|---|
| 360×640 | 360×640 | 640 / 1067 px | 427 / 427 px | 0 px | Last option, CTA, and complete final notice visible; image 360×640; body/root `rgb(3,8,6)` | PASS |
| 390×844 | 390×844 | 844 / 1021 px | 177 / 177 px | 0 px | Last option, CTA, and complete final notice visible; image 390×844; body/root `rgb(3,8,6)` | PASS |
| 424×642 | 424×642 | 642 / 1011 px | 369 / 369 px | 0 px | Last option, CTA, and complete final notice visible; image 424×642; body/root `rgb(3,8,6)` | PASS |
| 1440×1024 | 1440×1024 | 1024 / 1058 px | 34 / 34 px | 0 px | Desktop rail/content preserved; image and fallback cover 1440×1024 | PASS |

## Comparison history

| Iteration | Finding | Fix and post-fix evidence |
|---|---|---|
| Reproduction | P0: 424×642 used a transparent fixed document, clipped emerald shell, nested 983 px content, and sticky CTA covering options | Added root fallback/dynamic viewport contract and normal-flow action; mobile bottom captures prove reachability |
| First correction | P1: `ImageBackground` still used the asset's intrinsic 941 px height, exposing fallback beneath the desktop shell | Added explicit 100% image dimensions; all four final captures measure the image exactly equal to the viewport |
| Final | No actionable P0/P1/P2 responsive findings | Four-size matrix passes with zero horizontal overflow and full mobile reachability |

## Console and preview safety

Chrome reported zero exceptions, routing errors, hydration errors, key warnings, failed assets, or application console errors. React DevTools/startup messages are development diagnostics. Remaining `shadow*` and `pointerEvents` messages are React Native Web deprecation warnings emitted while Expo Router eagerly imports pre-existing route modules; the Feature 006 journey/glass instances were migrated and no warning was suppressed.

`?preview=` remains guarded by `NODE_ENV !== 'production'`; its focused production test proves the ordinary first step is selected in production. It does not authenticate, authorize, upload, save, or submit. The production export contains no synthetic identity, contact, document, password, evidence filename/path, NIT, academy fixture, or test UUID canary.

## Required fidelity surfaces

- Typography and copy: existing approved hierarchy and wording preserved; short viewports scroll rather than truncate.
- Spacing/layout: mobile remains single-column, desktop proportions remain unchanged, and the action follows content without overlap.
- Colors/tokens: emerald image and `canvasDeep` fallback cover every viewport; lime progress, focus, border, and CTA treatment remain intact.
- Image quality/assets: the approved local emerald asset is reused at full shell size; no substitute asset or generated decoration was introduced.
- Glass and controls: existing blur, illuminated borders, card/field sizing, and touch dimensions are preserved.

final result: passed

---

# Visual QA — Feature 006, T077–T084

Date: 2026-09-25. Branch: `feature/006-registration-requests-approval`.

The 14 approved applicant references were opened and compared with 15 deterministic Expo Web captures. Runtime captures use 1440×1024 for desktop, 390×1850 for long mobile journeys, and 390×844 for request selection. The approved source files are 1487×1058 desktop boards and 853×1844 mobile boards; the selection source contains both desktop and mobile compositions.

Material corrections completed: category-first request selection; desktop rail/content proportions; true 390 px layout without horizontal overflow; single-column mobile hierarchy; viewport-bottom mobile actions; compact progress labels; glass opacity/borders; lime progress, focus, selection, and primary actions; safe empty-state summaries; and development-only deterministic preview routing. Remaining optical differences are P3: local system font metrics, simplified line icons, and intentionally absent synthetic personal values or evidence in production code.

| Approved reference | Runtime route | Viewport | Material differences corrected | Final |
|---|---|---:|---|---|
| `docs/design/feature-006/solicitud/request-type-selection-desktop-mobile.png` | `/registration` | 1440×1024 + 390×844 | Category-first Personal/Academia switch, two active-category cards, rail/progress hierarchy, sticky mobile action, full-width lime CTA | PASS |
| `docs/design/feature-006/solicitud/adult-account-identity-desktop.png` | `/registration/personal-adult?preview=identity` | 1440×1024 | Rail/content ratio, field grid, glass panel, progress and actions | PASS |
| `docs/design/feature-006/solicitud/adult-account-identity-mobile.png` | same | 390×1850 | Single-column fields, wrapped heading, exact-width cards, bottom action area, no horizontal overflow | PASS |
| `docs/design/feature-006/solicitud/adult-submission-review-desktop.png` | `/registration/personal-adult?preview=review` | 1440×1024 | Two-column review, evidence/summary grouping, consent and action hierarchy | PASS |
| `docs/design/feature-006/solicitud/adult-submission-review-mobile.png` | same | 390×1850 | Stacked review cards, readable evidence rows, safe summary state, sticky actions | PASS |
| `docs/design/feature-006/solicitud/represented-minor-information-desktop.png` | `/registration/represented-minor?preview=minor` | 1440×1024 | Separate representative/minor regions, mandatory phone context, balanced columns | PASS |
| `docs/design/feature-006/solicitud/represented-minor-information-mobile.png` | same | 390×1850 | Single-column ordering, field/card widths, no minor-account notice, sticky actions | PASS |
| `docs/design/feature-006/solicitud/represented-minor-submission-review-desktop.png` | `/registration/represented-minor?preview=review` | 1440×1024 | Evidence and identity columns, separate legal-authority/consent controls | PASS |
| `docs/design/feature-006/solicitud/represented-minor-submission-review-mobile.png` | same | 390×1850 | Stacked evidence/representative/minor hierarchy and viewport action area | PASS |
| `docs/design/feature-006/solicitud/formal-academy-information-desktop.png` | `/registration/academy-formal?preview=academy` | 1440×1024 | Formal type banner, NIT/organization fields, compact desktop grid | PASS |
| `docs/design/feature-006/solicitud/formal-academy-information-mobile.png` | same | 390×1850 | Single-column formal fields, exact card width, pending-academy notice | PASS |
| `docs/design/feature-006/solicitud/natural-person-academy-information-desktop.png` | `/registration/academy-natural-person?preview=academy` | 1440×1024 | Natural-person type banner, operational fields, neutral non-certification notice | PASS |
| `docs/design/feature-006/solicitud/natural-person-academy-information-mobile.png` | same | 390×1850 | Single-column operating-person hierarchy, wrapped declaration, no overflow | PASS |
| `docs/design/feature-006/solicitud/natural-person-academy-submission-review-desktop.png` | `/registration/academy-natural-person?preview=review` | 1440×1024 | Academy/responsible/evidence/declaration grouping and neutral certification wording | PASS |

Capture directory: `C:/Proyectos/NewTalents/.tmp/feature006-design-qa`. Every final capture reports `innerWidth` equal to its requested viewport and `documentElement.scrollWidth` equal to `innerWidth`.

Preview safety: `?preview=` only selects a deterministic visual step outside production. Production resolves every preview request to the ordinary first step; no authentication, ownership, API mutation, or submission boundary is bypassed. Runtime defaults contain no synthetic identity, document number, phone, academy name, NIT, filename, evidence, password, or token.

final result: passed

---

# Visual QA — Feature 006, T085–T087

Date: 2026-09-25. The approved correction/status desktop and mobile references were compared alongside final Expo Web runtime output. The earlier fourteen Phase 7 references retained their existing evidence because no shared-shell change materially altered their layouts; the opt-in compact brand variant is used only by the status composition.

The status screen preserves the approved full-width emerald/liquid-glass hierarchy, desktop request rail, safe correction reason, three-step timeline, category-only evidence target, primary correction action, secondary summary action, and continuous mobile background. Responsive corrections made during QA removed horizontal clipping, moved the concise privacy notice to the approved mobile position, kept the fuller desktop notice, and preserved normal scroll on short devices.

| Runtime evidence | Width/height | Scroll/overflow result | Fidelity result |
|---|---:|---|---|
| `.tmp/feature006-design-qa/status-desktop-1440x1024.png` | 1440×1024 | 0 px horizontal overflow; full composition visible | PASS |
| `.tmp/feature006-design-qa/status-mobile-390x844.png` | 390×844 | 844 / 1086 px internal scroll; 0 px horizontal overflow | PASS |
| `.tmp/feature006-design-qa/status-short-424x642.png` plus `-bottom.png` | 424×642 | 642 / 1009 px; terminal actions/footer reachable; 0 px horizontal overflow | PASS |
| `.tmp/feature006-design-qa/status-comparison.png` | joint board | source and runtime inspected together | PASS |

Accessibility: semantic labeled buttons, assertive/polite live regions, visible keyboard-focus borders in normal mode, 46–50 px minimum mobile controls, warning communicated with icon/text/border as well as color, and no motion/transition in the status flow. The development preview is deliberately disabled and mutation-free; the authenticated normal route alone owns restore, upload, resubmit and capability refresh.

No P0/P1/P2 findings remain. P3 differences are limited to local system-font metrics, simplified line-glyph rendering, and background crop variation from the shared approved asset.

final result: passed

---

# Design QA — Feature 007 Administrator passport detail

## Evidence

- Source: `docs/design/admin-custody/administrator-passport-detail-desktop.png`
- Source: `docs/design/admin-custody/administrator-passport-detail-mobile.png`
- Runtime: `.runtime/feature-007-visual/passport-detail/desktop.png`
- Runtime: `.runtime/feature-007-visual/passport-detail/mobile.png`
- Combined comparisons: `.runtime/feature-007-visual/passport-detail/*-comparison.png`

## Checklist

- [x] Desktop and mobile hierarchy follows the approved custody-detail direction.
- [x] Emerald background, translucent dark panels, restrained lime, and shared shell are preserved.
- [x] Mobile content is readable without horizontal scrolling or overlapping sections.
- [x] Interactive controls meet the 44px minimum and expose accessible names.
- [x] Heading focus, invalid-reason focus, Escape/cancel, and focus return were exercised.
- [x] Reduced motion does not remove any required information or interaction.
- [x] Protected identity, evidence, contact, credential, and object-storage fields are structurally absent.

## Disposition

PASS with documented contract-driven deviations. The reference contains richer profile/location content than the closed Feature 007 response permits; the implementation keeps the approved visual language while displaying only authorized minimum projections.

---

# Design QA — Feature 007 confirmed dossiers

## Evidence

- Sources: `docs/design/admin-custody/dossiers-list-desktop.png`, `dossiers-list-mobile.png`, `dossier-detail-desktop.png`, and `dossier-detail-mobile.png`
- Runtime: `.runtime/feature-007-visual/dossiers/{desktop-list,mobile-list,desktop-detail,mobile-detail}.png`
- Verification record: `specs/007-administrator-requests-passport-custody/verification/dossiers-visual.md`

## Result

PASS. The list/detail hierarchy, shared shell, responsive cards, linked-record treatment, history presentation, touch targets, focus behavior, and emerald/lime visual direction match the approved references. No P0/P1/P2 issues remain after correcting the mobile detail hero wrapping and direct-entry back fallback.

The omitted pending-confirm rows, mutation controls, and evidence panel are required contract deviations: US8 is confirmed-record consultation only and exposes privacy-minimal projections. P3 differences are limited to local font/glyph metrics, synthetic row density, and background crop.

final result: passed
