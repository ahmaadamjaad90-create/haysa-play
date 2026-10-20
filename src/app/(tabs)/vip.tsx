import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';

import { CoinIcon, CrownIcon } from '@/components/Icons';
import { FramedAvatar, Shield, VipBadge } from '@/components/Vip';
import { VipDaily } from '@/components/VipDaily';
import { Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar, toLatinDigits } from '@/lib/format';
import { useSession } from '@/lib/session';
import {
  TIER_ORDER,
  TIERS,
  VIP_GIFTS_LEVEL,
  canClaimDaily,
  claimReward,
  convertGems,
  levelOf,
  loadVip,
  type VipLevel,
  type VipState,
} from '@/lib/vip';
import { colors } from '@/theme';

const fmt = (n: number) => ar(n.toLocaleString('en'));
const AMOUNTS = [100, 1000, 10000];

export default function Vip() {
  const { uid, user, loading, patchUser } = useSession();
  const [state, setState] = useState<VipState | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<number | 'convert' | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [dailyOpen, setDailyOpen] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const tierY = useRef<Partial<Record<string, number>>>({});
  const ladderY = useRef(0);

  const load = useCallback(() => {
    if (!uid) return;
    loadVip(uid)
      .then((s) => {
        setState(s);
        patchUser({ vipPoints: s.points });
      })
      .catch((e) => setMsg(errorText(e)));
    // patchUser بيتغير كل رندر، والتحميل بس عند الفتح
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useFocusEffect(load);

  if (!loading && !user) return <Redirect href="/login" />;
  if (!user) return null;

  const points = user.vipPoints;
  const level = levelOf(points);
  const levels = state?.levels ?? [];
  const cur = levels.find((l) => l.level === level);
  const next = levels.find((l) => l.level === level + 1);
  const from = cur?.points ?? 0;
  const progress = next ? Math.min(1, (points - from) / (next.points - from)) : 1;

  const claim = async (l: VipLevel) => {
    setBusy(l.level);
    setMsg('');
    try {
      const coins = await claimReward(l.level);
      patchUser({ coins });
      setState((s) => (s ? { ...s, claimed: new Set([...s.claimed, l.level]) } : s));
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const n = Number(toLatinDigits(amount)) || 0;
  const convert = async () => {
    setBusy('convert');
    setMsg('');
    try {
      const r = await convertGems(n);
      patchUser({ gems: r.gems, vipPoints: r.vip_points });
      setAmount('');
      setMsg(`✅ صار عندك ${fmt(r.vip_points)} نقطة VIP`);
    } catch (e) {
      const t = errorText(e);
      setMsg(t.includes('insufficient') ? 'جواهرك ما بتكفي' : t.includes('min') ? 'أقل شي 10 جواهر' : t);
    } finally {
      setBusy(null);
    }
  };

  const dailyReady = !!state && canClaimDaily(state.daily);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.crown}>
          <CrownIcon />
        </View>
        <T w="heading" style={styles.h1}>مسار VIP</T>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.row}>
            <FramedAvatar avatar={user.avatar} level={level} size={56} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.row}>
                <T w="heading" style={{ fontSize: 24, lineHeight: 32, color: cur ? TIERS[cur.tier].text : colors.white }}>
                  {cur ? `${TIERS[cur.tier].name} ${ar(cur.step)}` : 'لسا ما بلّشت'}
                </T>
                <VipBadge level={level} />
              </View>
              <T style={{ fontSize: 13, color: colors.textMuted }}>
                {next
                  ? `باقي ${fmt(next.points - points)} نقطة لـ ${TIERS[next.tier].name} ${ar(next.step)}`
                  : level >= 18
                    ? 'وصلت لأعلى مستوى 👑'
                    : ''}
              </T>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setConvertOpen((o) => !o)} style={styles.charge}>
              <T w="black" style={{ fontSize: 15, color: colors.ink }}>اشحن</T>
            </Pressable>
          </View>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T w="bold" style={styles.small}>{fmt(points)} نقطة</T>
            {next && <T w="bold" style={styles.small}>{fmt(next.points)}</T>}
          </View>

          {convertOpen && (
            <View style={styles.convert}>
              <T w="black" style={{ fontSize: 14 }}>حوّل جواهر لنقاط VIP (1 💎 = 1 نقطة)</T>
              <T style={{ fontSize: 12, color: colors.textDim }}>
                عندك 💎 {fmt(user.gems)} · وكل جوهرة بتصرفها على الهدايا كمان بتعطيك نقطة
              </T>
              <View style={styles.row}>
                {AMOUNTS.map((a) => (
                  <Pressable key={a} accessibilityRole="button" onPress={() => setAmount(String(a))} style={styles.amount}>
                    <T w="black" style={{ fontSize: 13 }}>{fmt(a)}</T>
                  </Pressable>
                ))}
                <TextInput
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-90-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="كمية"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={n < 10 || busy === 'convert'}
                onPress={convert}
                style={[styles.convertBtn, (n < 10 || busy === 'convert') && { opacity: 0.5 }]}>
                <T w="black" style={{ fontSize: 15, color: colors.ink }}>
                  {n < 10 ? 'أقل شي 10' : `حوّل 💎 ${fmt(n)}`}
                </T>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => router.push('/store')}>
                <T w="bold" style={{ fontSize: 13, color: colors.yellow, textAlign: 'center' }}>بدك جواهر؟ روح للمتجر</T>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!dailyReady}
          onPress={() => setDailyOpen(true)}
          style={[styles.daily, dailyReady && { borderColor: colors.yellow }]}>
          <T style={{ fontSize: 26 }}>🎁</T>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T w="black" style={{ fontSize: 15 }}>نقاط VIP اليومية</T>
            <T style={{ fontSize: 12, color: colors.textMuted }}>
              {dailyReady ? 'جاهزة! اضغط واستلم' : `استلمتها اليوم ✓ · السلسلة ${ar(state?.daily.streak ?? 0)} من 7`}
            </T>
          </View>
          {dailyReady && (
            <View style={styles.claimSmall}>
              <T w="black" style={{ fontSize: 13, color: colors.ink }}>استلم</T>
            </View>
          )}
        </Pressable>

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiers}>
          {TIER_ORDER.map((t) => {
            const on = cur?.tier === t;
            return (
              <Pressable
                key={t}
                accessibilityRole="button"
                onPress={() => scroll.current?.scrollTo({ y: tierY.current[t] ?? 0, animated: true })}
                style={[styles.tier, on && { borderWidth: 2, borderColor: TIERS[t].color, backgroundColor: '#3A1D72' }]}>
                <View style={[styles.tierDot, { backgroundColor: TIERS[t].color }]} />
                <T w={on ? 'black' : 'bold'} style={{ fontSize: 14 }}>{TIERS[t].name}</T>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.ladder} onLayout={(e) => (ladderY.current = e.nativeEvent.layout.y)}>
          {levels.map((l) => {
            const done = l.level <= level;
            const current = l.level === level;
            const claimed = state?.claimed.has(l.level);
            const t = TIERS[l.tier];
            const status = done ? (claimed ? (
              <View style={styles.check}>
                <T w="black" style={{ fontSize: 14 }}>✓</T>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={busy === l.level}
                onPress={() => claim(l)}
                style={[styles.claimSmall, busy === l.level && { opacity: 0.6 }]}>
                <CoinIcon size={14} />
                <T w="black" style={{ fontSize: 12, color: colors.ink }}>استلم {fmt(l.reward_coins)}</T>
              </Pressable>
            )) : (
              <T style={{ fontSize: 18 }}>🔒</T>
            );
            return (
              <View
                key={l.level}
                onLayout={l.step === 1 ? (e) => (tierY.current[l.tier] = ladderY.current + e.nativeEvent.layout.y - 60) : undefined}
                style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.line, { backgroundColor: done ? colors.yellow : colors.surface }]} />
                  <Shield level={l.level} state={current ? 'current' : done ? 'done' : 'locked'} />
                </View>
                {l.step === 1 ? (
                  <View style={[styles.tierCard, !done && { backgroundColor: '#2A1356' }, current && styles.currentBorder]}>
                    <FramedAvatar avatar={user.avatar} level={l.level} size={52} />
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <T w="heading" style={{ fontSize: 22, lineHeight: 30, color: t.text }}>ال{t.name}</T>
                      <T style={{ fontSize: 13, color: colors.textMuted }}>{l.perk}</T>
                      <T w="bold" style={styles.small}>{fmt(l.points)} نقطة{'\u200F · '}صندوق 🪙 {fmt(l.reward_coins)}</T>
                    </View>
                    {status}
                  </View>
                ) : (
                  <View style={[styles.levelRow, !done && { backgroundColor: '#24104A' }, current && styles.currentBorder]}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <T w="bold" style={{ fontSize: 12, color: done ? t.text : colors.textDim }}>
                        {t.name} {ar(l.step)}{'\u200F · '}{fmt(l.points)} نقطة
                      </T>
                      <T w="black" style={{ fontSize: 15, color: done ? colors.white : colors.textMuted }} numberOfLines={1}>
                        {l.perk}
                      </T>
                    </View>
                    {current && claimed && (
                      <View style={styles.here}>
                        <T w="black" style={{ fontSize: 12, color: colors.ink }}>أنت هنا</T>
                      </View>
                    )}
                    {status}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <T style={styles.note}>
          هدايا قسم VIP بتفتح من الذهبي 1 (VIP {ar(VIP_GIFTS_LEVEL)}). المستوى دائم وما بينزل.
        </T>
      </ScrollView>

      {dailyOpen && state && (
        <VipDaily
          daily={state.daily}
          onClose={(claimed) => {
            setDailyOpen(false);
            if (claimed) load();
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  crown: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { fontSize: 30, lineHeight: 40 },
  card: { marginTop: 8, marginHorizontal: 20, padding: 14, borderRadius: 24, backgroundColor: colors.surface, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  charge: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { height: 12, borderRadius: 6, backgroundColor: colors.tabBar, overflow: 'hidden', flexDirection: 'row' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: colors.yellow },
  small: { fontSize: 12, color: colors.textDim },
  convert: { marginTop: 4, padding: 12, borderRadius: 18, backgroundColor: '#3A1D72', gap: 8 },
  amount: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.tabBar,
    color: colors.white,
    fontFamily: 'Tajawal_700Bold',
    fontSize: 14,
    textAlign: 'right',
  },
  convertBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daily: {
    marginTop: 10,
    marginHorizontal: 20,
    minHeight: 64,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  claimSmall: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: colors.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  msg: { marginTop: 10, marginHorizontal: 20, textAlign: 'center', fontSize: 14, color: colors.yellow },
  tiers: { marginTop: 12, paddingHorizontal: 20, gap: 8 },
  tier: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierDot: { width: 12, height: 12, borderRadius: 6 },
  ladder: { marginTop: 12, marginHorizontal: 20 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  rail: { width: 44, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', top: 0, bottom: 0, width: 10 },
  levelRow: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    marginVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 120,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#3A1D72',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currentBorder: { borderWidth: 2, borderColor: colors.yellow },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2FB760',
    alignItems: 'center',
    justifyContent: 'center',
  },
  here: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.yellow, justifyContent: 'center' },
  note: { marginTop: 14, marginHorizontal: 20, fontSize: 12, lineHeight: 20, color: colors.textDim, textAlign: 'center' },
});
