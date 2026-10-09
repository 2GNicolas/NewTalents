# Frontend State Contract: Administrator operations

## Shared administrator shell

Destinations: `Inicio`, `Solicitudes`, `Expedientes`, `Custodia`.

- Desktop: sidebar persistente.
- Mobile: navegación inferior con cuatro destinos; menú secundario solo cuando la referencia lo requiere.
- La ruta se habilita por capacidades proyectadas por backend, no por texto de rol.
- Nunca se muestra “Administrador autorizado”.
- Cambiar de sección limpia selecciones temporales y conserva únicamente estado de consulta serializable.

## Requests workspace

```text
idle -> loading -> ready | empty | restricted | unavailable | error
ready -> filter/search -> loading
ready -> open request -> existing Feature 006 route
```

Cada tarjeta usa `operationalGroup` y `nextAction` del backend. El frontend no reimplementa reglas para decidir si una solicitud puede corregirse, rechazarse o aprobarse.

La vista completa conserva filtros y scroll al volver. Un resultado de decisión invalida la fila y vuelve a consultar los grupos.

## Dossier list/detail

List state:

```text
idle -> loading -> ready | empty | no-results | restricted | unavailable | error
ready -> next page -> loading-more -> ready
ready -> open detail -> detail-loading
```

Persisted navigation state (en router params o store efímero del shell):

- búsqueda;
- estado, tipo y rango de fecha;
- pila de cursores visitados;
- índice de página;
- desplazamiento.

No se persisten detalles de expediente, nombres, historial ni enlaces en almacenamiento durable del dispositivo.

Detail state:

```text
loading -> ready | restricted-or-missing | unavailable | error
ready -> open origin request | open linked passport | back to restored list
```

`linkedPassport.notApplicable=true` muestra “No aplica” y no crea destino. Ningún detalle ofrece editar, confirmar, aprobar o recuperar evidencia.

## Custody workspace

Server-owned state:

- páginas de pasaportes;
- Analistas elegibles y carga actual;
- custodia/versiones;
- historial y capacidades.

Ephemeral client state:

- pasaporte seleccionado;
- Analista destino;
- acción (`ASSIGN`, `CHANGE`, `REMOVE`);
- motivo no confirmado solo para `CHANGE` y `REMOVE`;
- modal/sheet de confirmación.

State machine:

```text
idle
  -> selecting-destination
  -> confirmation-open
  -> submitting
  -> applied -> refresh affected passport + analysts + counts
  -> conflict -> show current authority -> refresh -> idle
  -> recoverable-error -> confirmation-open | cancel

confirmation-open -> cancel -> idle (no request sent)
```

Un drop, click, toque o selección por teclado produce exactamente `confirmation-open`; nunca `submitting`.

## Interaction contract

### Desktop pointer

- El pasaporte puede arrastrarse sobre un destino elegible.
- Las zonas comunican nombre y estado de drop por texto/icono además de color.
- Soltar selecciona el destino y abre confirmación.
- Escape cancela arrastre/confirmación sin mutación.

### Keyboard and screen reader

- Cada tarjeta tiene acción `Asignar Analista` o `Cambiar Analista`.
- La acción abre una lista/modal con nombres accesibles y carga actual.
- Elegir destino abre la misma confirmación.
- El foco entra al título de confirmación; en cambio/retiro el error de motivo se anuncia, y al cancelar vuelve al disparador.

### Mobile

- No se presenta arrastre como requisito.
- `Asignar`/`Cambiar` abre selector y bottom sheet de confirmación.
- Objetivos táctiles y contenido no requieren desplazamiento horizontal.

### Reduced motion

- No hay animación necesaria para comprender selección o resultado.
- El movimiento del elemento puede sustituirse por cambio instantáneo de borde/texto.

## Confirmation contract

Must show:

- referencia enmascarada y nombre visible permitido del pasaporte;
- Analista actual o `Sin asignar`;
- destino seleccionado, excepto retiro;
- motivo obligatorio solo para cambio o retiro;
- Cancelar;
- Confirmar asignación/cambio/retiro.

El comando usa la versión recibida al abrir confirmación y una UUID idempotente estable durante reintentos de la misma intención. Cambiar pasaporte, destino o acción crea una intención nueva; para cambio/retiro, modificar el motivo también crea una intención nueva.

## Conflict and failure handling

- `CUSTODY_CONFLICT`: cerrar estado optimista, mostrar autoridad vigente devuelta y exigir una nueva selección.
- `IDEMPOTENCY_CONFLICT`: no reintentar automáticamente; generar nueva intención solo tras revisión del usuario.
- conectividad/5xx: conservar confirmación y clave para reintento seguro.
- denegado/no encontrado: limpiar datos del recurso y volver a la lista con mensaje mínimo.
- éxito: no mover tarjetas localmente como fuente de verdad; reconsultar filas y cargas afectadas.

## Analyst client behavior

La lista del Analista se obtiene de `/analyst/passports`. Al recibir denegación después de cambio/retiro, elimina la selección local y vuelve a cargar la colección. El frontend nunca conserva acceso porque el JWT aún contenga `ANALYST`.

## Visual authority

Solo se comparan:

- `administrator-home-desktop.png` / `administrator-home-mobile.png`
- `registration-requests-desktop.png` / `registration-requests-mobile.png`
- `dossiers-list-desktop.png` / `dossiers-list-mobile.png`
- `dossier-detail-desktop.png` / `dossier-detail-mobile.png`
- `passport-custody-workspace-desktop.png` / `passport-custody-workspace-mobile.png`
- `administrator-passport-detail-desktop.png` / `administrator-passport-detail-mobile.png`

Las acciones de confirmar/editar expedientes visibles en referencias no forman parte del contrato funcional; se conserva la composición visual con consulta de expedientes confirmados.
