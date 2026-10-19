import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { ColorsArt } from '@/components/Icons';
import { BackButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar, toLatinDigits } from '@/lib/format';
import { createColors, joinColors, listWaitingColors, playColorsVsBot, type ColorsGame } from '@/lib/colors';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

// صالة ألوان: طاولة جديدة، ضد الكمبيوتر، أو انضمام لطاولة
export default function Colors() {
  const { user, loading } = useSession();
  const [tables, setTables] = useState<ColorsGame[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    listWaitingColors()
      .then(setTables)
      .catch((e) => setMsg(errorText(e)));
  }, []);
  useFocusEffect(load);

  if (!loading && !user) return <Redirect href="/login" />;

  const go = (id: number) => router.push({ pathname: '/colors-game', params: { id: String(id) } });

  const run = async (key: string, fn: () => Promise<number>) => {
    setBusy(key);
    setMsg('');
    try {
      go(await fn());
    } catch (e) {
      const t = errorText(e);
      setMsg(
        t.includes('not found') ? 'ما في طاولة بهالرقم'
        : t.includes('full') ? 'الطاولة مليانة'
        : t.includes('started') ? 'اللعب بلّش بهالطاولة'
        : t,
      );
    } finally {
      setBusy(null);
    }
  };

  const join = (id: number) => run(`join-${id}`, async () => (await joinColors(id), id));

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/home" />
        <T w="heading" style={styles.h1}>ألوان</T>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.hero}>
          <View style={{ flex: 1, gap: 4 }}>
            <T w="heading" style={{ fontSize: 28, lineHeight: 36 }}>خلّص ورقك أول!</T>
            <T w="bold" style={{ fontSize: 14, color: colors.textSoft }}>نزّل نفس اللون أو نفس الرقم</T>
            <T w="bold" style={{ fontSize: 13, color: colors.yellow }}>من ٢ لـ ٤ لاعبين · الرابح بياخد ١٠٠ 🪙</T>
          </View>
          <ColorsArt size={72} />
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={!!busy}
            onPress={() => run('new', createColors)}
            style={[styles.action, { backgroundColor: colors.coral }, busy === 'new' && styles.dim]}>
            <T style={{ fontSize: 30 }}>🎲</T>
            <T w="black" style={{ fontSize: 16 }}>طاولة جديدة</T>
            <T style={styles.actionNote}>العب مع أصحابك</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!!busy}
            onPress={() => run('bot', playColorsVsBot)}
            style={[styles.action, { backgroundColor: colors.pink }, busy === 'bot' && styles.dim]}>
            <T style={{ fontSize: 30 }}>🤖</T>
            <T w="black" style={{ fontSize: 16 }}>ضد الكمبيوتر</T>
            <T style={styles.actionNote}>تدرّب لحالك</T>
          </Pressable>
        </View>

        <View style={styles.joinRow}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9٠-٩]/g, ''))}
            keyboardType="number-pad"
            placeholder="رقم الطاولة"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!code || !!busy}
            onPress={() => join(Number(toLatinDigits(code)))}
            style={[styles.joinBtn, (!code || !!busy) && styles.dim]}>
            <T w="black" style={{ fontSize: 15, color: colors.ink }}>ادخل</T>
          </Pressable>
        </View>

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

        <View style={styles.sectionRow}>
          <T w="heading" style={{ fontSize: 22, lineHeight: 30 }}>طاولات بتستنى</T>
          <Pressable accessibilityRole="button" onPress={load}>
            <T w="bold" style={{ fontSize: 14, color: colors.yellow }}>تحديث</T>
          </Pressable>
        </View>
        {tables.length === 0 ? (
          <T style={styles.empty}>ما في طاولات هلأ. افتح وحدة وادعي أصحابك!</T>
        ) : (
          tables.map((g) => {
            const host = g.players[0];
            return (
              <View key={g.id} style={styles.table}>
                <Avatar avatar={host?.avatar ?? 'dalla'} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w="black" style={{ fontSize: 16 }} numberOfLines={1}>طاولة {host?.name ?? ''}</T>
                  <T style={{ fontSize: 13, color: colors.textMuted }}>
                    رقم {ar(g.id)}{'\u200F · '}{ar(g.players.length)} من ٤
                  </T>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!busy}
                  onPress={() => join(g.id)}
                  style={[styles.joinBtn, busy === `join-${g.id}` && styles.dim]}>
                  <T w="black" style={{ fontSize: 14, color: colors.ink }}>انضم</T>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 30, lineHeight: 40 },
  hero: {
    marginTop: 8,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.purple,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actions: { marginTop: 12, marginHorizontal: 20, flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 116, padding: 14, borderRadius: 22, gap: 2, justifyContent: 'center' },
  actionNote: { fontSize: 12, color: '#FFE0D6' },
  dim: { opacity: 0.5 },
  joinRow: { marginTop: 12, marginHorizontal: 20, flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: 'Tajawal_700Bold',
    fontSize: 16,
    textAlign: 'right',
  },
  joinBtn: {
    height: 44,
    minWidth: 72,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  msg: { marginTop: 10, marginHorizontal: 20, textAlign: 'center', fontSize: 14, color: colors.peach },
  sectionRow: {
    marginTop: 20,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty: { marginTop: 10, marginHorizontal: 20, fontSize: 14, color: colors.textDim },
  table: {
    marginTop: 10,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
