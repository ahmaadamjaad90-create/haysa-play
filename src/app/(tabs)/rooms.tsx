import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { Dalla } from '@/components/Dalla';
import { FriendsIcon, MicIcon, PlusIcon } from '@/components/Icons';
import { Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { CATEGORIES, getRoomStats, listRooms, type RoomRow, type RoomStats } from '@/lib/rooms';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

const CARD_COLORS = [colors.purple, '#3447C9', colors.coral, colors.pink, '#2B7A6A', '#8A5A1E'];

export default function Rooms() {
  const { uid } = useSession();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [stats, setStats] = useState<RoomStats>({});
  const [filter, setFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setRooms(await listRooms());
      setErr('');
    } catch (e) {
      setErr(errorText(e));
    }
    // العدد بيجي من LiveKit، وإذا ما اشتغل منكمّل بدونه
    getRoomStats().then(setStats).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const mine = rooms.find((r) => r.owner === uid);
  // الغرف الشغّالة أول، والأكتر ناس فوق
  const shown = rooms
    .filter((r) => !filter || r.category === filter)
    .sort((a, b) => (stats[b.number]?.listeners ?? 0) - (stats[a.number]?.listeners ?? 0));

  const open = (number: number) => router.push({ pathname: '/room', params: { id: String(number) } });

  return (
    <Screen>
      <View style={styles.header}>
        <T w="heading" style={styles.h1}>الغرف</T>
        <Pressable
          accessibilityRole="button"
          onPress={() => (mine ? open(mine.number) : router.push('/create-room'))}
          style={styles.myBtn}>
          {mine ? <MicIcon size={20} color={colors.ink} /> : <PlusIcon />}
          <T w="black" style={{ fontSize: 15, color: colors.ink }}>{mine ? 'غرفتي' : 'أنشئ غرفتك'}</T>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.filters}>
        {[null, ...CATEGORIES].map((c) => (
          <Pressable
            key={c ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === c }}
            onPress={() => setFilter(c)}
            style={[styles.filter, filter === c && { backgroundColor: colors.yellow }]}>
            <T w={filter === c ? 'black' : 'bold'} style={{ fontSize: 15, color: filter === c ? colors.ink : colors.white }}>
              {c ?? 'الكل'}
            </T>
          </Pressable>
        ))}
      </ScrollView>

      {!!err && <T w="bold" style={styles.err}>{err}</T>}

      <ScrollView
        contentContainerStyle={styles.grid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.yellow} />}>
        {shown.length === 0 && (
          <View style={styles.empty}>
            <Dalla width={90} />
            <T style={styles.emptyText}>ما في غرف هون لسا. افتح غرفتك وادعي أصحابك!</T>
          </View>
        )}
        {shown.map((r, i) => {
          const s = stats[r.number];
          return (
            <Pressable key={r.owner} accessibilityRole="button" onPress={() => open(r.number)} style={styles.card}>
              <View style={styles.cardTop}>
                {!!r.cover && <Image source={{ uri: r.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                <View style={styles.count}>
                  <FriendsIcon size={14} />
                  <T w="black" style={{ fontSize: 13 }}>{ar(s?.listeners ?? 0)}</T>
                </View>
                {s && s.listeners > 0 && <View style={styles.live} />}
                <View style={styles.owner}>
                  <Avatar avatar={r.profiles?.avatar ?? 'dalla'} size={22} />
                  <T w="black" style={{ fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
                    {r.profiles?.name || 'لاعب'}
                  </T>
                </View>
              </View>
              <View style={[styles.cardBottom, { backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }]}>
                <T w="black" style={{ fontSize: 16 }} numberOfLines={1}>{r.name}</T>
                <View style={styles.rowBetween}>
                  <View style={styles.cat}>
                    <T w="bold" style={{ fontSize: 12 }}>{r.category}</T>
                  </View>
                  <T w="black" style={{ fontSize: 13 }}>
                    {ar(s?.onMic ?? 0)}/{ar(r.seats)} 🎙
                  </T>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  h1: { fontSize: 32, lineHeight: 42 },
  myBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filters: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  filter: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center' },
  err: { marginHorizontal: 20, marginBottom: 8, fontSize: 13, color: colors.peach },
  grid: { paddingHorizontal: 20, paddingBottom: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', flexGrow: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface },
  cardTop: { height: 100, padding: 8, justifyContent: 'space-between' },
  count: {
    alignSelf: 'flex-end',
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: colors.tabBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  live: {
    position: 'absolute',
    top: 16,
    start: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  owner: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 28,
    paddingStart: 3,
    paddingEnd: 10,
    borderRadius: 14,
    backgroundColor: colors.tabBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardBottom: { height: 64, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'space-between' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cat: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.ink },
  empty: { width: '100%', alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 16, lineHeight: 26, color: colors.textMuted, textAlign: 'center' },
});
