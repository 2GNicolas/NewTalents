# Autenticación frontend

La aplicación Expo consume únicamente las cinco operaciones públicas de autenticación de la
Feature 003: inicio de sesión, activación de acceso inicial, renovación, cierre de la sesión
actual y cierre de todas las sesiones. No incluye registro, recuperación, MFA, administración ni
módulos de producto.

## Ejecutar en desarrollo

Desde la raíz del repositorio, con PostgreSQL y el backend ya configurados:

```powershell
npm run db:up
npm run dev:backend
npm run dev:frontend:web
```

El frontend necesita una URL pública no secreta para el backend:

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

No se deben poner contraseñas, credenciales temporales, tokens ni claves en variables
`EXPO_PUBLIC_*`.

## Material de sesión

- El token de acceso permanece solo en memoria.
- En Android e iOS, el material renovable se guarda mediante `expo-secure-store`.
- En web, el material renovable se guarda exclusivamente en `sessionStorage`, después de comprobar
  que está disponible. Nunca se usa `localStorage`.
- Si el almacenamiento web no está disponible, la aplicación continúa solo en memoria y no promete
  restaurar la sesión después de recargar.
- El cierre de sesión, una renovación rechazada o una sesión confirmada como inutilizable elimina
  el material local. Un fallo de conectividad o un 5xx mantiene la sesión potencialmente válida y
  muestra una opción de reintento.

Las credenciales de formularios se eliminan al completar, cancelar o abandonar sus flujos. La UI,
las rutas y los diagnósticos no muestran tokens ni secretos.

## Recorrido de revisión

1. Abra `http://localhost:8082` para el inicio de sesión y el enlace **Activar acceso inicial**.
2. Compruebe que los campos validan localmente y que las acciones no se duplican mientras se envía
   una solicitud.
3. En activación, la acción de éxito es **Continuar** y lleva al límite autenticado neutral; no
   vuelve al inicio de sesión.
4. En el límite autenticado, **Cerrar sesión** afecta solo al dispositivo actual. **Cerrar todas
   las sesiones** abre una confirmación antes de enviar la operación de mayor alcance.
5. Pruebe los estados de renovación, expiración, conectividad y servicio no disponible con las
   pruebas controladas; no use contraseñas, tokens ni credenciales temporales reales para revisar
   esos estados.

## Verificación automatizada

```powershell
npm run test:unit --workspace=@new-talents/frontend
npm run typecheck --workspace=@new-talents/frontend
npm run export:web --workspace=@new-talents/frontend
```

En Windows puede validarse Android con un emulador o dispositivo disponible. El simulador de iOS
requiere un host macOS; esa limitación no cambia el comportamiento compartido de la aplicación.
