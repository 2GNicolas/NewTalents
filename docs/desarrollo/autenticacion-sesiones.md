# Autenticación y sesiones

Feature 003 es exclusivamente backend. El cliente web no guarda ni presenta credenciales en esta
entrega. Los tokens y credenciales temporales nunca deben añadirse a registros, capturas, archivos
de entorno compartidos ni argumentos de comandos.

## Configuración local

Parta de `apps/backend/.env.example` y proporcione valores locales no-placeholder para las variables
JWT y los límites de autenticación. El inicio falla de forma cerrada si falta una configuración de
seguridad. No copie secretos a documentación ni comandos de shell.

## Operador de Administrador

Desde la raíz y únicamente en un terminal interactivo:

```powershell
npm run build:backend
npm run admin:initialize
npm run admin:recover
```

`admin:initialize` es válido sólo antes de cualquier asignación histórica de Administrator;
`admin:recover` sólo cuando no hay Administrator activo y elegible. Ambos inician un contexto de
Nest, no un listener HTTP. Solicitan el correo y la contraseña sin eco, muestran el modo y destino,
y requieren `CONFIRM`. No aceptan contraseñas como argumentos. Los códigos son `0` aplicado, `2`
rechazado/cancelado y `1` fallo operativo.

La entrega de una credencial temporal sigue siendo externa a la plataforma. No hay UI de login,
registro, recuperación de contraseña ni almacenamiento frontend de tokens.

## Retención

Las sesiones y el historial de refresh terminales son candidatos a limpieza después de 90 días;
las ventanas de intentos, 24 horas después de expirar. Los eventos de seguridad permanecen
inmutables y redactados.
