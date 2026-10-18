import { Redirect } from 'expo-router';

import { useSession } from '@/lib/session';

export default function Index() {
  const { user, loading } = useSession();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (!user.ready) return <Redirect href="/setup" />;
  return <Redirect href="/home" />;
}
