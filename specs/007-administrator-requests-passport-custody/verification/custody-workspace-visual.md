# Verificación visual — Confirmación de custodia

**Fecha**: 2026-09-30
**Alcance**: T036 / US3
**Autoridad visual exclusiva**: `docs/design/admin-custody/passport-custody-workspace-desktop.png` y `passport-custody-workspace-mobile.png`.

## Capturas

- Escritorio, 1440 × 1024: `.runtime/feature-007-visual/custody-workspace/custody-confirmation-desktop.png`
- Móvil, 390 × 844: `.runtime/feature-007-visual/custody-workspace/custody-confirmation-mobile.png`
- Las capturas y perfiles de navegador permanecen ignorados por Git.

## Resultado

- PASS — un arrastre real desde el pasaporte hasta la zona de Laura M. abrió la confirmación sin ejecutar la asignación.
- PASS — el botón móvil `Asignar` y la selección por teclado abren la misma superficie con pasaporte, custodia actual y Analista seleccionado anunciados.
- PASS — `Cancelar` y `Escape` cierran sin persistencia; el foco vuelve al botón o selector que originó la intención.
- PASS — confirmar sin motivo mantiene la custodia intacta, anuncia el error y enfoca el campo; con motivo válido se ejecuta una sola confirmación.
- PASS — el flujo táctil usa controles de al menos 44 px y la hoja inferior ocupa todo el ancho a 390 px sin desplazamiento horizontal.
- PASS — las zonas de destino comunican estado mediante texto, icono y borde, no solo color.
- PASS — no hay animación requerida para completar la operación; con movimiento reducido, la selección cambia de forma instantánea. Las únicas transiciones observadas pertenecen al documento/superficie base y no bloquean interacción.
- PASS — no se observaron errores de consola durante los recorridos de puntero, teclado y móvil.

## Comparación y diferencias controladas

- Se conservan la paleta esmeralda, superficies translúcidas, bordes verdes, acento lima, columnas de escritorio y hoja inferior móvil de las referencias.
- En escritorio, la confirmación se ubica en el cuadrante inferior derecho para mantener visibles las columnas y el destino seleccionado.
- En móvil, la navegación inferior permanece visible detrás de la hoja; la hoja bloquea la operación y conserva el contexto sin introducir una ruta adicional.
- La copia usa `Confirmar custodia` para la superficie compartida y `Confirmar asignación` para la acción específica.

No quedan desviaciones bloqueantes para T036.
