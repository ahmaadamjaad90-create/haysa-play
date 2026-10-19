import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { DAILY_POINTS, claimDaily, dailyBox, levelOf, nextStreakDay, tierOf, TIERS, type DailyState } from '@/lib/vip';
import { colors } from '@/theme';
import { CloseIcon } from './Icons';
import { T } from './ui';

// نافذة نقاط VIP اليومية (بتطلع أول ما يفتح الرئيسية)
export function VipDaily({ daily, onClose }: { daily: DailyState; onClose: (claimed: boolean) => void }) {
  const { user, patchUser } = useSession();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const day = nextStreakDay(daily);
  const level = levelOf(user?.vipPoints ?? 0);
  const tier = tierOf(level);
  const box = dailyBox(level);

  const claim = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await claimDaily();
      patchUser({ coins: r.coins, gems: r.gems, vipPoints: r.vip_points });
      onClose(true);
    } catch (e) {
      const t = errorText(e);
      if (t.includes('already')) onClose(true);
      else setMsg(t);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={() => onClose(false)} style={styles.close}>
            <CloseIcon size={16} />
          </Pressable>
          <T w="heading" style={styles.title}>استلم نقاط VIP المجانية 🎉</T>
          <T style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
            ادخل كل يوم وخذ نقاط VIP أكتر 🔥
            {day > 1 && <T w="black"> {ar(day - 1)} {day - 1 === 1 ? 'يوم' : 'أيام'} ورا بعض</T>}
          </T>

          <View style={styles.days}>
            {DAILY_POINTS.map((p, i) => {
              const n = i + 1;
              const done = n < day;
              const today = n === day;
              return (
                <View key={n} style={styles.day}>
                  <View style={[styles.dot, done && styles.dotDone, today && styles.dotToday]}>
                    <T w="black" style={{ fontSize: 12, color: today ? colors.ink : done ? colors.white : colors.textDim }}>
                      {done ? '✓' : ar(p)}
                    </T>
                  </View>
                  <T w="bold" style={{ fontSize: 10, color: today ? colors.yellow : colors.textDim }}>يوم {ar(n)}</T>
                </View>
              );
            })}
          </View>
          <T w="bold" style={{ marginTop: 6, fontSize: 11, color: colors.peach }}>إذا فوّت يوم، بترجع من يوم ١</T>

          <View style={styles.box}>
            <T w="black" style={{ fontSize: 15 }}>{tier ? `صندوق ال${TIERS[tier].name} اليومي` : 'صندوق اليوم'}</T>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={styles.item}>
                <T style={{ fontSize: 20 }}>🪙</T>
                <T w="black" style={{ fontSize: 12 }}>{ar(box.coins)}</T>
              </View>
              {box.gems > 0 && (
                <View style={styles.item}>
                  <T style={{ fontSize: 20 }}>💎</T>
                  <T w="black" style={{ fontSize: 12 }}>{ar(box.gems)}</T>
                </View>
              )}
            </View>
            <T w="bold" style={{ fontSize: 11, color: colors.textDim }}>كل ما يعلى مستواك، الصندوق بيكبر</T>
          </View>

          {!!msg && <T w="bold" style={{ marginTop: 8, fontSize: 13, color: colors.peach }}>{msg}</T>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={claim} style={[styles.btn, busy && { opacity: 0.6 }]}>
            <T w="black" style={{ fontSize: 18, color: colors.ink }}>استلم {ar(DAILY_POINTS[day - 1])} نقطة + الصندوق 🎁</T>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,3,24,0.7)', justifyContent: 'center', padding: 18 },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.yellow,
    backgroundColor: '#24104A',
    alignItems: 'center',
  },
  close: {
    position: 'absolute',
    top: 12,
    end: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3A1D72',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  title: { marginTop: 10, fontSize: 24, lineHeight: 32, textAlign: 'center' },
  days: { marginTop: 16, alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4 },
  dot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: '#2FB760' },
  dotToday: { backgroundColor: colors.yellow, borderWidth: 2, borderColor: colors.white },
  box: {
    marginTop: 14,
    alignSelf: 'stretch',
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 8,
  },
  item: {
    minWidth: 64,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#3A1D72',
    alignItems: 'center',
    gap: 2,
  },
  btn: {
    marginTop: 16,
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
