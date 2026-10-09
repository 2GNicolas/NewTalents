import './global.css';

import { AuthenticationProvider } from '../src/authentication/authentication-provider';
import { AuthenticatedRootShell } from '../src/authentication/authenticated-root-shell';

export default function RootLayout() {
  return (
    <AuthenticationProvider>
      <AuthenticatedRootShell />
    </AuthenticationProvider>
  );
}