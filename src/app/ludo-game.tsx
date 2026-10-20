import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { BackIcon, CopyIcon } from '@/components/Icons';
import { Dice, LudoBoard } from '@/components/LudoBoard';
import { PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import {
  SEAT_COLORS,
  addBot,
  leaveGame,
  legalTokens,
  moveToken,
  myResult,
  playVsBot,
  rollDice,
  startGame,
  tickGame,
  useLudoGame,
  type LudoGame,
  type LudoPlayer,
} from '@/lib/ludo';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

export default function LudoGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gid = Number(id);
  const { user, uid, loading } = useSession();
  const { game, error, apply } = useLudoGame(gid);

  if (!loading && !user) return <Redirect href="/login" />;

  return (
    <Screen>
      {!game ? (
        <View style={styles.center}>
          <T style={{ color: colors.textMuted }}>{error ? errorText(error) : 'لحظة...'}</T>
        </View>
      ) : game.status === 'waiting' ? (
        <Waiting game={game} uid={uid} apply={apply} />
      ) : (
        <Play game={game} uid={uid} apply={apply} />
      )}
    </Screen>
  );
}

type Apply = (g: LudoGame | void) => void;

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={onBack} style={styles.back}>
        <BackIcon />
      </Pressable>
      <T w="heading" style={styles.h1}>{title}</T>
    </View>
  );
}

const back = () => (router.canGoBack() ? router.back() : router.replace('/ludo'));

// ===== قبل ما يبلّش =====

function Waiting({ game, uid, apply }: { game: LudoGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const inGame = game.players.some((p) => p.uid === uid);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const act = async (fn: () => Promise<LudoGame | void>) => {
    setBusy(true);
    setMsg('');
    try {
      apply(await fn());
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (inGame) await leaveGame(game.id).catch(() => {});
    back();
  };

  return (
    <>
      <Header title="طاولة لودو" onBack={leave} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="نسخ رقم الطاولة"
          onPress={async () => {
            await Clipboard.setStringAsync(String(game.id));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          style={styles.codeCard}>
          <T w="bold" style={{ fontSize: 14, color: colors.ink }}>رقم الطاولة</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T w="heading" style={{ fontSize: 44, lineHeight: 56, color: colors.ink }}>{ar(game.id)}</T>
            <CopyIcon size={20} color={colors.ink} />
          </View>
          <T w="bold" style={{ fontSize: 13, color: colors.ink }}>
            {copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة لودو'}
          </T>
        </Pressable>

        <View style={styles.slots}>
          {[0, 1, 2, 3].map((i) => {
            const p = game.players[i];
            return (
              <View key={i} style={styles.slot}>
                {p ? (
                  <>
                    <View style={[styles.slotRing, { borderColor: SEAT_COLORS[seatFor(game.players.length, i)] }]}>
                      <Avatar avatar={p.avatar} size={52} />
                    </View>
                    <T w="black" style={{ fontSize: 13 }} numberOfLines={1}>
                      {p.bot ? `🤖 ${p.name}` : p.name}
                    </T>
                    {p.uid === game.host && <T w="bold" style={{ fontSize: 11, color: colors.yellow }}>صاحب الطاولة</T>}
                  </>
                ) : (
                  <>
                    <View style={styles.emptySlot}>
                      <T w="black" style={{ fontSize: 22, color: colors.textDim }}>+</T>
                    </View>
                    <T style={{ fontSize: 12, color: colors.textDim }}>فاضي</T>
                  </>
                )}
              </View>
            );
          })}
        </View>

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

        <View style={{ marginTop: 16, marginHorizontal: 20, gap: 10 }}>
          {isHost ? (
            <>
              {game.players.length < 4 && (
                <PillButton label="ضيف كمبيوتر 🤖" bg={colors.surface} fg={colors.white} disabled={busy} onPress={() => act(() => addBot(game.id))} />
              )}
              <PillButton
                label={game.players.length < 2 ? 'بنستنى لاعب تاني...' : 'ابدأ اللعب'}
                disabled={busy || game.players.length < 2}
                onPress={() => act(() => startGame(game.id))}
              />
            </>
          ) : (
            <T style={styles.wait}>بنستنى صاحب الطاولة يبدأ...</T>
          )}
        </View>
      </ScrollView>
    </>
  );
}

// نفس توزيع السيرفر: لاعبين = ألوان متقابلة
function seatFor(n: number, i: number) {
  return (n === 2 ? [0, 2] : [0, 1, 2, 3])[i] ?? i;
}

// ===== اللعب =====

function Play({ game, uid, apply }: { game: LudoGame; uid: string | null; apply: Apply }) {
  const { width } = useWindowDimensions();
  const { setBalance } = useSession();
  const size = Math.min(width - 24, 456);
  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;
  const mySeat = me?.seat ?? null;
  const myTurn = game.status === 'playing' && mySeat !== null && game.turn === mySeat;
  const movable = myTurn ? legalTokens(game) : [];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  // العدّاد، ولما يخلص الوقت منطلب من السيرفر يلعب عن اللي عليه الدور
  useEffect(() => {
    if (game.status !== 'playing') return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1500) {
        lastTick.current = t;
        tickGame(game.id).then(apply).catch(() => {});
      }
    }, 400);
    return () => clearInterval(timer);
  }, [game.status, game.deadline, game.id, apply]);

  const act = async (fn: () => Promise<LudoGame>) => {
    setBusy(true);
    setMsg('');
    try {
      apply(await fn());
    } catch (e) {
      const t = errorText(e);
      if (!t.includes('not your turn') && !t.includes('already')) setMsg(t);
    } finally {
      setBusy(false);
    }
  };

  const onBack = async () => {
    if (game.status !== 'playing' || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveGame(game.id).catch(() => {});
    back();
  };

  const turnPlayer = game.players.find((p) => p.seat === game.turn);
  const left = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;
  const shownDice = game.last ? ('roll' in game.last ? game.last.roll : game.last.dice) : game.dice;
  const rollKey = `${game.updated_at}`;

  return (
    <>
      <Header title="لودو" onBack={onBack} />
      {confirmLeave && (
        <T w="bold" style={styles.confirm}>إذا طلعت بتخسر الجولة. اضغط رجوع كمان مرة للتأكيد</T>
      )}

      <View style={styles.players}>
        {game.players.map((p) => (
          <PlayerChip
            key={p.seat}
            p={p}
            active={p.seat === game.turn && game.status === 'playing'}
            seconds={p.seat === game.turn && !p.bot ? left : null}
            me={p.uid === uid}
          />
        ))}
      </View>

      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <LudoBoard
          game={game}
          size={size}
          mySeat={mySeat}
          movable={movable}
          onMove={(t) => !busy && act(() => moveToken(game.id, t))}
        />
      </View>

      <T w="bold" style={styles.status}>{statusText(game, uid)}</T>
      {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

      <View style={styles.diceRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ارمِ الزهر"
          disabled={!myTurn || game.phase !== 'roll' || busy}
          onPress={() => act(() => rollDice(game.id))}
          style={[
            styles.diceBtn,
            { borderColor: turnPlayer ? SEAT_COLORS[turnPlayer.seat] : colors.surface },
            myTurn && game.phase === 'roll' && styles.diceReady,
          ]}>
          <Dice value={shownDice} size={60} rolling={!!rollKey} key={rollKey} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w="heading" style={{ fontSize: 22, lineHeight: 30, color: myTurn ? colors.yellow : colors.white }}>
            {game.status !== 'playing' ? '' : myTurn ? (game.phase === 'roll' ? 'دورك! ارمِ الزهر' : 'اختار حجر') : turnPlayer ? `دور ${turnPlayer.name}` : ''}
          </T>
          {myTurn && <T style={{ fontSize: 13, color: colors.textMuted }}>باقي {ar(left)} ثانية</T>}
        </View>
      </View>

      {game.status === 'finished' && <Finished game={game} uid={uid} onBalance={setBalance} />}
    </>
  );
}

function PlayerChip({ p, active, seconds, me }: { p: LudoPlayer; active: boolean; seconds: number | null; me: boolean }) {
  return (
    <View style={[styles.chip, active && { borderColor: SEAT_COLORS[p.seat], backgroundColor: '#3A1D72' }, p.left && { opacity: 0.4 }]}>
      <View style={[styles.chipRing, { borderColor: SEAT_COLORS[p.seat] }]}>
        <Avatar avatar={p.avatar} size={30} />
      </View>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>
          {p.bot ? '🤖 ' : ''}{me ? 'أنت' : p.name}
        </T>
        {active && seconds !== null ? (
          <T w="bold" style={{ fontSize: 11, color: colors.yellow }}>{ar(seconds)} ث</T>
        ) : p.left ? (
          <T style={{ fontSize: 11, color: colors.textDim }}>طلع</T>
        ) : null}
      </View>
    </View>
  );
}

function nameOf(g: LudoGame, seat: number) {
  return g.players.find((x) => x.seat === seat)?.name ?? '';
}

// شو صار آخر شي
function statusText(g: LudoGame, uid: string | null) {
  const l = g.last;
  if (!l) return 'أول واحد بيرمي 6 بيطلّع حجر';
  const mine = g.players.find((x) => x.seat === l.seat)?.uid === uid;
  const who = nameOf(g, l.seat);
  // الفعل حسب إذا أنا ولا غيري
  const v = (meVerb: string, otherVerb: string) => (mine ? meVerb : `${who} ${otherVerb}`);
  if ('roll' in l) {
    if (l.three_sixes) return `${v('رميت', 'رمى')} 6 تلات مرات، راح الدور 😅`;
    const n = ar(l.roll);
    return g.turn === l.seat && g.phase === 'move' ? `${v('رميت', 'رمى')} ${n}` : `${v('رميت', 'رمى')} ${n}، ما في حركة`;
  }
  if (l.captured.length > 0) {
    const victim = g.players.find((x) => x.seat === l.captured[0].seat);
    const whose = victim?.uid === uid ? 'إلك' : (victim?.name ?? '');
    return `💥 ${v('أكلت', 'أكل')} حجر ${whose}!`;
  }
  if (l.to === 56) return `🏠 ${v('وصّلت', 'وصّل')} حجر للبيت!`;
  if (l.from === -1) return `${v('طلّعت', 'طلّع')} حجر جديد`;
  return `${v('مشيت', 'مشي')} ${ar(l.dice)}`;
}

function Finished({ game, uid, onBalance }: { game: LudoGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const winner = game.players.find((p) => p.seat === game.winner);
  const iWon = !!winner && winner.uid === uid;
  const [reward, setReward] = useState<{ coins: number; xp: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    myResult(game.id, uid).then((r) => r && setReward(r));
    supabase
      .from('profiles')
      .select('coins, gems')
      .eq('id', uid)
      .single<{ coins: number; gems: number }>()
      .then(({ data }) => data && onBalance(data.coins, data.gems));
    // onBalance بيتغير كل رندر، والجلب مرة وحدة آخر اللعبة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, uid]);

  const vsBot = game.players.some((p) => p.bot);

  return (
    <View style={styles.finishBackdrop}>
      <View style={styles.finishCard}>
        <T style={{ fontSize: 56, lineHeight: 70 }}>{iWon ? '🏆' : winner ? '🎲' : '👋'}</T>
        <T w="heading" style={{ fontSize: 30, lineHeight: 40, textAlign: 'center' }}>
          {iWon ? 'مبروك! ربحت' : winner ? `${winner.name} ربح!` : 'خلصت اللعبة'}
        </T>
        {reward && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={styles.rewardPill}>
              <T w="black" style={{ fontSize: 14 }}>+{ar(reward.xp)} XP</T>
            </View>
            {reward.coins > 0 && (
              <View style={styles.rewardPill}>
                <T w="black" style={{ fontSize: 14 }}>+{ar(reward.coins)} 🪙</T>
              </View>
            )}
          </View>
        )}
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
          <PillButton
            label={vsBot ? 'جولة كمان ضد الكمبيوتر' : 'صالة اللودو'}
            disabled={busy}
            onPress={async () => {
              if (!vsBot) return router.replace('/ludo');
              setBusy(true);
              try {
                const id = await playVsBot();
                router.replace({ pathname: '/ludo-game', params: { id: String(id) } });
              } finally {
                setBusy(false);
              }
            }}
          />
          <PillButton label="الرئيسية" bg={colors.surface} fg={colors.white} onPress={() => router.replace('/home')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { fontSize: 28, lineHeight: 38 },
  confirm: { marginTop: 6, marginHorizontal: 20, fontSize: 13, color: colors.peach, textAlign: 'center' },
  codeCard: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    gap: 2,
  },
  slots: { marginTop: 18, marginHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between' },
  slot: { width: '24%', alignItems: 'center', gap: 4 },
  slotRing: { padding: 3, borderRadius: 32, borderWidth: 3 },
  emptySlot: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wait: { textAlign: 'center', fontSize: 15, color: colors.textMuted },
  msg: { marginTop: 8, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  players: { marginTop: 8, marginHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: {
    width: '48%',
    maxWidth: 220,
    height: 46,
    paddingHorizontal: 8,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipRing: { borderRadius: 18, borderWidth: 2, padding: 1 },
  status: { marginTop: 10, marginHorizontal: 20, textAlign: 'center', fontSize: 14, color: colors.textSoft },
  diceRow: { marginTop: 10, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  diceBtn: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 3,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceReady: { backgroundColor: '#3A1D72', boxShadow: '0 0 0 4px rgba(255,201,60,0.45)' },
  finishBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    backgroundColor: 'rgba(10,3,24,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  finishCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.yellow,
    backgroundColor: '#24104A',
    alignItems: 'center',
    gap: 8,
  },
  rewardPill: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.purple, justifyContent: 'center' },
});
