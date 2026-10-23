import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { BackButton, PillButton, Screen, T } from '@/components/ui';
import {
  adminBan,
  adminDeleteRoom,
  adminPlayer,
  adminStats,
  adminTransfer,
  adminUnban,
  isBanned,
  listOrganizers,
  setOrganizer,
  type AdminPlayer,
  type AdminStats,
  type Organizer,
} from '@/lib/admin';
import { errorText } from '@/lib/errors';
import { ar, toLatinDigits } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { TOURNAMENT_GAMES, createTournament, gameInfo, isTeamGame, type TournamentGame } from '@/lib/tournaments';
import { colors, fonts } from '@/theme';

const num = (s: string) => Number(toLatinDigits(s) || 0);
const digits = (s: string) => s.replace(/[^0-9٠-٩]/g, '');

// رصيدي من السيرفر (بعد التحويل أو جائزة بطولة)
function useRefreshBalance() {
  const { uid, setBalance } = useSession();
  return useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from('profiles').select('coins, gems').eq('id', uid).single<{ coins: number; gems: number }>();
    if (data) setBalance(data.coins, data.gems);
  }, [uid, setBalance]);
}

// لوحة الأدمن (والمنظّم بيشوف قسم البطولات بس)
export default function Admin() {
  const { user, loading } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const isAdmin = !!user?.isAdmin;

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return;
      adminStats()
        .then(setStats)
        .catch(() => {});
    }, [isAdmin]),
  );

  if (!loading && !user) return <Redirect href="/login" />;
  if (user && !user.isAdmin && !user.isOrganizer) return <Redirect href="/home" />;

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/profile" />
        <T w="heading" style={styles.h1}>{isAdmin ? 'لوحة الأدمن 👑' : 'نظّم بطولة 🏆'}</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }} keyboardShouldPersistTaps="handled">
        {stats && (
          <View style={styles.stats}>
            {(
              [
                ['اللاعبين', stats.players],
                ['جداد اليوم', stats.new_today],
                ['الغرف', stats.rooms],
                ['محظورين', stats.banned],
                ['بلوت اليوم', stats.baloot_today],
                ['هدايا اليوم', stats.gifts_today],
              ] as const
            ).map(([label, n]) => (
              <View key={label} style={styles.stat}>
                <T w="heading" style={{ fontSize: 24, lineHeight: 30, color: colors.yellow }}>{ar(n.toLocaleString('en'))}</T>
                <T style={{ fontSize: 12, color: colors.textMuted }}>{label}</T>
              </View>
            ))}
          </View>
        )}
        {user && (
          <View style={styles.wallet}>
            <T w="black" style={{ fontSize: 15 }}>رصيدي:</T>
            <T w="black" style={{ fontSize: 15, color: colors.yellow }}>{ar(user.coins.toLocaleString('en'))} 🪙</T>
            <T w="black" style={{ fontSize: 15, color: colors.sky }}>{ar(user.gems.toLocaleString('en'))} 💎</T>
          </View>
        )}
        {isAdmin && <PlayerTools />}
        <TournamentMaker />
        {isAdmin && <OrganizerTools />}
        {isAdmin && <RoomTools />}
      </ScrollView>
    </Screen>
  );
}

function PlayerTools() {
  const [id, setId] = useState('');
  const [p, setP] = useState<AdminPlayer | null>(null);
  const [coins, setCoins] = useState('');
  const [gems, setGems] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const refreshBalance = useRefreshBalance();

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setP(await adminPlayer(num(id)));
      if (done) setMsg(done);
    } catch (e) {
      const t = errorText(e);
      if (t.includes('not enough')) setMsg('رصيدك ما بيكفي');
      else if (t.includes('yourself')) setMsg('ما فيك تحوّل لحالك');
      else {
        setMsg(t.includes('not found') ? 'ما في لاعب بهالرقم' : t);
        setP(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const banned = p && isBanned(p.banned_until);

  return (
    <View style={styles.card}>
      <T w="black" style={styles.title}>👤 لاعب</T>
      <View style={styles.row}>
        <TextInput value={id} onChangeText={(x) => setId(digits(x))} keyboardType="number-pad" placeholder="رقم الـ ID" placeholderTextColor={colors.textDim} style={[styles.input, { flex: 1 }]} />
        <Pressable accessibilityRole="button" disabled={!id || busy} onPress={() => run(async () => {})} style={[styles.small, !id && { opacity: 0.5 }]}>
          <T w="black" style={{ color: colors.ink }}>دوّر</T>
        </Pressable>
      </View>
      {!!msg && <T w="bold" style={{ fontSize: 13, color: msg.startsWith('✅') ? '#2ECC71' : colors.peach }}>{msg}</T>}
      {p && (
        <>
          <View style={styles.row}>
            <Avatar avatar={p.avatar} size={44} />
            <View style={{ flex: 1 }}>
              <T w="black" style={{ fontSize: 16 }}>{p.is_admin ? '👑 ' : ''}{p.name || 'بدون اسم'} · ID {ar(p.pid)}</T>
              <T style={{ fontSize: 12, color: colors.textMuted }}>
                {ar(p.coins.toLocaleString('en'))} 🪙 · {ar(p.gems.toLocaleString('en'))} 💎 · {ar(p.xp)} XP{p.has_room ? ' · عنده غرفة' : ''}
                {p.is_organizer ? ' · 🎖️ منظّم' : ''}
              </T>
              {banned && (
                <T w="bold" style={{ fontSize: 12, color: colors.peach }}>
                  محظور {p.banned_until === 'infinity' ? 'دايم' : `لحد ${new Date(p.banned_until!).toLocaleDateString('en-GB')}`}
                </T>
              )}
            </View>
          </View>
          {!p.is_admin &&
            (banned ? (
              <PillButton label="فك الحظر" bg={colors.surfaceHigh} fg={colors.white} disabled={busy} onPress={() => run(() => adminUnban(p.pid), '✅ انفك الحظر')} />
            ) : (
              <View style={styles.row}>
                {(
                  [
                    ['يوم', 1],
                    ['أسبوع', 7],
                    ['دايم', null],
                  ] as const
                ).map(([label, days]) => (
                  <Pressable key={label} accessibilityRole="button" disabled={busy} onPress={() => run(() => adminBan(p.pid, days), '✅ انحظر')} style={styles.ban}>
                    <T w="black" style={{ fontSize: 13 }}>🚫 حظر {label}</T>
                  </Pressable>
                ))}
              </View>
            ))}
          <View style={styles.row}>
            <TextInput value={coins} onChangeText={(x) => setCoins(digits(x))} keyboardType="number-pad" placeholder="🪙 عملات" placeholderTextColor={colors.textDim} style={[styles.input, { flex: 1 }]} />
            <TextInput value={gems} onChangeText={(x) => setGems(digits(x))} keyboardType="number-pad" placeholder="💎 جواهر" placeholderTextColor={colors.textDim} style={[styles.input, { flex: 1 }]} />
          </View>
          <PillButton
            label="🎁 حوّله هدية من رصيدي"
            disabled={busy || (!coins && !gems)}
            onPress={() =>
              run(async () => {
                await adminTransfer(p.pid, num(coins), num(gems));
                setCoins('');
                setGems('');
                await refreshBalance();
              }, '✅ وصلته الهدية')
            }
          />
        </>
      )}
    </View>
  );
}

function TournamentMaker() {
  const [game, setGame] = useState<TournamentGame>('baloot');
  const [title, setTitle] = useState('');
  const [size, setSize] = useState(8);
  const [prize, setPrize] = useState('');
  const [gemsPrize, setGemsPrize] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const refreshBalance = useRefreshBalance();

  const make = async () => {
    setBusy(true);
    setMsg('');
    try {
      const id = await createTournament(game, title.trim(), size, num(prize), num(gemsPrize));
      await refreshBalance();
      router.push({ pathname: '/tournament', params: { id: String(id) } });
    } catch (e) {
      const t = errorText(e);
      setMsg(t.includes('not enough') ? 'رصيدك ما بيكفي للجائزة' : t);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <T w="black" style={styles.title}>🏆 بطولة جديدة</T>
      <View style={styles.row}>
        {TOURNAMENT_GAMES.map((g) => (
          <Pressable key={g} accessibilityRole="button" onPress={() => setGame(g)} style={[styles.gameChip, game === g && { backgroundColor: colors.yellow }]}>
            <T w="black" style={{ fontSize: 13, color: game === g ? colors.ink : colors.white }}>{gameInfo(g).emoji} {gameInfo(g).name}</T>
          </Pressable>
        ))}
      </View>
      <T style={{ fontSize: 12, color: colors.textMuted }}>
        {isTeamGame(game) ? 'فرق من لاعبين اتنين' : 'لاعب ضد لاعب'} · خروج المغلوب
      </T>
      <TextInput value={title} onChangeText={setTitle} maxLength={40} placeholder="اسم البطولة (مثلاً: كأس هيصة)" placeholderTextColor={colors.textDim} style={styles.input} />
      <View style={styles.row}>
        <T style={{ color: colors.textMuted }}>{isTeamGame(game) ? 'عدد الفرق:' : 'عدد اللاعبين:'}</T>
        {[4, 8, 16].map((n) => (
          <Pressable key={n} accessibilityRole="button" onPress={() => setSize(n)} style={[styles.chip, size === n && { backgroundColor: colors.yellow }]}>
            <T w="black" style={{ color: size === n ? colors.ink : colors.white }}>{ar(n)}</T>
          </Pressable>
        ))}
      </View>
      <T style={{ fontSize: 12, color: colors.textMuted }}>
        الجائزة لكل لاعب بالفائز (اختياري). بتنخصم من رصيدك هلأ{isTeamGame(game) ? ' (مرتين، للاعبين التنين)' : ''}، وبترجعلك إذا لغيت البطولة.
      </T>
      <View style={styles.row}>
        <TextInput value={prize} onChangeText={(x) => setPrize(digits(x))} keyboardType="number-pad" placeholder="🪙 عملات" placeholderTextColor={colors.textDim} style={[styles.input, { flex: 1 }]} />
        <TextInput value={gemsPrize} onChangeText={(x) => setGemsPrize(digits(x))} keyboardType="number-pad" placeholder="💎 جواهر" placeholderTextColor={colors.textDim} style={[styles.input, { flex: 1 }]} />
      </View>
      {!!msg && <T w="bold" style={{ fontSize: 13, color: colors.peach }}>{msg}</T>}
      <PillButton label="اعمل البطولة" disabled={busy || title.trim().length < 2} onPress={make} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/tournaments')}>
        <T w="bold" style={{ fontSize: 13, color: colors.yellow, textAlign: 'center' }}>كل البطولات ←</T>
      </Pressable>
    </View>
  );
}

// الناس المسموحلهم يعملوا بطولات ويديروها
function OrganizerTools() {
  const [list, setList] = useState<Organizer[]>([]);
  const [id, setId] = useState('');
  const [msg, setMsg] = useState('');
  useFocusEffect(
    useCallback(() => {
      listOrganizers()
        .then(setList)
        .catch(() => {});
    }, []),
  );
  const change = async (pid: number, on: boolean) => {
    setMsg('');
    try {
      await setOrganizer(pid, on);
      setList(await listOrganizers());
      if (on) setId('');
    } catch (e) {
      const t = errorText(e);
      setMsg(t.includes('not found') ? 'ما في لاعب بهالرقم' : t);
    }
  };
  return (
    <View style={styles.card}>
      <T w="black" style={styles.title}>🎖️ منظّمين البطولات</T>
      <T style={{ fontSize: 12, color: colors.textMuted }}>
        بيقدروا يعملوا بطولات بكل الألعاب، ويبلّشوها ويلغوها ويحسموا مبارياتها (بطولاتهم بس). الجائزة من رصيدهم.
      </T>
      <View style={styles.row}>
        <TextInput value={id} onChangeText={(x) => setId(digits(x))} keyboardType="number-pad" placeholder="رقم الـ ID" placeholderTextColor={colors.textDim} style={[styles.input, { flex: 1 }]} />
        <Pressable accessibilityRole="button" disabled={!id} onPress={() => change(num(id), true)} style={[styles.small, !id && { opacity: 0.5 }]}>
          <T w="black" style={{ color: colors.ink }}>ضيف</T>
        </Pressable>
      </View>
      {!!msg && <T w="bold" style={{ fontSize: 13, color: colors.peach }}>{msg}</T>}
      {list.length === 0 && <T style={{ fontSize: 13, color: colors.textDim }}>لسا ما في منظّمين</T>}
      {list.map((o) => (
        <View key={o.pid} style={styles.row}>
          <Avatar avatar={o.avatar} size={34} />
          <View style={{ flex: 1 }}>
            <T w="black" style={{ fontSize: 14 }}>🎖️ {o.name || 'لاعب'}</T>
            <T style={{ fontSize: 12, color: colors.textMuted }}>ID {ar(o.pid)}</T>
          </View>
          <Pressable accessibilityRole="button" onPress={() => change(o.pid, false)} style={[styles.small, { height: 34, backgroundColor: colors.surfaceHigh }]}>
            <T w="black" style={{ fontSize: 12 }}>شيل</T>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function RoomTools() {
  const [room, setRoom] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const del = async () => {
    if (!confirm) return setConfirm(true);
    setMsg('');
    try {
      await adminDeleteRoom(num(room));
      setMsg('✅ انحذفت الغرفة');
      setRoom('');
    } catch (e) {
      const t = errorText(e);
      setMsg(t.includes('not found') ? 'ما في غرفة بهالرقم' : t);
    } finally {
      setConfirm(false);
    }
  };
  return (
    <View style={styles.card}>
      <T w="black" style={styles.title}>🎙️ غرفة</T>
      <T style={{ fontSize: 12, color: colors.textMuted }}>إنت مشرف بكل الغرف: ادخل أي غرفة وبتقدر تكتم وتنزّل وتطرد وتفتح ألعاب.</T>
      <View style={styles.row}>
        <TextInput value={room} onChangeText={(x) => setRoom(digits(x))} keyboardType="number-pad" placeholder="رقم الغرفة" placeholderTextColor={colors.textDim} style={[styles.input, { flex: 1 }]} />
        <Pressable accessibilityRole="button" disabled={!room} onPress={del} style={[styles.small, { backgroundColor: confirm ? colors.alert : colors.coral }, !room && { opacity: 0.5 }]}>
          <T w="black">{confirm ? 'متأكد؟' : 'احذفها'}</T>
        </Pressable>
      </View>
      {!!msg && <T w="bold" style={{ fontSize: 13, color: msg.startsWith('✅') ? '#2ECC71' : colors.peach }}>{msg}</T>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 28, lineHeight: 38 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: 12, borderRadius: 16, backgroundColor: colors.surface },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '31%', flexGrow: 1, padding: 10, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center' },
  card: { padding: 14, borderRadius: 20, backgroundColor: colors.surface, gap: 10 },
  title: { fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.bg,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right',
  },
  small: { height: 46, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  ban: { flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  gameChip: { height: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surfaceHigh, justifyContent: 'center' },
  chip: { width: 48, height: 38, borderRadius: 12, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
});
