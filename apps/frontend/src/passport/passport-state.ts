import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { createPassportApi, type PassportApi, type PassportListRequest } from './passport-api';
import type { CreateDraftInput, EditableDraftResponse, EditDraftInput, InternalPassportHistoryResponse, PassportAction, PassportApiResult, PassportCollectionAction, PassportHistoryResponse, PassportListContext, PassportPresentationResponse, PassportStatusResponse, ResolveDuplicateInput, ReturnInput, PassportSummaryResponse } from './passport-types';

export type PassportStateNotice = 'authentication-failed' | 'forbidden' | 'not-found-safe' | 'duplicate-passport' | 'unresolved-signal' | 'invalid-state' | 'validation' | 'unavailable-backend' | 'connectivity-failure';
export type PassportState = Readonly<{
  phase: 'idle' | 'loading' | 'ready' | 'mutation'; context: PassportListContext | null; academyId: string | null;
  list: readonly PassportSummaryResponse[] | null; collectionActions: readonly PassportCollectionAction[] | null;
  activePassportId: string | null; status: PassportStatusResponse | null; editableDraft: EditableDraftResponse | null;
  presentation: PassportPresentationResponse | null; history: PassportHistoryResponse | null; internalHistory: InternalPassportHistoryResponse | null;
  notice?: PassportStateNotice;
}>;
export const PASSPORT_NOTICE_MESSAGES: Readonly<Record<PassportStateNotice, string>> = Object.freeze({
  'authentication-failed': 'Tu sesión no está disponible. Vuelve a iniciar sesión.', forbidden: 'No tienes autorización para esta acción.', 'not-found-safe': 'El pasaporte no está disponible.', 'duplicate-passport': 'No fue posible crear el pasaporte con la información suministrada.', 'unresolved-signal': 'La presentación requiere revisión interna antes de continuar.', 'invalid-state': 'La acción no es válida en el estado actual.', validation: 'Revisa la información ingresada.', 'unavailable-backend': 'El servicio no está disponible en este momento.', 'connectivity-failure': 'No se pudo conectar con el servicio.',
});
type Dependencies = Readonly<{ api?: PassportApi; getAccessToken?: () => string | null }>;
const INITIAL_STATE: PassportState = Object.freeze({ phase: 'idle', context: null, academyId: null, list: null, collectionActions: null, activePassportId: null, status: null, editableDraft: null, presentation: null, history: null, internalHistory: null });

export class PassportStateMachine {
  private _state: PassportState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private mutationInFlight = false; private loading = false; private analystCollection = false;
  constructor(private readonly dependencies: { api: PassportApi; getAccessToken: () => string | null }) {}
  get state() { return this._state; }
  get capabilities(): readonly PassportAction[] { return this._state.status?.availableActions ?? []; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  hasCapability = (action: PassportAction) => this.capabilities.includes(action);
  hasCollectionAction = (action: PassportCollectionAction) => this._state.collectionActions?.includes(action) === true;

  loadList = async (request: PassportListRequest = { context: 'PARTICULAR' }): Promise<void> => {
    this.analystCollection = false;
    if (!this.beginLoading()) return;
    this.setState({ context: request.context, academyId: request.context === 'ACADEMY' ? request.academyId ?? null : null, list: null, collectionActions: null });
    try {
      const token = this.token(); if (!token) return;
      const result = await this.dependencies.api.list(request, token);
      if (result.kind === 'success') this.setState({ context: result.value.context, list: result.value.passports, collectionActions: result.value.collectionActions, notice: undefined });
      else this.setState({ notice: result.kind });
    } finally { this.endLoading(); }
  };
  loadAnalystPassports = async (request: Readonly<{ cursor?: string; limit?: number }> = {}): Promise<void> => {
    if (!this.beginLoading()) return;
    this.analystCollection = true;
    this.setState({ context: 'PARTICULAR', academyId: null, list: null, collectionActions: [] });
    try {
      const token = this.token(); if (!token) return;
      const result = await this.dependencies.api.listAnalystPassports(request, token);
      if (result.kind === 'success') this.setState({ list: this.mapAnalystItems(result.value.items), collectionActions: [], notice: undefined });
      else this.setState({ list: [], notice: result.kind });
    } finally { this.endLoading(); }
  };
  selectPassport = async (passportId: string): Promise<void> => {
    if (!this.beginLoading()) return;
    this.setState({ activePassportId: passportId, status: null, editableDraft: null, presentation: null, history: null, internalHistory: null, notice: undefined });
    try {
      const token = this.token(); if (!token) return;
      const [status, presentation] = await Promise.all([this.dependencies.api.status(passportId, token), this.dependencies.api.presentation(passportId, token)]);
      if (status.kind === 'success' && presentation.kind === 'success') { this.setState({ status: status.value, presentation: presentation.value }); return; }
      const failed = status.kind === 'success' ? presentation : status;
      if (failed.kind !== 'success') {
        this.setState({ ...(failed.kind === 'not-found-safe' ? { activePassportId: null, status: null, presentation: null, history: null, internalHistory: null } : {}), notice: failed.kind });
        if (failed.kind === 'not-found-safe' && this.analystCollection) await this.refreshAnalystCollection(token);
      }
    } finally { this.endLoading(); }
  };
  loadEditableDraft = async (passportId: string): Promise<void> => {
    if (!this.hasCapability('EDIT')) { this.setState({ notice: 'forbidden' }); return; }
    if (!this.beginLoading()) return;
    try { const token = this.token(); if (!token) return; const result = await this.dependencies.api.editableDraft(passportId, token); if (result.kind === 'success') this.setState({ editableDraft: result.value, notice: undefined }); else this.setState({ notice: result.kind }); }
    finally { this.endLoading(); }
  };
  loadHistory = async (passportId: string): Promise<void> => {
    if (!this.hasCapability('VIEW_HISTORY')) { this.setState({ notice: 'forbidden' }); return; }
    await this.loadHistoryResult(passportId, false);
  };
  loadInternalHistory = async (passportId: string): Promise<void> => {
    if (!this.hasCapability('VIEW_INTERNAL_HISTORY')) { this.setState({ notice: 'forbidden' }); return; }
    await this.loadHistoryResult(passportId, true);
  };
  private loadHistoryResult = async (passportId: string, internal: boolean) => {
    if (!this.beginLoading()) return;
    try { const token = this.token(); if (!token) return; const result = internal ? await this.dependencies.api.internalHistory(passportId, token) : await this.dependencies.api.history(passportId, token); if (result.kind === 'success') this.setState(internal ? { internalHistory: result.value as InternalPassportHistoryResponse, notice: undefined } : { history: result.value as PassportHistoryResponse, notice: undefined }); else { this.setState({ ...(result.kind === 'not-found-safe' ? { activePassportId: null, status: null, presentation: null, history: null, internalHistory: null } : {}), notice: result.kind }); if (result.kind === 'not-found-safe' && this.analystCollection) await this.refreshAnalystCollection(token); } }
    finally { this.endLoading(); }
  };
  clearActivePassport = () => this.setState({ phase: 'idle', activePassportId: null, status: null, editableDraft: null, presentation: null, history: null, internalHistory: null, notice: undefined });
  createDraft = async (input: CreateDraftInput): Promise<PassportApiResult<PassportStatusResponse>> => {
    const required: PassportCollectionAction = input.managementContext === 'SELF' ? 'CREATE_SELF' : input.managementContext === 'LEGAL_REPRESENTATIVE' ? 'CREATE_REPRESENTED_MINOR' : 'CREATE_ACADEMY';
    if (!this.hasCollectionAction(required)) return this.denied();
    if (!this.beginMutation()) return { kind: 'invalid-state' };
    try { const token = this.token(); if (!token) return { kind: 'authentication-failed' }; const result = await this.dependencies.api.createDraft(input, token); this.apply(result); return result; }
    finally { this.endMutation(); }
  };
  editDraft = (id: string, input: EditDraftInput) => this.mutate('EDIT', token => this.dependencies.api.editDraft(id, input, token));
  submit = (id: string) => this.mutate('SUBMIT', token => this.dependencies.api.submit(id, { expectedVersion: this._state.status?.version }, token));
  returnForCorrection = (id: string, input: ReturnInput) => this.mutate('RETURN', token => this.dependencies.api.returnForCorrection(id, { ...input, expectedVersion: input.expectedVersion ?? this._state.status?.version }, token));
  resolveDuplicate = (id: string, input: ResolveDuplicateInput) => this.mutate('RESOLVE_DUPLICATE', token => this.dependencies.api.resolveDuplicate(id, { ...input, expectedVersion: input.expectedVersion ?? this._state.status?.version }, token));
  approve = (id: string) => this.mutate('APPROVE', token => this.dependencies.api.approve(id, { expectedVersion: this._state.status?.version }, token));
  activate = (id: string) => this.mutate('ACTIVATE', token => this.dependencies.api.activate(id, { expectedVersion: this._state.status?.version }, token));
  dispose = () => { this.mutationInFlight = false; this.loading = false; this.analystCollection = false; this.listeners.clear(); this._state = INITIAL_STATE; };
  private mapAnalystItems(items: readonly import('./passport-types').AnalystPassportSummary[]): readonly PassportSummaryResponse[] { return items.map((item) => ({ passportId: item.passportId, displayName: item.displayLabel, lifecycleState: item.lifecycleState, origin: item.academyLabel ? 'ACADEMY' : 'PARTICULAR', academyOriginName: item.academyLabel ?? null, availableActions: ['VIEW', 'VIEW_INTERNAL_HISTORY'] })); }
  private async refreshAnalystCollection(token: string) { const result = await this.dependencies.api.listAnalystPassports({}, token); if (result.kind === 'success') this.setState({ list: this.mapAnalystItems(result.value.items), collectionActions: [] }); }
  private async mutate(action: PassportAction, operation: (token: string) => Promise<PassportApiResult<PassportStatusResponse>>) { if (!this.hasCapability(action)) return this.denied(); if (!this.beginMutation()) return { kind: 'invalid-state' } as const; try { const token = this.token(); if (!token) return { kind: 'authentication-failed' } as const; const result = await operation(token); this.apply(result); return result; } finally { this.endMutation(); } }
  private token() { const token = this.dependencies.getAccessToken(); if (!token) this.setState({ notice: 'authentication-failed' }); return token; }
  private denied(): PassportApiResult<PassportStatusResponse> { this.setState({ notice: 'forbidden' }); return { kind: 'forbidden' }; }
  private apply(result: PassportApiResult<PassportStatusResponse>) { if (result.kind === 'success') this.setState({ status: result.value, activePassportId: result.value.passportId, editableDraft: null, notice: undefined }); else this.setState({ notice: result.kind }); }
  private beginLoading() { if (this.loading || this.mutationInFlight) return false; this.loading = true; this.setState({ phase: 'loading', notice: undefined }); return true; }
  private endLoading() { this.loading = false; this.setState({ phase: 'ready' }); }
  private beginMutation() { if (this.mutationInFlight) return false; this.mutationInFlight = true; this.setState({ phase: 'mutation', notice: undefined }); return true; }
  private endMutation() { this.mutationInFlight = false; this.setState({ phase: 'ready' }); }
  private setState(patch: Partial<PassportState>) { this._state = Object.freeze({ ...this._state, ...patch }); this.listeners.forEach(listener => listener()); }
}

export type PassportStateValue = Readonly<{ state: PassportState; loadList: PassportStateMachine['loadList']; loadAnalystPassports: PassportStateMachine['loadAnalystPassports']; selectPassport: PassportStateMachine['selectPassport']; loadEditableDraft: PassportStateMachine['loadEditableDraft']; loadHistory: PassportStateMachine['loadHistory']; loadInternalHistory: PassportStateMachine['loadInternalHistory']; clearActivePassport: PassportStateMachine['clearActivePassport']; createDraft: PassportStateMachine['createDraft']; editDraft: PassportStateMachine['editDraft']; submit: PassportStateMachine['submit']; returnForCorrection: PassportStateMachine['returnForCorrection']; resolveDuplicate: PassportStateMachine['resolveDuplicate']; approve: PassportStateMachine['approve']; activate: PassportStateMachine['activate']; hasCapability: PassportStateMachine['hasCapability']; hasCollectionAction: PassportStateMachine['hasCollectionAction'] }>;
const Context = createContext<PassportStateValue | null>(null);
function value(machine: PassportStateMachine, state: PassportState): PassportStateValue { return Object.freeze({ state, loadList: machine.loadList, loadAnalystPassports: machine.loadAnalystPassports, selectPassport: machine.selectPassport, loadEditableDraft: machine.loadEditableDraft, loadHistory: machine.loadHistory, loadInternalHistory: machine.loadInternalHistory, clearActivePassport: machine.clearActivePassport, createDraft: machine.createDraft, editDraft: machine.editDraft, submit: machine.submit, returnForCorrection: machine.returnForCorrection, resolveDuplicate: machine.resolveDuplicate, approve: machine.approve, activate: machine.activate, hasCapability: machine.hasCapability, hasCollectionAction: machine.hasCollectionAction }); }
export function PassportStateProvider({ children, dependencies }: PropsWithChildren<{ dependencies?: Dependencies }>) { const ref = useRef<PassportStateMachine | null>(null); if (!ref.current) ref.current = new PassportStateMachine({ api: dependencies?.api ?? createPassportApi(), getAccessToken: dependencies?.getAccessToken ?? (() => null) }); const [state, setState] = useState(ref.current.state); useEffect(() => ref.current?.subscribe(() => setState(ref.current!.state)), []); const context = useMemo(() => value(ref.current!, state), [state]); return createElement(Context.Provider, { value: context }, children); }
export function usePassportState() { const context = useContext(Context); if (!context) throw new Error('usePassportState must be used within PassportStateProvider'); return context; }
