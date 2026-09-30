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
  municipalityLabel,
  validatePerson,
  type RegistrationFieldIssue,
} from "../validation/registration-person-validation";

export type AdultStep =
  "account" | "identity" | "documents" | "consent" | "review";
export type PersonalAdultForm = {
  email: string;
  password: string;
  legalNames: string;
  legalSurnames: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  country: string;
  city: string;
  phone: string;
  privacyAccepted: boolean;
  truthfulnessAccepted: boolean;
};

const defaults: PersonalAdultForm = {
  email: "",
  password: "",
  legalNames: "",
  legalSurnames: "",
  documentType: "",
  documentNumber: "",
  birthDate: "",
  country: "CO",
  city: "",
  phone: "",
  privacyAccepted: false,
  truthfulnessAccepted: false,
};
const order: readonly AdultStep[] = [
  "account",
  "identity",
  "documents",
  "consent",
  "review",
];
const labels = [
  "Cuenta",
  "Identidad",
  "Documentos",
  "Consentimiento",
  "Envío",
] as const;

export function buildPersonalAdultDraft(
  form: PersonalAdultForm,
): Extract<RegistrationDraft, { type: "PERSONAL_ADULT" }> {
  return {
    type: "PERSONAL_ADULT",
    details: {
      credentials: {
        email: form.email.trim(),
        password: form.password,
        passwordConfirmation: form.password,
      },
      person: {
        legalNames: form.legalNames.trim(),
        legalSurnames: form.legalSurnames.trim(),
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim(),
        birthDate: form.birthDate,
        country: form.country,
        city: form.city,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      },
      actingForSelf: true,
      consent: {
        privacyVersion: "2026-09",
        privacyAccepted: form.privacyAccepted,
        truthfulnessAccepted: form.truthfulnessAccepted,
      },
    },
  };
}

export function PersonalAdultFlow({
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
  initialStep?: AdultStep;
  onSave: (
    draft: Extract<RegistrationDraft, { type: "PERSONAL_ADULT" }>,
    identityFields?: readonly string[],
  ) => Promise<readonly RegistrationFieldIssue[]> | readonly RegistrationFieldIssue[] | void;
  onSubmit: (
    draft: Extract<RegistrationDraft, { type: "PERSONAL_ADULT" }>,
  ) => Promise<boolean> | boolean | void;
  getSubmissionError?: () => string | null;
  getSubmissionFailureStep?: () => string | null;
  getSubmissionFailureField?: () => string | null;
  getSubmissionFailureCategory?: () => EvidenceCategory | null;
  evidenceQueue?: RegistrationEvidenceUploadQueue;
  onExit?: () => void;
  readOnly?: boolean;
}>) {
  const [step, setStep] = useState<AdultStep>(initialStep);
  const [form, setForm] = useState(defaults);
  const [error, setError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusField, setFocusField] = useState<{
    field: string;
    nonce: number;
  }>();
  const [focusDocument, setFocusDocument] = useState<{
    category: EvidenceCategory;
    nonce: number;
  }>();
  const index = order.indexOf(step);
  const draft = useMemo(() => buildPersonalAdultDraft(form), [form]);
  const identityName =
    [form.legalNames, form.legalSurnames].filter(Boolean).join(" ") ||
    "Información personal pendiente";
  const documentSummary = form.documentNumber
    ? `${form.documentType || "Documento"} · ••••${form.documentNumber.slice(-4)}`
    : "Documento pendiente";
  const locationSummary = form.city
    ? `${municipalityLabel(form.city)}, Colombia`
    : "Municipio pendiente";
  const steps = labels.map((label, position) => ({
    label,
    state:
      position < index
        ? ("complete" as const)
        : position === index
          ? ("current" as const)
          : ("pending" as const),
  }));
  const update = <K extends keyof PersonalAdultForm>(
    key: K,
    value: PersonalAdultForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      const fieldByKey: Partial<Record<K, string>> = {
        email: "credentials.email",
        password: "credentials.password",
        legalNames: "person.legalNames",
        legalSurnames: "person.legalSurnames",
        documentType: "person.documentType",
        documentNumber: "person.documentNumber",
        birthDate: "person.birthDate",
        country: "person.country",
        city: "person.city",
        phone: "person.phone",
      } as Partial<Record<K, string>>;
      const field = fieldByKey[key];
      if (field) delete next[field];
      return next;
    });
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
  const next = async () => {
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
    if (step === "identity")
      issues.push(
        ...validatePerson(
          draft.details.person as Readonly<Record<string, unknown>>,
          "person",
          { age: "adult" },
        ),
      );
    if (step === "documents") {
      const missing = (["IDENTITY_FRONT", "IDENTITY_BACK"] as const).find(
        (category) => !evidenceQueue?.hasCategory(category),
      );
      if (missing) {
        setFocusDocument({ category: missing, nonce: Date.now() });
        setError(
          missing === "IDENTITY_FRONT"
            ? "Selecciona el frente del documento."
            : "Selecciona el reverso del documento.",
        );
        return;
      }
    }
    if (step === "consent") {
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
      const serverIssues = await onSave(draft, step === "identity" ? ["person.documentNumber"] : []);
      if (serverIssues?.length && block(serverIssues)) return;
      if (index < order.length - 1) setStep(order[index + 1]!);
    } finally {
      setBusy(false);
    }
  };
  const back = () => {
    if (index > 0) setStep(order[index - 1]!);
  };
  const submit = async () => {
    if (readOnly) {
      setError(
        "Esta vista previa es de solo lectura. Abre la ruta de registro sin ?preview= para enviar.",
      );
      return;
    }
    if (!form.privacyAccepted || !form.truthfulnessAccepted) {
      const field = !form.privacyAccepted
        ? "consent.privacyAccepted"
        : "consent.truthfulnessAccepted";
      const message = "Confirma el tratamiento de datos y la veracidad.";
      setStep("consent");
      setError(message);
      setFieldErrors({ [field]: message });
      setFocusField({ field, nonce: Date.now() });
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
        if (failureStep && order.includes(failureStep as AdultStep))
          setStep(failureStep as AdultStep);
        const field = getSubmissionFailureField?.();
        const category = getSubmissionFailureCategory?.();
        const message =
          getSubmissionError?.() ??
          "El envío no fue confirmado. Reintenta sin perder tus datos.";
        if (field) {
          setFieldErrors({ [field]: message });
          setFocusField({ field, nonce: Date.now() });
        }
        if (category) setFocusDocument({ category, nonce: Date.now() });
        setError(message);
      }
    } catch {
      setError(
        "El envío no fue confirmado. Reintenta sin perder tus datos y documentos.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <JourneyShell
      steps={steps}
      title={
        step === "review"
          ? "Revisa y envía tu solicitud"
          : "Solicitud de registro"
      }
      subtitle={
        step === "review"
          ? "Confirma la información antes de enviarla a revisión."
          : step === "identity"
            ? "Tu cuenta e identidad"
            : "Completa cada paso. Tu borrador se guarda mientras avanzas."
      }
    >
      {step === "account" ? (
        <GlassCard>
          <Text style={journeyStyles.sectionTitle}>
            Crea tu cuenta protegida
          </Text>
          <View style={journeyStyles.grid}>
            <Field
              {...target("credentials.email")}
              autoCapitalize="none"
              keyboardType="email-address"
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
          <Notice>
            La contraseña no se guarda en el borrador ni se muestra en
            respuestas.
          </Notice>
        </GlassCard>
      ) : null}
      {step === "identity" ? (
        <View style={journeyStyles.section}>
          <GlassCard>
            <Text style={journeyStyles.sectionTitle}>
              Tu cuenta e identidad
            </Text>
            <View style={journeyStyles.grid}>
              <Field
                {...target("person.legalNames")}
                label="Nombres legales"
                onChangeText={(value) => update("legalNames", value)}
                value={form.legalNames}
              />
              <Field
                {...target("person.legalSurnames")}
                label="Apellidos legales"
                onChangeText={(value) => update("legalSurnames", value)}
                value={form.legalSurnames}
              />
              <DocumentTypeSelect
                {...target("person.documentType")}
                onChange={(value) => update("documentType", value)}
                subject="adult"
                value={form.documentType}
              />
              <Field
                {...target("person.documentNumber")}
                autoCapitalize="characters"
                label="Número de documento"
                onChangeText={(value) => update("documentNumber", value)}
                value={form.documentNumber}
              />
              <DateField
                {...target("person.birthDate")}
                onChange={(value) => update("birthDate", value)}
                value={form.birthDate}
              />
              <CountryField />
              <MunicipalitySelect
                {...target("person.city")}
                onChange={(value) => update("city", value)}
                value={form.city}
              />
              <Field
                {...target("person.phone")}
                keyboardType="phone-pad"
                label="Teléfono (opcional)"
                onChangeText={(value) => update("phone", value)}
                value={form.phone}
              />
            </View>
            <Notice>
              La mayoría de edad se verifica en el servidor con tu fecha de
              nacimiento al enviar y aprobar.
            </Notice>
          </GlassCard>
        </View>
      ) : null}
      {step === "documents" ? (
        <EvidenceRequirements
          items={[
            { category: "IDENTITY_FRONT", label: "Documento — frente" },
            { category: "IDENTITY_BACK", label: "Documento — reverso" },
          ]}
          queue={evidenceQueue}
          readOnly={readOnly}
          focusRequest={focusDocument}
          errorCategory={focusDocument?.category}
          error={error}
        />
      ) : null}
      {step === "consent" ? (
        <GlassCard>
          <Text style={journeyStyles.sectionTitle}>Consentimiento</Text>
          <Choice
            {...target("consent.privacyAccepted")}
            label="Tratamiento de datos personales"
            selected={form.privacyAccepted}
            onPress={() => update("privacyAccepted", !form.privacyAccepted)}
            supportingText="Autorizo el tratamiento de mis datos para revisar esta solicitud."
          />
          <Choice
            {...target("consent.truthfulnessAccepted")}
            label="Declaración de veracidad"
            selected={form.truthfulnessAccepted}
            onPress={() =>
              update("truthfulnessAccepted", !form.truthfulnessAccepted)
            }
            supportingText="Confirmo que la información suministrada es correcta."
          />
        </GlassCard>
      ) : null}
      {step === "review" ? (
        <View style={styles.reviewGrid}>
          <View style={styles.reviewColumn}>
            <EvidenceRequirements
              items={[
                { category: "IDENTITY_FRONT", label: "Documento — frente" },
                { category: "IDENTITY_BACK", label: "Documento — reverso" },
              ]}
              queue={evidenceQueue}
              readOnly
            />
            <GlassCard>
              <Text style={journeyStyles.summaryTitle}>
                Archivos privados y temporales
              </Text>
              <Text style={journeyStyles.summaryText}>
                Sin reconocimiento facial, biometría ni aprobación automática.
              </Text>
            </GlassCard>
          </View>
          <View style={styles.reviewColumn}>
            <GlassCard>
              <Text style={journeyStyles.summaryTitle}>Resumen</Text>
              <Text style={journeyStyles.summaryText}>{identityName}</Text>
              <Text style={journeyStyles.summaryText}>{documentSummary}</Text>
              <Text style={journeyStyles.summaryText}>{locationSummary}</Text>
            </GlassCard>
            <GlassCard>
              <Text style={journeyStyles.summaryTitle}>
                Consentimiento obligatorio
              </Text>
              <Choice
                label="Consentimiento obligatorio"
                selected={form.privacyAccepted && form.truthfulnessAccepted}
                onPress={() => {
                  const value = !(
                    form.privacyAccepted && form.truthfulnessAccepted
                  );
                  setForm((current) => ({
                    ...current,
                    privacyAccepted: value,
                    truthfulnessAccepted: value,
                  }));
                }}
                supportingText="Declaro que la información es correcta y autorizo su tratamiento."
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
  reviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  reviewColumn: { flex: 1, minWidth: 300 },
});
