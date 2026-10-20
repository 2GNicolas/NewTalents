# Quickstart de verificación: carga de datos del partido

Guía **para después de implementar** Feature 011. No constituye evidencia de ejecución. Contrastar con `spec.md`, `data-model.md` y los contratos `contracts/analyst-match-upload.openapi.yaml` y `contracts/analyst-match-upload-ui.md`.

Las referencias aprobadas se conservan fuera del repositorio en `C:\Proyectos\NewTalents-Approved-Visual-References\Feature-011\captura\`: `Analyst Match Event Capture-1.png`, `Mobile match event capture-2.png`, `Review and correct match events-3.png`, `Analyst event review and correction-4.png`, `Final minutes and YouTube link validation-5.png`, `Final Match Data Validation-6.png`, `Confirmed Match Data Upload-7.png` y `Match Data Upload Confirmed-8.png`. Consultar `verification/design-reference-inventory.md` para SHA-256 y dimensiones. No se copian al proyecto ni se usan sus jugadores, fechas, conteos o URL de ejemplo como fixtures reales.

La interacción de captura dispone además de `Circular event capture, initial screen.png`, `Radial event wheel overlay.png`, `Filtered pass guided temporal measurement-1.png` y `Guided precision measurement fader-2.png` en esa ubicación externa. Comparar la composición sin tratar rieles como deslizadores arrastrables ni adoptar segundos o valores ilustrativos; los cinco tramos porcentuales de Temporal están enumerados en FR-006 y proceden de la guía FEM consultada localmente, que no forma parte del repositorio. FR-018/019 y SC-006 son la autoridad de interacción. La duración reglamentaria real y el cálculo automático del tramo quedan para una característica futura. Dos PNG de captura/revisión no están disponibles para comparación; ver `verification/visual-review.md`.

## Preparación

1. Verificar Node 24/npm 10 y PostgreSQL local de pruebas. Crear una base **aislada, temporal**; aplicar migraciones existentes y la nueva migración Feature 011 únicamente allí. Seguir el patrón de `apps/backend/test/integration/run-feature-010-workspace.mjs`, con nombre/limpieza exclusivos de Feature 011. Ejecutar suites que comparten PostgreSQL **secuencialmente**; no tocar la base normal.
2. Preparar solo identidades y partidos sintéticos: Analista vigente y revocado; pasaporte `ACTIVE` propio, ajeno y sin custodia; `FirstMatch` `WAITING/RESERVED`, reagendado, cancelado y `LOADED/USED` histórico sin carga Feature 011. Incluir partido con evento en minuto 90+ y total jugado >90, suplente con evento tardío y total menor que el minuto del evento, y «no participó» con total cero. Ningún partido posterior simulado.
3. El video no debe requerir disponibilidad real: usar URL de YouTube sintácticamente válida y un identificador de prueba, sin publicar ni consultar al proveedor. No usar datos personales reales ni introducir valores/rating de la guía FEM.

## Comandos previstos

Desde la raíz, después de crear las suites restantes durante implementación:

```powershell
npm run verify:toolchain
npm run typecheck
Push-Location apps/backend
try { node test/integration/run-feature-011-match-upload.mjs } finally { Pop-Location }
npm run test:backend:contract
npm run test:frontend
git diff --check
```

El runner Feature 011 y las suites enfocadas ya están implementados. Esta guía prescribe comprobaciones, no constituye por sí sola evidencia de ejecución; los resultados históricos y los límites de la aceptación web están en `verification/`. El runner se invoca desde `apps/backend` para cargar su `.env` local y usa exclusivamente una base temporal propia; al finalizar debe haberla eliminado sin afectar otras bases.

## Matriz de aceptación

| Área | Caso | Resultado esperado |
|---|---|---|
| Autoridad | Abrir ruta directa y confirmar con identidad/rol/perfil válidos, custodia propia, ajena o revocada; IDs ajeno/inexistente | Solo pasaporte `ACTIVE` y partido propio con rol/perfil vigentes. `401/403/404` seguros, ajeno e inexistente indistinguibles; no se filtra URL/evento ni por respuesta ni por caché. |
| Flujo | Capturar dos eventos con minutos del video, cinco contextos y complejidad; revisar; regresar y corregir; pasar a total y enlace | Orden de etapas efectivo, datos fieles y conservados durante corrección. No hay campo de puntos, valoración, rating o aprobación. |
| Rueda y elección | Abrir/cerrar sin elegir; elegir tipo, ver botón restituido y «Cambiar»; cambiar tipo con resultado incompatible | Ningún tipo se inventa ni se crea evento adicional; resultado incompatible exige nueva elección, no conversión inferida. Rueda utilizable con toque, teclado y foco que regresa al botón. |
| Guía y progreso | Para eventos medidos, elegir explícitamente resultado, cinco contextos y siete criterios mediante una fila rotulada reutilizable; volver a corregir un grupo | Cada elección avanza un grupo y conserva las demás. No hay opción predeterminada, `NOT_APPLICABLE` de contexto, arrastre, deslizador ni cálculo FEM. Temporal conserva los cinco tramos porcentuales aprobados para elección manual o «No observable»; no se infiere del minuto del video. Progreso y estado de selección accesibles en escritorio/móvil. |
| Guardado local | Guardar Gol/Asistencia tras minuto válido, `FAILURE` tras resultado y minuto, y éxito medido tras la guía; expandir «Eventos capturados» y corregir uno | No hay campo de observación ni «Añadir otro evento» en la UI. Lista local desplegable bajo formulario; corrección actualiza sin duplicar y guardar devuelve al botón circular. Guardar no hace `POST`, no crea carga duradera ni cambia `WAITING/RESERVED`. |
| Catálogo | Probar todos los tipos/resultados FR-004/005, pase normal/filtrado, atajada con mano y datos no observables/inaplicables | Solo pares permitidos; eventos sin resultado no reciben éxito/fallo; los cinco contextos nunca son `NOT_APPLICABLE`; matriz de complejidad pendiente no impone puntuación ni combinación.
| Participación/minutos | Participante sin evento, total cero/fraccionario/negativo/ausente; no participante con evento o total positivo; entero 90+, tiempo añadido, suplente con evento posterior a total | Rechazo de contradicciones sin pérdida de entradas; 90+ válido cuando se declara, total no inferido ni limitado por marca del evento; no participante cero y sin eventos.
| URL | HTTPS YouTube/video con ID; enlace ausente, portada, dominio impostor, otro host, URL mal formada | Solo URL válida permite confirmar, sin llamada a YouTube. Error conserva eventos, participación, minutos y URL para corregir. No se publica automáticamente.
| Atomicidad | Confirmar primer partido `WAITING/RESERVED`, comprobar constancia y Feature 009; forzar fallo después de escribir constancia pero antes de completar puerto | Éxito deja exactamente una carga y `LOADED/USED` de la misma unidad; fallo revierte ambos. No queda evento huérfano ni cambia cupo en intento inválido.
| Reintentos/carreras | Repetir mismo UUID+cuerpo; mismo UUID+cuerpo distinto; otra intención; competir con cancelación, reagendamiento y revocación | Idempotencia sin duplicados; conflicto seguro y rollback cuando cambia intención/versión; un solo ganador bajo bloqueo. Custodia revocada niega nueva lectura aunque haya carga histórica.
| Separación | Consultar estado de responsable, pasaporte, Inicio Feature 010 y detalle privado tras carga | Responsable solo ve estado operativo; URL/eventos/minutos/contexto/Analista no públicos; `LOADED` y carga no crean «Análisis realizados» ni evaluación FEM. |

## Revisión web y móvil

Levantar API y web con los comandos locales existentes (`npm run dev:backend`, `npm run dev:frontend:web`), autenticar un Analista sintético y recorrer Partidos → detalle → captura guiada → revisión → paso final → confirmación a tamaños escritorio y viewport móvil. Verificar Gol/Asistencia sin control de resultado ni guía, `FAILURE` sin guía, éxito medido con avance/corrección, guardado local múltiple y retorno al botón circular sin «Añadir otro evento» ni observación textual. Verificar participación elegida en captura, bloqueada para «No participó» cuando hay eventos, y de solo lectura en datos finales. Verificar teclado, foco visible, nombres/roles en árbol accesible, scroll/área segura/teclado móvil, carga, vacío, validación, error, conflicto, restricción, indisponibilidad y éxito. La validación conserva datos; la revocación los elimina incluso en retorno/enlace guardado. No usar tests unitarios o export web como sustitutos de la ruta real. Registrar resultados pasados/fallidos/no verificados por US1–US3, FR-001–019 y SC-001–006; no afirmar presencia de FEM, partidos posteriores o publicación.

Comparar cada etapa con sus PNG externos indicados arriba, incluidas las cuatro referencias de captura guiada, sin afirmar fidelidad exacta ni importar imágenes como assets. Documentar diferencias visuales y de accesibilidad en `verification/visual-review.md`; prevalecen las reglas de `spec.md` y los contratos cuando una ilustración muestre datos o controles no aprobados.
