# Revalidación manual PERSONAL_ADULT — Feature 006

Fecha: 2026-09-29.

## Resultado

**PASS para los dos recorridos solicitados en navegador real.** Esta revalidación corrige el resultado de aceptación manual inicialmente fallido; no sustituye ni oculta el historial automatizado T001–T134.

Se usaron el frontend local sin `?preview=`, backend local, PostgreSQL y ClamAV. Solo se utilizaron datos y documentos sintéticos. No se registran credenciales ni contenido documental.

## Fallos reproducidos y causas

- La sesión `PENDING_ONBOARDING` solo proyectaba `registration.request.own.view`; al corregir, el backend ocultaba de forma segura la operación no autorizada y el reenvío válido terminaba en HTTP `404`. Ahora las capacidades se derivan del estado actual de la solicitud.
- La preparación de una corrección incrementa la versión, pero la validación exigía consentimientos emitidos exactamente en esa nueva versión. Los consentimientos inmutables previos ahora son válidos cuando pertenecen a una versión menor o igual a la actual.
- El destino autenticado genérico enviaba también al Administrator a pasaportes. Ahora un Administrator con capacidad de revisión entra al inbox unificado.
- El detalle Admin usaba una composición insuficiente y no integraba el visor autorizado. Se restauraron navegación, datos mínimos enmascarados, visor protegido, acciones separadas y timeline inferior según las referencias aprobadas.
- La aprobación esperaba eliminación verificada, pero después intentaba recalcular la preparación desde evidencias ya eliminadas. La finalización usa la preparación durable ya confirmada y mantiene las revalidaciones de negocio de los outcomes. El endpoint ejecuta un ciclo acotado del worker y solo finaliza después de ausencia verificada.

## Evidencia de navegador

### Envío y aprobación directa

- Solicitud: `ce42b3db-bfe0-4f9c-9ab4-752c0b35dcf1`.
- Recorrido: envío → estado pendiente → cierre de sesión → login Administrator → inbox → detalle → evidencia autorizada → expediente manual → aprobación.
- Estado final: `APPROVED`, versión `3`, ejecución `FINALIZED` en un intento.
- Eliminación: dos evidencias con estado `COMPLETED` antes de la respuesta final.
- Outcome: un pasaporte y una responsabilidad `SELF`, sin duplicados.

### Corrección y reenvío

- Solicitud: `0ddbf793-de6b-438a-8cbf-a03176f1bea5`.
- Recorrido: envío → solicitud Admin de corrección para frente y reverso → login solicitante → motivo seguro visible → selección y escaneo real de ambos archivos → reenvío.
- Estado final: `SUBMITTED`, versión `3`, lista nuevamente para revisión.
- La cola conserva los archivos seleccionados cuando una carga o reenvío falla y presenta un motivo seguro específico.

## Comparación visual afectada

- Estado/corrección del solicitante: conserva jerarquía y composición de las referencias; añade las salidas necesarias `Volver al inicio` y `Cerrar sesión`.
- Inbox Administrator: el acceso posterior al login es visible y directo, sin selección/aprobación masiva.
- Detalle/evidencia Administrator: navegación lateral, cabecera, datos mínimos enmascarados, visor autorizado, decisiones independientes y timeline inferior coinciden materialmente con las referencias desktop/mobile.
- Expediente/aprobación: mantiene confirmación manual, espera de eliminación, recuperación/reintento y los cinco pasos aprobados.

La inspección se realizó sobre los viewports afectados, árbol accesible y pruebas responsive. La herramienta de navegador no produjo captura full-page estable; no se usó esa limitación para omitir la comprobación funcional o de contenido.

## Verificación enfocada

```text
Backend Vitest: 5 archivos, 18 pruebas, PASS
Frontend Jest: 5 suites, 24 pruebas, PASS
Backend typecheck: PASS
Frontend typecheck: PASS
```

No se ejecutaron suites completas no relacionadas, Converge, commit, merge ni deploy.
