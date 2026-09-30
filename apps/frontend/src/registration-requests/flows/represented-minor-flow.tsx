import { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { RegistrationDraft } from "../registration-request-api";
import type { RegistrationEvidenceUploadQueue } from "../evidence/upload-queue";
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
import type { EvidenceCategory } from "../evidence/upload-queue";
import { validateCompletedRegistrationDraft } from "./registration-submission";
import {
  firstIssue,
  validatePerson,
  type RegistrationFieldIssue,
} from "../validation/registration-person-validation";

export type MinorStep =
  "account" | "representative" | "minor" | "documents" | "consent" | "review";
export type RepresentedMinorForm = {
  email: string;
  password: string;
  representativeNames: string;
  representativeSurnames: string;
  representativeDocumentType: string;
  representativeDocumentNumber: string;
  representativeBirthDate: string;
  representativeCountry: string;
  representativeCity: string;
  representativePhone: string;
  relationship: "MOTHER" | "FATHER" | "LEGAL_GUARDIAN";
  minorNames: string;
  minorSurnames: string;
  minorDocumentType: string;
  minorDocumentNumber: string;
  minorBirthDate: string;
  minorCountry: string;
  minorCity: string;
  authorityDeclared: boolean;
  privacyAccepted: boolean;
  truthfulnessAccepted: boolean;
  minorTreatmentAccepted: boolean;
};

const defaults: RepresentedMinorForm = {
  email: "",
  password: "",
  representativeNames: "",
  representativeSurnames: "",
  representativeDocumentType: "",
  representativeDocumentNumber: "",
  representativeBirthDate: "",
  representativeCountry: "CO",
  representativeCity: "",
  representativePhone: "",
  relationship: "MOTHER",
  minorNames: "",
  minorSurnames: "",
  minorDocumentType: "",
  minorDocumentNumber: "",
  minorBirthDate: "",
  minorCountry: "CO",
  minorCity: "",
  authorityDeclared: false,
  privacyAccepted: false,
  truthfulnessAccepted: false,
  minorTreatmentAccepted: false,
};
const order: readonly MinorStep[] = [
  "account",
  "representative",
  "minor",
  "documents",
  "consent",
  "review",
];
const labels = [
  "Cuenta",
  "Representante",
  "Menor",
  "Documentos",
  "Consentimiento",
  "Envío",
] as const;
const evidenceItems: readonly Readonly<{
  category: EvidenceCategory;
  label: string;
}>[] = [
  { category: "IDENTITY_FRONT", label: "Documento del representante — frente" },
  { category: "IDENTITY_BACK", label: "Documento del representante — reverso" },
  {
    category: "MINOR_CIVIL_IDENTITY",
    label: "Identidad del menor o registro civil",
  },
  {
    category: "REPRESENTATION_AUTHORITY",
    label: "Evidencia de representación legal",
  },
];

export function buildRepresentedMinorDraft(
  form: RepresentedMinorForm,
): Extract<RegistrationDraft, { type: "REPRESENTED_MINOR" }> {
  const person = (prefix: "representative" | "minor") => ({
    legalNames: form[`${prefix}Names`],
    legalSurnames: form[`${prefix}Surnames`],
    documentType: form[`${prefix}DocumentType`],
    documentNumber: form[`${prefix}DocumentNumber`],
    birthDate: form[`${prefix}BirthDate`],
    country: form[`${prefix}Country`],
    city: form[`${prefix}City`],
  });
  return {
    type: "REPRESENTED_MINOR",
    details: {
      credentials: {
        email: form.email.trim(),
        password: form.password,
        passwordConfirmation: form.password,
      },
      representative: {
        ...person("representative"),
        phone: form.representativePhone.trim(),
      },
      minor: person("minor"),
      relationship: form.relationship,
      authorityDeclared: form.authorityDeclared,
      consent: {
        privacyVersion: "2026-09",
        privacyAccepted: form.privacyAccepted,
        truthfulnessAccepted: form.truthfulnessAccepted,
        representationAccepted: form.authorityDeclared,
        minorTreatmentAccepted: form.minorTreatmentAccepted,
      },
    },
  };
}

export function RepresentedMinorFlow({
  initialStep = "account",
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
  initialStep?: MinorStep;
  onSave: (
    draft: Extract<RegistrationDraft, { type: "REPRESENTED_MINOR" }>,
    identityFields?: readonly string[],
  ) => Promise<readonly RegistrationFieldIssue[]> | readonly RegistrationFieldIssue[] | void;
  onSubmit: (
    draft: Extract<RegistrationDraft, { type: "REPRESENTED_MINOR" }>,
  ) => Promise<boolean> | boolean | void;
  getSubmissionError?: () => string | null;
  getSubmissionFailureStep?: () => string | null;
  getSubmissionFailureField?: () => string | null;
  getSubmissionFailureCategory?: () => EvidenceCategory | null;
  evidenceQueue?: RegistrationEvidenceUploadQueue;
  onExit?: () => void;
  readOnly?: boolean;
}>) {
  const [step, setStep] = useState<MinorStep>(initialStep);
  const [form, setForm] = useState(defaults);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    category: EvidenceCategory;
    nonce: number;
  }>();
  const [focusField, setFocusField] = useState<{
    field: string;
    nonce: number;
  }>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);
  const index = order.indexOf(step);
  const draft = useMemo(() => buildRepresentedMinorDraft(form), [form]);
  const steps = labels.map((label, position) => ({
    label,
    state:
      position < index
        ? ("complete" as const)
        : position === index
          ? ("current" as const)
          : ("pending" as const),
  }));
  const update = <K extends keyof RepresentedMinorForm>(
    key: K,
    value: RepresentedMinorForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(undefined);
  };
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
    setError(first.message);
    setFocusField({ field: first.field, nonce: Date.now() });
    return true;
  };
  const showFailure = (
    message: string,
    field?: string | null,
    category?: EvidenceCategory | null,
  ) => {
    setError(message);
    if (field) {
      setFieldErrors({ [field]: message });
      setFocusField({ field, nonce: Date.now() });
    }
    if (category) setFocusRequest({ category, nonce: Date.now() });
  };
  const missingDocument = () =>
    evidenceItems.find((item) => !evidenceQueue?.hasCategory(item.category));
  const next = async () => {
    if (busy) return;
    const issues: RegistrationFieldIssue[] = [];
    if (step === "account") {
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
    if (step === "representative") {
      issues.push(
        ...validatePerson(
          draft.details.representative as Readonly<Record<string, unknown>>,
          "representative",
          { phoneRequired: true, age: "adult" },
        ),
      );
    }
    if (step === "minor")
      issues.push(
        ...validatePerson(
          draft.details.minor as Readonly<Record<string, unknown>>,
          "minor",
          { age: "minor" },
        ),
      );
    if (step === "documents" && !readOnly) {
      const missing = missingDocument();
      if (missing) {
        setError(`Selecciona ${missing.label} antes de continuar.`);
        setFocusRequest({ category: missing.category, nonce: Date.now() });
        return;
      }
    }
    if (step === "consent") {
      if (!form.authorityDeclared)
        issues.push({
          field: "consent.representationAccepted",
          message: "Confirma la autoridad legal.",
        });
      if (!form.minorTreatmentAccepted)
        issues.push({
          field: "consent.minorTreatmentAccepted",
          message: "Confirma el tratamiento de datos del menor.",
        });
      if (!form.privacyAccepted)
        issues.push({
          field: "consent.privacyAccepted",
          message: "Acepta el tratamiento de datos personales.",
        });
      if (!form.truthfulnessAccepted)
        issues.push({
          field: "consent.truthfulnessAccepted",
          message: "Confirma la declaración de veracidad.",
        });
    }
    if (block(issues)) return;
    setError(undefined);
    setFieldErrors({});
    setBusy(true);
    try {
      const identityFields = step === "representative" ? ["representative.documentNumber"] : step === "minor" ? ["minor.documentNumber"] : [];
      const serverIssues = await onSave(draft, identityFields);
      if (serverIssues?.length && block(serverIssues)) return;
      setStep(order[index + 1] ?? step);
    } catch {
      setError(
        "No pudimos conservar este paso. Tus datos siguen disponibles para reintentar.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (submitting.current || submitted) return;
    if (readOnly) {
      setError(
        "Esta vista previa es de solo lectura. Abre la ruta de registro sin ?preview= para enviar.",
      );
      return;
    }
    if (
      !form.authorityDeclared ||
      !form.minorTreatmentAccepted ||
      !form.privacyAccepted ||
      !form.truthfulnessAccepted
    ) {
      setStep("consent");
      const field = !form.authorityDeclared
        ? "consent.representationAccepted"
        : !form.minorTreatmentAccepted
          ? "consent.minorTreatmentAccepted"
          : !form.privacyAccepted
            ? "consent.privacyAccepted"
            : "consent.truthfulnessAccepted";
      showFailure(
        "Confirma la autoridad legal y el tratamiento de datos.",
        field,
      );
      return;
    }
    const issues = validateCompletedRegistrationDraft(draft);
    if (issues.length) {
      const issue = issues[0]!;
      setStep(
        issue.field.startsWith("credentials.")
          ? "account"
          : issue.field.startsWith("consent.")
            ? "consent"
            : issue.field.startsWith("minor.")
              ? "minor"
              : "representative",
      );
      showFailure(issue.message, issue.field);
      return;
    }
    const missing = missingDocument();
    if (missing) {
      setStep("documents");
      setError(`Selecciona ${missing.label} antes de enviar.`);
      setFocusRequest({ category: missing.category, nonce: Date.now() });
      return;
    }
    submitting.current = true;
    setError(undefined);
    setBusy(true);
    try {
      if (await onSubmit(draft)) {
        setForm((current) => ({ ...current, password: "" }));
        setSubmitted(true);
      } else {
        const failureStep = getSubmissionFailureStep?.();
        if (failureStep && order.includes(failureStep as MinorStep))
          setStep(failureStep as MinorStep);
        showFailure(
          getSubmissionError?.() ??
            "El envío no fue confirmado. Reintenta sin perder tus datos.",
          getSubmissionFailureField?.(),
          getSubmissionFailureCategory?.(),
        );
      }
    } catch {
      setError(
        "El envío no fue confirmado. Reintenta sin perder tus datos y documentos.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const back = () => setStep(order[index - 1] ?? step);
  const representativeName =
    [form.representativeNames, form.representativeSurnames]
      .filter(Boolean)
      .join(" ") || "Información de la persona representante pendiente";
  const representativeDocument = form.representativeDocumentNumber
    ? `${form.representativeDocumentType || "Documento"} · ••••${form.representativeDocumentNumber.slice(-4)}`
    : "Documento pendiente";
  const representativeCard = (
    <GlassCard>
      <Text style={journeyStyles.sectionTitle}>
        Tus datos como representante
      </Text>
      <Text style={journeyStyles.summaryText}>{representativeName}</Text>
      <Text style={journeyStyles.summaryText}>{representativeDocument}</Text>
      <Text style={journeyStyles.summaryText}>Teléfono obligatorio</Text>
      <Text style={journeyStyles.summaryText}>
        {form.representativePhone || "Pendiente"}
      </Text>
      <Text style={journeyStyles.summaryText}>
        Relación con el menor ·{" "}
        {form.relationship === "MOTHER"
          ? "Madre"
          : form.relationship === "FATHER"
            ? "Padre"
            : "Tutor legal"}
      </Text>
    </GlassCard>
  );
  return (
    <JourneyShell
      steps={steps}
      title={
        step === "review"
          ? "Revisa y envía la solicitud"
          : "Solicitud de registro"
      }
      subtitle={
        step === "minor"
          ? "Representante legal y menor"
          : step === "review"
            ? "Confirma la información del representante y del menor."
            : "Completa cada paso de la solicitud."
      }
    >
      {step === "account" ? (
        <GlassCard>
          <Text style={journeyStyles.sectionTitle}>
            Cuenta de la persona representante
          </Text>
          <View style={journeyStyles.grid}>
            <Field
              {...target("credentials.email")}
              autoCapitalize="none"
              label="Correo electrónico"
              onChangeText={(value) => update("email", value)}
              value={form.email}
            />
            <Field
              {...target("credentials.password")}
              label="Contraseña"
              onChangeText={(value) => update("password", value)}
              secureTextEntry
              value={form.password}
            />
          </View>
        </GlassCard>
      ) : null}
      {step === "representative" ? (
        <GlassCard>
          <Text style={journeyStyles.sectionTitle}>Persona representante</Text>
          <View style={journeyStyles.grid}>
            <Field
              {...target("representative.legalNames")}
              label="Nombres legales"
              onChangeText={(value) => update("representativeNames", value)}
              value={form.representativeNames}
            />
            <Field
              {...target("representative.legalSurnames")}
              label="Apellidos legales"
              onChangeText={(value) => update("representativeSurnames", value)}
              value={form.representativeSurnames}
            />
            <DocumentTypeSelect
              {...target("representative.documentType")}
              onChange={(value) => update("representativeDocumentType", value)}
              subject="adult"
              value={form.representativeDocumentType}
            />
            <Field
              {...target("representative.documentNumber")}
              autoCapitalize="characters"
              label="Número de documento"
              onChangeText={(value) =>
                update("representativeDocumentNumber", value)
              }
              value={form.representativeDocumentNumber}
            />
            <DateField
              {...target("representative.birthDate")}
              onChange={(value) => update("representativeBirthDate", value)}
              value={form.representativeBirthDate}
            />
            <CountryField label="País de la persona representante" />
            <MunicipalitySelect
              {...target("representative.city")}
              label="Municipio de la persona representante"
              onChange={(value) => update("representativeCity", value)}
              value={form.representativeCity}
            />
            <Field
              {...target("representative.phone")}
              keyboardType="phone-pad"
              label="Teléfono obligatorio"
              onChangeText={(value) => update("representativePhone", value)}
              value={form.representativePhone}
            />
          </View>
          <Text style={journeyStyles.sectionTitle}>Relación con el menor</Text>
          {(["MOTHER", "FATHER", "LEGAL_GUARDIAN"] as const).map((value) => (
            <Choice
              key={value}
              label={
                value === "MOTHER"
                  ? "Madre"
                  : value === "FATHER"
                    ? "Padre"
                    : "Tutor legal"
              }
              role="radio"
              selected={form.relationship === value}
              onPress={() => update("relationship", value)}
            />
          ))}
        </GlassCard>
      ) : null}
      {step === "minor" ? (
        <View style={styles.twoColumns}>
          {representativeCard}
          <GlassCard style={styles.column}>
            <Text style={journeyStyles.sectionTitle}>Datos del menor</Text>
            <View style={journeyStyles.grid}>
              <Field
                {...target("minor.legalNames")}
                label="Nombre legal del menor"
                onChangeText={(value) => update("minorNames", value)}
                value={form.minorNames}
              />
              <Field
                {...target("minor.legalSurnames")}
                label="Apellidos del menor"
                onChangeText={(value) => update("minorSurnames", value)}
                value={form.minorSurnames}
              />
              <DateField
                {...target("minor.birthDate")}
                label="Fecha de nacimiento del menor"
                onChange={(value) => update("minorBirthDate", value)}
                value={form.minorBirthDate}
              />
              <DocumentTypeSelect
                {...target("minor.documentType")}
                label="Tipo de documento del menor"
                onChange={(value) => update("minorDocumentType", value)}
                subject="minor"
                value={form.minorDocumentType}
              />
              <Field
                {...target("minor.documentNumber")}
                autoCapitalize="characters"
                label="Número de documento del menor"
                onChangeText={(value) => update("minorDocumentNumber", value)}
                value={form.minorDocumentNumber}
              />
              <CountryField label="País del menor" />
              <MunicipalitySelect
                {...target("minor.city")}
                label="Municipio del menor"
                onChange={(value) => update("minorCity", value)}
                value={form.minorCity}
              />
            </View>
            <Notice>
              El menor no recibirá cuenta, correo electrónico ni contraseña.
            </Notice>
          </GlassCard>
        </View>
      ) : null}
      {step === "documents" ? (
        <EvidenceRequirements
          items={evidenceItems}
          queue={evidenceQueue}
          readOnly={readOnly}
          focusRequest={focusRequest}
          errorCategory={focusRequest?.category}
          error={error}
        />
      ) : null}
      {step === "consent" ? (
        <GlassCard>
          <Text style={journeyStyles.sectionTitle}>
            Declaraciones y consentimiento
          </Text>
          <Choice
            {...target("consent.representationAccepted")}
            label="Autoridad legal"
            selected={form.authorityDeclared}
            onPress={() => update("authorityDeclared", !form.authorityDeclared)}
            supportingText="Declaro que cuento con autoridad para presentar esta solicitud."
          />
          <Choice
            {...target("consent.minorTreatmentAccepted")}
            label="Tratamiento de datos del menor"
            selected={form.minorTreatmentAccepted}
            onPress={() =>
              update("minorTreatmentAccepted", !form.minorTreatmentAccepted)
            }
          />
          <Choice
            {...target("consent.privacyAccepted")}
            label="Privacidad (versión 2026-09)"
            selected={form.privacyAccepted}
            onPress={() => update("privacyAccepted", !form.privacyAccepted)}
          />
          <Choice
            {...target("consent.truthfulnessAccepted")}
            label="Veracidad"
            selected={form.truthfulnessAccepted}
            onPress={() =>
              update("truthfulnessAccepted", !form.truthfulnessAccepted)
            }
          />
        </GlassCard>
      ) : null}
      {step === "review" ? (
        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <EvidenceRequirements
              items={evidenceItems}
              queue={evidenceQueue}
              readOnly
            />
          </View>
          <View style={styles.column}>
            {representativeCard}
            <GlassCard>
              <Text style={journeyStyles.summaryTitle}>Menor</Text>
              <Text style={journeyStyles.summaryText}>
                {[form.minorNames, form.minorSurnames]
                  .filter(Boolean)
                  .join(" ") || "Información del menor pendiente"}
              </Text>
              <Notice>El menor no recibirá una cuenta.</Notice>
            </GlassCard>
            <GlassCard>
              <Choice
                label="Declaración de autoridad legal"
                selected={form.authorityDeclared}
                onPress={() => setStep("consent")}
              />
              <Choice
                label="Consentimiento obligatorio"
                selected={
                  form.privacyAccepted &&
                  form.truthfulnessAccepted &&
                  form.minorTreatmentAccepted
                }
                onPress={() => setStep("consent")}
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
  twoColumns: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  column: { flex: 1, minWidth: 300 },
});
