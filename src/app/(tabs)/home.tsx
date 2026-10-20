import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { Dalla } from '@/components/Dalla';
import { GiftTicker } from '@/components/GiftTicker';
import { VipDaily } from '@/components/VipDaily';
import {
  BellIcon,
  ChatIcon,
  CoinIcon,
  ColorsArt,
  HatIcon,
  HeartIcon,
  LudoArt,
  MicIcon,
  PlusIcon,
  SpyArt,
} from '@/components/Icons';
import { Screen, T } from '@/components/ui';
import { listChats } from '@/lib/chat';
import { getRoomStats, listRooms, type RoomRow, type RoomStats } from '@/lib/rooms';
import { latestAnnouncement, type GiftEvent } from '@/lib/gifts';
import { supabase } from '@/lib/supabase';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { canClaimDaily, loadDaily, type DailyState } from '@/lib/vip';
import { colors } from '@/theme';

// ألعاب النسخة الأولى
const GAMES: { key: string; name: string; players: string; bg: string; fg: string; art: ReactNode; route: Href }[] = [
  { key: 'ludo', name: 'لودو', players: '2 إلى 4', bg: colors.yellow, fg: colors.ink, art: <LudoArt />, route: '/ludo' },
  { key: 'spy', name: 'الجاسوس', players: '3 إلى 8', bg: colors.coral, fg: colors.white, art: <SpyArt />, route: '/spy' },
  { key: 'colors', name: 'ألوان', players: 'لعبة ورق', bg: colors.purple, fg: colors.white, art: <ColorsArt />, route: '/colors' },
  {
    key: 'trivia',
    name: 'تحدي الأسئلة',
    players: 'لحد 8',
    bg: colors.pink,
    fg: colors.white,
    art: <T style={{ fontSize: 44, lineHeight: 52 }}>🧠</T>,
    route: '/trivia',
  },
  {
    key: 'draw',
    name: 'احزر الرسمة',
    players: '2 إلى 8',
    bg: '#1E8FB0',
    fg: colors.white,
    art: <T style={{ fontSize: 44, lineHeight: 52 }}>🎨</T>,
    route: '/draw',
  },
  {
    key: 'mafia',
    name: 'المافيا',
    players: '4 إلى 12',
    bg: '#3A1D72',
    fg: colors.white,
    art: <T style={{ fontSize: 44, lineHeight: 52 }}>🔪</T>,
    route: '/mafia',
  },
  {
    key: 'codewords',
    name: 'كلمات السر',
    players: '4 إلى 10',
    bg: '#9E2412',
    fg: colors.white,
    art: <T style={{ fontSize: 44, lineHeight: 52 }}>🔑</T>,
    route: '/codewords',
  },
  {
    key: 'domino',
    name: 'دومينو',
    players: '2 إلى 4',
    bg: '#1F6B4A',
    fg: colors.white,
    art: <T style={{ fontSize: 44, lineHeight: 52 }}>🁫</T>,
    route: '/domino',
  },
  {
    key: 'backgammon',
    name: 'طاولة الزهر',
    players: 'لاعبين',
    bg: '#8A4E2C',
    fg: colors.white,
    art: <T style={{ fontSize: 44, lineHeight: 52 }}>🎲</T>,
    route: '/backgammon',
  },
  {
    key: 'kout',
    name: 'كوت بو ستة',
    players: '4 لاعبين',
    bg: '#1F6B4A',
    fg: colors.white,
    art: <T style={{ fontSize: 44, lineHeight: 52 }}>🃏</T>,
    route: '/kout',
  },
  {
    key: 'baloot',
    name: 'البلوت',
    players: '4 لاعبين',
    bg: '#8A4E2C',
    fg: colors.white,
    art: <T style={{ fontSize: 44, lineHeight: 52 }}>♠️</T>,
    route: '/baloot',
  },
];

// أيقونة ولون كل غرفة حسب نوعها
const ROOM_ICONS: Record<string, { icon: ReactNode; color: string }> = {
  ألعاب: { icon: <HeartIcon />, color: '#6A35C9' },
  هزار: { icon: <HatIcon />, color: '#D9381E' },
};
const roomIcon = (category: string) => ROOM_ICONS[category] ?? { icon: <MicIcon size={28} />, color: '#B4297A' };

// النافذة اليومية بتطلع مرة وحدة بس كل ما ينفتح التطبيق
let dailyShown = false;

export default function Home() {
  const { user, uid } = useSession();
  const [daily, setDaily] = useState<DailyState | null>(null);

  useEffect(() => {
    if (!uid || dailyShown) return;
    loadDaily(uid)
      .then((d) => {
        if (canClaimDaily(d) && !dailyShown) {
          dailyShown = true;
          setDaily(d);
        }
      })
      .catch(() => {});
  }, [uid]);
  const [unread, setUnread] = useState(0);
  const [banner, setBanner] = useState<GiftEvent | null>(null);

  // شريط الهدايا الكبيرة (الأسد وفوق): آخر وحدة، وأي وحدة جديدة فوراً
  useEffect(() => {
    latestAnnouncement().then(setBanner).catch(() => {});
    const ch = supabase
      .channel('home-banner')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gift_events', filter: 'announce=eq.true' }, (p) =>
        setBanner(p.new as GiftEvent),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // الغرف الحية (فيها ناس هلأ) أول، وإذا ما في، أحدث الغرف
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [stats, setStats] = useState<RoomStats>({});
  useFocusEffect(
    useCallback(() => {
      listRooms()
        .then(setRooms)
        .catch(() => setRooms([]));
      getRoomStats()
        .then(setStats)
        .catch(() => {});
    }, []),
  );
  const live = (rooms ?? []).filter((r) => (stats[r.number]?.listeners ?? 0) > 0);
  const shownRooms = (live.length ? live : rooms ?? [])
    .slice()
    .sort((a, b) => (stats[b.number]?.listeners ?? 0) - (stats[a.number]?.listeners ?? 0))
    .slice(0, 3);

  useFocusEffect(
    useCallback(() => {
      listChats()
        .then((cs) => setUnread(cs.reduce((n, c) => n + c.unread, 0)))
        .catch(() => {});
    }, []),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <T w="heading" style={styles.logo}>
          هيصة <T w="heading" style={{ color: colors.yellow, fontSize: 26 }}>بلاي</T>
        </T>
        <View style={styles.headerEnd}>
          <Pressable accessibilityRole="button" accessibilityLabel="رصيد العملات" style={styles.coins}>
            <CoinIcon />
            <T w="black" style={{ fontSize: 16 }}>{ar(user?.coins ?? 0)}</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="الرسائل"
            onPress={() => router.push('/chats')}
            style={styles.bell}>
            <ChatIcon />
            {unread > 0 && (
              <View style={styles.count}>
                <T w="black" style={{ fontSize: 11 }}>{ar(unread > 99 ? 99 : unread)}</T>
              </View>
            )}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="الإشعارات" style={styles.bell}>
            <BellIcon />
            <View style={styles.badge} />
          </Pressable>
        </View>
      </View>

      {banner && (
        <GiftTicker
          key={banner.id}
          item={{
            sender: banner.sender_name,
            gift: banner.gift_name,
            emoji: banner.gift_emoji,
            room: banner.room_name,
          }}
          onPress={() => router.push({ pathname: '/room', params: { id: String(banner.room_number) } })}
        />
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.blob, { end: -36, bottom: -70, width: 190, height: 190, backgroundColor: colors.coralLight }]} />
          <View style={[styles.blob, { start: -20, top: -44, width: 110, height: 110, backgroundColor: colors.coralDark }]} />
          <View style={styles.heroArt}>
            <Dalla width={118} />
          </View>
          <View style={styles.heroText}>
            <T w="heading" style={styles.heroTitle}>ابدأ هيصة</T>
            <T style={{ fontSize: 15, lineHeight: 20 }}>افتح غرفة وادعي أصحابك</T>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/create-room')}
              style={styles.heroBtn}>
              <PlusIcon />
              <T w="black" style={{ fontSize: 16, color: colors.ink }}>غرفة جديدة</T>
            </Pressable>
          </View>
        </View>

        <Section title="ألعاب هيصة" />
        {/* أول لعبة بعرض كامل، والباقي كل تنتين جنب بعض */}
        <View style={styles.games}>
          {GAMES.map((g, i) => (
            <Pressable
              key={g.key}
              accessibilityRole="button"
              onPress={() => router.push(g.route)}
              style={[styles.game, i === 0 && styles.gameWide, { backgroundColor: g.bg }]}>
              {g.art}
              <View style={{ gap: 2 }}>
                <T w="heading" style={{ fontSize: i === 0 ? 30 : 24, lineHeight: i === 0 ? 38 : 30, color: g.fg }}>{g.name}</T>
                <T style={{ fontSize: 14, color: g.fg }}>{g.players}</T>
              </View>
            </Pressable>
          ))}
        </View>

        <Section title={live.length ? 'غرف حية الآن' : 'غرف هيصة'} onAll={() => router.push('/rooms')} />
        <View style={styles.rooms}>
          {rooms && shownRooms.length === 0 && (
            <Pressable accessibilityRole="button" onPress={() => router.push('/create-room')} style={styles.room}>
              <View style={[styles.roomIcon, { backgroundColor: colors.yellow }]}>
                <PlusIcon size={26} />
              </View>
              <T w="black" style={{ fontSize: 16, flex: 1 }}>ما في غرف لسا. افتح أول غرفة!</T>
            </Pressable>
          )}
          {shownRooms.map((r) => {
            const s = stats[r.number];
            const ic = roomIcon(r.category);
            return (
              <Pressable
                key={r.owner}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/room', params: { id: String(r.number) } })}
                style={styles.room}>
                <View style={[styles.roomIcon, { backgroundColor: ic.color }]}>{ic.icon}</View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <T w="black" style={{ fontSize: 18 }} numberOfLines={1}>{r.name}</T>
                  <T style={{ fontSize: 14, color: colors.textMuted }} numberOfLines={1}>
                    {r.category}{'\u200F · '}{s?.listeners ? `${ar(s.onMic)} على المايك · ${ar(s.listeners)} بالغرفة` : `${ar(r.seats)} مقاعد`}
                  </T>
                </View>
                <View style={styles.faces}>
                  <Avatar avatar={r.profiles?.avatar ?? 'dalla'} size={34} />
                  {!!s?.listeners && s.listeners > 1 && (
                    <View style={[styles.face, { backgroundColor: colors.surfaceHigh, marginStart: -9 }]}>
                      <T w="black" style={{ fontSize: 13 }}>+{ar(s.listeners - 1)}</T>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {daily && <VipDaily daily={daily} onClose={() => setDaily(null)} />}
    </Screen>
  );
}

function Section({ title, onAll }: { title: string; onAll?: () => void }) {
  return (
    <View style={styles.section}>
      <T w="heading" style={{ fontSize: 24, lineHeight: 32 }}>{title}</T>
      {onAll && <Pressable accessibilityRole="button" onPress={onAll}>
        <T w="bold" style={{ fontSize: 15, color: colors.yellow }}>عرض الكل</T>
      </Pressable>}
    </View>
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
  logo: { fontSize: 34, lineHeight: 46 },
  headerEnd: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coins: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    start: 11,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.alert,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  count: {
    position: 'absolute',
    top: -4,
    start: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.alert,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    marginTop: 12,
    marginHorizontal: 20,
    height: 140,
    borderRadius: 28,
    backgroundColor: colors.coral,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 999 },
  heroArt: { position: 'absolute', end: 8, bottom: 0 },
  heroText: { flex: 1, paddingHorizontal: 22, justifyContent: 'center', gap: 4, maxWidth: 214 },
  heroTitle: { fontSize: 36, lineHeight: 44 },
  heroBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    backgroundColor: colors.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  games: { marginTop: 12, marginHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  game: {
    flexGrow: 1,
    flexBasis: '40%',
    height: 132,
    padding: 14,
    borderRadius: 22,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  gameWide: { flexBasis: '100%', height: 120, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 22 },
  rooms: { marginTop: 12, marginHorizontal: 20, gap: 10 },
  room: {
    height: 80,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  faces: { flexDirection: 'row', alignItems: 'center' },
  face: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
