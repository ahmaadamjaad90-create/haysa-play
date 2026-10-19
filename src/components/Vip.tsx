import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ar } from '@/lib/format';
import { TIERS, tierOf } from '@/lib/vip';
import { colors } from '@/theme';
import { Avatar } from './Avatars';
import { T } from './ui';

// شارة "VIP ٦" بلون الفئة
export function VipBadge({ level }: { level: number }) {
  const tier = tierOf(level);
  if (!tier) return null;
  const dark = tier === 'silver' || tier === 'gold' || tier === 'diamond';
  return (
    <View style={[styles.badge, { backgroundColor: TIERS[tier].color }]}>
      <T w="black" style={{ fontSize: 12, color: dark ? colors.ink : colors.white }}>VIP {ar(level)}</T>
    </View>
  );
}

// صورة اللاعب بإطار فئته
export function FramedAvatar({ avatar, level, size }: { avatar: string; level: number; size: number }) {
  const tier = tierOf(level);
  const border = Math.max(3, Math.round(size / 18));
  if (!tier) return <Avatar avatar={avatar} size={size} />;
  const t = TIERS[tier];
  const gem = Math.round(size / 7);
  return (
    <View style={{ width: size + border * 2 + 4, height: size + border * 2 + 4, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.frame, { borderRadius: size, borderWidth: border, borderColor: t.color, outlineColor: t.ring }]}>
        <Avatar avatar={avatar} size={size} />
      </View>
      <View
        style={[
          styles.gem,
          { width: gem, height: gem, top: 0, backgroundColor: tier === 'gold' || tier === 'royal' ? colors.coral : t.color, borderColor: t.ring },
        ]}
      />
    </View>
  );
}

// درع رقم المستوى بالمسار
export function Shield({ level, state }: { level: number; state: 'done' | 'current' | 'locked' }) {
  const fill = state === 'current' ? colors.yellow : colors.ink;
  const stroke = state === 'current' ? colors.white : state === 'done' ? colors.yellow : colors.surfaceHigh;
  const text = state === 'current' ? colors.ink : state === 'done' ? colors.white : colors.textDim;
  return (
    <View style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={40} height={44} viewBox="0 0 40 44" style={{ position: 'absolute' }}>
        <Path d="M20 2 L37 8 V22 C37 33 29 40 20 43 C11 40 3 33 3 22 V8 Z" fill={fill} stroke={stroke} strokeWidth={3} strokeLinejoin="round" />
      </Svg>
      <T w="black" style={{ fontSize: 15, color: text, marginTop: -2 }}>{ar(level)}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center' },
  frame: { padding: 2, outlineWidth: 2, outlineStyle: 'solid' },
  gem: { position: 'absolute', borderWidth: 2, transform: [{ rotate: '45deg' }] },
});
