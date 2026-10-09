import { createElement, type PropsWithChildren, useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CustodyPassportSummary, EligibleAnalystSummary } from '../administrator-api';

type WebDragEvent = Readonly<{ preventDefault?: () => void; nativeEvent?: Readonly<{ preventDefault?: () => void }> }>;
type WebDragPreview = Readonly<{ style: Record<string, string>; remove: () => void }>;
type WebDragPreviewSource = Readonly<{
  cloneNode: (deep: boolean) => WebDragPreview;
  getBoundingClientRect: () => Readonly<{ left: number; top: number; width: number; height: number }>;
  ownerDocument?: Readonly<{ createElement: (tagName: string) => WebDragPreview }>;
}>;
type WebDragTransfer = Readonly<{ setDragImage?: (image: WebDragPreview, offsetX: number, offsetY: number) => void }>;
type WebDragPreviewHost = Readonly<{ appendChild: (preview: WebDragPreview) => void }>;
type WebPointerEvent = Readonly<{ clientX?: number; clientY?: number; nativeEvent?: Readonly<{ clientX?: number; clientY?: number }> }>;
type WebDragStartEvent = WebPointerEvent & Readonly<{ currentTarget?: WebDragPreviewSource; dataTransfer?: WebDragTransfer; nativeEvent?: Readonly<{ currentTarget?: WebDragPreviewSource; dataTransfer?: WebDragTransfer; clientX?: number; clientY?: number }> }>;
type InstalledCustodyDragPreview = Readonly<{ move: (x: number, y: number) => void; remove: () => void }>;

function moveDragPreview(preview: WebDragPreview, x: number, y: number, grabOffset: Readonly<{ x: number; y: number }>) {
  Object.assign(preview.style, {
    left: `${Math.round(x - grabOffset.x)}px`,
    top: `${Math.round(y - grabOffset.y)}px`,
  });
}

export function installCustodyDragPreview(source: WebDragPreviewSource, transfer: WebDragTransfer, host: WebDragPreviewHost, pointer: Readonly<{ x: number; y: number }>): InstalledCustodyDragPreview {
  const preview = source.cloneNode(true);
  const bounds = source.getBoundingClientRect();
  const grabOffset = {
    x: Math.max(0, Math.min(bounds.width, pointer.x - bounds.left)),
    y: Math.max(0, Math.min(bounds.height, pointer.y - bounds.top)),
  };
  Object.assign(preview.style, {
    backgroundColor: '#06261a',
    border: '1px solid rgba(138,255,156,.9)',
    borderRadius: '10px',
    boxShadow: '0 18px 44px rgba(0,0,0,.55)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    maxWidth: 'min(86vw, 340px)',
    opacity: '1',
    pointerEvents: 'none',
    position: 'fixed',
    width: `${Math.round(bounds.width)}px`,
    zIndex: '2147483647',
  });
  moveDragPreview(preview, pointer.x, pointer.y, grabOffset);
  host.appendChild(preview);

  const transparentImage = source.ownerDocument?.createElement('div');
  if (transparentImage) {
    Object.assign(transparentImage.style, {
      height: '1px',
      left: '-10000px',
      opacity: '0',
      pointerEvents: 'none',
      position: 'fixed',
      top: '-10000px',
      width: '1px',
    });
    host.appendChild(transparentImage);
    transfer.setDragImage?.(transparentImage, 0, 0);
  } else {
    transfer.setDragImage?.(preview, 0, 0);
  }

  return {
    move: (x, y) => moveDragPreview(preview, x, y, grabOffset),
    remove: () => { preview.remove(); transparentImage?.remove(); },
  };
}

export function DraggableCustodyPassport({ passport, onDragStart, onDragEnd, children }: PropsWithChildren<Readonly<{
  passport: CustodyPassportSummary;
  onDragStart: (passportId: string) => void;
  onDragEnd?: () => void;
}>>) {
  const previewRef = useRef<InstalledCustodyDragPreview | null>(null);
  const clearPreview = useCallback(() => { previewRef.current?.remove(); previewRef.current = null; }, []);
  useEffect(() => clearPreview, [clearPreview]);
  if (Platform.OS === 'web') return createElement('div', {
    'aria-label': `Pasaporte arrastrable de ${passport.displayLabel}`,
    'data-testid': `drag-passport-${passport.passportId}`,
    draggable: true,
    onDragStart: (event: WebDragStartEvent) => {
      clearPreview();
      const source = event.currentTarget ?? event.nativeEvent?.currentTarget;
      const transfer = event.dataTransfer ?? event.nativeEvent?.dataTransfer;
      const x = event.clientX ?? event.nativeEvent?.clientX ?? 0;
      const y = event.clientY ?? event.nativeEvent?.clientY ?? 0;
      if (source && transfer && typeof document !== 'undefined') previewRef.current = installCustodyDragPreview(source, transfer, document.body as unknown as WebDragPreviewHost, { x, y });
      onDragStart(passport.passportId);
    },
    onDrag: (event: WebPointerEvent) => {
      const x = event.clientX ?? event.nativeEvent?.clientX ?? 0;
      const y = event.clientY ?? event.nativeEvent?.clientY ?? 0;
      if (x > 0 || y > 0) previewRef.current?.move(x, y);
    },
    onDragEnd: () => { clearPreview(); onDragEnd?.(); },
    style: { cursor: 'grab' },
  }, children);
  return <View
    testID={`drag-passport-${passport.passportId}`}
    accessibilityLabel={`Pasaporte arrastrable de ${passport.displayLabel}`}
    onTouchStart={() => onDragStart(passport.passportId)}
    {...({ onDragStart: () => onDragStart(passport.passportId), onDragEnd } as object)}
  >{children}</View>;
}

export function CustodyAnalystDropZone({ analyst, active, reducedMotion = false, onDrop, onSelect }: Readonly<{
  analyst: EligibleAnalystSummary;
  active: boolean;
  reducedMotion?: boolean;
  onDrop: () => void;
  onSelect: () => void;
}>) {
  const prevent = (event: WebDragEvent) => { event.preventDefault?.(); event.nativeEvent?.preventDefault?.(); };
  const copy = active ? `Soltar para seleccionar a ${analyst.displayLabel}` : 'Arrastra aquí un pasaporte sin Analista';
  if (Platform.OS === 'web') return createElement('div', {
    'aria-disabled': !active,
    'aria-label': `Seleccionar ${analyst.displayLabel} como destino`,
    'data-testid': `drop-analyst-${analyst.identityId}`,
    onClick: () => { if (active) onSelect(); },
    onDragEnter: prevent,
    onDragOver: prevent,
    onDrop: (event: WebDragEvent) => { prevent(event); if (active) onDrop(); },
    onKeyDown: (event: Readonly<{ key: string; preventDefault: () => void }>) => { if (active && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(); } },
    role: 'button',
    style: StyleSheet.flatten([styles.zone, active && styles.activeZone]),
    tabIndex: active ? 0 : -1,
    title: reducedMotion ? 'La selección cambia de forma instantánea, sin animación.' : 'También admite soltar un pasaporte aquí.',
  }, createElement('span', { 'aria-hidden': true, style: StyleSheet.flatten(styles.icon) }, '↓'), createElement('span', { style: StyleSheet.flatten([styles.copy, active && styles.activeCopy]) }, copy));
  return <Pressable
    testID={`drop-analyst-${analyst.identityId}`}
    accessibilityRole="button"
    accessibilityLabel={`Seleccionar ${analyst.displayLabel} como destino`}
    accessibilityHint={reducedMotion ? 'La selección cambia de forma instantánea, sin animación.' : 'También admite soltar un pasaporte aquí.'}
    accessibilityState={{ disabled: !active }}
    disabled={!active}
    onPress={onSelect}
    style={[styles.zone, active && styles.activeZone]}
  ><Text style={styles.icon} accessibilityElementsHidden>↓</Text><Text style={[styles.copy, active && styles.activeCopy]}>{copy}</Text></Pressable>;
}

const styles = StyleSheet.create({
  zone: { alignItems: 'center', borderColor: 'rgba(198,255,218,.36)', borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, gap: 5, justifyContent: 'center', minHeight: 92, padding: 10 },
  activeZone: { borderColor: '#d6ff19', borderWidth: 2 },
  icon: { color: '#9fc7b2', fontSize: 22, fontWeight: '900' },
  copy: { color: '#c4d2c9', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  activeCopy: { color: '#efffc0', fontWeight: '800' },
});
