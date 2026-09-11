<!--
Sync Impact Report
- Version change: 1.0.0 -> 2.0.0
- Modified principles:
  - I. Specification-Driven Development -> I. Specification-Driven Development
    (mandatory core workflow separated from optional Clarify, Analyze, and Converge workflows)
  - XII. AI Assistant Behavior -> XII. AI Assistant Behavior
    (optional workflows require a concrete justification and never replace issue resolution)
- Modified sections:
  - Development Workflow and Quality Gates (ambiguity and consistency outcomes remain mandatory;
    formal Clarify and Analyze executions are optional; Converge remains conditional)
  - Governance (constitution compliance review remains mandatory but is not restricted to Analyze)
- Added sections: none
- Removed sections: none
- Follow-up TODOs: none
-->
# New Talents Constitution

## Core Principles

### I. Specification-Driven Development
Every product change MUST begin with a bounded, reviewed, and approved specification. No feature
MAY move directly from an informal idea to implementation. The mandatory core workflow is: Specify;
Plan; Generate Tasks; and Implement. Clarification MAY be used when material ambiguities require a
dedicated resolution step. Analysis MAY be used when complexity, risk, contracts, or suspected
inconsistencies justify a cross-artifact review. Convergence MAY be used when implementation may
differ from its governing artifacts or incomplete work must be identified. Optional workflow use
does not remove the obligation to resolve known ambiguities and inconsistencies. Every
implementation change MUST remain traceable to approved requirements and tasks. This discipline
prevents undocumented scope and makes product decisions auditable.

### II. Incremental and Bounded Delivery
The product MUST be delivered through small, independently understandable features. Each
specification MUST define one coherent capability or user journey, state what is included and
excluded, avoid absorbing unrelated MVP modules, and be independently reviewable and verifiable.
The complete MVP MUST NOT be represented by one oversized specification. Small boundaries reduce
delivery risk and make validation meaningful.

### III. Player-Centered Product Scope
The player passport MUST remain the central product object. Statistics, evaluations, matches,
videos, academy relationships, tutor access, analyst work, and public visibility MUST contribute to
the player's documented football profile. Capabilities outside the approved player-centered MVP
MUST have an explicit specification and product justification. Tournament management is outside the
current MVP and MUST NOT be introduced without an approved scope amendment.

### IV. Separation Between Product Presentation and FEM
The Football Evaluation Model (FEM) MUST remain an independent domain component. Product modules
MUST NOT depend directly on its internal event-processing structures. Integration MUST use explicit,
versionable presentation contracts that expose only product-required information. The FEM MUST be
able to evolve without forcing unrelated application or player-facing changes. Raw events,
contextual weights, complexity calculations, formulas, and analyst mechanics MUST NOT become public
product information merely because they exist internally.

### V. Evidence-Based Football Information
Published statistics, evaluations, comparisons, capabilities, strengths, and conclusions MUST be
supported by analyzed evidence. The system MUST NOT invent unavailable measurements, generate
unexplained ratings, present percentiles without a defined comparison cohort, treat missing data as
zero, or expose provisional analysis as published information. Every displayed metric MUST have a
defined meaning, source, unit or scale when applicable, aggregation rule, and publication state.
Speed, strength, biometric, or physical claims MUST NOT be shown without appropriate evidence.

### VI. Privacy, Authorization, and Minor Protection
The platform MUST enforce explicit authorization and least-privilege access. Sensitive personal
information MUST remain separate from public football information. Public visibility for minors
MUST depend on authorization rules approved in the applicable feature specification. Tutor, academy,
analyst, administrative, and public permissions MUST NOT be inferred from UI visibility. Access MUST
be enforced at the system boundary responsible for protecting the data.

### VII. Architecture Through Explicit Planning
The initial architecture is a baseline direction, not an immutable decision. Relevant technical
choices MUST be confirmed during feature planning. Plans SHOULD reuse the established TocoYVoy
direction where appropriate; meaningful divergence MUST include explicit rationale and impact.
Architecture MUST favor clear module boundaries, explicit contracts, low coupling, replaceable
external integrations, maintainable domain logic, incremental evolution, and the simplest design
that satisfies approved requirements. Speculative infrastructure and premature distributed
architecture are prohibited.

### VIII. Cross-Platform Product Consistency
New Talents MUST support its approved mobile and web experiences through the established
cross-platform direction. Every applicable feature MUST define and verify expected behavior on each
supported platform. Information hierarchy and business behavior MUST remain consistent; layouts
MUST be responsive; interactions MUST be accessible; and loading, empty, error, restricted, and
unavailable states MUST be explicit. Platform-specific differences MUST be intentional and
documented.

### IX. Quality and Verification
Every implementation plan and task breakdown MUST include verification proportionate to risk.
Where applicable, verification MUST cover business rules, authorization boundaries, data
transformation, integration contracts, error handling, loading and empty states, responsive
behavior, and regression risks. A feature is not complete merely because a screen renders or one
primary scenario works. Completion MUST be evaluated against the approved specification, plan, and
tasks.

### X. Documentation Authority and Consistency
Each artifact MUST retain a distinct authority: this constitution governs development principles
and decision rules; feature specifications govern functional scope and acceptance criteria;
clarifications resolve material ambiguity; plans govern implementation decisions; tasks govern
delivery work; architecture documents describe approved technical direction; FEM documentation
governs evaluation-domain concepts; and design references guide visual intent without overriding
functional requirements. Conflicts MUST be identified and resolved before implementation. Codex
MUST NOT silently select one interpretation.

### XI. Controlled Change Management
Changes to approved scope, business rules, contracts, architecture, or evaluation semantics MUST be
recorded in the appropriate governing artifact. Implementation MUST NOT be the sole record of a
decision. Every material change MUST identify the affected artifact, document its rationale, assess
its impact, update the artifact, and trigger a downstream consistency review.

### XII. AI Assistant Behavior
Codex MUST operate within the active Spec Kit phase. It MUST read relevant governing documents,
separate confirmed facts from assumptions, identify material ambiguities, avoid speculative
requirements and future functionality, preserve existing artifacts, and keep changes within the
active feature boundary. It MUST NOT invoke `$speckit-clarify` automatically when no material
ambiguity exists, and it MUST NOT invoke `$speckit-analyze` automatically for every feature. When
recommending either optional workflow, Codex MUST explain the concrete ambiguity, complexity, risk,
contract, or suspected inconsistency that justifies it. Optional workflow execution MUST NOT be
treated as a substitute for resolving a known issue. Codex MUST report conflicts rather than
resolve them silently and MUST stop when an unresolved decision would materially change the result.
A specification request MUST NOT be treated as authorization to implement code.

## Product and Domain Guardrails

- The approved MVP MUST remain centered on the digital player passport, statistical and evaluation
  information, and audiovisual evidence.
- Product-facing information MUST preserve the distinction between published, provisional,
  restricted, unavailable, and missing data.
- FEM formulas, weights, rating methods, internal processing details, and exact metric catalogs MUST
  be decided and versioned in their proper domain artifacts, not in this constitution.
- Architecture documents MAY establish an initial direction, but feature plans MUST validate the
  relevant choices and record justified changes.
- Design references MAY establish visual intent and information hierarchy, but MUST NOT define
  authorization, business rules, or unsupported measurements.
- Detailed screens, endpoints, data schemas, provider choices, and speculative integrations MUST be
  deferred to the appropriate specification or planning phase.

## Development Workflow and Quality Gates

1. A feature MUST have an approved, bounded specification before planning begins.
2. Material ambiguities MUST be resolved before dependent planning or implementation proceeds.
   Resolution MAY occur through an updated specification, an explicit project decision, or
   `$speckit-clarify`.
3. A plan MUST document relevant architecture decisions, contracts, security boundaries, risks, and
   proportionate verification.
4. Tasks MUST map to approved requirements and produce independently verifiable outcomes.
5. Specifications, plans, and tasks MUST remain consistent. Known material inconsistencies MUST be
   resolved before dependent implementation proceeds.
6. Formal `$speckit-analyze` execution is optional. It SHOULD be used for features with significant
   security, authorization, data-integrity, contract, integration, or cross-cutting risk.
   Implementation MAY proceed without `$speckit-analyze` when the governing artifacts have been
   reviewed and no material inconsistency remains.
7. Implementation MUST remain within approved scope and MUST satisfy defined quality gates.
8. `$speckit-converge` MAY be used when delivered behavior may differ from the governing artifacts
   or when incomplete work must be identified explicitly.
9. Exceptions MUST be documented and approved under Governance before dependent work proceeds.

## Governance

This constitution is the highest-authority development governance artifact for New Talents.
Downstream specifications, clarifications, plans, tasks, analyses, implementations, and convergence
reviews MUST comply with it. Domain and design documents remain authoritative only within the
responsibilities assigned under Principle X.

Amendments MUST include a written rationale, impact analysis, proposed version change, review of
affected artifacts, and explicit project approval. Approved amendments MUST update this file and
MUST propagate to affected downstream artifacts before dependent implementation continues.

Constitution versions MUST follow semantic versioning:

- MAJOR for backward-incompatible governance changes, principle removals, or principle redefinitions.
- MINOR for new principles, new governance sections, or materially expanded obligations.
- PATCH for clarifications and non-semantic wording corrections.

Every feature MUST complete a constitution compliance review before implementation. The review MAY
be performed during planning, task review, implementation preparation, or a formal
`$speckit-analyze` workflow. Formal analysis is not the only acceptable compliance mechanism and is
not mandatory when the artifacts have been reviewed and no material inconsistency remains. Delivery
review MUST verify traceability, required evidence, authorization boundaries, testing obligations,
and documented exceptions. Non-compliance MUST block progression unless an exception is approved.

An exception MUST be narrow, time-bounded when applicable, justified by documented evidence, and
approved by the project's designated decision authority. It MUST identify affected principles,
risks, compensating controls, and the artifact or milestone at which compliance will be restored.
Exceptions MUST NOT silently redefine this constitution.

**Version**: 2.0.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-10
