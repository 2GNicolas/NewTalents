# UI contract: Inicio, Pasaportes y Partidos del Analista

Estas son referencias de composición, no fuentes de datos. La interfaz web usa la ruta autenticada real y la proyección de `analyst-workspace.openapi.yaml`; no copia personas, cifras ni estados de ejemplo. El acceso se comprueba en backend aunque exista enlace o elemento visible.

| Vista | Referencia escritorio | Referencia viewport móvil | Jerarquía conservada |
|---|---|---|---|
| Inicio | `docs/design/analist/New Talents analyst workload overview-1.png` | `docs/design/analist/Mobile analyst dashboard with pending analyses-2.png` | Encabezado del espacio; Análisis pendientes; Próximos partidos con “Ver calendario”; Análisis realizados con no disponibilidad honesta. |
| Pasaportes | `docs/design/analist/Analyst passport custody dashboard.png` | `docs/design/analist/Active passport custody dashboard.png` | Título y contexto de custodia; tarjetas `ACTIVE` propias con nombre autorizado del jugador y referencia operativa, estado de asignación, próximo partido real si existe y “Abrir pasaporte”. |
| Partidos | `docs/design/analist/Emerald Match Agenda for Analysts.png` | `docs/design/analist/New Talents match agenda.png` | Agenda por fecha; rival, competencia, sede, hora y estado permitidos; “Ver partido” hacia detalle de solo lectura. |

## Navegación y composición

- Escritorio: shell con marca, navegación lateral Inicio/Pasaportes/Partidos y contenido principal. Móvil: cabecera compacta y barra inferior de tres destinos; reservar área segura, espacio para scroll y foco visible, sin tapar la última tarjeta.
- Los tres destinos mantienen selección actual perceptible por color **y** semántica. Los detalles de pasaporte y partido conservan retorno comprensible al origen. El enlace de Inicio a Partidos es “Ver calendario”; tarjetas de partido usan “Abrir partido” o “Ver partido”.
- La vista no ofrece aprobación, programación, cambio de custodia, captura, carga ni publicación. Las acciones ilustrativas “Continuar” y “Ver historial” no aparecen como controles operativos; “Borrador guardado” y tarjetas de análisis realizados no se simulan.
- Los PNG muestran nombres ilustrativos. La etiqueta principal usa el nombre real del jugador proyectado tras comprobar custodia actual, nunca el nombre de ejemplo ni la referencia enmascarada como sustituto. No mostrar número/tipo de identificación, documento, evidencia u otros campos civiles. Solo el detalle del pasaporte muestra los canales disponibles del contacto autorizado: adulto titular para origen personal adulto; representante legal vigente para menor personal; responsable vigente de academia para origen academia adulto o menor. Etiquetar teléfono y correo por separado, sin priorizar uno cuando ambos existan. Si no hay persona inequívoca o ningún canal, mostrar «Contacto no disponible»; no sustituir por contacto directo de menor, cuenta adicional de academia ni otro tercero.
- El texto “Orden propuesto ... pendiente de aprobación” de la agenda es ilustrativo y no crea una acción ni un estado. Agrupar por fecha confirmada, sin inventar prioridad o filtro de producto.

## Estados por superficie

| Estado | Presentación y protección |
|---|---|
| Carga | Región identificada por vista, sin tarjetas retenidas de otra identidad; indicador accesible. |
| Vacío legítimo | Pasaportes sin custodias o Partidos sin registros; mensaje distinto de error o fuente ausente. Próximos/Pendientes vacíos si la lectura válida no los contiene. |
| No disponible | Análisis realizados permanece visible con explicación de fuente no disponible; no muestra cero histórico ni “Ver historial”. Una falla de servicio también se diferencia de lista vacía. |
| Error recuperable | Mensaje seguro y reintento de consulta; al reintentar se vuelve a comprobar autoridad. |
| Acceso restringido | Sin datos protegidos previos, sin detalles de ID ajeno, retorno a destino seguro. |

## Accesibilidad y evidencias

- Web escritorio y viewport móvil: tabulación por shell, secciones, tarjetas y acciones; orden de foco comprensible, indicador visible, encabezados semánticos, nombres accesibles de enlaces/botones, estados/avisos anunciables y contraste verificable. No se exige voz nativa.
- Revisar las seis pantallas reales autenticadas frente a sus PNG, con capturas en ambos tamaños. Registrar diferencias justificadas (valores reales del nombre, contacto solo en detalle autorizado, secciones sin fuente y acciones no operativas) y corregir recortes, solapamientos o pérdida de foco. Comprobar que el contacto desaparece al perder custodia y que «Contacto no disponible» no revela qué tercero faltó.
- Probar revocación de custodia/rol con pantalla abierta, recarga, enlace directo y restauración: limpiar datos de la vista y no reutilizar proyecciones protegidas.
