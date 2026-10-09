import type { EvidenceCategory } from '../evidence/upload-queue';
import type { RegistrationRequestType } from '../registration-request-api';

export type SubmissionFailureStep = 'account' | 'identity' | 'representative' | 'minor' | 'academy' | 'responsible' | 'documents' | 'consent' | 'declarations' | 'review';
export type SubmissionFeedback = Readonly<{ message: string; step: SubmissionFailureStep; field?: string; category?: EvidenceCategory }>;
type Issue = Readonly<{ field: string; code: string; message?: string }>;
type Notice = 'registration-conflict' | 'version-conflict' | 'session-expired' | 'denied-or-not-found' | 'connectivity-failure' | 'unavailable-backend' | 'invalid-response';

const documents: Readonly<Record<EvidenceCategory, string>> = {
  IDENTITY_FRONT: 'documento de identidad — frente', IDENTITY_BACK: 'documento de identidad — reverso',
  MINOR_CIVIL_IDENTITY: 'identidad del menor o registro civil', REPRESENTATION_AUTHORITY: 'evidencia de representación legal',
  RUT: 'RUT', EXISTENCE_CERTIFICATE: 'certificado de existencia', RESPONSIBLE_AUTHORITY: 'autoridad del responsable',
  OPERATION_PROOF: 'prueba de operación', ADULT_AUTHORIZATION: 'autorización del adulto', ACADEMY_ACCOUNT_AUTHORIZATION: 'autorización de la cuenta',
};

export function feedbackForUpload(_type: RegistrationRequestType, category: EvidenceCategory, reason: string | undefined): SubmissionFeedback {
  const label = documents[category];
  const message = reason === 'unavailable-backend'
    ? `El escáner o el servicio de documentos no está disponible para ${label}; reintenta sin volver a seleccionar el archivo.`
    : reason === 'connectivity-failure'
      ? `No se confirmó la carga de ${label}; reintenta cuando vuelva la conexión.`
      : reason === 'session-expired'
        ? `La sesión expiró al cargar ${label}. Inicia sesión para continuar; el archivo sigue seleccionado.`
      : reason === 'version-conflict'
          ? `La solicitud cambió al cargar ${label}. Actualiza el estado y revisa el documento antes de reintentar.`
          : reason === 'too-large'
            ? `${label} supera el límite de 10 MiB. Selecciona un archivo más pequeño.`
            : reason === 'unsupported'
              ? `${label} debe ser un PDF, JPEG o PNG válido. Selecciona otro archivo.`
          : `No se pudo validar ${label}. Elige un PDF, JPEG o PNG válido y reintenta.`;
  return { message, step: 'documents', category };
}

export function feedbackForMissingDocument(category: EvidenceCategory): SubmissionFeedback {
  return { message: `Selecciona ${documents[category]} antes de enviar.`, step: 'documents', category };
}

export function feedbackForNotice(notice: Notice): SubmissionFeedback {
  switch (notice) {
    case 'registration-conflict': return { message: 'La solicitud coincide con un registro existente. Revisa los datos de la solicitud o solicita ayuda.', step: 'review' };
    case 'version-conflict': return { message: 'La solicitud cambió en el servidor. Actualizamos su estado; revisa los datos y documentos antes de reintentar.', step: 'review' };
    case 'session-expired': return { message: 'La sesión expiró. Inicia sesión para continuar; no se confirmó el envío.', step: 'account', field: 'credentials.email' };
    case 'denied-or-not-found': return { message: 'No pudimos verificar el acceso a esta solicitud. Inicia sesión con la cuenta solicitante para continuar.', step: 'account', field: 'credentials.email' };
    case 'connectivity-failure': return { message: 'No se confirmó el envío por un problema de conexión. Reintenta; conservamos los datos y la clave de envío.', step: 'review' };
    case 'unavailable-backend': return { message: 'No se confirmó el envío porque el servicio no está disponible. Reintenta más tarde sin perder tus datos.', step: 'review' };
    case 'invalid-response': return { message: 'No se confirmó el envío por una respuesta inesperada. Reintenta o solicita ayuda; tus datos siguen disponibles.', step: 'review' };
  }
}

export function feedbackForValidation(type: RegistrationRequestType, issues: readonly Issue[]): SubmissionFeedback {
  const field = issues[0]?.field ?? '';
  const code = issues[0]?.code;
  const academy = type === 'FORMAL_ACADEMY' || type === 'NATURAL_PERSON_ACADEMY';
  const consentStep = academy ? 'declarations' : 'consent';
  const personStep = type === 'PERSONAL_ADULT' ? 'identity' : 'representative';
  if (code === 'document_in_use') return { message: 'Ya existe un registro con este documento', step: field.startsWith('minor.') ? 'minor' : field.startsWith('academy.responsiblePerson.') ? 'responsible' : field.startsWith('representative.') ? 'representative' : field.startsWith('player.') ? 'identity' : personStep, field };
  if (code === 'nit_in_use') return { message: 'Este NIT ya está en uso', step: 'academy', field };
  if (code === 'academy_name_in_use') return { message: 'Ya existe un registro con este nombre de academia', step: 'academy', field };
  if (code === 'email_in_use') return { message: 'Ya existe un registro con este correo electrónico', step: type === 'FORMAL_ACADEMY' || type === 'NATURAL_PERSON_ACADEMY' ? 'responsible' : 'account', field };
  const descriptions: Readonly<Record<string, Readonly<{ step: SubmissionFailureStep; requirement: string }>>> = {
    'credentials.email': { step: 'account', requirement: 'Revisa el correo electrónico; usa una dirección válida.' },
    'credentials.password': { step: 'account', requirement: 'Revisa la contraseña; debe tener al menos 12 caracteres.' },
    'credentials.passwordConfirmation': { step: 'account', requirement: 'Confirma la misma contraseña para continuar.' },
    'person.legalNames': { step: 'identity', requirement: 'Indica los nombres legales.' },
    'person.legalSurnames': { step: 'identity', requirement: 'Indica los apellidos legales.' },
    'person.documentType': { step: 'identity', requirement: 'Indica el tipo de documento.' },
    'person.documentNumber': { step: 'identity', requirement: 'Indica un número de documento válido.' },
    'person.birthDate': { step: 'identity', requirement: 'Revisa la fecha de nacimiento; usa una fecha válida.' },
    'representative.legalNames': { step: 'representative', requirement: 'Indica los nombres legales de la persona representante.' },
    'representative.legalSurnames': { step: 'representative', requirement: 'Indica los apellidos legales de la persona representante.' },
    'representative.documentType': { step: 'representative', requirement: 'Indica el tipo de documento de la persona representante.' },
    'representative.documentNumber': { step: 'representative', requirement: 'Indica el número de documento de la persona representante.' },
    'representative.birthDate': { step: 'representative', requirement: 'Revisa la fecha de nacimiento de la persona representante.' },
    'representative.city': { step: 'representative', requirement: 'Indica la ciudad de la persona representante.' },
    'representative.phone': { step: 'representative', requirement: 'El teléfono de la persona representante es obligatorio.' },
    'minor.legalNames': { step: 'minor', requirement: 'Indica el nombre legal del menor.' },
    'minor.legalSurnames': { step: 'minor', requirement: 'Indica los apellidos del menor.' },
    'minor.birthDate': { step: 'minor', requirement: 'Revisa la fecha de nacimiento del menor; usa una fecha válida.' },
    'academy.academyName': { step: 'academy', requirement: 'Indica el nombre de la academia.' },
    'academy.responsiblePerson.phone': { step: 'responsible', requirement: 'El teléfono de la persona responsable es obligatorio.' },
    'academy.responsiblePerson.legalNames': { step: 'responsible', requirement: 'Indica los nombres legales de la persona responsable.' },
    'academy.responsiblePerson.legalSurnames': { step: 'responsible', requirement: 'Indica los apellidos legales de la persona responsable.' },
    nit: { step: 'academy', requirement: 'Indica un NIT válido.' },
    organizationType: { step: 'academy', requirement: 'Indica el tipo de organización.' },
    proofCategories: { step: 'declarations', requirement: 'Selecciona al menos una prueba de operación.' },
    authorityDeclared: { step: consentStep, requirement: 'Confirma la declaración de autoridad.' },
    operationDeclared: { step: 'declarations', requirement: 'Confirma la declaración de operación.' },
    'consent.privacyAccepted': { step: consentStep, requirement: 'Acepta el tratamiento de datos personales.' },
    'consent.truthfulnessAccepted': { step: consentStep, requirement: 'Confirma la declaración de veracidad.' },
    'consent.representationAccepted': { step: 'consent', requirement: 'Confirma la autorización de representación legal.' },
    'consent.minorTreatmentAccepted': { step: 'consent', requirement: 'Confirma el tratamiento de datos del menor.' },
  };
  const direct = descriptions[field];
  if (direct) return { message: direct.requirement, step: direct.step, field };
  if (field.startsWith('minor.')) return { message: 'Revisa los datos de identidad del menor; completa el campo requerido.', step: 'minor', field };
  if (field.startsWith('representative.')) return { message: 'Revisa los datos de la persona representante; completa el campo requerido.', step: 'representative', field };
  if (field.startsWith('academy.responsiblePerson.')) return { message: 'Revisa los datos de la persona responsable; completa el campo requerido.', step: 'responsible', field };
  if (field.startsWith('academy.')) return { message: 'Revisa la información de la academia; completa el campo requerido.', step: 'academy', field };
  if (field.startsWith('person.')) return { message: 'Revisa tu identidad; completa el campo requerido.', step: personStep, field };
  if (field.startsWith('consent.')) return { message: 'Revisa y confirma la autorización requerida.', step: consentStep, field };
  if (field === 'evidence') return { message: 'Revisa los documentos requeridos antes de enviar.', step: 'documents' };
  return { message: 'El servidor rechazó algunos datos. Revisa la solicitud y reintenta; tu información se conserva.', step: 'review' };
}
