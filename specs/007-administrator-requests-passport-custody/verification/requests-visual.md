# Verificación visual — Solicitudes del Administrador

**Fecha**: 2026-09-30
**Alcance**: T020 / US1
**Autoridad visual exclusiva**: `docs/design/admin-custody/registration-requests-desktop.png`, `registration-requests-mobile.png` y el shell compartido de `administrator-home-desktop.png` / `administrator-home-mobile.png`.

## Capturas

- Escritorio, 1440 × 1024: `.runtime/feature-007-visual/requests/requests-desktop.png`
- Móvil, 390 × 844: `.runtime/feature-007-visual/requests/requests-mobile.png`
- Las capturas y comparaciones binarias permanecen ignoradas por Git.

## Resultado

- PASS — shell diferenciado con Inicio, Solicitudes, Expedientes y Custodia; no aparece “Administrador autorizado”.
- PASS — fondo esmeralda/verde-negro, superficies oscuras translúcidas, bordes verdes, acento lima y jerarquía blanca/gris-verde coherentes con las referencias.
- PASS — los cinco grupos aprobados aparecen con texto, icono y conteo; la diferencia frente a los cuatro indicadores de la referencia es intencional para cumplir la especificación funcional vigente.
- PASS — tarjetas mínimas con nombre permitido, referencia enmascarada, tipo, fecha/contexto, estado textual y siguiente acción.
- PASS — escritorio conserva cola prioritaria y panel de siguiente acción; móvil conserva la cola, la acción semántica en cada fila y navegación inferior.
- PASS — a 390 px, el navegador confirmó `scrollWidth = innerWidth = 390`; completar el recorrido no requiere desplazamiento horizontal de página.
- PASS — la vista completa se abrió y volvió a grupos conservando el contexto; el árbol accesible mostró encabezado, controles y filas autorizadas.
- PASS — tabulación produjo foco en un botón de solicitud con nombre accesible; objetivos principales tienen un mínimo de 44/48 px y los estados no dependen del color.
- PASS — no se introdujeron animaciones requeridas y la experiencia funciona con movimiento reducido.

## Diferencias controladas

- Se muestran cinco grupos exactos en vez de combinar “Nuevas” y “Continuar revisión” bajo “Por revisar”. La especificación y el contrato de US1 prevalecen.
- Los filtros de tipo son controles explícitos y envolventes en lugar de un menú visual cerrado. Esto mantiene operación por teclado/tacto sin agregar una interacción no especificada.
- No se implementó el panel decorativo “Distribución por tipo”; no es requisito de US1 y no reemplaza la vista completa.

No quedan desviaciones bloqueantes para T020.
