import { LoginScreen, ProfileForm, Shell, Splash, useSession } from '@chauffr/ui';
import { Cars } from './Cars';

export function App() {
  const { user, loading } = useSession();
  if (loading) return <Splash />;
  if (!user) {
    return <LoginScreen app="customer" title="A driver for your car" tagline="Book a verified driver by the hour, anywhere in Bangalore." />;
  }
  return (
    <Shell title="Chauffr">
      {user.phone ? (
        <>
          <section className="card stack">
            <h2>Book a driver</h2>
            <p className="muted">Booking opens soon. Add your car below so you're ready.</p>
          </section>
          <Cars />
        </>
      ) : (
        <ProfileForm intro="Your driver will call this number when they arrive." />
      )}
    </Shell>
  );
}
