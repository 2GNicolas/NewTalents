# Implementation Plan: Espacio de trabajo del Analista

**Branch**: `feature/010-analyst-workspace-foundation` | **Date**: 2026-10-15 | **Spec**: `specs/010-analyst-workspace-foundation/spec.md`

**Input**: Especificación aprobada por el propietario el 2026-10-15. Este documento diseña la entrega; no afirma que esté implementada.

## Summary

Ofrecer Inicio, Pasaportes y Partidos en un contexto web autenticado de Analista, de solo lectura y conforme a los seis PNG de `docs/design/analist/`. Una proyección backend nueva comprueba identidad/rol activos, pasaporte `ACTIVE` y custodia vigente en cada lectura, y expone nombre autorizado del jugador, referencias y datos operativos mínimos. El detalle del pasaporte añade teléfono y correo disponibles de la persona definida por origen y responsabilidad actual: titular adulto, representante legal de menor personal o responsable de academia; si no hay persona única, contacto no disponible. El adaptador de lectura usa `FirstMatch` de Feature 009 hoy; admite incorporar otras fuentes autoritativas sin crear partidos ni simularlas. Inicio clasifica cada `WAITING` una vez usando `America/Bogota`: antes del instante programado es próximo; desde ese instante hasta la carga válida es pendiente. Análisis realizados, borradores y acciones asociadas quedan no disponibles.

## Technical Context

**Language/Version**: TypeScript 5.9 (backend); TypeScript 6.0 y React 19/React Native 0.86 (frontend); Node 24 y npm 10 del repositorio.

**Primary Dependencies**: NestJS 11, Prisma 7, PostgreSQL y Zod 4; Expo 57/Expo Router y React Native Web. Se reutilizan autenticación, roles, custodia Feature 007, `FirstMatch` Feature 009 y el sistema visual existente.

**Storage**: PostgreSQL existente. Feature 010 no necesita tablas, migración, datos de borrador ni de análisis. Lee identidad/rol/perfil, pasaporte/custodia/partido y, solo para el detalle de contacto autorizado, responsabilidad actual, credencial de la persona y solicitudes aprobadas de origen que permitan atribuir un teléfono.

**Testing**: Vitest y Supertest para contrato/integación backend; PostgreSQL local en base de prueba aislada, suites secuenciales; Jest/React Native Testing Library para estado/rutas; verificación web autenticada en escritorio y viewport móvil con capturas, teclado, foco y árbol de accesibilidad.

**Target Platform**: API NestJS y experiencia Expo Router web de escritorio y viewport móvil. No se prescribe prueba nativa de voz en esta entrega.

**Project Type**: Monorepo con `apps/backend` y `apps/frontend`.

**Performance Goals**: Sin umbral de latencia inventado. Consultas de lista paginadas/acotadas y proyecciones de campos mínimos; medir comportamiento de navegación y recarga en las verificaciones enfocadas.

**Constraints**: Denegación por defecto y `404` indistinguible para IDs ajenos/inexistentes; respuestas `no-store`; nombre del jugador solo con custodia actual y teléfono/correo únicamente en detalle del pasaporte para la persona responsable vigente e inequívoca. No elegir cuentas adicionales de academia ni contactos de menores; si la persona no se identifica, no devolver valores. Sin número/tipo de identificación, otros campos civiles, contactos alternativos, historial administrativo, evidencias, métricas deportivas, cupo o mutaciones de partido. Una lectura de `LOADED` no significa análisis realizado.

**Scale/Scope**: Tres vistas, detalle autorizado de pasaporte y partido, una fuente de partido disponible (`FirstMatch`). Sin volumen de producción aprobado; evitar cargar toda la cartera en memoria y mantener paginación acotada.

## Constitution Check

*GATE reevaluado tras la regla de contacto del propietario: la selección por tipo de pasaporte está definida; se mantiene la denegación de valores cuando no haya relación actual e inequívoca.*

| Principio | Decisión / verificación de diseño |
|---|---|
| I–II, X–XI. Alcance aprobado y artefactos coherentes | La aprobación está en `spec.md`; este plan no crea programación, captura, FEM ni fuentes ficticias. `research.md`, `data-model.md`, contratos y `quickstart.md` registran decisiones y límites. |
| III–V. Pasaporte central e información respaldada | Toda fila deriva de pasaporte autorizado y partido confirmado; no se infiere análisis realizado de `LOADED`, ni un borrador de `WAITING`. |
| VI. Privacidad y autorización | Backend valida sesión, identidad, rol y custodia actual por recurso; lista y enlace directo minimizan campos. La UI nunca decide autoridad. |
| VII. Arquitectura explícita | Módulo de lectura acotado; adaptador Feature 009 hoy. Ningún nuevo servicio distribuido ni tabla especulativa. |
| VIII. Consistencia web | Las tres vistas conservan jerarquía de los seis PNG; sidebar escritorio, barra inferior móvil, estados y accesibilidad equivalentes. |
| IX. Verificación proporcional | Contrato, integración PostgreSQL, revocación, límites `America/Bogota`, frontend, privacidad y revisión visual autenticada incluidos en `quickstart.md`. |

**Riesgo visual/privacidad conocido**: la lista heredada de Feature 007 descifra `encryptedLegalName`, marca capacidades administrativas y filtra por `AWAITING_ANALYST_ENRICHMENT`. No sirve como DTO del nuevo espacio. La nueva proyección descifra únicamente el nombre después de autorizar cada recurso; no reutiliza capacidades administrativas ni el resto del perfil civil. La referencia enmascarada deja de ser sustituto del nombre. El contacto requiere comprobar el vínculo actual de la persona antes de consultar sus canales; `AcademyMembership` por sí sola no identifica al responsable. Cuando solo existe una solicitud antigua de academia sin responsable vigente inequívoco, no se reutiliza su contacto.

## Project Structure

### Documentation (this feature)

```text
specs/010-analyst-workspace-foundation/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/analyst-workspace.openapi.yaml
├── contracts/analyst-workspace-ui.md
└── quickstart.md
```

### Source Code (repository root; intended boundaries, not files created by this plan)

```text
apps/backend/src/
├── analyst-workspace/           # proyección de lectura, autorización por custodia y HTTP
├── passport-custody/            # reutilizar hechos de custodia; no exponer DTO administrativo
└── first-match/                # fuente Feature 009, sin cambiar comandos ni HTTP del responsable
apps/backend/test/
├── contract/analyst-workspace.contract.spec.ts
└── integration/analyst-workspace.integration.spec.ts
apps/frontend/
├── app/(authenticated)/analyst/ # Inicio, Pasaportes, Partidos y detalles de solo lectura
└── src/analyst-workspace/       # cliente tipado, estado efímero, navegación y superficies
```

**Structure Decision**: Mantener módulos y rutas dentro de las dos aplicaciones existentes. La entrada y política de rutas autenticadas se integrarán con el contexto de Analista sin tratar una capacidad visible o un rol del cliente como autorización. Preservar el cambio ajeno en `apps/frontend/app/_layout.tsx`; cualquier integración se planificará en archivos de ruta/política propios y, si surgiera una colisión inevitable, se revisará antes de editarlo.

## Phase 0: Research decisions

Ver `research.md`: (1) límites del endpoint heredado y nombre autorizado, (2) lectura consistente de custodia y partido, (3) adaptación futura sin datos simulados, (4) clasificación temporal, (5) rutas y estados de UI, (6) selección de titular/representante/responsable y fuentes de teléfono/correo. La fuente de partidos posteriores y la confirmación de análisis son dependencias futuras explícitas, no premisas para inventar filas ahora.

## Phase 1: Data model, contracts and UX

`data-model.md` define proyecciones de solo lectura, invariantes de custodia, estados de fuente y categorías derivadas; ninguna entidad persistente nueva. `contracts/analyst-workspace.openapi.yaml` define lista, resumen y detalle con `404` seguro, `no-store` y campos permitidos. `contracts/analyst-workspace-ui.md` traduce las seis referencias a jerarquía responsive y estados honestos. `quickstart.md` da la matriz de verificación, incluidos límites de tiempo, revocación, navegación y accesibilidad en la ruta autenticada.

## Re-check post-design

**PASS con límite de datos**: los contratos no reutilizan el DTO administrativo de custodia ni el flujo HTTP del responsable de Feature 009; cada detalle vuelve a comprobar custodia actual. Nombre y canales autorizados son las únicas excepciones privadas explícitas y el contacto no sale en listas de partidos. La proyección carece de acciones de captura, cupo, aprobación e historial; las categorías no se solapan. No hay designación general de sustituto de responsable de academia ni garantía de vigencia del teléfono de solicitud: si no hay persona actual única o un canal atribuible, se devuelve contacto no disponible/parcial, nunca un contacto de otra persona. No se requiere migración para la lectura planificada.

## Complexity Tracking

No hay violaciones de la constitución que requieran justificación.
