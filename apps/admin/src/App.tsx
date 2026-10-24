import { LoginScreen, Shell, Splash, useSession, type TrustPoint } from '@chauffr/ui';
import { Drivers } from './Drivers';
import { RateCardPanel } from './RateCardPanel';

const POINTS: TrustPoint[] = [
  { icon: 'shieldCheck', title: 'Driver verification', text: 'Review and approve every driver before they go online.' },
  { icon: 'rupee', title: 'Pricing', text: 'Rates and commission in one place.' },
];

export function App() {
  const { user, loading } = useSession();
  if (loading) return <Splash />;
  if (!user) {
    return <LoginScreen app="admin" title="Operations" tagline="Sign in with an admin Google account." points={POINTS} />;
  }
  return (
    <Shell section="Operations" wide>
      <Drivers />
      <RateCardPanel />
    </Shell>
  );
}
