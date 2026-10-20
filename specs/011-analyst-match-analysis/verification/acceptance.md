# Conciliación de aceptación — Feature 011

Fecha de última conciliación: 2026-10-20. **Pasó** exige evidencia indicada; **Parcial** delimita lo verificado y lo pendiente. No se equiparan Jest/typecheck con observación en Chrome. T038 está cerrada para el alcance web verificado, no para comprobaciones nativas ni para dos comparaciones imposibles por referencias ausentes.

Evidencia abreviada: **B** = [backend.md](backend.md) (dominio, contratos e integración PostgreSQL aislada); **F** = [frontend.md](frontend.md) (Jest enfocado y typechecks); **V** = [visual-review.md](visual-review.md) (Chrome y referencias). Los test concretos figuran con sus rutas/comandos en B y F.

## Escenarios de aceptación

| Criterio | Estado | Evidencia y límite |
|---|---|---|
| US1.1 Acceso a partido propio sin filtro ordinal | Pasó | B: acceso/fuente autoritativa; fuente posterior no contratada sigue inactiva. |
| US1.2 Evento, minuto y mediciones aplicables fieles | Pasó | B: validador; F/V: Gol, Asistencia y `FAILURE` omiten guía; resultado medido conserva cinco contextos y siete criterios. |
| US1.3 Resultado permitido y ausencia explícita | Pasó | B: catálogo y validación. |
| US1.4 No fabricar partido posterior | Pasó | B: prueba de fuente. |
| US1.5 No participó, cero y sin eventos | Pasó | B: validación/confirmación; F: captura y paso final. |
| US1.6 No observable ≠ no aplica | Pasó | B: validador; F: opciones guiadas. |
| US1.7 Sin campos de puntuación | Pasó | B: esquema/contrato; F: vistas y pruebas. |
| US1.8 Total entero, añadido y no derivado del evento | Pasó | B: casos 90+ y suplente; F: paso final. |
| US1.9 Revisión, paso final y corrección sin pérdida | Pasó | F y V: vuelta/corrección reales en ambos tamaños; entradas conservadas tras validación. |
| US1.10 Rueda circular, selección y «Cambiar» | Pasó (web) | F/V: sectores, iconos y familias externas al anillo en escritorio y 390×844; el titular aprueba la UI vigente. No se comparó con el PNG ausente de captura escritorio. |
| US1.11 Fila rotulada, avance y progreso corregible | Pasó (web) | F/V: elecciones explícitas, avance bloqueado ante grupo sin respuesta, contadores reales, corrección sin borrar otras respuestas y operación por teclado web. |
| US1.12 Guardado local desplegable | Pasó | F/V: lista inmediata, edición sin duplicar y cero cargas antes de confirmar. La UI vigente no ofrece observación; el campo API opcional permanece por compatibilidad. |
| US2.1 Carga válida y misma unidad `RESERVED → USED` | Pasó | B y V: dos confirmaciones Chrome sobre primeros partidos sintéticos, cada una con una sola carga y unidad `USED`. |
| US2.2 Sin efecto parcial, retención en validación y revocación segura | Pasó | B/F; V: error de minutos/URL retuvo entradas, conflicto dejó cero cargas y enlace revocado no mostró datos. |
| US2.3 Reintento idéntico y conflicto de otra intención | Pasó | B: idempotencia/carreras. |
| US2.4 Participación coherente y no participación explícita | Pasó | B y F: casos positivos, cero y contradicciones. |
| US2.5 Complejidad conservada sin indicador | Pasó | B: evento persistido, sin cálculo FEM. |
| US2.6 Carga no completa FEM ni «Análisis realizados» | Pasó | B: overview de Feature 010; F: Inicio indisponible. |
| US2.7 URL de YouTube válida, error corregible | Pasó | B/F; V: `422` con enlace ajeno, foco en enlace, corrección y confirmación posterior. |
| US3.1 `LOADED`/carga no crean tarjeta de realizado | Pasó | B/F; V: Inicio mantuvo «Análisis realizados» indisponible tras ambas cargas. |
| US3.2 Detalle privado de carga sin rating/publicación | Pasó | B/F; V: lectura privada real con URL, evento y observación; sin FEM ni publicación. |
| US3.3 No participó se ve como carga, no evaluación | Pasó | B y F. |
| US3.4 Revocación retira eventos, minutos y URL | Pasó | B/F; V: custodia temporal revocada, agenda y enlace directo negados, árbol sin contenido protegido. |

## Requisitos funcionales

| Criterio | Estado | Evidencia y límite |
|---|---|---|
| FR-001 Autorización vigente por recurso | Pasó | B: lectura/confirmación y revocaciones. |
| FR-002 Fuente autoritativa sin ordinal | Pasó | B: adaptador `FIRST_MATCH`. |
| FR-003 Evento sin valoración | Pasó | B: esquema, validador y carga; F: revisión. Observación opcional solo en contrato/lectura histórica, no en captura vigente. |
| FR-004 Tipos aprobados | Pasó | B: catálogo exhaustivo. |
| FR-005 Resultados por tipo sin derivación | Pasó | B: catálogo exhaustivo. |
| FR-006 Cinco contextos sin «no aplica» para resultados medidos | Pasó | B/F: Gol, Asistencia y `FAILURE` conservan `{}`; los demás exigen respuestas explícitas. |
| FR-007 Minuto de evento separado de total | Pasó | B: 90+ y suplente; F: paso final. |
| FR-008 Coherencia participación/eventos/minutos | Pasó | B y F. |
| FR-009 Siete criterios descriptivos | Pasó | B: validación; F: guía. |
| FR-010 Atajada, sin puntos/cálculo | Pasó | B: validador; F: captura. |
| FR-011 Confirmación atómica e idempotente | Pasó | B: transacción, rollback, carreras. |
| FR-012 Carga distinta de evaluación completada | Pasó | B y F: overview indisponible. |
| FR-013 URL y datos no públicos | Pasó | B: proyección responsable/pasaporte sin URL/eventos. |
| FR-014 Denegación uniforme y retiro tras revocación | Pasó | B: ajeno/inexistente y revocación; F: limpieza. |
| FR-015 Flujo/accesibilidad web y móvil | Parcial | V: flujo autenticado en escritorio y `390×844`, foco y teclado web. Tras la corrección, Chrome mostró un `h1` por etapa, secciones `h2` y evento revisado `h3`; el nombre del jugador es texto, no encabezado. Tab/Enter/Escape operaron captura, rueda, revisión y datos finales. Teclado virtual/lector nativo no probados. |
| FR-016 Fuera de alcance (sin publicación/FEM/partidos ficticios) | Pasó | B: esquema/fuente/overview; F: vistas. |
| FR-017 URL HTTPS YouTube y corrección | Pasó | B: validador; F: error `422`. |
| FR-018 Rueda y guía accesibles sin arrastre | Pasó (web) | F/V: rueda radial en ambos tamaños, familias externas, retorno de foco, selección guiada y corrección explícitas; UI aprobada por el titular. No se afirma comparación con los dos PNG ausentes ni prueba nativa. Temporal conserva bandas FEM manuales; duración/cálculo automático son alcance futuro. |
| FR-019 Guardar local/lista corregible | Pasó | F/V: guardado local inmediato, edición y lista expandible sin escritura temprana. Observación no aparece en la UI vigente. |

## Resultados medibles

| Criterio | Estado | Evidencia y límite |
|---|---|---|
| SC-001 Autorizados admitidos; ajenos/revocados denegados | Pasó | B: casos sintéticos probados en base aislada. |
| SC-002 Datos aceptados, minutos y URL correctos | Pasó | B: validación/persistencia; F: colección guardada. |
| SC-003 Atomicidad, reintentos y ninguna nota FEM | Pasó | B: rollback y carreras. |
| SC-004 Ninguna tarjeta sin evaluación completada | Pasó | B: overview; F: Inicio. |
| SC-005 Flujo completo y accesibilidad escritorio/móvil | Parcial | V: flujo web en ambos tamaños y nueva comprobación Chrome autenticada del árbol y teclado de las tres etapas. Con un Gol local, revisión mostró `h1 → h2 → h3 → h2` en escritorio y móvil. No se probó teclado virtual/lector nativo. Dos PNG ausentes impiden sus comparaciones específicas, no la verificación funcional web. |
| SC-006 Rueda, guía, corrección y guardado en ambos tamaños | Pasó (web) | F/V: sectores radiales, avance bloqueado hasta responder, corrección y guardado local observados en escritorio y 390×844; aprobación visual explícita del titular. Sin comparación contra los dos PNG ausentes. |

## Puertas y límites

El checklist de requisitos mantiene 16/16 marcas. La constitución y el diseño conservan privacidad, separación de pasaporte/FEM y atomicidad. No hubo cálculo/evaluación FEM, publicación de URL, partido posterior fabricado ni tarjeta de realizado por carga. La guía FEM consultada permanece intacta y exclusivamente local, fuera del repositorio por decisión del titular; las categorías necesarias de captura están recogidas en `spec.md` y los contratos, pero la fuente externa no queda disponible en el commit. La aprobación del titular cierra la aceptación visual de la **UI actual** en el alcance web observado. Los dos PNG ausentes impiden únicamente sus comparaciones específicas: no se sustituyeron ni se afirma haberlos cotejado. La jerarquía de encabezados y navegación por teclado ya se comprobaron de nuevo en Chrome autenticado; la verificación nativa de teclado virtual/lector sigue como límite explícito de FR-015/SC-005, por lo que no se proclama accesibilidad integral. Los fallos ajenos de suites generales documentados en B/F no se ocultan como verde de esas suites.

**Corrección de encabezados, 2026-10-20**: se añadió una regresión que falló con la secuencia anterior `[h2, h1, h2]` y pasó después del cambio para captura, revisión y datos finales, incluido un evento de revisión `h3`. El estilo no cambió. Frontend enfocado: **6 suites/41 pruebas**; typecheck frontend: pasó. Tras reautenticar el Analista sintético, Chrome verificó el árbol y el teclado en escritorio (`1536×730`) y viewport móvil (`390×844`); un Gol se guardó solo localmente para comprobar el `h3` revisado, sin confirmar la carga. FR-015/SC-005 pasan en este subalcance web y permanecen parciales únicamente por los límites de referencia/nativos detallados arriba.

**Cierre web T038, 2026-10-20**: el titular aprobó la UI de captura vigente y confirmó conservar las cinco bandas porcentuales FEM de Temporal. Su elección continúa manual, con «No observable»; Feature 011 no recoge duración reglamentaria ni calcula la banda. Esos dos pasos requieren una característica futura. Las rondas web autenticadas registradas en V cubrieron Gol, Asistencia, fallo, éxito medido, varios guardados locales, revisión, datos finales y confirmación sintética, además de rueda y progreso en escritorio y `390×844`. Esta pasada de cierre no hizo una confirmación adicional en navegador. Comprobaciones enfocadas actuales: frontend **6 suites/40 pruebas**, dominio backend **4/17**, contratos **2/8**, PostgreSQL aislado y secuencial **7/15** con base eliminada; ambos typechecks y herramienta de versión pasaron. Las observaciones históricas de cuadrícula o de observación visible no describen la UI vigente. **T038 [X] para verificación web documentada**, con FR-015/SC-005 parciales por los límites de accesibilidad indicados.
