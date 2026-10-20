# Verificación frontend — Feature 011

Fecha local: 2026-10-16.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `npm exec -- jest src/analyst-match-upload/analyst-match-capture.spec.tsx src/analyst-match-upload/analyst-match-entry.spec.tsx src/analyst-match-upload/analyst-match-final-step.spec.tsx src/analyst-match-upload/analyst-match-confirmed.spec.tsx src/analyst-workspace/analyst-overview.spec.tsx --runInBand` (`apps/frontend`) | Pasó: 5 suites, 29 pruebas | Rueda, elecciones explícitas/avance, corrección por progreso, observación opcional, guardado local sin POST, revisión de solo eventos guardados, errores de validación, limpieza tras revocación, detalle confirmado privado y «Análisis realizados» indisponible. |
| `npm run typecheck` (raíz) | Pasó | TypeScript backend y frontend. |
| `npm run test:frontend` (raíz) | Falló: 548 pasadas, 2 omitidas, 1 fallida | `tests/authentication/authenticated-entry.spec.tsx` (ruta neutral anterior a Feature 011) renderiza `AuthenticatedRouteShell` sin `AuthenticationProvider`; se reproduce aislada (1/2 falla). Las suites enfocadas de Feature 011 pasan. No se cambió el test de autenticación ajeno a esta característica. |
| `git diff --check` | Pasó | Sin errores de espacio en cambios rastreados. |

La prueba web autenticada de escritorio/móvil y su comparación con las referencias externas se registran aparte en `visual-review.md`; estas pruebas automatizadas no la sustituyen.

## Reejecución enfocada de cierre — 2026-10-20

Desde `apps/frontend`, `npm run test:unit -- src/analyst-match-upload` pasó **6 suites/40 pruebas** y `npm run typecheck` pasó. El typecheck de `apps/backend` también pasó. Estos resultados incluyen Gol/Asistencia, fallo sin medición, éxito medido, guardados múltiples, progreso corregible y datos finales; no acreditan por sí solos comparación visual ni teclado/lector nativo. La verificación web autenticada y sus límites se documentan en `visual-review.md`. No se repitió la suite general de frontend, cuya falla ajena sigue descrita arriba.

## Regresión de encabezados — 2026-10-20

`npm run test:unit -- src/analyst-match-upload` pasó **6 suites/41 pruebas** después de añadir el caso de jerarquía para captura, revisión, evento revisado y datos finales. Ese caso falló primero con `[h2, h1, h2]`, antes de retirar el encabezado del nombre del jugador; ahora exige un solo `h1` por etapa y niveles `h2`/`h3` para secciones/eventos. `npm run typecheck` en `apps/frontend` pasó. La sesión Chrome estaba expirada, por lo que estas pruebas no se presentan como verificación de teclado o árbol en runtime web.

## Comprobación previa al commit — 2026-10-20

`npm run test:unit --workspace @new-talents/frontend -- src/analyst-match-upload` pasó **6 suites/41 pruebas** y `npm run typecheck` pasó para backend y frontend. La sesión Chrome se reabrió después de la pasada anterior: la comprobación autenticada de encabezados y teclado web en escritorio y `390×844` se consigna en la continuación final de `visual-review.md`. Esto no acredita teclado virtual ni lector de pantalla nativos.
