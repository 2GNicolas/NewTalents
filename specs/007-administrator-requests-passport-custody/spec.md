# Feature Specification: Interfaz administrativa de solicitudes y custodia de pasaportes

**Feature Branch**: `feature/007-administrator-requests-passport-custody`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Rediseñar el módulo existente de solicitudes del Administrador y permitir la asignación, cambio y retiro de custodia de pasaportes aprobados a Analistas, sin modificar el comportamiento de registro y aprobación de Feature 006."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestionar solicitudes desde un espacio operativo (Priority: P1)

Como Administrador autorizado, quiero abrir un espacio de solicitudes organizado por la siguiente acción operativa para identificar rápidamente qué requiere atención y continuar cada solicitud con el comportamiento ya existente.

**Why this priority**: La gestión de solicitudes ya es una operación crítica. El rediseño debe mejorar su lectura sin alterar decisiones, autorizaciones ni resultados existentes.

**Independent Test**: Se puede validar abriendo el espacio de solicitudes con casos sintéticos en cada grupo, comprobando el contenido mínimo de las tarjetas, accediendo a la vista completa y continuando una revisión existente sin cambios funcionales.

**Acceptance Scenarios**:

1. **Given** que existen solicitudes en distintas etapas, **When** el Administrador abre Solicitudes, **Then** ve los grupos Nuevas, Continuar revisión, Requieren corrección, Listas para decisión y Esperando verificación de eliminación de evidencias.
2. **Given** una solicitud dentro de un grupo operativo, **When** se muestra su tarjeta, **Then** contiene únicamente referencia enmascarada, nombre visible del solicitante o academia, tipo, una fecha o contexto relevante y una acción siguiente clara.
3. **Given** una solicitud existente, **When** el Administrador activa su siguiente acción, **Then** continúa la revisión, corrección, rechazo, expediente, eliminación de evidencias o aprobación mediante el comportamiento vigente.
4. **Given** que el Administrador necesita localizar otro caso, **When** abre la vista completa de solicitudes, **Then** puede buscar y filtrar sin perder el acceso a los grupos operativos.
5. **Given** un usuario sin la capacidad administrativa requerida, **When** intenta abrir o accionar el espacio, **Then** no obtiene acceso aunque conozca la ubicación de la funcionalidad.

---

### User Story 2 - Asignar un pasaporte sin Analista (Priority: P1)

Como Administrador autorizado, quiero asignar un pasaporte básico activo a un Analista disponible para que el Analista correcto pueda iniciar su enriquecimiento posterior.

**Why this priority**: La custodia conecta el resultado aprobado de registro con el trabajo autorizado del Analista y es la nueva capacidad principal de la funcionalidad.

**Independent Test**: Se puede validar con un pasaporte aprobado sin custodia, iniciando la asignación desde la solicitud aprobada y desde Custodia, confirmándola y comprobando el cambio de listas, carga activa y acceso del Analista.

**Acceptance Scenarios**:

1. **Given** un pasaporte básico activo sin asignación, **When** aparece en Custodia, **Then** muestra los estados En espera de enriquecimiento del Analista y Sin Analista.
2. **Given** una solicitud aprobada que produjo un pasaporte, **When** el Administrador inicia la asignación desde esa solicitud, **Then** se abre el mismo proceso de custodia asociado al pasaporte existente.
3. **Given** un pasaporte sin Analista, **When** el Administrador lo busca por nombre visible del jugador o referencia enmascarada, **Then** puede localizarlo sin revelar información de identidad protegida.
4. **Given** la lista de Analistas disponibles, **When** el Administrador elige uno, **Then** ve su cantidad actual de custodias activas antes de confirmar.
5. **Given** una asignación confirmada, **When** finaliza la operación, **Then** el pasaporte desaparece de Sin Analista, aparece para el Analista seleccionado, su carga activa aumenta una unidad y se registra el historial correspondiente.

---

### User Story 3 - Confirmar o cancelar una asignación de forma segura (Priority: P1)

Como Administrador autorizado, quiero revisar el destino antes de guardar una asignación para evitar cambios accidentales.

**Why this priority**: La confirmación es el límite que convierte una selección visual en un cambio real de autoridad sobre el pasaporte.

**Independent Test**: Se puede seleccionar un Analista mediante arrastre en escritorio o acción accesible en móvil, cancelar una vez y confirmar otra, verificando que solo la confirmación persiste.

**Acceptance Scenarios**:

1. **Given** la vista de escritorio, **When** el Administrador arrastra un pasaporte hasta el área de un Analista y lo suelta, **Then** solo selecciona al Analista y abre la confirmación sin cambiar la custodia.
2. **Given** la vista móvil, **When** el Administrador activa Asignar Analista o Cambiar Analista, **Then** puede seleccionar al Analista y llega a la misma confirmación sin depender de arrastrar.
3. **Given** la confirmación abierta, **When** se presenta, **Then** muestra referencia del pasaporte, nombre visible del jugador, Analista actual o Sin asignar, Analista seleccionado, Cancelar y Confirmar asignación.
4. **Given** una confirmación abierta, **When** el Administrador cancela, **Then** la custodia, las cargas de trabajo, los accesos y el historial permanecen sin cambios.

---

### User Story 4 - Cambiar o retirar la custodia (Priority: P1)

Como Administrador autorizado, quiero cambiar el Analista responsable o retirar la custodia para mantener una única asignación activa y revocar accesos que ya no corresponden.

**Why this priority**: La custodia debe reflejar la responsabilidad vigente; una asignación obsoleta produciría acceso indebido y cargas incorrectas.

**Independent Test**: Se puede partir de un pasaporte asignado, cambiarlo a otro Analista y después retirar la custodia, verificando en cada paso acceso, listas, cargas e historial.

**Acceptance Scenarios**:

1. **Given** un pasaporte con Analista activo, **When** el Administrador confirma el cambio a otro Analista con un motivo, **Then** existe una sola custodia activa, el Analista anterior pierde acceso y el nuevo lo obtiene.
2. **Given** un pasaporte con Analista activo, **When** el Administrador confirma Retirar custodia con un motivo, **Then** el pasaporte vuelve a Sin Analista y deja de estar disponible para el Analista anterior.
3. **Given** un cambio o retiro confirmado, **When** se recalculan las cargas visibles, **Then** solo se cuentan asignaciones activas.
4. **Given** un usuario sin la capacidad administrativa de custodia, **When** intenta asignar, cambiar o retirar, **Then** la operación se deniega y el estado previo permanece intacto.
5. **Given** una asignación, cambio o retiro, **When** finaliza, **Then** no se conceden capacidades de Administrador ni se crea información deportiva.

---

### User Story 5 - Resolver conflictos y reintentar fallos (Priority: P1)

Como Administrador autorizado, quiero recibir un resultado recuperable ante una edición concurrente o un fallo para no sobrescribir una custodia más reciente ni dejar el pasaporte en un estado ambiguo.

**Why this priority**: La custodia determina acceso a información privada; la concurrencia y los fallos deben conservar una única fuente de verdad.

**Independent Test**: Dos Administradores pueden intentar asignar el mismo pasaporte desde el mismo estado, y también puede simularse un fallo antes de reintentar, comprobando unicidad, ausencia de efectos parciales e idempotencia.

**Acceptance Scenarios**:

1. **Given** dos Administradores que parten del mismo pasaporte sin asignar, **When** ambos confirman destinos distintos de manera concurrente, **Then** solo una asignación queda activa y el otro recibe un conflicto recuperable con el estado vigente.
2. **Given** una operación que falla, **When** se muestra el resultado, **Then** la custodia anterior, los accesos, las cargas y el historial permanecen sin cambios parciales.
3. **Given** un fallo recuperable, **When** el Administrador actualiza el estado y reintenta de forma segura, **Then** puede completar la operación una sola vez.
4. **Given** un comando confirmado que se repite con la misma intención, **When** vuelve a procesarse, **Then** no crea otra custodia activa ni duplica el historial.

---

### User Story 6 - Consultar el pasaporte y el historial de custodia (Priority: P2)

Como Administrador autorizado, quiero abrir el pasaporte, su expediente vinculado y el historial de custodia para entender la responsabilidad vigente y sus cambios sin exponer identidad protegida.

**Why this priority**: La trazabilidad permite investigar cambios y operar con contexto, pero depende de que la asignación principal funcione primero.

**Independent Test**: Se puede abrir un pasaporte con varios cambios sintéticos, navegar al expediente y comprobar la secuencia histórica, los actores visibles permitidos y la ausencia de datos protegidos.

**Acceptance Scenarios**:

1. **Given** un pasaporte visible en Custodia, **When** el Administrador abre su detalle, **Then** ve el estado del pasaporte, la custodia actual, las acciones permitidas y accesos al pasaporte y expediente vinculados.
2. **Given** un pasaporte con asignaciones anteriores, **When** el Administrador consulta el historial, **Then** ve en orden cada asignación, cambio y retiro confirmado con fecha, acción, responsable administrativo, destino permitido y motivo seguro.
3. **Given** el historial de custodia, **When** se presenta o se busca, **Then** no muestra documentos civiles, contactos, credenciales ni identificadores privados.
4. **Given** las secciones administrativas, **When** el usuario navega, **Then** Inicio, Solicitudes, Expedientes y Custodia permanecen diferenciados y no aparece “Administrador autorizado”.

---

### User Story 7 - Acceso del Analista según custodia vigente (Priority: P1)

Como Analista, quiero ver únicamente los pasaportes cuya custodia activa me fue asignada para trabajar dentro de mi autoridad vigente.

**Why this priority**: La consecuencia observable más importante de la custodia es conceder y revocar acceso correctamente.

**Independent Test**: Se asigna un pasaporte a un Analista, se cambia a otro y se retira; tras cada transición se comprueba la lista autorizada de ambos Analistas.

**Acceptance Scenarios**:

1. **Given** una asignación confirmada, **When** el Analista asignado consulta sus pasaportes autorizados, **Then** encuentra el pasaporte.
2. **Given** un cambio de custodia confirmado, **When** ambos Analistas actualizan sus listas, **Then** el anterior deja de verlo y el nuevo lo encuentra.
3. **Given** un retiro confirmado, **When** el Analista anterior actualiza su lista, **Then** ya no puede ver ni abrir el pasaporte por esa custodia.
4. **Given** un intento de acceso basado únicamente en una etiqueta de rol visible, **When** no existe custodia activa correspondiente, **Then** el acceso se deniega.

---

### User Story 8 - Consultar expedientes confirmados (Priority: P2)

Como Administrador autorizado, quiero abrir Expedientes como una sección independiente para localizar y consultar expedientes confirmados, su origen y el pasaporte vinculado sin iniciar nuevas decisiones ni exponer información protegida.

**Why this priority**: La consulta de expedientes completa el espacio administrativo aprobado y aporta trazabilidad entre solicitud, expediente y pasaporte, pero reutiliza resultados ya confirmados y no modifica el flujo crítico de aprobación.

**Independent Test**: Se puede abrir Expedientes directamente desde el menú, recorrer varias páginas estables de expedientes sintéticos confirmados, buscar y filtrar, abrir un detalle y navegar a la solicitud de origen y al pasaporte vinculado sin editar ni ejecutar acciones de aprobación.

**Acceptance Scenarios**:

1. **Given** un Administrador autorizado en cualquier sección administrativa, **When** activa Expedientes en el menú, **Then** abre directamente la consulta independiente de expedientes confirmados.
2. **Given** suficientes expedientes confirmados para más de una página, **When** el Administrador avanza y retrocede por la lista sin cambios en el conjunto, **Then** la paginación mantiene un orden estable y no repite ni omite expedientes.
3. **Given** expedientes confirmados existentes, **When** el Administrador busca por nombre permitido o referencia enmascarada y aplica filtros de estado, tipo de solicitud de origen o fecha de confirmación, **Then** la lista muestra únicamente los expedientes coincidentes.
4. **Given** un expediente listado, **When** el Administrador abre su detalle, **Then** ve nombre o referencia permitida, estado, historial de confirmación, solicitud de origen y pasaporte vinculado.
5. **Given** el detalle de un expediente, **When** el Administrador abre la solicitud de origen o el pasaporte vinculado y vuelve a Expedientes, **Then** puede navegar entre los registros conservando el contexto de consulta de la lista.
6. **Given** que no existen expedientes o que una búsqueda no tiene coincidencias, **When** se presenta la lista, **Then** muestra un estado vacío claro y diferenciado de un fallo de consulta.
7. **Given** que la consulta de lista o detalle falla, **When** el Administrador recibe el resultado, **Then** ve un estado de error claro con una opción segura para reintentar sin inventar ni mostrar datos obsoletos como vigentes.
8. **Given** un expediente cuyo flujo eliminó evidencias o contiene identidad protegida, **When** se muestra su lista, detalle o historial, **Then** no se exponen las evidencias eliminadas ni los datos de identidad protegidos.
9. **Given** un expediente confirmado existente, **When** el Administrador lo consulta, **Then** no se ofrecen edición, nueva confirmación, nueva aprobación ni cambios a las reglas existentes de creación o eliminación.

### Edge Cases

- Un pasaporte deja de estar activo o disponible para enriquecimiento mientras la confirmación está abierta; la operación se rechaza y se muestra el estado actual.
- El Analista seleccionado deja de estar disponible o autorizado antes de confirmar; la operación no cambia la custodia y permite elegir otro destino.
- El pasaporte ya fue asignado, cambiado o desasignado en otra sesión; la vista desactualizada no puede sobrescribir el estado vigente.
- Una búsqueda no produce resultados; se presenta un estado vacío diferenciado de indisponibilidad o error.
- No existen Analistas disponibles; el pasaporte permanece Sin Analista y la interfaz explica que no hay destinos elegibles.
- El historial contiene muchos cambios; mantiene orden estable y navegación sin perder el contexto del pasaporte.
- El motivo contiene datos personales innecesarios o excede el límite permitido; se rechaza con orientación segura sin guardar un evento parcial.
- La carga de trabajo cambia mientras la confirmación está abierta; la confirmación usa el Analista seleccionado, pero el resultado posterior muestra la carga activa actualizada.
- El Administrador usa teclado, lector de pantalla, movimiento reducido o un viewport móvil; todas las acciones siguen siendo operables sin depender de color, gesto de arrastre o animación.
- Un expediente cambia de estado mientras se navega entre páginas o registros; al actualizar, la consulta presenta el estado vigente sin duplicar ni perder elementos dentro de una vista estable.
- La solicitud de origen o el pasaporte vinculado deja de estar disponible para el Administrador; el expediente sigue siendo consultable dentro de su autoridad y el vínculo no revela información restringida.

## Requirements *(mandatory)*

### Functional Requirements

#### Alcance y continuidad de solicitudes

- **FR-001**: El sistema MUST conservar sin cambios la creación, envío, revisión, corrección, rechazo, expediente manual, eliminación de evidencias, aprobación y creación de pasaporte existentes.
- **FR-002**: El sistema MUST presentar el espacio administrativo de solicitudes conforme a la autoridad visual exclusiva de `docs/design/admin-custody/`, sin usar referencias de Feature 006.
- **FR-003**: El espacio de solicitudes MUST incluir los grupos Nuevas, Continuar revisión, Requieren corrección, Listas para decisión y Esperando verificación de eliminación de evidencias.
- **FR-004**: Cada tarjeta operativa de solicitud MUST mostrar solo referencia enmascarada, nombre visible del solicitante o academia, tipo, una fecha o contexto relevante y una acción siguiente clara.
- **FR-005**: El sistema MUST mantener una vista completa de solicitudes con búsqueda y filtros.
- **FR-006**: Las acciones iniciadas desde el nuevo espacio MUST continuar mediante las operaciones existentes y MUST NOT recrear reglas de revisión o decisión en la presentación.
- **FR-007**: El sistema MUST mantener solicitudes, expedientes, pasaportes y custodias como conceptos y destinos visualmente diferenciados.

#### Pasaportes disponibles para custodia

- **FR-008**: Todo pasaporte básico creado por una aprobación existente MUST quedar disponible para custodia sin crear otro pasaporte.
- **FR-009**: Un pasaporte básico activo sin custodia MUST mostrarse como En espera de enriquecimiento del Analista y Sin Analista.
- **FR-010**: El Administrador autorizado MUST poder ver todos los pasaportes activos sin Analista que estén disponibles para custodia.
- **FR-011**: El Administrador autorizado MUST poder buscar pasaportes por nombre visible del jugador o referencia enmascarada.
- **FR-012**: El sistema MUST mostrar Analistas elegibles con su cantidad de custodias activas.
- **FR-013**: Las cantidades de carga MUST incluir únicamente custodias activas y MUST actualizarse después de una asignación, cambio o retiro confirmado.
- **FR-014**: El Administrador MUST poder iniciar la asignación desde una solicitud aprobada o desde el espacio Custodia, siempre sobre el mismo pasaporte existente.

#### Selección y confirmación

- **FR-015**: En escritorio, arrastrar y soltar un pasaporte sobre un Analista MUST seleccionar el destino y abrir la confirmación, pero MUST NOT guardar la custodia por sí mismo.
- **FR-016**: En móvil, el sistema MUST ofrecer Asignar Analista o Cambiar Analista sin exigir arrastrar y soltar.
- **FR-017**: La confirmación MUST mostrar referencia enmascarada del pasaporte, nombre visible del jugador, Analista actual o Sin asignar, Analista seleccionado, Cancelar y Confirmar asignación.
- **FR-018**: Cancelar la confirmación MUST conservar sin cambios la custodia, el acceso, la carga y el historial.
- **FR-019**: La asignación inicial MUST poder confirmarse sin solicitar un motivo.
- **FR-020**: El sistema MUST requerir confirmación equivalente y motivo seguro para cambiar o retirar custodia.

#### Reglas de custodia

- **FR-021**: Un pasaporte MUST tener como máximo una custodia activa de Analista.
- **FR-022**: Solo una capacidad administrativa autorizada MUST permitir asignar, cambiar o retirar custodia; una etiqueta de rol visible no es autorización suficiente.
- **FR-023**: Una asignación confirmada MUST activar la custodia del Analista seleccionado y retirar el pasaporte de la lista Sin Analista.
- **FR-024**: Un cambio confirmado MUST terminar la custodia anterior y establecer una única nueva custodia activa como una sola transición observable.
- **FR-025**: Un retiro confirmado MUST terminar la custodia activa y devolver el pasaporte a Sin Analista.
- **FR-026**: Cada asignación, cambio o retiro confirmado MUST crear exactamente una entrada de historial; cancelaciones y operaciones fallidas MUST NOT crear entradas.
- **FR-027**: Comandos repetidos con la misma intención MUST NOT duplicar custodias activas ni entradas de historial.
- **FR-028**: Intentos concurrentes sobre el mismo estado MUST conservar una sola custodia activa autoritativa y devolver un conflicto recuperable a los demás intentos.
- **FR-029**: Una operación fallida MUST preservar por completo el estado autoritativo anterior y permitir un reintento seguro después de actualizar la vista.
- **FR-030**: Si el pasaporte o el Analista dejan de ser elegibles antes de confirmar, el sistema MUST rechazar la operación sin efectos parciales y mostrar un resultado recuperable.

#### Acceso, privacidad y trazabilidad

- **FR-031**: Tras una asignación confirmada, el pasaporte MUST aparecer en la lista autorizada del Analista asignado.
- **FR-032**: Tras un cambio o retiro confirmado, el Analista anterior MUST perder acceso derivado de esa custodia.
- **FR-033**: La custodia MUST NOT conceder capacidades administrativas, crear información deportiva ni ejecutar enriquecimiento automático.
- **FR-034**: El Administrador autorizado MUST poder abrir el pasaporte y el expediente vinculados desde el contexto de custodia.
- **FR-035**: El Administrador autorizado MUST poder consultar un historial cronológico de asignaciones, cambios y retiros.
- **FR-036**: Cada entrada de historial MUST identificar fecha, tipo de cambio, actor administrativo, destino permitido y motivo seguro, sin exponer identidad protegida.
- **FR-037**: Las búsquedas, tarjetas, confirmaciones, errores e historial MUST usar referencias enmascaradas y la información mínima necesaria.
- **FR-038**: Los intentos denegados, conflictos y fallos MUST NOT revelar datos privados de pasaportes, jugadores o Analistas fuera de la autoridad del actor.

#### Experiencia administrativa y accesibilidad

- **FR-039**: La navegación administrativa MUST incluir Inicio, Solicitudes, Expedientes y Custodia, y MUST NOT mostrar “Administrador autorizado”.
- **FR-040**: Las vistas MUST preservar fondo líquido esmeralda y verde-negro, superficies oscuras translúcidas, acentos lima moderados y jerarquía de texto blanco roto y gris-verde conforme a las referencias aprobadas.
- **FR-041**: Las composiciones MUST ser responsivas en escritorio y móvil, con objetivos táctiles accesibles y sin desplazamiento horizontal necesario para completar tareas.
- **FR-042**: Todas las acciones MUST ser operables por teclado y lector de pantalla, con foco visible, nombres accesibles y comunicación de estado mediante texto e iconos además de color.
- **FR-043**: El sistema MUST respetar la preferencia de movimiento reducido y MUST ofrecer una alternativa sin arrastre para cualquier operación de custodia.
- **FR-044**: El sistema MUST distinguir estados de carga, vacío, acceso restringido, conflicto, fallo recuperable e indisponibilidad en solicitudes y Custodia.

#### Consulta independiente de expedientes

**Corrección de aceptación (2026-10-06):** El nombre que el Administrador escribe al confirmar el expediente (`dossierName`) es el nombre propio del expediente, distinto del nombre del jugador y de la referencia técnica. Debe conservarse literalmente (tras recortar espacios exteriores) en la confirmación, aparecer como «Nombre del expediente» en lista y detalle y participar en la búsqueda autorizada. Los expedientes históricos sin nombre guardado permanecen sin nombre; no se infiere uno de la identidad, solicitud, pasaporte o UUID. La corrección local del expediente indicado por el Administrador es puntual, no una migración de nombres históricos.

- **FR-045**: La navegación administrativa MUST permitir abrir Expedientes directamente como una sección de consulta independiente de Solicitudes, Pasaportes y Custodia.
- **FR-046**: Expedientes MUST listar los expedientes confirmados existentes que el Administrador esté autorizado a consultar, sin crear ni reconfirmar registros durante la consulta.
- **FR-047**: La lista de expedientes MUST ofrecer paginación estable, de modo que un conjunto sin cambios conserve el mismo orden y no repita ni omita expedientes al avanzar o retroceder.
- **FR-048**: El Administrador MUST poder buscar expedientes por nombre permitido o referencia enmascarada.
- **FR-049**: El Administrador MUST poder filtrar expedientes por estado, tipo de solicitud de origen y fecha de confirmación cuando esos criterios sean aplicables.
- **FR-050**: El detalle de un expediente MUST mostrar únicamente su nombre o referencia permitida, estado, historial de confirmación, solicitud de origen y pasaporte vinculado.
- **FR-051**: Desde el detalle, el Administrador MUST poder abrir la solicitud de origen y el pasaporte vinculado, y volver a la consulta de expedientes conservando búsqueda, filtros y posición de paginación.
- **FR-052**: La consulta de expedientes MUST distinguir claramente carga, lista vacía, búsqueda sin resultados, acceso restringido y error recuperable, con una opción segura de reintento cuando corresponda.
- **FR-053**: La lista, el detalle, el historial y los vínculos de expedientes MUST NOT exponer evidencias eliminadas, documentos civiles, contactos, credenciales ni otros datos de identidad protegidos.
- **FR-054**: La consulta independiente MUST reutilizar los expedientes y el comportamiento de aprobación existentes, y MUST NOT permitir edición de expedientes, nuevas confirmaciones, nuevas acciones de aprobación ni cambios a las reglas de creación, confirmación o eliminación de Feature 006.

### Business States and Transitions

- **Pasaporte sin custodia**: pasaporte básico activo, en espera de enriquecimiento y Sin Analista; puede pasar a Custodia activa solo mediante confirmación válida.
- **Destino seleccionado**: existe una selección temporal de Analista; no cambia acceso, carga ni historial.
- **Confirmación pendiente**: muestra estado actual y destino; para cambio o retiro incluye motivo. Cancelar vuelve al estado previo sin efectos.
- **Custodia activa**: exactamente un Analista tiene la responsabilidad vigente y el acceso derivado.
- **Cambio confirmado**: sustituye la custodia previa por una nueva y registra un único cambio histórico.
- **Custodia retirada**: no existe custodia activa; el pasaporte vuelve a Sin Analista y el acceso anterior queda revocado.
- **Conflicto recuperable**: otra operación ganó la concurrencia; se conserva el estado autoritativo y se solicita actualizar antes de reintentar.
- **Fallo recuperable**: no se produjo cambio parcial; se conserva el estado previo y puede reintentarse de forma segura.

### Key Entities *(include if feature involves data)*

- **Pasaporte básico**: Pasaporte privado creado por la aprobación existente; incluye referencia enmascarable, jugador visible permitido, estado activo y estado de enriquecimiento, sin duplicarse durante la custodia.
- **Custodia de Analista**: Responsabilidad vigente que vincula un pasaporte con un único Analista elegible; tiene estado activo o finalizado y nunca concede capacidades administrativas.
- **Evento de historial de custodia**: Registro inmutable y mínimo de una asignación, cambio o retiro confirmado, con fecha, acción, actor administrativo, destino permitido y motivo seguro solo para cambio o retiro.
- **Analista elegible**: Persona con autoridad vigente para recibir custodia; expone al Administrador solo la identificación operativa necesaria y su carga activa.
- **Carga activa**: Conteo observable de custodias activas de un Analista, excluyendo custodias finalizadas, cancelaciones y operaciones fallidas.
- **Solicitud de registro**: Solicitud existente cuyo comportamiento no cambia; una solicitud aprobada puede enlazar al pasaporte ya creado para iniciar custodia.
- **Expediente**: Registro manual confirmado existente, consultable de forma independiente mediante nombre o referencia permitida, estado, historial de confirmación, solicitud de origen y pasaporte vinculado, sin cambios en su creación, confirmación, edición o eliminación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las solicitudes sintéticas en los cinco grupos operativos muestra exactamente la información mínima definida y una acción siguiente válida.
- **SC-002**: El 100% de las acciones existentes de revisión, corrección, rechazo, expediente, eliminación de evidencias y aprobación conserva el mismo resultado funcional antes y después del rediseño.
- **SC-003**: Un Administrador puede localizar y abrir una solicitud, un expediente o un pasaporte por nombre permitido o referencia enmascarada en menos de 30 segundos en conjuntos de hasta 1.000 elementos.
- **SC-004**: Al menos el 95% de los Administradores de prueba completa una asignación desde Custodia en menos de 2 minutos sin asistencia.
- **SC-005**: En el 100% de las pruebas de escritorio y móvil, seleccionar o soltar un destino no cambia la custodia hasta activar la confirmación final.
- **SC-006**: El 100% de las cancelaciones deja sin cambios custodia, accesos, cargas e historial.
- **SC-007**: El 100% de las asignaciones, cambios y retiros confirmados produce una sola custodia activa coherente y exactamente una entrada de historial.
- **SC-008**: En todas las pruebas de comandos repetidos, no se producen asignaciones ni eventos históricos duplicados.
- **SC-009**: En todas las carreras controladas entre dos Administradores, queda una sola custodia activa y el intento perdedor recibe un conflicto recuperable sin efectos parciales.
- **SC-010**: En todas las pruebas de fallo y reintento, el estado anterior permanece íntegro hasta que un único reintento confirmado termina correctamente.
- **SC-011**: El 100% de los cambios y retiros revoca el acceso del Analista anterior y actualiza las listas autorizadas y cargas activas de los Analistas afectados.
- **SC-012**: Ninguna prueba de custodia crea otro pasaporte, información deportiva, enriquecimiento automático ni capacidades administrativas.
- **SC-013**: El 100% de los eventos de historial verificados omite documentos civiles, contactos, credenciales e identificadores privados.
- **SC-014**: Todos los recorridos principales se completan con teclado, con lector de pantalla y en viewport móvil sin depender de arrastre, color o animación.
- **SC-015**: Las vistas administrativas evaluadas muestran Inicio, Solicitudes, Expedientes y Custodia, mantienen diferenciados los cuatro conceptos y no muestran “Administrador autorizado”.
- **SC-016**: Los 13 recorridos obligatorios de esta especificación, incluida la consulta independiente de Expedientes, pasan aceptación funcional con datos sintéticos y sin regresiones observables en Feature 006.
- **SC-017**: El 100% de los expedientes confirmados autorizados de un conjunto de prueba aparece exactamente una vez al recorrer todas las páginas estables y puede localizarse mediante su búsqueda y filtros aplicables.
- **SC-018**: El 100% de los detalles de expediente verificados muestra estado, historial de confirmación, solicitud de origen y pasaporte vinculado, sin evidencias eliminadas ni datos de identidad protegidos.
- **SC-019**: En el 100% de las pruebas de navegación entre expediente, solicitud y pasaporte, el Administrador puede volver a la lista conservando búsqueda, filtros y posición, y los estados vacío y de error permanecen claramente diferenciados.

## Assumptions

- Feature 006 está completa y sus reglas, operaciones, autorizaciones y resultados son dependencias estables que esta funcionalidad reutiliza sin modificarlas.
- La aprobación existente produce un único pasaporte básico enlazable con su solicitud y expediente.
- La elegibilidad de los Analistas y su acceso autenticado ya pueden determinarse mediante hechos autoritativos del sistema; esta funcionalidad solo añade la custodia como condición de acceso al pasaporte asignado.
- Los nombres visibles usados en tarjetas y búsquedas ya son proyecciones permitidas; documentos civiles y datos de contacto no se necesitan para operar la custodia.
- Los motivos de cambio y retiro son textos operativos breves, obligatorios y sujetos a validación para evitar datos personales innecesarios; la asignación inicial no solicita ni persiste motivo.
- Las referencias bajo `docs/design/admin-custody/` son la única autoridad visual de Feature 007; las referencias de Feature 006 no se consultan ni gobiernan este trabajo.
- Inicio puede recibir el shell y navegación administrativa aprobados. Expedientes añade únicamente consulta independiente de registros existentes; sus reglas de creación, confirmación y eliminación no cambian.

## Dependencies

- Flujo existente de solicitudes, decisiones, expediente manual, eliminación de evidencias, aprobación y creación de pasaporte.
- Autorización administrativa y de Analista basada en capacidades y hechos vigentes, no en etiquetas visibles.
- Lista existente de pasaportes autorizados para Analistas.
- Relación existente entre solicitud aprobada, expediente, jugador y pasaporte.

## Out of Scope

- Cambios a Feature 006 o a la creación de solicitudes de registro.
- Cambios en reglas de revisión, corrección, rechazo, aprobación, expediente manual o manejo de evidencias.
- Edición de expedientes, nuevas confirmaciones o nuevas acciones de aprobación desde la sección Expedientes.
- Crear otro pasaporte durante una asignación.
- Enriquecimiento del Analista o ejecución del FEM.
- Creación o modificación automática de datos deportivos, estadísticas, partidos, videos o evaluaciones.
- Perfiles públicos, pagos o analítica general del negocio.
- Asignaciones automáticas, masivas o realizadas por actores distintos de un Administrador con capacidad autorizada.
