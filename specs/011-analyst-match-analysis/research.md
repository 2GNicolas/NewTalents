# Investigación y decisiones: carga de datos del partido

La especificación aprobada (`spec.md`) gobierna el alcance. Se inspeccionaron el contrato `specs/009-first-match-flow/contracts/analyst-load-boundary.md`, el puerto existente `ConfirmedLoadService`, el lector de Feature 010, el esquema Prisma, el documento funcional y los dos documentos `docs/fem`. La guía manual de FEM es una fuente de términos de captura; sus puntos, multiplicadores y matrices pendientes no son validación ni cálculo de esta entrega.

## D1. Frontera de carga y transición operativa

- **Decisión**: Feature 011 posee la captura y su constancia inmutable. Para `FIRST_MATCH`, crea la constancia y los eventos en una transacción PostgreSQL serializable y llama dentro de ella a `confirmFirstMatchDataLoad`, cuyo `verifyConfirmedData` relee la constancia del mismo `matchId` y `loadId` por la misma transacción. Un fallo revierte ambos efectos.
- **Razón**: El puerto de Feature 009 ya exige prueba duradera, versión esperada y bloqueo del pasaporte; un booleano del cliente no satisface el contrato. Conservar la misma unidad `RESERVED → USED` evita doble consumo.
- **Alternativas descartadas**: dos transacciones con compensación (permiten estado parcial); llamada HTTP interna o transición directa de `FirstMatch` (eluden el puerto y sus comprobaciones); usar `LOADED` como prueba de evaluación (falso).
- **Detalle de carrera**: el propietario de la transacción toma el bloqueo del pasaporte antes de leer la versión/custodia actual; el puerto conserva su propio bloqueo compatible. Reagendamiento o cancelación ganadores fuerzan conflicto y rollback de la carga. Una confirmación ganadora impide mover/liberar `USED`.

## D2. Idempotencia y datos confirmados

- **Decisión**: una intención UUID estable y un digest canónico de partido, versión esperada, participación, total, URL y secuencia de eventos definen el reintento. La fila de carga tiene unicidad por partido y por `loadId`; eventos pertenecen a esa carga y no hay fila de borrador persistente. El reintento idéntico consulta y devuelve la misma constancia; mismo `loadId` con digest distinto o nueva intención tras confirmar devuelve conflicto. El reintento también revalida autoridad antes de devolver hechos protegidos.
- **Razón**: Feature 009 trata `loadId` como identidad opaca y su rama `LOADED` idempotente no vuelve a ejecutar `verifyConfirmedData`; el propietario de Feature 011 debe verificar digest y constancia antes de invocarla o devolver un resultado.
- **Alternativas descartadas**: nueva carga por cada reintento; deduplicar solo por URL o por estado `LOADED`.

## D3. Forma de los datos deportivos

- **Decisión**: catálogo versionado de tipos/variantes/resultados de `spec.md` FR-004/005, no valores manuales. Cada evento lleva minuto observable del video, periodo/añadido cuando se distingue, cinco contextos presentes y siete criterios de complejidad con distinción `OBSERVED`, `NOT_OBSERVABLE`, `NOT_APPLICABLE` solo para complejidad. El total de minutos jugados es entero separado de las marcas de evento; `PARTICIPATED` exige total positivo y eventos, `DID_NOT_PARTICIPATE` exige cero y ninguno.
- **Razón**: es la menor evidencia reutilizable por un FEM futuro sin imponer las matrices 3.1/4.2 ni calcular aportes. El minuto 90+ puede existir y no es duración jugada.
- **Alternativas descartadas**: derivar minutos totales del último evento, exigir un evento al no participante, usar `0` para no observable, almacenar puntos/ratings.

## D4. Enlace audiovisual y privacidad

- **Decisión**: el Analista introduce en el paso final una URL HTTPS con identificador de video de un host propio `youtube.com` o `youtu.be`. Validar URL estructural y host exacto/subdominio propio, no hacer consulta a YouTube para confirmar disponibilidad. Conservar el enlace en la carga autorizada; no copiarlo a respuestas del responsable, pasaporte público o Feature 010.
- **Razón**: el documento funcional RF-VID-02 ahora distingue administración organizativa e introducción por el Analista. La URL no prueba que el contenido sea el partido; el Analista declara su atribución. No se necesita integrar un servicio externo ni descargar video.
- **Alternativas descartadas**: mera búsqueda textual de `youtube.com` (admite dominios imitadores); publicación automática; llamada al proveedor como condición de consistencia transaccional.

## D5. UX, lectura y autorización

- **Decisión**: partir del detalle de Partidos de Feature 010 hacia un flujo propio de captura, revisión y paso final. Cliente efímero conserva entradas ante errores de validación, pero borra todo al perder sesión, rol o custodia. Backend revalida identidad activa, rol/perfil, pasaporte `ACTIVE`, custodia actual y vínculo del partido en cada lectura y confirmación; ID ajeno/inexistente obtiene la misma respuesta mínima. `Cache-Control: no-store` en lecturas y escritura.
- **Razón**: navegación cliente no es permiso y la lectura existente de Feature 010 ya ofrece contexto de partido sin exponer datos de captura. Un `LOADED` histórico sin carga de Feature 011 sigue siendo solo estado operativo.
- **Alternativas descartadas**: reutilizar DTO administrativo, caché persistente de borrador, habilitar captura para fuentes futuras sin puerto de confirmación.

## D6. Verificación y escala

- **Decisión**: pruebas unitarias de catálogo/validación/estado; contratos HTTP de minimización y errores; integración PostgreSQL aislada y secuencial de atomicidad, reintentos y carreras; frontend por ruta y verificación autenticada web de escritorio/viewport móvil, teclado, foco y árbol accesible. Acotar el tamaño del cuerpo en transporte con el mecanismo habitual del servidor; no introducir una cuota deportiva de eventos ni un máximo de minutos no aprobado.
- **Razón**: el riesgo principal es privacidad y consistencia transaccional, no rendimiento algorítmico. El repositorio ya dispone de un patrón de runner PostgreSQL temporal de Feature 010.
- **Alternativas descartadas**: afirmar atomicidad con mocks únicamente, compartir base temporal en paralelo, tratar typecheck como evidencia visual.

## D7. Captura guiada y límite del guardado local

- **Decisión (actualizada 2026-10-20)**: mantener separado un evento en edición de la colección efímera «Eventos capturados». El botón circular abre la rueda; Gol y Asistencia no muestran resultado y guardan tras minuto válido. Un `FAILURE` explícito guarda tras minuto válido sin guía ni detalle de atajada. Los demás resultados completan cinco contextos y siete criterios mediante elecciones explícitas, con corrección desde progreso; la atajada no fallida exige detalle. «Guardar evento» aparece al completar solo los requisitos aplicables, agrega o actualiza la colección local y devuelve al botón circular. No hay campo de observación ni «Añadir otro evento» en esta UI. La observación sigue siendo campo opcional de API para compatibilidad. La participación se decide en captura sin poder borrar eventos guardados; es de solo lectura en datos finales. Solo la confirmación final envía la colección.
- **Razón**: FR-018/019 y SC-006 distinguen una acción puntual aún en edición, un evento guardado localmente y la carga duradera del partido. La observación, si se escribe, pertenece al evento y al digest de la confirmación, no a una nota o puntuación FEM.
- **Alternativas descartadas**: formulario plano y agregado automático del borrador a la lista (estado de la UI parcial, no comportamiento aprobado); deslizador o arrastre sobre rieles ilustrados; seleccionar `NOT_OBSERVABLE` por defecto, inferir contexto/complejidad de otro grupo o persistir cada «Guardar evento».
- **Correcciones**: cerrar la rueda sin elegir no crea tipo; cambiarlo exige corregir un resultado incompatible, sin derivar uno nuevo. Corregir un grupo desde progreso conserva las otras respuestas. La selección y el progreso deben operar también con teclado, foco y nombres accesibles en web y con toque en móvil. Las cuatro referencias visuales adicionales son orientación; texto y reglas aprobadas prevalecen sobre segundos, porcentajes o controles dibujados.

No queda `NEEDS CLARIFICATION` para planificar. Contratar una fuente posterior, una evaluación FEM completada o publicación del enlace requiere otra decisión y otro alcance.
