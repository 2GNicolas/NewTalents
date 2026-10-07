# Quickstart Validation: Feature 007

## Purpose

Validar el alcance aprobado de Feature 007 con datos exclusivamente sintéticos, sin ejecutar ni alterar el flujo de creación/aprobación de Feature 006 fuera de su uso normal. Este documento define la futura aceptación; no se ejecutó durante planificación.

## Preconditions

- PostgreSQL local aislado con migraciones hasta Feature 007 aplicadas.
- Backend y Expo web apuntando al mismo entorno de prueba.
- Una identidad Administrador activa con capacidades de solicitudes, expedientes y custodia.
- Dos identidades Analista activas con perfiles operativos `Analista A` y `Analista B`.
- Una tercera identidad con etiqueta ANALYST visible pero sin rol/perfil/estado suficiente para comprobar fail-closed.
- Solicitudes sintéticas en cada grupo operativo y, al menos, un caso de cada uno de los siete tipos.
- Expedientes confirmados suficientes para tres páginas y resultados con estados derivados `CONFIRMED`, `DELETION_PENDING`, `RECOVERY_REQUIRED` y `APPROVED`.
- Dos pasaportes `ACTIVE` + `AWAITING_ANALYST_ENRICHMENT` producidos por aprobaciones existentes; uno sin custodia y otro asignado.
- Cero documentos o identidad personal real.

## Suggested focused commands for implementation phase

```powershell
npm run test:unit --workspace=@new-talents/backend -- passport-custody admin-dossier admin-registration-query passport-authorization
npm run test:contract --workspace=@new-talents/backend -- admin-custody
npm run test:integration --workspace=@new-talents/backend -- passport-custody administrator-dossiers analyst-custody-access
npm run test:unit --workspace=@new-talents/frontend -- administrator
```

Las suites PostgreSQL de concurrencia se ejecutan secuencialmente con clientes independientes. La validación completa del repositorio se reserva para el gate final de implementación, no para cada iteración.

## Mandatory journeys

### 1. Cinco grupos operativos de solicitudes

1. Iniciar sesión como Administrador y abrir `Solicitudes`.
2. Confirmar `Nuevas`, `Continuar revisión`, `Requieren corrección`, `Listas para decisión` y `Esperando verificación de eliminación de evidencias`.
3. Verificar en cada tarjeta únicamente referencia enmascarada, etiqueta permitida, tipo, fecha/contexto y siguiente acción.
4. Abrir la vista completa, filtrar y volver conservando contexto.

**Expected**: ninguna tarjeta expone documentos, contactos, evidencia o datos de duplicados.

### 2. Regresión de acciones Feature 006

1. Desde cada grupo, abrir la acción siguiente.
2. Ejecutar en casos separados revisión, corrección, rechazo, aprobación y reintento de eliminación usando los endpoints existentes.
3. Comparar resultado y eventos con el contrato Feature 006.

**Expected**: no hay endpoint alternativo de decisión ni cambio en reglas, estados o resultados.

### 3. Lista independiente de expedientes

1. Abrir `Expedientes` directamente desde el menú.
2. Recorrer siguiente/anterior en tres páginas sin cambiar datos.
3. Buscar por referencia enmascarada y nombre permitido.
4. Filtrar por estado derivado, tipo de origen y rango de confirmación.

**Expected**: cada expediente confirmado autorizado aparece exactamente una vez; orden `(confirmedAt, id)` estable.

### 4. Detalle, vínculos, privacidad y recuperación de consulta

1. Abrir un expediente con pasaporte y otro cuyo tipo no produce pasaporte.
2. Revisar referencia/nombre permitido, estado, historial, solicitud y vínculo de pasaporte o `No aplica`.
3. Navegar a solicitud y pasaporte; volver.
4. Simular lista vacía, cero coincidencias y error recuperable.

**Expected**: filtros/página/scroll se restauran; evidencia eliminada, categorías transferidas, documentos, contactos y credenciales están ausentes.

### 5. Asignación inicial desde Custodia

1. Localizar un pasaporte sin Analista por nombre permitido y referencia.
2. Ver cargas actuales de Analista A y B.
3. Seleccionar Analista A, escribir motivo sintético y confirmar.

**Expected**: custodia versión 1, un evento `ASSIGNED`, desaparece de Sin asignar, carga de A +1 y acceso inmediato para A.

### 6. Asignación desde solicitud aprobada

1. Abrir una solicitud aprobada que produjo pasaporte.
2. Activar su acceso a custodia.

**Expected**: abre el mismo detalle/proceso del pasaporte existente; no crea pasaporte ni expediente nuevo.

### 7. Cancelación y validación de motivo

1. Seleccionar un destino por drop en escritorio y cancelar.
2. Repetir con botón/teclado y tratar de confirmar sin motivo.

**Expected**: ningún comando en cancelación; motivo se anuncia como requerido; estado, carga, acceso e historial no cambian.

### 8. Cambio de custodia

1. Abrir el pasaporte asignado a A.
2. Seleccionar B, confirmar con motivo.

**Expected**: una custodia vigente para B, evento único `CHANGED`, carga A -1, carga B +1, A pierde acceso y B lo obtiene inmediatamente.

### 9. Retiro de custodia

1. Confirmar retiro del pasaporte asignado a B.

**Expected**: estado `UNASSIGNED`, evento único `REMOVED`, carga B -1 y ningún Analista puede abrirlo por custodia.

### 10. Carrera entre Administradores

1. Dos sesiones leen el mismo pasaporte sin asignar y versión 0.
2. Confirman destinos diferentes simultáneamente.

**Expected**: un commit aplicado; una sola custodia/evento; el perdedor recibe `CUSTODY_CONFLICT` con estado mínimo actual y puede actualizar.

### 11. Fallo e idempotencia

1. Simular fallo transaccional antes del commit.
2. Verificar estado anterior completo.
3. Reintentar con la misma clave/intención hasta éxito.
4. Repetir la petición aplicada y luego reutilizar la clave con otro destino.

**Expected**: éxito exactamente una vez; replay devuelve resultado; reutilización distinta devuelve `IDEMPOTENCY_CONFLICT`; sin eventos duplicados.

### 12. Acceso del Analista por custodia vigente

1. Asignar a A, abrir lista/detalle como A y B.
2. Cambiar a B y repetir.
3. Retirar y repetir.
4. Intentar con identidad que solo aparenta rol.

**Expected**: únicamente el Analista vigente lista/abre; denegación y no existencia son indistinguibles; JWT/etiqueta visible no basta.

### 13. Responsividad, accesibilidad y visuales

1. Ejecutar Solicitudes, Expedientes lista/detalle, Custodia workspace/detalle en ancho escritorio y móvil.
2. Completar acciones con teclado y lector, foco visible, movimiento reducido y sin color como única señal.
3. Comparar exclusivamente las 12 referencias de `docs/design/admin-custody/`.

**Expected**: navegación Inicio/Solicitudes/Expedientes/Custodia, sin “Administrador autorizado”; drop solo selecciona; alternativa accesible completa; sin scroll horizontal obligatorio.

## Privacy canaries

Inyectar valores sintéticos únicos en documento civil, correo, teléfono, object key, digest, nombre de evidencia y credencial. Buscar los canarios en:

- respuestas de lista/detalle;
- errores y conflictos;
- historial de custodia;
- logs/trazas;
- estado persistido del frontend.

**Expected**: cero apariciones. Verificar además que un expediente con eliminación completada no permite recuperar evidencia por ningún vínculo de Feature 007.

## Exit criteria

- Los 13 recorridos pasan.
- Contratos y proyecciones no contienen campos fuera del mínimo aprobado.
- Carreras e idempotencia producen una autoridad y un evento.
- La revocación del Analista es inmediata.
- Feature 006 conserva resultados y endpoints.
- No se implementan confirmación/edición de expedientes, enriquecimiento, asignación automática/masiva ni datos deportivos.
