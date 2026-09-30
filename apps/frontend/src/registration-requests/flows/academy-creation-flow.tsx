import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { RegistrationDraft } from "../registration-request-api";
import type {
  EvidenceCategory,
  RegistrationEvidenceUploadQueue,
} from "../evidence/upload-queue";
import {
  Actions,
  Choice,
  CountryField,
  DateField,
  DocumentTypeSelect,
  EvidenceRequirements,
  Field,
  GlassCard,
  JourneyShell,
  MunicipalitySelect,
  Notice,
  journeyStyles,
} from "../components/registration-journey";
import {
  firstIssue,
  isMunicipalityCode,
  validatePerson,
  type RegistrationFieldIssue,
} from "../validation/registration-person-validation";
import { validateCompletedRegistrationDraft } from "./registration-submission";

type AcademyType = "FORMAL_ACADEMY" | "NATURAL_PERSON_ACADEMY";
export type AcademyStep =
  "type" | "academy" | "responsible" | "documents" | "declarations" | "review";
type ResponsibleForm = {
  names: string;
  surnames: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  country: string;
  city: string;
  phone: string;
};
type CommonAcademyForm = {
  email: string;
  password: string;
  academyName: string;
  country: string;
  city: string;
  trainingPlace: string;
  responsible: ResponsibleForm;
  privacyAccepted: boolean;
  truthfulnessAccepted: boolean;
};
export type FormalAcademyForm = CommonAcademyForm & {
  organizationType: string;
  nit: string;
  authorityDeclared: boolean;
};
export type NaturalAcademyForm = CommonAcademyForm & {
  operationDeclared: boolean;
  proofCategories: readonly string[];
};

const commonDefaults: CommonAcademyForm = {
  email: "",
  password: "",
  academyName: "",
  country: "CO",
  city: "",
  trainingPlace: "",
  responsible: {
    names: "",
    surnames: "",
    documentType: "",
    documentNumber: "",
    birthDate: "",
    country: "CO",
    city: "",
    phone: "",
  },
  privacyAccepted: false,
  truthfulnessAccepted: false,
};
const order: readonly AcademyStep[] = [
  "type",
  "academy",
  "responsible",
  "documents",
  "declarations",
  "review",
];
const labels = [
  "Tipo",
  "Academia",
  "Responsable",
  "Documentos",
  "Declaraciones",
  "Envío",
] as const;

function academyBase(form: CommonAcademyForm) {
  return {
    academyName: form.academyName.trim(),
    country: form.country,
    city: form.city,
    ...(form.trainingPlace.trim()
      ? { trainingPlace: form.trainingPlace.trim() }
      : {}),
    responsiblePerson: {
      legalNames: form.responsible.names,
      legalSurnames: form.responsible.surnames,
      documentType: form.responsible.documentType,
      documentNumber: form.responsible.documentNumber,
      birthDate: form.responsible.birthDate,
      country: form.responsible.country,
      city: form.responsible.city,
      phone: form.responsible.phone,
    },
  };
}
function credentials(form: CommonAcademyForm) {
  return {
    email: form.email.trim(),
    password: form.password,
    passwordConfirmation: form.password,
  };
}
function consent(form: CommonAcademyForm) {
  return {
    privacyVersion: "2026-09",
    privacyAccepted: form.privacyAccepted,
    truthfulnessAccepted: form.truthfulnessAccepted,
  };
}

export function buildFormalAcademyDraft(
  form: FormalAcademyForm,
): Extract<RegistrationDraft, { type: "FORMAL_ACADEMY" }> {
  return {
    type: "FORMAL_ACADEMY",
    details: {
      credentials: credentials(form),
      academy: academyBase(form),
      organizationType: form.organizationType,
      nit: form.nit.trim(),
      authorityDeclared: form.authorityDeclared,
      consent: consent(form),
    },
  };
}
export function buildNaturalPersonAcademyDraft(
  form: NaturalAcademyForm,
): Extract<RegistrationDraft, { type: "NATURAL_PERSON_ACADEMY" }> {
  return {
    type: "NATURAL_PERSON_ACADEMY",
    details: {
      credentials: credentials(form),
      academy: academyBase(form),
      operationDeclared: form.operationDeclared,
      proofCategories: [...new Set(form.proofCategories)],
      consent: consent(form),
    },
  };
}

export function AcademyCreationFlow({
  type,
  initialStep = "type",
  onSave,
  onSubmit,
  getSubmissionError,
  getSubmissionFailureStep,
  getSubmissionFailureField,
  getSubmissionFailureCategory,
  evidenceQueue,
  onExit,
  readOnly = false,
}: Readonly<{
  type: AcademyType;
  initialStep?: AcademyStep;
  onSave: (draft: RegistrationDraft, identityFields?: readonly string[]) => Promise<readonly RegistrationFieldIssue[]> | readonly RegistrationFieldIssue[] | void;
  onSubmit: (draft: RegistrationDraft) => Promise<boolean> | boolean | void;
  getSubmissionError?: () => string | null;
  getSubmissionFailureStep?: () => string | null;
  getSubmissionFailureField?: () => string | null;
  getSubmissionFailureCategory?: () => EvidenceCategory | null;
  evidenceQueue?: RegistrationEvidenceUploadQueue;
  onExit?: () => void;
  readOnly?: boolean;
}>) {
  const formal = type === "FORMAL_ACADEMY";
  const [step, setStep] = useState<AcademyStep>(initialStep);
  const [form, setForm] = useState<FormalAcademyForm | NaturalAcademyForm>(
    formal
      ? {
          ...commonDefaults,
          organizationType: "",
          nit: "",
          authorityDeclared: false,
        }
      : { ...commonDefaults, operationDeclared: false, proofCategories: [] },
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const index = order.indexOf(step);
  const [focusField, setFocusField] = useState<{
    field: string;
    nonce: number;
  }>();
  const [focusDocument, setFocusDocument] = useState<{
    category: EvidenceCategory;
    nonce: number;
  }>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const draft = useMemo(
    () =>
      formal
        ? buildFormalAcademyDraft(form as FormalAcademyForm)
        : buildNaturalPersonAcademyDraft(form as NaturalAcademyForm),
    [form, formal],
  );
  const steps = labels.map((label, position) => ({
    label,
    state:
      position < index
        ? ("complete" as const)
        : position === index
          ? ("current" as const)
          : ("pending" as const),
  }));
  const update = (key: keyof CommonAcademyForm, value: unknown) => {
    setForm((current) => ({ ...current, [key]: value }) as typeof current);
    setError(undefined);
  };
  const updateResponsible = (key: keyof ResponsibleForm, value: string) =>
    setForm((current) => ({
      ...current,
      responsible: { ...current.responsible, [key]: value },
    }));
  const target = (field: string) => ({
    focusRequest: focusField?.field === field ? focusField.nonce : undefined,
    error: fieldErrors[field],
  });
  const block = (issues: readonly RegistrationFieldIssue[]) => {
    const first = firstIssue(issues);
    if (!first) return false;
    setFieldErrors(
      Object.fromEntries(issues.map((issue) => [issue.field, issue.message])),
    );
    setError(step === "review" ? first.message : undefined);
    setFocusField({ field: first.field, nonce: Date.now() });
    return true;
  };
  const next = async () => {
    const issues: RegistrationFieldIssue[] = [];
    if (step === "academy") {
      if (!form.academyName.trim())
        issues.push({
          field: "academy.academyName",
          message: formal
            ? "Ingresa el nombre legal de la academia."
            : "Ingresa el nombre operativo de la academia.",
        });
      if (!isMunicipalityCode(form.city))
        issues.push({
          field: "academy.city",
          message:
            "Selecciona el municipio de la academia en el catálogo DANE.",
        });
      if (formal && !(form as FormalAcademyForm).organizationType.trim())
        issues.push({
          field: "organizationType",
          message: "Ingresa el tipo de organización.",
        });
      if (formal && !(form as FormalAcademyForm).nit.trim())
        issues.push({ field: "nit", message: "Ingresa el NIT." });
    }
    if (step === "responsible") {
      issues.push(
        ...validatePerson(
          draft.details.academy?.responsiblePerson as Readonly<
            Record<string, unknown>
          >,
          "academy.responsiblePerson",
          { phoneRequired: true, age: "adult" },
        ),
      );
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        issues.push({
          field: "credentials.email",
          message: "Ingresa un correo electrónico válido.",
        });
      if (form.password.length < 12)
        issues.push({
          field: "credentials.password",
          message: "La contraseña debe tener al menos 12 caracteres.",
        });
    }
    if (step === "documents" && !readOnly) {
      const missing = uploadEvidence.find(
        (item) => !evidenceQueue?.hasCategory(item.category),
      );
      if (missing) {
        setError(`Selecciona ${missing.label} antes de continuar.`);
        setFocusDocument({ category: missing.category, nonce: Date.now() });
        return;
      }
    }
    if (step === "declarations") {
      if (formal && !(form as FormalAcademyForm).authorityDeclared)
        issues.push({
          field: "authorityDeclared",
          message: "Confirma la autoridad para presentar la solicitud.",
        });
      if (!formal && !(form as NaturalAcademyForm).operationDeclared)
        issues.push({
          field: "operationDeclared",
          message: "Confirma la operación directa.",
        });
      if (!formal && !(form as NaturalAcademyForm).proofCategories.length)
        issues.push({
          field: "proofCategories",
          message: "Selecciona al menos una prueba de operación.",
        });
      if (!form.truthfulnessAccepted)
        issues.push({
          field: "consent.truthfulnessAccepted",
          message: "Confirma que la información es veraz.",
        });
      if (!form.privacyAccepted)
        issues.push({
          field: "consent.privacyAccepted",
          message: "Acepta el tratamiento de datos.",
        });
    }
    if (block(issues)) return;
    setError(undefined);
    setFieldErrors({});
    setBusy(true);
    try {
      const identityFields = step === "academy" ? ["academy.academyName", ...(formal ? ["nit"] : [])] : step === "responsible" ? ["academy.responsiblePerson.documentNumber"] : [];
      const serverIssues = await onSave(draft, identityFields);
      if (serverIssues?.length && block(serverIssues)) return;
      setStep(order[index + 1] ?? step);
    } finally {
      setBusy(false);
    }
  };
  const ready = formal
    ? (form as FormalAcademyForm).authorityDeclared &&
      form.privacyAccepted &&
      form.truthfulnessAccepted
    : (form as NaturalAcademyForm).operationDeclared &&
      form.privacyAccepted &&
      form.truthfulnessAccepted;
  const submit = async () => {
    if (readOnly) {
      setError(
        "Esta vista previa es de solo lectura. Abre la ruta de registro sin ?preview= para enviar.",
      );
      return;
    }
    const issues = validateCompletedRegistrationDraft(draft);
    if (block(issues)) return;
    const missing = uploadEvidence.find(
      (item) => !evidenceQueue?.hasCategory(item.category),
    );
    if (missing) {
      setStep("documents");
      setError(`Selecciona ${missing.label} antes de enviar.`);
      setFocusDocument({ category: missing.category, nonce: Date.now() });
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      if (await onSubmit(draft)) {
        setForm((current) => ({ ...current, password: "" }));
        setSubmitted(true);
      } else {
        const failureStep = getSubmissionFailureStep?.();
        const mapped = failureStep === "account" ? "responsible" : failureStep;
        if (mapped && order.includes(mapped as AcademyStep))
          setStep(mapped as AcademyStep);
        const field = getSubmissionFailureField?.();
        const category = getSubmissionFailureCategory?.();
        if (field) {
          setFieldErrors({
            [field]: getSubmissionError?.() ?? "Revisa este campo.",
          });
          setFocusField({ field, nonce: Date.now() });
        }
        if (category) setFocusDocument({ category, nonce: Date.now() });
        setError(
          getSubmissionError?.() ??
            "El envío no fue confirmado. Reintenta sin perder tus datos.",
        );
      }
    } catch {
      setError(
        "El envío no fue confirmado. Reintenta sin perder tus datos y documentos.",
      );
    } finally {
      setBusy(false);
    }
  };
  const back = () => setStep(order[index - 1] ?? step);
  const typeName = formal
    ? "Academia formal"
    : "Academia operada por persona natural";
  const academySummary =
    form.academyName || "Información de la academia pendiente";
  const responsibleSummary =
    [form.responsible.names, form.responsible.surnames]
      .filter(Boolean)
      .join(" ") || "Información de la persona responsable pendiente";
  const uploadEvidence: readonly Readonly<{
    category: EvidenceCategory;
    label: string;
  }>[] = formal
    ? [
        { category: "RUT", label: "RUT" },
        {
          category: "EXISTENCE_CERTIFICATE",
          label: "Certificado de existencia o equivalente",
        },
        {
          category: "RESPONSIBLE_AUTHORITY",
          label: "Autoridad del responsable",
        },
      ]
    : [
        { category: "OPERATION_PROOF", label: "Prueba de operación" },
        {
          category: "RESPONSIBLE_AUTHORITY",
          label: "Autoridad del responsable",
        },
      ];
  return (
    <JourneyShell
      steps={steps}
      title={
        step === "review"
          ? "Revisa y envía la solicitud"
          : "Solicitud de creación de academia"
      }
      subtitle={
        step === "review"
          ? "Confirma los datos de la academia y de la persona responsable."
          : "Información de la academia"
      }
    >
      {step === "type" ? (
        <GlassCard>
          <Text style={journeyStyles.sectionTitle}>Tipo seleccionado</Text>
          <Text style={styles.selectedType}>{typeName}</Text>
          <Notice>
            El tipo de academia queda definido para esta solicitud.
          </Notice>
        </GlassCard>
      ) : null}
      {step === "academy" ? (
        <View style={journeyStyles.section}>
          <GlassCard>
            <View style={styles.typeBanner}>
              <Text style={journeyStyles.summaryText}>Tipo seleccionado</Text>
              <Text style={styles.selectedType}>{typeName}</Text>
            </View>
            <Text style={journeyStyles.sectionTitle}>
              Información de la academia
            </Text>
            <View style={journeyStyles.grid}>
              <Field
                {...target("academy.academyName")}
                label={formal ? "Nombre legal" : "Nombre operativo o comercial"}
                onChangeText={(value) => update("academyName", value)}
                value={form.academyName}
              />
              {formal ? (
                <>
                  <Field
                    {...target("organizationType")}
                    label="Tipo de organización"
                    onChangeText={(value) =>
                      setForm(
                        (current) =>
                          ({
                            ...current,
                            organizationType: value,
                          }) as typeof current,
                      )
                    }
                    value={(form as FormalAcademyForm).organizationType}
                  />
                  <Field
                    {...target("nit")}
                    label="NIT"
                    onChangeText={(value) =>
                      setForm(
                        (current) =>
                          ({ ...current, nit: value }) as typeof current,
                      )
                    }
                    value={(form as FormalAcademyForm).nit}
                  />
                </>
              ) : null}
              <CountryField label="País de la academia" />
              <MunicipalitySelect
                {...target("academy.city")}
                label="Municipio de la academia"
                onChange={(value) => update("city", value)}
                value={form.city}
              />
              <Field
                {...target("academy.trainingPlace")}
                label="Dirección o lugar de operación (opcional)"
                onChangeText={(value) => update("trainingPlace", value)}
                value={form.trainingPlace}
              />
            </View>
            {!formal ? (
              <>
                <Choice
                  label="Declaro que esta actividad es operada directamente por mí."
                  selected={(form as NaturalAcademyForm).operationDeclared}
                  onPress={() =>
                    setForm(
                      (current) =>
                        ({
                          ...current,
                          operationDeclared: !(current as NaturalAcademyForm)
                            .operationDeclared,
                        }) as typeof current,
                    )
                  }
                />
                <Notice>
                  Esta solicitud no presenta la academia como una entidad
                  jurídica formalmente certificada. La academia solo existirá
                  como organización aprobada después de la revisión de un
                  Administrador.
                </Notice>
              </>
            ) : (
              <Notice>
                La academia solo existirá como organización aprobada después de
                la revisión de un Administrador.
              </Notice>
            )}
          </GlassCard>
        </View>
      ) : null}
      {step === "responsible" ? (
        <GlassCard>
          <Text style={journeyStyles.sectionTitle}>Persona responsable</Text>
          <View style={journeyStyles.grid}>
            <Field
              {...target("academy.responsiblePerson.legalNames")}
              label="Nombres legales"
              onChangeText={(value) => updateResponsible("names", value)}
              value={form.responsible.names}
            />
            <Field
              {...target("academy.responsiblePerson.legalSurnames")}
              label="Apellidos legales"
              onChangeText={(value) => updateResponsible("surnames", value)}
              value={form.responsible.surnames}
            />
            <DocumentTypeSelect
              {...target("academy.responsiblePerson.documentType")}
              onChange={(value) => updateResponsible("documentType", value)}
              subject="adult"
              value={form.responsible.documentType}
            />
            <Field
              {...target("academy.responsiblePerson.documentNumber")}
              autoCapitalize="characters"
              label="Número de documento"
              onChangeText={(value) =>
                updateResponsible("documentNumber", value)
              }
              value={form.responsible.documentNumber}
            />
            <DateField
              {...target("academy.responsiblePerson.birthDate")}
              onChange={(value) => updateResponsible("birthDate", value)}
              value={form.responsible.birthDate}
            />
            <CountryField label="País de la persona responsable" />
            <MunicipalitySelect
              {...target("academy.responsiblePerson.city")}
              label="Municipio de la persona responsable"
              onChange={(value) => updateResponsible("city", value)}
              value={form.responsible.city}
            />
            <Field
              {...target("academy.responsiblePerson.phone")}
              keyboardType="phone-pad"
              label="Teléfono obligatorio"
              onChangeText={(value) => updateResponsible("phone", value)}
              value={form.responsible.phone}
            />
            <Field
              {...target("credentials.email")}
              autoCapitalize="none"
              keyboardType="email-address"
              label="Correo electrónico de acceso"
              onChangeText={(value) => update("email", value)}
              value={form.email}
            />
            <Field
              {...target("credentials.password")}
              label="Contraseña de acceso"
              onChangeText={(value) => update("password", value)}
              secureTextEntry
              value={form.password}
            />
          </View>
        </GlassCard>
      ) : null}
      {step === "documents" ? (
        <EvidenceRequirements
          items={uploadEvidence}
          queue={evidenceQueue}
          readOnly={readOnly}
          focusRequest={focusDocument}
          errorCategory={focusDocument?.category}
          error={error}
        />
      ) : null}
      {step === "declarations" ? (
        <GlassCard>
          <Text style={journeyStyles.sectionTitle}>
            Declaraciones requeridas
          </Text>
          {formal ? (
            <Choice
              {...target("authorityDeclared")}
              label="Autoridad para presentar la solicitud"
              selected={(form as FormalAcademyForm).authorityDeclared}
              onPress={() =>
                setForm(
                  (current) =>
                    ({
                      ...current,
                      authorityDeclared: !(current as FormalAcademyForm)
                        .authorityDeclared,
                    }) as typeof current,
                )
              }
            />
          ) : (
            <>
              <Choice
                {...target("operationDeclared")}
                label="Operación directa"
                selected={(form as NaturalAcademyForm).operationDeclared}
                onPress={() =>
                  setForm(
                    (current) =>
                      ({
                        ...current,
                        operationDeclared: !(current as NaturalAcademyForm)
                          .operationDeclared,
                      }) as typeof current,
                  )
                }
              />
              <Choice
                {...target("proofCategories")}
                label="Autorización de uso del lugar"
                selected={(form as NaturalAcademyForm).proofCategories.includes(
                  "PLACE_USE_AUTHORIZATION",
                )}
                onPress={() =>
                  setForm(
                    (current) =>
                      ({
                        ...current,
                        proofCategories: ["PLACE_USE_AUTHORIZATION"],
                      }) as typeof current,
                  )
                }
              />
            </>
          )}
          <Choice
            {...target("consent.truthfulnessAccepted")}
            label="Información veraz"
            selected={form.truthfulnessAccepted}
            onPress={() =>
              update("truthfulnessAccepted", !form.truthfulnessAccepted)
            }
          />
          <Choice
            {...target("consent.privacyAccepted")}
            label="Tratamiento de datos"
            selected={form.privacyAccepted}
            onPress={() => update("privacyAccepted", !form.privacyAccepted)}
          />
        </GlassCard>
      ) : null}
      {step === "review" ? (
        <View style={styles.reviewGrid}>
          <View style={styles.column}>
            <GlassCard>
              <Text style={journeyStyles.summaryTitle}>Academia</Text>
              <Text style={styles.selectedType}>{academySummary}</Text>
              <Text style={journeyStyles.summaryText}>{typeName}</Text>
              {formal ? (
                <Text style={journeyStyles.summaryText}>
                  {(form as FormalAcademyForm).nit
                    ? `NIT · •••${(form as FormalAcademyForm).nit.slice(-4)}`
                    : "NIT pendiente"}
                </Text>
              ) : (
                <Notice>
                  Sin declaración de certificación jurídica automática.
                </Notice>
              )}
            </GlassCard>
            <GlassCard>
              <Text style={journeyStyles.summaryTitle}>Responsable</Text>
              <Text style={journeyStyles.summaryText}>
                {responsibleSummary}
              </Text>
              <Text style={journeyStyles.summaryText}>
                Teléfono obligatorio · {form.responsible.phone || "Pendiente"}
              </Text>
              <Notice>Acceso restringido pendiente hasta la aprobación.</Notice>
            </GlassCard>
          </View>
          <View style={styles.column}>
            <EvidenceRequirements
              items={uploadEvidence}
              queue={evidenceQueue}
              readOnly
            />
            <GlassCard>
              <Text style={journeyStyles.summaryTitle}>
                Declaraciones requeridas
              </Text>
              <Choice
                label="Declaraciones requeridas"
                selected={ready}
                onPress={() =>
                  setForm((current) =>
                    formal
                      ? ({
                          ...current,
                          authorityDeclared: true,
                          privacyAccepted: true,
                          truthfulnessAccepted: true,
                        } as typeof current)
                      : ({
                          ...current,
                          operationDeclared: true,
                          privacyAccepted: true,
                          truthfulnessAccepted: true,
                        } as typeof current),
                  )
                }
              />
            </GlassCard>
          </View>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="assertive" style={journeyStyles.error}>
          {error}
        </Text>
      ) : null}
      {submitted ? (
        <Text accessibilityLiveRegion="assertive" style={journeyStyles.muted}>
          Solicitud enviada. Estado confirmado: en revisión.
        </Text>
      ) : null}
      <Actions
        busy={busy || submitted}
        onBack={!submitted ? (index > 0 ? back : onExit) : undefined}
        onPrimary={step === "review" ? submit : next}
        primaryLabel={
          step === "review" ? "Enviar solicitud" : "Guardar y continuar"
        }
        secondaryLabel="Volver"
      />
    </JourneyShell>
  );
}

const styles = StyleSheet.create({
  selectedType: { color: "#F4F6EB", fontSize: 18, fontWeight: "900" },
  typeBanner: {
    borderBottomColor: "rgba(210,255,226,.25)",
    borderBottomWidth: 1,
    gap: 5,
    paddingBottom: 16,
  },
  reviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  column: { flex: 1, minWidth: 300 },
});
