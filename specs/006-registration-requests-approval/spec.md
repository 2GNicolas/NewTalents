# Feature Specification: Solicitudes de registro y aprobación

**Feature Branch**: `feature/006-registration-requests-approval`

**Created**: 2026-09-22

**Status**: Draft

**Input**: Entregar los siete tipos aprobados de solicitud de registro, la recepción temporal y segura de evidencias, el seguimiento y corrección por el solicitante y una bandeja unificada de revisión exclusiva para Administradores. La aprobación establece las cuentas, identidades, academias, relaciones y pasaportes básicos que correspondan sin duplicados, sin ampliar privilegios y sin introducir enriquecimiento deportivo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro personal de adulto (Priority: P1)

Como persona adulta, puedo preparar y presentar una solicitud para obtener mi cuenta Usuario y mi pasaporte básico, aportando identidad, consentimiento y evidencias sin depender de una credencial temporal emitida por un Administrador.

**Why this priority**: Es la entrada personal principal y reemplaza el onboarding ordinario mediante credenciales temporales.

**Independent Test**: Una persona adulta completa el flujo, recibe aprobación administrativa y entra directamente a Resumen con una cuenta USER, responsabilidad SELF y un único pasaporte básico activo pendiente de enriquecimiento.

**Acceptance Scenarios**:

1. **Given** una persona no registrada con fecha de nacimiento validada de 18 años o más, **When** presenta datos, evidencias, autorización de privacidad, declaración de veracidad y actuación propia completas, **Then** la solicitud queda Presentada sin habilitar acceso ordinario.
2. **Given** una solicitud personal adulta completa y sin conflicto de duplicado, **When** un Administrador la aprueba y confirma el expediente manual, **Then** se habilita USER, se establece SELF y existe exactamente un pasaporte básico activo pendiente de enriquecimiento.
3. **Given** un adulto aprobado con un solo pasaporte accesible, **When** inicia sesión, **Then** entra directamente a Resumen y no puede sobrescribir información deportiva reservada al Analista.

---

### User Story 2 - Registro de representante para un menor (Priority: P1)

Como representante legal adulto, puedo solicitar acceso para representar a un menor sin crearle cuenta ni credenciales.

**Why this priority**: Protege a los menores y establece autoridad explícita antes de conceder acceso a su pasaporte.

**Independent Test**: Un representante adulto aporta sus datos y los del menor, obtiene aprobación y accede al Resumen del menor mediante una relación LEGAL_REPRESENTATIVE.

**Acceptance Scenarios**:

1. **Given** un solicitante adulto y un menor identificado, **When** aporta teléfono obligatorio, vínculo, declaración de representación, autorización de tratamiento del menor y evidencias requeridas, **Then** puede presentar la solicitud sin crear cuenta, correo, contraseña ni teléfono para el menor.
2. **Given** la solicitud aprobable, **When** el Administrador la aprueba con expediente confirmado, **Then** se habilita el USER representante, se crea o vincula al menor sin duplicarlo, se establece la responsabilidad legal y se crea exactamente un pasaporte básico activo.
3. **Given** datos compartidos de nombre o contacto sin declaración ni evidencia de autoridad, **When** se intenta presentar o aprobar, **Then** se rechaza la operación sin inferir representación.

---

### User Story 3 - Representar varios menores aprobados (Priority: P1)

Como Usuario representante, puedo conservar relaciones separadas con varios menores aprobados y elegir de forma explícita a cuál acceder.

**Why this priority**: Una responsabilidad familiar no debe convertirse en un rol global ni mezclar pasaportes.

**Independent Test**: El mismo USER obtiene dos solicitudes de menor aprobadas y ve un selector limitado a esos jugadores.

**Acceptance Scenarios**:

1. **Given** un USER que ya representa a un menor, **When** una solicitud posterior para otro menor es aprobada, **Then** se conserva una relación independiente por jugador sin duplicar la cuenta.
2. **Given** un USER con varios jugadores accesibles, **When** entra al producto, **Then** ve un selector con solo sus pasaportes autorizados y ninguno se elige por inferencia.

---

### User Story 4 - Crear academia formalizada (Priority: P1)

Como responsable de una organización formalizada, puedo solicitar la creación de una academia y su primer contexto autorizado.

**Why this priority**: La academia debe existir y ser aprobada antes de poder incorporar cuentas o jugadores.

**Independent Test**: Se presenta una academia con NIT, RUT, certificado y autoridad del responsable; la aprobación crea una sola academia, cuenta responsable, rol y membresía activos.

**Acceptance Scenarios**:

1. **Given** una academia aún no aprobada, **When** su responsable adulto presenta la información institucional, evidencias y autoridad completas, **Then** la solicitud queda pendiente sin crear academia operable ni privilegios ACADEMY_USER.
2. **Given** una solicitud completa y sin conflicto, **When** un Administrador la aprueba, **Then** se crea o activa una academia, se habilita la cuenta responsable, se asigna ACADEMY_USER y se establece una membresía activa en la misma decisión.
3. **Given** coincidencias de nombre, NIT o responsable, **When** se evalúa la solicitud, **Then** el resultado no revela información protegida de otra academia.

---

### User Story 5 - Crear academia de persona natural (Priority: P1)

Como persona natural que opera una academia, puedo solicitar su aprobación con evidencia operativa adecuada aunque no tenga la forma documental de una organización formalizada.

**Why this priority**: Incluye academias legítimas que operan bajo una persona natural sin rebajar el control administrativo.

**Independent Test**: Una solicitud con declaración de operación y al menos una categoría admitida de evidencia obtiene corrección, rechazo o aprobación trazable.

**Acceptance Scenarios**:

1. **Given** una academia operada por persona natural, **When** aporta identidad del responsable, ubicación operativa, declaración y al menos una evidencia del catálogo aprobado, **Then** puede presentarse para revisión.
2. **Given** evidencia insuficiente o inconsistente, **When** el Administrador revisa, **Then** solicita corrección o rechaza con razón segura sin afirmar certificación legal.
3. **Given** evidencia suficiente y expediente confirmado, **When** se aprueba, **Then** se obtiene el mismo contexto inicial de academia y responsable que una academia formalizada aprobada.

---

### User Story 6 - Solicitar una cuenta adicional de academia (Priority: P1)

Como autoridad de una academia aprobada, puedo solicitar una cuenta adicional limitada a esa academia.

**Why this priority**: Permite colaboración organizacional sin autoasociación ni escalamiento de privilegios.

**Independent Test**: Una solicitud originada en el contexto responsable crea una membresía ACADEMY_USER solo tras aprobación administrativa.

**Acceptance Scenarios**:

1. **Given** una academia aprobada y una autoridad vigente, **When** solicita una cuenta adicional con identidad, función, autorización y evidencias completas, **Then** la solicitud referencia el contexto autorizado sin aceptar un identificador arbitrario.
2. **Given** la aprobación, **When** finaliza, **Then** se habilita la cuenta, se asigna solo ACADEMY_USER y se crea una membresía activa exclusivamente en la academia aprobada.
3. **Given** una academia pendiente, inactiva o no relacionada, **When** se intenta crear o aprobar la solicitud, **Then** se deniega sin crear cuenta ni membresía.

---

### User Story 7 - Academia registra jugador adulto (Priority: P1)

Como Usuario de Academia autorizado, puedo presentar a un jugador adulto con su autorización para incorporarlo a la cartera deportiva de la academia.

**Why this priority**: Permite crear el pasaporte básico organizacional sin atribuir propiedad personal al empleado ni crear cuentas automáticas.

**Independent Test**: Una academia aprobada presenta un adulto y la aprobación crea o vincula jugador, relación de academia y pasaporte, pero no USER ni SELF.

**Acceptance Scenarios**:

1. **Given** ACADEMY_USER con membresía activa, **When** presenta identidad, evidencia y autorización expresa del adulto en contexto de su academia, **Then** la solicitud queda vinculada a esa academia y no puede ser aprobada por ella misma.
2. **Given** una solicitud aprobada, **When** se materializa, **Then** se crea o vincula el jugador, se establece la relación deportiva de academia y un único pasaporte básico activo, sin cuenta USER ni SELF automáticos.

---

### User Story 8 - Academia registra jugador menor (Priority: P1)

Como Usuario de Academia autorizado, puedo presentar a un menor solo cuando un representante identificado aporta autoridad y autorizaciones explícitas.

**Why this priority**: Separa la gestión deportiva de la autoridad legal sobre el menor.

**Independent Test**: La aprobación crea o vincula al menor, registra relaciones legal y deportiva separadas y no crea cuentas para menor o representante.

**Acceptance Scenarios**:

1. **Given** una academia aprobada, **When** presenta a un menor con identidad, evidencia civil, representante, teléfono, vínculo y autorizaciones completas, **Then** la solicitud puede entrar a revisión sin convertir a la academia en representante.
2. **Given** la aprobación, **When** se materializa, **Then** se crean o vinculan jugador, responsabilidad legal y relación de academia separadas, más exactamente un pasaporte básico activo, sin cuenta del menor ni cuenta automática del representante.
3. **Given** autorización omitida o afirmada solo por la academia, **When** se intenta presentar o aprobar, **Then** se deniega sin estado parcial.

---

### User Story 9 - Corregir y reenviar una solicitud (Priority: P1)

Como solicitante autorizado, puedo corregir exclusivamente una solicitud Devuelta para corrección y reenviarla sin perder su historial.

**Why this priority**: Permite resolver defectos sin mutar silenciosamente una solicitud en revisión ni crear duplicados.

**Independent Test**: El Administrador devuelve con razón segura; el solicitante reemplaza campos o evidencias permitidos y reenvía la misma solicitud versionada.

**Acceptance Scenarios**:

1. **Given** una solicitud Presentada, **When** el Administrador pide corrección con razón segura, **Then** pasa a Requiere corrección y el solicitante ve solo lo necesario para subsanar.
2. **Given** una solicitud que Requiere corrección, **When** el propietario corrige y reenvía, **Then** vuelve a Presentada conservando versiones, evidencias sustituidas y transiciones previas.
3. **Given** una solicitud Presentada, Aprobada o Rechazada, **When** el solicitante intenta editarla, **Then** la modificación se deniega sin cambios parciales.

---

### User Story 10 - Revisar todas las solicitudes en una bandeja (Priority: P1)

Como Administrador autorizado, puedo consultar y filtrar los siete tipos de solicitud en una sola bandeja y abrir el detalle necesario para decidir.

**Why this priority**: Una frontera administrativa única evita flujos de aprobación fragmentados y decisiones fuera de control.

**Independent Test**: La bandeja muestra solicitudes de los siete tipos, filtra por tipo y estado y conserva estados responsive, vacío, carga y error.

**Acceptance Scenarios**:

1. **Given** solicitudes de tipos y estados distintos, **When** el Administrador abre la bandeja, **Then** ve tipo, estado, fecha, identidad segura, contexto de academia, indicadores de corrección/evidencia y acción de revisión.
2. **Given** filtros de tipo o estado, **When** se aplican, **Then** la lista contiene solo solicitudes coincidentes sin aprobación masiva.
3. **Given** un actor distinto de Administrador, **When** intenta entrar a la bandeja o detalle, **Then** recibe denegación segura sin información de solicitudes.

---

### User Story 11 - Aprobar con confirmación de expediente manual (Priority: P1)

Como Administrador, puedo aprobar una solicitud completa solo después de confirmar el traslado de la información pertinente al expediente manual.

**Why this priority**: La confirmación es el control previo obligatorio para crear accesos y retirar documentos digitales.

**Independent Test**: Sin confirmación la aprobación falla; con confirmación, la solicitud y todos sus resultados se materializan una sola vez y comienza la eliminación documental.

**Acceptance Scenarios**:

1. **Given** una solicitud completa, **When** el Administrador intenta aprobar sin confirmar el expediente, **Then** la aprobación no ocurre.
2. **Given** evidencia completa, validaciones vigentes, ausencia de conflicto y expediente confirmado, **When** aprueba, **Then** el resultado específico del tipo se crea atómicamente y la evidencia deja de estar disponible para consulta ordinaria.
3. **Given** dos decisiones concurrentes, **When** compiten sobre la misma versión, **Then** exactamente una puede prevalecer y nunca se aprueba y rechaza la misma solicitud.

---

### User Story 12 - Rechazar y eliminar documentos (Priority: P1)

Como Administrador, puedo rechazar definitivamente con una razón segura y asegurar que los archivos aportados sean eliminados sin conservar su contenido en la traza.

**Why this priority**: Un rechazo no debe habilitar acceso ni prolongar innecesariamente la exposición documental.

**Independent Test**: El rechazo queda trazado, el solicitante ve una razón segura y la evidencia pasa por Eliminación pendiente a Eliminación completada sin poder recuperarse.

**Acceptance Scenarios**:

1. **Given** una solicitud Presentada, **When** el Administrador la rechaza con razón segura, **Then** queda Rechazada de forma final, no habilita cuenta ni contexto y se inicia la eliminación de archivos.
2. **Given** eliminación completada, **When** cualquier actor intenta recuperar un archivo, **Then** no puede obtenerlo y la traza conserva solo categoría y momento de eliminación.

---

### User Story 13 - Acceso restringido del solicitante pendiente (Priority: P1)

Como solicitante pendiente, puedo autenticarme únicamente para consultar mi solicitud y corregirla cuando corresponda, sin recibir privilegios de producto.

**Why this priority**: Las credenciales elegidas por el solicitante no deben equivaler a una cuenta aprobada.

**Independent Test**: Un solicitante Draft, Presentado o en corrección accede solo a su frontera y es rechazado en pasaportes, academias, análisis y administración.

**Acceptance Scenarios**:

1. **Given** credenciales válidas de una solicitud pendiente, **When** el solicitante entra, **Then** solo ve estado, evidencia segura y acciones de su propia solicitud.
2. **Given** el mismo solicitante, **When** intenta una operación ordinaria de USER, ACADEMY_USER, Analista o Administrador, **Then** se deniega por defecto.
3. **Given** rechazo final, **When** intenta acceso ordinario, **Then** no se habilita la cuenta ni se confirma información ajena.

---

### User Story 14 - Prevenir duplicados sin revelar candidatos (Priority: P1)

Como solicitante o revisor, recibo un resultado seguro ante posibles duplicados sin exponer identidades, academias o documentos existentes.

**Why this priority**: La unicidad no puede convertirse en un mecanismo de enumeración de personas u organizaciones.

**Independent Test**: Coincidencias exactas bloquean creación; similitudes generan revisión privada; ninguna respuesta al solicitante revela al candidato.

**Acceptance Scenarios**:

1. **Given** documento normalizado coincidente con una identidad o jugador existente, **When** se presenta o aprueba la solicitud, **Then** se evita atómicamente el duplicado con resultado genérico.
2. **Given** solo similitud de nombre y fecha, **When** se evalúa, **Then** se registra una señal privada que el Administrador puede resolver sin revelar candidato al solicitante.
3. **Given** conflicto confirmado sin resolver, **When** se intenta aprobar, **Then** la aprobación se deniega y no se crean recursos parciales.

---

### User Story 15 - Conservar cuentas y pasaportes existentes (Priority: P1)

Como actor ya aprobado, conservo mis cuentas, sesiones, membresías, responsabilidades y pasaportes mientras el nuevo registro reemplaza solo las entradas ordinarias futuras.

**Why this priority**: La nueva frontera no puede borrar historia ni ampliar autoridad durante la transición.

**Independent Test**: Registros de Features 003–005 siguen legibles y autorizados; el onboarding nuevo usa solicitudes y la operación interna controlada permanece no pública.

**Acceptance Scenarios**:

1. **Given** una cuenta o pasaporte aprobado existente, **When** Feature 006 entra en vigor, **Then** conserva acceso e historial sin reasignación, eliminación ni privilegios adicionales.
2. **Given** un nuevo cliente, **When** busca iniciar acceso, **Then** encuentra Crear solicitud de registro y no el flujo ordinario Activar acceso inicial.
3. **Given** una operación controlada de provisión o recuperación de personal interno, **When** la usa personal autorizado, **Then** permanece separada y no pública.

### Lifecycle and Transition Rules

| Estado actual | Acción | Estado resultante | Actor autorizado |
|---|---|---|---|
| Sin solicitud | Crear | Borrador | Solicitante público para tipos iniciales, o actor de academia autorizado para tipos organizacionales |
| Borrador | Guardar datos/evidencia | Borrador | Propietario autorizado |
| Borrador | Presentar completa | Presentada | Propietario autorizado |
| Presentada | Solicitar corrección con razón segura | Requiere corrección | Administrador autorizado |
| Requiere corrección | Corregir o reemplazar evidencia | Requiere corrección | Propietario autorizado |
| Requiere corrección | Reenviar completa | Presentada | Propietario autorizado |
| Presentada | Aprobar con expediente confirmado | Aprobada | Administrador autorizado |
| Presentada | Rechazar con razón segura | Rechazada | Administrador autorizado |

- Aprobada y Rechazada son finales para esa solicitud. Cualquier nueva solicitud posterior a un rechazo exige elegibilidad vigente y no reutiliza ni reabre el registro final.
- Toda transición usa la versión vigente y conserva actor, momento, acción, estado previo, resultado y categoría segura.
- Una solicitud Presentada es inmutable para el solicitante. Solo Requiere corrección vuelve a habilitar cambios.
- Una decisión es completa o no produce ninguno de sus efectos. Decisiones o envíos concurrentes no duplican cuentas, identidades, jugadores, academias, membresías, responsabilidades ni pasaportes.

### Information and Evidence Classification

- **Común cuando aplique**: nombres y apellidos legales, tipo y número de documento, fecha de nacimiento, país, ciudad, correo, contraseña y confirmación, teléfono según regla, tipo de solicitud, autorización de privacidad, veracidad, versión y momento de consentimiento.
- **Teléfono**: obligatorio para representante de menor y responsable de academia; opcional para adulto propio y cuenta adicional, salvo que esta pase a ser responsable; nunca se pide al menor.
- **Privado**: credenciales, documentos, imágenes, fechas de nacimiento, datos de representación, contactos y consentimientos. No forman parte del pasaporte deportivo ni de historias ordinarias.
- **Derivado**: mayoría de edad según Colombia, 18 años y fecha vigente al presentar y aprobar; categoría de edad visible derivada de fecha validada. Una selección del cliente solo guía el formulario.
- **Evidencia personal**: frente del documento y reverso cuando corresponda; para menores, registro civil, tarjeta de identidad, pasaporte u otra identidad aprobada; custodia, tutela o representación cuando sea requerida.
- **Academia formalizada**: RUT y certificado de existencia o equivalente, más identidad y autoridad del responsable.
- **Academia de persona natural**: al menos una de RUT, certificación municipal/deportiva, autorización de uso del lugar, contrato/registro operativo equivalente u otra categoría controlada aceptada por New Talents.
- **Cuenta adicional**: identidad del solicitante y autorización del responsable de la academia.
- **Jugador de academia**: identidad del jugador y autorización del adulto; para menor, identidad civil, identidad del representante, autoridad y autorizaciones de tratamiento y presentación.
- **Retención digital**: los archivos se conservan solo mientras la solicitud está pendiente o en corrección. Aprobación con expediente confirmado y rechazo final retiran su acceso e inician eliminación; la traza no conserva contenido eliminado.

### Presentation States

- Elección inicial, Borrador, error de validación, carga documental incompleta, Presentada, Pendiente de revisión, Requiere corrección, Reenviando, Aprobada y Rechazada.
- Resultado no disponible seguro por duplicado, fallo de carga, fallo de conectividad, servicio no disponible, carga, bandeja administrativa vacía, revisión administrativa, confirmación de expediente requerida, eliminación pendiente, eliminación completada y no autorizado.
- La experiencia funciona en web y móvil, conserva la dirección visual esmeralda/negro/lima tipo liquid-glass y ofrece navegación por teclado y lector de pantalla, foco visible, errores asociados, tamaños de toque adecuados, diseño estable y comunicación no dependiente solo del color.

### Edge Cases

- El solicitante cumple 18 años entre Borrador, presentación y aprobación; prevalece la evaluación vigente de Colombia y una ruta incompatible no se aprueba.
- Dos pestañas presentan o corrigen la misma versión, o dos Administradores deciden simultáneamente.
- Dos solicitudes intentan crear la misma cuenta, jugador, academia, membresía o pasaporte con datos escritos de manera distinta pero normalizables.
- La membresía de academia se vuelve inactiva entre la presentación y la decisión.
- Una academia intenta aprobar su solicitud, presentar desde otra academia o adjuntar una cuenta mediante identificador arbitrario.
- Un representante o academia intenta confirmar autoridad por un tercero, contacto compartido o coincidencia de apellidos.
- Falta el reverso cuando aplica, una categoría documental está vacía o un archivo falla durante presentación.
- Se reemplaza evidencia durante corrección mientras un revisor conserva una vista anterior.
- La confirmación del expediente falla o la eliminación queda pendiente después de retirar acceso ordinario al archivo.
- Una respuesta, ruta, historial, exportación o diagnóstico intenta incluir contraseñas, documentos, huellas, candidatos, consentimiento o hechos privados.
- Un Analista intenta abrir evidencia de registro o aprobar una solicitud.
- Un Administrador intenta aprobar evidencia incompleta, conflicto confirmado, minoría/representación incompatible o academia no vigente.
- Un pasaporte básico intenta mostrar estadísticas, partidos, FEM, métricas, videos o valores cero inventados.
- Un menor, representante no autenticado o solicitante pendiente intenta entrar a un contexto ordinario no aprobado.
- Registros TUTOR históricos o pasaportes Feature 005 son interpretados como autoridad nueva sin reconciliación explícita.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE admitir exactamente siete tipos de solicitud: adulto propio, representante de menor, academia formalizada, academia de persona natural, cuenta adicional de academia, jugador adulto presentado por academia y jugador menor presentado por academia.
- **FR-002**: Toda solicitud DEBE seguir Borrador, Presentada, Requiere corrección, Aprobada o Rechazada y solo las transiciones autorizadas en esta especificación.
- **FR-003**: El propietario autorizado DEBE poder editar un Borrador y una solicitud que Requiere corrección; una solicitud Presentada, Aprobada o Rechazada NO DEBE ser editable por el solicitante.
- **FR-004**: Cada transición DEBE ser versionada, inmutable y trazable con actor, momento, acción, estado previo, resultado y categoría segura, sin datos sensibles innecesarios.
- **FR-005**: El sistema DEBE impedir que decisiones o envíos concurrentes creen resultados duplicados o que una misma solicitud quede aprobada y rechazada.
- **FR-006**: Un solicitante nuevo DEBE definir correo y contraseña mediante la frontera segura existente; contraseña, confirmación y material secreto NO DEBEN almacenarse, devolverse, trazarse ni registrarse en texto plano.
- **FR-007**: Las credenciales de un solicitante pendiente DEBEN permitir solo su estado y corrección autorizada; NO DEBEN otorgar privilegios ordinarios antes de aprobación.
- **FR-008**: La aprobación DEBE habilitar solo la cuenta, rol, membresía, relación y contexto expresamente definidos para el tipo; el rechazo NO DEBE habilitar acceso ordinario.
- **FR-009**: El sistema DEBE capturar solo campos y consentimientos aplicables al tipo, aplicar las reglas de teléfono y nunca exigir correo, contraseña o teléfono al menor.
- **FR-010**: La mayoría de edad DEBE derivarse de fecha validada, fecha vigente en Colombia y umbral de 18 años al presentar y aprobar; un valor `isAdult` del cliente NO DEBE ser autoridad.
- **FR-011**: Una ruta adulta NO DEBE aprobarse para un menor y una ruta de menor NO DEBE aprobarse sin representante adulto, identidad, vínculo, declaración y autorización explícitas.
- **FR-012**: La presentación DEBE bloquearse hasta que cada campo, consentimiento y categoría de evidencia obligatoria esté completa y vigente.
- **FR-013**: El solicitante DEBE ver solo categoría, estado de carga y estado de corrección de evidencia; después de presentar NO DEBE recuperar originales sin restricción.
- **FR-014**: Solo un Administrador explícitamente autorizado DEBE poder inspeccionar documentos y evidencias; cada acceso DEBE quedar auditado.
- **FR-015**: Analistas NO DEBEN acceder a documentos de identidad, credenciales, evidencia de representación ni contactos privados innecesarios; usuarios de academia NO DEBEN ver documentos del representante más allá del estado seguro de autorización.
- **FR-016**: El reemplazo documental DEBE permitirse solo en Requiere corrección; la versión reemplazada DEBE dejar de estar disponible para revisión ordinaria y seguir la política de eliminación.
- **FR-017**: Aprobar DEBE exigir confirmación explícita del expediente manual; sin confirmación no DEBE producirse aprobación ni efectos derivados.
- **FR-018**: Tras aprobar con expediente confirmado o rechazar definitivamente, los archivos DEBEN dejar de estar disponibles y eliminarse; solo DEBEN conservarse datos estructurados mínimos, huellas de duplicado, consentimiento, categorías revisadas, decisión, revisor, tiempos, confirmación y traza segura.
- **FR-019**: La eliminación DEBE exponer estados Pendiente y Completada, quedar trazada sin contenido y hacer imposible recuperar archivos tras completarse.
- **FR-020**: La aprobación adulta propia DEBE habilitar USER, crear o vincular identidad y jugador sin duplicación, establecer SELF activo y crear exactamente un pasaporte básico activo pendiente de enriquecimiento.
- **FR-021**: La aprobación de representante DEBE habilitar su USER, crear o vincular identidades y menor sin duplicación, establecer LEGAL_REPRESENTATIVE activo y crear exactamente un pasaporte básico activo; el menor NO DEBE recibir cuenta.
- **FR-022**: Un USER DEBE poder representar varios menores mediante relaciones separadas; uno accesible abre Resumen y varios exigen selector autorizado.
- **FR-023**: Cumplir 18 años NO DEBE transferir autoridad, crear cuenta o SELF ni borrar responsabilidad histórica automáticamente.
- **FR-024**: Una solicitud de academia formalizada DEBE requerir identidad institucional, NIT, RUT, certificado equivalente, identidad del responsable, evidencia de autoridad, consentimiento y veracidad.
- **FR-025**: Una solicitud de academia de persona natural DEBE requerir declaración de operación, responsable completo y al menos una categoría controlada de evidencia operativa; la aprobación NO DEBE presentarse como certificación legal.
- **FR-026**: Antes de aprobar una academia NO DEBEN existir academia operable, privilegios ACADEMY_USER ni capacidad para solicitar cuentas o jugadores.
- **FR-027**: La aprobación de cualquier academia DEBE crear o activar exactamente una academia, habilitar al responsable, asignar ACADEMY_USER, crear membresía activa y designar responsable como una sola decisión completa.
- **FR-028**: Una cuenta adicional DEBE originarse en autoridad vigente de una academia aprobada y NO DEBE permitir autoasociación mediante un identificador arbitrario.
- **FR-029**: Aprobar una cuenta adicional DEBE habilitarla, asignar solo ACADEMY_USER y crear membresía activa en la academia aprobada, sin USER, Analista o Administrador implícitos.
- **FR-030**: Una solicitud de jugador por academia DEBE exigir ACADEMY_USER, membresía activa y contexto explícito de academia; la academia NO DEBE revisar ni aprobar su propia solicitud.
- **FR-031**: Aprobar un jugador adulto de academia DEBE crear o vincular jugador, relación deportiva de academia y exactamente un pasaporte básico activo pendiente de enriquecimiento, sin USER ni SELF automáticos.
- **FR-032**: Aprobar un jugador menor de academia DEBE crear o vincular menor, responsabilidad legal y relación deportiva separadas y exactamente un pasaporte básico activo, sin cuenta del menor ni del representante; la academia NO DEBE adquirir representación legal.
- **FR-033**: Todo pasaporte básico aprobado DEBE ser privado, accesible solo a actores autorizados y marcado como pendiente de enriquecimiento por Analista.
- **FR-034**: El pasaporte básico PUEDE mostrar identidad visible aprobada, país, ciudad no precisa, categoría derivada, academia aplicable, estado, marcador neutral y enriquecimiento pendiente; NO DEBE mostrar documentos ni datos privados.
- **FR-035**: Estadísticas, partidos, FEM, métricas, videos, multimedia y perfil público DEBEN permanecer no disponibles y ninguna ausencia DEBE mostrarse como cero o dato inventado.
- **FR-036**: USER, representante y ACADEMY_USER NO DEBEN sobrescribir información deportiva reservada al Analista; esta característica NO DEBE implementar la interfaz completa de enriquecimiento.
- **FR-037**: Los siete tipos DEBEN aparecer en una bandeja autenticada única accesible solo por Administrador, con tipo, estado, fecha, identidad segura, academia aplicable, indicadores de corrección/evidencia y apertura de revisión.
- **FR-038**: La bandeja DEBE filtrar por tipo y estado y cubrir carga, vacío, no disponible y error con desplazamiento estable en web y móvil; NO DEBE ofrecer aprobación masiva.
- **FR-039**: El detalle administrativo DEBE presentar solo datos necesarios, categorías y visor protegido, riesgo seguro, consentimiento, historial, confirmación de expediente, razones seguras y acciones proyectadas por autorización vigente.
- **FR-040**: El Administrador NO DEBE aprobar evidencia incompleta, conflicto confirmado sin resolver, academia inactiva/no relacionada ni una solicitud que incumpla edad o representación.
- **FR-041**: Solo el Administrador DEBE poder solicitar corrección, aprobar o rechazar; Analista, academia, solicitante y menor carecen de autoridad de decisión.
- **FR-042**: La entrada pública ordinaria DEBE ofrecer Crear solicitud de registro en lugar de Activar acceso inicial; provisión y recuperación controladas para personal interno DEBEN permanecer no públicas.
- **FR-043**: El frontend DEBE preguntar primero la categoría, mostrar solo campos/evidencias relevantes, separar Personal/Academia y adulto/menor, guardar Borrador, confirmar envío y permitir corrección solo cuando se solicite.
- **FR-044**: Secretos y referencias locales a documentos DEBEN limpiarse tras presentación o cierre de sesión y NO DEBEN aparecer en rutas, historiales ordinarios, exportaciones, registros o diagnósticos.
- **FR-045**: La experiencia DEBE ser responsive y accesible en móvil y web, conservar la dirección visual aprobada y comunicar cada estado sin depender solo del color.
- **FR-046**: La autorización DEBE denegar por defecto si falta identidad, propiedad de solicitud, responsabilidad, membresía, contexto o capacidad; el cliente NO DEBE inferir permiso desde roles declarados en credenciales.
- **FR-047**: Identidades y documentos DEBEN normalizarse antes de comparar; coincidencias exactas DEBEN bloquear duplicación atómicamente y similitudes de nombre/fecha solo PUEDEN crear una señal privada.
- **FR-048**: Respuestas de duplicado DEBEN ser genéricas y no enumerables; solicitantes nunca DEBEN recibir candidato, documento, academia, representante, huella o motivo interno.
- **FR-049**: Envío, corrección, credencial/identidad, duplicados, decisiones, academia/membresía, responsabilidades, jugador/pasaporte, relación deportiva, confirmación de expediente y eliminación DEBEN ser atómicos en sus límites materiales y revertir sin estado parcial.
- **FR-050**: Los fallos NO DEBEN dejar cuentas habilitadas para rechazos, duplicados, academias sin responsable, membresías para academias no aprobadas, responsabilidades sin solicitud aprobada, archivos accesibles tras eliminación completada ni autorizaciones parcialmente consumidas.
- **FR-051**: Cuentas, sesiones, pasaportes, responsabilidades, membresías, historias y compatibilidad TUTOR existentes DEBEN permanecer legibles sin eliminación, reasignación o ampliación silenciosa de autoridad.
- **FR-052**: La nueva entrada DEBE sustituir el onboarding ordinario por credencial temporal de Feature 003, la activación pública de Feature 004 y la autoría/presentación directa del pasaporte deportivo de Feature 005, preservando operaciones internas controladas y las protecciones de huellas, identidad privada cifrada y auditoría.
- **FR-053**: Esta característica NO DEBE incluir enriquecimiento completo de Analista, transferencias de academia, partidos, FEM, estadísticas, videos, pagos, suscripciones, descubrimiento público, reclutadores, publicación, cuentas de menores, aprobación automática o propia de academia, decisiones masivas, OAuth, login social, MFA, correo/SMS, biometría, aprobación por OCR ni almacenamiento permanente de imágenes documentales.

### Key Entities

- **Solicitud de registro**: Petición versionada de uno de los siete tipos, con propietario, contexto, estado, capacidades y resultado final.
- **Solicitante pendiente**: Persona que definió credenciales pero solo puede acceder a su solicitud hasta aprobación.
- **Evidencia documental**: Archivo temporal clasificado por categoría, con estado de carga, revisión, reemplazo y eliminación; no forma parte del pasaporte.
- **Consentimiento y autorización**: Evidencia de versión, momento, actor y alcance para privacidad, veracidad, representación y tratamiento de datos de menor o presentación por academia.
- **Decisión administrativa**: Corrección, aprobación o rechazo inmutable realizado por Administrador sobre una versión concreta.
- **Confirmación de expediente manual**: Hecho obligatorio que acredita el traslado operativo pertinente antes de aprobar, sin almacenar el expediente externo en la aplicación.
- **Academia solicitada**: Organización formalizada o actividad de persona natural que no obtiene existencia operable ni privilegios hasta aprobación.
- **Responsable de academia**: Persona adulta cuya autoridad aprobada origina la primera cuenta y membresía de la academia.
- **Pasaporte básico activo**: Pasaporte privado disponible a actores autorizados, pendiente de enriquecimiento y sin evaluación deportiva completada.
- **Relación deportiva de academia**: Asociación organizacional del jugador con la academia aprobada, distinta de SELF y LEGAL_REPRESENTATIVE.
- **Señal privada de duplicado**: Resultado interno por similitud no concluyente que nunca expone candidatos y bloquea aprobación cuando existe conflicto confirmado no resuelto.
- **Traza segura**: Historial inmutable de estados, decisiones, accesos y eliminación con identificadores opacos y sin secretos ni documentos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los siete tipos puede crearse como Borrador, presentarse completo y aparecer en la bandeja unificada con tipo y estado correctos.
- **SC-002**: En el 100% de las transiciones documentadas, solo el actor autorizado cambia el estado, se conserva una versión trazable y una solicitud nunca queda simultáneamente Aprobada y Rechazada.
- **SC-003**: En el 100% de las solicitudes pendientes, el solicitante accede solo a su estado y corrección; obtiene cero privilegios ordinarios antes de aprobarse.
- **SC-004**: El 100% de las contraseñas se mantiene fuera de respuestas, trazas, rutas, diagnósticos y expediente manual en texto plano.
- **SC-005**: El 100% de las reglas documentadas de teléfono y adulto/menor se aplica al presentar y aprobar; ningún menor recibe cuenta, correo, contraseña o teléfono propio.
- **SC-006**: En el 100% de aprobaciones personales, se crea o vincula sin duplicar la identidad/jugador, existe una sola responsabilidad aplicable y exactamente un pasaporte básico activo.
- **SC-007**: En el 100% de academias aprobadas, academia, responsable, ACADEMY_USER y membresía activa quedan completos juntos; ninguna academia pendiente habilita solicitudes derivadas.
- **SC-008**: El 100% de cuentas adicionales aprobadas pertenece solo a la academia autorizada y recibe cero privilegios USER, Analista o Administrador implícitos.
- **SC-009**: En el 100% de jugadores presentados por academia, se crea la relación deportiva sin cuenta personal ni SELF automáticos; para menores también existe autoridad legal separada y ninguna cuenta del menor.
- **SC-010**: El 100% de aprobaciones exige expediente manual confirmado; aprobar o rechazar retira acceso ordinario a archivos y toda eliminación completada deja cero documentos recuperables.
- **SC-011**: La revisión de privacidad encuentra cero documentos, imágenes, huellas, contraseñas, candidatos, consentimientos completos o hechos privados en presentación, historias ordinarias, exportaciones, rutas y diagnósticos.
- **SC-012**: En el 100% de coincidencias exactas no se crea un duplicado; en el 100% de similitudes no concluyentes el solicitante recibe cero datos del candidato.
- **SC-013**: El 100% de decisiones concurrentes y reintentos documentados produce como máximo un conjunto aprobado de cuenta, identidad, academia, membresía, jugador, responsabilidad y pasaporte.
- **SC-014**: El 100% de pasaportes básicos indica enriquecimiento pendiente y muestra cero estadísticas, partidos, FEM, métricas o videos inventados.
- **SC-015**: Los siete tipos son revisables en una sola bandeja; filtros por tipo y estado devuelven solo coincidencias y existe cero acción de aprobación masiva.
- **SC-016**: En el 100% de intentos de Analista, academia, solicitante o menor de decidir solicitudes o ver evidencia no autorizada, se deniega sin revelar existencia o contenido protegido.
- **SC-017**: El 100% de recorridos documentados en web y móvil cubre elección, borrador, carga, presentación, corrección, decisión, eliminación, vacío y fallos con operación por teclado/lector y sin depender solo del color.
- **SC-018**: El 100% de registros previos de Features 003–005 conserva acceso e historial aplicables sin eliminación, reasignación o autoridad ampliada.
- **SC-019**: La revisión de entrada encuentra Crear solicitud de registro para clientes y cero exposición pública de provisión temporal interna.
- **SC-020**: La revisión de alcance encuentra cero enriquecimiento completo, transferencias, partidos, FEM, estadísticas, multimedia, pagos, publicación, cuentas de menores, autoaprobación, aprobación masiva, OAuth/MFA, mensajería, biometría, OCR decisorio o almacenamiento documental permanente.

## Scope Boundaries

Esta característica incluye los siete tipos de solicitud, credenciales elegidas por solicitantes, acceso pendiente restringido, carga temporal de evidencia, consentimientos, ciclo de corrección, revisión administrativa unificada, expediente manual confirmado, aprobación/rechazo, eliminación documental, resultados atómicos, pasaporte básico activo y compatibilidad con registros existentes.

Sustituye para nuevos clientes la credencial temporal como onboarding normal de Feature 003 y la acción pública Activar acceso inicial de Feature 004. También sustituye la creación y autoría directa del pasaporte deportivo por USER o ACADEMY_USER de Feature 005: la aprobación crea un pasaporte básico pendiente de enriquecimiento y los campos deportivos autoritativos quedan reservados a una característica posterior de Analista. No modifica ni elimina registros previos.

Quedan excluidos enriquecimiento de Analista, ciclo histórico o traslado de academia, partidos, FEM, estadísticas, videos, pagos, suscripciones, descubrimiento o publicación, reclutadores, cuentas de menores, aprobación automática/propia/masiva, OAuth, login social, MFA, entrega por correo/SMS, biometría, aprobación OCR, datos deportivos inventados y almacenamiento permanente de imágenes documentales.

## Assumptions

- Colombia y la mayoría a los 18 años continúan como política del MVP, incluida la regla vigente de aniversario para fechas validadas.
- La frontera de credenciales y sesiones de Feature 003 se reutiliza; esta especificación cambia quién inicia el onboarding ordinario, no los principios de protección de secretos o sesiones.
- Feature 002 sigue gobernando identidad, roles, membresías, capacidad administrativa y denegación por defecto, con USER y responsabilidades explícitas conforme a Feature 005.
- Feature 004 sigue gobernando restauración, login, cierre de sesión, accesibilidad y responsive; solo se reemplaza la entrada pública de activación ordinaria.
- Feature 005 sigue gobernando unicidad del jugador/pasaporte, huellas documentales, identidad privada protegida, responsabilidades, selector/cartera y presentación, salvo las conductas expresamente sustituidas aquí.
- El expediente manual y su operación están fuera de la aplicación; esta entrega registra únicamente la confirmación necesaria para decidir.
- El catálogo controlado determina cuándo aplica reverso, evidencia de custodia y evidencia operativa adicional; una categoría no aplicable no se trata como faltante.
- Una corrección segura posterior a la aprobación no permite sobrescritura directa de información deportiva; el flujo detallado de enriquecimiento o rectificación deportiva pertenece a una característica posterior.
- El plan futuro deberá definir una estrategia explícita de compatibilidad y migración sin debilitar huellas, protección de identidad privada ni auditoría.
