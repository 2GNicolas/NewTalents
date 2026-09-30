import { COLOMBIA_MUNICIPALITIES } from "./colombia-municipalities";

export const COLOMBIA_COUNTRY_CODE = "CO" as const;
export const COLOMBIA_DOCUMENT_TYPES = Object.freeze([
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "RC", label: "Registro civil de nacimiento" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PASSPORT", label: "Pasaporte" },
] as const);
export type ColombiaDocumentType =
  (typeof COLOMBIA_DOCUMENT_TYPES)[number]["value"];
export type RegistrationPersonSubject = "adult" | "minor";
export const ADULT_DOCUMENT_TYPES = Object.freeze([
  "CC",
  "CE",
  "PASSPORT",
] as const satisfies readonly ColombiaDocumentType[]);
export const MINOR_DOCUMENT_TYPES = Object.freeze([
  "TI",
  "RC",
  "CE",
  "PASSPORT",
] as const satisfies readonly ColombiaDocumentType[]);
export type RegistrationFieldIssue = Readonly<{
  field: string;
  message: string;
}>;

const municipalityByCode: ReadonlyMap<
  string,
  (typeof COLOMBIA_MUNICIPALITIES)[number]
> = new Map(COLOMBIA_MUNICIPALITIES.map((item) => [item.code, item]));
const documentPatterns: Readonly<Record<ColombiaDocumentType, RegExp>> = {
  // Registraduría confirms that legacy citizenship numbers of up to eight digits
  // remain valid while NUIP-era documents use ten digits.
  CC: /^\d{3,10}$/,
  TI: /^\d{5,11}$/,
  RC: /^[A-Z0-9-]{5,20}$/,
  CE: /^[A-Z0-9-]{3,15}$/,
  PASSPORT: /^[A-Z0-9-]{5,16}$/,
};

export function municipalityLabel(code: string): string {
  const municipality = municipalityByCode.get(code);
  return municipality
    ? `${titleCase(municipality.name)} — ${titleCase(municipality.department)}`
    : code;
}

export function isMunicipalityCode(value: string): boolean {
  return municipalityByCode.has(value);
}

export function validateDocumentNumber(
  type: string,
  rawNumber: string,
): string | null {
  if (!COLOMBIA_DOCUMENT_TYPES.some((item) => item.value === type))
    return "Selecciona un tipo de documento válido.";
  const value = rawNumber.trim().toUpperCase().replace(/\s+/g, "");
  if (!value) return "Ingresa el número de documento.";
  if (!documentPatterns[type as ColombiaDocumentType].test(value)) {
    if (type === "CC")
      return "La cédula debe contener entre 3 y 10 dígitos; se aceptan números antiguos.";
    if (type === "TI")
      return "La tarjeta de identidad debe contener entre 5 y 11 dígitos.";
    if (type === "RC")
      return "Ingresa entre 5 y 20 caracteres del indicativo serial o NUIP.";
    if (type === "CE")
      return "La cédula de extranjería debe tener entre 3 y 15 letras, números o guiones.";
    return "El pasaporte debe tener entre 5 y 16 letras, números o guiones.";
  }
  return null;
}

export function documentTypesForSubject(
  subject: RegistrationPersonSubject,
): readonly ColombiaDocumentType[] {
  return subject === "adult" ? ADULT_DOCUMENT_TYPES : MINOR_DOCUMENT_TYPES;
}

export function isDocumentTypeAllowedForSubject(
  type: string,
  subject: RegistrationPersonSubject,
): boolean {
  return (documentTypesForSubject(subject) as readonly string[]).includes(type);
}

export function validateBirthDate(
  value: string,
  today = new Date(),
): string | null {
  if (!value.trim()) return "Selecciona la fecha de nacimiento.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Usa el formato AAAA-MM-DD.";
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month! - 1 ||
    parsed.getUTCDate() !== day
  )
    return "La fecha de nacimiento no existe.";
  const todayIso = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  if (parsed > todayIso)
    return "La fecha de nacimiento no puede estar en el futuro.";
  return null;
}

export function validatePerson(
  value: Readonly<Record<string, unknown>> | undefined,
  prefix: string,
  options: Readonly<{
    phoneRequired?: boolean;
    age?: "adult" | "minor";
    today?: Date;
  }> = {},
): readonly RegistrationFieldIssue[] {
  const person = value ?? {};
  const issues: RegistrationFieldIssue[] = [];
  const requiredText = (key: string, message: string) => {
    if (typeof person[key] !== "string" || !person[key].trim())
      issues.push({ field: `${prefix}.${key}`, message });
  };
  requiredText("legalNames", "Ingresa los nombres legales.");
  requiredText("legalSurnames", "Ingresa los apellidos legales.");
  const documentType =
    typeof person.documentType === "string" ? person.documentType : "";
  const documentNumber =
    typeof person.documentNumber === "string" ? person.documentNumber : "";
  if (!documentType)
    issues.push({
      field: `${prefix}.documentType`,
      message: "Selecciona el tipo de documento.",
    });
  else if (
    options.age &&
    !isDocumentTypeAllowedForSubject(documentType, options.age)
  )
    issues.push({
      field: `${prefix}.documentType`,
      message:
        options.age === "adult"
          ? "Selecciona un documento permitido para una persona adulta."
          : "Selecciona un documento permitido para una persona menor de edad.",
    });
  const documentError = validateDocumentNumber(documentType, documentNumber);
  if (documentError)
    issues.push({ field: `${prefix}.documentNumber`, message: documentError });
  const birthDate =
    typeof person.birthDate === "string" ? person.birthDate : "";
  const dateError = validateBirthDate(birthDate, options.today);
  if (dateError)
    issues.push({ field: `${prefix}.birthDate`, message: dateError });
  if (person.country !== COLOMBIA_COUNTRY_CODE)
    issues.push({
      field: `${prefix}.country`,
      message: "El país disponible para este MVP es Colombia.",
    });
  if (typeof person.city !== "string" || !isMunicipalityCode(person.city))
    issues.push({
      field: `${prefix}.city`,
      message: "Selecciona un municipio del catálogo oficial DANE.",
    });
  if (
    options.phoneRequired &&
    (typeof person.phone !== "string" || !person.phone.trim())
  )
    issues.push({
      field: `${prefix}.phone`,
      message: "Ingresa el teléfono obligatorio.",
    });
  if (options.age && !dateError) {
    const adult = ageOn(birthDate, options.today ?? new Date()) >= 18;
    if (options.age === "adult" && !adult)
      issues.push({
        field: `${prefix}.birthDate`,
        message: "La persona debe tener 18 años o más.",
      });
    if (options.age === "minor" && adult)
      issues.push({
        field: `${prefix}.birthDate`,
        message: "La persona debe ser menor de 18 años.",
      });
  }
  return issues;
}

export function firstIssue(
  issues: readonly RegistrationFieldIssue[],
): RegistrationFieldIssue | undefined {
  return issues[0];
}

function ageOn(birthDate: string, today: Date): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - year!;
  if (
    today.getMonth() + 1 < month! ||
    (today.getMonth() + 1 === month && today.getDate() < day!)
  )
    age -= 1;
  return age;
}

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase("es-CO")
    .replace(/(^|[\s-])\p{L}/gu, (match) => match.toLocaleUpperCase("es-CO"))
    .replace(/D\.c\./g, "D.C.");
}
