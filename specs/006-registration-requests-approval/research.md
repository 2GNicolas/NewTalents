# Research: Solicitudes de registro y aprobación

## 1. Almacenamiento documental privado

**Decision**: `PrivateEvidenceStore` con `put`, `openStream`, `delete` y `exists`. Desarrollo usa filesystem privado; producción un adaptador S3-compatible con bloqueo público y cifrado.

**Rationale**: evita bytes/base64 en PostgreSQL, permite streaming y reemplazo de proveedor. S3 cifra objetos nuevos en reposo y Block Public Access impide exposición pública.

**Alternatives rejected**: bytes en PostgreSQL; URLs públicas/presignadas; MinIO obligatorio local, que añadiría infraestructura innecesaria al puerto.

**Primary sources**: [S3 encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/serv-side-encryption.html), [S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html).

## 2. Eliminación y verificación

**Decision**: eliminar clave opaca idempotentemente y verificar ausencia. Con versionado, producción debe eliminar versiones; un delete marker no satisface la verificación.

**Rationale**: `DeleteObject` cambia con versionado; el adaptador responde `verifiedAbsent` solo sin bytes recuperables. El SDK ofrece waiters de ausencia.

**Alternatives rejected**: marcar solo DB; confiar en el primer DELETE; proceso infinito.

**Primary sources**: [S3 DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html), [AWS SDK v3 S3 examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html).

## 3. Análisis antimalware

**Decision**: puerto `EvidenceMalwareScanner` con ClamAV `clamd`/`INSTREAM`; timeout/error/ausencia dejan cuarentena y bloquean presentación/revisión.

**Rationale**: `INSTREAM` acepta contenido por socket sin ruta compartida. El límite debe ser coherente con `StreamMaxLength`.

**Alternatives rejected**: omitir análisis; shell sobre nombres suministrados; fail-open.

**Primary sources**: [ClamAV clamd protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html), [ClamAV scanning](https://docs.clamav.net/manual/Usage/Scanning.html).

## 4. Selección de archivos Expo

**Decision**: `expo-document-picker` compatible con SDK 57; referencias locales solo para upload inmediato y limpieza al presentar, salir o abandonar.

**Rationale**: API compartida web/nativa; las referencias son estado efímero, no persistencia.

**Alternatives rejected**: base64 persistido; URI local en historial/rutas.

**Primary source**: [Expo DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/).

## 5. Concurrencia transaccional

**Decision**: runner Prisma existente con `Serializable`, reintentos acotados `P2034`, `expectedVersion` e idempotency key.

**Rationale**: PostgreSQL puede abortar serializable y exige reintentar la transacción completa; unicidad se protege además con restricciones/huellas.

**Alternatives rejected**: check-then-write en Read Committed; retry ilimitado; lock distribuido.

**Primary sources**: [Prisma transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions), [PostgreSQL isolation](https://www.postgresql.org/docs/18/transaction-iso.html).

## 6. Contrato HTTP

**Decision**: OpenAPI 3.1.0, siete payloads explícitos, versión optimista, metadata sin bytes, fronteras separadas y conflictos no enumerables.

**Rationale**: composición tipada evita payload abierto. Multipart solo carga evidencia; visor usa stream binario.

**Alternatives rejected**: mapa `fields`; base64; conflicto detallado.

**Primary source**: [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0).

## 7. Expediente–eliminación–aprobación

**Decision**: registrar confirmación e intención sobre la versión presentada, retirar acceso, eliminar/verificar mediante trabajo acotado y materializar outcomes + `APPROVED` en transacción serializable. Rechazo final retira acceso e inicia eliminación. Fallos quedan recuperables.

**Rationale**: PostgreSQL y objetos no comparten ACID. Mantener la aprobación no-final evita acceso prematuro y estado aprobado con archivos recuperables.

**Alternatives rejected**: aprobar antes de borrar; borrar sin intención durable; plataforma genérica de workflow.

## Resolved defaults

- PDF, JPEG y PNG; extensión, MIME y firma real.
- 10 MiB por archivo y 40 MiB por solicitud, configurables de forma más restrictiva.
- Cinco intentos automáticos; luego `RECOVERY_REQUIRED` y reintento administrativo auditado.
- Scanner obligatorio y fail-closed.
- Solo canarios sintéticos en pruebas; nunca documentos reales.
