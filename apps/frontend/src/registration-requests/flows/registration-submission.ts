import type {
  EvidenceCategory,
  RegistrationEvidenceUploadQueue,
} from "../evidence/upload-queue";
import type {
  RegistrationDraft,
  RegistrationIdentityValidation,
  RegistrationRequestSnapshot,
} from "../registration-request-api";
import { RegistrationRequestStateMachine } from "../registration-request-state";
import {
  isMunicipalityCode,
  validatePerson,
} from "../validation/registration-person-validation";
import {
  feedbackForMissingDocument,
  feedbackForNotice,
  feedbackForUpload,
  feedbackForValidation,
  type SubmissionFailureStep,
  type SubmissionFeedback,
} from "./registration-submission-feedback";

export const REQUIRED_EVIDENCE = Object.freeze({
  PERSONAL_ADULT: Object.freeze(["IDENTITY_FRONT", "IDENTITY_BACK"] as const),
  REPRESENTED_MINOR: Object.freeze([
    "IDENTITY_FRONT",
    "IDENTITY_BACK",
    "MINOR_CIVIL_IDENTITY",
    "REPRESENTATION_AUTHORITY",
  ] as const),
  FORMAL_ACADEMY: Object.freeze([
    "RUT",
    "EXISTENCE_CERTIFICATE",
    "RESPONSIBLE_AUTHORITY",
  ] as const),
  NATURAL_PERSON_ACADEMY: Object.freeze([
    "OPERATION_PROOF",
    "RESPONSIBLE_AUTHORITY",
  ] as const),
  ADDITIONAL_ACADEMY_ACCOUNT: Object.freeze([
    "IDENTITY_FRONT",
    "IDENTITY_BACK",
    "ACADEMY_ACCOUNT_AUTHORIZATION",
  ] as const),
  ACADEMY_ADULT_PLAYER: Object.freeze([
    "IDENTITY_FRONT",
    "IDENTITY_BACK",
    "ADULT_AUTHORIZATION",
  ] as const),
  ACADEMY_MINOR_PLAYER: Object.freeze([
    "IDENTITY_FRONT",
    "IDENTITY_BACK",
    "MINOR_CIVIL_IDENTITY",
    "REPRESENTATION_AUTHORITY",
  ] as const),
} satisfies Readonly<
  Record<RegistrationDraft["type"], readonly EvidenceCategory[]>
>);

export type Issue = Readonly<{ field: string; code: string; message: string }>;
type AuthenticatePending = (
  credentials: Readonly<{ email: string; password: string }>,
) => Promise<Readonly<{ authenticated: boolean; requestId?: string }>>;

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
    },
  );
}

const text = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;
const personIssues = (
  value: unknown,
  prefix: string,
  options: Readonly<{ phoneRequired?: boolean; age?: "adult" | "minor" }> = {},
): Issue[] =>
  validatePerson(
    value as Readonly<Record<string, unknown>> | undefined,
    prefix,
    options,
  ).map((issue) => ({ ...issue, code: "invalid" }));

function exactIdentityFields(draft: RegistrationDraft): readonly string[] {
  if (draft.type === 'PERSONAL_ADULT') return ['person.documentNumber'];
  if (draft.type === 'REPRESENTED_MINOR') return ['representative.documentNumber', 'minor.documentNumber'];
  if (draft.type === 'FORMAL_ACADEMY') return ['academy.academyName', 'nit', 'academy.responsiblePerson.documentNumber'];
  if (draft.type === 'NATURAL_PERSON_ACADEMY') return ['academy.academyName', 'academy.responsiblePerson.documentNumber'];
  if (draft.type === 'ADDITIONAL_ACADEMY_ACCOUNT') return ['person.documentNumber'];
  if (draft.type === 'ACADEMY_ADULT_PLAYER') return ['player.documentNumber'];
  return ['minor.documentNumber', 'representative.documentNumber'];
}

function conflictStep(field: string): SubmissionFailureStep {
  if (field === 'nit' || field === 'academy.academyName') return 'academy';
  if (field === 'credentials.email') return 'account';
  if (field.startsWith('academy.responsiblePerson')) return 'responsible';
  if (field.startsWith('representative')) return 'representative';
  if (field.startsWith('minor')) return 'minor';
  return 'identity';
}

export function validateCompletedRegistrationDraft(
  draft: RegistrationDraft,
): readonly Issue[] {
  const credentials =
    "credentials" in draft.details ? draft.details.credentials : undefined;
  const consent = draft.details.consent;
  const issues: Issue[] = [];
  const academyOperation =
    draft.type === "ADDITIONAL_ACADEMY_ACCOUNT" ||
    draft.type === "ACADEMY_ADULT_PLAYER" ||
    draft.type === "ACADEMY_MINOR_PLAYER";
  if (
    !academyOperation &&
    (!credentials ||
      !text(credentials.email) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email!))
  )
    issues.push({
      field: "credentials.email",
      code: "invalid",
      message: "Ingresa un correo electrónico válido.",
    });
  if (
    !academyOperation &&
    (!credentials ||
      !text(credentials.password) ||
      (credentials.password?.length ?? 0) < 12)
  )
    issues.push({
      field: "credentials.password",
      code: "invalid",
      message: "La contraseña debe tener al menos 12 caracteres.",
    });
  if (draft.type === "PERSONAL_ADULT") {
    const details = draft.details;
    issues.push(...personIssues(details.person, "person", { age: "adult" }));
    if (details.actingForSelf !== true)
      issues.push({
        field: "actingForSelf",
        code: "required",
        message: "Confirma que actúas por cuenta propia.",
      });
  } else if (draft.type === "REPRESENTED_MINOR") {
    const details = draft.details;
    issues.push(
      ...personIssues(details.representative, "representative", {
        phoneRequired: true,
        age: "adult",
      }),
    );
    issues.push(...personIssues(details.minor, "minor", { age: "minor" }));
    if (!details.relationship)
      issues.push({
        field: "relationship",
        code: "required",
        message: "Indica la relación con el menor.",
      });
    if (details.authorityDeclared !== true)
      issues.push({
        field: "authorityDeclared",
        code: "required",
        message: "Declara que cuentas con autoridad legal.",
      });
    if (consent?.representationAccepted !== true)
      issues.push({
        field: "consent.representationAccepted",
        code: "required",
        message: "Confirma la autoridad de representación legal.",
      });
    if (consent?.minorTreatmentAccepted !== true)
      issues.push({
        field: "consent.minorTreatmentAccepted",
        code: "required",
        message: "Confirma el tratamiento de datos del menor.",
      });
  } else if (draft.type === "FORMAL_ACADEMY") {
    const details = draft.details;
    const academy = details.academy;
    if (!text(academy?.academyName))
      issues.push({
        field: "academy.academyName",
        code: "required",
        message: "Indica el nombre de la academia.",
      });
    if (academy?.country !== "CO")
      issues.push({
        field: "academy.country",
        code: "invalid",
        message: "El país disponible para este MVP es Colombia.",
      });
    if (!isMunicipalityCode(academy?.city ?? ""))
      issues.push({
        field: "academy.city",
        code: "invalid",
        message: "Selecciona un municipio del catálogo oficial DANE.",
      });
    issues.push(
      ...personIssues(academy?.responsiblePerson, "academy.responsiblePerson", {
        phoneRequired: true,
        age: "adult",
      }),
    );
    if (!text(details.organizationType))
      issues.push({
        field: "organizationType",
        code: "required",
        message: "Indica el tipo de organización.",
      });
    if (!text(details.nit))
      issues.push({
        field: "nit",
        code: "required",
        message: "Indica el NIT.",
      });
    if (details.authorityDeclared !== true)
      issues.push({
        field: "authorityDeclared",
        code: "required",
        message: "Confirma la autoridad para presentar la solicitud.",
      });
  } else if (draft.type === "NATURAL_PERSON_ACADEMY") {
    const details = draft.details;
    const academy = details.academy;
    if (!text(academy?.academyName))
      issues.push({
        field: "academy.academyName",
        code: "required",
        message: "Indica el nombre operativo de la academia.",
      });
    if (academy?.country !== "CO")
      issues.push({
        field: "academy.country",
        code: "invalid",
        message: "El país disponible para este MVP es Colombia.",
      });
    if (!isMunicipalityCode(academy?.city ?? ""))
      issues.push({
        field: "academy.city",
        code: "invalid",
        message: "Selecciona un municipio del catálogo oficial DANE.",
      });
    issues.push(
      ...personIssues(academy?.responsiblePerson, "academy.responsiblePerson", {
        phoneRequired: true,
        age: "adult",
      }),
    );
    if (details.operationDeclared !== true)
      issues.push({
        field: "operationDeclared",
        code: "required",
        message: "Confirma la operación directa.",
      });
    if (!details.proofCategories?.length)
      issues.push({
        field: "proofCategories",
        code: "required",
        message: "Selecciona al menos una prueba de operación.",
      });
  } else if (draft.type === "ADDITIONAL_ACADEMY_ACCOUNT") {
    issues.push(
      ...personIssues(draft.details.person, "person", { age: "adult" }),
    );
    if (!text(draft.details.function))
      issues.push({
        field: "function",
        code: "required",
        message: "Indica la función en la academia.",
      });
    if (draft.details.responsibleAuthorization !== true)
      issues.push({
        field: "responsibleAuthorization",
        code: "required",
        message: "Confirma la autorización de la academia.",
      });
  } else if (draft.type === "ACADEMY_ADULT_PLAYER") {
    issues.push(
      ...personIssues(draft.details.player, "player", { age: "adult" }),
    );
    if (draft.details.adultAuthorization !== true)
      issues.push({
        field: "adultAuthorization",
        code: "required",
        message: "Confirma la autorización expresa del jugador.",
      });
    if (consent?.academyPresentationAccepted !== true)
      issues.push({
        field: "consent.academyPresentationAccepted",
        code: "required",
        message: "Autoriza a la academia a presentar esta solicitud.",
      });
  } else {
    issues.push(
      ...personIssues(draft.details.minor, "minor", { age: "minor" }),
    );
    issues.push(
      ...personIssues(draft.details.representative, "representative", {
        phoneRequired: true,
        age: "adult",
      }),
    );
    if (!draft.details.relationship)
      issues.push({
        field: "relationship",
        code: "required",
        message: "Indica la relación con el menor.",
      });
    if (draft.details.authorityDeclared !== true)
      issues.push({
        field: "authorityDeclared",
        code: "required",
        message: "Declara que cuentas con autoridad legal.",
      });
    if (consent?.representationAccepted !== true)
      issues.push({
        field: "consent.representationAccepted",
        code: "required",
        message: "Confirma la autoridad de representación.",
      });
    if (consent?.minorTreatmentAccepted !== true)
      issues.push({
        field: "consent.minorTreatmentAccepted",
        code: "required",
        message: "Confirma el tratamiento de datos del menor.",
      });
    if (consent?.academyPresentationAccepted !== true)
      issues.push({
        field: "consent.academyPresentationAccepted",
        code: "required",
        message: "Autoriza a la academia a presentar esta solicitud.",
      });
  }
  if (!consent?.truthfulnessAccepted)
    issues.push({
      field: "consent.truthfulnessAccepted",
      code: "required",
      message: "Confirma la declaración de veracidad.",
    });
  if (!consent?.privacyAccepted || !text(consent.privacyVersion))
    issues.push({
      field: "consent.privacyAccepted",
      code: "required",
      message: "Acepta el tratamiento de datos personales.",
    });
  return Object.freeze(issues);
}

export class RegistrationSubmissionCoordinator {
  private inFlight: Promise<boolean> | null = null;
  private createIdempotencyKey: string | null = null;
  private retryFingerprint: string | null = null;
  private persistedFingerprint: string | null = null;
  failure: string | null = null;
  failureStep: SubmissionFailureStep | null = null;
  failureField: string | null = null;
  failureCategory: EvidenceCategory | null = null;
  get submittedRequestId(): string | null {
    return this.machine.state.snapshot?.status === "SUBMITTED"
      ? this.machine.state.snapshot.id
      : null;
  }
  constructor(
    private readonly machine: RegistrationRequestStateMachine,
    private readonly queue: RegistrationEvidenceUploadQueue,
    private readonly authenticatePending: AuthenticatePending,
    private readonly createKey: () => string = createUuid,
    private readonly refreshPendingCapabilities?: () => Promise<void>,
    private readonly getAccessToken?: () => string | null,
  ) {}

  saveLocal(_draft: RegistrationDraft) {}

  async validateStep(draft: RegistrationDraft, fields: readonly string[]): Promise<readonly Issue[]> {
    const checks: RegistrationIdentityValidation['checks'][number][] = [];
    for (const field of fields) {
      if (field === 'nit' && draft.type === 'FORMAL_ACADEMY' && draft.details.nit) { checks.push({ field: 'nit', nit: draft.details.nit }); continue; }
      if (field === 'academy.academyName' && 'academy' in draft.details && draft.details.academy?.academyName) { checks.push({ field, academyName: draft.details.academy.academyName }); continue; }
      const person = field === 'person.documentNumber' && 'person' in draft.details ? draft.details.person
        : field === 'representative.documentNumber' && 'representative' in draft.details ? draft.details.representative
        : field === 'minor.documentNumber' && 'minor' in draft.details ? draft.details.minor
        : field === 'academy.responsiblePerson.documentNumber' && 'academy' in draft.details ? draft.details.academy?.responsiblePerson
        : field === 'player.documentNumber' && 'player' in draft.details ? draft.details.player
        : undefined;
      if (person?.documentType && person.documentNumber) checks.push({ field, documentType: person.documentType, documentNumber: person.documentNumber });
    }
    if (!checks.length) return Object.freeze([]);
    const result = await this.machine.validateIdentity({ requestType: draft.type, ...('academyId' in draft ? { academyId: draft.academyId } : {}), checks });
    if (result.kind === 'success') return Object.freeze([]);
    if (result.kind === 'validation-error') return Object.freeze(result.issues.map((issue) => ({ field: issue.field, code: issue.code, message: issue.code === 'nit_in_use' ? 'Este NIT ya está en uso' : issue.code === 'academy_name_in_use' ? 'Ya existe un registro con este nombre de academia' : issue.code === 'email_in_use' ? 'Ya existe un registro con este correo electrónico' : issue.code === 'document_in_use' ? 'Ya existe un registro con este documento' : 'No pudimos validar este identificador.' })));
    return Object.freeze([{ field: fields[0]!, code: result.kind, message: result.kind === 'connectivity-failure' ? 'No pudimos validar el documento. Revisa tu conexión e intenta de nuevo.' : 'No pudimos validar el documento en este momento.' }]);
  }

  submit(draft: RegistrationDraft): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.execute(draft).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async execute(draft: RegistrationDraft): Promise<boolean> {
    this.failure = null;
    this.failureStep = null;
    this.failureField = null;
    this.failureCategory = null;
    if (this.submittedRequestId) return true;
    const issues = validateCompletedRegistrationDraft(draft);
    if (issues.length) {
      this.machine.setClientValidationIssues(issues);
      this.fail(feedbackForValidation(draft.type, issues));
      return false;
    }
    const exactIssues = this.machine.state.snapshot
      ? Object.freeze([])
      : await this.validateStep(draft, exactIdentityFields(draft));
    if (exactIssues.length) {
      this.machine.setClientValidationIssues(exactIssues);
      const first = exactIssues[0]!;
      this.fail({ message: first.message, step: conflictStep(first.field), field: first.field });
      return false;
    }
    const required = REQUIRED_EVIDENCE[draft.type];
    const remoteClean = (
      snapshot: RegistrationRequestSnapshot | null,
      category: EvidenceCategory,
    ) =>
      snapshot?.evidence.some(
        (item) => item.category === category && item.status === "CLEAN",
      ) ?? false;
    const missingCategory = required.find(
      (category) =>
        !this.queue.hasCategory(category) &&
        !remoteClean(this.machine.state.snapshot, category),
    );
    if (missingCategory) {
      this.machine.setClientValidationIssues([
        {
          field: "evidence",
          code: "incomplete",
          message: "Carga todos los documentos requeridos.",
        },
      ]);
      this.fail(feedbackForMissingDocument(missingCategory));
      return false;
    }
    const fingerprint = JSON.stringify(draft);
    if (
      this.machine.state.snapshot &&
      this.retryFingerprint === fingerprint &&
      (this.machine.state.notice === "connectivity-failure" ||
        this.machine.state.notice === "unavailable-backend")
    ) {
      const retried = await this.machine.retry();
      if (retried) this.retryFingerprint = null;
      else this.failFromState(draft.type);
      return retried;
    }
    if (!this.machine.state.snapshot) {
      this.createIdempotencyKey ??= this.createKey();
      const created = await this.machine.create(
        draft,
        this.createIdempotencyKey,
      );
      if (
        !created &&
        !["connectivity-failure", "unavailable-backend"].includes(
          this.machine.state.notice ?? "",
        )
      ) {
        this.failFromState(draft.type);
        return false;
      }
      if (created) this.persistedFingerprint = fingerprint;
      const academyOperation =
        draft.type === "ADDITIONAL_ACADEMY_ACCOUNT" ||
        draft.type === "ACADEMY_ADULT_PLAYER" ||
        draft.type === "ACADEMY_MINOR_PLAYER";
      if (academyOperation) {
        const createdSnapshot = this.machine.state
          .snapshot as RegistrationRequestSnapshot | null;
        const requestId = createdSnapshot?.id;
        if (
          !created ||
          !requestId ||
          !(await this.machine.restore(requestId))
        ) {
          this.failFromState(draft.type);
          return false;
        }
      } else {
        const credentials = draft.details.credentials!;
        const pending = await this.authenticatePending({
          email: credentials.email!,
          password: credentials.password!,
        });
        if (!pending.authenticated) {
          this.fail({
            message:
              "No pudimos iniciar la sesión pendiente. Revisa el correo y la contraseña; la solicitud no se envió.",
            step: "account",
            field: "credentials.email",
          });
          return false;
        }
        const requestId = created
          ? this.machine.state.snapshot!.id
          : pending.requestId;
        if (!requestId || !(await this.machine.restore(requestId))) {
          this.failFromState(draft.type);
          return false;
        }
      }
      this.createIdempotencyKey = null;
      this.persistedFingerprint = fingerprint;
      if (this.submittedRequestId) return true;
    } else {
      if (!this.machine.can("registration.request.own.edit-draft")) {
        const academyOperation =
          draft.type === "ADDITIONAL_ACADEMY_ACCOUNT" ||
          draft.type === "ACADEMY_ADULT_PLAYER" ||
          draft.type === "ACADEMY_MINOR_PLAYER";
        const credentials =
          "credentials" in draft.details
            ? draft.details.credentials
            : undefined;
        const pending = academyOperation
          ? { authenticated: Boolean(this.getAccessToken?.()) }
          : await this.authenticatePending({
              email: credentials?.email ?? "",
              password: credentials?.password ?? "",
            });
        if (
          !pending.authenticated ||
          !(await this.machine.restore(this.machine.state.snapshot.id))
        ) {
          this.fail(feedbackForNotice("session-expired"));
          return false;
        }
        if (this.submittedRequestId) return true;
      }
      if (this.persistedFingerprint !== fingerprint) {
        if (!(await this.machine.save(draft))) {
          this.failFromState(draft.type);
          return false;
        }
        this.persistedFingerprint = fingerprint;
      }
    }
    const snapshot = this.machine.state.snapshot!;
    const accessToken = this.getAccessToken?.();
    if (!accessToken) {
      this.fail(feedbackForNotice("session-expired"));
      return false;
    }
    if (
      !(await this.queue.uploadRequired(
        required.filter((category) => !remoteClean(snapshot, category)),
        {
          requestId: snapshot.id,
          expectedVersion: snapshot.version,
          accessToken,
        },
      ))
    ) {
      const failed = this.queue.items.find(
        (item) =>
          required.some((category) => category === item.category) &&
          item.status === "failed",
      );
      this.fail(
        feedbackForUpload(
          draft.type,
          failed?.category ?? required[0]!,
          failed?.error,
        ),
      );
      return false;
    }
    if (!(await this.machine.restore(snapshot.id))) {
      this.failFromState(draft.type);
      return false;
    }
    if (this.submittedRequestId) return true;
    const refreshed = this.machine.state.snapshot;
    const notClean = required.find(
      (category) => !remoteClean(refreshed, category),
    );
    if (notClean) {
      this.machine.setClientValidationIssues([
        {
          field: "evidence",
          code: "not-clean",
          message: "Espera a que todos los documentos estén listos.",
        },
      ]);
      this.fail(feedbackForUpload(draft.type, notClean, "unavailable-backend"));
      return false;
    }
    if (!this.machine.can("registration.request.own.submit")) {
      this.failure =
        "El servidor aún no habilita el envío. Revisa las autorizaciones y los documentos; puedes reintentar sin perderlos.";
      this.failureStep = "consent";
      return false;
    }
    const submitted = await this.machine.submit();
    this.retryFingerprint = submitted ? null : fingerprint;
    if (!submitted) this.failFromState(draft.type);
    if (submitted) {
      try {
        await this.refreshPendingCapabilities?.();
      } catch {
        /* The confirmed submission remains successful. */
      }
    }
    return submitted;
  }

  private fail(feedback: SubmissionFeedback) {
    this.failure = feedback.message;
    this.failureStep = feedback.step;
    this.failureField = feedback.field ?? null;
    this.failureCategory = feedback.category ?? null;
  }

  private failFromState(type: RegistrationDraft["type"]) {
    const state = this.machine.state;
    if (state.notice === "validation-error")
      this.fail(feedbackForValidation(type, state.validationIssues));
    else if (state.notice) this.fail(feedbackForNotice(state.notice));
    else
      this.fail({
        message:
          "El servidor no confirmó el estado SUBMITTED. Revisa el estado de la solicitud y reintenta sin perder los datos.",
        step: "review",
      });
  }
}
