# Research: Espacio de trabajo del Analista

## 1. Lista de pasaportes y etiqueta segura

**Decision**: Crear una proyección de lectura específica para Feature 010. Usar `PlayerPassport.state = ACTIVE` y `PassportCustody.currentAnalystIdentityId = actor`, sin filtro de `enrichmentStatus`; proyectar el nombre del jugador autorizado desde `PlayerPrivateIdentity.encryptedLegalName` solo después de comprobar custodia, además de la referencia operativa. No serializar otros campos de identidad privada, datos de custodia administrativa ni capacidades de asignación.

**Rationale**: `AnalystPassportsQueryService` de Feature 007 comprueba identidad, rol y perfil, pero delega en `PassportCustodyQueryService`, que filtra `AWAITING_ANALYST_ENRICHMENT`, descifra `encryptedLegalName` y devuelve capacidades `ASSIGN/CHANGE/REMOVE`. El nombre ahora está autorizado por decisión del propietario, pero ese DTO sigue sin satisfacer todos los pasaportes `ACTIVE` bajo custodia y excede la minimización de FR-012. Feature 005 ya define `PlayerIdentityPresentation.displayName`; la proyección de Feature 010 toma únicamente el nombre respaldado, no la fila privada completa.

**Alternatives considered**: Reutilizar el endpoint tal cual (filtrado y exceso de datos); modificar su contrato administrativo en sitio (riesgo de regresión de Feature 007); inventar un nombre deportivo o usar la referencia enmascarada como sustituto del nombre aprobado. Se descartan.

## 2. Autorización de cada lectura y consistencia

**Decision**: Añadir endpoints `GET` de solo lectura bajo `/analyst/workspace`. La capa backend usa el actor autenticado y comprueba identidad `ACTIVE`, rol `ANALYST` vigente y perfil operativo; las listas aplican la custodia actual y `ACTIVE` en la consulta. Para cada pasaporte y partido por ID, comprobar conjuntamente pasaporte activo y custodia actual antes de proyectar, dentro de una lectura transaccional consistente. ID ajeno, inexistente o no vigente devuelve el mismo `404` mínimo; actor sin rol/identidad activa recibe denegación genérica, sin contenido retenido. Revalidar en cada petición, incluidos enlaces directos y refrescos.

**Rationale**: La ruta HTTP de `FirstMatchQuery` comprueba responsabilidad Feature 005, no custodia Feature 007. `PassportCustodyDetailService` devuelve historia y vínculos administrativos. Ninguna debe convertirse en autorización del nuevo espacio. La verificación de backend y la respuesta `Cache-Control: no-store` protegen aun si el cliente conserva una URL o una sesión antigua. Un cambio concurrente de custodia se observa en la siguiente petición, conforme a la especificación.

**Alternatives considered**: Reutilizar autorización del responsable (privilegios incorrectos), filtrar solo en UI (divulgación) o exigir bloqueo de escritura para cada `GET` (innecesario para la garantía de siguiente petición). Se descartan.

## 3. Fuente de partidos y extensión futura

**Decision**: Definir una forma interna de `ScheduledMatchRead` con ID, pasaporte, fecha `YYYY-MM-DD`, hora `HH:mm`, rival, competencia, sede y estado seguro; un adaptador consulta `FirstMatch` confirmado de Feature 009. La consulta no depende de que el partido sea primero: recorre todas las filas disponibles que cumplan el estado visible, sin usar `findCurrent` como límite semántico de la interfaz. Una futura fuente podrá aportar la misma proyección tras aprobar su contrato y autorización; Feature 010 no registra proveedores vacíos que aparenten datos ni crea partidos posteriores. `CANCELED` no aparece como partido programado; `LOADED` puede ser leído con estado operativo seguro, sin métricas ni etiqueta de análisis realizado.

**Rationale**: El esquema actual solo persiste `FirstMatch`. `FirstMatchRepository.findCurrent` devuelve como máximo una fila, pero la interfaz aprobada no impone ese límite a futuras fuentes. Una proyección independiente de fuente evita acoplar las pantallas al nombre del modelo y no requiere una tabla general especulativa.

**Alternatives considered**: Crear ahora `Match` general o filas de ejemplo (fuera de alcance); consumir el `GET` del responsable (autorización equivocada); marcar `LOADED` como análisis terminado (sin contrato). Se descartan.

## 4. Clasificación temporal y disponibilidad honesta

**Decision**: Interpretar `matchDate` y `matchTime` como valores locales de `America/Bogota`, sin tratarlos como UTC ni usar la zona del dispositivo. En cada lectura, comparar ese par con el reloj actual formateado en la misma zona. `WAITING` con horario futuro es `UPCOMING`; en el instante igual o posterior es `PENDING` hasta carga válida. `LOADED` y `CANCELED` no integran esos contadores; `COMPLETED` solo existirá cuando una futura fuente aprobada confirme análisis. Un ID se agrega una vez por categoría. Aplicar la misma regla a partidas posteriores con estado autoritativo equivalente.

**Rationale**: El contrato de Feature 009 almacena `@db.Date` y hora local `HH:mm`; la decisión del propietario fija `America/Bogota`. Comparar cadenas normalizadas de fecha/hora locales evita interpretar `@db.Date` como instante UTC del encuentro. El backend debe proveer un reloj inyectable para tests justo antes, en y después del límite; el cliente nunca decide la categoría.

**Alternatives considered**: `new Date(matchDate + matchTime)` con zona del navegador (varía por dispositivo), o clasificar por día solamente (pierde el límite horario). Se descartan.

## 5. Entrada, datos efímeros y diseño

**Decision**: Integrar rutas de Analista en Expo Router y actualizar la política de destino/ruta autenticada para que permitan Inicio/Pasaportes/Partidos solo al contexto de sesión pertinente; mantener al backend como autoridad definitiva. Estado cliente por vista/selección, sin persistir detalles protegidos; limpiar en `401/403/404`, pérdida de sesión/rol y cambio de contexto. Cada regreso o recarga solicita datos actuales. Reutilizar componentes/tokens visuales existentes para reproducir la composición de los seis PNG aprobados identificados por nombre en `spec.md` y conservados fuera del repositorio; escritorio usa navegación lateral y móvil barra inferior con áreas seguras. Los nombres y cifras de ejemplo no son datos.

**Rationale**: `authenticated-route-policy.ts` actualmente redirige cualquier ruta autenticada ajena a `/passports`, por lo que la nueva entrada requiere integración explícita. `apps/frontend/app/_layout.tsx` contiene un cambio ajeno que no se debe modificar. Los seis PNG muestran tres secciones/vistas y navegación responsive, pero también acciones no respaldadas por datos.

**Alternatives considered**: Usar `/passports` como único espacio del Analista (no entrega Inicio ni Partidos); copiar tarjetas ficticias de las imágenes; mantener detalles en almacenamiento local. Se descartan.

## Verificación y riesgos residuales

- Las pruebas de contrato validarán respuesta mínima, estados, `no-store`, error seguro y ausencia de métodos de escritura.
- Integración PostgreSQL con fixtures sintéticos validará custodia propia/ajena, rol/identidad revocados, `ACTIVE`, espera/reagendamiento/cancelación/carga, no mutación y clasificación exacta `America/Bogota`. Ejecutar suites DB secuencialmente en una base aislada, siguiendo el patrón de `apps/backend/test/integration/run-feature-009-foundation.mjs`, sin aplicar migraciones a la base de trabajo.
- Las pruebas frontend cubrirán navegación, restauración, limpieza de datos, estados no exitosos y ausencia de controles ficticios. La comparación visual y accesibilidad requieren ejecución web autenticada real en escritorio/viewport móvil; unit tests o exportación web no son evidencia visual suficiente.
- La autorización del nombre elimina la antigua discrepancia de referencia enmascarada como título. Los nombres de ejemplo de las imágenes siguen siendo ilustrativos; se presenta solo el nombre real del pasaporte autorizado. El contacto de trabajo puede estar disponible en el detalle si la persona autorizada se identifica inequívocamente y sus canales están registrados.

## 6. Contacto de trabajo: regla aprobada y fuentes existentes

**Hechos inspeccionados**: Feature 005 separa contacto de cuenta de identidad privada del jugador y afirma que la relación de representante no copia el contacto. `AuthenticationCredential.normalizedEmail` pertenece a una `Identity`. Feature 006 conserva `RegistrationRequestApplicant.encryptedEmail/encryptedPhone` y `RegistrationRequestRepresentative.encryptedPhone`; exige teléfono del representante de menor y del responsable de academia, pero el adulto propio puede omitir teléfono. `PassportResponsibility` identifica `SELF`, `LEGAL_REPRESENTATIVE` o `ACADEMY`, no el canal preferido. La academia puede tener varios `AcademyMembership` activos; un menor presentado por academia no recibe cuenta propia ni necesariamente cuenta del representante. `Academy` no tiene contacto único.

**Decisión del propietario**: Para origen personal adulto, identificar al adulto con responsabilidad `SELF` actual; para personal de menor, la identidad con responsabilidad `LEGAL_REPRESENTATIVE` actual; para origen academia, el responsable actual de `originAcademyId`, sin sustituirlo por el presentador del jugador, una cuenta adicional ni, en menor de academia, el representante legal. Mostrar teléfono y correo disponibles de esa misma persona sin precedencia; no copiar contacto del menor. Si falta persona única o relación vigente, no exponer ningún canal.

**Lectura de fuentes**: La cuenta activa de la persona puede aportar `AuthenticationCredential.normalizedEmail`. Un teléfono puede estar en `RegistrationRequestApplicant.encryptedPhone` (titular, representante de solicitud personal o responsable de la solicitud aprobada de creación de academia); `RegistrationRequestRepresentative.encryptedPhone` existe para menor presentado por academia, pero **no** es la fuente del contacto autorizado para ese origen. Vincular cualquier teléfono a la identidad elegida y a una solicitud aprobada inequívoca; no tomar el primero/último ni mezclar canales de personas distintas. En origen academia, la solicitud aprobada de creación vincula al responsable inicial con la academia y con una membresía; comprobar que su identidad, rol y membresía siguen vigentes. Las solicitudes aprobadas de cuenta adicional no designan responsable. `Academy` no conserva un campo de responsable actual ni un teléfono único: ante transferencia, ausencia o varios candidatos no resueltos por hechos autoritativos, devolver «Contacto no disponible».

**Límite de datos residual**: Un pasaporte creado fuera de las rutas de registro puede tener cuenta sin teléfono aprobado atribuible; se muestra solo el correo disponible. La base no garantiza actualización del teléfono capturado en una solicitud ni modela una designación general de nuevo responsable de academia. Esto no cambia el destinatario aprobado: un canal ausente se omite y una persona ambigua no se sustituye. Una futura actualización de contacto o transferencia requerirá su propio hecho autoritativo, no inferencia en Feature 010.
