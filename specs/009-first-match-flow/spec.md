# Feature Specification: First Match Passport Flow

**Feature Branch**: `feature/009-first-match-flow`

**Created**: 2026-10-13

**Status**: Aprobada por el propietario del producto el 2026-10-13 para planificación de Feature 009, con los contratos actuales de Feature 008 como base. Entrega aceptada por el propietario el 2026-10-14 para cierre e integración en `develop`.

**Input**: Invitación de pantalla completa al primer partido, programación con reserva de un cupo de Feature 008 y espera persistente hasta que el Analista cargue los datos del partido. Después de una aprobación que crea un pasaporte activo o de una activación explícita, llevar al Administrador al flujo existente de asignación manual de Analista. Un pasaporte activo puede programar sin custodia asignada.

**Aceptación de entrega (2026-10-14)**: El propietario acepta el alcance implementado de Feature 009 y autoriza su cierre y fusión en `develop`. Esta aceptación no modifica los límites de evidencia consignados en `verification/acceptance-review.md` y `verification/visual-review.md`: SC-001 no fue medido con usuarios, la guarda de sobrecupo mixto tiene evidencia unitaria sintética y la revisión visual/accesible fue web en Chrome, sin pruebas nativas ni locución de lector de pantalla. La captura de datos del Analista sigue siendo una frontera de integración futura.

## Clarifications

### Session 2026-10-13

- Q: ¿Dónde estarán las acciones para cambiar o cancelar el primer partido ya agendado? → A: Como acciones secundarias «Reagendar» y «Cancelar partido» debajo de los detalles del partido en la espera, tanto en escritorio como en móvil; sin menú del pasaporte y sin alterar los seis PNG aprobados.
- Q: ¿Qué ocurre con partidos y reservas existentes si el Administrador cambia un cupo de Feature 008? → A: Antes de aceptar el cambio se evalúan las unidades reservadas y usadas de todos los períodos afectados bajo la regla efectiva propuesta; se rechaza si alguna suma excedería su nuevo límite. Los partidos existentes se conservan, sin cancelación ni traslado automáticos.
- Q: ¿Sigue ocupando cupo el primer partido cuando termina la espera por una carga válida del Analista? → A: Sí. Mientras espera ocupa una unidad reservada de su período de fecha de partido; tras la carga válida, esa misma unidad pasa a usada y sigue contándose una sola vez. Solo la cancelación anterior a la carga la libera, exactamente una vez.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invitar y programar el primer partido (Priority: P1)

La persona con responsabilidad vigente sobre un pasaporte activo ve una invitación dedicada al primer partido. Desde ella abre un formulario, registra fecha, hora, rival, competencia y lugar, y confirma la programación. El partido queda asociado al jugador y al responsable que lo registró. La pantalla pasa a una espera que permanece tras cerrar sesión, recargar o cambiar de dispositivo. La invitación, el formulario y la espera ocupan la pantalla completa sin el menú del pasaporte ni navegación ajena a esta tarea.

**Why this priority**: Conecta por primera vez el pasaporte activo con un partido real, dentro del cupo configurado para su fecha.

**Independent Test**: Con un pasaporte activo, una persona responsable y un cupo vigente para la fecha elegida, programar un partido, volver a entrar y comprobar el mismo partido y la espera persistente, incluso cuando no existe custodia de Analista.

**Acceptance Scenarios**:

1. **Given** un pasaporte activo sin primer partido programado ni primer partido ya cargado por Analista, **When** su responsable autorizado lo abre, **Then** ve la invitación de pantalla completa y puede acceder al formulario sin el menú del pasaporte.
2. **Given** un cupo configurado para el período que contiene la fecha del partido, **When** el responsable confirma datos completos y queda una unidad libre después de contar unidades reservadas y usadas, **Then** se programa un solo primer partido, se reserva una unidad en ese período y se muestra la espera.
3. **Given** un primer partido programado en espera, **When** el responsable vuelve a entrar después de recargar, cerrar sesión o usar otro dispositivo, **Then** encuentra el mismo partido y la misma espera, sin otra invitación ni nueva reserva.
4. **Given** un pasaporte activo sin Analista asignado, **When** su responsable cumple las demás reglas, **Then** puede programar el primer partido; la ausencia de custodia no concede acceso de Analista.
5. **Given** un pasaporte no activo, una identidad sin responsabilidad vigente, una fecha sin configuración aplicable o un período sin unidad libre, **When** se intenta programar, **Then** no se crea partido ni reserva y se muestra un resultado seguro y comprensible.

---

### User Story 2 - Corregir o cancelar antes de la carga del Analista (Priority: P1)

Mientras el primer partido sigue esperando datos del Analista, el responsable puede usar las acciones secundarias «Reagendar» y «Cancelar partido» situadas debajo de los detalles del partido para cambiar su fecha y datos o cancelarlo. Un cambio de fecha mueve la misma reserva al período de destino solamente si allí cabe. Una cancelación libera el cupo y devuelve la invitación cuando no queda ningún primer partido programado.

**Why this priority**: Una programación errónea no debe consumir un cupo permanentemente ni perder una reserva válida por un intento fallido.

**Independent Test**: Programar el primer partido, moverlo a otro período con capacidad, intentar moverlo a un período lleno por reservas o partidos usados y cancelarlo antes de la carga; verificar en cada paso que el partido ocupa como máximo una unidad y que un error conserva íntegra la programación anterior.

**Acceptance Scenarios**:

1. **Given** un primer partido en espera, **When** el responsable cambia su fecha a otro período con capacidad tras contar unidades reservadas y usadas y confirma, **Then** el mismo partido conserva su identidad, deja libre la unidad anterior y ocupa exactamente una unidad reservada en el período nuevo.
2. **Given** un primer partido en espera, **When** se intenta mover a un período sin cupo, sin configuración aplicable o con datos inválidos, **Then** fecha, datos y reserva originales permanecen intactos y se informa el problema.
3. **Given** un primer partido en espera, **When** el responsable lo cancela antes de la carga válida, **Then** se libera exactamente una vez su única unidad reservada; si no queda primer partido programado ni ya cargado, vuelve la invitación.
4. **Given** reintentos o confirmaciones simultáneas de programación, reagendamiento, cancelación o carga para el mismo pasaporte o período, **When** se procesan, **Then** no se crean partidos ni unidades duplicados, la suma de reservadas y usadas no supera el cupo y cada partido queda en un solo estado de consumo; quien pierde el conflicto puede consultar el estado vigente antes de reintentar.
5. **Given** un primer partido en espera en escritorio o móvil, **When** el responsable autorizado consulta sus detalles, **Then** encuentra debajo las acciones secundarias «Reagendar» y «Cancelar partido», sin menú del pasaporte.
6. **Given** unidades reservadas o usadas en períodos afectados por una modificación administrativa de cupo o periodicidad, **When** el Administrador confirma una nueva regla de Feature 008, **Then** el cambio solo se acepta si en ningún período afectado la suma de ambas excedería su nuevo límite; de lo contrario se rechaza sin alterar la regla ni los partidos existentes.

---

### User Story 3 - Continuar la asignación manual del Administrador (Priority: P2)

Al completar una aprobación que produce un pasaporte `ACTIVE`, o una activación explícita, el Administrador llega directamente al flujo de asignación de Analista de ese mismo pasaporte. Allí selecciona y confirma la asignación conforme a las reglas actuales de custodia. Puede salir sin asignar: el pasaporte permanece activo y la programación de su primer partido sigue disponible para su responsable.

**Why this priority**: Hace visible el siguiente paso operativo sin convertir la custodia en requisito de activación o programación.

**Independent Test**: Finalizar una aprobación que crea un pasaporte activo y activar explícitamente otro pasaporte; en ambos casos abrir el flujo de custodia del pasaporte correcto, cancelar una asignación y comprobar que no se creó custodia automática.

**Acceptance Scenarios**:

1. **Given** una solicitud cuya aprobación finalizada crea un pasaporte `ACTIVE`, **When** el Administrador recibe el resultado final, **Then** entra directamente al flujo existente de asignación de Analista para ese pasaporte, sin una asignación implícita.
2. **Given** un pasaporte aprobado, **When** un Administrador lo activa explícitamente, **Then** se abre el mismo flujo de asignación para el pasaporte activado; la activación no asigna a nadie.
3. **Given** el flujo de asignación abierto, **When** el Administrador cancela o no confirma, **Then** no cambia la custodia; la activación o aprobación ya confirmada permanece válida.
4. **Given** una aprobación pendiente de eliminación de evidencia o que no produjo pasaporte, **When** se consulta su progreso, **Then** no se navega a una asignación inexistente; el enlace directo aparece solo después del resultado final aplicable.

---

### User Story 4 - Terminar la espera al recibir la carga del Analista (Priority: P2)

La espera del primer partido termina cuando el Analista con acceso vigente carga los datos de ese partido. Esta característica define la señal de integración y la transición visible; el trabajo de carga, análisis y publicación pertenece a otras características.

**Why this priority**: La espera tiene un final comprobable y no depende de una aprobación administrativa adicional.

**Independent Test**: Con un primer partido en espera, registrar una carga válida atribuida a su Analista autorizado y comprobar que la espera termina una sola vez y la unidad reservada pasa a usada sin duplicarse ni liberarse; una carga ajena, fallida o de otro partido no la termina ni cambia el consumo.

**Acceptance Scenarios**:

1. **Given** un primer partido programado en espera, **When** se confirma la carga de datos de ese mismo partido por un Analista con acceso de custodia vigente, **Then** la espera termina, su única unidad pasa de reservada a usada en el mismo período y el responsable ve el estado operativo del partido permitido para él.
2. **Given** una carga fallida, duplicada, de otro partido o de un Analista sin acceso vigente, **When** llega la señal, **Then** no provoca una transición adicional de la espera ni cambia el consumo del cupo ni se revela información interna.
3. **Given** que la espera terminó, **When** el responsable vuelve a abrir el pasaporte, **Then** no reaparece la invitación al primer partido; se conserva la asociación y el historial del partido.

### Edge Cases

- En el aniversario de un período, la fecha del partido pertenece al período que comienza ese día; el extremo final anterior es exclusivo. Las fechas 29, 30 y 31 y los cambios de periodicidad siguen la regla de Feature 008.
- Si no existe configuración de cupo para la fecha del partido, no se interpreta como cupo cero ni se crea una reserva provisional.
- Si dos partidos de distintos pasaportes compiten por el último cupo de sus respectivos pasaportes, cada límite se evalúa por pasaporte y período; dos intentos para el mismo pasaporte y período no pueden sobrepasarlo.
- Si la custodia se retira, cambia o pierde validez por inactivación o revocación, el acceso del Analista se revoca conforme a Feature 007. La programación y la espera no se cancelan automáticamente por ese hecho.
- Una confirmación repetida tras una respuesta perdida devuelve el resultado vigente de la misma intención, sin reservar otra unidad. Una intención distinta basada en un estado anterior se trata como conflicto.
- Una carga válida del Analista y una cancelación o reprogramación simultáneas deben tener un único resultado coherente: si prevalece la carga, la unidad queda usada en el período original y no puede liberarse ni moverse mediante las acciones previas a la carga; si prevalece la cancelación o reprogramación, la carga no puede consumir dos unidades ni terminar la espera de un partido cancelado.
- Si cambia la periodicidad, los períodos que contienen unidades reservadas o usadas se comprueban según los límites propuestos a partir de la fecha efectiva de Feature 008; el período en curso y los anteriores conservan sus reglas. Un cambio rechazado no altera la revisión vigente ni la pendiente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El pasaporte debe estar `ACTIVE` para entrar en la programación del primer partido. La custodia de Analista no es requisito para programar, reprogramar ni cancelar.
- **FR-002**: Solo el `USER` con relación vigente `SELF` o `LEGAL_REPRESENTATIVE`, o un `ACADEMY_USER` con membresía activa en la academia responsable, puede consultar o gestionar el primer partido según las reglas de pasaporte aplicables. La autorización se reevalúa al ejecutar cada acción; la visibilidad de un control no concede permisos.
- **FR-003**: Si no hay primer partido programado ni primer partido ya cargado, el responsable autorizado debe ver la invitación. Invitación, formulario y espera deben ser vistas de pantalla completa sin menú del pasaporte ni navegación innecesaria, con comportamiento coherente y accesible en web y móvil.
- **FR-004**: El formulario debe exigir fecha y hora del partido, rival, competencia y lugar, conforme a las referencias visuales aprobadas. Debe identificar el pasaporte y mostrar errores de campo y de disponibilidad sin divulgar datos privados de otros recursos.
- **FR-005**: Cada programación debe asociar un único primer partido al pasaporte, jugador y responsable que la confirmó, con estado consultable de espera. No debe fabricar resultados, estadísticas, video ni datos del Analista.
- **FR-006**: Al confirmar una programación, se debe consultar la regla de Feature 008 efectiva para la fecha del partido y su período de inicio inclusivo y fin exclusivo. La programación debe reservar exactamente una unidad en ese período solo si la suma de unidades reservadas y usadas, incluida la nueva reserva, no supera el límite configurado.
- **FR-007**: Si el pasaporte no es elegible, la fecha no es válida, no hay regla efectiva o no queda cupo después de contar unidades reservadas y usadas, se debe rechazar la operación sin crear partido ni reserva. Un cambio concurrente de cupo, programación o carga debe producir un resultado coherente y recuperable, nunca sobreventa ni doble conteo.
- **FR-008**: Un pasaporte no puede tener más de un primer partido programado en espera. Cada primer partido ocupa como máximo una unidad: reservada durante la espera, usada después de una carga válida o ninguna si fue cancelado antes de esa carga. Repetir la misma confirmación no debe crear otro partido ni otra unidad; una intención diferente sobre una versión anterior debe requerir consultar el estado vigente.
- **FR-009**: Antes de que termine la espera, el responsable autorizado debe poder reprogramar el mismo partido mediante la acción secundaria «Reagendar» debajo de sus detalles, tanto en escritorio como en móvil. La nueva fecha debe evaluarse frente a la regla y capacidad de su período de destino, contando unidades reservadas y usadas. Fecha, datos y la misma unidad reservada deben cambiar juntos; si falla cualquier validación o confirmación, la reserva y programación originales permanecen íntegramente vigentes. Tras la carga válida, la unidad usada no puede moverse mediante este flujo.
- **FR-010**: Antes de que termine la espera, el responsable autorizado debe poder cancelar el primer partido mediante la acción secundaria «Cancelar partido» debajo de sus detalles, tanto en escritorio como en móvil. La cancelación anterior a la carga válida debe liberar exactamente una vez su unidad reservada y restaurar la invitación cuando no quede primer partido programado ni cargado. Los reintentos no deben liberar más de una vez; terminar la espera no libera la unidad usada.
- **FR-011**: La espera debe persistir ligada al partido programado y sobrevivir a recargas, cierre de sesión y cambio de dispositivo. Debe distinguirse de carga, error, acceso restringido e indisponibilidad, y mostrar al responsable solo el estado operativo permitido.
- **FR-012**: La espera termina únicamente cuando se confirma que el Analista con acceso vigente cargó datos del mismo primer partido. En esa misma transición, su única unidad reservada pasa a usada en el período de la fecha del partido, sin liberarse ni contarse dos veces. La señal debe identificar el partido y el resultado confirmado de la carga; un intento, fallo, duplicado o carga de otro partido no debe producir una segunda transición ni alterar el consumo. No se agrega aprobación del Administrador.
- **FR-013**: La carga de datos del Analista es una frontera de integración; esta característica no incluye la interfaz, captura, validación deportiva, análisis, FEM ni publicación. Tras la señal válida se conserva el partido y deja de mostrarse la invitación.
- **FR-014**: Cuando finaliza una aprobación administrativa que produce un pasaporte `ACTIVE`, o una activación explícita, el Administrador debe abrir directamente el flujo existente de asignación de Analista para ese pasaporte. La asignación sigue requiriendo selección y confirmación manual; la navegación no altera por sí misma la custodia ni revierte la aprobación o activación.
- **FR-015**: Las reglas actuales de Feature 007 sobre elegibilidad del Analista, una sola custodia vigente, autorización de asignación/cambio/retiro y revocación inmediata de acceso al cambiar custodia, inactivar identidad o revocar rol deben conservarse. La programación sin custodia no concede acceso al Analista.
- **FR-016**: El sistema debe conservar la trazabilidad mínima de programación, reprogramación, cancelación, reserva, liberación, paso de unidad reservada a usada y fin de espera, con actor y momento autorizados, sin exponer identidad civil, evidencia o información interna del Analista al responsable o al público.
- **FR-017**: Esta entrega excluye pagos, selección de planes, trabajo del Analista, FEM, publicación y gestión general de partidos posteriores al primero.
- **FR-018**: Antes de aceptar una modificación administrativa de cupo o periodicidad de Feature 008, se deben evaluar todas las unidades reservadas y usadas de los períodos afectados conforme a la regla propuesta desde su fecha efectiva. Si en cualquier período afectado su suma superaría el nuevo límite, se debe rechazar el cambio completo sin modificar la configuración ni los partidos existentes. Un cambio aceptado debe conservar todos esos partidos y sus unidades; ninguno se cancela, libera ni traslada automáticamente. Se mantienen los límites de período y la entrada en vigor definidos por Feature 008, incluso ante cambios concurrentes de consumo.

### Key Entities *(include if feature involves data)*

- **Primer partido**: Partido único de inicio asociado al pasaporte y jugador; conserva fecha, hora, rival, competencia, lugar, responsable que lo registró y estado operativo.
- **Unidad de cupo del primer partido**: Una sola unidad vinculada al partido y al período de Feature 008 que contiene su fecha. Está reservada mientras espera; una reprogramación válida mueve esa misma unidad al nuevo período y una cancelación anterior a la carga la libera exactamente una vez. Una carga válida la convierte en usada en el mismo período, sin crear otra unidad ni devolver disponibilidad.
- **Espera del primer partido**: Estado persistente entre programación confirmada y carga de datos confirmada del mismo partido por un Analista autorizado.
- **Resultado de carga del Analista**: Señal de integración identificada por partido, éxito confirmado y autoridad vigente. Solo este hecho termina la espera; su contenido deportivo queda fuera de esta característica.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En pruebas web y móvil, al menos el 90 % de responsables autorizados completa la invitación y programa el primer partido en menos de tres minutos, sin usar el menú del pasaporte.
- **SC-002**: En el 100 % de programaciones, cancelaciones, reprogramaciones y cargas probadas, cada primer partido ocupa exactamente una unidad reservada mientras espera, una unidad usada tras la carga válida o ninguna si se canceló antes; ninguna prueba concurrente supera el límite de Feature 008 al sumar reservadas y usadas ni cuenta dos veces un partido.
- **SC-003**: En el 100 % de reprogramaciones rechazadas, se conservan fecha, datos y unidad reservada originales; en el 100 % de cancelaciones anteriores a la carga confirmadas se libera exactamente una unidad y vuelve la invitación cuando corresponde.
- **SC-004**: En el 100 % de pruebas de recarga, nueva sesión y otro dispositivo, la espera y el partido correcto se recuperan; una carga válida del mismo partido termina la espera y pasa su única unidad a usada una sola vez, sin devolver disponibilidad, y ninguna carga inválida altera la espera o el cupo.
- **SC-005**: En el 100 % de aprobaciones que crean un pasaporte activo y activaciones explícitas ensayadas, el Administrador llega al flujo de asignación del pasaporte correcto; ninguna de ellas asigna automáticamente un Analista.
- **SC-006**: En el 100 % de casos de denegación por responsabilidad, estado, cupo o acceso del Analista, no se divulga información protegida ni se altera parcialmente la programación, reserva o custodia.
- **SC-007**: En el 100 % de pruebas de modificación de cupo o periodicidad con unidades reservadas o usadas en períodos afectados, se rechaza sin cambios toda propuesta cuya suma de ambas cause exceso en alguno de ellos; las propuestas aceptadas conservan íntegros los partidos y sus unidades existentes.

## Referencias visuales aprobadas

Estas seis imágenes son la autoridad visual para la invitación, el formulario y la espera del primer partido. En escritorio y móvil se conserva la composición de pantalla completa, sin menú del pasaporte ni navegación ajena al flujo.

| Pantalla | Escritorio | Móvil |
|---|---|---|
| Invitación | `docs/design/feature-009/first-match-invitation-desktop.png` | `docs/design/feature-009/first-match-invitation-mobile.png` |
| Formulario de programación | `docs/design/feature-009/first-match-scheduling-desktop.png` | `docs/design/feature-009/first-match-scheduling-mobile.png` |
| Espera del primer partido | `docs/design/feature-009/first-match-waiting-desktop.png` | `docs/design/feature-009/first-match-waiting-mobile.png` |

Las cifras de cupos, fechas, nombres, datos del partido y menciones de un «Analista asignado» son contenido ilustrativo de las imágenes: deben reflejar el estado real. En particular, la falta de Analista no impide programar, y no debe afirmarse que un Analista asignado verá el partido si aún no existe custodia vigente. La secuencia ilustrada de trabajo del Analista, FEM y disponibilidad posterior no amplía el alcance de esta característica.

Las referencias de espera no muestran controles para reprogramar ni cancelar un partido ya agendado. Por decisión posterior aprobada, se agregan las acciones secundarias «Reagendar» y «Cancelar partido» debajo de los detalles del partido, en escritorio y móvil, conservando la composición de pantalla completa sin menú del pasaporte. Los seis PNG permanecen intactos y siguen siendo la base visual; no se les atribuye una apariencia de controles que no muestran. El botón «Cancelar» del formulario solo descarta la confirmación en curso y no representa la cancelación de un partido existente.

## Assumptions

- La responsabilidad para registrar un partido sigue la regla de producto existente: `USER` titular o representante vigente, o academia responsable con membresía vigente. Un menor no recibe cuenta propia.
- El cupo se determina por la fecha del partido y la revisión de Feature 008 efectiva en esa fecha, incluidos sus aniversarios de Colombia y cambios de periodicidad. La unidad reservada o usada pertenece al partido, no al Analista ni a la academia; su paso a usada no indica publicación ni agrega trabajo deportivo a esta característica.
- La invitación se restaura solo si el primer partido fue cancelado antes de la carga y no queda un primer partido programado. Una vez cargado, la gestión posterior queda fuera de este alcance.
- La aprobación de Feature 006 que crea un pasaporte activo y la activación explícita de Feature 005 conservan sus decisiones de negocio; aquí se agrega la continuación directa a la asignación existente de Feature 007.
- Las seis imágenes enumeradas en «Referencias visuales aprobadas» son las referencias de este flujo. Las vistas `docs/design/passport-web-matches.png` y `docs/design/passport-mobile-matches.png` representan partidos analizados; no son autoridad visual para el primer partido.
- La especificación de Feature 008 sigue marcada como borrador pendiente de aprobación formal. El propietario aprobó usar sus contratos actuales como base de este plan; esa autorización no modifica el estado formal de Feature 008 ni sus reglas de períodos.
