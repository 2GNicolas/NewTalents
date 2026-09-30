import { fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';

import { AcademyRequestHub } from './academy-request-hub';

const academy = { id: 'academy-1', name: 'Academia Horizonte Deportivo S.A.S.', location: 'Bogotá D.C., Colombia', approved: true } as const;

describe('AcademyRequestHub', () => {
  it('shows the backend-projected academy, permitted choices and existing requests without bulk actions', async () => {
    const select = jest.fn();
    const screen = await render(createElement(AcademyRequestHub, {
      academy,
      capabilities: ['registration.request.academy.create-additional-account', 'registration.request.academy.create-adult-player'],
      requests: [{ id: 'request-1', label: 'Laura M.', type: 'ADDITIONAL_ACADEMY_ACCOUNT', status: 'SUBMITTED' }],
      onSelectType: select,
    }));
    expect(screen.getByText(academy.name)).toBeTruthy();
    expect(screen.getByText('Laura M.')).toBeTruthy();
    expect(screen.queryByText(/seleccionar todas|aprobación masiva/i)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Solicitar cuenta de academia' }));
    expect(select).toHaveBeenCalledWith('ADDITIONAL_ACADEMY_ACCOUNT');
    expect(screen.queryByRole('button', { name: 'Registrar jugador menor' })).toBeNull();
  });
});
