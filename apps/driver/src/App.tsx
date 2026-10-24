import { LoginScreen, ProfileForm, Shell, Splash, useSession } from '@chauffr/ui';
import { DriverHome } from './DriverHome';

export function App() {
  const { user, loading } = useSession();
  if (loading) return <Splash />;
  if (!user) {
    return <LoginScreen app="driver" title="Drive with Chauffr" tagline="Earn by driving customers' own cars, on your schedule." />;
  }
  return (
    <Shell title="Chauffr Driver">
      {user.phone ? <DriverHome /> : <ProfileForm intro="Customers and our ops team will reach you on this number." />}
    </Shell>
  );
}
