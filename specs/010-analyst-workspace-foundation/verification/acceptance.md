# Reconciliación de aceptación — Feature 010

Fecha: 2026-10-15. Estados: **pasó** = evidencia positiva del alcance disponible; **falló** = discrepancia conocida; **no verificado** = falta evidencia suficiente para afirmar el criterio completo. [Backend](backend.md), [frontend](frontend.md) y [revisión Chrome](visual-review.md) son las fuentes de evidencia. Esta matriz no equivale a aprobación de despliegue.

## Historias

| Criterio | Estado | Evidencia / límite |
|---|---|---|
| US1 Inicio | Pasó | Contrato, clasificación antes/en/después del instante `America/Bogota` y Chrome autenticado; `LOADED` no se presenta como realizado. |
| US2 Pasaportes | Pasó | Integración de custodia/contacto, lista/detalle Chrome, vacío y denegación segura. |
| US3 Partidos | Pasó | Integración de agenda y detalle, cambios `WAITING/LOADED/CANCELED`, navegación Chrome; no se creó fuente posterior. |
| US4 Revocación y privacidad | Pasó | Suite PostgreSQL de revocación, contrato transversal y suite frontend de limpieza por `401/403/404`; Chrome comprobó enlaces directos inexistentes. |

## Requisitos funcionales

| Requisito | Estado | Evidencia / límite |
|---|---|---|
| FR-001 | Pasó | Entrada autenticada y tres rutas reales; seis referencias comparadas. La fidelidad gráfica no es exacta (ver SC-006). |
| FR-002 | Pasó | Autorización por identidad/rol, pasaporte `ACTIVE` y custodia actual en colecciones y detalles, integración y contrato. |
| FR-003 | Pasó | Revocación en siguiente petición, limpieza cliente, `404` indistinguible de ajeno/inexistente. |
| FR-004 | Pasó | Tres secciones excluyentes, límite de Bogotá, `LOADED/CANCELED` fuera de pendientes/próximos, realizados no disponible. |
| FR-005 | Pasó | Nombre propio, referencia secundaria y próximo confirmado; detalle sin datos civiles no autorizados. |
| FR-006 | Pasó | Agenda paginada de registros confirmados disponibles; interfaz de fuente independiente del orden, sin registrar fuentes futuras. |
| FR-007 | Pasó | «Ver partido» abre detalle solo lectura; reagendamiento/cancelación/carga de la fuente se reflejan al consultar. |
| FR-008 | Pasó | Adaptador `FirstMatch` y clasificación sin cambiar `WAITING/RESERVED` ni invocar carga. |
| FR-009 | Pasó | Sin filas posteriores, análisis, borradores ni métricas inventados; `LOADED` no acredita análisis. |
| FR-010 | Pasó | No hay «Borrador guardado», «Continuar» ni «Ver historial» operativos. |
| FR-011 | Pasó | Solo endpoints `GET` del espacio; pruebas de ausencia de efectos persistentes y contrato de privacidad. |
| FR-012 | Pasó | Integración de titular/representante/responsable, canales atribuibles y ambigüedad; nombre/contacto solo tras autorización y contacto solo en detalle. |
| FR-013 | Pasó | Matriz Chrome autenticada a 1440 × 900 y 390 × 844: teclado, foco visible, encabezados/roles/nombres y carga, vacío, error, restricción e indisponibilidad en Inicio, Pasaportes y Partidos. El alcance aprobado es web, sin prueba nativa de voz. [Evidencia](visual-review.md#cierre-web-de-fr-013-y-sc-005-2026-10-15). |
| FR-014 | Pasó | No se añadieron captura, transición `LOADED`, FEM, pagos, publicación, filtros ni gestión de partidos. |

## Resultados medibles

| Criterio | Estado | Evidencia / límite |
|---|---|---|
| SC-001 | Pasó | Inicio → Pasaportes → detalle y Inicio → «Ver calendario» → Partidos → detalle en Chrome autenticado; capturas escritorio/móvil. |
| SC-002 | Pasó | Pruebas de colección y enlace directo cubren custodia actual y fuente disponible; fuente no inicial futura solo se ejercita como interfaz sintética de prueba. |
| SC-003 | Pasó | Integración PostgreSQL y frontend confirman revocación en consulta siguiente y descarte de detalles. |
| SC-004 | Pasó | Pruebas de reloj y contrato más Chrome con un pendiente, uno futuro y un `LOADED`; ninguna acción o fila futura ficticia. |
| SC-005 | Pasó | La matriz Chrome de las tres vistas y ambos tamaños distingue los estados sin retener datos al revocar acceso; Tab/Enter alcanzaron acciones y detalles, `:focus-visible` tuvo contorno verde y el árbol mostró encabezados, avisos y nombres correctos. [Evidencia](visual-review.md#cierre-web-de-fr-013-y-sc-005-2026-10-15). |
| SC-006 | Falló; desviación aceptada por el propietario | Se conservan composición e información principales, pero la fotografía/iluminación de Inicio, el avatar fotográfico y la línea decorativa de la agenda móvil no se reproducen; no todas esas diferencias se explican solo por falta de datos ilustrativos. El propietario aceptó estas diferencias documentadas para el cierre; esto no acredita fidelidad exacta a los PNG. |
| SC-007 | Pasó | Pruebas de las cuatro variantes de origen/contacto, canales ausentes/ambiguos y revocación; Chrome confirmó nombre propio y correo solo en detalle. |

## Límites y siguiente revisión

Feature 010 no habilita análisis completados, borradores, reanudación, historial ni programación de partidos posteriores: faltan sus fuentes/contratos autoritativos. El teléfono histórico de una solicitud no se atribuye a otra persona ni se asume actualizado; un responsable de academia no inequívoco produce «Contacto no disponible». FR-013 y SC-005 quedan verificados para teclado, foco y árbol **web** en la matriz documentada; esto no afirma certificación WCAG general ni requiere pruebas nativas. El propietario aceptó las diferencias visuales ya documentadas, sin alterar los PNG; SC-006 conserva el estado de fidelidad literal previamente registrado y no se reinterpreta como una verificación nueva. La base y servicios sintéticos de revisión permanecen levantados para la comprobación manual solicitada.

## Adenda: altura adaptable de Inicio móvil (2026-10-15)

US1 y la parte responsive de FR-013/SC-005 se reexaminaron por el solape comunicado entre «Ver calendario» y «Análisis realizados». [La revisión Chrome y sus capturas](visual-review.md#corrección-de-solape-móvil-en-inicio-2026-10-15) documentan el fallo previo y la separación posterior de 43 px a 390 × 844 y 320 × 700 CSS px; las dos columnas permanecen alineadas a 1440 × 900. La prueba frontend de texto largo a ambos anchos falló antes y pasó después junto con la suite del shell (9/9). La pasada posterior de los cinco estados web y el árbol en las tres vistas y ambos tamaños cierra FR-013/SC-005. SC-006 no cambia por esta corrección. No se añadieron análisis, borradores ni acciones nuevas.
