import { useRouter } from 'expo-router';
import { RequestTypeSelection } from '../../../src/registration-requests/components/request-type-selection';
import type { RegistrationDraft } from '../../../src/registration-requests/registration-request-api';

const destinations: Readonly<Record<Extract<RegistrationDraft['type'], 'PERSONAL_ADULT' | 'REPRESENTED_MINOR' | 'FORMAL_ACADEMY' | 'NATURAL_PERSON_ACADEMY'>, string>> = {
  PERSONAL_ADULT: '/(public)/registration/personal-adult', REPRESENTED_MINOR: '/(public)/registration/represented-minor',
  FORMAL_ACADEMY: '/(public)/registration/academy-formal', NATURAL_PERSON_ACADEMY: '/(public)/registration/academy-natural-person',
};
export default function PublicRegistrationEntryScreen() { const router = useRouter(); return <RequestTypeSelection onBack={() => router.replace('/')} onContinue={(type) => router.push(destinations[type as keyof typeof destinations] as never)} />; }
