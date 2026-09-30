import { useState } from "react";
import { Text, View } from "react-native";

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
import type {
  EvidenceCategory,
  RegistrationEvidenceUploadQueue,
} from "../evidence/upload-queue";
import { validateCompletedRegistrationDraft } from "../flows/registration-submission";
import type { RegistrationDraft } from "../registration-request-api";
import { municipalityLabel } from "../validation/registration-person-validation";
import {
  AcademyBanner,
  type AcademyContext,
  SummaryRows,
} from "./academy-operation-shared";

type Person = {
  names: string;
  surnames: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  country: string;
  city: string;
  phone?: string;
};
type Form = {
  minor: Person;
  representative: Person;
  relationship: "MOTHER" | "FATHER" | "LEGAL_GUARDIAN";
  authorityDeclared: boolean;
  representationAccepted: boolean;
  minorTreatmentAccepted: boolean;
  academyPresentationAccepted: boolean;
  privacyAccepted: boolean;
  truthfulnessAccepted: boolean;
};
const person = (value: Person) => ({
  legalNames: value.names,
  legalSurnames: value.surnames,
  documentType: value.documentType,
  documentNumber: value.documentNumber,
  birthDate: value.birthDate,
  country: value.country,
  city: value.city,
  ...(value.phone ? { phone: value.phone } : {}),
});
const blankPerson: Person = {
  names: "",
  surnames: "",
  documentType: "",
  documentNumber: "",
  birthDate: "",
  country: "CO",
  city: "",
  phone: "",
};
const empty: Form = {
  minor: { ...blankPerson },
  representative: { ...blankPerson },
  relationship: "MOTHER",
  authorityDeclared: false,
  representationAccepted: false,
  minorTreatmentAccepted: false,
  academyPresentationAccepted: false,
  privacyAccepted: false,
  truthfulnessAccepted: false,
};
const valid: Form = {
  minor: {
    names: "Valentina",
    surnames: "P.",
    documentType: "RC",
    documentNumber: "1000641",
    birthDate: "2012-08-22",
    country: "CO",
    city: "11001",
    phone: "",
  },
  representative: {
    names: "Mariana",
    surnames: "Torres G.",
    documentType: "CC",
    documentNumber: "10327392",
    birthDate: "1986-06-09",
    country: "CO",
    city: "11001",
    phone: "3000000017",
  },
  relationship: "MOTHER",
  authorityDeclared: true,
  representationAccepted: true,
  minorTreatmentAccepted: true,
  academyPresentationAccepted: true,
  privacyAccepted: true,
  truthfulnessAccepted: true,
};

export function buildAcademyMinorPlayerDraft(
  academyId: string,
  form: Form,
): RegistrationDraft {
  return {
    type: "ACADEMY_MINOR_PLAYER",
    academyId,
    details: {
      minor: person(form.minor),
      representative: person(form.representative),
      relationship: form.relationship,
      authorityDeclared: form.authorityDeclared,
      consent: {
        privacyVersion: "2026-09",
        privacyAccepted: form.privacyAccepted,
        truthfulnessAccepted: form.truthfulnessAccepted,
        representationAccepted: form.representationAccepted,
        minorTreatmentAccepted: form.minorTreatmentAccepted,
        academyPresentationAccepted: form.academyPresentationAccepted,
      },
    },
  };
}

function PersonFields({
  path,
  subject,
  prefix,
  value,
  onChange,
  phoneRequired = false,
  fieldErrors,
  focusField,
}: Readonly<{
  path: "minor" | "representative";
  subject: "adult" | "minor";
  prefix: string;
  value: Person;
  onChange: (value: Person) => void;
  phoneRequired?: boolean;
  fieldErrors: Record<string, string>;
  focusField?: { field: string; nonce: number };
}>) {
  const set = (key: keyof Person, next: string) =>
    onChange({ ...value, [key]: next });
  const target = (field: string) => ({
    focusRequest:
      focusField?.field === `${path}.${field}` ? focusField.nonce : undefined,
    error: fieldErrors[`${path}.${field}`],
  });
  return (
    <View style={{ gap: 12 }}>
      <Field
        {...target("legalNames")}
        label={`Nombres legales ${prefix}`}
        value={value.names}
        onChangeText={(next) => set("names", next)}
      />
      <Field
        {...target("legalSurnames")}
        label={`Apellidos legales ${prefix}`}
        value={value.surnames}
        onChangeText={(next) => set("surnames", next)}
      />
      <DocumentTypeSelect
        {...target("documentType")}
        label={`Tipo de documento ${prefix}`}
        value={value.documentType}
        onChange={(next) => set("documentType", next)}
        subject={subject}
      />
      <Field
        {...target("documentNumber")}
        autoCapitalize="characters"
        label={`Número de documento ${prefix}`}
        value={value.documentNumber}
        onChangeText={(next) => set("documentNumber", next)}
      />
      <DateField
        {...target("birthDate")}
        label={`Fecha de nacimiento ${prefix}`}
        value={value.birthDate}
        onChange={(next) => set("birthDate", next)}
      />
      <CountryField label={`País ${prefix}`} />
      <MunicipalitySelect
        {...target("city")}
        label={`Municipio ${prefix}`}
        value={value.city}
        onChange={(next) => set("city", next)}
      />
      {phoneRequired ? (
        <Field
          {...target("phone")}
          label="Teléfono obligatorio del representante"
          keyboardType="phone-pad"
          value={value.phone}
          onChangeText={(next) => set("phone", next)}
        />
      ) : null}
    </View>
  );
}

export function AcademyMinorPlayerFlow({
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
    const draft = buildAcademyMinorPlayerDraft(academy.id, form);
    const issues = validateCompletedRegistrationDraft(draft);
    const labels: Record<string, string> = {
      MINOR_CIVIL_IDENTITY: "registro civil del menor",
      IDENTITY_FRONT: "documento del representante — frente",
      IDENTITY_BACK: "documento del representante — reverso",
      REPRESENTATION_AUTHORITY: "documento de representación legal",
    };
    const missing = (
      [
        "MINOR_CIVIL_IDENTITY",
        "IDENTITY_FRONT",
        "IDENTITY_BACK",
        "REPRESENTATION_AUTHORITY",
      ] as const satisfies readonly EvidenceCategory[]
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
      setError(`Selecciona la evidencia requerida: ${labels[missing]}.`);
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
  return (
    <JourneyShell
      steps={[
        "Menor",
        "Representante",
        "Documentos",
        "Consentimiento",
        "Envío",
      ].map((label) => ({
        label,
        state: label === "Envío" ? ("current" as const) : ("complete" as const),
      }))}
      title="Revisa y envía el registro del jugador menor"
      subtitle="Confirma la información antes de enviar la solicitud. Será revisada por un Administrador de New Talents."
    >
      <AcademyBanner academy={academy} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <View style={{ flex: 1, minWidth: 300 }}>
          <GlassCard>
            <Text style={journeyStyles.summaryTitle}>
              Datos del jugador menor
            </Text>
            {initialValid ? (
              <SummaryRows
                rows={[
                  {
                    label: "Nombre",
                    value: `${form.minor.names} ${form.minor.surnames}`,
                  },
                  { label: "Fecha de nacimiento", value: form.minor.birthDate },
                  {
                    label: "Registro civil",
                    value: `••••${form.minor.documentNumber.slice(-4)}`,
                  },
                  { label: "País", value: "Colombia" },
                  {
                    label: "Municipio",
                    value: municipalityLabel(form.minor.city),
                  },
                ]}
              />
            ) : (
              <PersonFields
                path="minor"
                subject="minor"
                prefix="del menor"
                value={form.minor}
                onChange={(value) => set("minor", value)}
                fieldErrors={fieldErrors}
                focusField={focusField}
              />
            )}
            <Notice>El menor no recibirá una cuenta.</Notice>
          </GlassCard>
          <GlassCard>
            <Text style={journeyStyles.summaryTitle}>Representante legal</Text>
            {initialValid ? (
              <SummaryRows
                rows={[
                  {
                    label: "Nombre",
                    value: `${form.representative.names} ${form.representative.surnames}`,
                  },
                  {
                    label: "Documento",
                    value: `••••${form.representative.documentNumber.slice(-4)}`,
                  },
                  {
                    label: "Teléfono obligatorio",
                    value: form.representative.phone,
                  },
                  {
                    label: "Relación con el menor",
                    value:
                      form.relationship === "MOTHER"
                        ? "Madre"
                        : form.relationship === "FATHER"
                          ? "Padre"
                          : "Tutor legal",
                  },
                ]}
              />
            ) : (
              <>
                <PersonFields
                  path="representative"
                  subject="adult"
                  prefix="del representante"
                  value={form.representative}
                  phoneRequired
                  onChange={(value) => set("representative", value)}
                  fieldErrors={fieldErrors}
                  focusField={focusField}
                />
                <Choice
                  role="radio"
                  label="Madre"
                  selected={form.relationship === "MOTHER"}
                  onPress={() => set("relationship", "MOTHER")}
                />
                <Choice
                  role="radio"
                  label="Padre"
                  selected={form.relationship === "FATHER"}
                  onPress={() => set("relationship", "FATHER")}
                />
                <Choice
                  role="radio"
                  label="Tutor legal"
                  selected={form.relationship === "LEGAL_GUARDIAN"}
                  onPress={() => set("relationship", "LEGAL_GUARDIAN")}
                />
              </>
            )}
          </GlassCard>
        </View>
        <View style={{ flex: 1, minWidth: 300 }}>
          <EvidenceRequirements
            title="Documentos y autorización"
            queue={evidenceQueue}
            items={[
              {
                category: "MINOR_CIVIL_IDENTITY",
                label: "Registro civil del menor",
              },
              {
                category: "IDENTITY_FRONT",
                label: "Documento del representante — frente",
              },
              {
                category: "IDENTITY_BACK",
                label: "Documento del representante — reverso",
              },
              {
                category: "REPRESENTATION_AUTHORITY",
                label: "Documento de representación legal",
              },
            ]}
          />
          <GlassCard>
            <Text style={journeyStyles.summaryTitle}>
              Declaraciones requeridas
            </Text>
            <Choice
              {...target("authorityDeclared")}
              label="Declaro autoridad legal"
              selected={form.authorityDeclared}
              onPress={() => set("authorityDeclared", !form.authorityDeclared)}
            />
            <Choice
              {...target("consent.representationAccepted")}
              label="Autorización de representación"
              selected={form.representationAccepted}
              onPress={() =>
                set("representationAccepted", !form.representationAccepted)
              }
            />
            <Choice
              {...target("consent.minorTreatmentAccepted")}
              label="Tratamiento de datos del menor"
              selected={form.minorTreatmentAccepted}
              onPress={() =>
                set("minorTreatmentAccepted", !form.minorTreatmentAccepted)
              }
            />
            <Choice
              {...target("consent.academyPresentationAccepted")}
              label="Autorizo a la academia a registrar al menor"
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
            <Notice>La academia no reemplaza al representante legal.</Notice>
          </GlassCard>
        </View>
      </View>
      <GlassCard>
        <Text style={journeyStyles.summaryTitle}>
          ¿Qué sucede después de enviar?
        </Text>
        <Text style={journeyStyles.summaryText}>
          Se crearán el jugador, su relación legal y su vínculo deportivo con la
          academia, además de un pasaporte básico activo.
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
