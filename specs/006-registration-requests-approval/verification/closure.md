# Cierre de Feature 006

Fecha: 2026-09-30
Rama: `feature/006-registration-requests-approval`
Resultado: **ACEPTADA Y CERRADA**

## Aceptación de Feature 006

La aceptación visual y funcional manual fue aprobada por el usuario. Los siete tipos de solicitud se recorrieron en rutas normales, sin `?preview=`, contra frontend, backend, PostgreSQL y ClamAV reales:

- cuatro solicitudes públicas y tres solicitudes desde una academia aprobada;
- envío, ID, estado del solicitante y visibilidad en la bandeja Administrator;
- corrección y reenvío, rechazo final y aprobación directa;
- confirmación manual de expediente y eliminación verificada de evidencias;
- materialización contractual de cuentas, roles, membresías, responsabilidades y pasaportes.

Resultado manual: **7/7 recorridos PASS**, decisiones Administrator PASS y ningún bloqueador de Feature 006. La matriz y los IDs sintéticos están registrados en `manual-functional-acceptance-2026-09-30.md`.

Tras la aceptación se eliminaron de la base local las solicitudes y evidencias sintéticas de la verificación. Esta limpieza no altera el resultado de aceptación registrado ni forma parte del producto entregado.

## Backlog futuro — fuera de Feature 006

Los siguientes puntos quedan explícitamente diferidos a futuras especificaciones y no condicionan la aceptación de Feature 006:

1. **Validación nativa física.** Ejecutar los recorridos en dispositivo/emulador Android y simulador/dispositivo iOS cuando exista infraestructura disponible. En esta feature se validaron los targets declarados, componentes React Native y anchos nativos; Windows no dispone de simulador iOS y el host no tenía SDK/dispositivo Android conectado.
2. **Automatización visual full-page.** Incorporar una herramienta estable de capturas completas para superficies desplazables. La aceptación actual combinó capturas de viewport, inspección accesible y pruebas de componentes porque el controlador disponible agotó el tiempo en full-page.
3. **Pulido óptico P3.** Evaluar en una futura iteración de diseño diferencias menores de métricas de fuente del sistema, glifos de línea simplificados y variaciones de recorte del fondo compartido.
4. **Deprecaciones de React Native Web.** Actualizar en una iniciativa técnica separada los módulos heredados que todavía emiten avisos de desarrollo por propiedades `shadow*` y `pointerEvents`; no producen errores funcionales ni de consola de aplicación en Feature 006.
5. **Fixtures de preview para documentación.** Si una especificación futura necesita demos visuales más densas, definir fixtures aislados de documentación para listas e inbox. Feature 006 evita precargar datos personales o deportivos ficticios en producción.

## Puerta de cierre

- Artefactos, contratos, implementación y verificaciones de Feature 006 están incluidos en la rama.
- Los pendientes anteriores están separados del alcance aceptado.
- No se ejecutó Converge, no se desplegó y no se realizó merge.
