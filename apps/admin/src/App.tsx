import { LoginScreen, Shell, Splash, useSession } from '@chauffr/ui';
import { Drivers } from './Drivers';
import { RateCardPanel } from './RateCardPanel';

export function App() {
  const { user, loading } = useSession();
  if (loading) return <Splash />;
  if (!user) return <LoginScreen app="admin" title="Operations" tagline="Sign in with an admin Google account." />;
  return (
    <Shell title="Chauffr Admin" wide>
      <RateCardPanel />
      <Drivers />
    </Shell>
  );
}
