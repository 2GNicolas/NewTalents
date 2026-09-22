import { render } from '@testing-library/react-native';

import { PassportActions } from '../../src/passport/role-interfaces';

describe('Feature 005 role-visible passport actions', () => {
  it('renders only actions declared in backend capabilities', async () => {
    const screen = await render(
      <PassportActions
        capabilities={['EDIT', 'VIEW_HISTORY']}
        onEdit={jest.fn()}
        onSubmit={jest.fn()}
        onReturn={jest.fn()}
        onResolveDuplicate={jest.fn()}
        onApprove={jest.fn()}
        onActivate={jest.fn()}
        onViewHistory={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver historial' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Presentar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Activar' })).toBeNull();
  });

  it('renders analyst and administrator actions when the capabilities contain them', async () => {
    const screen = await render(
      <PassportActions
        capabilities={['RETURN', 'RESOLVE_DUPLICATE', 'APPROVE', 'ACTIVATE']}
        onEdit={jest.fn()}
        onSubmit={jest.fn()}
        onReturn={jest.fn()}
        onResolveDuplicate={jest.fn()}
        onApprove={jest.fn()}
        onActivate={jest.fn()}
        onViewHistory={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Devolver para correcci\u00f3n' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resolver posible duplicado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Presentar' })).toBeNull();
  });
});
