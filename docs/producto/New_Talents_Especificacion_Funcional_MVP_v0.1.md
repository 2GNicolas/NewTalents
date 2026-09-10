# Especificación funcional del MVP

- **Producto:** New Talents
- **Alcance:** Pasaporte deportivo digital, estadísticas, evaluación y contenido audiovisual
- **Documento:** Especificación funcional del producto mínimo viable
- **Versión:** 0.1
- **Estado:** Base funcional consolidada para validación e implementación
- **Fecha:** Septiembre de 2026

> **Propósito:** Definir qué debe hacer el MVP de New Talents y cuáles son sus reglas operativas. Este documento no fija arquitectura, tecnologías, infraestructura ni fórmulas matemáticas del modelo de evaluación.

## 1. Visión del producto

New Talents documenta la trayectoria deportiva de jugadores jóvenes mediante un pasaporte digital único que crece con cada partido. El producto reúne información futbolística, análisis estadístico, evaluación del rendimiento, evolución histórica y videos asociados al jugador.

El MVP está centrado en el jugador. Los tutores administran uno o varios pasaportes y las academias agrupan y gestionan temporalmente los pasaportes de sus jugadores. New Talents controla la aprobación, activación, análisis y publicación de la información deportiva.

## 2. Objetivos del MVP

- Crear y mantener un pasaporte deportivo único por jugador, sin duplicarlo cuando cambie de responsable o academia.
- Registrar partidos y convertir la observación manual del video en estadísticas y evaluaciones explicables.
- Mostrar la evolución del jugador mediante resultados acumulados, gráficas y comparaciones entre partidos.
- Centralizar videos completos y mejores momentos mediante enlaces externos asociados al pasaporte.
- Permitir la operación comercial mediante suscripciones individuales y planes para academias con control manual de pagos.

## 3. Alcance

### 3.1 Incluido

- Cuentas para tutores, academias y personal de New Talents.
- Creación, revisión, aprobación, corrección, activación, suspensión y reactivación de pasaportes.
- Administración de varios jugadores por tutor y de múltiples jugadores por academia.
- Registro de partidos por tutor o academia.
- Registro interno de eventos por analistas de New Talents.
- Publicación de estadísticas, evaluaciones, observaciones, evolución y comparaciones.
- Enlaces a videos completos alojados en YouTube y selección de mejores momentos.
- Perfil deportivo público accesible por búsqueda o enlace directo.
- Suscripciones por jugador, planes para academias, pagos manuales y estados de servicio.
- Solicitudes de traslado, modificación y corrección con historial de decisiones.
- Notificaciones funcionales asociadas a los principales cambios de estado.

### 3.2 Excluido del MVP

- Gestión de torneos, fixture, tablas de posiciones, convocatorias o cobertura integral de competiciones.
- Cuenta independiente para el jugador menor de edad.
- Visualización, reproducción o análisis del video dentro del flujo de trabajo del analista.
- Carga o almacenamiento directo de videos en la plataforma.
- Generación automática de clips por evento.
- Extracción automática de eventos mediante inteligencia artificial.
- Medición automática de velocidad, fuerza u otras variables que requieran sensores o procesamiento especializado.
- Pasarela de pagos, cobros automáticos y facturación electrónica.
- Red social, marketplace, bolsa de oportunidades o sistema avanzado de scouting.
- Fotografías, entrevistas, certificados, publicaciones o novedades como contenidos independientes.

## 4. Actores y responsabilidades

| **Actor**                 | **Responsabilidad funcional**                                                                                                                                                                                                                                 |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Tutor                     | Crea cuenta y solicitudes de pasaporte; administra varios jugadores; registra partidos; consulta información; solicita cambios, correcciones y traslados; autoriza publicidad cuando sea responsable; gestiona su estado de cuenta.                           |
| Usuario de academia       | Gestiona jugadores adscritos, datos deportivos y partidos; registra solicitudes; consulta resultados publicados; solicita correcciones; autoriza publicidad cuando la academia sea responsable. Todos los usuarios internos tienen el mismo acceso en el MVP. |
| Analista New Talents      | Registra y modifica eventos observados; selecciona mejores momentos; elabora observaciones; atiende solicitudes de modificación; participa en la preparación del análisis.                                                                                    |
| Administrador New Talents | Aprueba perfiles y traslados; activa, suspende y reactiva servicios; registra pagos; asigna trabajo; controla usuarios y estados; publica análisis y administra la operación general.                                                                         |
| Visitante público         | Busca jugadores o accede por enlace directo y consulta únicamente la información futbolística pública de pasaportes activos.                                                                                                                                  |

## 5. Conceptos y reglas transversales

**RN-01 — Pasaporte único.** Cada jugador tendrá un solo pasaporte permanente. Una nueva relación con una academia no crea otro pasaporte.

**RN-02 — Responsable activo.** El pasaporte tendrá un único responsable funcional activo: tutor o academia.

**RN-03 — Una academia activa.** Un jugador solo podrá estar adscrito a una academia a la vez.

**RN-04 — Pertenencia temporal.** Mientras exista una adscripción activa, el pasaporte pertenecerá funcionalmente a la academia y el tutor conservará acceso de consulta.

**RN-05 — Retorno al tutor.** Cuando termina la adscripción, el control del pasaporte vuelve automáticamente al tutor.

**RN-06 — Conservación histórica.** La salida de una academia no elimina partidos, evaluaciones, estadísticas, videos ni el historial de pertenencia.

**RN-07 — No eliminación por suspensión.** La suspensión oculta el pasaporte y detiene nuevos análisis, pero conserva íntegramente la información acumulada.

**RN-08 — Información futbolística pública.** La información relacionada con la trayectoria futbolística podrá ser pública; los datos sensibles, de identificación, contacto, acceso y pago serán privados.

**RN-09 — Publicación controlada.** Tutor y academia solo verán resultados deportivos después de que New Talents publique el análisis.

**RN-10 — Trazabilidad.** El sistema conservará quién realizó cada aprobación, publicación, corrección, traslado, activación, suspensión y registro de pago, junto con su fecha.

## 6. Estados funcionales

### 6.1 Solicitud de pasaporte

| **Estado**               | **Comportamiento**                                                                                                |
|--------------------------|-------------------------------------------------------------------------------------------------------------------|
| Borrador                 | El tutor o la academia completa la información inicial antes de enviarla.                                         |
| Pendiente de aprobación  | El solicitante solo puede consultar el estado; no puede modificar la información.                                 |
| Devuelto para corrección | New Talents indica los ajustes requeridos y el solicitante puede corregir y reenviar.                             |
| Aprobado                 | El pasaporte fue validado, pero el servicio todavía puede permanecer inactivo.                                    |
| Activo                   | New Talents activó manualmente el servicio; se pueden registrar partidos, realizar análisis y publicar el perfil. |
| Suspendido               | El perfil queda oculto, no recibe análisis y el responsable solo accede a estado de cuenta y pagos.               |

### 6.2 Análisis de partido

| **Estado**          | **Comportamiento**                                                                                              |
|---------------------|-----------------------------------------------------------------------------------------------------------------|
| Registrado          | Existe la información básica del partido y espera gestión de New Talents.                                       |
| En análisis         | Un analista registra y modifica eventos; los resultados no son visibles para tutor o academia.                  |
| Listo para publicar | El análisis fue finalizado internamente y espera publicación.                                                   |
| Publicado           | Las estadísticas, evaluaciones, observaciones y mejores momentos son visibles según los permisos del pasaporte. |
| En corrección       | Existe una solicitud de corrección sobre un análisis publicado.                                                 |
| Corregido           | New Talents aplicó la corrección y mantiene trazabilidad de la actualización.                                   |

## 7. Requisitos funcionales

### 7.1 Cuentas y acceso

**RF-CTA-01 — Registro de cuenta.** El tutor y la academia podrán crear una cuenta con credenciales de acceso.

**RF-CTA-02 — Tipo de cuenta.** La cuenta se identificará como tutor, academia o personal de New Talents.

**RF-CTA-03 — Varios jugadores por tutor.** Una cuenta de tutor podrá administrar múltiples jugadores.

**RF-CTA-04 — Varios usuarios por academia.** Una academia podrá tener varios usuarios internos y todos compartirán las mismas capacidades en el MVP.

**RF-CTA-05 — Datos de contacto.** Tutor y academia podrán actualizar directamente los datos de contacto de su propia cuenta.

**RF-CTA-06 — Datos restringidos.** Los cambios en información del jugador no serán directos: deberán enviarse como solicitud.

**RF-CTA-07 — Acceso del menor.** El jugador menor no tendrá cuenta propia; el acceso se realizará a través del tutor o de la academia responsable.

### 7.2 Creación y activación del pasaporte

**RF-PAS-01 — Solicitud inicial.** El tutor o la academia podrá registrar la información inicial del jugador y enviar la solicitud a New Talents.

**RF-PAS-02 — Control de duplicados.** Antes de aprobar, New Talents deberá poder identificar si el jugador ya posee un pasaporte y reutilizarlo en lugar de crear otro.

**RF-PAS-03 — Revisión.** New Talents podrá aprobar o devolver la solicitud para corrección, indicando el motivo.

**RF-PAS-04 — Bloqueo durante revisión.** Mientras la solicitud esté pendiente, el solicitante solo podrá consultar su estado.

**RF-PAS-05 — Corrección y reenvío.** Una solicitud devuelta podrá modificarse y enviarse nuevamente.

**RF-PAS-06 — Activación manual.** La aprobación no activará automáticamente el servicio. New Talents deberá realizar una activación manual.

**RF-PAS-07 — Estado visible.** El responsable podrá consultar el estado vigente del pasaporte y del servicio.

### 7.3 Información del pasaporte

**RF-DAT-01 — Identificación interna.** El pasaporte conservará los datos necesarios para identificar al jugador y evitar duplicados, sin exponerlos públicamente.

**RF-DAT-02 — Datos futbolísticos.** El pasaporte mostrará la información deportiva del jugador, incluida su posición, características futbolísticas, academia actual cuando aplique, partidos y trayectoria.

**RF-DAT-03 — Historial.** El pasaporte conservará cronológicamente las academias, partidos, análisis, evaluaciones, estadísticas y videos asociados.

**RF-DAT-04 — Solicitud de modificación.** Tutor o academia podrán solicitar cambios sobre la información del jugador.

**RF-DAT-05 — Aprobación de modificaciones.** Un analista de New Talents revisará y aprobará o rechazará las solicitudes de modificación.

**RF-DAT-06 — Trazabilidad de cambios.** El sistema conservará el valor anterior, el valor aprobado, el solicitante, el analista responsable y la fecha del cambio.

### 7.4 Adscripción y traslado a academia

**RF-ACA-01 — Solicitud del tutor.** El tutor podrá solicitar que el pasaporte sea trasladado a una academia.

**RF-ACA-02 — Aprobación de traslado.** New Talents aprobará o rechazará la solicitud de traslado.

**RF-ACA-03 — Restricción de simultaneidad.** El sistema impedirá que un jugador tenga más de una academia activa.

**RF-ACA-04 — Cambio de responsable.** Al aprobarse el traslado, la academia asumirá temporalmente el control funcional del pasaporte.

**RF-ACA-05 — Acceso del tutor.** Durante la adscripción, el tutor conservará acceso de consulta, sin edición ni gestión deportiva.

**RF-ACA-06 — Salida.** Al finalizar la relación con la academia, el control volverá automáticamente al tutor.

**RF-ACA-07 — Historial de adscripción.** Cada relación con una academia conservará fechas de inicio y fin y no alterará la historia deportiva previa.

### 7.5 Partidos

**RF-PAR-01 — Registro de partido.** El tutor o la academia responsable podrá registrar un partido para análisis.

**RF-PAR-02 — Datos obligatorios.** El registro inicial incluirá fecha, rival, competencia y lugar.

**RF-PAR-03 — Asociación.** Cada partido se asociará al jugador y al responsable que lo registró.

**RF-PAR-04 — Gestión deportiva de academia.** La academia podrá administrar los partidos y datos deportivos de los jugadores bajo su responsabilidad.

**RF-PAR-05 — Visibilidad de estado.** El responsable podrá consultar el estado operativo del partido sin acceder a eventos internos mientras el análisis esté en curso.

### 7.6 Registro interno de eventos

**RF-EVE-01 — Registro exclusivo.** Solo los analistas de New Talents podrán crear y modificar eventos observados en el video.

**RF-EVE-02 — Observación externa.** El analista verá el video por fuera de la plataforma y registrará manualmente los eventos en el sistema.

**RF-EVE-03 — Unidad de análisis.** Cada evento describirá una acción observable realizada por el jugador y no una percepción subjetiva.

**RF-EVE-04 — Referencia temporal.** Cada evento podrá registrar el minuto del partido.

**RF-EVE-05 — Resultado y contexto.** El evento podrá incluir resultado, contexto espacial, temporal, competitivo, de presión y posicional según la definición vigente del FEM.

**RF-EVE-06 — Complejidad y consecuencia.** El analista podrá registrar la complejidad y la consecuencia de la acción como componentes independientes.

**RF-EVE-07 — Evidencia.** El sistema conservará la relación entre evento, contexto, complejidad y consecuencia para sustentar la evaluación.

**RF-EVE-08 — Eventos internos.** El conjunto completo de eventos será información de trabajo interna y no se publicará íntegramente al tutor, academia o visitante.

### 7.7 Estadísticas y evaluación

**RF-EST-01 — Resumen por partido.** El sistema generará o almacenará un resumen estadístico a partir de los eventos registrados.

**RF-EST-02 — Evaluación explicable.** Las evaluaciones deberán estar respaldadas por evidencias observables del partido.

**RF-EST-03 — Capacidades y competencias.** El análisis publicado mostrará las capacidades y competencias evaluadas según el modelo vigente.

**RF-EST-04 — Observaciones.** El analista podrá incluir observaciones cualitativas sustentadas en el análisis.

**RF-EST-05 — Evolución.** El pasaporte mostrará la evolución del jugador mediante gráficas y comparaciones entre varios partidos.

**RF-EST-06 — Comparación.** El usuario podrá comparar resultados de partidos del mismo jugador sin comparar públicamente jugadores diferentes en el MVP.

**RF-EST-07 — Publicación.** Tutor y academia solo podrán consultar estadísticas y evaluaciones después de su publicación por New Talents.

**RF-EST-08 — Modelo versionado.** Cada análisis deberá conservar la versión del modelo de evaluación con la cual fue producido para mantener trazabilidad cuando el motor evolucione.

**RF-EST-09 — Fórmulas no fijadas.** El MVP admitirá que métricas, escalas, pesos y fórmulas evolucionen sin redefinir la gestión del pasaporte y los partidos.

### 7.8 Contenido audiovisual

**RF-VID-01 — Alojamiento externo.** Los videos completos se alojarán en YouTube; la plataforma conservará el enlace asociado al partido.

**RF-VID-02 — Responsable del enlace.** New Talents registrará y administrará el enlace del video.

**RF-VID-03 — Video del partido.** El pasaporte permitirá acceder al video completo desde el partido correspondiente.

**RF-VID-04 — Mejores momentos.** El analista seleccionará un subconjunto de eventos como mejores momentos visibles.

**RF-VID-05 — Minuto del momento.** Cada mejor momento mostrará el minuto aproximado del partido para localizarlo en el video.

**RF-VID-06 — Sin clip obligatorio.** El MVP no exigirá crear ni almacenar un clip independiente para cada evento o mejor momento.

**RF-VID-07 — Alcance de contenido.** El MVP no incluirá otros tipos de contenido distintos de videos y la información estadística y evaluativa relacionada.

### 7.9 Perfil público y descubrimiento

**RF-PUB-01 — Perfil público.** Un pasaporte activo y autorizado podrá estar disponible públicamente.

**RF-PUB-02 — Acceso.** El visitante podrá llegar al perfil mediante enlace directo o búsqueda dentro de la plataforma.

**RF-PUB-03 — Búsqueda.** La plataforma permitirá localizar jugadores usando criterios futbolísticos y datos públicos.

**RF-PUB-04 — Contenido visible.** El perfil público mostrará información futbolística, partidos publicados, estadísticas, evaluación, evolución, comparaciones y videos autorizados.

**RF-PUB-05 — Datos privados.** No se mostrarán documentos de identidad, credenciales, datos de contacto, información de pago ni otra información sensible.

**RF-PUB-06 — Autorización.** La publicación del perfil del menor será autorizada por el tutor o por la academia, según quién sea el responsable funcional en el caso aplicable.

**RF-PUB-07 — Suspensión.** Un pasaporte suspendido dejará de aparecer en búsquedas y no podrá consultarse mediante su enlace público.

### 7.10 Correcciones

**RF-COR-01 — Solicitud posterior.** Tutor o academia podrán solicitar la corrección de un análisis ya publicado.

**RF-COR-02 — Motivo.** La solicitud identificará el partido y describirá el posible error.

**RF-COR-03 — Resolución.** New Talents podrá aceptar, rechazar o solicitar información adicional.

**RF-COR-04 — Republicación.** Cuando se aplique una corrección, la versión actualizada sustituirá la información visible y conservará el historial interno.

### 7.11 Suscripciones, pagos y suspensión

**RF-PAG-01 — Suscripción individual.** New Talents podrá asociar una suscripción a un jugador administrado por un tutor.

**RF-PAG-02 — Plan de academia.** New Talents podrá asociar un plan a una academia y relacionar los jugadores cubiertos por dicho plan.

**RF-PAG-03 — Pago manual.** En el MVP, New Talents registrará manualmente cada pago y su estado.

**RF-PAG-04 — Consulta.** Tutor y academia podrán consultar el estado de su cuenta, plan, vigencia y pagos registrados.

**RF-PAG-05 — Activación independiente.** La confirmación del pago no activará automáticamente el pasaporte; New Talents conservará el control de activación manual.

**RF-PAG-06 — Suspensión.** Cuando el servicio venza o sea suspendido, el perfil se ocultará y no podrá recibir nuevos análisis.

**RF-PAG-07 — Acceso restringido.** Durante la suspensión, tutor o academia solo podrán consultar el estado de cuenta y los pagos.

**RF-PAG-08 — Reactivación.** New Talents podrá reactivar el mismo pasaporte sin perder historial ni crear uno nuevo.

### 7.12 Notificaciones

**RF-NOT-01 — Perfil.** Notificar la aprobación o devolución para corrección de una solicitud de pasaporte.

**RF-NOT-02 — Análisis.** Notificar la publicación de un análisis y la resolución de una solicitud de corrección.

**RF-NOT-03 — Pagos.** Notificar vencimientos, registros de pago, suspensión y reactivación del servicio.

**RF-NOT-04 — Traslado.** Notificar la aprobación, rechazo o ejecución de un traslado y el retorno del pasaporte al tutor.

**RF-NOT-05 — Destinatarios.** Enviar el aviso al tutor o a los usuarios de la academia según el responsable y el evento.

## 8. Flujos funcionales principales

### 8.1 Alta y activación de un pasaporte

1.  El tutor o la academia crea su cuenta e ingresa la información inicial del jugador.
2.  Envía la solicitud; el sistema la deja pendiente y bloquea su edición.
3.  New Talents revisa la información y verifica que el jugador no tenga otro pasaporte.
4.  Si hay inconsistencias, devuelve la solicitud con observaciones para que sea corregida y reenviada.
5.  Si es válida, la aprueba.
6.  New Talents registra el pago o plan aplicable cuando corresponda y activa manualmente el servicio.
7.  El pasaporte queda habilitado para registrar partidos y recibir análisis; su visibilidad pública depende de la autorización aplicable.

### 8.2 Partido, análisis y publicación

1.  El tutor o la academia registra fecha, rival, competencia y lugar.
2.  New Talents gestiona la grabación por fuera de la plataforma y publica el video en YouTube.
3.  New Talents agrega el enlace del video al partido.
4.  El analista observa el video externamente y registra eventos, contexto, complejidad, consecuencia y minuto.
5.  El sistema consolida las estadísticas y la evaluación conforme a la versión vigente del modelo.
6.  El analista agrega observaciones y selecciona los mejores momentos.
7.  New Talents publica el análisis.
8.  Tutor, academia y público autorizado consultan el contenido que corresponda a su nivel de acceso.

### 8.3 Traslado a una academia

1.  El tutor solicita el traslado del pasaporte a una academia.
2.  New Talents verifica que no exista otra academia activa.
3.  New Talents aprueba o rechaza la solicitud.
4.  Al aprobarse, la academia asume temporalmente el control y el tutor pasa a consulta.
5.  Al finalizar la relación, el control vuelve automáticamente al tutor y la adscripción queda en el historial.

### 8.4 Corrección de un análisis

1.  Tutor o academia identifica un posible error en un análisis publicado.
2.  Registra una solicitud asociada al partido y describe el caso.
3.  New Talents revisa la solicitud y determina si aplica la corrección.
4.  Si procede, actualiza el análisis, conserva la trazabilidad y publica la versión corregida.
5.  El responsable recibe la notificación de la decisión.

## 9. Información visible por actor

| **Información o acción**    | **Tutor**                      | **Academia**                   | **New Talents**    | **Público**           |
|-----------------------------|--------------------------------|--------------------------------|--------------------|-----------------------|
| Datos sensibles del jugador | Consulta según responsabilidad | Consulta según responsabilidad | Gestión autorizada | No                    |
| Datos de contacto y pagos   | Propios                        | Propios                        | Gestión            | No                    |
| Datos futbolísticos         | Consulta                       | Gestión de adscritos           | Gestión            | Sí                    |
| Registrar partido           | Sí, si responsable             | Sí, si responsable             | Sí                 | No                    |
| Eventos completos           | No                             | No                             | Sí                 | No                    |
| Mejores momentos            | Sí, publicados                 | Sí, publicados                 | Gestión            | Sí, si perfil público |
| Estadísticas y evaluación   | Sí, publicadas                 | Sí, publicadas                 | Gestión            | Sí, si perfil público |
| Solicitar corrección        | Sí                             | Sí                             | Gestiona           | No                    |

## 10. Criterios generales de aceptación del MVP

- Un jugador no puede terminar con dos pasaportes activos por efecto de una nueva solicitud o traslado.
- Un jugador no puede estar adscrito simultáneamente a dos academias.
- Una solicitud pendiente no puede ser editada por su creador.
- Un pasaporte aprobado no recibe análisis hasta que New Talents lo active.
- Tutor y academia no pueden crear ni modificar eventos del análisis.
- Un análisis no es visible antes de su publicación por New Talents.
- El perfil público nunca expone información sensible, de acceso, contacto o pago.
- La suspensión oculta el perfil, impide nuevos análisis y conserva todo el historial.
- La salida de una academia devuelve el control al tutor sin perder información.
- Cada análisis conserva la versión del modelo de evaluación utilizada.
- Los videos se referencian mediante enlaces de YouTube y no requieren almacenamiento interno.
- Los mejores momentos pueden localizarse mediante el minuto del partido sin exigir clips separados.

## 11. Definiciones pendientes que no bloquean el inicio

> **Criterio:** Estos elementos deben resolverse durante el refinamiento de cada módulo. Permanecen fuera de esta versión para evitar convertir supuestos en reglas definitivas.

| **Tema**          | **Pendiente**                                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------------------------------|
| Datos del jugador | Catálogo exacto de campos obligatorios, opcionales y validaciones.                                                        |
| Planes y precios  | Valores, periodicidad, límites de jugadores y reglas comerciales de renovación.                                           |
| Notificaciones    | Canales concretos: dentro de la aplicación, correo, mensajería u otros.                                                   |
| Perfil público    | Filtros exactos de búsqueda y catálogo definitivo de datos futbolísticos mostrados.                                       |
| Modelo FEM        | Catálogo final de eventos, escalas de contexto y complejidad, indicadores, pesos, fórmulas, rating y presentación visual. |
| Correcciones      | Tiempos de atención, responsables internos y causas de rechazo.                                                           |
| Suspensión        | Periodo de gracia y condiciones comerciales exactas de reactivación.                                                      |

## 12. Dirección funcional del producto

El MVP debe construirse alrededor del pasaporte permanente del jugador y de los flujos operativos que alimentan su trayectoria. La plataforma no necesita esperar a que el motor estadístico esté matemáticamente cerrado: puede iniciar con contratos funcionales estables para partidos, eventos, evidencias, análisis y publicaciones, mientras el FEM evoluciona de manera independiente.

La prioridad funcional es que New Talents pueda recibir jugadores, activar servicios, registrar partidos, producir análisis manuales, publicar resultados verificables y mantener la continuidad del historial cuando el jugador cambie de responsable o academia.
