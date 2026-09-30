# Checkpoint vertical inicial — Feature 006

Fecha: 2026-09-26
Alcance: T088–T095.

## Resultado del checkpoint

Los cuatro tipos iniciales completan el límite público soportado, establecen la sesión pendiente mediante autenticación real, ingieren evidencia sintética a estado `CLEAN`, registran los consentimientos requeridos y alcanzan un estado `SUBMITTED` persistido. El solicitante recibe únicamente su estado seguro; el Administrador autorizado puede listar, consultar y transmitir evidencia por el límite exclusivo; los demás actores fallan de forma cerrada.

| Jornada | Evidencia principal | Resultado |
|---|---|---|
| Persona adulta | Identidad frontal/reverso, consentimiento, envío idempotente, estado pendiente y consulta Admin | PASS |
| Menor representado | Teléfono obligatorio del representante, autoridad, evidencia legal y cero cuenta/contacto/sesión del menor | PASS |
| Academia formal | RUT, existencia y autoridad responsable; cero academia, rol o membresía mientras está pendiente | PASS |
| Academia de persona natural | Evidencia operativa, responsable y corrección segura sin afirmación de certificación | PASS |

También pasan la restauración frontend de sesión pendiente, la corrección/reenvío, la denegación de rutas ordinarias, el control optimista de versión, los reintentos idempotentes, la no duplicación de evidencia y la separación entre historial y auditoría de acceso.

## Estrategia de entorno

- PostgreSQL local saludable con las 13 migraciones vigentes y datos existentes preservados.
- Aplicación Nest real y límites reales de autenticación, autorización, persistencia e ingestión.
- Almacén privado y escáner limpios en memoria exclusivamente como dobles autorizados del proveedor; el pipeline de validación y decisión `CLEAN` no se omite.
- Fixtures sintéticos aislados y eliminados al finalizar cada archivo de prueba.

## Trabajo que sigue pendiente en Feature 006

Este checkpoint no completa Feature 006. Permanecen explícitamente pendientes:

- solicitudes de cuenta adicional para academias aprobadas;
- solicitudes de jugador adulto y menor desde academias aprobadas;
- interfaz exclusiva de revisión y decisión del Administrador;
- decisiones finales tipadas para los siete tipos;
- verificación final de los siete resultados, privacidad, compatibilidad y regresión.

Resultado final de Fase 8: **PASS**.
