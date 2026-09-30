# Quickstart: Feature 006 planning verification

Este documento describe la ejecución esperada después de implementar tareas futuras. No implica que Feature 006 ya esté construida.

> Nunca use documentos personales reales, fotografías de identificaciones reales, correos reales ni credenciales reutilizadas en desarrollo o pruebas. Use únicamente canarios sintéticos claramente ficticios.

## Prerequisites

- Node.js y npm en las versiones fijadas por el repositorio.
- Docker/PostgreSQL conforme al entorno actual.
- Backend y frontend instalados con el lockfile existente.
- Proveedor local de evidencia configurado sobre un volumen privado fuera de rutas servidas.
- Scanner ClamAV disponible para la fase documental; si no responde, la carga debe fallar cerrada.

La implementación futura añadirá variables tipadas para proveedor/raíz privada, límites/tipos, scanner, sesión pendiente y política acotada de eliminación. No incluya claves de producción en archivos locales versionados.

## Synthetic evidence

Prepare archivos pequeños sin datos personales:

- `synthetic-id-front.png`: imagen con texto grande `SYNTHETIC TEST ONLY`.
- `synthetic-id-back.jpg`: imagen ficticia equivalente.
- `synthetic-record.pdf`: PDF de una página con nombres `Test Applicant` y documento `TEST-0001`.
- `unsupported.txt`: archivo para comprobar rechazo de formato.
- Un archivo renombrado `.png` cuyo contenido sea texto para comprobar firma/MIME.
- Un archivo de más de 10 MiB para comprobar límite.

No copie una imagen o PDF real para “anonimizarlo”: genere el canario desde cero.

## Verification commands

Desde la raíz, use los scripts existentes que la implementación amplíe:

```powershell
npm run lint
npm run typecheck
npm test
```

Ejecute por separado las suites PostgreSQL de concurrencia en modo secuencial. Dos decisiones solapadas deben usar clientes independientes para demostrar el aislamiento real, no promesas concurrentes sobre el mismo cliente.

Valide el contrato sin alterar dependencias del proyecto:

```powershell
npx --yes @redocly/cli lint specs/006-registration-requests-approval/contracts/registration-requests.openapi.yaml
```

## Applicant scenarios

Para cada tipo, cree Borrador, complete solo campos/evidencias aplicables, cargue canarios, espere estado CLEAN y presente:

1. Adulto propio.
2. Representante de menor.
3. Academia formalizada.
4. Academia de persona natural.
5. Cuenta adicional desde academia aprobada/responsable.
6. Jugador adulto desde membresía activa.
7. Jugador menor con representante/autorizaciones.

Resultados esperados:

- Pending session solo ve su solicitud; no abre passport/academy/admin.
- Menor nunca recibe correo, password, teléfono, cuenta o sesión.
- `SUBMITTED` no es editable.
- Corrección habilita únicamente la misma solicitud/versionado y conserva historial.
- Similitud no concluyente no revela candidato; coincidencia exacta no crea duplicado.

## Administrator review

1. Abra la bandeja con Admin autorizado y pruebe filtros de tipo/estado y cursor.
2. Confirme que un Analyst y un actor no asociado reciben denegación segura.
3. Abra detalle y evidence stream; verifique `Cache-Control: no-store` y evento de acceso.
4. Solicite corrección con razón segura; sustituya evidencia y reenvíe.
5. Intente aprobar sin expediente: debe fallar sin outcomes.
6. Confirme expediente y apruebe. Mientras elimina, request sigue no-final y no hay acceso de producto.
7. Tras eliminación verificada, compruebe outcome tipado y `APPROVED`.
8. Rechace otra request: cero outcomes, evidencia inaccesible y eliminación iniciada.

## Approval outcomes

Verifique transaccionalmente:

- adulto: USER + SELF + un passport activo básico;
- menor representado: USER del representante + LEGAL_REPRESENTATIVE + passport, cero cuenta menor;
- academias: una Academy + responsable ACADEMY_USER + membership + responsible relation;
- cuenta adicional: solo ACADEMY_USER/membership en academia objetivo;
- jugador adulto academia: Player + sporting relation + passport, sin USER/SELF;
- jugador menor academia: Player + legal responsibility + sporting relation + passport, sin cuentas automáticas.

Cada passport nuevo debe indicar enriquecimiento pendiente y no mostrar posición, pie, FEM, estadísticas, partidos o videos inventados.

## Failure and concurrency checks

- Scanner caído: evidencia permanece no utilizable y submit falla.
- Storage delete falla: aprobación no finaliza; deletion llega a recovery tras intentos acotados.
- Admin retry: idempotente, auditado y finaliza una sola vez.
- Dos Admin approve/reject: solo una decisión/version prevalece.
- Dos solicitudes equivalentes: máximo una identidad/player/academy/passport/membership.
- Fallo dentro del outcome: rollback total y cero privilegios parciales.
- Pérdida de membership antes de decidir: operación organizacional denegada.

## Privacy checks

Busque en respuestas, logs, traces, rutas, eventos y exports los valores canario (password, documento y nombres de archivo). El resultado esperado es cero fuera de los límites cifrados/restringidos autorizados. Confirme que ordinary JSON contiene metadata documental, nunca bytes, object key, hash o raw document.

Después de `COMPLETED`, intente abrir evidencia como owner y Admin: ambos fallan de forma segura. El historial conserva categoría, actor/tiempo y resultado, no contenido.

## Responsive and accessibility

Recorra selección, siete forms, upload, pending, correction, approval/rejection y Admin inbox/detail en web estrecha/ancha y móvil. Verifique teclado/lector, foco visible/lógico, errores asociados, anuncios de progreso, targets táctiles, reduced motion y estados no dependientes solo del color.

## Safe cleanup

Use únicamente la operación de limpieza acotada que provea Feature 006 para fixtures identificados como sintéticos. Verifique el directorio/bucket y prefijo exactos antes de limpiar. No elimine volúmenes generales, bases compartidas ni rutas calculadas amplias. La limpieza debe ejecutar la misma verificación de ausencia y dejar auditoría segura.

## Compatibility expectations

- Login/refresh/revocation/logout de Feature 003 siguen funcionando.
- Feature 004 conserva restauración y accesibilidad; el CTA público cambia a Crear solicitud de registro.
- Cuentas, pasaportes y relaciones previos de Feature 005 siguen legibles sin reescritura.
- Provisión/recuperación de personal interno permanece controlada y no pública.
