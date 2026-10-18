import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { user, loading } = useSession();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (!user.ready) return <Redirect href="/setup" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="rooms" />
      <Tabs.Screen name="vip" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
