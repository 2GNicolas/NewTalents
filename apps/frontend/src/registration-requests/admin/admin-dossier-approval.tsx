import { useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { LiquidGlassPanel } from "../../design/components/liquid-glass-panel";
import { authTokens } from "../../design/tokens";
import { administratorRouteBackgroundStyle } from "../../administrator/shell/administrator-shell";
import { Brand } from "../components/registration-journey";

export type ApprovalViewState =
  "ready" | "pending-deletion" | "recovery-required" | "approved";
export function AdminDossierApproval({
  evidenceCategories,
  state,
  onBack,
  onApprove,
  onRetryDeletion,
  onOpenCustody,
  busy = false,
  error,
  previewMode,
}: Readonly<{
  evidenceCategories: readonly string[];
  state: ApprovalViewState;
  onBack: () => void;
  onApprove: (
    value: Readonly<{
      dossierName: string;
      declarationVersion: string;
      categories: readonly string[];
    }>,
  ) => void;
  onRetryDeletion: () => void;
  onOpenCustody?: () => void;
  busy?: boolean;
  error?: string;
  previewMode?: "desktop" | "mobile";
}>) {
  const desktop = previewMode
    ? previewMode === "desktop"
    : useWindowDimensions().width >= authTokens.breakpoints.desktop;
  const [dossierName, setDossierName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const pending = state === "pending-deletion";
  const recovery = state === "recovery-required";
  const valid =
    dossierName.trim().length > 0 && dossierName.trim().length <= 180 && confirmed && evidenceCategories.length > 0;
  return (
    <ImageBackground
      source={require("../../../assets/authentication/liquid-emerald-abstract-v1.png")}
      style={[styles.background, administratorRouteBackgroundStyle]}
    >
      <View style={styles.scrim} />
      <ScrollView
        contentContainerStyle={[
          styles.page,
          previewMode === "mobile" && styles.mobile,
        ]}
      >
        <View style={styles.top}>
          <Brand dense />
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={styles.touch}
          >
            <Text style={styles.link}>← Volver a la revisión</Text>
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Expediente y aprobación
        </Text>
        <Text style={styles.subtitle}>
          La respuesta final solo se envía después de verificar la eliminación
          de todas las evidencias.
        </Text>
        <View style={[styles.columns, desktop && styles.desktopColumns]}>
          <LiquidGlassPanel style={styles.card}>
            <Text style={styles.cardTitle}>Resultado revisado</Text>
            <Text style={styles.body}>
              La solicitud y sus consentimientos fueron revisados. No se crearán
              resultados antes de completar el borrado.
            </Text>
            <Text style={styles.success}>✓ Lista para expediente manual</Text>
          </LiquidGlassPanel>
          <LiquidGlassPanel style={styles.card}>
            <Text style={styles.cardTitle}>Expediente manual</Text>
            <Text style={styles.label}>Nombre del expediente manual</Text>
            <TextInput
              accessibilityLabel="Nombre del expediente manual"
              maxLength={180}
              value={dossierName}
              onChangeText={setDossierName}
              placeholder="Ej. EXP-006-2026"
              placeholderTextColor="#789086"
              style={styles.input}
            />
            <Text style={styles.body}>
              Categorías transferidas: {evidenceCategories.join(", ")}
            </Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Confirmo la transferencia manual de las categorías indicadas"
              accessibilityState={{ checked: confirmed }}
              onPress={() => setConfirmed((value) => !value)}
              style={styles.check}
            >
              <Text style={styles.checkBox}>{confirmed ? "✓" : ""}</Text>
              <Text style={styles.body}>
                Confirmo la transferencia manual y la creación del expediente
                fuera del almacenamiento temporal.
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: !valid || busy || state !== "ready",
              }}
              disabled={!valid || busy || state !== "ready"}
              onPress={() =>
                onApprove({
                  dossierName: dossierName.trim(),
                  declarationVersion: "dossier-v1",
                  categories: evidenceCategories,
                })
              }
              style={[
                styles.primary,
                (!valid || busy || state !== "ready") && styles.disabled,
              ]}
            >
              <Text style={styles.primaryText}>
                Confirmar expediente y continuar
              </Text>
            </Pressable>
          </LiquidGlassPanel>
        </View>
        {pending ? (
          <LiquidGlassPanel style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>Eliminación segura en curso</Text>
            <Text style={styles.body}>
              La respuesta permanece en espera hasta verificar la ausencia de
              todos los archivos.
            </Text>
          </LiquidGlassPanel>
        ) : null}
        {recovery ? (
          <LiquidGlassPanel style={styles.recovery}>
            <Text style={styles.recoveryTitle}>
              La eliminación requiere recuperación
            </Text>
            <Text style={styles.body}>
              No se envió la respuesta y no se materializó el resultado. Un
              Administrador puede iniciar un nuevo ciclo controlado.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onRetryDeletion}
              style={styles.retry}
            >
              <Text style={styles.retryText}>
                Reintentar eliminación segura
              </Text>
            </Pressable>
          </LiquidGlassPanel>
        ) : null}
        {state === "approved" ? (
          <LiquidGlassPanel style={styles.approved}>
            <Text style={styles.cardTitle}>Respuesta enviada</Text>
            <Text style={styles.body}>
              La aprobación terminó después de verificar la eliminación de
              evidencias.
            </Text>
            {onOpenCustody ? (
              <Pressable
                accessibilityRole="link"
                onPress={onOpenCustody}
                style={styles.retry}
              >
                <Text style={styles.retryText}>
                  Abrir pasaporte en Custodia
                </Text>
              </Pressable>
            ) : null}
          </LiquidGlassPanel>
        ) : null}
        {error ? (
          <Text accessibilityLiveRegion="assertive" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <View style={styles.timeline}>
          <Text style={styles.cardTitle}>Historial operativo</Text>
          <Step label="Información revisada" status="done" />
          <Step
            label="Expediente manual creado"
            status={state === "ready" ? "current" : "done"}
          />
          <Step
            label="Resultado revisado"
            status={state === "ready" ? "pending" : "done"}
          />
          <Step
            label="Eliminación segura de evidencias"
            status={
              recovery
                ? "error"
                : pending
                  ? "current"
                  : state === "approved"
                    ? "done"
                    : "pending"
            }
          />
          <Step
            label="Respuesta enviada"
            status={state === "approved" ? "done" : "pending"}
          />
        </View>
      </ScrollView>
    </ImageBackground>
  );
}
function Step({
  label,
  status,
}: Readonly<{
  label: string;
  status: "done" | "current" | "pending" | "error";
}>) {
  const text =
    status === "done"
      ? "Completado"
      : status === "current"
        ? "En curso"
        : status === "error"
          ? "Error"
          : "Pendiente";
  return (
    <View style={styles.step}>
      <Text style={[styles.marker, status === "error" && styles.errorMarker]}>
        {status === "done" ? "✓" : status === "error" ? "!" : "•"}
      </Text>
      <View>
        <Text style={styles.stepLabel}>{label}</Text>
        <Text style={styles.stepStatus}>{text}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  background: administratorRouteBackgroundStyle,
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,12,8,.5)" },
  page: {
    alignSelf: "center",
    gap: 18,
    maxWidth: 1180,
    padding: 28,
    width: "100%",
  },
  mobile: { maxWidth: 430 },
  top: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  touch: { justifyContent: "center", minHeight: 48 },
  link: { color: "#c7ff2e", fontWeight: "800" },
  title: { color: "#f5f7ef", fontSize: 40, fontWeight: "900" },
  subtitle: { color: "#c7d3cc", fontSize: 16, lineHeight: 24 },
  columns: { gap: 18 },
  desktopColumns: { flexDirection: "row" },
  card: { flex: 1, gap: 14, padding: 20 },
  cardTitle: { color: "#f5f7ef", fontSize: 21, fontWeight: "900" },
  body: { color: "#b9cac0", fontSize: 14, lineHeight: 21 },
  success: { color: "#c7ff2e", fontWeight: "900" },
  label: { color: "#dbe7df", fontWeight: "800" },
  input: {
    backgroundColor: "rgba(2,18,12,.72)",
    borderColor: "rgba(210,255,226,.3)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#fff",
    minHeight: 50,
    padding: 13,
  },
  check: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 48 },
  checkBox: {
    borderColor: "#75e7a7",
    borderRadius: 4,
    borderWidth: 1,
    color: "#c7ff2e",
    height: 24,
    textAlign: "center",
    width: 24,
  },
  primary: {
    alignItems: "center",
    backgroundColor: "#c7ff2e",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 54,
  },
  primaryText: { color: "#06150f", fontWeight: "900" },
  disabled: { opacity: 0.45 },
  pendingCard: { borderColor: "#e6c86f", gap: 10, padding: 20 },
  pendingTitle: { color: "#ffe59a", fontSize: 19, fontWeight: "900" },
  recovery: { borderColor: "#ff717d", gap: 12, padding: 20 },
  recoveryTitle: { color: "#ffadb4", fontSize: 19, fontWeight: "900" },
  retry: {
    alignItems: "center",
    borderColor: "#ff8992",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
  },
  retryText: { color: "#ffbec3", fontWeight: "900" },
  approved: { borderColor: "#75e7a7", gap: 10, padding: 20 },
  timeline: {
    borderTopColor: "rgba(210,255,226,.2)",
    borderTopWidth: 1,
    gap: 14,
    paddingTop: 22,
  },
  step: { alignItems: "center", flexDirection: "row", gap: 13 },
  marker: {
    color: "#c7ff2e",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    width: 24,
  },
  errorMarker: { color: "#ff717d" },
  stepLabel: { color: "#f5f7ef", fontWeight: "800" },
  stepStatus: { color: "#9fb2a6", fontSize: 12 },
  error: { color: "#ffb0b6", fontWeight: "800" },
});
