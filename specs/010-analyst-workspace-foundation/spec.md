# Feature Specification: Espacio de trabajo del Analista

**Feature Branch**: `feature/010-analyst-workspace-foundation`

**Created**: 2026-10-14

**Status**: Aprobada por el propietario para planificación — 2026-10-15. La aprobación fija el alcance y las reglas de esta especificación; no acredita implementación ni disponibilidad de fuentes futuras.

**Enmienda de privacidad y contacto (2026-10-15)**: El propietario autoriza el nombre del jugador y el teléfono/correo disponibles de la persona definida por el tipo de pasaporte para el Analista con custodia vigente de un pasaporte `ACTIVE`. Si no se identifica inequívocamente al responsable actual, no se divulga el contacto de otra persona.

**Input**: Entrada autenticada del Analista y vistas Inicio, Pasaportes y Partidos para consultar partidos de pasaportes `ACTIVE` bajo su custodia vigente, sin limitarse al primer partido. Las seis imágenes identificadas por nombre más abajo son referencias visuales aprobadas y se conservan fuera del repositorio. Se respetan la revisión y activación administrativas separadas, la asignación manual de custodia y la privacidad. Esta entrega no captura ni analiza datos deportivos, no confirma cargas ni implementa FEM, pagos o gestión de programación.

## Clarifications

### Session 2026-10-14

- Q: ¿Qué resultado verificable sustituye la meta de 90 % en dos minutos? → A: Comprobar la navegación desde la entrada autenticada hasta un pasaporte asignado y un partido pendiente, sin umbral inventado. La antigua mención exclusiva al primer partido queda sustituida por la decisión de 2026-10-15.
- Q: ¿Qué accesibilidad se verifica en esta entrega? → A: Experiencia web en escritorio y viewport móvil mediante teclado, foco y semántica accesible; sin pruebas nativas de voz.
- Q: ¿Forman parte de esta base los filtros o la priorización del trabajo? → A: No; requieren aprobación posterior del propietario.

### Session 2026-10-15

- Q: ¿La cartera de trabajo se restringe al primer partido? → A: No. Incluye partidos de pasaportes `ACTIVE` bajo custodia vigente, sean o no el primero, siempre que exista un registro autoritativo consultable.
- Q: ¿Qué se hace con “Borrador guardado”, “Continuar”, “Ver historial” y los análisis realizados mostrados en las imágenes? → A: No se inventan registros ni acciones operativas; se explicitan los orígenes y reglas faltantes antes de habilitarlos.
- Q: ¿Depende la lectura de partidos del orden en que fueron programados? → A: No; se muestran todos los partidos confirmados disponibles en fuentes autoritativas de pasaportes `ACTIVE` bajo custodia actual. Feature 009 aporta partidos hoy, sin crear aquí programación posterior.
- Q: ¿Cómo se distribuyen los partidos entre las tres áreas de Inicio? → A: Son excluyentes. La fecha y hora programadas se comparan con la hora actual en `America/Bogota`: un partido `WAITING` de Feature 009 es próximo antes de ese instante y pendiente desde ese instante hasta una carga válida. Los partidos posteriores siguen la misma regla cuando exista fuente autoritativa; realizados exige confirmación de análisis aprobada. Un partido no se cuenta dos veces.
- Q: ¿Se habilitan “Borrador guardado”, “Continuar” o “Ver historial” en esta entrega? → A: No; permanecen no operativos hasta que otra característica implemente sus datos y acciones.
- Q: ¿Qué datos personales puede ver el Analista con custodia actual de un pasaporte `ACTIVE`? → A: El nombre del jugador y el contacto autorizado necesario para su trabajo; no número o documento de identificación, evidencia ni otros campos del perfil civil. La regla de contacto por tipo de pasaporte se fija a continuación.
- Q: ¿De quién son el teléfono y el correo de trabajo permitidos? → A: Del propio jugador en pasaporte personal adulto; del representante legal vigente en personal de menor; del responsable vigente de academia en pasaporte gestionado por academia, sea adulto o menor. Mostrar ambos canales disponibles sin precedencia. Si la persona no está o no se identifica inequívocamente por relaciones autoritativas actuales, «Contacto no disponible» sin sustituirla por una cuenta adicional ni un contacto del menor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar y consultar Inicio (Priority: P1)

El Analista autenticado entra a Inicio y reconoce tres áreas, como en los diseños aprobados: Análisis pendientes, Próximos partidos y Análisis realizados. Sus categorías son excluyentes. La fecha y hora locales programadas se comparan con la hora actual en `America/Bogota`; un partido confirmado `WAITING` de Feature 009 es próximo antes de ese instante y pendiente desde ese instante hasta su carga válida. La misma regla se aplica a partidos posteriores cuando una fuente autoritativa aporte su programación y estado. «Realizados» requiere otra fuente aprobada de confirmación de análisis: una carga `LOADED` no basta. Los elementos y totales se basan solo en datos autoritativos de pasaportes `ACTIVE` bajo custodia actual; ningún partido se cuenta dos veces. Si un área carece de fuente o registros válidos, muestra un estado vacío o no disponible veraz, no ejemplos de la imagen.

**Why this priority**: Inicio orienta el trabajo sin confundir una programación con un análisis terminado o un borrador.

**Independent Test**: Con custodia vigente y un partido `WAITING` de Feature 009, verificar que antes de su fecha y hora programadas en `America/Bogota` figura solo en Próximos partidos; en el instante exacto pasa solo a Análisis pendientes y, tras una carga válida, deja de figurar en ambas. Sin fuente aprobada de análisis confirmados ni borradores, Análisis realizados queda no disponible y no aparecen tarjetas ni acciones ficticias.

**Acceptance Scenarios**:

1. **Given** una identidad activa con rol `ANALYST` vigente y pasaportes `ACTIVE` bajo su custodia actual, **When** entra a Inicio, **Then** ve las tres áreas con su jerarquía visual aprobada y solo datos operativos autorizados.
2. **Given** un partido confirmado `WAITING` de Feature 009 cuya fecha y hora programadas en `America/Bogota` ya se alcanzaron, **When** consulta Inicio, **Then** aparece solo en Análisis pendientes y puede abrir su consulta de solo lectura; permanece allí hasta su carga válida, sin afirmar que exista un borrador guardado.
3. **Given** un partido confirmado `WAITING` de Feature 009 cuya fecha y hora programadas en `America/Bogota` aún no se alcanzaron, **When** consulta Inicio, **Then** aparece solo en Próximos partidos y puede ir a Partidos mediante “Ver calendario”; al llegar al instante programado deja de contarse como próximo.
4. **Given** una confirmación de análisis procedente de una fuente aprobada, **When** consulta Inicio, **Then** ese partido aparece solo en Análisis realizados; sin esa fuente, la sección indica indisponibilidad y no inventa fechas, métricas, tarjetas ni un “Ver historial” funcional.
5. **Given** que no existe un borrador persistido y una reanudación implementada, **When** consulta un partido pendiente, **Then** no aparece “Borrador guardado” ni una acción “Continuar” operativa; “Ver historial” tampoco funciona sin datos y acción de historial implementados.
6. **Given** un partido `WAITING` visible antes o después de su hora programada, **When** Feature 009 confirma su carga válida y el Analista actualiza Inicio, **Then** deja de contarse como próximo o pendiente y no pasa a Análisis realizados sin una confirmación de análisis aprobada.
7. **Given** un partido posterior confirmado por una fuente autoritativa con programación y estado equivalentes, **When** consulta Inicio, **Then** se aplica el mismo límite de `America/Bogota` y la misma exclusión entre próximo, pendiente y cargado, sin exigir que sea el primer partido ni crear su programación aquí.

---

### User Story 2 - Consultar Pasaportes bajo mi custodia (Priority: P1)

La vista Pasaportes muestra exclusivamente los pasaportes `ACTIVE` cuya custodia vigente pertenece al Analista. Cada tarjeta ofrece la etiqueta visible permitida, la referencia operativa, el estado de custodia y el próximo partido programado solo si existe; “Abrir pasaporte” lleva al detalle autorizado. La ausencia de partidos pendientes tiene una presentación propia.

**Why this priority**: La cartera de custodia es el límite de acceso para todo el espacio.

**Independent Test**: Con pasaportes propios, ajenos, sin asignar y no activos, verificar que solo aparecen los propios activos; abrir uno y revocar la custodia para comprobar que desaparece y su enlace deja de revelar información.

**Acceptance Scenarios**:

1. **Given** un pasaporte `ACTIVE` con custodia actual del Analista, **When** abre Pasaportes, **Then** ve su tarjeta y puede abrirlo sin obtener decisiones administrativas.
2. **Given** un pasaporte sin custodia, bajo otro Analista o no activo, **When** consulta la vista, **Then** ese pasaporte y sus partidos no aparecen ni se filtran por conteos o errores.
3. **Given** un pasaporte propio con uno o más partidos confirmados consultables, **When** ve su tarjeta, **Then** el próximo partido, si existe, procede de un registro futuro vigente; todos los partidos confirmados disponibles siguen accesibles en Partidos sin preferencia por orden de programación.
4. **Given** un pasaporte propio sin partido pendiente, **When** ve su tarjeta, **Then** se indica “Sin partidos pendientes” o equivalente sin inventar un evento.
5. **Given** un Analista elegible sin custodias, **When** abre Pasaportes, **Then** ve un estado vacío sin opción de asignarse pasaportes.
6. **Given** custodia vigente sobre un pasaporte `ACTIVE`, **When** abre su tarjeta y detalle, **Then** ve el nombre real del jugador autorizado sin recurrir a la referencia enmascarada como sustituto y no recibe número de identificación ni otros campos civiles.
7. **Given** un pasaporte personal de adulto y responsabilidad `SELF` vigente e inequívoca, **When** el Analista abre el detalle, **Then** ve el teléfono y el correo disponibles de ese adulto; un canal ausente no oculta el otro.
8. **Given** un pasaporte personal de menor y un representante legal vigente e inequívoco, **When** abre el detalle, **Then** ve el teléfono y el correo disponibles de ese representante, nunca un contacto directo del menor.
9. **Given** un pasaporte de academia, de adulto o menor, y un responsable vigente de esa academia identificado inequívocamente, **When** abre el detalle, **Then** ve solo el teléfono y el correo disponibles de esa persona, no los de una cuenta adicional ni, para el menor, los del representante legal.
10. **Given** que falta el responsable correspondiente, su vínculo actual no se puede demostrar o hay más de un candidato sin designación inequívoca, **When** abre el detalle, **Then** ve «Contacto no disponible» sin teléfono, correo ni sustitución arbitraria.

---

### User Story 3 - Consultar Partidos y abrir un partido (Priority: P1)

La vista Partidos consulta todos los partidos confirmados disponibles en fuentes autoritativas de pasaportes `ACTIVE` bajo custodia vigente, sin filtrar por el orden del partido. Presenta los partidos programados en una agenda agrupada por fecha según las imágenes. Cada elemento muestra solo jugador/referencia permitidos, fecha y hora local, rival, competencia, sede y estado respaldados por un registro real. “Ver partido” abre la consulta de solo lectura de ese partido. Feature 009 es la fuente disponible hoy; esta vista no crea programación de partidos posteriores.

**Why this priority**: Permite localizar el trabajo por partido sin incorporar la captura o el análisis deportivo.

**Independent Test**: Con un primer partido y, cuando exista su fuente autorizada, un partido posterior de pasaportes bajo la misma custodia, comprobar que ambos son elegibles para la agenda bajo la misma regla de autorización; los datos ausentes no producen filas de ejemplo.

**Acceptance Scenarios**:

1. **Given** un primer partido `WAITING` confirmado por Feature 009 en un pasaporte propio `ACTIVE`, **When** abre Partidos, **Then** ve ese partido y puede consultar sus detalles permitidos sin modificarlo.
2. **Given** cualquier partido no inicial confirmado y disponible en una fuente autoritativa de un pasaporte propio `ACTIVE`, **When** abre Partidos, **Then** se aplica la misma regla de visibilidad y se puede abrir el mismo tipo de detalle; no se excluye por orden ni se crea aquí su programación.
3. **Given** que no hay fuente autoritativa o registros confirmados de partidos posteriores, **When** abre Partidos, **Then** no aparecen filas, estados o fechas ilustrativas de esos partidos.
4. **Given** que un responsable reagenda o cancela un partido visible, **When** el Analista vuelve a consultar, **Then** ve su programación vigente o deja de verlo como pendiente, sin conservar la tarjeta anterior como fuente de verdad.
5. **Given** un partido confirmado cuya carga ya ocurrió pero sin confirmación aprobada de análisis, **When** consulta Partidos, **Then** puede reconocer su estado operativo permitido sin que Inicio lo cuente como análisis realizado o invente trabajo pendiente; no se exponen datos deportivos no publicados.

---

### User Story 4 - Revocación y privacidad en todas las vistas (Priority: P1)

El Analista pierde acceso a un pasaporte, sus partidos y cualquier resumen derivado cuando cambia o termina su custodia, se revoca su rol o se inactiva su identidad. Un enlace guardado o una pantalla abierta no prolongan la autorización.

**Why this priority**: La custodia actual, no la asignación histórica ni el estado de la interfaz, protege la información del jugador.

**Independent Test**: Con Inicio, Pasaportes y Partidos visibles, cambiar la custodia y reabrir las tres vistas y un enlace directo; comprobar denegación segura y eliminación de detalles retenidos.

**Acceptance Scenarios**:

1. **Given** una custodia cambiada o retirada, **When** el antiguo Analista actualiza cualquier vista o abre directamente un pasaporte/partido, **Then** no recibe datos del recurso y la vista descarta detalles previos.
2. **Given** rol `ANALYST` revocado o identidad inactiva, **When** repite una consulta, **Then** se deniega aunque conserve sesión o historial de custodia.
3. **Given** un identificador inexistente o ajeno, **When** intenta abrirlo, **Then** el resultado no permite distinguir existencia de falta de autorización.

### Edge Cases

- Un pasaporte `ACTIVE` puede tener un partido programado sin Analista; no se muestra en este espacio hasta que el Administrador confirme una custodia válida.
- La custodia autoriza el nombre del jugador, no sus documentos ni todos los contactos relacionados. Para un menor personal se usa solo el representante legal vigente; para un menor de academia se usa solo el responsable vigente de academia. Una cuenta adicional de academia, el creador del pasaporte o el primer miembro no sustituyen al responsable. Si no hay identidad única y vigente, no se expone contacto.
- Inicio clasifica cada partido una sola vez: una confirmación aprobada de análisis lo sitúa en Análisis realizados; de lo contrario, un `WAITING` confirmado de Feature 009 figura en Próximos partidos si su fecha y hora programadas aún no se alcanzaron, o en Análisis pendientes desde ese instante y hasta su carga válida. `LOADED` o `CANCELED` no aparecen como próximos ni pendientes; `LOADED` no implica análisis realizado. Un partido posterior sigue la misma regla cuando su fuente autoritativa aporte programación y estados equivalentes.
- Para el límite temporal se interpretan la fecha y hora locales programadas y la hora actual en `America/Bogota`, incluso si el usuario o la sede están en otro lugar. En el instante exacto programado el partido `WAITING` deja de ser próximo y pasa a pendiente, sin doble conteo.
- Si la custodia o la programación cambia entre la lista y el detalle, cada consulta vuelve a comprobar autoridad y estado. Una denegación limpia datos locales protegidos.
- “En espera” de Feature 009 significa que el primer partido aguarda carga confirmada, no que exista un borrador o análisis completado.
- Las fechas, nombres, rivales, referencias y cifras de los PNG son ilustrativos. “Pendiente de aprobación” en la Agenda no crea una aprobación del Analista o del Administrador sobre el partido.
- Una identidad con varios roles no obtiene capacidades administrativas por entrar en el contexto de Analista.
- Carga, vacío legítimo, error recuperable, acceso restringido e indisponibilidad se distinguen sin reutilizar datos protegidos de una consulta anterior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema debe ofrecer la entrada autenticada del Analista y navegación entre Inicio, Pasaportes y Partidos conforme a las seis referencias visuales, usando identidad y rol `ANALYST` vigentes.
- **FR-002**: Las tres vistas deben limitar sus filas, resúmenes y enlaces a pasaportes `ACTIVE` bajo custodia actual de la misma identidad; cada detalle y enlace directo debe revalidar rol, identidad, estado del pasaporte y custodia.
- **FR-003**: La pérdida de custodia, rol o vigencia debe revocar el acceso en la siguiente petición y retirar los datos retenidos; los recursos inexistentes y ajenos deben tener denegación indistinguible.
- **FR-004**: Inicio debe conservar las áreas Análisis pendientes, Próximos partidos y Análisis realizados en escritorio y móvil. Debe interpretar la fecha y hora locales programadas y la hora actual en `America/Bogota`: un partido confirmado `WAITING` de Feature 009 figura y se cuenta solo en próximos antes del instante programado, y solo en pendientes desde ese instante hasta su carga válida. `LOADED` o `CANCELED` no se cuentan en esas áreas. Un partido posterior con programación y estado autoritativos equivalentes sigue la misma clasificación, sin distinguir el orden. Realizados requiere confirmación de análisis de una fuente aprobada, no solo `LOADED`. Sin fuente o registros aplicables se muestra vacío/no disponibilidad veraz, sin duplicar ni inventar tarjetas o totales.
- **FR-005**: Pasaportes debe mostrar el nombre autorizado del jugador, la referencia operativa, estado `ACTIVE`, custodia actual y próximo partido confirmado si existe; debe permitir “Abrir pasaporte” sin mostrar otros campos civiles, evidencia ni recursos ajenos. La referencia enmascarada no sustituye el nombre autorizado.
- **FR-006**: Partidos debe permitir leer todos los partidos confirmados disponibles de pasaportes `ACTIVE` autorizados, sin filtrar por ser primero o posterior; los programados se presentan en una agenda agrupada por fecha con fecha/hora local, rival, competencia, sede y estado disponibles. Esta lectura no programa partidos posteriores.
- **FR-007**: “Ver partido” o “Abrir partido” debe llegar a una consulta autorizada del partido elegido; no puede programar, reagendar, cancelar, cargar ni aprobar nada. La consulta debe reflejar cambios confirmados al actualizarse.
- **FR-008**: Los partidos confirmados de Feature 009 son la fuente disponible hoy para estas lecturas; un primer partido `WAITING` conserva su unidad `RESERVED` y figura como próximo antes de su fecha y hora en `America/Bogota`, o como pendiente desde ese instante hasta una carga válida. La lectura no cambia su espera, unidad ni transición a `LOADED/USED`.
- **FR-009**: No deben aparecer como datos reales partidos posteriores, análisis realizados, borradores o métricas sin registro autoritativo y contrato de estado/visibilidad aprobado. Un partido posterior confirmado se incluye si su fuente está disponible y cumple la misma autorización; esta característica no inventa esa fuente ni su programación. `LOADED` de Feature 009, por sí solo, no confirma un análisis realizado.
- **FR-010**: “Borrador guardado” no debe mostrarse como hecho sin persistencia implementada; “Continuar” y “Ver historial” deben permanecer no operativos hasta que una característica posterior implemente, respectivamente, borrador y reanudación, o fuente autorizada y acción de historial. La referencia visual no habilita esas capacidades.
- **FR-011**: El contexto del Analista es de solo lectura: no devuelve, resuelve duplicados, aprueba ni activa pasaportes `IN_REVIEW`, no asigna custodia y no invoca la carga confirmada de Feature 009 ni transforma `WAITING/RESERVED` en `LOADED/USED`.
- **FR-012**: Solo tras revalidar identidad/rol del Analista, pasaporte `ACTIVE` y custodia actual, las vistas pueden exponer el nombre del jugador. En el detalle del pasaporte personal adulto, el contacto es el adulto titular `SELF`; en el personal de menor, su representante legal actual; en el gestionado por academia, adulto o menor, el responsable actual de esa academia. Tras identificar inequívocamente a esa persona mediante relaciones autoritativas vigentes, mostrar su teléfono y correo disponibles, sin precedencia entre canales; si ninguno existe, falta la persona o hay ambigüedad, mostrar «Contacto no disponible» sin valores. No usar contacto directo del menor, representante de un menor de academia, cuenta adicional de academia, creador del pasaporte ni otro sustituto. No exponer número o tipo de identificación, documento, fecha de nacimiento, evidencia, otros campos civiles, contactos alternativos, señales de duplicado, notas internas, datos de otros Analistas ni estadísticas o conclusiones deportivas no publicadas.
- **FR-013**: La experiencia web en escritorio y viewport móvil debe conservar la jerarquía aprobada, navegación por teclado, foco visible y semántica accesible; debe diferenciar carga, vacío, error recuperable, restricción e indisponibilidad sin filtrar datos protegidos. No se exige prueba nativa de voz.
- **FR-014**: Esta entrega excluye captura y análisis de partidos, persistencia de borradores, transición `LOADED`, FEM, pagos, publicación y acciones de gestión general de partidos. Los filtros y las reglas de priorización no se deducen de los PNG.

### Key Entities *(include if feature involves data)*

- **Analista autorizado**: identidad activa con rol `ANALYST` vigente; sus lecturas se evalúan por recurso.
- **Custodia vigente**: autoridad de Feature 007 que vincula un pasaporte `ACTIVE` con su Analista actual.
- **Pasaporte asignado**: pasaporte visible solo bajo esa custodia; conserva referencia y etiqueta operativa permitidas.
- **Contacto de trabajo autorizado**: teléfono y correo disponibles de una única persona vinculada actualmente al pasaporte según su origen: titular `SELF`, representante legal de menor personal o responsable de academia. Es una proyección privada, no atributo futbolístico ni prueba de autoridad. Cada canal puede faltar; si la persona no se identifica de manera inequívoca, ambos quedan no disponibles.
- **Partido consultable**: partido confirmado y disponible en una fuente autoritativa, vinculado a un pasaporte asignado, con identidad propia, fecha/hora local, rival, competencia, sede y estado permitidos. Puede ser el primero o uno posterior; el orden no concede ni quita visibilidad.
- **Primer partido de Feature 009**: fuente actualmente existente de un partido `WAITING` y su unidad `RESERVED`; no representa por sí sola todos los partidos de esta cartera.
- **Análisis realizado / borrador**: categorías visibles en Inicio de los diseños, pero sin entidad ni fuente aprobada en los contratos inspeccionados; `LOADED` no sustituye una confirmación de análisis y no se materializan borradores por esta especificación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En cada recorrido web de aceptación de escritorio y viewport móvil, un Analista autorizado navega desde Inicio a Pasaportes y Partidos y abre un partido confirmado de un pasaporte bajo su custodia, sin acudir al área administrativa.
- **SC-002**: En el 100 % de las pruebas de colección, resúmenes y enlace directo, solo se muestran pasaportes `ACTIVE` bajo custodia actual y todos sus partidos confirmados disponibles en fuentes autoritativas; la condición de primer partido no filtra un registro posterior válido.
- **SC-003**: En el 100 % de las pruebas de cambio/retiro de custodia, revocación de rol o inactivación, la siguiente consulta deniega el recurso y elimina sus detalles de la vista.
- **SC-004**: En el 100 % de los casos sin fuente de análisis confirmados, borradores o partidos posteriores, no aparecen tarjetas inventadas, “Borrador guardado” ficticio ni controles operativos “Continuar”/“Ver historial”; ninguna lectura modifica partidos, cupos, custodia o estado deportivo. Para un `WAITING` de Feature 009 se comprueba antes, exactamente en y después de su fecha y hora programadas en `America/Bogota`: figura en una sola categoría y deja de ser próximo o pendiente tras su carga válida, sin convertirse por ello en análisis realizado. Se aplica la misma prueba a partidos posteriores cuando exista su fuente autoritativa.
- **SC-005**: En las comprobaciones web de escritorio y viewport móvil, Inicio, Pasaportes y Partidos se recorren con teclado, muestran foco comprensible y nombres/roles/estados correctos en el árbol de accesibilidad; carga, vacío, error, restricción e indisponibilidad se distinguen sin revelar datos protegidos.
- **SC-006**: Las tres vistas conservan la composición e información principal de sus seis referencias aprobadas en escritorio y móvil, con discrepancias justificadas únicamente cuando el contenido ilustrativo carece de fuente o regla aprobada.
- **SC-007**: En pruebas de pasaportes propios `ACTIVE`, el nombre autorizado aparece sin documento ni otros campos civiles. En pasaporte personal adulto, personal de menor y de academia adulto/menor se proyectan los canales disponibles solo de la persona definida en FR-012; un canal ausente no oculta el otro, y la ausencia o ambigüedad del responsable muestra «Contacto no disponible» sin valores. Cuenta adicional, contacto directo del menor y representante de menor de academia no se filtran. Tras revocar custodia o rol se retiran nombre y contacto.

## Referencias visuales aprobadas y límites de datos

Las seis imágenes proporcionadas para este espacio se conservan fuera del repositorio, identificadas por los nombres siguientes. Gobiernan composición, jerarquía, navegación lateral en escritorio y navegación inferior en móvil; no autorizan datos ni acciones por sí mismas.

| Vista | Escritorio | Móvil |
|---|---|---|
| Inicio | `New Talents analyst workload overview-1.png` | `Mobile analyst dashboard with pending analyses-2.png` |
| Pasaportes | `Analyst passport custody dashboard.png` | `Active passport custody dashboard.png` |
| Partidos | `Emerald Match Agenda for Analysts.png` | `New Talents match agenda.png` |

Los ejemplos de “Borrador guardado”, “Continuar”, “Análisis realizados” y “Ver historial” no prueban que existan borradores, análisis completados o navegación a su historial. “Orden propuesto: fecha programada ascendente · pendiente de aprobación” tampoco aprueba una regla de orden ni agrega una decisión administrativa sobre partidos. Cuando falte la fuente, se conserva la sección visual con un estado honesto, no con registros de ejemplo.

## Dependencias y decisiones pendientes

- **Disponible hoy**: Feature 007 define la colección de pasaportes `ACTIVE` con custodia actual y revocación de acceso; Feature 009 persiste el primer partido, su programación, espera y lectura del responsable. Su contrato de lectura del responsable no concede por sí mismo acceso al Analista.
- **Debe definirse para esta vista**: una proyección de lectura de partidos autorizada por custodia, con identidad del partido, datos operativos y estado seguros. Debe admitir todos los partidos confirmados disponibles del pasaporte sin condicionar la elegibilidad a su orden.
- **Regla de contacto aprobada para Feature 010**: Feature 005 separa contacto de cuenta e identidad privada del jugador; Feature 006 conserva teléfonos de solicitantes/representantes y correo de cuenta. La persona se selecciona por origen y responsabilidad actual conforme a FR-012, nunca por orden de registros. El teléfono solo puede derivarse de un registro aprobado y atribuible inequívocamente a esa persona; el correo, de su cuenta vigente cuando exista. La solicitud de creación de academia identifica al responsable inicial, pero una membresía activa adicional no lo reemplaza. No existe en el esquema una designación general de sustituto/traspaso de responsable ni una garantía de actualización del teléfono capturado en la solicitud: si los hechos actuales no permiten identificar un responsable único o un canal atribuible, el detalle informa no disponibilidad en lugar de atribuirle datos ajenos. Esta limitación de datos no reabre la decisión de destinatario.
- **Fuente aún no definida**: los contratos inspeccionados no aportan un registro general ni ciclo de programación de partidos posteriores. Producto debe identificar su origen autoritativo, estados y responsable antes de exigir filas no iniciales; esta característica no crea partidos posteriores.
- **Fuente aún no definida**: no existe contrato de confirmación de análisis ni de borradores persistidos. Producto debe aprobar el hecho que significa “realizado”, su visibilidad y, por separado, el ciclo de borrador; otra característica deberá implementar datos y acciones antes de habilitar “Continuar” o “Ver historial”. `LOADED` no equivale a análisis realizado.
- **Regla temporal aprobada**: la programación y clasificación vigentes usan `America/Bogota` para todos los partidos disponibles, con independencia de la sede o zona del dispositivo. El `WAITING` de Feature 009 confirma trabajo pendiente hasta su carga válida; no hace falta otra fuente para clasificar ese partido.
- **Dependencia futura, no requisito sin resolver de Feature 010**: no hay aún una fuente de partidos posteriores. Cuando otra característica proporcione partidos confirmados con fecha/hora y estado autoritativos equivalentes, se les aplicarán estas mismas reglas de lectura, custodia y clasificación; Feature 010 no crea su programación ni inventa filas. Tampoco crea fuentes de análisis confirmados, borradores, reanudación o historial: sus secciones permanecen honestamente no disponibles hasta las características que los definan. No se introduce prioridad, filtro ni aprobación de la agenda a partir del texto ilustrativo.
- Las reglas de Feature 005/007 se mantienen: el Administrador revisa `IN_REVIEW`, aprueba y activa por separado, y luego asigna custodia manualmente. El Analista solo consulta pasaportes `ACTIVE` con custodia vigente.

## Assumptions

- Se reutilizan la autenticación y el contexto de Analista existentes; una identidad con varios roles mantiene capacidades separadas.
- Una sección sin fuente o sin registros muestra ausencia/no disponibilidad explícita. No se interpreta como cero análisis completados históricamente si el sistema aún no puede consultarlos.
- Los datos de nombre, referencia, fechas, lugares y estados de los seis PNG son ilustrativos; la interfaz usa valores reales permitidos y no convierte sugerencias de diseño en reglas de negocio.
