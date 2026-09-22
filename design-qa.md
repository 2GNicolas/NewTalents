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
