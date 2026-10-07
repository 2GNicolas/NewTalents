import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { LiquidGlassPanel } from "../../design/components/liquid-glass-panel";
import { authTokens } from "../../design/tokens";
import type { DossierDetail, DossierSafeLink } from "../administrator-api";
import type { DossierViewState } from "./admin-dossiers-state";

export function AdminDossierDetail({
  state,
  detail,
  onBack,
  onRetry,
  onOpenRequest,
  onOpenPassport,
  previewMode,
}: Readonly<{
  state: DossierViewState;
  detail?: DossierDetail;
  onBack: () => void;
  onRetry: () => void;
  onOpenRequest: (id: string) => void;
  onOpenPassport: (id: string) => void;
  previewMode?: "desktop" | "mobile";
}>) {
  const dimensions = useWindowDimensions();
  const desktop = previewMode
    ? previewMode === "desktop"
    : dimensions.width >= authTokens.breakpoints.desktop;
  const heading = useRef<Text>(null);
  useEffect(() => {
    if (state === "ready" && !previewMode)
      (heading.current as unknown as { focus?: () => void } | null)?.focus?.();
  }, [previewMode, state]);
  if (state !== "ready" || !detail)
    return (
      <DetailState
        state={state === "ready" ? "error" : state}
        onBack={onBack}
        onRetry={onRetry}
      />
    );
  return (
    <ScrollView
      accessibilityLabel="Detalle de expediente"
      contentContainerStyle={[styles.page, !desktop && styles.pageMobile]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver a expedientes"
        onPress={onBack}
        style={styles.back}
      >
        <Text style={styles.backText}>‹ Volver a expedientes</Text>
      </Pressable>
      <LiquidGlassPanel style={[styles.hero, !desktop && styles.heroMobile]}>
        <Text style={styles.folder}>□</Text>
        <View style={[styles.heroCopy, !desktop && styles.heroCopyMobile]}>
          <Text style={styles.heroLabel}>{detail.dossierName ?? 'Expediente'}</Text>
        </View>
        <View style={[styles.heroStatus, !desktop && styles.heroStatusMobile]}>
          <Text style={styles.status}>
            ✓ {detail.status === "APPROVED" ? "Aprobado" : "Confirmado"}
          </Text>
          <Text style={styles.date}>
            {new Date(detail.confirmedAt).toLocaleString("es-CO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Text>
        </View>
      </LiquidGlassPanel>
      <Text
        ref={heading}
        {...({ tabIndex: -1 } as object)}
        accessibilityRole="header"
        style={[styles.title, !desktop && styles.titleMobile]}
      >
        Detalle del expediente
      </Text>
      <Text style={styles.subtitle}>
        Consulta la información confirmada, sus vínculos y el historial.
      </Text>
      <LiquidGlassPanel style={styles.panel}>
        <Text accessibilityRole="header" style={styles.panelTitle}>
          ▱ Información confirmada
        </Text>
        <View style={[styles.infoGrid, !desktop && styles.stack]}>
          <Info label="Nombre del expediente" value={detail.dossierName ?? 'Sin nombre registrado'} />
          <Info label="Jugador" value={detail.displayLabel} />
          <Info label="Origen" value={originLabel(detail.requestType)} />
          <Info label="Estado" value={detail.status} />
        </View>
      </LiquidGlassPanel>
      <LiquidGlassPanel style={styles.panel}>
        <Text accessibilityRole="header" style={styles.panelTitle}>
          ↗ Vínculos
        </Text>
        <View style={[styles.links, !desktop && styles.stack]}>
          <SafeLink
            label="Solicitud de origen"
            link={detail.originRequest}
            onOpen={onOpenRequest}
          />
          {"notApplicable" in detail.linkedPassport ? (
            <View style={styles.link}>
              <Text style={styles.linkLabel}>Pasaporte</Text>
              <Text style={styles.notApplicable}>
                No aplica para este tipo de origen
              </Text>
            </View>
          ) : (
            <SafeLink
              label="Pasaporte"
              link={detail.linkedPassport}
              onOpen={onOpenPassport}
            />
          )}
        </View>
      </LiquidGlassPanel>
      <LiquidGlassPanel style={styles.panel}>
        <Text accessibilityRole="header" style={styles.panelTitle}>
          ◷ Historial de confirmación
        </Text>
        <View style={[styles.timeline, desktop && styles.timelineDesktop]}>
          {detail.confirmationHistory.map((entry, index) => (
            <View key={`${entry.action}-${entry.at}`} style={styles.event}>
              <Text style={styles.dot}>{index + 1}</Text>
              <View>
                <Text style={styles.eventTitle}>
                  {entry.action === "DOSSIER_CONFIRMED"
                    ? "Confirmación administrativa"
                    : entry.action === "EVIDENCE_DELETION_VERIFIED"
                      ? "Eliminación verificada"
                      : "Aprobación finalizada"}
                </Text>
                <Text style={styles.eventDate}>
                  {new Date(entry.at).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Text>
                <Text style={styles.actor}>
                  {entry.actorLabel === "ADMINISTRATOR"
                    ? "Administrador"
                    : "Sistema"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </LiquidGlassPanel>
    </ScrollView>
  );
}
function Info({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
function SafeLink({
  label,
  link,
  onOpen,
}: Readonly<{
  label: string;
  link: DossierSafeLink;
  onOpen: (id: string) => void;
}>) {
  const content = (
    <>
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkStatus}>{link.status}</Text>
    </>
  );
  return link.available ? (
    <Pressable
      accessibilityRole="button"
        accessibilityLabel={`Abrir ${label.toLocaleLowerCase("es-CO")}`}
      onPress={() => onOpen(link.id)}
      style={styles.link}
    >
      {content}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  ) : (
    <View style={styles.link}>
      {content}
      <Text style={styles.notApplicable}>Enlace no disponible</Text>
    </View>
  );
}
function DetailState({
  state,
  onBack,
  onRetry,
}: Readonly<{
  state: DossierViewState;
  onBack: () => void;
  onRetry: () => void;
}>) {
  const copy =
    state === "loading"
      ? "Cargando expediente…"
      : state === "restricted"
        ? "No tienes acceso a este expediente."
        : state === "missing"
          ? "No encontramos este expediente."
          : state === "unavailable"
            ? "El expediente no está disponible en este momento."
            : "No pudimos cargar el expediente.";
  return (
    <View style={styles.state}>
      <LiquidGlassPanel style={styles.statePanel}>
        <Text accessibilityRole="alert" style={styles.stateText}>
          {copy}
        </Text>
        {state === "unavailable" || state === "error" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
            onPress={onRetry}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a expedientes"
          onPress={onBack}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Volver</Text>
        </Pressable>
      </LiquidGlassPanel>
    </View>
  );
}
const originLabel = (value: DossierDetail["requestType"]) =>
  ({
    PERSONAL_ADULT: "Jugador adulto particular",
    REPRESENTED_MINOR: "Jugador menor representado",
    FORMAL_ACADEMY: "Academia formal",
    NATURAL_PERSON_ACADEMY: "Academia persona natural",
    ADDITIONAL_ACADEMY_ACCOUNT: "Cuenta adicional de academia",
    ACADEMY_ADULT_PLAYER: "Jugador adulto de academia",
    ACADEMY_MINOR_PLAYER: "Jugador menor de academia",
  })[value];
const styles = StyleSheet.create({
  page: {
    alignSelf: "center",
    gap: 12,
    maxWidth: 1120,
    padding: 24,
    paddingBottom: 50,
    width: "100%",
  },
  pageMobile: { padding: 14, paddingBottom: 28 },
  back: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
  backText: { color: "#f1f5ef", textDecorationLine: "underline" },
  hero: { alignItems: "center", flexDirection: "row", gap: 14, padding: 14 },
  heroMobile: { alignItems: "flex-start", flexWrap: "wrap" },
  folder: {
    borderColor: "#dbefe2",
    borderRadius: 25,
    borderWidth: 1,
    color: "#f7f8f2",
    fontSize: 29,
    padding: 7,
  },
  heroCopy: { flex: 1 },
  heroCopyMobile: { minWidth: 240 },
  heroLabel: { color: "#f7f8f2", fontSize: 22, fontWeight: "900" },
  reference: { color: "#b9c9bf", fontSize: 11, marginTop: 3 },
  heroStatus: { minWidth: 190 },
  heroStatusMobile: { marginLeft: 62, minWidth: 0, width: "100%" },
  status: { color: "#d6ff19", fontSize: 18, fontWeight: "900" },
  date: { color: "#d9e4dd", fontSize: 12, marginTop: 3 },
  title: { color: "#f7f8f2", fontSize: 38, fontWeight: "900", marginTop: 2 },
  titleMobile: { fontSize: 28 },
  subtitle: { color: "#c3d0c8", marginTop: -10 },
  panel: { gap: 12, padding: 16 },
  panelTitle: { color: "#f7f8f2", fontSize: 20, fontWeight: "900" },
  infoGrid: { flexDirection: "row", gap: 12 },
  stack: { flexDirection: "column" },
  info: {
    borderRightColor: "rgba(225,255,235,.3)",
    borderRightWidth: 1,
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 10,
  },
  infoLabel: { color: "#a8baaf", fontSize: 11 },
  infoValue: { color: "#eef4ef", fontWeight: "700", marginTop: 6 },
  links: { flexDirection: "row", gap: 12 },
  link: {
    backgroundColor: "rgba(0,20,14,.42)",
    borderColor: "rgba(125,255,170,.28)",
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    minHeight: 80,
    padding: 12,
  },
  linkLabel: { color: "#a7baae", fontSize: 11 },
  linkName: { color: "#b9c9bf", fontSize: 11, marginTop: 4 },
  linkStatus: { color: "#d6ff19", fontSize: 11, marginTop: 4 },
  notApplicable: { color: "#cabf98", fontSize: 11, marginTop: 5 },
  chevron: {
    color: "#d6ff19",
    fontSize: 28,
    position: "absolute",
    right: 12,
    top: 24,
  },
  timeline: { gap: 12 },
  timelineDesktop: { flexDirection: "row", justifyContent: "space-around" },
  event: { flexDirection: "row", gap: 10, minWidth: 220 },
  dot: {
    borderColor: "#d6ff19",
    borderRadius: 13,
    borderWidth: 2,
    color: "#f7f8f2",
    height: 26,
    textAlign: "center",
    width: 26,
  },
  eventTitle: { color: "#f7f8f2", fontWeight: "800" },
  eventDate: { color: "#b5c5bc", fontSize: 11, marginTop: 3 },
  actor: { color: "#d6ff19", fontSize: 11, marginTop: 2 },
  state: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 520,
    padding: 20,
  },
  statePanel: {
    alignItems: "center",
    gap: 12,
    maxWidth: 500,
    padding: 28,
    width: "100%",
  },
  stateText: { color: "#eef4ef", fontSize: 17, textAlign: "center" },
  button: {
    borderColor: "#d6ff19",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  buttonText: { color: "#f7f8f2", fontWeight: "800" },
});
