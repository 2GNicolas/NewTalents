import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authTokens } from '../../design/tokens';
import type { EphemeralDocumentSource, EvidenceCategory, RegistrationEvidenceUploadQueue } from '../evidence/upload-queue';

type EvidenceUploadProps = Readonly<{
  queue: RegistrationEvidenceUploadQueue;
  requestId: string;
  expectedVersion: number;
  accessToken?: string;
  onPick: () => Promise<Readonly<{ category: EvidenceCategory; label: string; source: EphemeralDocumentSource }> | null>;
}>;

export function EvidenceUpload({ queue, requestId, expectedVersion, accessToken, onPick }: EvidenceUploadProps) {
  const [, render] = useState(0);
  const [pickerFocused, setPickerFocused] = useState(false);
  useEffect(() => queue.subscribe(() => render((value) => value + 1)), [queue]);
  useEffect(() => () => queue.clearEphemeralReferences('unmount'), [queue]);
  const context = { requestId, expectedVersion, ...(accessToken ? { accessToken } : {}) };

  return (
    <View accessibilityLabel="Evidencias de la solicitud" style={styles.container}>
      <Pressable
        accessibilityLabel="Seleccionar documento"
        accessibilityRole="button"
        onBlur={() => setPickerFocused(false)}
        onFocus={() => setPickerFocused(true)}
        onPress={() => { void onPick().then((picked) => { if (picked) queue.add(picked); }); }}
        style={[styles.pickButton, pickerFocused && styles.focused]}
      >
        <Text style={styles.pickLabel}>Seleccionar documento</Text>
      </Pressable>
      {queue.items.map((item) => (
        <View key={item.id} style={styles.item}>
          <View style={styles.itemCopy}>
            <Text style={styles.itemTitle}>{item.safeLabel}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.itemStatus}>
              {item.status === 'uploading' ? `Cargando ${item.progress}%` : item.status === 'scanning' ? 'Procesando de forma segura' : item.status === 'clean' ? 'Documento listo' : item.status === 'failed' ? 'No se pudo cargar' : item.status === 'cancelled' ? 'Carga cancelada' : 'Listo para cargar'}
            </Text>
          </View>
          {item.status === 'selected' ? <Pressable accessibilityRole="button" onPress={() => { void queue.upload(item.id, context); }}><Text style={styles.action}>Cargar</Text></Pressable> : null}
          {item.status === 'uploading' ? <Pressable accessibilityRole="button" onPress={() => queue.cancel(item.id)}><Text style={styles.action}>Cancelar</Text></Pressable> : null}
          {item.status === 'failed' ? <Pressable accessibilityRole="button" onPress={() => { void queue.retry(item.id, context); }}><Text style={styles.action}>Reintentar</Text></Pressable> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: authTokens.spacing.sm },
  pickButton: { alignItems: 'center', borderColor: authTokens.colors.border, borderRadius: authTokens.radius.sm, borderWidth: 1, justifyContent: 'center', minHeight: authTokens.sizing.minInteractiveSize, padding: authTokens.spacing.sm },
  focused: { borderColor: authTokens.colors.focusRing, borderWidth: authTokens.focus.borderWidth },
  pickLabel: { color: authTokens.colors.textPrimary, fontWeight: '700' },
  item: { alignItems: 'center', backgroundColor: 'rgba(12, 47, 34, 0.32)', borderColor: authTokens.colors.borderSubtle, borderRadius: authTokens.radius.sm, borderWidth: 1, flexDirection: 'row', gap: authTokens.spacing.sm, minHeight: 64, padding: authTokens.spacing.sm },
  itemCopy: { flex: 1 },
  itemTitle: { color: authTokens.colors.textPrimary, fontWeight: '700' },
  itemStatus: { color: authTokens.colors.textSecondary, ...authTokens.typography.caption },
  action: { color: authTokens.colors.primary, fontWeight: '800', padding: authTokens.spacing.xs },
});
