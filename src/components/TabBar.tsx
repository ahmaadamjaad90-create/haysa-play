import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { CrownIcon, FriendsIcon, HomeIcon, MicIcon, UserIcon } from './Icons';
import { T } from './ui';

const TABS: Record<string, { label: string; icon: (c: string) => ReactNode }> = {
  home: { label: 'الرئيسية', icon: (c) => <HomeIcon color={c} /> },
  rooms: { label: 'الغرف', icon: (c) => <MicIcon color={c} /> },
  vip: { label: 'VIP', icon: () => <CrownIcon /> },
  friends: { label: 'الأصدقاء', icon: (c) => <FriendsIcon color={c} /> },
  profile: { label: 'حسابي', icon: (c) => <UserIcon color={c} /> },
};

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: 68 + insets.bottom }]}>
      <View style={styles.inner}>
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          const isVip = route.name === 'vip';
          const color = isVip ? colors.peach : focused ? colors.yellow : colors.textDim;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigateToTab(route.key);
              }}
              style={styles.item}>
              <View
                style={[
                  styles.pill,
                  isVip && { backgroundColor: colors.coral },
                  focused && !isVip && { backgroundColor: colors.surface },
                ]}>
                {tab.icon(color)}
              </View>
              <T w={focused || isVip ? 'black' : 'bold'} style={{ fontSize: 13, color }}>
                {tab.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.tabBar, borderTopWidth: 1, borderTopColor: colors.surface },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  item: { minWidth: 64, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
