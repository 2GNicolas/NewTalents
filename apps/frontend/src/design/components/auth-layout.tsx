import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authTokens } from '../tokens';

const fullViewportHeight: DimensionValue = Platform.OS === 'web'
  ? ('100dvh' as unknown as DimensionValue)
  : '100%';

type AuthLayoutProps = {
  children: ReactNode;
  background?: ReactNode;
  fixedAction?: ReactNode;
  visual?: ReactNode;
  footer?: ReactNode;
  formHeader?: ReactNode;
  /** Allows deterministic viewport coverage in component tests; omitted in the application. */
  viewportWidth?: number;
  viewportHeight?: number;
};

/** Full-viewport authentication split; no floating card or external canvas is rendered. */
export function AuthLayout({ children, background, fixedAction, visual, footer, formHeader, viewportWidth, viewportHeight }: AuthLayoutProps) {
  const { width, height } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= authTokens.breakpoints.desktop;
  const compactHeight = (viewportHeight ?? height) < 680;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>
        <View style={styles.viewport}>
          {background ? <View pointerEvents="none" style={styles.backgroundLayer} testID="auth-background-layer">{background}</View> : null}
          <View style={[styles.page, desktop && styles.pageDesktop]} testID={desktop ? 'auth-layout-desktop' : 'auth-layout-mobile'}>
            {desktop && visual ? <View style={styles.visualColumn} testID="auth-visual-region">{visual}</View> : null}
            {!desktop && visual ? <View style={styles.mobileVisualColumn} testID="auth-mobile-visual-region">{visual}</View> : null}
            <View style={[styles.contentColumn, desktop && styles.contentColumnDesktop, desktop && webPanelDiffusion]} testID="auth-form-region">
            {formHeader ? <View style={styles.formHeader} testID="auth-form-header">{formHeader}</View> : null}
            <ScrollView
              contentContainerStyle={[styles.scrollContent, compactHeight && styles.scrollContentCompact, !desktop && fixedAction ? styles.scrollContentWithFixedAction : undefined]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              testID="auth-form-scroll"
            >
              <View style={styles.content}>{children}{footer}</View>
              {desktop && fixedAction ? <View style={styles.desktopActionFlow}>{fixedAction}</View> : null}
            </ScrollView>
            {!desktop && fixedAction ? <View style={styles.fixedAction}>{fixedAction}</View> : null}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#06120C', flex: 1 },
  keyboardAvoiding: { flex: 1 },
  viewport: { flex: 1, minHeight: fullViewportHeight, overflow: 'hidden', position: 'relative', width: '100%' },
  backgroundLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  page: { backgroundColor: 'transparent', flex: 1, minHeight: fullViewportHeight, overflow: 'hidden', width: '100%' },
  pageDesktop: { flexDirection: 'row' },
  contentColumn: { backgroundColor: 'rgba(4, 8, 6, 0.80)', flex: 1, minHeight: authTokens.sizing.loadingBlockHeight },
  contentColumnDesktop: { borderLeftColor: 'rgba(255, 255, 255, 0.06)', borderLeftWidth: 1, flexBasis: '40%', flexGrow: 0, minWidth: 0 },
  formHeader: { left: authTokens.spacing.xl, position: 'absolute', top: authTokens.spacing.lg, zIndex: 10 },
  visualColumn: { flexBasis: '60%', flexGrow: 0, minWidth: 0 },
  mobileVisualColumn: { flexGrow: 0, height: 310, minHeight: 270 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: authTokens.spacing.xl, paddingVertical: authTokens.spacing.xxl },
  scrollContentCompact: { justifyContent: 'flex-start', paddingVertical: authTokens.spacing.lg },
  scrollContentWithFixedAction: { paddingBottom: 112 },
  content: { alignSelf: 'center', maxWidth: 500, width: '100%' },
  desktopActionFlow: { alignSelf: 'center', marginTop: authTokens.spacing.md, maxWidth: authTokens.sizing.contentMaxWidth, width: '100%' },
  fixedAction: { backgroundColor: 'rgba(4, 8, 6, 0.88)', borderTopColor: 'rgba(255, 255, 255, 0.08)', borderTopWidth: 1, bottom: 0, left: 0, padding: authTokens.spacing.md, position: 'absolute', right: 0 },
});

const webPanelDiffusion = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(24px) saturate(130%)', WebkitBackdropFilter: 'blur(24px) saturate(130%)' } as unknown as ViewStyle)
  : {};
