# Visual QA — Administración de solicitudes

> Los nombres de imágenes se conservan como identificadores históricos; los binarios de referencia y captura no se almacenan en Git.

Fecha: 2026-09-28. Datos: exclusivamente sintéticos. Resultado: **7/7 referencias revisadas**.

## Comparación uno a uno

| Referencia aprobada | Ejecución verificada | Resultado |
|---|---|---|
| `admin-unified-inbox-desktop.png` | `/admin/registration?preview=desktop` | Conserva jerarquía de bandeja, filtros, estados no dependientes de color, siete tipos y paginación por cursor. La implementación usa chips y carga incremental en vez del paginador numérico ilustrativo. No existe selección ni aprobación masiva. |
| `admin-request-evidence-review-desktop.png` | `/admin/registration/{id}?preview=desktop` | Mantiene datos mínimos a la izquierda, documentos protegidos a la derecha, acciones y cronología operativa al final. El visor usa un marcador seguro porque las referencias no son evidencia real. |
| `admin-request-evidence-review-mobile.png` | `/admin/registration/{id}?preview=mobile` | Apila información, consentimiento, evidencia y cronología sin desplazamiento horizontal. La navegación global ilustrativa se omite; la ruta conserva regreso y acciones principales. |
| `admin-correction-rejection-decision-desktop.png` | `/admin/registration/{id}/decision?preview=desktop` | Mantiene corrección y vista previa en columnas, mensaje seguro, selección controlada y rechazo final diferenciado. |
| `admin-correction-rejection-decision-mobile.png` | `/admin/registration/{id}/decision?preview=mobile` | Apila formulario, vista previa, cronología y rechazo; ningún control queda fuera del ancho nativo. |
| `admin-dossier-approval-deletion-recovery-desktop.png` | `/admin/registration/{id}/approval?preview=desktop` | Mantiene resultado, expediente, recuperación explícita, respuesta bloqueada y cronología inferior de cinco pasos. |
| `admin-dossier-approval-deletion-recovery-mobile.png` | `/admin/registration/{id}/approval?preview=mobile` | Conserva el orden operativo y el reintento en una sola columna. La aplicación registra la confirmación, no almacena el expediente externo. |

## Accesibilidad y comportamiento

- **Teclado y foco:** botones, filtros, documentos, casillas y campos exponen roles/nombres; el orden DOM sigue lectura → edición → confirmación → acción. Los controles bloqueados publican `disabled` y los errores usan región viva.
- **Lector de pantalla:** títulos usan `header`; selección, confirmación y estados incluyen texto explícito. “Error”, “En curso”, “Pendiente” y “Completado” evitan depender del color.
- **Objetivos táctiles:** acciones y filas interactivas tienen altura mínima de 48 px (54 px en acciones primarias).
- **Responsive:** se comprobaron las cinco variantes de escritorio y las dos variantes móviles indicadas arriba. Los modos móviles limitan el lienzo a 430 px y apilan columnas.
- **Paginación:** la bandeja mantiene filtros y filas al anexar la página siguiente; una decisión invalida la fila según las pruebas de estado de T110.
- **Visor protegido:** el stream se solicita con autorización; solo se mantiene una URL efímera, se revoca al cambiar de documento y también al desmontar. No se persisten bytes, base64, rutas, claves ni hashes.
- **Cronología inferior:** detalle, decisión y aprobación la sitúan después del contenido. Aprobación muestra exactamente “Información revisada”, “Expediente manual creado”, “Resultado revisado”, “Eliminación segura de evidencias” y “Respuesta enviada”.
- **Movimiento:** estas pantallas no introducen animaciones obligatorias; la experiencia no cambia con movimiento reducido.

## Desviaciones deliberadas

Las referencias contienen navegación global, documentos ilustrativos y datos deportivos de ejemplo. La implementación no los fabrica: usa navegación mínima y un marcador de visor protegido. Se conserva la jerarquía, el contraste semántico, la secuencia operativa y la adaptación responsive exigidas por Feature 006.
