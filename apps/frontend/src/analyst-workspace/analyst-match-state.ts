import { AnalystPassportStateMachine } from './analyst-passport-state';
import type { AnalystWorkspaceApi } from './analyst-workspace-api';

export function matchListState(api: AnalystWorkspaceApi) { return new AnalystPassportStateMachine(() => api.matches(), api.onAccessLost); }
export function matchDetailState(api: AnalystWorkspaceApi, matchId: string) {
  return new AnalystPassportStateMachine(() => api.match(matchId), api.onAccessLost);
}
