import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { T } from './ui';

export type GiftAnnouncement = { sender: string; gift: string; emoji: string; room: string };

// شريط متحرك بالرئيسية بس، لهدايا الأسد وفوق
export function GiftTicker({ item, onPress }: { item: GiftAnnouncement; onPress?: () => void }) {
  const [x] = useState(() => new Animated.Value(0));
  const [trackW, setTrackW] = useState(0);
  const [textW, setTextW] = useState(0);

  useEffect(() => {
    if (!trackW || !textW) return;
    // من برا الشريط عاليسار لبرا الشريط عاليمين (اتجاه القراءة العربية)
    x.setValue(-textW);
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: trackW,
        duration: ((trackW + textW) / 50) * 1000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [trackW, textW, x]);

  const label = `${item.sender} أرسل ${item.gift} في غرفة ${item.room}`;

  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={styles.bar}>
      <View style={styles.tag}>
        <T w="black" style={{ fontSize: 13, color: colors.ink }}>📣 هيصة</T>
      </View>
      {/* الحركة بإحداثيات فعلية (يسار/يمين) فنثبت الاتجاه */}
      <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.moving, { opacity: textW ? 1 : 0, transform: [{ translateX: x }] }]}>
          <T w="bold" onLayout={(e) => setTextW(e.nativeEvent.layout.width)} style={styles.text}>
            {item.emoji} <T w="black" style={styles.hl}>{item.sender}</T> أرسل{' '}
            <T w="black" style={styles.hl}>{item.gift}</T> في غرفة{' '}
            <T w="black" style={styles.hl}>{item.room}</T> ·{' '}
            <T w="bold" style={[styles.text, { textDecorationLine: 'underline' }]}>اضغط للذهاب إليها</T>
          </T>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginTop: 10,
    marginHorizontal: 20,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.coral,
    borderWidth: 2,
    borderColor: colors.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tag: {
    height: '100%',
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: colors.yellow,
    justifyContent: 'center',
  },
  track: { flex: 1, height: '100%', overflow: 'hidden', direction: 'ltr' },
  // عرض كبير عشان النص ما ينكسر لسطرين
  moving: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2000, alignItems: 'flex-start', justifyContent: 'center' },
  text: { fontSize: 14, color: colors.white, writingDirection: 'rtl' },
  hl: { color: colors.yellow },
});
