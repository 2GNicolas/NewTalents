import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authTokens } from '../../design/tokens';
import { AuthButton, AuthTextField } from '../../design/components/auth-primitives';
import { DOMINANT_FOOT_LABELS, PASSPORT_DOMINANT_FOOT_VALUES, type CreateDraftInput, type DominantFoot, type EditableDraftResponse, type EditDraftInput, type ManagementContext, type RepresentativeRelationship } from '../passport-types';

export type DraftSubmission = Readonly<{ mode: 'create'; input: CreateDraftInput }> | Readonly<{ mode: 'edit'; input: EditDraftInput }>;
type Props = Readonly<{ mode: 'create' | 'edit'; managementContext?: ManagementContext; academyId?: string; initial?: EditableDraftResponse; submitting?: boolean; notice?: string | null; mutationAvailable?: boolean; onSubmit: (submission: DraftSubmission) => void }>;
type Values = { playerLegalName: string; dateOfBirth: string; playerDocumentType: string; playerDocumentNumber: string; primaryPosition: string; declaredAgeCategory: string; city: string; country: string; dominantFoot: DominantFoot | null; representativeLegalName: string; representativeDocumentType: string; representativeDocumentNumber: string; relationship: RepresentativeRelationship | null; authorityConfirmed: boolean; representativeConfirmationId: string };
const EMPTY: Values = { playerLegalName: '', dateOfBirth: '', playerDocumentType: '', playerDocumentNumber: '', primaryPosition: '', declaredAgeCategory: '', city: '', country: '', dominantFoot: null, representativeLegalName: '', representativeDocumentType: '', representativeDocumentNumber: '', relationship: null, authorityConfirmed: false, representativeConfirmationId: '' };
const LOCATION_FORBIDDEN = /[\d\r\n,;]|calle|carrera|avenida|transversal|diagonal|barrio|manzana|latitud|longitud|coordenada|coordinate|neighborhood|[#°]/i;
const trim = (value: string) => value.normalize('NFC').trim();
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) && new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value);

export function DraftForm({ mode, managementContext = 'SELF', academyId, initial, submitting = false, notice = null, mutationAvailable = true, onSubmit }: Props) {
  const [values, setValues] = useState<Values>(() => initial ? fromInitial(initial) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (initial) setValues(fromInitial(initial)); }, [initial]);
  const update = (field: keyof Values, value: string | boolean) => { setValues(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: '' })); };
  const validate = () => {
    const next: Record<string, string> = {};
    const required: Array<[keyof Values, string]> = [['playerLegalName', 'Requerido'], ['dateOfBirth', 'Requerido'], ['playerDocumentType', 'Requerido'], ['playerDocumentNumber', 'Requerido'], ['primaryPosition', 'Requerido'], ['declaredAgeCategory', 'Requerido'], ['city', 'Requerido'], ['country', 'Requerido']];
    for (const [field, message] of required) if (!trim(String(values[field]))) next[field] = message;
    if (values.dateOfBirth && !validDate(trim(values.dateOfBirth))) next.dateOfBirth = 'Usa el formato AAAA-MM-DD';
    if (values.city && LOCATION_FORBIDDEN.test(trim(values.city))) next.city = 'No incluyas dirección ni coordenadas';
    if (values.country && LOCATION_FORBIDDEN.test(trim(values.country))) next.country = 'No incluyas dirección ni coordenadas';
    if (!values.dominantFoot) next.dominantFoot = 'Selecciona una opción';
    if (mode === 'create' && managementContext === 'LEGAL_REPRESENTATIVE') {
      if (!trim(values.representativeLegalName)) next.representativeLegalName = 'Requerido';
      if (!trim(values.representativeDocumentType)) next.representativeDocumentType = 'Requerido';
      if (!trim(values.representativeDocumentNumber)) next.representativeDocumentNumber = 'Requerido';
      if (!values.relationship) next.relationship = 'Selecciona el vínculo';
      if (!values.authorityConfirmed) next.authorityConfirmed = 'Debes confirmar tu autoridad';
    }
    if (mode === 'create' && managementContext === 'ACADEMY') {
      if (!academyId) next.form = 'Falta el contexto autorizado de academia';
    }
    setErrors(next); return Object.values(next).every(value => !value);
  };
  const submit = () => {
    if (!mutationAvailable) { setErrors({ form: 'No disponible: la relación vigente ya no autoriza nuevas modificaciones.' }); return; }
    if (!validate() || !values.dominantFoot) return;
    const common = { playerLegalName: trim(values.playerLegalName), dateOfBirth: trim(values.dateOfBirth), playerDocument: { documentType: trim(values.playerDocumentType), documentNumber: trim(values.playerDocumentNumber) }, footballProfile: { primaryPosition: trim(values.primaryPosition), declaredAgeCategory: trim(values.declaredAgeCategory), city: trim(values.city), country: trim(values.country), dominantFoot: values.dominantFoot } };
    if (mode === 'edit') { onSubmit({ mode, input: { ...common, expectedVersion: initial?.version } }); return; }
    const confirmationId = trim(values.representativeConfirmationId);
    const input: CreateDraftInput = { managementContext, ...(managementContext === 'ACADEMY' && academyId ? { academyId } : {}), ...common, ...(managementContext === 'LEGAL_REPRESENTATIVE' ? { representative: { legalName: trim(values.representativeLegalName), documentType: trim(values.representativeDocumentType), documentNumber: trim(values.representativeDocumentNumber), relationship: values.relationship!, authorityConfirmed: true as const } } : {}), ...(managementContext === 'ACADEMY' && confirmationId ? { representativeConfirmationId: confirmationId } : {}) };
    onSubmit({ mode, input });
  };
  return <View style={styles.form}>
    {mode === 'create' ? <Text style={styles.help}>La edad la determina el servidor con la fecha vigente en Colombia y el umbral de 18 años. No se usa una casilla de mayoría de edad.</Text> : null}
    <AuthTextField label="Nombre legal del jugador" value={values.playerLegalName} error={errors.playerLegalName} onChangeText={value => update('playerLegalName', value)} />
    <AuthTextField label="Fecha de nacimiento" value={values.dateOfBirth} error={errors.dateOfBirth} placeholder="AAAA-MM-DD" onChangeText={value => update('dateOfBirth', value)} />
    <AuthTextField label="Tipo de documento del jugador" value={values.playerDocumentType} error={errors.playerDocumentType} onChangeText={value => update('playerDocumentType', value)} />
    <AuthTextField label="Número de documento del jugador" value={values.playerDocumentNumber} error={errors.playerDocumentNumber} onChangeText={value => update('playerDocumentNumber', value)} />
    <AuthTextField label="Posición" value={values.primaryPosition} error={errors.primaryPosition} onChangeText={value => update('primaryPosition', value)} />
    <AuthTextField label="Categoría de edad" value={values.declaredAgeCategory} error={errors.declaredAgeCategory} onChangeText={value => update('declaredAgeCategory', value)} />
    <AuthTextField label="Ciudad" value={values.city} error={errors.city} onChangeText={value => update('city', value)} />
    <AuthTextField label="País" value={values.country} error={errors.country} onChangeText={value => update('country', value)} />
    <View style={styles.group}><Text style={styles.label}>Pie dominante</Text><View style={styles.options}>{PASSPORT_DOMINANT_FOOT_VALUES.map(foot => <Pressable key={foot} accessibilityRole="button" accessibilityLabel={DOMINANT_FOOT_LABELS[foot]} accessibilityState={{ selected: values.dominantFoot === foot }} onPress={() => update('dominantFoot', foot)} style={[styles.option, values.dominantFoot === foot && styles.selected]}><Text style={styles.optionText}>{DOMINANT_FOOT_LABELS[foot]}</Text></Pressable>)}</View>{errors.dominantFoot ? <ErrorText text={errors.dominantFoot} /> : null}</View>
    {mode === 'create' && managementContext === 'LEGAL_REPRESENTATIVE' ? <View style={styles.group}>
      <Text style={styles.section}>Confirmación privada del representante</Text>
      <AuthTextField label="Nombre legal del representante" value={values.representativeLegalName} error={errors.representativeLegalName} onChangeText={value => update('representativeLegalName', value)} />
      <AuthTextField label="Tipo de documento del representante" value={values.representativeDocumentType} error={errors.representativeDocumentType} onChangeText={value => update('representativeDocumentType', value)} />
      <AuthTextField label="Número de documento del representante" value={values.representativeDocumentNumber} error={errors.representativeDocumentNumber} onChangeText={value => update('representativeDocumentNumber', value)} />
      <View style={styles.options}>{([['MOTHER', 'Madre'], ['FATHER', 'Padre'], ['LEGAL_GUARDIAN', 'Tutor legal']] as const).map(([relationship, label]) => <Pressable key={relationship} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: values.relationship === relationship }} onPress={() => update('relationship', relationship)} style={[styles.option, values.relationship === relationship && styles.selected]}><Text style={styles.optionText}>{label}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Confirmo que tengo autoridad para representar al menor" accessibilityState={{ checked: values.authorityConfirmed }} onPress={() => update('authorityConfirmed', !values.authorityConfirmed)} style={styles.checkbox}><Text style={styles.optionText}>{values.authorityConfirmed ? '✓ ' : ''}Confirmo que tengo autoridad para representar al menor</Text></Pressable>
      {errors.relationship ? <ErrorText text={errors.relationship} /> : null}{errors.authorityConfirmed ? <ErrorText text={errors.authorityConfirmed} /> : null}
    </View> : null}
    {mode === 'create' && managementContext === 'ACADEMY' ? <><Text style={styles.help}>Para un menor, la confirmación es obligatoria y debe haber sido creada por el Usuario representante identificado; para un adulto se deja vacía. La academia no confirma en su nombre.</Text><AuthTextField label="Confirmación del representante" value={values.representativeConfirmationId} error={errors.representativeConfirmationId} onChangeText={value => update('representativeConfirmationId', value)} /></> : null}
    {errors.form ? <ErrorText text={errors.form} /> : null}{notice ? <ErrorText text={notice} /> : null}
    <AuthButton label={mode === 'create' ? 'Crear borrador' : 'Guardar cambios'} onPress={submit} loading={submitting} disabled={submitting || !mutationAvailable} />
  </View>;
}
function fromInitial(initial: EditableDraftResponse): Values { return { ...EMPTY, playerLegalName: initial.playerLegalName, dateOfBirth: initial.dateOfBirth, playerDocumentType: initial.playerDocument.documentType, playerDocumentNumber: initial.playerDocument.documentNumber, primaryPosition: initial.footballProfile.primaryPosition, declaredAgeCategory: initial.footballProfile.declaredAgeCategory, city: initial.footballProfile.city, country: initial.footballProfile.country, dominantFoot: initial.footballProfile.dominantFoot }; }
function ErrorText({ text }: { text: string }) { return <Text accessibilityRole="alert" style={styles.error}>Error: {text}</Text>; }
const styles = StyleSheet.create({ form: { gap: authTokens.spacing.sm, width: '100%' }, group: { gap: authTokens.spacing.xs }, section: { color: authTokens.colors.textPrimary, ...authTokens.typography.label }, label: { color: authTokens.colors.textPrimary, ...authTokens.typography.label }, help: { color: authTokens.colors.textSecondary, ...authTokens.typography.caption }, error: { color: authTokens.colors.danger, ...authTokens.typography.caption }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: authTokens.spacing.xs }, option: { alignItems: 'center', backgroundColor: 'rgba(30,33,31,.76)', borderColor: 'rgba(139,162,148,.34)', borderRadius: 7, borderWidth: 1, minHeight: authTokens.sizing.minInteractiveSize, justifyContent: 'center', paddingHorizontal: authTokens.spacing.sm }, selected: { backgroundColor: 'rgba(199,255,46,.16)', borderColor: authTokens.colors.primary }, optionText: { color: authTokens.colors.textSecondary, ...authTokens.typography.label }, checkbox: { minHeight: authTokens.sizing.minInteractiveSize, justifyContent: 'center' } });
