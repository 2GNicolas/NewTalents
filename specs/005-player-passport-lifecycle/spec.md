# Feature Specification: Pasaporte del jugador — ciclo de vida y experiencia vertical

**Feature Branch**: `feature/005-player-passport-lifecycle`

**Created**: 2026-09-15

**Last Updated**: 2026-09-17

**Status**: Draft

**Input**: Entregar como una única característica vertical y acotada el ciclo inicial, controlado y trazable del pasaporte digital único de un jugador, junto con la experiencia autenticada de pasaporte en web y móvil para los roles autorizados. La entrega incluye el ciclo de vida aprobado, las interfaces autenticadas por rol, la presentación responsive del pasaporte, la identidad persistente del jugador, la navegación aprobada y la trazabilidad de la dirección visual aprobada.

## Clarifications

### Session 2026-09-17

- Q: ¿Qué jurisdicción y edad de mayoría de edad deben regir el pasaporte en este MVP? → A: Colombia por ahora para todo el MVP; mayoría de edad a los 18 años.

La dirección de producto adjunta a esta sesión corrige la suposición de Tutor obligatorio: cuenta genérica Usuario (`USER`) y relaciones de titular adulto, representante legal y academia. La respuesta anterior cierra la única decisión de producto pendiente. Esta es una política de producto aprobada, no una afirmación de cumplimiento legal formal.

## Dirección visual y autoridad de diseño

- Los referentes visuales aprobados del pasaporte de jugador gobiernan la jerarquía de información, la composición, la identidad persistente del jugador, el comportamiento responsive en móvil y web, la dirección visual liquid-glass, la estructura de navegación y la organización de etiquetas y métricas mostradas.
- Los referentes aprobados incluyen las vistas móvil y web de **Resumen**, **Estadísticas**, **Partidos** y **Videos** en `docs/design/passport-*.png`.
- La dirección visual aprobada usa fondos verde esmeralda profundo y negro, superficies oscuras translúcidas tipo liquid-glass, difusión sutil de fondo, bordes verdes luminosos finos, acentos lima, texto blanco roto y tipografía elegante no redondeada.
- El logo de New Talents permanece separado de la fotografía del jugador.
- El área de fotografía del jugador se conserva en móvil y web con un marcador local neutral, como una silueta o iniciales, sin usar el retrato de referencia como contenido de producción.
- En móvil la navegación es una barra de pestañas horizontal debajo del área de identidad del jugador. En escritorio la navegación es vertical y aparece debajo de la información del jugador en la columna izquierda, nunca encima del contenido principal.
- El área de identidad del jugador permanece visible al navegar entre las cuatro secciones.
- `Mateo González` y los valores numéricos de los referentes son datos de diseño representativos, no requisitos de producto ni contenido fijo de producción.

## Reglas de producto confirmadas

- El pasaporte es el objeto central del producto y representa a un jugador, no una cuenta. Un jugador adulto puede tener una cuenta Usuario (`USER`) vinculada a su propio pasaporte; un jugador menor no recibe cuenta, credenciales ni acceso autenticado propio.
- Usuario (`USER`) es el rol genérico de cuenta particular, sin facultades internas ni organizacionales. Una misma identidad puede gestionar su propio pasaporte adulto y representar a uno o varios menores mediante relaciones específicas, sin adquirir un rol global por cada responsabilidad.
- Tutor o representante legal describe la relación entre un Usuario y un menor, no un rol global obligatorio. El rol histórico `TUTOR` se retira del modelo objetivo y se conserva temporalmente solo para compatibilidad controlada; no acredita por sí solo representación ni propiedad.
- Las relaciones explícitas son **Titular adulto** (gestión propia, equivalente a `SELF`), **Representante legal** (equivalente a `LEGAL_REPRESENTATIVE`) y **Academia** (gestión organizacional, equivalente a `ACADEMY`). El origen de creación Particular o Academia es un hecho separado de estas relaciones.
- La creación particular establece atómicamente el primer Borrador, su origen y la relación aplicable: titular adulto vinculado a la identidad autenticada, sin relación de Tutor, o representante legal identificado y autorizado para ese menor. Las Features 002 y 003 no proporcionan previamente estas relaciones de pasaporte.
- Un Usuario puede tener como máximo un pasaporte propio adulto; cada jugador conserva un único pasaporte. No puede declararse titular de otro adulto ni obtener acceso a un pasaporte existente por introducir su documento.
- La política del MVP usa Colombia y el umbral de 18 años. La condición de menor se deriva de la fecha de nacimiento validada y la fecha vigente de evaluación del backend en Colombia; no se acepta ni persiste `isAdult` autodeclarado como autoridad.
- Un Usuario de Academia (`ACADEMY_USER`) puede iniciar y gestionar un pasaporte únicamente con membresía activa y en el contexto de su academia, registrando el origen Academia. Este rol permanece separado de `USER`; la membresía no acredita propiedad personal ni representación legal.
- Para un menor de origen Academia, el Usuario de Academia registra los datos y la declaración de autoridad suministrados y confirmados por el Usuario representante legal identificado antes de crear el Borrador. La relación legal y la relación organizacional quedan diferenciadas; la academia no se convierte en representante por administrar información deportiva.
- Los datos del representante son privados y ajenos al perfil futbolístico. La declaración de autoridad y su revisión de consistencia habilitan el ciclo de producto, sin afirmar verificación judicial, custodia certificada ni cumplimiento legal formal.
- Al alcanzar los 18 años se reevalúa la edad, pero no se crea cuenta, relación de titular ni traslado de autoridad automático. Se conserva la responsabilidad histórica; la representación de menor deja de autorizar nuevas mutaciones hasta una regularización explícita fuera de esta entrega.
- Los pagos o suscripciones no establecen propiedad, representación ni acceso. La facturación permanece excluida.
- La identidad de cuenta, sus datos de contacto y los datos privados del jugador permanecen separados. Que un pasaporte sea aprobado o activo no vuelve pública ninguna información.
- El ciclo inicial usa, en lenguaje de producto, los estados **Borrador**, **En revisión**, **Devuelto para corrección**, **Aprobado** y **Activo**.
- Un **Analista de New Talents** autenticado y con la capacidad explícita de revisión de pasaportes puede revisar, devolver para corrección, resolver señales de posible duplicado y aprobar una presentación.
- Un **Administrador de New Talents** autenticado y con la capacidad explícita de activación de pasaportes puede activar manualmente un pasaporte Aprobado.
- La aprobación valida el pasaporte, pero nunca lo activa. La activación es una acción manual, posterior y explícita.
- Una identidad que tenga ambos roles aplicables puede ejecutar ambas responsabilidades, pero cada operación debe autorizarse de forma independiente; otros roles internos o externos se deniegan por defecto.
- Una coincidencia confirmada sobre el tipo y el número de documento de identidad normalizados rechaza de forma atómica la creación de un segundo pasaporte.
- Una similitud basada únicamente en el nombre legal y la fecha de nacimiento no rechaza automáticamente la creación: permite crear el Borrador y registra una señal privada e interna de posible duplicado.
- La señal privada de posible duplicado no se muestra al gestor autorizado; el Borrador puede completarse y presentarse, pero no puede aprobarse mientras la señal esté sin resolver. Un Analista de New Talents con capacidad de revisión debe resolverla durante la revisión sin crear un estado nuevo, fusionar, trasladar, eliminar ni crear un segundo pasaporte.
- La entrega es vertical: backend, web y móvil forman una única característica. El frontend de pasaporte no se traslada a una característica separada por tratarse de trabajo de presentación.
- La experiencia autenticada muestra el pasaporte a los roles autorizados según su relación, membresía o capacidad; no existe consulta pública del pasaporte en esta característica.
- El pasaporte usa una capa de presentación responsive con las secciones **Resumen**, **Estadísticas**, **Partidos** y **Videos**. Las secciones preservan la estructura visual aprobada, pero no inventan datos de backend ni activan lógica de dominio futura.
- La información no disponible se distingue de cero. Ninguna ausencia puede presentarse como valor cero, capacidad inferida, estadística, evaluación ni afirmación deportiva.
- El frontend consume contratos de presentación explícitos del backend y no depende de estructuras internas del FEM ni de datos simulados de producción.
- El pasaporte captura un perfil futbolístico básico declarado —categoría de edad declarada, ciudad, país y pie dominante— además de la posición principal. La categoría no se deriva de la fecha de nacimiento, la ubicación no incluye dirección o coordenadas, y el pie dominante usa los valores controlados Izquierda, Derecha, Ambos o No declarado.
- La fotografía del jugador no se carga, almacena ni gestiona en la Feature 005. La selección, carga, almacenamiento, reemplazo, moderación y eliminación de fotografías se difieren a una característica futura.
- Esta entrega no publica perfiles, no habilita reclutadores, y no incorpora FEM, análisis, estadísticas calculadas, partidos, videos, cobros, traslados, notificaciones ni operaciones fuera del ciclo aprobado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear y preparar un pasaporte inicial (Priority: P1)

Como Usuario adulto para mí mismo, Usuario representante legal de un menor o Usuario de Academia autorizado, puedo crear y completar un borrador dentro de mi contexto legítimo, sin duplicar al jugador ni mezclar identidad privada, representación y contacto de cuenta.

**Why this priority**: Sin un borrador único, verificable y asociado a un responsable legítimo, no existe una base segura para todo el ciclo posterior del pasaporte.

**Independent Test**: Se crean un Borrador propio adulto, uno por representante legal y uno de Academia; se comprueban las relaciones atómicas, la vinculación del titular, la representación confirmada del menor de Academia, la separación de datos y la prevención de duplicados. Se prueban las fechas anterior y exacta al cumpleaños 18 sin usar una casilla de mayoría de edad.

**Acceptance Scenarios**:

1. **Given** un Usuario con identidad activa, sesión válida y autoridad de representante legal de un menor identificado, **When** crea su primer pasaporte con datos válidos, **Then** se establecen atómicamente exactamente un Borrador de origen Particular y la relación de representante legal, sin crear cuenta ni credenciales para el menor.
2. **Given** un Usuario de Academia con identidad activa, sesión válida y membresía activa, **When** crea un Borrador válido, **Then** registra la academia de origen y su relación organizacional; si el jugador es menor, registra además el representante identificado y su confirmación de autoridad, sin sustituirlo por la academia.
3. **Given** un actor sin sesión válida, identidad inactiva, rol aplicable o membresía vigente, **When** intenta crear un borrador, **Then** el intento se rechaza de forma segura y no se crea información parcial ni una relación de responsabilidad.
4. **Given** un tipo y número de documento de identidad normalizados que coinciden de forma confirmada con un jugador que ya posee pasaporte, **When** se intenta crear otro, **Then** la creación se rechaza de forma atómica y no se reemplaza ni se revela información privada del pasaporte existente.
5. **Given** una similitud no concluyente basada solo en nombre legal y fecha de nacimiento, **When** se intenta crear el borrador, **Then** la creación se permite y se registra una señal privada e interna de posible duplicado sin exponer al gestor autorizado el pasaporte candidato, la identidad del jugador, información documental, el representante responsable, la academia ni otra información protegida.
6. **Given** un Borrador con señal privada de posible duplicado sin resolver, **When** el gestor autorizado lo completa y lo presenta, **Then** avanza por el ciclo normal a En revisión y no puede aprobarse mientras la señal permanezca sin resolver.
7. **Given** un Usuario particular o Usuario de Academia autorizado, **When** ingresa el perfil futbolístico básico con categoría de edad declarada, ciudad, país y pie dominante válidos, **Then** se captura separado de la identidad privada y del contacto de cuenta, sin derivar la categoría de la fecha de nacimiento.
8. **Given** un valor de pie dominante no soportado, una categoría malformada o una ubicación con dirección, coordenadas, barrio o detalle preciso, **When** se intenta crear o presentar el borrador, **Then** se rechaza sin enviar el pasaporte a revisión.
9. **Given** un Usuario cuya fecha de nacimiento validada corresponde a 18 años cumplidos o más en la fecha de evaluación, **When** crea su único pasaporte propio, **Then** se vincula atómicamente como titular adulto a esa identidad y no se crea relación de Tutor.
10. **Given** un Usuario con un pasaporte propio y relaciones válidas con varios menores, **When** prepara otro Borrador de menor, **Then** conserva un único pasaporte propio y gestiona cada menor por su relación específica, sin roles globales adicionales.
11. **Given** una fecha de nacimiento futura, imposible o sin validación, un menor presentado como adulto mediante una casilla, o representación sin identidad, vínculo o declaración de autoridad, **When** se intenta crear o presentar, **Then** se deniega sin relación ni pasaporte parcial.
12. **Given** un menor de origen Academia sin confirmación del representante identificado, **When** la academia intenta crearlo o presentarlo, **Then** se rechaza; una declaración del empleado de Academia no sustituye la del representante.
13. **Given** una identidad que ya tiene pasaporte propio o que declara como propio a otro adulto, **When** intenta crear otro pasaporte propio, **Then** se rechaza sin modificar el existente ni otorgar acceso.

---

### User Story 2 - Corregir y presentar el pasaporte (Priority: P1)

Como gestor legítimo por titularidad adulta, representación legal o membresía de la academia de origen, puedo preparar, presentar y corregir el pasaporte según su estado, sin cambiarlo durante la revisión.

**Why this priority**: El ciclo debe permitir calidad de la información sin permitir que una solicitud cambie durante la decisión interna.

**Independent Test**: Un creador edita un Borrador, lo presenta, recibe una devolución con motivo, corrige y lo presenta de nuevo; los intentos de editar mientras está En revisión se niegan sin cambiar datos ni estado.

**Acceptance Scenarios**:

1. **Given** un Borrador asociado al gestor legítimo, **When** el gestor autorizado consulta o modifica información válida, **Then** puede preparar el pasaporte antes de presentarlo.
2. **Given** un Borrador completo y válido, **When** el gestor autorizado lo presenta, **Then** pasa a En revisión y se registra la presentación.
3. **Given** un pasaporte En revisión, **When** su gestor autorizado intenta cambiar la información normal del pasaporte, **Then** la modificación se rechaza y el pasaporte permanece sin cambios.
4. **Given** un pasaporte Devuelto para corrección con un motivo visible para su gestor autorizado, **When** el gestor autorizado corrige la información y lo presenta de nuevo, **Then** vuelve a En revisión conservando la trazabilidad de la devolución y de la nueva presentación.
5. **Given** un Usuario, Usuario de Academia o contexto organizacional no asociado, **When** intenta consultar o cambiar un borrador ajeno, **Then** se deniega el acceso sin exponer datos privados ni razones internas.
6. **Given** un Borrador accesible por una relación válida, **When** el gestor corrige el perfil futbolístico, **Then** la edición respeta el estado editable y no altera el origen, las relaciones ni la traza.
7. **Given** un pasaporte Devuelto para corrección y un titular adulto, representante legal o Usuario de Academia autorizado, **When** corrige y presenta nuevamente, **Then** se aplican las mismas validaciones y se conserva el historial.
8. **Given** una corrección de fecha de nacimiento en un estado editable que cambia la clasificación de menor o adulto, **When** se intenta guardarla, **Then** se reevalúa la edad y se rechaza si la relación vigente deja de corresponder; no se transforma una representación en titularidad automáticamente.

---

### User Story 3 - Revisar, aprobar y activar manualmente (Priority: P1)

Como Analista de New Talents con capacidad explícita de revisión de pasaportes o Administrador de New Talents con capacidad explícita de activación de pasaportes, puedo revisar, resolver posibles duplicados, devolver, aprobar o activar según la capacidad que corresponda, para asegurar control humano sobre el ingreso del jugador.

**Why this priority**: La revisión humana, la aprobación y la activación manual son el límite de confianza que evita que una presentación se convierta automáticamente en un servicio operativo.

**Independent Test**: Con un Analista con capacidad de revisión de pasaportes y un Administrador con capacidad de activación de pasaportes, se prueba cada decisión válida y cada transición no permitida, incluyendo la resolución de señales privadas de posible duplicado, verificando que aprobación y activación permanecen separadas y auditables.

**Acceptance Scenarios**:

1. **Given** un pasaporte En revisión y un Analista de New Talents con capacidad explícita de revisión de pasaportes, **When** lo devuelve, **Then** pasa a Devuelto para corrección con una razón comprensible para el gestor autorizado.
2. **Given** un pasaporte En revisión sin señales privadas de posible duplicado sin resolver y un Analista de New Talents con capacidad explícita de revisión de pasaportes, **When** lo aprueba, **Then** pasa a Aprobado sin quedar Activo ni habilitar funcionalidades futuras.
3. **Given** un pasaporte Aprobado y un Administrador de New Talents con capacidad explícita de activación de pasaportes, **When** activa manualmente el servicio, **Then** pasa a Activo y se registra esa decisión separada.
4. **Given** una identidad interna o externa sin la capacidad requerida, **When** intenta revisar, devolver, aprobar o activar, **Then** la operación se rechaza sin alterar el pasaporte.
5. **Given** una identidad con ambos roles aplicables, **When** ejecuta una responsabilidad de revisión y otra de activación, **Then** cada operación se autoriza de forma independiente según su capacidad específica.
6. **Given** un pasaporte en cualquier estado distinto al requerido por una decisión, **When** un operador intenta esa decisión, **Then** la transición se rechaza de forma segura y no queda una actualización parcial.
7. **Given** un pasaporte En revisión con una señal privada de posible duplicado sin resolver y un Analista de New Talents con capacidad explícita de revisión de pasaportes, **When** determina que los jugadores son diferentes, **Then** se registra la resolución y la revisión normal puede continuar.
8. **Given** un pasaporte En revisión con una señal privada de posible duplicado sin resolver y la información presentada puede corregirse, **When** el Analista lo devuelve, **Then** usa la transición existente a Devuelto para corrección con una razón apta para el gestor autorizado y sin revelar el pasaporte candidato.
9. **Given** un pasaporte En revisión con una señal privada de posible duplicado sin resolver y el Analista confirma que el jugador ya posee pasaporte, **When** resuelve el caso, **Then** el nuevo pasaporte no se aprueba, activa, fusiona, sustituye ni expone.
10. **Given** un pasaporte En revisión con una señal privada de posible duplicado sin resolver, **When** el Analista intenta aprobarlo sin resolverla, **Then** la aprobación se rechaza de forma segura sin cambios parciales.

---

### User Story 4 - Consultar el estado y la trazabilidad (Priority: P2)

Como gestor legítimo u operador interno autorizado, puedo consultar el estado vigente y el historial material del ciclo, para saber qué ocurrió sin acceder a datos que no me corresponden.

**Why this priority**: La consulta de estado reduce incertidumbre para el responsable y mantiene la rendición de cuentas de New Talents.

**Independent Test**: Se recorre un ciclo con presentación, devolución, corrección, aprobación y activación; el gestor autorizado ve su estado y motivo de corrección, el operador autorizado ve la trazabilidad aplicable y terceros reciben una denegación segura.

**Acceptance Scenarios**:

1. **Given** un titular adulto, representante legal vigente o Usuario de Academia con membresía activa en la academia de origen, **When** consulta el estado y el historial autorizado, **Then** recibe el estado vigente, la razón de corrección y eventos aptos para ese contexto, sin señales internas ni datos privados del representante.
2. **Given** un Analista con capacidad de revisión o un Administrador con capacidad de activación, **When** consulta la trazabilidad aplicable, **Then** puede identificar actor, momento, acción, estado previo, estado resultante y resultado de cada transición material.
3. **Given** una persona no autenticada o no asociada, **When** intenta consultar un pasaporte o su historial, **Then** se deniega el acceso sin confirmar la existencia del jugador ni exponer datos.

---

### User Story 5 - Presentar el pasaporte en web y móvil (Priority: P1)

Como Usuario titular adulto, Usuario representante legal, Usuario de Academia u operador interno autorizado, puedo ver el pasaporte responsive con identidad persistente y navegación aprobada, sin acceder a información ajena.

**Why this priority**: La presentación persistente y la navegación aprobada convierten el ciclo de vida en una experiencia reconocible y verificable en ambas plataformas.

**Independent Test**: Con un pasaporte en cada estado documentado y en actores autorizados distintos, se recorre Resumen, Estadísticas, Partidos y Videos en móvil y web; se comprueba que la identidad permanece visible, que la navegación respeta la composición aprobada y que los datos se muestran según el contrato sin inventar información.

**Acceptance Scenarios**:

1. **Given** un actor autorizado y un pasaporte accesible, **When** abre la presentación del pasaporte, **Then** ve el área de identidad del jugador y las secciones Resumen, Estadísticas, Partidos y Videos según la composición aprobada.
2. **Given** una vista móvil, **When** el actor navega entre secciones, **Then** usa una barra de pestañas horizontal debajo del área de identidad y conserva visible la identidad del jugador.
3. **Given** una vista de escritorio, **When** el actor navega entre secciones, **Then** usa una navegación vertical debajo de la información del jugador en la columna izquierda y nunca muestra el menú encima del contenido principal.
4. **Given** la dirección visual aprobada, **When** se presenta cualquier sección, **Then** mantiene fondos esmeralda/negro, superficies liquid-glass oscuras, bordes verdes luminosos, acentos lima, texto blanco roto y tipografía no redondeada, con el logo separado de la fotografía del jugador.
5. **Given** información disponible del contrato de presentación, **When** se muestra, **Then** refleja solo los valores aprobados del backend; la información ausente se distingue de cero y nunca se sustituye por cero, inferencia, evaluación o afirmación deportiva.
6. **Given** una sección cuyo contenido depende de capacidades de backend posteriores, **When** se presenta, **Then** conserva la estructura aprobada y señala esa dependencia como no disponible, sin simular datos ni controles activos.
7. **Given** un actor no asociado o no autorizado, **When** intenta ver el pasaporte, **Then** recibe una denegación segura sin confirmar la existencia del jugador ni exponer información protegida.
8. **Given** el área de identidad persistente, **When** se muestra en móvil y web, **Then** presenta el nombre autorizado, posición, categoría de edad declarada, ciudad, país, pie dominante y academia de origen cuando corresponda, más un marcador de fotografía neutral sin controles de carga ni datos fotográficos persistidos.
9. **Given** un Usuario con exactamente un pasaporte accesible y autorización resuelta tras autenticar, **When** entra al producto, **Then** abre directamente Resumen sin depender de la capacidad de crear ni presentar estado técnico como pantalla principal.
10. **Given** un Usuario con varios jugadores accesibles, incluidos su pasaporte propio y menores representados, **When** entra, **Then** usa un selector de jugador con solo sus pasaportes autorizados; no se elige uno por inferencia.
11. **Given** un contexto de cartera de Academia, **When** entra el Usuario de Academia, **Then** recibe la lista de pasaportes de esa academia incluso si contiene uno solo; los contextos particular y organizacional no se mezclan.
12. **Given** un pasaporte Activo, **When** se abre, **Then** su destino visual es Resumen; estado, historial y acciones técnicas se consultan como rutas secundarias autorizadas.
13. **Given** el perfil básico disponible, **When** se recorren las cuatro secciones, **Then** Resumen presenta ese perfil, Estadísticas señala dependencia de estadísticas/FEM, Partidos de la característica de partidos y Videos de la audiovisual; estas tres secciones permanecen No disponible y no se interpretan como implementación faltante de Feature 005.

---

### User Story 6 - Usar las interfaces autenticadas por rol (Priority: P1)

Como Usuario titular o representante legal, Usuario de Academia, Analista o Administrador autorizado, puedo realizar únicamente las operaciones que mis relaciones, membresía y capacidades permiten, sin autorización inferida de la interfaz.

**Why this priority**: La presentación debe ser operativa y segura: cada rol ve sus acciones y estados, sin controles falsos ni autorización inferida de la interfaz.

**Independent Test**: En web y móvil se prueban Usuario titular adulto, Usuario representante legal, Usuario de Academia, Analista, Administrador e identidad con varios contextos. Se comprueban capacidades independientes, denegación por defecto y compatibilidad histórica de Tutor sin ampliación de privilegios.

**Acceptance Scenarios**:

1. **Given** un Usuario con relación vigente de representante legal, **When** consulta sus jugadores, **Then** puede crear para menores autorizados y consultar, editar, presentar o corregir únicamente los pasaportes de esas relaciones y en estados editables.
2. **Given** un Usuario de Academia con membresía activa, **When** consulta sus pasaportes, **Then** ve su estado y puede crear, editar, presentar y corregir solo dentro de su academia vigente.
3. **Given** un Analista con capacidad de revisión, **When** opera un pasaporte En revisión, **Then** ve la revisión, la resolución de posible duplicado, la devolución y la aprobación como acciones disponibles según el estado.
4. **Given** un Administrador con capacidad de activación, **When** opera un pasaporte Aprobado, **Then** ve la activación manual como acción separada de la aprobación.
5. **Given** un actor sin la capacidad, relación o membresía requerida, **When** intenta una acción, **Then** la interfaz no la ofrece como operable y la denegación no expone datos protegidos ni razones internas.
6. **Given** una identidad con ambos roles aplicables, **When** opera revisión y activación, **Then** cada acción se autoriza y se presenta de forma independiente.
7. **Given** un pasaporte en estado no editable, **When** el gestor autorizado intenta editarlo, **Then** la edición no está disponible y el estado permanece sin cambios.
8. **Given** un pasaporte con señal privada de posible duplicado sin resolver, **When** el Analista intenta aprobarlo, **Then** la aprobación no se ofrece como válida y no se produce una aprobación parcial.
9. **Given** un Usuario titular adulto sin rol Tutor, **When** gestiona su propio pasaporte, **Then** consulta presentación, estado e historial apto y edita, presenta o corrige solo en estados permitidos; no revisa duplicados, aprueba ni activa.
10. **Given** una identidad con USER y ACADEMY_USER, **When** cambia de contexto, **Then** cada operación exige la relación particular o membresía organizacional correspondiente; ninguna facultad se hereda del otro contexto.
11. **Given** un menor representado que cumple 18 años, **When** se recalculan las capacidades, **Then** no se otorga titularidad, cuenta ni acceso nuevo, no se elimina la responsabilidad histórica y no se permiten nuevas mutaciones por representación de menor; una futura regularización requiere acción explícita.
12. **Given** una asignación histórica TUTOR, **When** se reconcilia con USER, **Then** se preservan identidad e historial y solo se reconocen relaciones verificadas; el rol antiguo por sí solo no concede SELF ni representación de otros jugadores.

### Lifecycle Rules

| Estado actual | Acción permitida | Estado resultante | Actor autorizado |
|---|---|---|---|
| Sin pasaporte | Crear el primer borrador, registrar el origen y establecer las relaciones legítimas atómicamente | Borrador | Usuario activo titular adulto o representante legal autorizado, o Usuario de Academia activo con membresía vigente y representación confirmada cuando el jugador sea menor |
| Borrador | Modificar información válida | Borrador | Gestor autorizado por relación o membresía vigente |
| Borrador | Presentar para revisión | En revisión | Gestor autorizado por relación o membresía vigente |
| En revisión | Devolver para corrección con razón | Devuelto para corrección | Analista de New Talents con capacidad explícita de revisión de pasaportes |
| En revisión | Aprobar solo después de resolver cualquier señal privada de posible duplicado | Aprobado | Analista de New Talents con capacidad explícita de revisión de pasaportes |
| Devuelto para corrección | Corregir información válida | Devuelto para corrección | Gestor autorizado por relación o membresía vigente |
| Devuelto para corrección | Presentar nuevamente | En revisión | Gestor autorizado por relación o membresía vigente |
| Aprobado | Activar manualmente | Activo | Administrador de New Talents con capacidad explícita de activación de pasaportes |

- No existe en esta característica una transición que cree, duplique, publique, suspenda, transfiera o elimine un pasaporte Activo.
- Toda transición no incluida en la tabla se rechaza de forma segura, sin modificar el estado, el origen, las relaciones iniciales de responsabilidad, la información del jugador ni la trazabilidad existente.
- Una presentación, devolución, aprobación o activación confirma completa o no confirma nada: no puede dejar un cambio de información, estado o trazabilidad a medias.
- La señal privada de posible duplicado no es un estado adicional. Un Borrador con la señal sin resolver sigue la transición normal de Borrador a En revisión.
- La confirmación de que el jugador ya posee pasaporte no aprueba, activa, fusiona, sustituye ni expone el nuevo pasaporte; tampoco crea una transición o un estado nuevo.

### Estados de presentación

- **Carga**: la presentación espera la resolución de autenticación, autorización y datos antes de mostrar contenido protegido.
- **Vacío**: no existe contenido aprobado para la sección; se presenta sin inventar valores.
- **No disponible**: una sección depende de una capacidad de backend posterior, no está disponible para el actor, o una resolución confirmada de duplicado impide continuar; se distingue claramente de cero y de un error, y no introduce un estado Suspendido ni una transición de ciclo nueva.
- **Restringido**: el actor no tiene acceso a un pasaporte o a información protegida; la denegación es segura y no confirma existencia.
- **Validación**: la entrada o el contenido del borrador es incompleto, malformado o contradictorio; se indica junto al campo o sección correspondiente.
- **Revisión de posible duplicado**: estado interno del Analista para resolver señales; no es visible para el gestor autorizado.
- **Borrador**: el gestor autorizado puede completar, validar y presentar.
- **Presentado / En revisión**: el gestor autorizado no puede editar; el Analista puede revisar.
- **Devuelto**: el gestor autorizado ve la razón de corrección y puede corregir y presentar de nuevo.
- **Aprobado**: espera la activación manual separada.
- **Activo**: servicio activado manualmente; no implica publicación, visibilidad pública ni módulos futuros.

### Datos mínimos, privacidad y validación

- **Información personal sensible del jugador**: nombre legal completo, fecha de nacimiento, tipo de documento de identidad y número de documento de identidad. Es privada y se usa para el ciclo, la validación y la prevención de duplicados; no se publica en esta característica.
- **Información de contacto de cuenta**: pertenece a la cuenta Usuario o de Usuario de Academia ya existente; no se convierte en datos del jugador ni prueba titularidad o representación.
- **Determinación de edad**: se valida una fecha de nacimiento real y no futura. El backend evalúa años cumplidos usando la fecha actual en Colombia (`America/Bogota`), tanto al crear como al presentar y al autorizar operaciones sensibles a edad. Antes del cumpleaños 18 es menor y desde ese cumpleaños es adulto; para nacimiento el 29 de febrero, en año no bisiesto se cumple el aniversario el 1 de marzo. No se usa la hora, fecha o casilla del cliente, ni se deriva la categoría futbolística. La decisión conserva referencia a la política y fecha de evaluación sin copiar la fecha de nacimiento a la traza.
- **Información privada de representación**: identidad de cuenta del representante, nombre legal completo, tipo y número de documento normalizados y válidos, vínculo declarado con el jugador (madre, padre o tutor legal), declaración explícita de autoridad para representarlo en este ciclo, actor y momento de confirmación. No se exige carga documental ni se afirma validación judicial; se comprueba identidad de cuenta, consistencia de datos y declaración requerida. El representante suministra y confirma esos hechos; la academia no puede confirmar en su nombre.
- **Separación de autoridad y contacto**: la relación de representante enlaza Usuario y jugador, no copia contacto de cuenta. Sus documentos, vínculo y declaración no aparecen en presentación deportiva, consultas ajenas, diagnósticos o trazas; solo se accede a lo necesario en preparación propia y revisión interna autorizada.
- **Cambio de mayoría de edad**: el resultado vigente se recalcula, sin modificar el origen o historial. No se mantiene una autorización de menor por una edad congelada ni se asigna SELF al antiguo representante; las mutaciones por esa representación quedan No disponible hasta una regularización explícita futura. La consulta histórica segura exige su capacidad aplicable y no otorga nuevas facultades sobre el jugador adulto.
- **Información futbolística básica**: posición principal declarada, categoría de edad declarada, ciudad, país y pie dominante. La categoría declarada es un valor acotado, como `Sub-13`, que no se deriva de la fecha de nacimiento ni crea reglas de torneo. La ciudad y el país son presentación futbolística sin dirección, coordenadas, barrio ni ubicación precisa. El pie dominante usa únicamente `Izquierda`, `Derecha`, `Ambos` o `No declarado`. La ausencia de una información no puede sustituirse por cero, una capacidad inferida, una estadística, una evaluación ni una afirmación deportiva.
- **Información de academia de origen**: para un pasaporte con origen Academia, el área de identidad presenta el nombre autorizado de la academia de origen desde el contexto existente. Para un pasaporte con origen Particular sin academia aplicable, presenta un valor explícito no disponible. No se duplican datos de contacto de academia ni se crea traslado, historial de afiliación o comportamiento de múltiples academias.
- **Información de ciclo y revisión**: estado vigente, contexto de creación, relación específica de responsabilidad cuando corresponda, presentaciones, razones de devolución, decisiones internas y trazabilidad. La razón de devolución se muestra al gestor autorizado en una forma suficiente para corregir, sin revelar notas internas ajenas.
- **Información de presentación**: la capa de presentación usa un contrato explícito que distingue contenido disponible, vacío, no disponible, restringido y dependiente de capacidades posteriores. No copia el número de documento de identidad ni los datos privados del jugador a las secciones de presentación.
- **Marcador de fotografía del jugador**: el área aprobada se presenta con una silueta o iniciales locales neutrales. No se persiste URL, binario, identificador de archivo ni referencia externa, y no se ofrecen controles de carga ni acciones fotográficas simuladas.
- La información obligatoria debe estar presente, ser coherente y pertenecer a la categoría correcta antes de que un Borrador pueda presentarse. Los valores incompletos, malformados o contradictorios se rechazan sin enviar el pasaporte a revisión.
- La categoría de edad declarada, la ciudad, el país y el pie dominante se validan como perfil futbolístico básico, manteniéndose separados de la fecha de nacimiento, del documento de identidad y del contacto de cuenta.
- El tipo y el número de documento de identidad deben normalizarse y validarse como comportamiento de producto, y usarse para impedir pasaportes duplicados.
- El tipo y el número de documento de identidad nunca deben aparecer en información futbolística pública, trazas de ciclo, denegaciones de autorización, secciones de presentación ni respuestas diseñadas para no revelar información.
- Una coincidencia confirmada sobre el documento de identidad normalizado impide crear un segundo pasaporte.
- Una similitud basada únicamente en nombre legal y fecha de nacimiento no rechaza automáticamente la creación del Borrador.
- Esa similitud permite crear el Borrador mientras se registra una señal privada e interna de posible duplicado.
- La señal no expone al gestor autorizado el pasaporte candidato, la identidad del jugador, información documental, el representante responsable, la academia ni otra información protegida.
- El Borrador con señal sin resolver puede completarse y presentarse por el ciclo normal.
- Un pasaporte con señal sin resolver no puede aprobarse.
- El Analista con capacidad de revisión de pasaportes resuelve la señal durante la revisión.
- Si determina que son jugadores distintos, registra la resolución y la revisión normal puede continuar.
- Si la información presentada puede corregirse, puede devolver el pasaporte con la transición existente y una razón apta para el gestor autorizado.
- Si confirma que el jugador ya posee pasaporte, el nuevo pasaporte no se aprueba, activa, fusiona, sustituye ni expone.
- La resolución debe quedar trazable sin copiar el número de documento de identidad ni información sensible innecesaria en la traza.

### Authorization Outcomes

| Contexto | Resultado requerido |
|---|---|
| Usuario titular adulto (USER + gestión propia) | Crea un único pasaporte propio vinculado a su identidad; consulta presentación, estado e historial apto; edita, presenta y corrige en Borrador o Devuelto. No resuelve duplicados, aprueba ni activa. |
| Usuario representante legal (USER + relación vigente) | Crea para uno o varios menores con identidad y autoridad confirmadas; consulta presentación, estado e historial apto y edita, presenta o corrige solo los pasaportes de sus relaciones, en estados permitidos. No tiene acceso autenticado el menor. |
| Usuario de Academia (ACADEMY_USER + membresía activa) | Crea y gestiona dentro de la academia de origen; consulta presentación, estado e historial apto y edita, presenta o corrige en estados permitidos, sin exigir ser el empleado creador original. Para un menor exige representante confirmado; la academia no adquiere autoridad legal ni SELF. |
| Analista de New Talents + capacidad explícita de revisión | Consulta presentación, estado, revisión e historial interno necesario; en En revisión devuelve, resuelve duplicados y aprueba solo sin señales pendientes ni duplicado confirmado. No crea ni edita como titular por su rol interno y no activa. |
| Administrador de New Talents + capacidad explícita de activación | Consulta presentación, estado e historial interno aplicable y activa manualmente solo Aprobado. No resuelve duplicados ni aprueba por ser Administrador. |
| Titular, representante o Usuario de Academia asociado | Recibe motivos aptos de corrección y eventos seguros; no recibe señal privada, candidato ni resolución interna de duplicado. Una confirmación de duplicado impide continuar mediante No disponible sin nuevo estado. |
| Identidad con ambas capacidades internas o varios contextos | Cada operación se autoriza por su capacidad y relación o membresía específicas; no existe aprobación y activación implícitas, ni privilegios particulares derivados de membresía. |
| TUTOR histórico durante compatibilidad | Solo mantiene el alcance de relaciones legítimas reconciliadas bajo la política vigente; no prueba propiedad adulta ni representación legal por sí solo. La reconciliación hacia USER es controlada y trazable, sin reescribir auditoría. |
| Usuario no asociado, otra academia, membresía histórica o identidad inactiva | Denegación segura sin confirmar existencia ni mostrar datos protegidos. |
| Persona no autenticada | No crea, consulta, presenta, corrige, revisa, aprueba ni activa y no recibe confirmación del pasaporte o jugador. |

### Edge Cases

- Dos creadores intentan iniciar al mismo jugador casi al mismo tiempo; no se crean dos pasaportes ni relaciones parciales. Dos solicitudes de una identidad para pasaportes propios de documentos distintos tampoco crean dos titularidades.
- El backend y el cliente evalúan fechas diferentes cerca de medianoche o del cumpleaños 18; prevalece la fecha del backend en Colombia.
- Una fecha de nacimiento válida corresponde al 29 de febrero; la evaluación mantiene la regla explícita de aniversario sin depender del cliente.
- Un jugador alcanza los 18 años o una corrección de fecha cambia su condición durante preparación o revisión; se reevalúan capacidades sin transferencia ni nueva cuenta.
- Una academia intenta confirmar la autoridad del representante en su nombre, omite su identidad o usa un contacto o pago como prueba; se rechaza sin creación parcial.
- Un Usuario intenta gestionar un adulto ajeno, cambiar la identidad titular desde un formulario o ampliar sus relaciones al migrar TUTOR; se deniega sin alterar historial.
- Un empleado distinto al gestor autorizado original tiene membresía activa en la academia de origen; se evalúa el contexto de academia, no propiedad personal del empleado.
- Una identidad tiene pasaporte propio, menores representados y membresía de academia; el selector particular y la cartera organizacional preservan sus límites.
- Un Usuario de Academia pierde o cambia su membresía mientras prepara o presenta un borrador.
- El estado del pasaporte cambia entre la consulta y la acción de un creador u operador.
- Una devolución se intenta sin razón, con una razón vacía o con contenido que no es apto para el gestor autorizado.
- Se intenta presentar un Borrador con información mínima incompleta, contradictoria, malformada o ubicada en la categoría equivocada.
- El documento de identidad falta, no puede normalizarse, no es válido o contradice otra información del jugador.
- Se intenta aprobar o activar un pasaporte que ya fue cambiado por otra decisión válida.
- Una operación autorizada no puede conservar su traza material completa.
- Un actor intenta usar datos de contacto de cuenta como si fueran datos públicos o información futbolística del jugador.
- Un pasaporte Aprobado o Activo recibe una petición de edición normal, nueva presentación o duplicación.
- Un Borrador con señal privada de posible duplicado se presenta sin que el gestor autorizado conozca la señal.
- Un Analista intenta aprobar una presentación con una señal privada de posible duplicado sin resolver.
- La resolución determina que los jugadores son diferentes, que la información puede corregirse o que el jugador ya existe.
- La resolución de posible duplicado debe quedar trazable sin copiar el número de documento de identidad ni información sensible innecesaria.
- Una identidad con ambos roles intenta aprobar y activar en una sola operación implícita; cada capacidad debe autorizarse y trazarse por separado.
- La navegación cambia de sección mientras se cargan o se actualizan los datos de presentación.
- Una sección Estadísticas, Partidos o Videos se abre sin datos aprobados o con datos aún no disponibles.
- El backend no está disponible durante la consulta de presentación.
- El área de identidad se mantiene visible mientras se navega en una vista estrecha o con teclado móvil abierto.
- Una sección dependiente de una capacidad futura intenta mostrarse como si tuviera datos de producción.
- Tras una resolución confirmada de duplicado, el gestor autorizado recibe únicamente el resultado seguro No disponible y no puede continuar; el pasaporte no se describe como suspendido.
- Se intenta derivar automáticamente la categoría de edad desde la fecha de nacimiento o introducir reglas de categoría de torneo.
- Se ingresa una ciudad o país con dirección, coordenadas, barrio, vecindario o ubicación precisa de un menor.
- Se usa un valor de pie dominante fuera de Izquierda, Derecha, Ambos o No declarado; el valor no declarado no se muestra como cero.
- Un pasaporte con origen Particular sin academia aplicable intenta mostrar una academia inventada en el área de identidad.
- Un pasaporte con origen Academia intenta duplicar datos de contacto de la academia o exponer su información privada.
- El área de fotografía intenta cargar, almacenar, reemplazar, moderar o eliminar una imagen, o mostrar una URL, binario, identificador de archivo o referencia externa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exigir identidad autenticada, activa y con sesión válida para toda operación o consulta de pasaporte cubierta por esta característica.
- **FR-002**: El sistema DEBE permitir a un Usuario activo crear el primer Borrador de origen Particular y establecer atómicamente la relación aplicable: titular adulto de su propio pasaporte vinculado a su identidad autenticada, o representante legal identificado y autorizado de un menor; no DEBE crear relación de Tutor para gestión propia.
- **FR-003**: El sistema DEBE permitir creación y gestión organizacional solo a un Usuario de Academia con membresía activa en la academia de origen, registrar ese origen y distinguir la relación Academia de la titularidad y representación legal; para un menor DEBE exigir la información y autoridad confirmadas por el representante.
- **FR-004**: El sistema DEBE capturar la identidad privada mínima del jugador —nombre legal completo, fecha de nacimiento, tipo y número de documento— y el perfil futbolístico básico declarado —posición, categoría, ciudad, país y pie dominante—, separándolos entre sí, del contacto de cuenta y de la información privada de representación cuando corresponda.
- **FR-005**: El sistema DEBE validar información completa, coherente y categorizada correctamente, documentos normalizados y válidos, fecha de nacimiento real y no futura, perfil futbolístico acotado y relación compatible con la edad; antes de presentar DEBE exigir además representación confirmada cuando corresponda.
- **FR-006**: El sistema DEBE rechazar de forma atómica la creación de un segundo pasaporte ante una coincidencia confirmada sobre el tipo y el número de documento de identidad normalizados.
- **FR-007**: El sistema DEBE permitir consultar y modificar un Borrador únicamente al titular adulto, representante legal o Usuario de Academia autorizado por hechos vigentes; el empleado creador original no DEBE ser requisito adicional de gestión organizacional.
- **FR-008**: El sistema DEBE permitir presentar un Borrador válido y cambiarlo a En revisión, bloqueando la edición normal mientras permanezca en ese estado.
- **FR-009**: El sistema DEBE permitir únicamente a un Analista de New Talents autenticado y con capacidad explícita de revisión de pasaportes devolver una presentación para corrección con una razón apta para el gestor autorizado o aprobarla solo después de resolver cualquier señal privada de posible duplicado; la aprobación nunca DEBE activar el servicio.
- **FR-010**: El sistema DEBE permitir al gestor autorizado por relación o membresía vigente corregir y presentar nuevamente un pasaporte Devuelto para corrección, conservando las presentaciones y devoluciones previas.
- **FR-011**: El sistema DEBE mantener Aprobado separado de Activo y permitir únicamente a un Administrador de New Talents autenticado y con capacidad explícita de activación de pasaportes activar manualmente un pasaporte Aprobado.
- **FR-012**: El sistema DEBE rechazar toda transición no válida, no autorizada, desactualizada o incompleta sin producir cambios parciales.
- **FR-013**: El sistema DEBE permitir a Usuario titular adulto, Usuario representante legal, Usuario de Academia, Analista con capacidad de revisión y Administrador con capacidad de activación consultar presentación, estado e historial únicamente en el alcance de sus relaciones, membresía y capacidades; la consulta de historial particular u organizacional DEBE excluir notas, señales y resoluciones internas.
- **FR-014**: El sistema DEBE aplicar autorización vigente y denegación por defecto por identidad, rol genérico u organizacional, relación de titular adulto o representante legal, membresía, capacidad interna, edad validada y clasificación de información; no DEBE inferirla de pantalla, origen, rol TUTOR, documento introducido, pago ni suscripción.
- **FR-015**: El sistema DEBE conservar trazabilidad atómica de creación, establecimiento de relaciones, confirmación de autoridad, modificación material, presentación, devolución, resolución de duplicado, aprobación y activación con actor, momento, acción, resultado y estados aplicables; no DEBE copiar documentos, fecha de nacimiento, vínculo privado, declaraciones completas ni datos sensibles innecesarios a la traza.
- **FR-016**: La aprobación o activación no DEBE crear un perfil público, exponer información sensible, exponer una señal privada de posible duplicado o su pasaporte candidato, habilitar acceso de reclutadores ni publicar información futbolística.
- **FR-017**: El sistema DEBE preservar salud, identidad, membresías, gobierno de privilegios, denegación por defecto, login y sesiones existentes, salvo la incorporación acotada de USER, sus relaciones y la compatibilidad controlada de TUTOR requerida por esta corrección. La elegibilidad de USER DEBE usar el mecanismo existente de autenticación sin crear cuentas ni roles durante login, renovación o creación de pasaporte.
- **FR-018**: El sistema DEBE presentar la experiencia de pasaporte en web y móvil como una única característica vertical, sin trasladar el frontend a una característica separada.
- **FR-019**: El sistema DEBE permitir la creación de un Borrador cuando la única señal de posible duplicado proviene de una similitud basada únicamente en nombre legal y fecha de nacimiento, y DEBE registrar una señal privada e interna de posible duplicado, sin exponer al gestor autorizado el pasaporte candidato, la identidad del jugador, información documental, el representante responsable, la academia ni otra información protegida.
- **FR-020**: El sistema DEBE permitir que un Borrador con señal privada de posible duplicado sin resolver siga el ciclo normal hasta En revisión, y DEBE impedir su aprobación mientras la señal no haya sido resuelta por un Analista de New Talents con capacidad explícita de revisión de pasaportes.
- **FR-021**: El sistema DEBE permitir al Analista con capacidad explícita de revisión resolver la señal durante la revisión: registrar que los jugadores son diferentes y continuar, devolver con razón apta si la información puede corregirse, o no aprobar, activar, fusionar, sustituir ni exponer el nuevo pasaporte si confirma que el jugador ya posee pasaporte.
- **FR-022**: El sistema DEBE conservar trazabilidad de la resolución de posible duplicado sin copiar el número de documento de identidad ni información sensible innecesaria, y sin introducir un estado, una búsqueda pública, una fusión automática, un traslado, una eliminación ni un segundo pasaporte.
- **FR-023**: La presentación del pasaporte DEBE conservar visible el área de identidad del jugador al navegar entre Resumen, Estadísticas, Partidos y Videos.
- **FR-024**: La presentación móvil DEBE usar una barra de pestañas horizontal debajo del área de identidad del jugador. La presentación de escritorio DEBE usar una navegación vertical debajo de la información del jugador en la columna izquierda y nunca debe mostrar el menú encima del contenido principal.
- **FR-025**: La presentación DEBE preservar la dirección visual aprobada: fondos verde esmeralda profundo y negro, superficies oscuras translúcidas liquid-glass, difusión sutil de fondo, bordes verdes luminosos finos, acentos lima, texto blanco roto y tipografía elegante no redondeada, manteniendo el logo separado de la fotografía del jugador.
- **FR-026**: La presentación DEBE consumir contratos explícitos del backend y no DEBE depender de estructuras internas del FEM, datos simulados de producción ni valores representativos de los referentes como contenido fijo.
- **FR-027**: La presentación DEBE distinguir información disponible, vacía, no disponible, restringida y dependiente de capacidades posteriores. Ninguna ausencia DEBE mostrarse como cero, capacidad inferida, estadística, evaluación ni afirmación deportiva.
- **FR-028**: Resumen DEBE presentar el perfil básico disponible de Feature 005. Estadísticas, Partidos y Videos DEBEN preservar la composición aprobada y permanecer No disponible hasta las características de estadísticas/FEM, partidos y audiovisual respectivamente, sin inventar datos ni ofrecer controles simulados; esta disponibilidad NO DEBE considerarse trabajo faltante de Feature 005.
- **FR-029**: La experiencia autenticada DEBE ofrecer a cada rol únicamente las acciones de ciclo para las que tiene capacidad, relación o membresía vigente, y no DEBE presentar acciones ajenas como operables.
- **FR-030**: La presentación DEBE cubrir los estados de carga, vacío, no disponible, restringido, validación, borrador, presentado, devuelto, aprobado y activo, así como la revisión de posible duplicado únicamente para el Analista autorizado.
- **FR-031**: Las pantallas de presentación y ciclo DEBEN ser accesibles: navegación por teclado y lector de pantalla, orden de foco lógico, foco visible en web, errores asociados al campo, contraste legible y comunicación sin depender solo del color.
- **FR-032**: El sistema DEBE preservar el comportamiento responsive consistente con la Feature 004: tamaños de toque adecuados, teclado móvil utilizable, diseños estables en vista estrecha y respeto de preferencias de movimiento reducido.
- **FR-033**: El sistema DEBE capturar y validar la categoría de edad declarada como valor futbolístico acotado, sin derivarla de la fecha de nacimiento, y DEBE limitar el pie dominante a `Izquierda`, `Derecha`, `Ambos` o `No declarado`.
- **FR-034**: El área de identidad DEBE presentar la academia de origen autorizada cuando corresponda, o un valor explícito no disponible para origen Particular sin academia aplicable, sin inventar academia, duplicar contacto, trasladar ni crear historial de afiliación.
- **FR-035**: El sistema DEBE conservar el área de fotografía del jugador con un marcador local neutral y NO DEBE cargar, almacenar, gestionar, reemplazar, moderar ni eliminar fotografías, ni persistir URL, binario, identificador de archivo o referencia externa, ni ofrecer controles de carga o acciones fotográficas simuladas.
- **FR-036**: Esta característica NO DEBE incorporar traslados, retorno de responsabilidad, varias academias activas, FEM, cálculo de métricas, registro de partidos, administración de videos, torneos, pagos, suscripciones, notificaciones, carga de archivos o fotografías, cambios del mecanismo de login o sesión, registro público, login de menores, gestión general de roles, perfil o búsqueda pública, fusión, eliminación, segundo pasaporte ni nuevos estados de ciclo. USER y la reconciliación controlada de TUTOR son la única excepción acotada de compatibilidad de roles.

- **FR-037**: El sistema DEBE reconocer USER como cuenta particular genérica, distinta de ACADEMY_USER y sin permisos internos, permitiendo un pasaporte propio adulto y múltiples menores representados mediante relaciones explícitas, sin exigir roles globales adicionales.
- **FR-038**: El backend DEBE determinar menor o adulto por años cumplidos a partir de fecha de nacimiento validada, fecha actual en Colombia y umbral de 18 años, con la regla de aniversario definida en Datos mínimos; DEBE reevaluar al crear, presentar y autorizar acciones sensibles a edad y NO DEBE confiar ni persistir una casilla isAdult como autoridad.
- **FR-039**: Para representar a un menor, el sistema DEBE exigir cuenta activa identificada, identidad privada del representante, vínculo declarado y confirmación explícita de autoridad trazable; estos hechos NO DEBEN aparecer en presentación deportiva, consultas ajenas, diagnósticos ni trazas sensibles y no constituyen certificación legal.
- **FR-040**: Una creación de menor por Academia DEBE registrar la confirmación del Usuario representante identificado y diferenciar sus facultades de la relación organizacional; un Usuario de Academia NO DEBE suplir esa confirmación ni adquirir representación por membresía.
- **FR-041**: Cumplir 18 años o corregir la fecha de nacimiento NO DEBE crear cuenta, acceso SELF, transferencia ni eliminación de responsabilidad histórica. Las nuevas mutaciones por representación de menor DEBEN quedar No disponible si deja de corresponder la relación; la regularización de autoridad se difiere a una acción explícita futura sin introducir un estado de ciclo.
- **FR-042**: Tras autenticación y autorización resueltas, un Usuario con un solo pasaporte accesible DEBE entrar directamente a Resumen; con varios DEBE usar selector de jugador. En contexto Academia DEBE usar la cartera de pasaportes. Un Activo DEBE abrir Resumen; estado e historial técnicos DEBEN permanecer secundarios y sujetos a capacidad vigente.
- **FR-043**: La reconciliación de TUTOR hacia USER DEBE ser controlada, trazable y sin ampliación implícita de derechos; DEBE preservar identidades, relaciones legítimas, origen histórico y auditoría interpretable. Un hecho histórico incompleto NO DEBE transformarse automáticamente en SELF ni representación confirmada.
- **FR-044**: El sistema NO DEBE usar pagos o suscripciones como prueba de titularidad, representación, membresía ni autorización; facturación, registro público, acceso de menores y transferencia de autoridad al alcanzar la mayoría de edad quedan fuera de la entrega.

### Key Entities

- **Usuario**: Cuenta autenticable con rol genérico USER; puede ser titular adulto de un pasaporte propio y representante de varios menores. ACADEMY_USER es una responsabilidad organizacional independiente.
- **Política de edad del MVP**: Colombia, mayoría de edad a los 18 años, fecha de evaluación actual del backend en Colombia y clasificación derivada de la fecha de nacimiento privada validada; no reemplaza la categoría futbolística declarada.
- **Confirmación de representación**: Hecho privado que identifica al representante, el vínculo declarado y la autoridad confirmada para el ciclo de un menor, con actor y momento; no certifica custodia ni cumplimiento legal.
- **Pasaporte del jugador**: Registro único y permanente que consolida la identidad privada mínima, información futbolística inicial, estado del ciclo y contexto legítimo de creación del jugador.
- **Perfil futbolístico básico**: Conjunto de presentación y validación compuesto por posición principal declarada, categoría de edad declarada, ciudad, país y pie dominante, separado de la identidad privada, el contacto de cuenta y la fecha de nacimiento.
- **Borrador de pasaporte**: Etapa editable previa a la presentación, limitada a su gestor legítimo y a información válida para revisión.
- **Relación de responsabilidad del pasaporte**: Asociación explícita y específica de gestión propia del titular adulto (SELF), representación legal de un menor (LEGAL_REPRESENTATIVE) o gestión de academia (ACADEMY). Una relación organizacional puede coexistir con la representación confirmada sin convertir la academia en representante; no hay traslados implícitos.
- **Contexto de creación**: Origen Particular o Academia, actor creador y contexto legítimo de creación; es independiente de quién consulta o gestiona actualmente por relaciones y membresía. El origen histórico Tutor se conserva interpretable, sin inferir de él propiedad personal.
- **Señal privada de posible duplicado**: Marca interna y privada registrada en un Borrador cuando solo hay similitud de nombre legal y fecha de nacimiento; no es visible para el gestor autorizado, bloquea la aprobación mientras esté sin resolver y es resuelta por el Analista durante la revisión.
- **Decisión de revisión**: Resolución de señal privada de posible duplicado, devolución con razón o aprobación tomada por un Analista de New Talents con capacidad explícita de revisión de pasaportes respecto de una presentación concreta.
- **Activación de servicio**: Decisión manual, posterior e independiente de la aprobación, tomada por un Administrador de New Talents con capacidad explícita de activación, que lleva el pasaporte a Activo sin publicar ni habilitar módulos futuros.
- **Traza de ciclo**: Evidencia de una transición, resolución de señal de posible duplicado o cambio material con actor, momento, resultado y estados relevantes, redactada para no duplicar datos sensibles ni incluir el número de documento de identidad.
- **Caparazón de presentación del pasaporte**: Estructura responsive común de la experiencia, que mantiene la identidad persistente del jugador, la navegación aprobada y la dirección visual liquid-glass.
- **Área de identidad persistente del jugador**: Región visible entre secciones que identifica al jugador con el nombre autorizado, la posición, la categoría de edad declarada, la ciudad, el país, el pie dominante y la academia de origen cuando corresponda, sin usar datos de contacto de cuenta ni el número de documento de identidad como contenido público.
- **Marcador de fotografía del jugador**: Silueta o iniciales locales neutrales que ocupan el área de fotografía aprobada sin persistencia de imagen, URL, binario, identificador de archivo o referencia externa.
- **Sección de presentación**: Cada uno de Resumen, Estadísticas, Partidos y Videos; define límites de presentación, no lógica de dominio futura.
- **Contrato de presentación del pasaporte**: Conjunto de datos de presentación autorizados que expone nombre, posición, categoría de edad declarada, ciudad, país, pie dominante, academia de origen cuando corresponda, estado del ciclo y estado explícito del marcador de fotografía, distinguiendo contenido disponible, vacío, no disponible, restringido y dependiente de capacidades posteriores, separado de estructuras internas del FEM.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de las creaciones válidas documentadas, Usuario titular adulto obtiene exactamente un Borrador propio vinculado a su identidad sin Tutor, Usuario representante obtiene un Borrador del menor con relación confirmada y Usuario de Academia obtiene un Borrador de su academia con representación confirmada cuando corresponda; toda creación es atómica.
- **SC-002**: En el 100% de los intentos documentados de creación por actor no autenticado, inactivo, no relacionado, sin membresía activa o de otra academia, no se crea ni modifica un pasaporte ni una relación de responsabilidad.
- **SC-003**: En el 100% de las coincidencias confirmadas sobre el tipo y número de documento de identidad normalizados, la creación de un segundo pasaporte se rechaza de forma atómica.
- **SC-004**: En el 100% de las presentaciones válidas, el pasaporte pasa de Borrador a En revisión y no admite edición normal hasta una devolución válida para corrección.
- **SC-005**: En el 100% de las decisiones documentadas, solo un Analista con capacidad explícita de revisión devuelve o aprueba, solo un Administrador con capacidad explícita de activación activa, una presentación con señal privada de posible duplicado sin resolver nunca se aprueba y la aprobación nunca activa el servicio de forma implícita.
- **SC-006**: En el 100% de los ciclos de corrección documentados, la razón de devolución es consultable por el gestor autorizado, la corrección vuelve a En revisión y se conserva el historial de cada paso.
- **SC-007**: En el 100% de los intentos inválidos, simultáneos, no autorizados o fallidos, estado, información, origen, relaciones e historial permanecen íntegros y no hay actualización parcial ni dos titularidades propias para una identidad.
- **SC-008**: La revisión de privacidad encuentra cero documentos, fecha de nacimiento, datos de representación, ubicaciones precisas, contactos, tokens, señales privadas, datos candidatos o notas innecesarias en consultas no autorizadas, presentación deportiva o trazas. El nombre autorizado del jugador se conserva únicamente en su contexto de presentación protegido.
- **SC-009**: En el 100% de las consultas documentadas, el gestor autorizado recibe su estado vigente y el operador autorizado la trazabilidad aplicable, mientras los terceros no obtienen confirmación del pasaporte ni del jugador.
- **SC-010**: En el 100% de las similitudes basadas solo en nombre legal y fecha de nacimiento, se permite crear el Borrador, se registra una señal privada e interna de posible duplicado y el gestor autorizado no recibe el pasaporte candidato, la identidad del jugador, información documental, el representante responsable, la academia ni otra información protegida.
- **SC-011**: En el 100% de los casos con señal privada de posible duplicado sin resolver, el Borrador puede presentarse pero no aprobarse; en el 100% de las resoluciones, el Analista registra diferencia, devuelve con razón apta o confirma duplicado sin aprobar, activar, fusionar, sustituir ni exponer, y la traza no contiene el número de documento de identidad.
- **SC-012**: En el 100% de los recorridos documentados en móvil y web, la identidad del jugador permanece visible al navegar entre Resumen, Estadísticas, Partidos y Videos, y la navegación respeta la composición aprobada por plataforma.
- **SC-013**: En el 100% de las vistas documentadas, la dirección visual aprobada se conserva sin reinterpretar la jerarquía de información, y el logo permanece separado de la fotografía del jugador.
- **SC-014**: En el 100% de las secciones documentadas, la información ausente se distingue de cero, y ninguna sección muestra valores simulados, métricas inventadas ni controles activos de capacidades no entregadas.
- **SC-015**: En el 100% de los casos documentados, cada rol solo ve y ejecuta las acciones para las que tiene capacidad, relación o membresía vigente; los intentos no autorizados reciben una denegación segura sin exponer datos protegidos.
- **SC-016**: En el 100% de los escenarios documentados de accesibilidad y responsive, las pantallas de ciclo y presentación son operables por teclado y lector de pantalla, con foco visible, errores asociados al campo y sin depender solo del color, y respetan la vista estrecha, el teclado móvil y el movimiento reducido.
- **SC-017**: La revisión de alcance encuentra cero traslados, transferencia automática de autoridad, publicación, reclutamiento, FEM, métricas calculadas, partidos, videos, torneos, pagos, suscripciones, notificaciones, carga de medios, cambios del mecanismo de autenticación/sesión, registro público, login de menores, gestión general de roles, búsqueda pública, fusión, eliminación, segundo pasaporte o nuevos estados; la compatibilidad USER/TUTOR permanece acotada y trazable.
- **SC-018**: En el 100% de las vistas documentadas en móvil y web, el área de identidad presenta el nombre autorizado, posición, categoría de edad declarada, ciudad, país, pie dominante, academia de origen cuando corresponda o su valor explícito no disponible, y un marcador de fotografía neutral sin controles de carga.
- **SC-019**: En el 100% de las validaciones documentadas, la categoría de edad no se deriva de la fecha de nacimiento, el pie dominante se limita a los cuatro valores controlados, y la ciudad y el país no incluyen dirección, coordenadas, barrio ni ubicación precisa.

- **SC-020**: El 100% de los casos de fecha anterior, exacta y posterior al cumpleaños 18, año bisiesto y discrepancia de reloj cliente/backend aplica la política Colombia/18 y la fecha de evaluación del backend; ninguna casilla determina autoridad ni deriva categoría futbolística.
- **SC-021**: En el 100% de los casos de Usuario titular y representante de varios menores, cada pasaporte se autoriza por su relación, sin Tutor global obligatorio ni facultades heredadas de ACADEMY_USER; un menor recibe cero cuentas o credenciales.
- **SC-022**: En el 100% de las creaciones de menor de Academia, existe representante identificado y confirmación propia de autoridad; la omisión o confirmación por la academia se rechaza atómicamente.
- **SC-023**: En el 100% de los recorridos de entrada, un único pasaporte particular accesible abre Resumen, varios abren selector y una cartera de Academia abre lista; Activo abre Resumen y estado/historial siguen secundarios y autorizados.
- **SC-024**: En el 100% de los cambios de edad o reconciliaciones históricas documentados, no hay concesión SELF, transferencia de autoridad, creación de cuenta ni reescritura de auditoría automática; los hechos incompletos no amplían permisos y la representación de menor no autoriza nuevas mutaciones después del umbral.

## Scope Boundaries

Esta característica incluye el ciclo inicial trazable —creación, preparación, presentación, revisión, devolución, corrección, nueva presentación, aprobación y activación manual— y la consulta autorizada, las relaciones atómicas de titular adulto, representante legal y academia, la política Colombia/18, la resolución privada de duplicados, la compatibilidad controlada USER/TUTOR, la experiencia responsive autenticada, el perfil básico, el marcador neutral, la navegación aprobada y la dirección visual liquid-glass.

Esta característica incluye Resumen con perfil básico disponible y la estructura de Estadísticas, Partidos y Videos como No disponible por dependencias futuras explícitas. No entrega su dominio ni datos de producción; estas dependencias no son implementación pendiente de Feature 005.

Esta característica excluye transferencias entre responsables o academias, regularización de autoridad al alcanzar mayoría de edad, varias academias activas, perfiles públicos, reclutadores, descubrimiento, filtros, FEM, métricas calculadas, partidos, videos, torneos, evaluaciones, comparaciones, pagos, suscripciones, notificaciones, carga o gestión de medios, cambios del mecanismo de login/sesión, registro público, login de menores, gestión general de roles, despliegue, nuevos estados, fusión, eliminación y segundo pasaporte. Esta aclaración modifica únicamente la especificación y los marcadores del checklist que cambien de resultado; no autoriza edición de código, esquemas, migraciones, contratos, planificación, tareas, fixtures ni diseño visual, ni ejecución de Phase 7.

La corrección reemplaza la premisa de TUTOR obligatorio de Feature 002 y amplía de forma explícita la elegibilidad particular de Features 003/004 a USER, preservando su mecanismo y gobierno de identidad y sesión. Los artefactos anteriores siguen siendo autoridad para esas fronteras salvo esta excepción acotada. La implementación vigente y los artefactos derivados de Feature 005 aún usan la premisa anterior y requieren reconciliación posterior; no se declara realizada por esta aclaración.

El impacto de compatibilidad que deberá evaluar la fase posterior comprende:

- Asignaciones TUTOR y tablas de identidad/roles: reconciliación controlada a USER, sin crear identidades duplicadas, sin retirar ACADEMY_USER ni roles internos y sin reescribir asignaciones históricas; el rol antiguo queda temporalmente reconocible solo por compatibilidad.
- `PassportOrigin`: distinguir origen Particular/Academia de las relaciones SELF/LEGAL_REPRESENTATIVE/ACADEMY y conservar la interpretación de TUTOR histórico. `InitialTutorResponsibility`: preservar el hecho histórico y reconciliar únicamente representación acreditada; nunca renombrarlo como propiedad adulta por defecto.
- Catálogo y contrato de autorización: cubrir titularidad y representación por USER, membresía de Academia sin propiedad del empleado creador, capacidades de historial filtradas y denegación por defecto; revisar las denominaciones antiguas de permisos Tutor sin elevar privilegios.
- Autenticación y sesiones: reconocer la elegibilidad genérica USER donde el catálogo anterior enumera TUTOR, sin cambiar login, renovación, almacenamiento, credenciales, provisión controlada o cierre de sesión; no hay onboarding nuevo.
- Contratos OpenAPI y contratos de presentación/autorización: expresar relación y contexto autorizados, validación de edad, confirmación privada de representación y capacidades específicas; evitar divulgar esos datos en presentación deportiva.
- DTOs, formularios y navegación: explicar la edad determinada por el servidor y solicitar representación cuando corresponda; separar selector particular de cartera de Academia, preservar Resumen como destino visual y mantener estado/historial secundarios sin cambiar la composición aprobada.
- Fixtures locales y pruebas: reconciliar los casos históricos de Tutor según fecha validada y autoridad, añadir titular adulto, Usuario de varios menores, menor de Academia, cumpleaños 18, contextos mixtos, concurrencia, privacidad y regresión de sesión; no cambiar fixtures ni marcar tareas completadas en esta fase.
- Historial de auditoría y ciclo: mantener actores, momentos, decisiones y terminología histórica interpretables; cualquier reconciliación futura añade evidencia redactada sin modificar ni eliminar hechos anteriores.

El plan, investigación, modelo de datos, contratos, quickstart y tareas actuales no están reconciliados con esta corrección. La aclaración queda lista como entrada de evaluación para `$speckit-converge`, pero no como autorización de implementación directa ni prueba de entrega completa; deben reconciliarse los artefactos derivados y el impacto acotado en las fronteras 002–004 antes de implementar.

## Assumptions

- Las Features 002 y 003 gobiernan identidad, privilegios internos, membresías, autorización, autenticación y sesiones, salvo la excepción explícita USER/TUTOR aquí aprobada. No proporcionan propiedad adulta ni representación legal de pasaporte previamente persistidas; esa información pertenece a Feature 005.
- La Feature 004 establece la base responsive y de accesibilidad del frontend; la Feature 005 la extiende al pasaporte sin modificar login, sesiones, restauración ni cierre de sesión.
- La Feature 005 establece atómicamente las relaciones iniciales legítimas; no deriva titularidad ni representación del rol global o de un pago.
- El catálogo exacto de formatos y reglas detalladas de validación sigue pendiente en la documentación funcional del MVP. Esta especificación fija categorías mínimas, incluidos tipo y número de documento de identidad, y resultados de validación, no un formulario, un identificador específico de documento ni un esquema de almacenamiento.
- Las capacidades internas quedan definidas como capacidad explícita de revisión de pasaportes para el Analista de New Talents y capacidad explícita de activación de pasaportes para el Administrador de New Talents, mediante la frontera de autorización vigente; una identidad con ambos roles debe obtener autorización independiente para cada operación.
- La prevención de duplicados usa el tipo y número de documento de identidad normalizados para el rechazo atómico de un segundo pasaporte; una similitud de nombre legal y fecha de nacimiento no rechaza la creación, sino que genera una señal privada e interna que el Analista resuelve durante la revisión sin crear un estado, búsqueda, fusión, traslado, eliminación ni segundo pasaporte.
- La normalización y validación del documento de identidad son comportamiento de producto; esta especificación no define algoritmos de cifrado, hashes, restricciones de base de datos, esquemas ni detalles de implementación.
- La categoría de edad declarada es un dato declarado, no derivado de la fecha de nacimiento; la ciudad y el país son presentación futbolística, no geolocalización, y no se introduce un catálogo de torneos.
- La academia de origen se presenta desde el contexto de academia existente cuando el pasaporte es de origen Academia; para un origen Particular sin academia aplicable se presenta un valor explícito no disponible sin inventar una academia.
- La fotografía del jugador queda fuera de esta característica. El área usa un marcador local neutral; no se introduce proveedor de medios, almacenamiento de objetos, dependencia de carga, servicio remoto de imágenes ni integración externa.
- La dirección visual aprobada es autoridad para composición y jerarquía, no para lógica de negocio ni para inventar métricas. Los nombres y valores de los referentes son datos representativos de diseño.
- Estadísticas, Partidos y Videos permanecen No disponible hasta sus características de dominio; Feature 005 entrega su composición y dependencia explícita, no sus datos ni lógica.
- Un pasaporte Activo significa únicamente que el servicio fue activado manualmente en este ciclo; no implica publicación, visibilidad pública, acceso de terceros ni disponibilidad de módulos aún excluidos.
