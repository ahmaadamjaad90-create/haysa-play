import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
import { demoRooms, type DemoRoom } from '@/lib/demo';
import { latestAnnouncement, type GiftEvent } from '@/lib/gifts';
import { supabase } from '@/lib/supabase';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { canClaimDaily, loadDaily, type DailyState } from '@/lib/vip';
import { colors } from '@/theme';

// ألعاب النسخة الأولى
const GAMES: { key: string; name: string; players: string; bg: string; fg: string; art: ReactNode }[] = [
  { key: 'ludo', name: 'لودو', players: '٢ إلى ٤', bg: colors.yellow, fg: colors.ink, art: <LudoArt /> },
  { key: 'spy', name: 'الجاسوس', players: '٣ إلى ٨', bg: colors.coral, fg: colors.white, art: <SpyArt /> },
  { key: 'colors', name: 'ألوان', players: 'لعبة ورق', bg: colors.purple, fg: colors.white, art: <ColorsArt /> },
];

const ROOM_ICONS: Record<DemoRoom['icon'], ReactNode> = {
  heart: <HeartIcon />,
  hat: <HatIcon />,
  mic: <MicIcon size={28} />,
};

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.games}>
          {GAMES.map((g) => (
            <Pressable
              key={g.key}
              accessibilityRole="button"
              onPress={g.key === 'ludo' ? () => router.push('/ludo') : g.key === 'spy' ? () => router.push('/spy') : () => router.push('/colors')}
              style={[styles.game, { backgroundColor: g.bg }]}>
              {g.art}
              <View style={{ gap: 2 }}>
                <T w="heading" style={{ fontSize: 24, lineHeight: 30, color: g.fg }}>{g.name}</T>
                <T style={{ fontSize: 14, color: g.fg }}>{g.players}</T>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <Section title="غرف حية الآن" />
        <View style={styles.rooms}>
          {demoRooms.map((r) => (
            <Pressable key={r.id} accessibilityRole="button" style={styles.room}>
              <View style={[styles.roomIcon, { backgroundColor: r.color }]}>{ROOM_ICONS[r.icon]}</View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <T w="black" style={{ fontSize: 18 }} numberOfLines={1}>{r.name}</T>
                <T style={{ fontSize: 14, color: colors.textMuted }} numberOfLines={1}>{r.meta}</T>
              </View>
              <View style={styles.faces}>
                {r.faces.map((f, i) => (
                  <View key={i} style={[styles.face, { backgroundColor: f.color }, i > 0 && { marginStart: -9 }]}>
                    <T w="black" style={{ fontSize: 14, color: f.color === colors.yellow ? colors.ink : colors.white }}>
                      {f.letter}
                    </T>
                  </View>
                ))}
                <View style={[styles.face, { backgroundColor: colors.surfaceHigh, marginStart: -9 }]}>
                  <T w="black" style={{ fontSize: 13 }}>+{ar(r.more)}</T>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {daily && <VipDaily daily={daily} onClose={() => setDaily(null)} />}
    </Screen>
  );
}

function Section({ title }: { title: string }) {
  return (
    <View style={styles.section}>
      <T w="heading" style={{ fontSize: 24, lineHeight: 32 }}>{title}</T>
      <Pressable accessibilityRole="button">
        <T w="bold" style={{ fontSize: 15, color: colors.yellow }}>عرض الكل</T>
      </Pressable>
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
  games: { marginTop: 12, paddingHorizontal: 20, gap: 12 },
  game: {
    width: 136,
    height: 132,
    padding: 14,
    borderRadius: 22,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
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
