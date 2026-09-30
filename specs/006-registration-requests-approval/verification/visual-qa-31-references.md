# Verificación visual final — 31 referencias

> Las imágenes de referencia y las capturas runtime se usaron durante la validación, pero sus binarios fueron retirados del repositorio. Los nombres de archivo de esta matriz se conservan únicamente como identificadores históricos de la aceptación.

Fecha: 2026-09-28. Se inspeccionaron las 31 referencias aprobadas y se capturó la aplicación en ejecución con viewport de escritorio `1440x1024` y móvil `390x844`. Los 32 binarios de captura y los binarios de referencia se retiraron del repositorio después de registrar esta matriz de aceptación.

## Resultado

- Dirección visual preservada: fondo esmeralda, superficies oscuras translúcidas, tipografía de alto contraste, lima para foco/progreso/acciones y composiciones diferenciadas por breakpoint.
- Jerarquía y orden operativo preservados en los siete recorridos. Los historiales operativos permanecen al final en las vistas Administrator.
- Accesibilidad enfocada: 14 suites / 50 pruebas aprobadas para teclado, foco, lector, roles/estados, regiones vivas, touch targets, reduced motion, paginación y limpieza del visor. La inspección AX de runtime expuso encabezado y progreso con nombres accesibles.
- Limitación de captura: el controlador del navegador solo produjo capturas de viewport; el contenido inferior desplazable fue verificado con las pruebas de componente, no mediante una captura full-page.
- Desviaciones de datos de muestra, no de comportamiento: las previews iniciales y los hubs no precargan todas las filas/datos ilustrativos de las referencias. El inbox Administrator aparece vacío en preview. Los estados y filas están cubiertos por pruebas; no se añadieron datos deportivos ni personales ficticios a producción.

## Comparación uno a uno

| # | Referencia aprobada | Evidencia runtime | Resultado de comparación |
|---:|---|---|---|
| 1 | `solicitud/request-type-selection-desktop-mobile.png` | `01-request-type-selection-desktop.png`, `01-request-type-selection-mobile.png` | Conforme en jerarquía, categorías, fondo, tarjetas, CTA y apilado; iconografía y densidad de muestra son más sobrias. |
| 2 | `solicitud/adult-account-identity-desktop.png` | `02-adult-account-identity-desktop.png` | Conforme en shell, progreso lateral, formulario y acciones; preview sin todos los valores ilustrativos. |
| 3 | `solicitud/adult-account-identity-mobile.png` | `03-adult-account-identity-mobile.png` | Conforme en columna única, progreso, lectura y controles táctiles. |
| 4 | `solicitud/adult-submission-review-desktop.png` | `04-adult-submission-review-desktop.png` | Conforme en revisión, evidencia/consentimiento y CTA; datos de muestra mínimos. |
| 5 | `solicitud/adult-submission-review-mobile.png` | `05-adult-submission-review-mobile.png` | Conforme en orden y adaptación móvil; contenido inferior se valida por scroll/pruebas. |
| 6 | `solicitud/represented-minor-information-desktop.png` | `06-represented-minor-information-desktop.png` | Conforme en separación representante/menor y ausencia de credenciales del menor. |
| 7 | `solicitud/represented-minor-information-mobile.png` | `07-represented-minor-information-mobile.png` | Conforme en apilado, jerarquía y controles accesibles. |
| 8 | `solicitud/represented-minor-submission-review-desktop.png` | `08-represented-minor-submission-review-desktop.png` | Conforme en autoridad, evidencias, consentimiento y revisión. |
| 9 | `solicitud/represented-minor-submission-review-mobile.png` | `09-represented-minor-submission-review-mobile.png` | Conforme en orden móvil y lectura; datos ilustrativos reducidos. |
| 10 | `solicitud/formal-academy-information-desktop.png` | `10-formal-academy-information-desktop.png` | Conforme en información institucional/responsable y shell de escritorio. |
| 11 | `solicitud/formal-academy-information-mobile.png` | `11-formal-academy-information-mobile.png` | Conforme en composición móvil y campos táctiles. |
| 12 | `solicitud/natural-person-academy-information-desktop.png` | `12-natural-person-academy-information-desktop.png` | Conforme en identidad operativa, ubicación no precisa y responsable. |
| 13 | `solicitud/natural-person-academy-information-mobile.png` | `13-natural-person-academy-information-mobile.png` | Conforme en apilado y lenguaje neutral. |
| 14 | `solicitud/natural-person-academy-submission-review-desktop.png` | `14-natural-person-academy-submission-review-desktop.png` | Conforme en evidencia, declaraciones y revisión sin afirmar certificación. |
| 15 | `solicitud/applicant-correction-status-desktop.png` | `15-applicant-correction-status-desktop.png` | Conforme en estado, motivo seguro, corrección y acciones. |
| 16 | `solicitud/applicant-correction-status-mobile.png` | `16-applicant-correction-status-mobile.png` | Conforme en prioridad móvil, foco y lectura del estado. |
| 17 | `solicitud/academy-request-hub-desktop.png` | `17-academy-request-hub-desktop.png` | Conforme en contexto y opciones; preview no precarga las tres filas ilustrativas. |
| 18 | `solicitud/academy-request-hub-mobile.png` | `18-academy-request-hub-mobile.png` | Conforme en elecciones y apilado; lista vacía documentada como diferencia de fixture. |
| 19 | `solicitud/academy-additional-account-submission-review-desktop.png` | `19-academy-additional-account-review-desktop.png` | Conforme en academia derivada, cuenta, función, evidencias y declaraciones. |
| 20 | `solicitud/academy-additional-account-submission-review-mobile.png` | `20-academy-additional-account-review-mobile.png` | Conforme en columna única y controles táctiles. |
| 21 | `solicitud/academy-adult-player-submission-review-desktop.png` | `21-academy-adult-player-review-desktop.png` | Conforme en jugador, evidencia, autorización y ausencia de USER/SELF. |
| 22 | `solicitud/academy-adult-player-submission-review-mobile.png` | `22-academy-adult-player-review-mobile.png` | Conforme en jerarquía móvil y lectura. |
| 23 | `solicitud/academy-minor-player-submission-review-desktop.png` | `23-academy-minor-player-review-desktop.png` | Conforme en menor, representante, evidencia y consentimientos separados. |
| 24 | `solicitud/academy-minor-player-submission-review-mobile.png` | `24-academy-minor-player-review-mobile.png` | Conforme en apilado y ausencia de cuenta automática del menor. |
| 25 | `admin/admin-unified-inbox-desktop.png` | `25-admin-unified-inbox-desktop.png` | Conforme en shell, siete filtros de tipo, estados y ausencia de selección masiva; preview sin filas. |
| 26 | `admin/admin-request-evidence-review-desktop.png` | `26-admin-request-evidence-review-desktop.png` | Conforme en datos mínimos, acceso protegido, acciones y timeline al final. |
| 27 | `admin/admin-request-evidence-review-mobile.png` | `27-admin-request-evidence-review-mobile.png` | Conforme en apilado y lectura; visor y timeline aparecen al desplazar. |
| 28 | `admin/admin-correction-rejection-decision-desktop.png` | `28-admin-correction-rejection-desktop.png` | Conforme en motivo seguro, preview solicitante, rechazo y timeline inferior. |
| 29 | `admin/admin-correction-rejection-decision-mobile.png` | `29-admin-correction-rejection-mobile.png` | Conforme en orden móvil, campos y preview. |
| 30 | `admin/admin-dossier-approval-deletion-recovery-desktop.png` | `30-admin-dossier-approval-desktop.png` | Conforme en expediente, confirmación, recuperación, retry y cinco pasos inferiores. |
| 31 | `admin/admin-dossier-approval-deletion-recovery-mobile.png` | `31-admin-dossier-approval-mobile.png` | Conforme en apilado, espera de respuesta y recuperación; timeline accesible mediante scroll. |

## Comando de accesibilidad y componentes

```text
npx jest --runInBand <14 suites visuales de registration-requests>
Test Suites: 14 passed, 14 total
Tests:       50 passed, 50 total
```

Conclusión: las 31 referencias tienen evidencia runtime y comparación explícita. Las diferencias registradas corresponden a densidad de fixtures de preview y al límite de captura full-page; no cambian los flujos aprobados.

## Revisión afectada tras aceptación manual — 2026-09-29

Se repitió únicamente la comparación de las pantallas afectadas por el fallo `PERSONAL_ADULT`:

- `applicant-correction-status-desktop.png` y `applicant-correction-status-mobile.png`: estado, motivo seguro, reemplazo, reenvío, retorno y cierre de sesión conformes.
- `admin-unified-inbox-desktop.png`: entrada visible inmediatamente después del login Administrator y navegación al detalle conformes.
- `admin-request-evidence-review-desktop.png` y `admin-request-evidence-review-mobile.png`: datos mínimos enmascarados, visor autorizado, acciones y timeline inferior conformes.
- `admin-dossier-approval-deletion-recovery-desktop.png` y `admin-dossier-approval-deletion-recovery-mobile.png`: expediente manual, confirmación, borrado verificado, recuperación/reintento y cinco pasos conformes.

Los dos recorridos funcionales completaron en navegador real. La inspección combinó viewport, árbol accesible y pruebas responsive; la captura full-page del controlador agotó su tiempo, limitación registrada sin convertirla en evidencia de éxito.
