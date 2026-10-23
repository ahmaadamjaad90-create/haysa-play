import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { STATUS_NAMES, listTournaments, type Tournament } from '@/lib/tournaments';
import { colors } from '@/theme';

const STATUS_COLORS: Record<Tournament['status'], string> = {
  open: colors.yellow,
  running: '#2ECC71',
  finished: colors.textDim,
  cancelled: colors.peach,
};

// كل البطولات: المفتوحة أول، وبعدها الشغّالة واللي خلصت
export default function Tournaments() {
  const { user, loading } = useSession();
  const [list, setList] = useState<Tournament[] | null>(null);
  const [msg, setMsg] = useState('');

  useFocusEffect(
    useCallback(() => {
      listTournaments()
        .then(setList)
        .catch((e) => setMsg(errorText(e)));
    }, []),
  );

  if (!loading && !user) return <Redirect href="/login" />;

  const order = { open: 0, running: 1, finished: 2, cancelled: 3 };
  const sorted = (list ?? []).slice().sort((a, b) => order[a.status] - order[b.status] || b.id - a.id);

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/home" />
        <T w="heading" style={styles.h1}>البطولات 🏆</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {!!msg && <T w="bold" style={{ color: colors.peach, textAlign: 'center' }}>{msg}</T>}
        {list && sorted.length === 0 && (
          <T style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>
            ما في بطولات هلأ. تابعنا، قريباً بطولة بلوت!
          </T>
        )}
        {sorted.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/tournament', params: { id: String(t.id) } })}
            style={[styles.card, t.status === 'open' && { borderColor: colors.yellow }]}>
            <T style={{ fontSize: 40, lineHeight: 50 }}>♠️</T>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T w="black" style={{ fontSize: 18 }} numberOfLines={1}>{t.title}</T>
              <T style={{ fontSize: 13, color: colors.textMuted }}>
                بلوت · {ar(t.size)} فرق{t.prize_coins ? ` · الجائزة ${ar(t.prize_coins.toLocaleString('en'))} 🪙 لكل لاعب` : ''}
              </T>
              {!!t.starts_at && t.status === 'open' && (
                <T style={{ fontSize: 12, color: colors.textSoft }}>
                  بتبلّش {new Date(t.starts_at).toLocaleString('en-GB', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </T>
              )}
            </View>
            <View style={[styles.pill, { backgroundColor: STATUS_COLORS[t.status] }]}>
              <T w="black" style={{ fontSize: 11, color: colors.ink }}>{STATUS_NAMES[t.status]}</T>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 30, lineHeight: 40 },
  card: {
    padding: 14,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
});
