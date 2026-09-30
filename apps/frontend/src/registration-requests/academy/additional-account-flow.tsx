import { useState } from "react";
import { Text, View } from "react-native";

import type { RegistrationDraft } from "../registration-request-api";
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
  journeyStyles,
  MunicipalitySelect,
  Notice,
} from "../components/registration-journey";
import type { RegistrationEvidenceUploadQueue } from "../evidence/upload-queue";
import {
  AcademyBanner,
  type AcademyContext,
  SummaryRows,
} from "./academy-operation-shared";
import { validateCompletedRegistrationDraft } from "../flows/registration-submission";

type Form = {
  names: string;
  surnames: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  country: string;
  city: string;
  phone: string;
  function: string;
  responsibleAuthorization: boolean;
  privacyAccepted: boolean;
  truthfulnessAccepted: boolean;
};
const empty: Form = {
  names: "",
  surnames: "",
  documentType: "",
  documentNumber: "",
  birthDate: "",
  country: "CO",
  city: "",
  phone: "",
  function: "",
  responsibleAuthorization: false,
  privacyAccepted: false,
  truthfulnessAccepted: false,
};
const valid: Form = {
  names: "Laura",
  surnames: "Martínez R.",
  documentType: "CC",
  documentNumber: "10327392",
  birthDate: "1991-04-18",
  country: "CO",
  city: "11001",
  phone: "3000000017",
  function: "Coordinadora administrativa",
  responsibleAuthorization: true,
  privacyAccepted: true,
  truthfulnessAccepted: true,
};

export function buildAdditionalAccountDraft(
  academyId: string,
  form: Form,
): RegistrationDraft {
  return {
    type: "ADDITIONAL_ACADEMY_ACCOUNT",
    academyId,
    details: {
      person: {
        legalNames: form.names,
        legalSurnames: form.surnames,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        birthDate: form.birthDate,
        country: form.country,
        city: form.city,
        ...(form.phone ? { phone: form.phone } : {}),
      },
      function: form.function,
      responsibleAuthorization: form.responsibleAuthorization,
      consent: {
        privacyVersion: "2026-09",
        privacyAccepted: form.privacyAccepted,
        truthfulnessAccepted: form.truthfulnessAccepted,
      },
    },
  };
}

export function AdditionalAccountFlow({
  academy,
  onSubmit,
  initialValid = false,
  evidenceQueue,
  getSubmissionError,
  onBack,
}: Readonly<{
  academy: AcademyContext;
  onSubmit: (draft: RegistrationDraft) => Promise<boolean>;
  initialValid?: boolean;
  evidenceQueue?: RegistrationEvidenceUploadQueue;
  getSubmissionError?: () => string | null;
  onBack?: () => void;
}>) {
  const [form, setForm] = useState(initialValid ? valid : empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusField, setFocusField] = useState<{
    field: string;
    nonce: number;
  }>();
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(undefined);
  };
  const target = (field: string) => ({
    focusRequest: focusField?.field === field ? focusField.nonce : undefined,
    error: fieldErrors[field],
  });
  const submit = async () => {
    const draft = buildAdditionalAccountDraft(academy.id, form);
    const issues = validateCompletedRegistrationDraft(draft);
    const missing = (
      [
        "IDENTITY_FRONT",
        "IDENTITY_BACK",
        "ACADEMY_ACCOUNT_AUTHORIZATION",
      ] as const
    ).find((category) => !evidenceQueue?.hasCategory(category));
    if (issues.length) {
      const issue = issues[0]!;
      setFieldErrors(
        Object.fromEntries(issues.map((item) => [item.field, item.message])),
      );
      setFocusField({ field: issue.field, nonce: Date.now() });
      setError(issue.message);
      return;
    }
    if (missing) {
      setError(
        `Selecciona la evidencia requerida: ${missing === "IDENTITY_FRONT" ? "documento de identidad — frente" : missing === "IDENTITY_BACK" ? "documento de identidad — reverso" : "autorización del responsable de la academia"}.`,
      );
      return;
    }
    setBusy(true);
    setError(undefined);
    setFieldErrors({});
    try {
      if (!(await onSubmit(draft)))
        setError(
          getSubmissionError?.() ??
            "El envío no fue confirmado. Revisa la conexión e inténtalo de nuevo sin perder los datos.",
        );
    } catch {
      setError(
        "El envío no fue confirmado. Inténtalo de nuevo sin perder los datos.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <JourneyShell
      steps={["Cuenta", "Función", "Documentos", "Declaraciones", "Envío"].map(
        (label) => ({
          label,
          state:
            label === "Envío" ? ("current" as const) : ("complete" as const),
        }),
      )}
      title="Revisa y envía la solicitud de cuenta"
      subtitle="Confirma los datos antes de enviar la solicitud. Será revisada por un Administrador de New Talents."
    >
      <AcademyBanner academy={academy} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <GlassCard style={{ flex: 1, minWidth: 300 }}>
          <Text style={journeyStyles.summaryTitle}>Solicitante</Text>
          {initialValid ? (
            <SummaryRows
              rows={[
                { label: "Nombre", value: `${form.names} ${form.surnames}` },
                {
                  label: "Documento",
                  value: `••••${form.documentNumber.slice(-4)}`,
                },
                { label: "Función en la academia", value: form.function },
              ]}
            />
          ) : (
            <View style={{ gap: 12 }}>
              <Field
                {...target("person.legalNames")}
                label="Nombres legales"
                value={form.names}
                onChangeText={(value) => set("names", value)}
              />
              <Field
                {...target("person.legalSurnames")}
                label="Apellidos legales"
                value={form.surnames}
                onChangeText={(value) => set("surnames", value)}
              />
              <DocumentTypeSelect
                {...target("person.documentType")}
                value={form.documentType}
                onChange={(value) => set("documentType", value)}
                subject="adult"
              />
              <Field
                {...target("person.documentNumber")}
                autoCapitalize="characters"
                label="Número de documento"
                value={form.documentNumber}
                onChangeText={(value) => set("documentNumber", value)}
              />
              <DateField
                {...target("person.birthDate")}
                value={form.birthDate}
                onChange={(value) => set("birthDate", value)}
              />
              <CountryField />
              <MunicipalitySelect
                {...target("person.city")}
                value={form.city}
                onChange={(value) => set("city", value)}
              />
              <Field
                label="Teléfono (opcional)"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(value) => set("phone", value)}
              />
              <Field
                {...target("function")}
                label="Función en la academia"
                value={form.function}
                onChangeText={(value) => set("function", value)}
              />
            </View>
          )}
          <Notice>
            Se creará únicamente esta cuenta autorizada y su membresía en la
            academia.
          </Notice>
        </GlassCard>
        <View style={{ flex: 1, minWidth: 300 }}>
          <EvidenceRequirements
            title="Documentos y evidencias"
            queue={evidenceQueue}
            items={[
              {
                category: "IDENTITY_FRONT",
                label: "Documento de identidad — frente",
              },
              {
                category: "IDENTITY_BACK",
                label: "Documento de identidad — reverso",
              },
              {
                category: "ACADEMY_ACCOUNT_AUTHORIZATION",
                label: "Autorización del responsable de la academia",
              },
            ]}
          />
          <GlassCard>
            <Text style={journeyStyles.summaryTitle}>
              Declaraciones requeridas
            </Text>
            <Choice
              {...target("responsibleAuthorization")}
              label="Autorización de la academia"
              selected={form.responsibleAuthorization}
              onPress={() =>
                set("responsibleAuthorization", !form.responsibleAuthorization)
              }
            />
            <Choice
              {...target("consent.truthfulnessAccepted")}
              label="Información correcta"
              selected={form.truthfulnessAccepted}
              onPress={() =>
                set("truthfulnessAccepted", !form.truthfulnessAccepted)
              }
            />
            <Choice
              {...target("consent.privacyAccepted")}
              label="Tratamiento de datos"
              selected={form.privacyAccepted}
              onPress={() => set("privacyAccepted", !form.privacyAccepted)}
            />
          </GlassCard>
        </View>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="assertive" style={journeyStyles.error}>
          {error}
        </Text>
      ) : null}
      <Actions
        busy={busy}
        onPrimary={submit}
        primaryLabel="Enviar solicitud"
        secondaryLabel="Volver a la academia"
        onBack={onBack}
      />
    </JourneyShell>
  );
}
