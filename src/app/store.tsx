import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Dalla } from '@/components/Dalla';
import { BackButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { ADS_PER_DAY, loadStore, testerPurchase, type GemPackage, type StoreState } from '@/lib/store';
import { colors } from '@/theme';

// رسمة كل باقة
const ART: Record<string, string> = { cup: '☕', tray: '🍽️', crate: '📦', safe: '🔐', treasure: '💰' };

export default function Store() {
  const { uid, user, loading, setBalance } = useSession();
  const [state, setState] = useState<StoreState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    if (!uid) return;
    loadStore(uid)
      .then(setState)
      .catch((e) => setMsg(errorText(e)));
  }, [uid]);

  useEffect(load, [load]);

  if (!loading && !user) return <Redirect href="/login" />;

  const buy = async (p: GemPackage) => {
    setMsg('');
    if (!state?.isTester) {
      // TODO(RevenueCat): الشراء الحقيقي من آبل وقوقل بنسخة الجوال
      setMsg('الشراء بيشتغل بنسخة الجوال من App Store و Google Play. قريباً!');
      return;
    }
    setBusy(p.key);
    try {
      const gems = await testerPurchase(p.key);
      setBalance(user?.coins ?? 0, gems);
      setMsg(`✅ وصلك ${ar((state.bought.has(p.key) ? p.gems : p.gems * 2).toLocaleString('en'))} جوهرة (شراء تجريبي)`);
      load();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const ads = state?.adsToday ?? 0;

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/profile" />
        <T w="heading" style={styles.h1}>متجر الجواهر</T>
        <View style={styles.balance}>
          <T style={{ fontSize: 18 }}>💎</T>
          <T w="black" style={{ fontSize: 16 }}>{ar((user?.gems ?? 0).toLocaleString('en'))}</T>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.hero}>
          <View style={styles.heroBlob} />
          <T w="bold" style={{ fontSize: 15, color: '#FFE0D6' }}>أول شراء لكل باقة</T>
          <T w="heading" style={{ fontSize: 30, lineHeight: 38, color: colors.yellow }}>ضعف الجواهر!</T>
          <T style={styles.heroGems}>💎💎💎</T>
        </View>

        <View style={styles.ads}>
          <View style={styles.adIcon}>
            <T style={{ fontSize: 22 }}>▶️</T>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <View style={styles.rowBetween}>
              <T w="black" style={{ fontSize: 15 }}>جواهر مجانية</T>
              <T w="bold" style={{ fontSize: 12, color: colors.textMuted }}>
                <T w="black">{ar(ads)}</T> / {ar(ADS_PER_DAY)} اليوم
              </T>
            </View>
            <View style={styles.dots}>
              {Array.from({ length: ADS_PER_DAY }, (_, i) => (
                <View key={i} style={[styles.dot, i < ads && { backgroundColor: colors.yellow }]} />
              ))}
            </View>
            <T w="bold" style={{ fontSize: 11, color: colors.textDim }}>كل إعلان = 10 جواهر · لحد 100 باليوم</T>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setMsg(
                Platform.OS === 'web'
                  ? 'الإعلانات بتشتغل بنسخة الجوال بس'
                  : 'الإعلانات قريباً',
              )
            }
            style={[styles.adBtn, ads >= ADS_PER_DAY && { opacity: 0.5 }]}>
            <T w="black" style={{ fontSize: 14, color: colors.ink }}>شاهد +10 💎</T>
          </Pressable>
        </View>

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}
        {state?.isTester && <T w="bold" style={styles.tester}>🧪 حساب تجربة: الشراء هون ببلاش</T>}

        <View style={styles.grid}>
          {state?.packages.map((p, i) => {
            const first = !state.bought.has(p.key);
            const best = i === state.packages.length - 1;
            return (
              <View key={p.key} style={[styles.card, best && styles.best]}>
                {first && (
                  <View style={styles.badge}>
                    <T w="black" style={{ fontSize: 11, color: colors.ink }}>أول شراء ×2</T>
                  </View>
                )}
                <View style={styles.art}>
                  {p.key === 'dalla' ? <Dalla width={54} /> : <T style={{ fontSize: 44, lineHeight: 56 }}>{ART[p.key] ?? '💎'}</T>}
                </View>
                <T w="black" style={{ fontSize: 22, color: best ? colors.yellow : colors.white }}>
                  💎 {ar(p.gems.toLocaleString('en'))}
                </T>
                <T w="bold" style={{ fontSize: 13, color: colors.textMuted }}>{p.name}</T>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`اشتري ${p.name} بـ ${p.price_usd} دولار`}
                  disabled={!!busy}
                  onPress={() => buy(p)}
                  style={[styles.buy, busy === p.key && { opacity: 0.6 }]}>
                  <T w="black" style={{ fontSize: 16, color: colors.ink }}>${ar(Number(p.price_usd).toFixed(2))}</T>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { flex: 1, fontSize: 28, lineHeight: 38 },
  balance: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hero: {
    marginTop: 8,
    marginHorizontal: 20,
    height: 88,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: colors.coral,
    overflow: 'hidden',
    justifyContent: 'center',
    gap: 2,
  },
  heroBlob: {
    position: 'absolute',
    end: -30,
    bottom: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.coralLight,
  },
  heroGems: { position: 'absolute', end: 18, fontSize: 30 },
  ads: {
    marginTop: 10,
    marginHorizontal: 20,
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { direction: 'ltr', flexDirection: 'row', gap: 3 },
  dot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.tabBar },
  adBtn: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msg: { marginTop: 10, marginHorizontal: 20, textAlign: 'center', fontSize: 14, color: colors.yellow },
  tester: { marginTop: 8, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.sky },
  grid: { marginTop: 12, marginHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    flexGrow: 1,
    padding: 10,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 2,
  },
  best: { backgroundColor: '#3A1D72', borderWidth: 2, borderColor: colors.yellow },
  badge: {
    position: 'absolute',
    top: 8,
    end: 8,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: colors.yellow,
    justifyContent: 'center',
    zIndex: 1,
  },
  art: { marginTop: 18, height: 66, justifyContent: 'center', alignItems: 'center' },
  buy: {
    marginTop: 8,
    alignSelf: 'stretch',
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
