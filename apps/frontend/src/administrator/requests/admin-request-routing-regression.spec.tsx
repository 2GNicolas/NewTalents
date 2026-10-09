import { createAdministratorApi, OPERATIONAL_GROUPS, type OperationalRequest } from '../administrator-api';
import { existingFeature006ReviewRoute } from './admin-request-routing';
import type { RegistrationRequestApi } from '../../registration-requests/registration-request-api';

describe('Administrator request routing regression', () => {
  it.each(OPERATIONAL_GROUPS)('routes %s cards into the existing Feature 006 review screen', (operationalGroup) => {
    const request = { requestId: '70000000-0000-4000-8000-000000000003', operationalGroup } as OperationalRequest;
    expect(existingFeature006ReviewRoute(request, 'mobile')).toEqual({ pathname: '/(admin)/admin/registration/[requestId]', params: { requestId: request.requestId, preview: 'mobile' } });
  });

  it('keeps correction, rejection, approval and deletion retry owned by the Feature 006 API', () => {
    const feature006 = {
      requestAdminCorrection: jest.fn(), rejectAdmin: jest.fn(), approveAdmin: jest.fn(), retryAdminDeletion: jest.fn(), listAdmin: jest.fn(),
    } as unknown as RegistrationRequestApi;
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/' }, jest.fn(), feature006);
    expect(api.decisions).toEqual({ requestCorrection: feature006.requestAdminCorrection, reject: feature006.rejectAdmin, approve: feature006.approveAdmin, retryDeletion: feature006.retryAdminDeletion });
    expect(api).not.toHaveProperty('approveRequest');
  });
});
