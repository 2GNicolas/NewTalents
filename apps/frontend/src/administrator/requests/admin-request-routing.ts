import type { OperationalRequest } from '../administrator-api';

export function existingFeature006ReviewRoute(request: Pick<OperationalRequest, 'requestId'>, previewMode?: 'desktop' | 'mobile') {
  return Object.freeze({
    pathname: '/(admin)/admin/registration/[requestId]' as const,
    params: Object.freeze({ requestId: request.requestId, ...(previewMode ? { preview: previewMode } : {}) }),
  });
}
