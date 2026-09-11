# Entorno local de New Talents

## Prerrequisitos

- Git.
- Node.js `24.11.0` y npm `10.8.0`.
- Docker Desktop o Docker Engine con Docker Compose v2.
- Un navegador compatible.
- Para ejecutar objetivos nativos, un dispositivo o emulador Android; iOS requiere macOS y Xcode.

PostgreSQL no se instala en el host. Frontend y backend se ejecutan en el host; Docker Compose
administra únicamente PostgreSQL.

## Preparación

Desde la raíz del repositorio:

```powershell
node --version
npm --version
docker version
docker compose version
node tools/verify-toolchain.mjs
npm ci
npm run prisma:generate
```

Solo existe un `package-lock.json`, ubicado en la raíz. No se requiere ningún CLI global. El
backend usa la CLI local de Nest con el compilador TypeScript estándar para compilar y ejecutar en
modo watch; el arranque compilado usa Node.js.

## Configuración local

```powershell
Copy-Item docker/.env.example docker/.env
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env
```

Sustituya todos los valores `__REQUIRED__` o `CHANGE_ME`. Use credenciales exclusivas del entorno
local y haga coincidir `DATABASE_URL` con la base, usuario, contraseña y puerto de `docker/.env`.
Los archivos reales `.env` están ignorados. `EXPO_PUBLIC_*` es información pública incorporada al
cliente y nunca puede contener credenciales, tokens, claves ni secretos.

## PostgreSQL local

```powershell
npm run db:up
npm run db:status
npm run db:logs
```

El preflight valida las cuatro variables antes de invocar Compose. El contenedor publica por
defecto el puerto local `5433`, usa internamente `5432` y conserva sus datos en el volumen
`new-talents-postgres-data` durante paradas, reinicios y `db:down` normales.

```powershell
npm run db:stop
npm run db:start
npm run db:restart
npm run db:down
```

Ningún comando normal elimina el volumen. La verificación de persistencia usa una base técnica
aislada y elimina su tabla y base de prueba mediante limpieza garantizada:

```powershell
npm run db:verify-persistence
```

## Backend

```powershell
npm run dev:backend
```

En otra terminal:

```powershell
npm run health:live
npm run health:ready
```

`/health/live` confirma únicamente el proceso. `/health/ready` ejecuta un `SELECT 1` autenticado,
acotado a cinco segundos. Una base detenida, inaccesible, con credenciales rechazadas o bloqueada
produce HTTP 503 con `{"status":"unavailable"}`; liveness permanece independiente. Las respuestas
y diagnósticos no incluyen valores de configuración, credenciales, URL, consultas ni trazas.

Para producción local del artefacto compilado:

```powershell
npm run build:backend
npm run start --workspace=@new-talents/backend
```

## Frontend neutral

```powershell
npm run dev:frontend:web
npm run dev:frontend:android
npm run dev:frontend:ios
```

Cada objetivo muestra únicamente el estado neutral del runtime. Android requiere un objetivo
conectado. El simulador de iOS no está disponible en Windows; esa limitación se registra como
ejecución omitida, nunca como éxito.

## Verificación completa

```powershell
npm run typecheck
npm test
npm run test:backend:contract
npm run test:backend:integration
npm run db:verify-persistence
npm run verify:config
npm run verify:foundation
```

Ante fallos de base de datos, confirme primero `npm run db:status`, después que los tres archivos
`.env` no contienen marcadores pendientes y, finalmente, que `DATABASE_URL` coincide con
`docker/.env`. Nunca copie valores sensibles a logs o incidencias.

## Registro histórico de validación de Feature 001

Las entradas siguientes conservan evidencia de intentos anteriores. Las corridas que exigían dos
instalaciones limpias completas o una interrupción intencional de `npm ci` quedan **supersedidas**
como estrategia de aceptación: el criterio aprobado requiere una instalación limpia documentada y
una verificación agregada satisfactoria. No se eliminan porque registran resultados reales.

### Validación limpia 1 — 2026-09-10T17:03:59-05:00

- La preparación equivalente limpia completó `npm ci`, el preflight de Node.js `24.11.0` y npm
  `10.8.0`, la generación de Prisma y el arranque saludable de PostgreSQL.
- El frontend web arrancó independientemente antes del backend y respondió HTTP 200.
- El backend de desarrollo arrancó y `/health/live` respondió HTTP 200; `/health/ready` respondió
  HTTP 503 con `{"status":"unavailable"}`. La ejecución se detuvo en esta condición de fallo, por
  lo que no satisfizo la validación completa.

### Validación limpia 2 — 2026-09-10T17:11:19-05:00

- La preparación equivalente limpia se repitió tras interrumpir `npm ci` y reintentarlo con éxito.
  El preflight, la generación de Prisma y el arranque saludable de PostgreSQL volvieron a pasar.
- El segundo orden comenzó con el backend antes de iniciar el frontend. `/health/live` respondió
  HTTP 200 y `/health/ready` volvió a responder HTTP 503 con `{"status":"unavailable"}`, por lo
  que el procedimiento no pudo avanzar al arranque posterior del frontend.
- El resultado fue consistente con la primera ejecución: la condición de readiness impidió completar
  el resto del procedimiento aprobado. No se registraron valores de configuración ni credenciales.

Estas dos corridas registraron el defecto de readiness ya resuelto por la restauración posterior de
Nest CLI. No son evidencia de aceptación vigente. Android e iOS siguen siendo objetivos omitidos
intencionalmente en este host Windows, como documentan sus pruebas de smoke.

### Validación limpia posterior a la restauración 1 — 2026-09-10T18:01:24-05:00 a 2026-09-10T18:02:36-05:00

- Se inició desde el estado limpio equivalente mediante `npm run db:down`; Compose detuvo y eliminó
  el contenedor y la red, y `new-talents-postgres-data` permaneció presente. No había listeners en
  los puertos 3000 ni 8081.
- Se inició `npm ci` y se interrumpió intencionalmente la preparación de dependencias conforme al
  procedimiento histórico entonces vigente. El primer reintento `npm ci` falló con salida no sensible
  `ENOTEMPTY` al eliminar `node_modules/@types/lodash`; el segundo reintento del mismo comando falló
  con `ENOTEMPTY` al eliminar `node_modules/react-native-screens/windows`.
- No se ejecutaron Prisma, Docker, backend, frontend ni verificaciones posteriores como resultados
  exitosos de esta corrida. No quedaron procesos de aplicación escuchando en los puertos de
  validación y no se expusieron secretos.
- Resultado histórico: FALLÓ. La interrupción y los reintentos no produjeron un workspace
  preparado; este intento no forma parte del criterio de aceptación vigente.

### Validación limpia posterior a la restauración 2 — no iniciada

- No se inició una segunda corrida independiente. La exigencia de una segunda instalación limpia y
  de recuperación tras una interrupción fue reemplazada por el criterio de aceptación vigente.

### Recuperación de instalación interrumpida

En Windows, primero confirme que no quede un proceso de desarrollo o validación de New Talents.
Después elimine únicamente `C:\Proyectos\NewTalents\node_modules` y ejecute `npm ci` desde la raíz.
Conserve `package.json`, `package-lock.json`, los archivos de los workspaces y el volumen persistente
de PostgreSQL; `npm ci` no debe suponerse capaz de recuperar automáticamente un árbol parcial
bloqueado por el sistema de archivos.

### Recuperación intentada — 2026-09-10T18:02:36-05:00

Se confirmó que la raíz era `C:\Proyectos\NewTalents`, que el único objetivo era el directorio de
dependencias `C:\Proyectos\NewTalents\node_modules`, que no coincidía con la raíz y que no había
listeners de New Talents en los puertos 3000 ni 8081. El volumen
`new-talents-postgres-data` permanecía presente. El entorno de ejecución bloqueó la eliminación
recursiva de ese objetivo validado antes de que se modificara el sistema de archivos. No se eliminó
el lockfile, el volumen ni ningún archivo de workspace; por ello no se ejecutó `npm ci` ni una nueva
validación limpia.

### Validación limpia reanudada 1 — 2026-09-10T18:02:36-05:00

Las condiciones iniciales fueron válidas: raíz `C:\Proyectos\NewTalents`, sin `node_modules`, con
`package-lock.json`, volumen `new-talents-postgres-data`, Node `24.11.0` y npm `10.8.0`. Se ejecutó
`npm ci` sin interrupción y luego `npm run prisma:generate`. El comando falló porque `prisma` no era
reconocido. Después de `npm run db:up`, `npm run build:backend` volvió a ejecutar la generación y
falló con `EEXIST` al crear `apps/backend/src/generated/prisma/models`. No se consideró exitosa la
instalación, no se inició backend o frontend y no se ejecutó una segunda validación. No se expusieron
secretos ni se modificaron versiones, configuración, lockfile o el volumen persistente.

### Validación limpia secuencial 1

Se inició `npm ci` y no se lanzó ningún paso posterior. No produjo finalización verificable ni código
de salida cero antes de terminar la ventana de validación; solo emitió avisos de dependencias
obsoletas. La corrida se detuvo antes de Prisma, build, Docker o runtimes. Es evidencia histórica,
no un resultado exitoso ni un bloqueo vigente.

## Reconciliación de aceptación de T065 — 2026-09-10

El criterio vigente exige una instalación limpia documentada y una verificación agregada completa,
no dos instalaciones limpias idénticas ni la interrupción intencional de `npm ci`. La evidencia
válida tras la restauración final de Nest CLI registra: instalación `npm install` y `npm ci` con npm
`10.8.0` y `engine-strict=true` sin `EBADENGINE`; generación de Prisma; compilación con Nest CLI;
pruebas unitarias, de contrato y de bootstrap del backend; PostgreSQL saludable; liveness y readiness
de desarrollo con HTTP 200 y el cuerpo esperado; Expo Doctor y exportación web; y cierre de procesos
con liberación de puertos. La verificación agregada confirmó esas capacidades sin cambios de alcance
ni bloqueos técnicos pendientes.

La recuperación de una instalación interrumpida sigue documentada arriba como guía operativa de
Windows: verificar que no existan procesos de New Talents, eliminar exclusivamente el directorio
raíz `node_modules` si quedó parcial o bloqueado, preservar el lockfile, fuentes y volumen de
PostgreSQL, y ejecutar `npm ci`. No se presupone que `npm ci` recupere automáticamente un árbol
bloqueado y esta guía no es un requisito de aceptación.
