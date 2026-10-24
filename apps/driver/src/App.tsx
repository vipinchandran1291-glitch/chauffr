import { LoginScreen, ProfileForm, Shell, Splash, useSession, type TrustPoint } from '@chauffr/ui';
import { DriverHome } from './DriverHome';

const POINTS: TrustPoint[] = [
  { icon: 'wallet', title: 'Steady weekly payouts', text: 'Earnings are tracked trip by trip and paid to your bank every week.' },
  { icon: 'clock', title: 'Drive when you want', text: 'Go online when it suits you. Take hourly trips around Bangalore.' },
  { icon: 'support', title: 'Support on every trip', text: 'Our ops team is a call away if anything goes wrong.' },
];

export function App() {
  const { user, loading } = useSession();
  if (loading) return <Splash />;
  if (!user) {
    return (
      <LoginScreen
        app="driver"
        title="Drive with Chauffr"
        tagline="Earn by driving customers' own cars. No vehicle needed, just your licence and skill."
        points={POINTS}
      />
    );
  }
  return (
    <Shell section="Driver">
      {user.phone ? <DriverHome /> : <ProfileForm intro="Customers and our ops team will reach you on this number." />}
    </Shell>
  );
}
