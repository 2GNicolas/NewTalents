# Feature Specification: Configuración administrativa de cupos de partidos

**Feature Branch**: `feature/008-admin-match-allowances`
**Created**: 2026-10-09
**Status**: Draft — decisiones de período y actualización resueltas; pendiente de aprobación del producto
**Input**: Configurar y consultar, por parte del Administrador, un cupo positivo de partidos para un pasaporte de jugador activo, con periodicidad mensual, trimestral, semestral o anual y fecha de inicio.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guardar y consultar un cupo (Priority: P1)

Un Administrador autorizado entra a una única vista de Pasaportes con tarjetas de todos los pasaportes existentes, abre uno activo, elige periodicidad y número de partidos, y consulta la fecha de inicio determinada por el día de activación en Colombia. Revisa un resumen de lo que va a guardar y lo confirma. Después puede consultar esos mismos valores desde el detalle administrativo del pasaporte. Esto deja una configuración disponible para una futura función de programación de partidos, sin programar ninguno ahora.

**Why this priority**: Establece la única configuración vigente que necesita la función posterior.

**Independent Test**: Entrar a la vista única de tarjetas, abrir un pasaporte activo sin configuración, guardar una periodicidad válida y un entero positivo con la fecha de activación de Colombia determinada por el sistema; recargar y comprobar los valores y el vínculo con el mismo pasaporte, sin partidos ni uso generado.

**Acceptance Scenarios**:

1. **Given** varios pasaportes existentes de distintos estados y un Administrador autorizado, **When** entra a Pasaportes, **Then** encuentra una sola colección de tarjetas, sin limitarla a los pasaportes de Custodia o a un Analista, y puede abrir el detalle de cada pasaporte permitido.
2. **Given** un pasaporte activo sin configuración, **When** el Administrador introduce valores válidos y confirma, **Then** queda una configuración vigente vinculada únicamente a ese pasaporte y puede verla al volver a abrirlo.
3. **Given** el resumen de confirmación, **When** el Administrador cancela, **Then** no se crea ni modifica ninguna configuración.
4. **Given** un cupo vacío, cero, negativo, fraccionario o no numérico, una periodicidad ajena a las cuatro permitidas o una fecha inexistente, **When** intenta continuar, **Then** recibe errores específicos y no se guarda nada.
5. **Given** un pasaporte no activo, **When** el Administrador abre su tarjeta, **Then** puede distinguir su estado, pero no configurar un cupo.
6. **Given** un pasaporte inexistente o una identidad sin autorización administrativa vigente, **When** intenta consultar o guardar la configuración, **Then** no obtiene el recurso ni altera datos.

---

### User Story 2 - Actualizar con trazabilidad (Priority: P2)

Un Administrador autorizado consulta una configuración guardada, propone cambios, ve los valores anteriores y nuevos antes de confirmar, y puede consultar quién cambió qué y cuándo. Una operación concurrente no debe reemplazar silenciosamente una versión posterior.

**Why this priority**: Las correcciones son necesarias, pero no deben borrar la historia ni producir un cupo ambiguo.

**Independent Test**: Crear una configuración, modificarla y verificar la configuración vigente y una entrada de cambio con actor, momento y valores anteriores/nuevos; cancelar otro cambio y comprobar que no dejó efecto.

**Acceptance Scenarios**:

1. **Given** una configuración existente, **When** se abre el detalle administrativo, **Then** se muestran su periodicidad, cupo y fecha de inicio vigentes, separados del estado del pasaporte y de la custodia.
2. **Given** cambios válidos de cupo o periodicidad, **When** el Administrador confirma, **Then** el período en curso conserva sus valores, el cambio rige desde el siguiente período y se conserva la versión anterior con actor y momento en el historial.
3. **Given** una configuración modificada por otro Administrador después de abrirla, **When** se intenta confirmar sobre el estado anterior, **Then** se informa el conflicto y se exige revisar el estado vigente antes de una nueva confirmación.
4. **Given** una propuesta sin confirmar, **When** se cancela o abandona la vista, **Then** no se registra un cambio.
5. **Given** una configuración ya activada, **When** el Administrador intenta cambiar su fecha de inicio, **Then** el sistema mantiene esa fecha fija y no acepta su modificación.

---

### User Story 3 - Consultar límites recurrentes (Priority: P3)

Un Administrador autorizado puede entender a qué intervalo corresponde el cupo vigente y cuándo comienza el siguiente. La futura programación de partidos podrá consultar esa configuración y sus límites sin depender de una interpretación de la pantalla.

**Why this priority**: Un cupo periódico sin límites inequívocos no sirve como regla de entrada para programación posterior.

**Independent Test**: Para cada una de las cuatro periodicidades, consultar intervalos consecutivos sin superposición ni huecos conforme a la regla aprobada, incluidos cambios de mes y de año; no crear partidos ni contadores de uso.

**Acceptance Scenarios**:

1. **Given** una configuración vigente, **When** se consulta un período, **Then** se identifica su inicio, su fin exclusivo y el siguiente inicio de forma coherente con la periodicidad aprobada.
2. **Given** una configuración confirmada en la fecha actual de Colombia, **When** se consulta de nuevo, **Then** se reconoce su inicio en esa fecha y se distingue de una ausencia de configuración, sin inventar consumo.
3. **Given** una configuración mensual iniciada el 9 de octubre, **When** se muestran sus límites, **Then** el primer período comprende del 9 de octubre al 8 de noviembre inclusive y el siguiente comienza el 9 de noviembre.
4. **Given** una fecha inicial 29, 30 o 31 cuyo aniversario cae en un mes más corto, **When** se calculan períodos sucesivos, **Then** ese límite usa el último día del mes corto y los límites posteriores vuelven al día original cuando existe, sin desplazamiento acumulado.

### Edge Cases

- Fecha 29, 30 o 31 cuando un aniversario cae en un mes más corto; febrero y año bisiesto sin desplazamiento acumulado.
- Cambio de periodicidad o cupo mientras transcurre un período; fecha inicial fija tras activación y nueva periodicidad desde el siguiente límite.
- Fecha de inicio anterior o posterior al día actual de Colombia: rechazo; ningún partido programado o consumo inferido en esta característica.
- Cambio concurrente de dos Administradores; pasaporte que deja de estar activo entre abrir y confirmar.
- Pasaporte activo sin configuración: mostrar «Sin configuración», no un cupo o consumo de cero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo un Administrador con autorización vigente DEBE poder entrar a la colección administrativa de Pasaportes y crear, consultar y actualizar la configuración de cupos de un pasaporte existente y activo; la interfaz o una etiqueta de rol no DEBEN conceder autoridad por sí solas.
- **FR-002**: Pasaportes DEBE ser una única vista de tarjetas de todos los pasaportes existentes autorizados para el Administrador, sin restringirla a los elegibles para Custodia; cada tarjeta DEBE identificar de forma segura al jugador, la referencia separada del pasaporte y su estado, y permitir abrir el detalle. Un pasaporte no activo NO DEBE ofrecer configuración editable.
- **FR-003**: La configuración DEBE pertenecer a un único pasaporte existente; no DEBE crear otro pasaporte ni cambiar su ciclo de vida, custodia o relaciones.
- **FR-004**: El Administrador DEBE poder seleccionar exactamente una periodicidad entre mensual, trimestral, semestral y anual e introducir un cupo entero estrictamente positivo. La fecha de inicio DEBE determinarla el sistema como el día de la primera activación en Colombia; el Administrador NO DEBE poder elegirla ni editarla.
- **FR-005**: Se DEBEN rechazar campos ausentes, periodicidades no admitidas, fechas inexistentes, fechas de inicio pasadas o futuras y cupos nulos, negativos, fraccionarios o no numéricos, con mensajes comprensibles y sin guardado parcial. La fecha DEBE comprobarse de nuevo al confirmar si cambió el día en Colombia desde que se abrió el formulario.
- **FR-006**: Antes de guardar o actualizar, la interfaz DEBE mostrar un resumen de pasaporte, periodicidad, cupo y fecha de inicio; solo una confirmación explícita DEBE persistir la propuesta. La primera configuración comienza a regir al confirmarse en la fecha indicada; cancelar NO DEBE tener efecto.
- **FR-007**: El Administrador DEBE poder volver a consultar los valores guardados y distinguir la ausencia de configuración de una configuración existente. El cupo DEBE mostrarse como límite configurado, nunca como partidos usados o disponibles calculados.
- **FR-008**: DEBE existir una sola configuración autoritativa por pasaporte para el instante consultado, con historial trazable de creación y cambios que conserve actor, momento y valores anteriores y nuevos sin reescribirlos.
- **FR-009**: Una actualización basada en una versión superada NO DEBE sobrescribir silenciosamente el estado vigente; el Administrador DEBE poder revisar el conflicto antes de reintentar.
- **FR-010**: La configuración vigente y los límites de su período DEBEN poder ser consultados por una futura característica de programación de partidos, sin realizar programación, registrar uso ni reservar cupos en esta entrega.
- **FR-011**: La navegación administrativa DEBE añadir Pasaportes entre Expedientes y Custodia, sin eliminar ni renombrar Inicio, Solicitudes, Expedientes o Custodia. Desde la única vista de tarjetas, la configuración DEBE integrarse como sección del detalle administrativo del pasaporte, sin sustituir su perfil, estado, registros vinculados, custodia, historial ni acciones actuales. La composición de esta sección seguirá las dos referencias aprobadas de escritorio y móvil adjuntas el 2026-10-09.
- **FR-012**: La sección DEBE conservar la jerarquía visible de período, cupo, configuración actual, acciones de guardar/descartar y última modificación de las referencias; DEBE mostrar la fecha de inicio determinada por el sistema, aunque no figure en ellas, sin un control editable. Las cifras «utilizados/disponibles», su barra de progreso y los textos que sugieren programación actual NO DEBEN presentarse como datos reales de esta característica.
- **FR-013**: La vista DEBE ofrecer estados explícitos de carga, sin configuración, acceso restringido, conflicto, error e indisponibilidad, y controles accesibles tanto en escritorio como en móvil.
- **FR-014**: La fecha de inicio registrada al activar la primera configuración DEBE permanecer fija y no editable. Los cambios confirmados de cupo o periodicidad NO DEBEN alterar el período en curso: DEBEN comenzar a regir al inicio del siguiente período. Si cambia la periodicidad, sus nuevos intervalos se cuentan desde ese inicio efectivo, sin modificar la fecha inicial ni los períodos anteriores.
- **FR-015**: Los períodos mensual, trimestral, semestral y anual DEBEN contar respectivamente 1, 3, 6 y 12 meses por aniversarios del inicio aplicable, según el calendario de Colombia. La primera fecha de inicio DEBE ser el día de la activación, nunca una fecha pasada ni futura. Cada período comprende desde su fecha de inicio hasta el día anterior al aniversario siguiente, inclusive; el siguiente empieza en ese aniversario. Si el mes de destino carece del día ancla, se usa su último día sin desplazar el ancla original de períodos posteriores. Los períodos NO DEBEN tener huecos ni superposiciones.
- **FR-016**: Esta característica NO DEBE programar partidos, realizar trabajo de Analista o FEM, registrar pagos o suscripciones, ni presentar consumo, partidos o métricas deportivas no existentes.

### Key Entities

- **Configuración de cupo de partidos**: Regla vigente asociada a un pasaporte activo; periodicidad, cupo entero positivo, fecha de inicio y estado de vigencia.
- **Período de cupo**: Intervalo recurrente de una configuración, con inicio inclusivo y fin exclusivo en el aniversario siguiente; no representa partidos ni consumo. Un cambio de periodicidad abre una nueva secuencia en su inicio efectivo sin editar la fecha original.
- **Cambio de configuración**: Registro de quién confirmó una creación o modificación, cuándo ocurrió y qué valores pasaron de anteriores a nuevos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En los cuatro tipos de período, el 100 % de las configuraciones válidas conserva exactamente los valores confirmados al volver a consultar el pasaporte; no se crea ningún partido ni dato de consumo.
- **SC-002**: El 100 % de los pasaportes existentes autorizados aparece en la colección única de tarjetas independientemente de su custodia; los no activos no permiten guardar cupos.
- **SC-003**: El 100 % de los intentos con cupo no positivo o no entero, fecha inválida, pasada o futura, periodicidad no admitida o pasaporte no elegible termina sin configuración parcial ni cambio de custodia.
- **SC-004**: El 100 % de los cambios confirmados conserva actor, momento y valores anteriores y nuevos; cancelaciones y conflictos no alteran la versión vigente.
- **SC-005**: En una prueba con Administradores autorizados, al menos el 90 % encuentra un pasaporte en la vista de tarjetas y completa la creación y posterior consulta de un cupo en menos de tres minutos sin asistencia, en escritorio y móvil.
- **SC-006**: El 100 % de los casos de cambio de mes/año y día 29–31 produce aniversarios consecutivos, sin huecos, superposiciones ni desplazamiento acumulado, iguales para la vista administrativa y la consulta destinada a programación futura.

## Assumptions

- Se reutilizan el pasaporte activo, la autorización administrativa vigente y el detalle/navegación de Feature 007; esta característica no modifica sus decisiones de aprobación ni de custodia.
- La configuración se guarda por pasaporte, no por Analista ni por academia. No depende de que haya custodia asignada.
- Una configuración ausente no implica cero partidos jugados, consumidos o disponibles.
- Las dos imágenes aprobadas adjuntas el 2026-10-09 rigen la jerarquía y composición de la sección de cupos en escritorio y móvil; la vista de todos los pasaportes se describe como una sola colección de tarjetas, sin un referente visual específico. Los referentes actuales de detalle de Feature 007 conservan la continuidad de su contenido y navegación.
- Las referencias contienen «2 utilizados · 2 disponibles», una barra de progreso, un ejemplo de fotografía y texto sobre programación por terceros. Son contenido ilustrativo o de futuras características, no autorización para inventar uso, añadir fotografía ni habilitar programación en Feature 008.
- Decisiones del producto: los cambios de cupo y periodicidad rigen desde el siguiente período; la fecha de inicio de la primera activación es el día actual de Colombia y queda fija. Un período iniciado el 9 de octubre termina el 8 de noviembre inclusive si es mensual. «Último día del mes» aplica cuando no existe el día ancla en el mes de destino, no como cierre fijo de cada mes calendario.
