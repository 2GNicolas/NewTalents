# Revalidación manual: usabilidad de formularios

**Fecha:** 2026-09-29
**Resultado:** PARCIAL. Los siete tipos fueron recorridos en navegador real en escritorio y ancho móvil, pero solo `PERSONAL_ADULT` completó el envío real de extremo a extremo. Los otros seis no se declaran aceptados de extremo a extremo por cobertura automatizada ni por validación de pasos vacíos.

## Cambios verificados

- Los pasos bloquean el avance cuando falta información obligatoria, muestran errores en español y enfocan el primer control inválido según el orden visual.
- Tipo y número de documento se validan conjuntamente para `CC`, `TI`, `RC`, `CE` y pasaporte; las cédulas antiguas de 3 a 8 dígitos siguen siendo válidas.
- La fecha usa y exige `YYYY-MM-DD`, y rechaza fechas imposibles o futuras.
- País queda fijado en Colombia (`CO`) y municipio usa código DIVIPOLA estable con selector DANE buscable y operable por teclado.
- Las evidencias muestran `Falta seleccionar`, `Seleccionado para enviar`, progreso, escaneo, `CLEAN` o error. Se comprobó quitar y reemplazar antes del envío. Las revisiones conservan el estado real de la cola en lugar de presentar falsamente documentos ausentes.
- Frontend, DTO y servicios backend aplican las mismas restricciones de persona, ubicación, fecha, documento, declaraciones y evidencias requeridas por tipo.

Fuentes del catálogo y reglas: DANE DIVIPOLA MGN 2025 (1.122 municipios) y categorías/reglas públicas de identificación de la Registraduría Nacional.

## Evidencia de navegador

Rutas normales, sin `?preview=`:

| Tipo | Escritorio | Móvil 390×650 | Alcance |
|---|---|---|---|
| `PERSONAL_ADULT` | PASS | PASS | Envío real completo, teclado DIVIPOLA, quitar/reemplazar y ClamAV |
| `REPRESENTED_MINOR` | PASS | PASS | Bloqueo y errores de pasos obligatorios |
| `FORMAL_ACADEMY` | PASS | PASS | Bloqueo, foco y campos oficiales |
| `NATURAL_PERSON_ACADEMY` | PASS | PASS | Bloqueo, foco y campos oficiales |
| `ADDITIONAL_ACADEMY_ACCOUNT` | PASS | PASS | Bloqueo, foco y evidencias por categoría |
| `ACADEMY_ADULT_PLAYER` | PASS | PASS | Bloqueo, foco y declaraciones separadas |
| `ACADEMY_MINOR_PLAYER` | PASS | PASS | Bloqueo, foco y datos separados de menor/representante |

Solicitud sintética completa: `e2c9bb5c-1dca-483b-ad79-63ecdf165d0e`, estado `SUBMITTED`, versión `1`; `IDENTITY_FRONT=CLEAN` e `IDENTITY_BACK=CLEAN`. No se registran credenciales ni contenido documental.

La comparación de las pantallas afectadas conservó la jerarquía, paneles, progreso, columnas y adaptación móvil de las referencias aprobadas. Los nuevos mensajes y selectores se integraron dentro de esos componentes sin cambiar la dirección visual.

## Verificación automatizada enfocada

- Frontend Jest: 9 suites, 73 pruebas, PASS.
- Backend Vitest: 10 archivos, 55 pruebas, PASS.
- Typecheck frontend/backend: PASS.
- Expo web export: PASS, 64 rutas estáticas.

## Siguiente comprobación manual

Completar y enviar, con archivos sintéticos, cada uno de los otros seis tipos y verificar sus categorías `CLEAN` y su estado `SUBMITTED`. Hasta entonces no se declara aceptación manual completa de los siete recorridos.

## Normalización compartida posterior — 2026-09-29

**Resultado:** PASS para los comportamientos de formulario solicitados; la aceptación integral de los siete outcomes continúa PARCIAL por el alcance indicado arriba.

- Se documentó la cobertura campo/control/tipo en `shared-form-control-matrix.md` y se implementaron controles compartidos para documento, fecha, municipio, navegación y evidencias.
- Login y entrada pública exponen retorno al inicio. Los pasos públicos vuelven al paso anterior conservando valores; las tres operaciones autenticadas vuelven al centro de la academia.
- El progreso horizontal se muestra solo en ancho móvil; escritorio conserva la navegación lateral. Los menús de documento y municipio flotan sobre el formulario sin desplazar campos.
- Adultos/responsables: `CC|CE|PASSPORT`. Menores: `TI|RC|CE|PASSPORT`. Frontend y servicios backend aplican la misma regla.
- Las evidencias usan estados e iconos distintos para faltante, seleccionado, carga/escaneo, `CLEAN` y error; el porcentaje aparece solo cuando el navegador entrega progreso medible. Quitar/reemplazar conserva las reglas del ciclo de vida.

### Evidencia de navegador de esta pasada

Se recorrieron rutas normales, sin `?preview=`, para los siete tipos en escritorio y 390×640. En cada uno se comprobó un intento vacío con bloqueo/foco, y selección→quitar→reemplazar de una evidencia sintética. En los flujos con menor se comprobó el menú de documentos de menor; en los sujetos adultos se comprobó la exclusión de TI/registro civil. La sesión de academia usó el contexto local aprobado `6f633d3f-224a-47b2-8b5d-5ae5640f70a6`.

La comparación con las referencias afectadas conservó fondo, paneles, tipografía, jerarquía, navegación lateral y composición móvil. La barra horizontal de escritorio se omitió deliberadamente por este requisito posterior; no se considera una regresión accidental.

No se enviaron nuevas solicitudes en esta pasada y no se declara aceptación integral de los siete recorridos solamente por estas comprobaciones.

Verificación enfocada de esta pasada: frontend Jest 11 suites/73 pruebas PASS; backend Vitest 8 archivos/50 pruebas PASS; ambos typechecks PASS; Expo web export PASS con 64 rutas; `git diff --check` PASS.

## Correcciones de revisión visual y conflicto exacto — 2026-09-29

**Resultado:** PASS limitado a los cuatro hallazgos de esta revisión; no amplía la aceptación manual de los demás recorridos.

- Fondo de entrada: verificado en ruta normal a 1440×1000, 1440×1600, 390×844 y viewport corto 390×500. La capa permanece `fixed`, ocupa el viewport, usa `cover`, no repite la imagen y conserva el gradiente inferior durante redimensionado y desplazamiento.
- Login: “Volver al inicio” aparece en la esquina superior izquierda del área de formulario y conserva un objetivo de 44 px en escritorio y móvil. Estado enviado: la solicitud sintética `7f778342-e89c-491c-bcf0-e26aba615d73` mostró exactamente una salida, “Cerrar sesión”, y ninguna acción “Volver al inicio”. El fixture y su sesión se eliminaron después de verificar.
- Municipio compartido: comprobado en escritorio y móvil con Bogotá y Medellín. La lista fue opaca (`rgb(3, 24, 17)`), absoluta, desplazable, con `z-index: 2000`, por encima de contenido y acciones, sin desplazar el formulario.
- Conflicto exacto: el endpoint devolvió HTTP `422` con `field=person.documentNumber` y `code=document_in_use`. En el flujo `PERSONAL_ADULT`, “Guardar y continuar” mostró “Este documento ya está en uso”, mantuvo todos los valores y enfocó “Número de documento”. El identificador sintético de prueba no se registró en este documento y su reserva temporal fue eliminada.
- Atomicidad: la carrera de dos creaciones con el mismo documento dejó una sola solicitud y un resultado de conflicto; la prueba PostgreSQL focalizada pasó 4/4.

Comparación visual afectada: se conservaron la composición, navegación y jerarquía de las referencias aprobadas; los cambios se limitan a la continuidad del fondo, posición de salida, capa flotante compartida y error de campo autorizado.

## Rectificación del fondo de la ruta raíz — 2026-09-29

La verificación anterior del fondo no cubrió correctamente la ruta pública `/`: la evidencia posterior del usuario mostró una franja negra a la derecha en un viewport de 1916 px. Por tanto, ese punto no estaba aprobado y esta nota conserva el historial real del hallazgo.

Se corrigió la imagen de la capa fija para que, además del contenedor, tenga `width: 100%` y `height: 100%`; antes React Native Web le aplicaba las dimensiones intrínsecas de 1672 px. Verificación posterior en navegador real: `1916×940`, `1916×1200` y `390×844`, con imagen y capa de fondo coincidiendo exactamente con los cuatro bordes del viewport, sin franja lateral, desbordamiento ni costura visible. Prueba focalizada 4/4 y typecheck frontend PASS.
