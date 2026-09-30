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
import { municipalityLabel } from "../validation/registration-person-validation";

type Form = {
  names: string;
  surnames: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  country: string;
  city: string;
  phone?: string;
  adultAuthorization: boolean;
  academyPresentationAccepted: boolean;
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
  adultAuthorization: false,
  academyPresentationAccepted: false,
  privacyAccepted: false,
  truthfulnessAccepted: false,
};
const valid: Form = {
  names: "Andrés Felipe",
  surnames: "R.",
  documentType: "CC",
  documentNumber: "10184186",
  birthDate: "2003-05-14",
  country: "CO",
  city: "11001",
  phone: "",
  adultAuthorization: true,
  academyPresentationAccepted: true,
  privacyAccepted: true,
  truthfulnessAccepted: true,
};

export function buildAcademyAdultPlayerDraft(
  academyId: string,
  form: Form,
): RegistrationDraft {
  return {
    type: "ACADEMY_ADULT_PLAYER",
    academyId,
    details: {
      player: {
        legalNames: form.names,
        legalSurnames: form.surnames,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        birthDate: form.birthDate,
        country: form.country,
        city: form.city,
        ...(form.phone ? { phone: form.phone } : {}),
      },
      adultAuthorization: form.adultAuthorization,
      consent: {
        privacyVersion: "2026-09",
        privacyAccepted: form.privacyAccepted,
        truthfulnessAccepted: form.truthfulnessAccepted,
        academyPresentationAccepted: form.academyPresentationAccepted,
      },
    },
  };
}

export function AcademyAdultPlayerFlow({
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
    const draft = buildAcademyAdultPlayerDraft(academy.id, form);
    const issues = validateCompletedRegistrationDraft(draft);
    const missing = (
      ["IDENTITY_FRONT", "IDENTITY_BACK", "ADULT_AUTHORIZATION"] as const
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
        `Selecciona la evidencia requerida: ${missing === "IDENTITY_FRONT" ? "documento — frente" : missing === "IDENTITY_BACK" ? "documento — reverso" : "autorización expresa del jugador"}.`,
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
            "El envío no fue confirmado. Reintenta sin perder la información.",
        );
    } catch {
      setError(
        "El envío no fue confirmado. Reintenta sin perder la información.",
      );
    } finally {
      setBusy(false);
    }
  };
  const rows = [
    { label: "Nombre", value: `${form.names} ${form.surnames}` },
    { label: "Fecha de nacimiento", value: form.birthDate },
    { label: "Documento", value: `••••${form.documentNumber.slice(-4)}` },
    { label: "País", value: "Colombia" },
    { label: "Municipio", value: municipalityLabel(form.city) },
  ];
  return (
    <JourneyShell
      steps={["Jugador", "Documentos", "Autorización", "Envío"].map(
        (label) => ({
          label,
          state:
            label === "Envío" ? ("current" as const) : ("complete" as const),
        }),
      )}
      title="Revisa y envía el registro del jugador adulto"
      subtitle="Confirma la información antes de enviar la solicitud. Será revisada por un Administrador de New Talents."
    >
      <AcademyBanner academy={academy} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <GlassCard style={{ flex: 1, minWidth: 300 }}>
          <Text style={journeyStyles.summaryTitle}>
            Información del jugador
          </Text>
          {initialValid ? (
            <SummaryRows rows={rows} />
          ) : (
            <View style={{ gap: 12 }}>
              <Field
                {...target("player.legalNames")}
                label="Nombres legales"
                value={form.names}
                onChangeText={(value) => set("names", value)}
              />
              <Field
                {...target("player.legalSurnames")}
                label="Apellidos legales"
                value={form.surnames}
                onChangeText={(value) => set("surnames", value)}
              />
              <DocumentTypeSelect
                {...target("player.documentType")}
                value={form.documentType}
                onChange={(value) => set("documentType", value)}
                subject="adult"
              />
              <Field
                {...target("player.documentNumber")}
                autoCapitalize="characters"
                label="Número de documento"
                value={form.documentNumber}
                onChangeText={(value) => set("documentNumber", value)}
              />
              <DateField
                {...target("player.birthDate")}
                value={form.birthDate}
                onChange={(value) => set("birthDate", value)}
              />
              <CountryField />
              <MunicipalitySelect
                {...target("player.city")}
                value={form.city}
                onChange={(value) => set("city", value)}
              />
              <Field
                label="Teléfono (opcional)"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(value) => set("phone", value)}
              />
            </View>
          )}
          <Notice>
            La información deportiva será completada más adelante por New
            Talents.
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
                category: "ADULT_AUTHORIZATION",
                label: "Autorización expresa del jugador",
              },
            ]}
          />
          <GlassCard>
            <Text style={journeyStyles.summaryTitle}>
              Autorización y consentimiento del jugador
            </Text>
            <Choice
              {...target("consent.academyPresentationAccepted")}
              label="Autorización expresa del jugador"
              selected={form.adultAuthorization}
              onPress={() =>
                set("adultAuthorization", !form.adultAuthorization)
              }
            />
            <Choice
              {...target("adultAuthorization")}
              label="Autorizo a la academia a presentar esta solicitud"
              selected={form.academyPresentationAccepted}
              onPress={() =>
                set(
                  "academyPresentationAccepted",
                  !form.academyPresentationAccepted,
                )
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
      <GlassCard>
        <Text style={journeyStyles.summaryTitle}>
          ¿Qué sucede después de enviar?
        </Text>
        <Text style={journeyStyles.summaryText}>
          Se creará el jugador, se vinculará a la academia y se generará un
          pasaporte básico activo. Esta solicitud no crea credenciales de acceso
          para el jugador.
        </Text>
      </GlassCard>
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
