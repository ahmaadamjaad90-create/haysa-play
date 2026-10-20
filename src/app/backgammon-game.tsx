import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { BgBoard, CHECKER } from '@/components/BgBoard';
import { BackIcon, CopyIcon } from '@/components/Icons';
import { Dice } from '@/components/LudoBoard';
import { GameTalk } from '@/components/GameTalk';
import { PillButton, Screen, T } from '@/components/ui';
import {
  addBgBot,
  barOf,
  leaveBg,
  moveBg,
  myBgResult,
  offOf,
  playBgVsBot,
  rollBg,
  startBg,
  tickBg,
  useBgGame,
  type BgGame,
  type BgPlayer,
} from '@/lib/backgammon';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/backgammon'));

export default function BackgammonGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, uid, loading } = useSession();
  const { game, error, apply } = useBgGame(Number(id));

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
      {game && <GameTalk game="backgammon" id={game.id} players={game.players} uid={uid} finished={game.status === 'finished'} />}
    </Screen>
  );
}

type Apply = (g: BgGame | void) => void;

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

function Waiting({ game, uid, apply }: { game: BgGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const act = async (fn: () => Promise<BgGame>) => {
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
        title="طاولة الزهر"
        onBack={async () => {
          await leaveBg(game.id).catch(() => {});
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
          <T w="bold" style={{ fontSize: 13, color: colors.textSoft }}>
            {copied ? 'انتسخ ✓' : 'ابعته لصاحبك عشان يدخل من صفحة طاولة الزهر'}
          </T>
        </Pressable>

        <View style={styles.slots}>
          {[0, 1].map((i) => {
            const p = game.players[i];
            return (
              <View key={i} style={styles.slot}>
                {p ? (
                  <>
                    <View style={[styles.slotRing, { borderColor: CHECKER[i].fill }]}>
                      <Avatar avatar={p.avatar} size={60} />
                    </View>
                    <T w="black" style={{ fontSize: 14 }} numberOfLines={1}>
                      {p.bot ? `🤖 ${p.name}` : p.uid === uid ? 'إنت' : p.name}
                    </T>
                  </>
                ) : (
                  <>
                    <View style={styles.emptySlot}>
                      <T w="black" style={{ fontSize: 24, color: colors.textDim }}>+</T>
                    </View>
                    <T style={{ fontSize: 12, color: colors.textDim }}>بنستنى</T>
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
              {game.players.length < 2 && (
                <PillButton label="العب ضد الكمبيوتر 🤖" bg={colors.surface} fg={colors.white} disabled={busy} onPress={() => act(() => addBgBot(game.id))} />
              )}
              <PillButton
                label={game.players.length < 2 ? 'بنستنى لاعب تاني...' : 'ابدأ اللعب'}
                disabled={busy || game.players.length < 2}
                onPress={() => act(() => startBg(game.id))}
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

function Play({ game, uid, apply }: { game: BgGame; uid: string | null; apply: Apply }) {
  const { width } = useWindowDimensions();
  const { setBalance } = useSession();
  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;
  const mySeat = me?.seat ?? null;
  const myTurn = game.status === 'playing' && mySeat !== null && game.turn === mySeat;
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);
  const size = Math.min(width - 24, 470);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1200) {
        lastTick.current = t;
        tickBg(game.id).then(apply).catch(() => {});
      }
    }, 400);
    return () => clearInterval(timer);
  }, [game.status, game.deadline, game.id, apply]);

  const act = async (fn: () => Promise<BgGame>) => {
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

  const legal = myTurn && game.phase === 'move' ? game.legal : [];
  const sources = new Set(legal.map((m) => m[0]));
  const targets = new Set(selected !== null ? legal.filter((m) => m[0] === selected).map((m) => m[1]) : []);

  // لمسة: أول وحدة بتختار الحجر، والتانية بتحرّكه
  const tap = (p: number) => {
    if (!myTurn || busy || game.phase !== 'move') return;
    if (selected !== null && targets.has(p)) {
      const from = selected;
      setSelected(null);
      act(() => moveBg(game.id, from, p));
      return;
    }
    setSelected(sources.has(p) ? (selected === p ? null : p) : null);
  };

  const onBack = async () => {
    if (game.status !== 'playing' || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveBg(game.id).catch(() => {});
    back();
  };

  const opp = game.players.find((p) => p.seat !== mySeat) ?? game.players[1];
  const mine = me ?? game.players[0];
  const secs = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;
  // الزهر المستعمل بيبين باهت
  const remaining = [...game.dice];
  const diceView = (game.rolled.length === 2 && game.rolled[0] === game.rolled[1]
    ? [game.rolled[0], game.rolled[0], game.rolled[0], game.rolled[0]]
    : game.rolled
  ).map((v) => {
    const i = remaining.indexOf(v);
    if (i >= 0) {
      remaining.splice(i, 1);
      return { v, used: false };
    }
    return { v, used: true };
  });
  const showDice = game.phase === 'move' || !!game.last?.roll;

  return (
    <>
      <Header title="طاولة الزهر" onBack={onBack} />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت بتخسر الجولة. اضغط رجوع كمان مرة للتأكيد</T>}

      <PlayerBar p={opp} active={game.turn === opp?.seat && game.status === 'playing'} off={opp ? game.off[opp.seat] : 0} me={false} />

      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <BgBoard game={game} width={size} mySeat={mySeat} selected={selected} sources={sources} targets={targets} onTap={tap} />
      </View>

      <PlayerBar p={mine} active={myTurn} off={mine ? game.off[mine.seat] : 0} me />

      <View style={styles.diceRow}>
        {showDice && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {diceView.map((d, i) => (
              <View key={i} style={{ opacity: d.used && game.phase === 'move' ? 0.3 : 1 }}>
                <Dice value={d.v} size={diceView.length > 2 ? 34 : 44} />
              </View>
            ))}
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w="heading" style={{ fontSize: 20, lineHeight: 28, color: myTurn ? colors.yellow : colors.white }}>
            {game.status !== 'playing'
              ? ''
              : myTurn
                ? game.phase === 'roll'
                  ? 'دورك! ارمِ الزهر'
                  : selected !== null
                    ? 'وين بدك تحطّه؟'
                    : 'اختار حجر تحرّكه'
                : `دور ${opp?.name ?? ''}`}
          </T>
          {game.status === 'playing' && <T style={{ fontSize: 12, color: colors.textMuted }}>باقي {ar(secs)} ثانية</T>}
        </View>
      </View>
      {myTurn && game.phase === 'roll' && (
        <PillButton label="ارمِ الزهر 🎲" disabled={busy} onPress={() => act(() => rollBg(game.id))} style={{ marginHorizontal: 20, marginTop: 8 }} />
      )}
      {myTurn && game.phase === 'move' && targets.has(mySeat !== null ? offOf(mySeat) : -1) && (
        <PillButton label="طلّع الحجر برا ⬆️" disabled={busy} onPress={() => tap(offOf(mySeat ?? 0))} style={{ marginHorizontal: 20, marginTop: 8 }} />
      )}
      {myTurn && game.phase === 'move' && sources.has(mySeat !== null ? barOf(mySeat) : -1) && selected === null && (
        <T w="bold" style={styles.hint}>عندك حجر عالبار، لازم تدخّله أول: اضغط عالبار بالنص</T>
      )}
      <T w="bold" style={styles.status}>{statusText(game, uid)}</T>
      {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

      {game.status === 'finished' && <Finished game={game} uid={uid} onBalance={setBalance} />}
    </>
  );
}

function PlayerBar({ p, active, off, me }: { p?: BgPlayer; active: boolean; off: number; me: boolean }) {
  if (!p) return null;
  return (
    <View style={[styles.pbar, active && styles.pbarOn]}>
      <View style={[styles.dot, { backgroundColor: CHECKER[p.seat].fill, borderColor: CHECKER[p.seat].ring }]} />
      <Avatar avatar={p.avatar} size={30} />
      <T w="black" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
        {p.bot ? `🤖 ${p.name}` : me ? 'إنت' : p.name}
      </T>
      <T w="bold" style={{ fontSize: 12, color: colors.textMuted }}>طلّع {ar(off)} من 15</T>
    </View>
  );
}

function statusText(g: BgGame, uid: string | null) {
  const l = g.last;
  if (!l) return 'اللي بيطلّع أحجاره الـ15 أول بيربح';
  const p = g.players.find((x) => x.seat === l.seat);
  const mine = p?.uid === uid;
  const who = p?.name ?? '';
  const roll = l.roll ? ar(l.roll.join(' و ')) : '';
  if (l.stuck) return mine ? `رميت ${roll}، وما في حركة 😕` : `${who} رمى ${roll}، وما في حركة`;
  if (l.hit) return mine ? 'أكلت حجر! 💥' : `💥 ${who} أكل حجرك!`;
  if (l.to === 0 || l.to === 25) return mine ? 'طلّعت حجر برا ⬆️' : `${who} طلّع حجر برا`;
  if (l.from !== undefined) return mine ? 'حرّكت حجر' : `${who} حرّك حجر`;
  return mine ? `رميت ${roll}` : `${who} رمى ${roll}`;
}

function Finished({ game, uid, onBalance }: { game: BgGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const winner = game.players.find((p) => p.seat === game.winner);
  const iWon = !!winner && winner.uid === uid;
  const [reward, setReward] = useState<{ coins: number; xp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const vsBot = game.players.some((p) => p.bot);

  useEffect(() => {
    if (!uid) return;
    myBgResult(game.id, uid).then((r) => r && setReward(r));
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
        <T style={{ fontSize: 56, lineHeight: 70 }}>{iWon ? '🏆' : '🎲'}</T>
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
            label={vsBot ? 'جولة كمان ضد الكمبيوتر' : 'صالة طاولة الزهر'}
            disabled={busy}
            onPress={async () => {
              if (!vsBot) return router.replace('/backgammon');
              setBusy(true);
              try {
                const id = await playBgVsBot();
                router.replace({ pathname: '/backgammon-game', params: { id: String(id) } });
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
    backgroundColor: '#8A4E2C',
    alignItems: 'center',
    gap: 2,
  },
  slots: { marginTop: 18, marginHorizontal: 40, flexDirection: 'row', justifyContent: 'space-around' },
  slot: { width: '40%', alignItems: 'center', gap: 6 },
  slotRing: { padding: 3, borderRadius: 40, borderWidth: 4 },
  emptySlot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wait: { textAlign: 'center', fontSize: 15, color: colors.textMuted },
  msg: { marginTop: 6, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  pbar: {
    marginTop: 8,
    marginHorizontal: 12,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pbarOn: { borderColor: colors.yellow, backgroundColor: '#3A1D72' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  diceRow: { marginTop: 10, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { marginTop: 6, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.yellow },
  status: { marginTop: 8, marginHorizontal: 20, textAlign: 'center', fontSize: 14, color: colors.textSoft },
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
