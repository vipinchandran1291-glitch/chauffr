import { LoginScreen, ProfileForm, Shell, Splash, useSession, type TrustPoint } from '@chauffr/ui';
import { Home } from './Home';

const POINTS: TrustPoint[] = [
  { icon: 'shieldCheck', title: 'Verified drivers', text: 'Licence and ID checked, and approved by our team before their first trip.' },
  { icon: 'lock', title: 'OTP-secured handover', text: 'The trip starts only when you share your code with the driver.' },
  { icon: 'rupee', title: 'Clear hourly pricing', text: 'See the fare before you book. Pay after the trip.' },
];

export function App() {
  const { user, loading } = useSession();
  if (loading) return <Splash />;
  if (!user) {
    return (
      <LoginScreen
        app="customer"
        title="A trusted driver for your car"
        tagline="Book a verified driver by the hour, anywhere in Bangalore. You keep your car, we bring the driver."
        points={POINTS}
      />
    );
  }
  return (
    <Shell>
      {user.phone ? <Home /> : <ProfileForm intro="Your driver will call this number when they arrive." />}
    </Shell>
  );
}
