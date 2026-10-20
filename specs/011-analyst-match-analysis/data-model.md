# Modelo de datos: carga confirmada del partido

Este diseño corresponde a `spec.md` FR-001–019 y a `research.md`. Las entidades persistentes son **propuestas para implementación**, no tablas existentes; el estado de la guía es exclusivamente cliente. Feature 009 conserva la propiedad de `FirstMatch` y de la unidad de Feature 008; Feature 010 conserva su proyección de «Análisis realizados» indisponible hasta que exista una fuente de evaluaciones completadas.

## Fuente de partido habilitada

Hoy solo `FirstMatch` es escribible por este flujo. `firstMatchId` identifica la fila existente, de la cual se derivan `passportId` y `playerId`; no se aceptan esas identidades del cuerpo del cliente como autoridad. Se exige `WAITING/RESERVED` y versión vigente para una carga inicial; `LOADED/USED` solo admite el reintento idéntico ya confirmado. `CANCELED/RELEASED`, otro pasaporte, ausencia de custodia o fuente futura no contratada no admiten captura.

La interfaz de aplicación puede consultar fuentes por `(sourceKind, matchId)`, pero el único `sourceKind` registrable es `FIRST_MATCH`. Una fuente posterior requiere su propio vínculo persistente, verificación duradera y puerto de transición; no se agrega una fila polimórfica sin integridad referencial para anticiparla.

## Carga de partido confirmada (`AnalystMatchUpload`)

| Campo | Regla |
|---|---|
| `loadId` | UUID opaco, clave primaria e intención estable para Feature 009. |
| `firstMatchId` | FK a `FirstMatch`, único: máximo una carga confirmada por primer partido. |
| `analystIdentityId` | FK a la identidad que confirmó. No confiere acceso histórico tras revocación. |
| `expectedMatchVersion` | Versión `WAITING` enviada desde el contexto leído y revalidada al confirmar. |
| `intentDigest` | SHA-256 de representación canónica de partido, versión y contenido completo; identifica reintento idéntico. No se expone al cliente. |
| `participation` | `PARTICIPATED` o `DID_NOT_PARTICIPATE`. |
| `totalMinutesPlayed` | Entero no negativo; `> 0` con participación y eventos, `0` sin participación ni eventos. Incluye tiempo añadido, sin tope fijo de 90. |
| `youtubeUrl` | URL HTTPS de video YouTube validada, límite técnico de longitud documentado en contrato; no se publica automáticamente. |
| `confirmedAt` | Instante de confirmación del servidor; no equivale a evaluación FEM terminada. |

Una carga solo se inserta tras validación integral dentro de la transacción que llama al puerto Feature 009. No hay estado persistente `DRAFT`, carga parcial ni sobrescritura posterior en este alcance. Se puede reforzar la coherencia de participación/minutos mediante una restricción de base; la existencia de eventos y la semántica de la URL se validan en la aplicación antes de confirmar.

## Evento observable (`AnalystMatchEvent`)

| Campo | Regla |
|---|---|
| `id`, `loadId`, `sequence` | UUID de evento, FK a carga, secuencia estable única por carga. Sin evento huérfano. |
| `eventType`, `variant`, `result` | Catálogo FR-004/005: variante/resultados permitidos o ausencia explícita de resultado. No hay puntos. |
| `videoMinute`, `period`, `addedTime` | Referencia del video, no hora del dispositivo ni duración jugada. Periodo/añadido se conservan si son discernibles; no se deduce total a partir de ellos. |
| `context` | Para resultados medidos, objeto versionado con exactamente cinco grupos: espacial, temporal, competitivo, presión y posicional. Cada grupo es observación o `NOT_OBSERVABLE`; nunca `NOT_APPLICABLE`. Para Gol, Asistencia y resultado `FAILURE` es `{}`. |
| `complexity` | Para resultados medidos, objeto versionado con siete criterios de FR-009. Cada criterio conserva valor observado, `NOT_OBSERVABLE` o `NOT_APPLICABLE` de modo inequívoco. Para Gol, Asistencia y resultado `FAILURE` es `{}`; no almacena peso, multiplicador ni nota. |
| `goalkeeperDetail` | Solo para atajada no fallida: mano usada y mano cambiada cuando corresponda, con ausencias explícitas. Una atajada `FAILURE` lo omite. No introduce factor numérico. |
| `observation` | Texto opcional vinculado solo al evento. Ausencia o vacío no impiden guardar; si se consigna, forma parte del contenido confirmado y del digest. Privado, sin publicación ni interpretación FEM. |

Los objetos descriptivos pueden persistirse como JSONB validado y versionado por contrato; los campos de identidad, pertenencia, orden y estado permanecen relacionales. No se aceptan claves de evaluación, rating, aporte, cálculo ni estadísticas publicadas. Los valores de catálogo exactos se enumeran en el contrato HTTP y se prueban contra la guía de captura aprobada por `spec.md`, no contra sus tablas de puntuación.

## Estado efímero del cliente, no entidad persistente

- **Evento en edición**: selección de tipo/variante, resultado cuando aplica, minuto y, solo en resultados medidos, respuestas por grupo y detalle de atajada. La UI actual no ofrece observación textual; el campo opcional de API se mantiene para compatibilidad. Un grupo sin elección puede representarse localmente como `UNSET`; nunca se envía como respuesta confirmada ni se rellena por defecto. La rueda abierta/cerrada y el grupo activo son estado de presentación, no datos deportivos.
- **«Eventos capturados»**: colección local de eventos completados por «Guardar evento». Guardar o corregir actualiza esa colección sin HTTP ni transición de Feature 009; desplegar/contraer no cambia los datos. El evento en edición no cuenta como guardado. El paso de revisión lee esta colección.
- **Confirmación final**: solo el envío íntegro tras participación decidida en captura y el paso de minutos/URL crea `AnalystMatchUpload` y `AnalystMatchEvent`. La observación opcional de clientes históricos viaja si existe; la UI actual no la captura. El digest de reintento cubre el contenido real, incluida cualquier observación consignada.
- **Privacidad**: corrección y errores de validación conservan estado local mientras haya autoridad; revocación o cambio de contexto lo borran. No se promete borrador recuperable tras recarga.

## Transición y reintentos

```text
FirstMatch WAITING/RESERVED + captura válida + custodia vigente
  -- una transacción serializable: insertar carga/eventos;
     verifyConfirmedData(firstMatchId, loadId); confirmFirstMatchDataLoad -->
FirstMatch LOADED/USED + carga confirmada inmutable
```

- En la transacción, bloquear primero el pasaporte y revalidar identidad `ACTIVE`, rol `ANALYST`, perfil operativo, pasaporte `ACTIVE`, custodia actual, vínculo del partido y versión. Una validación fallida no persiste carga/eventos y no cambia Feature 009.
- La verificación del puerto lee la carga persistida en **esa misma transacción** por `firstMatchId` y `loadId`. No basta un cuerpo HTTP, un estado cliente ni `LOADED` histórico.
- Mismo `loadId` y mismo digest: respuesta idempotente después de revalidar acceso y constancia. Mismo `loadId` con digest distinto o carga de otra intención: conflicto sin efectos. Después de revocación, tampoco el reintento revela la carga.
- Si cancelación/reagendamiento gana la carrera, la versión/estado falla y se revierte la carga; si la carga gana, la unidad `USED` no se libera ni se mueve. La fecha local vigente es la de Feature 009; no se crea unidad nueva.
- La custodia revocada posteriormente no borra el hecho histórico ni revierte `USED`, pero bloquea lecturas del contenido en el siguiente acceso.

## Proyecciones

- **Captura autorizada**: identidad y versión vigentes del partido, estado `WAITING` y, si corresponde, carga confirmada con eventos (incluida observación opcional), participación, total y URL. Solo Analista con custodia actual; `no-store` y denegación indistinguible para ID ajeno/inexistente.
- **Responsable/Feature 009**: únicamente el estado y detalles operativos ya permitidos. Nunca URL, evento, minuto, complejidad ni identidad del Analista por esta nueva relación.
- **Feature 010 Inicio**: `LOADED` y esta constancia **no** son evaluación completada. «Análisis realizados» sigue `UNAVAILABLE` sin fuente independiente de evaluaciones efectivamente terminadas.
