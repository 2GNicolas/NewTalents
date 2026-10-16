# Quickstart de verificación: espacio de trabajo del Analista

Guía de validación para después de la implementación; este documento no afirma que Feature 010 funcione ya. Referencias: `spec.md`, `data-model.md`, `contracts/analyst-workspace.openapi.yaml` y `contracts/analyst-workspace-ui.md`.

## Preparación

1. Usar Node 24/npm 10 y el PostgreSQL local de pruebas del proyecto. Emplear una base **aislada y temporal**, con migraciones existentes, no la base de trabajo. Ejecutar las suites que comparten PostgreSQL **secuencialmente**. El patrón actual de creación/limpieza está en `apps/backend/test/integration/run-feature-009-foundation.mjs`; una verificación de Feature 010 deberá añadir su suite a un runner seguro o utilizar una base aislada equivalente, sin modificar la base ordinaria.
2. Crear solo datos sintéticos: Analista con identidad/rol/perfil activos; segundo Analista; pasaportes `ACTIVE` propios y ajenos, uno sin custodia y uno no activo. Para contactos, preparar personal adulto `SELF`, personal de menor con representante vigente, academia adulta y menor con responsable vigente, cuenta adicional y representante separado; probar ambos canales, solo teléfono, solo correo, ninguno, responsable ausente/ambiguo y revocación. Añadir primer partido `WAITING` de Feature 009 antes/en/después de la hora local; partido reagendado, cancelado y `LOADED` mediante rutas/puerto existentes. No introducir partidos posteriores ficticios ni análisis/borrador.
3. Usar la autenticación real de la app para la revisión web. No usar parámetros de previsualización visual ni respuestas HTTP inventadas como evidencia de autorización o diseño en ejecución.

## Comprobaciones enfocadas después de implementar

Desde la raíz del repositorio:

```powershell
npm run verify:toolchain
npm run typecheck
```

Ejecutar solo las suites de contrato, integración y frontend de Feature 010 que se creen durante implementación, siguiendo los scripts de `apps/backend/package.json` y `apps/frontend/package.json`. Las pruebas PostgreSQL deberán correrse con `DATABASE_URL` apuntando a la base temporal y limpiarla al terminar; no usar en paralelo el runner de Feature 009 sobre la misma base. No se invocan ahora porque aún no existen esos tests.

| Área | Recorrido | Resultado exigido |
|---|---|---|
| Autorización y contrato | Consultar cada endpoint como Analista propio, ajeno, sin rol, con identidad inactiva y sin sesión; abrir IDs inexistentes y ajenos | Solo `ACTIVE` bajo custodia actual; `401/403/404` seguros, ID ajeno e inexistente indistinguibles; `no-store`; nombre autorizado solo para recursos propios, sin otros campos civiles o administrativos. |
| Pasaportes | Listar cartera con enriquecimiento distinto, abrir tarjeta y retirar/cambiar custodia | No se filtra por `AWAITING_ANALYST_ENRICHMENT`; aparece solo la propia; detalle deja de responder tras revocación; cliente elimina selección anterior. |
| Partidos | Leer primer `WAITING` real y luego reagendar/cancelar/cargar; recargar agenda y detalle | Datos confirmados actuales, sin escritura por `GET`; cancelado sale de agenda, `LOADED` muestra solo estado seguro; ningún partido posterior ficticio. |
| Inicio y reloj | Fijar reloj en `America/Bogota` un instante antes, exactamente en y después de `matchDate + matchTime`; repetir tras carga válida | Antes solo Próximos; desde igualdad solo Pendientes mientras `WAITING`; tras `LOADED` ninguno de ambos; Análisis realizados no disponible sin fuente aprobada. No doble conteo. |
| Privacidad y contacto | Para adulto personal, menor personal y academia adulta/menor, consultar detalle con persona vigente única, canal único o ambos, cuenta adicional, representante de menor de academia, ausencia y ambigüedad; revocar rol/custodia con pantalla abierta | Nombre del jugador propio y solo teléfono/correo disponibles de la persona definida por FR-012 en `contact: AVAILABLE`; canal ausente se omite y ambos aparecen si existen. Sin responsable inequívoco o sin canales, `contact: UNAVAILABLE` sin valores; nunca contacto directo del menor ni cuenta adicional. No se exponen identificación, documento, fecha de nacimiento, evidencia, contactos alternativos, historial administrativo, cupo o métricas. Tras denegación se borran nombre y contacto. |
| Extensión de fuente | Verificar contrato del adaptador con una fuente futura sintética **solo a nivel de test de interfaz**, no filas de producción | El orden del partido no altera elegibilidad; Feature 010 no inserta partidos ni muestra resultados de una fuente que no existe. |

## Revisión web visual y accesible

1. Levantar API y web con el entorno local aprobado (`npm run dev:backend`, `npm run dev:frontend:web`) y entrar con Analista de prueba autorizado. Recorrer Inicio → Pasaportes → detalle → Partidos → detalle del partido mediante rutas reales.
2. Capturar Inicio, Pasaportes y Partidos en tamaño escritorio y viewport móvil; comparar, respectivamente, con los seis PNG enumerados en `contracts/analyst-workspace-ui.md`. Registrar jerarquía, navegación lateral/inferior, áreas seguras, recorte, desplazamiento, acciones y cada discrepancia justificada. No tratar tests unitarios, typecheck ni export web como comparación visual.
3. Solo con teclado, verificar secuencia y foco visible para las tres vistas y los detalles. Revisar nombres/roles/estados en el árbol de accesibilidad web. Ejercitar carga, vacío legítimo, error recuperable, acceso restringido e indisponibilidad en ambos tamaños sin reutilizar detalles previos.
4. Mantener Análisis realizados visible pero no disponible; no mostrar tarjetas de ejemplo, borradores ni botones funcionales de continuación/historial. Mostrar el nombre real autorizado en lugar de los nombres ilustrativos; no usar la referencia enmascarada como sustituto. En el detalle del pasaporte mostrar teléfono y correo disponibles de la persona autorizada; si la persona no es inequívoca o carece de canales, «Contacto no disponible» sin revelar terceros.

## Criterios de cierre

Reconciliar US1–US4, FR-001–014 y SC-001–007 con evidencias separadas de contrato, PostgreSQL, frontend y ejecución web. Registrar **pasó / falló / no verificado** por criterio; la aprobación del spec y la generación del plan no son verificación de la feature. No atribuir a esta entrega la existencia de partidos posteriores, análisis confirmados, borradores, captura, FEM, pagos o publicación. La prueba positiva de contacto debe incluir identidad de origen, vínculo vigente y atribución de cada canal; no asumir que un teléfono antiguo fue actualizado.
