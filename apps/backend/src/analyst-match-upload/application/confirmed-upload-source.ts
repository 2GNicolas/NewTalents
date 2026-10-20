import type { AuthorizedUploadMatch } from './analyst-match-upload-access.js';

export type UploadEligibility = Readonly<{
  sourceKind: string;
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  expectedVersion?: number;
}>;

/** A future source needs its own authoritative match identity and confirmation port. */
export interface UploadSource {
  readonly kind: string;
  eligibility(match: AuthorizedUploadMatch): UploadEligibility | null;
}

export class Feature009UploadSource implements UploadSource {
  readonly kind = 'FIRST_MATCH';

  eligibility(match: AuthorizedUploadMatch): UploadEligibility | null {
    if (match.sourceKind !== this.kind || !['WAITING', 'LOADED'].includes(match.state)) return null;
    if (match.state === 'WAITING' && match.unitState === 'RESERVED') {
      return { sourceKind: this.kind, availability: 'AVAILABLE', expectedVersion: match.version };
    }
    return { sourceKind: this.kind, availability: 'UNAVAILABLE' };
  }
}

/** Intentionally registers only the existing Feature 009 source. */
export class ConfirmedUploadSources {
  private readonly sources: ReadonlyMap<string, UploadSource> = new Map([
    ['FIRST_MATCH', new Feature009UploadSource()],
  ]);

  get registeredKinds(): readonly string[] { return [...this.sources.keys()]; }

  resolve(kind: string): UploadSource | undefined { return this.sources.get(kind); }

  forMatch(match: AuthorizedUploadMatch): UploadEligibility | null {
    return this.resolve(match.sourceKind)?.eligibility(match) ?? null;
  }
}
