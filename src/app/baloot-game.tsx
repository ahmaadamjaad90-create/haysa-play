import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { BackIcon, CopyIcon } from '@/components/Icons';
import { CardBackSmall, PlayingCard, SUITS } from '@/components/PlayingCard';
import { PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import {
  KIND_NAMES,
  TARGET,
  addBalootBot,
  bidBaloot,
  leaveBaloot,
  myBalootResult,
  playBaloot,
  playBalootVsBots,
  startBaloot,
  teamOf,
  tickBaloot,
  useBalootGame,
  type BalootGame,
  type BalootPlayer,
  type Suit,
} from '@/lib/baloot';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/baloot'));

export default function BalootGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, uid, loading } = useSession();
  const { game, hand, legal, error, apply } = useBalootGame(Number(id), uid);

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
        <Play game={game} hand={hand} legal={legal} uid={uid} apply={apply} />
      )}
    </Screen>
  );
}

type Apply = (g: BalootGame | void) => void;

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

function Waiting({ game, uid, apply }: { game: BalootGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const n = game.players.length;

  const act = async (fn: () => Promise<BalootGame>) => {
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

  return (
    <>
      <Header
        title="طاولة بلوت"
        onBack={async () => {
          await leaveBaloot(game.id).catch(() => {});
          back();
        }}
      />
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
          <T w="bold" style={{ fontSize: 14, color: colors.textSoft }}>رقم الطاولة</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T w="heading" style={{ fontSize: 44, lineHeight: 56 }}>{ar(game.id)}</T>
            <CopyIcon size={20} />
          </View>
          <T w="bold" style={{ fontSize: 13, color: colors.textSoft }}>{copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة البلوت'}</T>
        </Pressable>

        <T w="bold" style={styles.note}>المقعد 1 و3 فريق، و2 و4 فريق</T>
        <View style={styles.slots}>
          {[0, 1, 2, 3].map((i) => {
            const p = game.players[i];
            return (
              <View key={i} style={styles.slot}>
                <T w="black" style={{ fontSize: 11, color: i % 2 === 0 ? colors.yellow : colors.sky }}>
                  {i % 2 === 0 ? 'الفريق الأول' : 'الفريق التاني'}
                </T>
                {p ? (
                  <>
                    <View style={[styles.slotRing, { borderColor: i % 2 === 0 ? colors.yellow : colors.sky }]}>
                      <Avatar avatar={p.avatar} size={48} />
                    </View>
                    <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>{p.bot ? `🤖 ${p.name}` : p.uid === uid ? 'إنت' : p.name}</T>
                  </>
                ) : (
                  <View style={styles.emptySlot}>
                    <T w="black" style={{ fontSize: 22, color: colors.textDim }}>+</T>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}
        <View style={{ marginTop: 16, marginHorizontal: 20, gap: 10 }}>
          {isHost ? (
            <>
              {n < 4 && <PillButton label="ضيف كمبيوتر 🤖" bg={colors.surface} fg={colors.white} disabled={busy} onPress={() => act(() => addBalootBot(game.id))} />}
              <PillButton label={n < 4 ? `بنستنى (${ar(n)} من 4)` : 'ابدأ اللعب'} disabled={busy || n < 4} onPress={() => act(() => startBaloot(game.id))} />
            </>
          ) : (
            <T style={styles.wait}>بنستنى صاحب الطاولة يبدأ...</T>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function Play({ game, hand, legal, uid, apply }: { game: BalootGame; hand: string[]; legal: string[]; uid: string | null; apply: Apply }) {
  const { setBalance } = useSession();
  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;
  const mySeat = me?.seat ?? 0;
  const myTurn = game.status === 'playing' && !!me && game.turn === mySeat;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1200) {
        lastTick.current = t;
        tickBaloot(game.id).then(apply).catch(() => {});
      }
    }, 400);
    return () => clearInterval(timer);
  }, [game.status, game.deadline, game.id, apply]);

  const act = async (fn: () => Promise<BalootGame>) => {
    setBusy(true);
    setMsg('');
    try {
      apply(await fn());
    } catch (e) {
      const t = errorText(e);
      if (!t.includes('not your turn')) setMsg(t);
    } finally {
      setBusy(false);
    }
  };

  const onBack = async () => {
    if (game.status !== 'playing' || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveBaloot(game.id).catch(() => {});
    back();
  };

  // مكان كل لاعب حوالين الطاولة: أنا تحت، شريكي فوق
  const rel = (seat: number) => (seat - mySeat + 4) % 4;
  const at = (r: number) => game.players.find((p) => rel(p.seat) === r);
  const myTeam = teamOf(mySeat);
  const secs = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;

  // آخر لمّة بتضل ظاهرة شوي لحد ما تبلّش الجديدة
  const showTrick = game.trick.length ? game.trick : game.phase === 'play' && game.last_trick ? game.last_trick.cards : [];
  const bidding = game.phase === 'bid1' || game.phase === 'bid2';
  const faceSuit = game.face ? (game.face[0] as Suit) : null;

  return (
    <>
      <Header title="بلوت" onBack={onBack} />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت، الكمبيوتر بيكمّل عنك. اضغط رجوع كمان مرة للتأكيد</T>}

      <View style={styles.scoreRow}>
        <View style={[styles.scoreBox, { borderColor: colors.yellow }]}>
          <T w="heading" style={{ fontSize: 24, lineHeight: 30 }}>{ar(game.scores[myTeam])}</T>
          <T w="bold" style={{ fontSize: 11, color: colors.textMuted }}>لنا</T>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T w="bold" style={{ fontSize: 12, color: colors.textMuted }}>الجولة {ar(game.round)} · لـ {ar(TARGET)}</T>
          {game.kind && !bidding && (
            <T w="black" style={{ fontSize: 14 }}>
              {KIND_NAMES[game.kind]}
              {game.trump && (
                <>
                  {' · '}
                  <T style={{ color: SUITS[game.trump].red ? colors.coral : colors.white }}>{SUITS[game.trump].sym}</T> {SUITS[game.trump].name}
                </>
              )}
            </T>
          )}
          {game.buyer !== null && !bidding && (
            <T w="bold" style={{ fontSize: 12, color: colors.yellow }}>المشتري: {nameOf(game, game.buyer, uid)}</T>
          )}
        </View>
        <View style={[styles.scoreBox, { borderColor: colors.sky }]}>
          <T w="heading" style={{ fontSize: 24, lineHeight: 30 }}>{ar(game.scores[1 - myTeam])}</T>
          <T w="bold" style={{ fontSize: 11, color: colors.textMuted }}>لهم</T>
        </View>
      </View>

      <View style={styles.table}>
        <Seat p={at(2)} game={game} pos="top" uid={uid} />
        <View style={styles.middle}>
          <Seat p={at(1)} game={game} pos="side" uid={uid} />
          <View style={styles.trick}>
            {[2, 1, 3, 0].map((r) => {
              const c = showTrick.find((x) => rel(x.seat) === r);
              return (
                <View key={r} style={[styles.trickSlot, styles[`t${r}` as 't0']]}>
                  {c && <PlayingCard card={c.card} width={40} />}
                </View>
              );
            })}
            {bidding && game.face && (
              <View style={styles.face}>
                <PlayingCard card={game.face} width={46} glow />
                <T w="black" style={{ fontSize: 10, color: '#E8F5E9' }}>المكشوفة</T>
              </View>
            )}
          </View>
          <Seat p={at(3)} game={game} pos="side" uid={uid} />
        </View>
        {game.phase === 'play' && (
          <T w="bold" style={styles.taken}>أبناط: لنا {ar(game.abnat[myTeam])} · لهم {ar(game.abnat[1 - myTeam])}</T>
        )}
      </View>

      {game.status === 'playing' && (
        <View style={styles.action}>
          {bidding ? (
            myTurn ? (
              <>
                <T w="black" style={{ fontSize: 15 }}>
                  {game.phase === 'bid1' ? 'دورك تشتري' : 'الشرا التاني'} · {ar(secs)} ث
                </T>
                <View style={styles.bidRow}>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => act(() => bidBaloot(game.id, 'sun'))} style={styles.kindBtn}>
                    <T w="black" style={{ fontSize: 16, color: colors.ink }}>صن ☀️</T>
                  </Pressable>
                  {game.phase === 'bid1' && !game.kind && (
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => act(() => bidBaloot(game.id, 'hokm'))} style={styles.kindBtn}>
                      <T w="black" style={{ fontSize: 16, color: colors.ink }}>حكم</T>
                    </Pressable>
                  )}
                </View>
                {game.phase === 'bid2' && !game.kind && (
                  <View style={styles.bidRow}>
                    {(['s', 'h', 'd', 'c'] as Suit[])
                      .filter((su) => su !== faceSuit)
                      .map((su) => (
                        <Pressable key={su} accessibilityRole="button" disabled={busy} onPress={() => act(() => bidBaloot(game.id, `hokm:${su}`))} style={styles.suitBtn}>
                          <T style={{ fontSize: 22, color: SUITS[su].red ? colors.coral : colors.ink }}>{SUITS[su].sym}</T>
                          <T w="bold" style={{ fontSize: 10, color: colors.ink }}>حكم {SUITS[su].name}</T>
                        </Pressable>
                      ))}
                  </View>
                )}
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => act(() => bidBaloot(game.id, 'pass'))} style={styles.pass}>
                  <T w="black" style={{ fontSize: 14 }}>بس</T>
                </Pressable>
              </>
            ) : (
              <T w="black" style={{ fontSize: 15 }}>
                {game.phase === 'bid1' ? 'الشرا' : 'الشرا التاني'}: دور {nameOf(game, game.turn, uid)}
              </T>
            )
          ) : game.phase === 'play' ? (
            <T w="black" style={{ fontSize: 15, color: myTurn ? colors.yellow : colors.white }}>
              {myTurn ? `دورك! نزّل ورقة · ${ar(secs)} ث` : `دور ${nameOf(game, game.turn, uid)}`}
            </T>
          ) : game.result ? (
            <RoundResult game={game} myTeam={myTeam} uid={uid} />
          ) : null}
        </View>
      )}
      {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>
        {hand.map((c, i) => {
          const ok = myTurn && game.phase === 'play' && legal.includes(c);
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`ورقة ${c}`}
              disabled={!ok || busy}
              onPress={() => act(() => playBaloot(game.id, c))}
              style={i > 0 && { marginStart: -14 }}>
              <PlayingCard card={c} width={50} glow={ok} dim={myTurn && game.phase === 'play' && !ok} />
            </Pressable>
          );
        })}
      </ScrollView>

      {game.status === 'finished' && <Finished game={game} uid={uid} mySeat={mySeat} onBalance={setBalance} />}
    </>
  );
}

function nameOf(g: BalootGame, seat: number | null, uid: string | null) {
  const p = g.players.find((x) => x.seat === seat);
  return p ? (p.uid === uid ? 'إنت' : p.name) : '';
}

function bidLabel(b: string) {
  if (b === 'pass') return 'بس';
  if (b === 'sun') return 'صن';
  if (b === 'hokm') return 'حكم';
  return `حكم ${SUITS[b.slice(5) as Suit].sym}`;
}

// نتيجة الجولة: مين اشترى، جاب ولا لأ، والمشاريع
function RoundResult({ game, myTeam, uid }: { game: BalootGame; myTeam: number; uid: string | null }) {
  const r = game.result!;
  const ours = teamOf(r.buyer) === myTeam;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <T w="heading" style={{ fontSize: 17, lineHeight: 25, textAlign: 'center' }}>
        {r.made ? '✅' : '❌'} {ours ? 'فريقكم' : 'فريقهم'} {r.made ? 'جاب' : 'ما جاب'} ال{KIND_NAMES[r.kind]}
      </T>
      <T w="black" style={{ fontSize: 15 }}>
        لنا +{ar(r.gain[myTeam])} · لهم +{ar(r.gain[1 - myTeam])}
      </T>
      {game.projects.length > 0 && (
        <T w="bold" style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
          مشاريع: {game.projects.map((p) => `${p.name} (${nameOf(game, p.seat, uid)})`).join('، ')}
        </T>
      )}
    </View>
  );
}

function Seat({ p, game, pos, uid }: { p?: BalootPlayer; game: BalootGame; pos: 'top' | 'side'; uid: string | null }) {
  if (!p) return <View style={{ width: 64 }} />;
  const active = game.turn === p.seat && game.status === 'playing';
  const bid = game.bids[String(p.seat)];
  return (
    <View style={[styles.seat, pos === 'top' && { alignSelf: 'center' }, active && styles.seatOn, p.left && { opacity: 0.5 }]}>
      <Avatar avatar={p.avatar} size={32} />
      <T w="black" style={{ fontSize: 11 }} numberOfLines={1}>{p.bot || p.left ? '🤖 ' : ''}{p.uid === uid ? 'إنت' : p.name}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <CardBackSmall width={10} />
        <T w="bold" style={{ fontSize: 10, color: colors.textMuted }}>{ar(p.count)}</T>
      </View>
      {(game.phase === 'bid1' || game.phase === 'bid2') && bid !== undefined && (
        <T w="black" style={{ fontSize: 10, color: bid !== 'pass' ? colors.yellow : colors.textDim }}>{bidLabel(bid)}</T>
      )}
      {game.dealer === p.seat && <T style={{ fontSize: 10 }}>🃏 موزّع</T>}
    </View>
  );
}

function Finished({ game, uid, mySeat, onBalance }: { game: BalootGame; uid: string | null; mySeat: number; onBalance: (c: number, g: number) => void }) {
  const [reward, setReward] = useState<{ won: boolean; coins: number; xp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const iWon = game.winner === teamOf(mySeat);
  const vsBots = game.players.filter((p) => !p.bot).length === 1;

  useEffect(() => {
    if (!uid) return;
    myBalootResult(game.id, uid).then((r) => r && setReward(r));
    supabase
      .from('profiles')
      .select('coins, gems')
      .eq('id', uid)
      .single<{ coins: number; gems: number }>()
      .then(({ data }) => data && onBalance(data.coins, data.gems));
    // onBalance بيتغير كل رندر، والجلب مرة وحدة آخر اللعبة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, uid]);

  return (
    <View style={styles.finishBackdrop}>
      <View style={styles.finishCard}>
        <T style={{ fontSize: 56, lineHeight: 70 }}>{iWon ? '🏆' : '🃏'}</T>
        <T w="heading" style={{ fontSize: 28, lineHeight: 38, textAlign: 'center' }}>{iWon ? 'فريقكم ربح!' : 'فريقهم ربح'}</T>
        <T w="black" style={{ fontSize: 16 }}>{ar(game.scores[teamOf(mySeat)])} - {ar(game.scores[1 - teamOf(mySeat)])}</T>
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
            label={vsBots ? 'لعبة كمان ضد الكمبيوتر' : 'صالة البلوت'}
            disabled={busy}
            onPress={async () => {
              if (!vsBots) return router.replace('/baloot');
              setBusy(true);
              try {
                const id = await playBalootVsBots();
                router.replace({ pathname: '/baloot-game', params: { id: String(id) } });
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
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 28, lineHeight: 38 },
  confirm: { marginTop: 6, marginHorizontal: 20, fontSize: 13, color: colors.peach, textAlign: 'center' },
  codeCard: { marginTop: 12, marginHorizontal: 20, padding: 18, borderRadius: 24, backgroundColor: '#1F6B4A', alignItems: 'center', gap: 2 },
  note: { marginTop: 14, textAlign: 'center', fontSize: 13, color: colors.textMuted },
  slots: { marginTop: 10, marginHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between' },
  slot: { width: '24%', alignItems: 'center', gap: 4 },
  slotRing: { padding: 3, borderRadius: 32, borderWidth: 3 },
  emptySlot: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wait: { textAlign: 'center', fontSize: 15, color: colors.textMuted },
  msg: { marginTop: 6, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  scoreRow: { marginTop: 8, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBox: { width: 62, height: 56, borderRadius: 18, borderWidth: 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  table: { marginTop: 8, marginHorizontal: 12, padding: 10, borderRadius: 28, backgroundColor: '#1F6B4A', borderWidth: 4, borderColor: '#8A4E2C', gap: 6 },
  middle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trick: { width: 150, height: 150 },
  trickSlot: { position: 'absolute' },
  t0: { bottom: 0, left: 55 },
  t2: { top: 0, left: 55 },
  t1: { right: 0, top: 46 },
  t3: { left: 0, top: 46 },
  taken: { textAlign: 'center', fontSize: 12, color: '#E8F5E9' },
  seat: { width: 72, paddingVertical: 6, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', gap: 2 },
  seatOn: { borderColor: colors.yellow },
  action: { marginTop: 10, marginHorizontal: 20, alignItems: 'center', gap: 8 },
  bidRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  kindBtn: { minWidth: 96, height: 50, paddingHorizontal: 18, borderRadius: 18, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  face: { position: 'absolute', top: 30, left: 52, alignItems: 'center', gap: 2 },
  suitBtn: { width: 70, height: 60, borderRadius: 18, backgroundColor: '#F7F1FF', alignItems: 'center', justifyContent: 'center' },
  pass: { height: 38, paddingHorizontal: 24, borderRadius: 19, backgroundColor: colors.surface, justifyContent: 'center' },
  hand: { paddingHorizontal: 30, paddingTop: 22, paddingBottom: 14, alignItems: 'flex-end' },
  finishBackdrop: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(10,3,24,0.75)', justifyContent: 'center', padding: 24 },
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
