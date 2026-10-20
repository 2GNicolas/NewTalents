# Contrato UI: captura y carga de datos del partido

**Decisiones del titular 2026-10-20**: Gol y Asistencia permiten «Guardar evento» tras elegir tipo y minuto válido, sin control de resultado ni medición guiada; `NONE` solo es un valor interno del contrato. Cualquier evento con resultado explícito `FAILURE` también omite contexto y complejidad; una atajada fallida omite detalle de manos. Sus objetos confirmados de contexto y complejidad son `{}`; no representan «no observable» ni «no aplica». Los demás resultados conservan la guía completa. La captura no ofrece observación textual ni «Añadir otro evento»: guardar devuelve al botón circular. La participación se decide en captura y aparece de solo lectura en datos finales; con eventos guardados no se puede marcar «No participó». «Eventos capturados» y revisión muestran orden cronológico numérico (incluido añadido), con empate estable de captura, sin alterar los eventos.

**Aprobación de cierre web 2026-10-20**: se conserva la UI actual y los cinco tramos porcentuales de Temporal enumerados en FR-006, elegidos explícitamente o «No observable». La guía FEM se consultó localmente y no se distribuye en el repositorio por decisión del titular. Feature 011 no recoge duración reglamentaria real ni infiere/calcula el tramo desde `videoMinute`; recogerla y automatizar el cálculo corresponde a una característica futura. Los porcentajes ilustrativos de los PNG no crean categorías adicionales.

Referencia normativa: `spec.md`; datos y API: `data-model.md` y `analyst-match-upload.openapi.yaml`. Las referencias visuales de Feature 011 se conservan fuera del repositorio en `C:\Proyectos\NewTalents-Approved-Visual-References\Feature-011\captura\`; el inventario de las ocho referencias previas y sus SHA-256 figura en `../verification/design-reference-inventory.md`. No son recursos de runtime ni se toman nombres, cifras o acciones ilustrativas como datos o reglas de producto.

## Referencias visuales aprobadas (externas)

| Etapa | Escritorio | Móvil |
|---|---|---|
| Captura | `Analyst Match Event Capture-1.png` | `Mobile match event capture-2.png` |
| Revisión y corrección | `Review and correct match events-3.png` | `Analyst event review and correction-4.png` |
| Datos finales y validación | `Final minutes and YouTube link validation-5.png` | `Final Match Data Validation-6.png` |
| Carga confirmada | `Confirmed Match Data Upload-7.png` | `Match Data Upload Confirmed-8.png` |

Cuatro referencias adicionales de la interacción de captura en la misma ubicación externa: `Circular event capture, initial screen.png`, `Radial event wheel overlay.png`, `Filtered pass guided temporal measurement-1.png` y `Guided precision measurement fader-2.png`. Orientan el botón, la rueda y la composición de la guía; el texto aprobado de FR-018/019 prevalece sobre rieles, segundos, porcentajes y ejemplos ilustrados. Ninguna referencia autoriza arrastre, deslizadores, inferencia de valores o puntuación FEM.

Estas referencias orientan jerarquía, adaptación, mensajes de corrección y estado de éxito. La especificación y los contratos gobiernan campos y comportamiento: el jugador, partido, conteos y enlace dibujados son ejemplos; un control visual no añade una validación no aprobada. No se incorporan los PNG al repositorio ni se exige fidelidad pixel a pixel.

## Entrada y secuencia

| Paso | Contenido | Avance/retorno |
|---|---|---|
| 0. Detalle autorizado | Partido, jugador y estado procedentes de Feature 010; CTA «Registrar datos del partido» solo para `FIRST_MATCH` `WAITING` habilitado por el backend. `LOADED` con constancia propia muestra «Carga confirmada» y lectura autorizada; `LOADED` histórico sin ella no habilita captura ni aparenta análisis. | Abrir flujo sin tratar el CTA como permiso. Enlace directo reconsulta al backend. |
| 1. Captura | Minuto del video y periodo/añadido si se distingue; botón circular → rueda → tipo elegido y «Cambiar». Gol/Asistencia omiten resultado visible; `FAILURE` omite mediciones; solo resultados medidos recorren cinco contextos, siete criterios y detalle de atajada cuando aplique. Tras requisitos aplicables aparece «Guardar evento», sin campo de observación ni «Añadir otro evento». «Eventos capturados» se despliega bajo el formulario. La participación se decide aquí. | El progreso permite corregir grupos medidos sin perder otras respuestas. Guardar devuelve al botón circular y agrega/actualiza localmente; no borra eventos al elegir participación. Ningún punto/rating ni escritura al backend. |
| 2. Revisión | Lista atribuida al partido/jugador con todos los eventos, minutos, contexto y complejidad, o mensaje claro «No participó; sin eventos». | Volver a captura para corregir sin perder entradas. |
| 3. Datos finales | Mostrar participación ya establecida, de solo lectura; introducir total de minutos jugados en entero (incluye añadido, 0 solo si no participó, sin tope fijo de 90) y URL HTTPS válida de YouTube; mostrar resumen de atribución y datos antes del control «Confirmar carga». | Corregir minutos/enlace aquí o regresar a captura para participación. No se ofrece evaluación ni publicación. Solo la confirmación final válida envía la escritura. |

No se promete borrador persistente ni recuperación tras recarga. Mientras la sesión y autoridad sigan vigentes, un error de validación conserva las entradas locales para su corrección; nunca crea constancia parcial. Los errores de rol/custodia/identidad vacían eventos, total y URL antes de mostrar restricción o navegar. El enlace puede abrir YouTube externamente para consulta, pero Feature 011 no reproduce ni sube archivos de video.

## Interacción dentro de la captura

1. Un botón circular abre la rueda de tipos aprobados. Cerrarla sin elegir no inventa un tipo. Elegir uno la cierra y restituye el botón con ese tipo y «Cambiar»; cambiar a otro tipo no crea otro evento ni convierte un resultado incompatible: el Analista debe elegir un resultado permitido cuando el tipo lo requiere. Gol y Asistencia no muestran control de resultado; `NONE` se conserva solo internamente.
2. Una sola fila reutilizable presenta opciones rotuladas del grupo activo, primero los cinco contextos y luego los siete criterios de complejidad. No hay respuesta preseleccionada. Cada toque o activación de teclado guarda exactamente esa respuesta y avanza al grupo siguiente. Los cinco contextos admiten dato observado o «no observable»; «no aplica» solo se ofrece en complejidad cuando corresponda. Los indicadores de progreso identifican grupos y respuestas anteriores, permiten volver/corregir y conservan las otras elecciones. Las marcas gráficas no son controles de arrastre.
3. Tras tipo, minuto y los datos aplicables (resultado visible salvo Gol/Asistencia; grupos y detalle de atajada solo para resultados medidos), se muestra «Guardar evento». No se muestra campo de observación ni «Añadir otro evento». Guardar incorpora o actualiza un evento completo en la colección local y devuelve al botón circular para el siguiente; un evento incompleto aún en edición no se cuenta como capturado. «Eventos capturados» se expande/contrae debajo y permite volver a corregir uno sin duplicarlo. Guardar no es un `POST`, no crea carga duradera, no consume cupo y no pasa Feature 009 a `LOADED`.
4. La revisión usa únicamente eventos localmente guardados. La confirmación del partido sigue reservada al paso final, después de participación, total de minutos jugados y enlace de YouTube. «No participó» continúa sin eventos y no requiere recorrer la rueda ni los grupos.

## Estados y accesibilidad

- **Carga**: anuncio accesible de consulta o confirmación en curso; bloquear confirmación duplicada visible sin perder la intención UUID estable para un reintento.
- **Vacío legítimo**: formulario de captura sin eventos, distinto de «no participó» declarado. Participante sin eventos no puede confirmar. La agenda sin partido sigue la vista de Feature 010.
- **Validación**: mensajes junto al evento/campo (minuto, resultado, contexto, complejidad, total, enlace); «Guardar evento» solo aparece después de las elecciones requeridas. Preservar foco útil y datos, llevar el foco al primer error, anunciar el problema sin repetir contenido sensible en mensajes globales.
- **Conflicto**: versión antigua, reagendamiento/cancelación o nueva intención tras carga; no afirmar éxito, ofrecer recarga segura del partido. La recarga revalida custodia.
- **Restricción / no encontrado**: limpiar memoria protegida; ID ajeno e inexistente se ven iguales. No conservar enlace ni eventos en el árbol accesible oculto.
- **Indisponibilidad**: distinguir fallo de servicio de validación y conflicto; permitir reintento con la misma intención cuando sea seguro. «Análisis realizados» de Feature 010 conserva su indisponibilidad honesta.
- **Éxito**: mostrar carga confirmada y estado operativo actualizado del primer partido; no decir «evaluación terminada» ni mostrar rating, estadísticas o publicación.

En escritorio el contenido utiliza el shell lateral de Analista; en viewport móvil usa cabecera y barra inferior existentes, área segura y desplazamiento sin ocultar el botón final o campos al abrir teclado. El orden de Tab, nombres de campos, apertura/cierre de rueda, retorno de foco al botón, opciones y grupos de contexto/complejidad, indicadores de progreso, expansión de «Eventos capturados» y árbol de accesibilidad web deben verificarse en la ruta autenticada real. La rueda debe ser operable sin arrastrar; las opciones deben tener nombre y estado seleccionable discernibles por teclado y lector. Los campos no aplicables a una atajada o criterio conservan su estado explícito; no se aplican automáticamente las filas pendientes de la guía FEM. Toda lectura/escritura vuelve a comprobar autoridad en backend.
