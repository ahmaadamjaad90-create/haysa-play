import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { CardBack, ColorCard } from '@/components/ColorCard';
import { BackIcon, CopyIcon } from '@/components/Icons';
import { GameTalk } from '@/components/GameTalk';
import { PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import {
  CARD_COLORS,
  addColorsBot,
  drawCard,
  isWild,
  leaveColors,
  myColorsResult,
  playCard,
  playColorsVsBot,
  playable,
  startColors,
  tickColors,
  useColorsGame,
  type ColorKey,
  type ColorsGame,
  type ColorsPlayer,
} from '@/lib/colors';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { playSfx, useResultSound, useTurnSound } from '@/lib/sound';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/colors'));

export default function ColorsGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gid = Number(id);
  const { user, uid, loading } = useSession();
  const { game, hand, error, apply } = useColorsGame(gid, uid);

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
        <Play game={game} hand={hand} uid={uid} apply={apply} />
      )}
      {game && <GameTalk game="colors" id={game.id} players={game.players} uid={uid} finished={game.status === 'finished'} />}
    </Screen>
  );
}

type Apply = (g: ColorsGame | void) => void;

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

// ===== قبل ما يبلّش =====

function Waiting({ game, uid, apply }: { game: ColorsGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const act = async (fn: () => Promise<ColorsGame>) => {
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
        title="طاولة ألوان"
        onBack={async () => {
          await leaveColors(game.id).catch(() => {});
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
            {copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة ألوان'}
          </T>
        </Pressable>

        <View style={styles.slots}>
          {[0, 1, 2, 3].map((i) => {
            const p = game.players[i];
            return (
              <View key={i} style={styles.slot}>
                {p ? (
                  <>
                    <View style={[styles.slotRing, p.uid === game.host && { borderColor: colors.yellow }]}>
                      <Avatar avatar={p.avatar} size={52} />
                    </View>
                    <T w="black" style={{ fontSize: 13 }} numberOfLines={1}>
                      {p.bot ? `🤖 ${p.name}` : p.uid === uid ? 'إنت' : p.name}
                    </T>
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
                <PillButton label="ضيف كمبيوتر 🤖" bg={colors.surface} fg={colors.white} disabled={busy} onPress={() => act(() => addColorsBot(game.id))} />
              )}
              <PillButton
                label={game.players.length < 2 ? 'بنستنى لاعب تاني...' : 'ابدأ اللعب'}
                disabled={busy || game.players.length < 2}
                onPress={() => act(() => startColors(game.id))}
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

// ===== اللعب =====

function Play({ game, hand, uid, apply }: { game: ColorsGame; hand: string[]; uid: string | null; apply: Apply }) {
  const { setBalance } = useSession();
  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;
  const myTurn = game.status === 'playing' && !!me && game.turn === me.seat;
  useTurnSound(myTurn);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [wild, setWild] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1500) {
        lastTick.current = t;
        tickColors(game.id).then(apply).catch(() => {});
      }
    }, 400);
    return () => clearInterval(timer);
  }, [game.status, game.deadline, game.id, apply]);

  const act = async (fn: () => Promise<ColorsGame>) => {
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

  const tap = (card: string) => {
    if (!myTurn || busy || !playable(card, game.top, game.color)) return;
    if (isWild(card)) return setWild(card);
    playSfx('card');
    act(() => playCard(game.id, card));
  };

  const onBack = async () => {
    if (game.status !== 'playing' || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveColors(game.id).catch(() => {});
    back();
  };

  const turnPlayer = game.players.find((p) => p.seat === game.turn);
  const secs = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;
  const others = game.players.filter((p) => p.uid !== uid || p.left);
  const canPlayAny = myTurn && hand.some((c) => playable(c, game.top, game.color));
  const cardW = hand.length > 9 ? 52 : 60;

  return (
    <>
      <Header title="ألوان" onBack={onBack} />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت بتخسر الجولة. اضغط رجوع كمان مرة للتأكيد</T>}

      <View style={styles.opponents}>
        {others.map((p) => (
          <Opponent key={p.seat} p={p} active={p.seat === game.turn && game.status === 'playing'} />
        ))}
      </View>

      <View style={styles.table}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="اسحب ورقة"
          disabled={!myTurn || busy}
          onPress={() => (playSfx('card'), act(() => drawCard(game.id)))}
          style={[myTurn && !canPlayAny && styles.drawGlow]}>
          <CardBack width={70} />
          <T w="bold" style={{ marginTop: 6, fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>اسحب</T>
        </Pressable>
        {game.top && <ColorCard card={game.top} width={92} pick={game.color} />}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={[styles.colorDot, { backgroundColor: game.color ? CARD_COLORS[game.color].bg : colors.surface }]} />
          <T w="bold" style={{ fontSize: 11, color: colors.textMuted }}>{game.color ? CARD_COLORS[game.color].name : ''}</T>
          <T style={{ fontSize: 22 }}>{game.direction === 1 ? '↻' : '↺'}</T>
        </View>
      </View>

      <T w="bold" style={styles.status}>{statusText(game, uid)}</T>
      {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

      <View style={styles.turnRow}>
        <T w="heading" style={{ fontSize: 22, lineHeight: 30, color: myTurn ? colors.yellow : colors.white }}>
          {game.status !== 'playing'
            ? ''
            : myTurn
              ? canPlayAny
                ? 'دورك! نزّل ورقة'
                : 'ما عندك ورقة بتنفع، اسحب'
              : `دور ${turnPlayer?.name ?? ''}`}
        </T>
        {game.status === 'playing' && (
          <View style={[styles.timer, secs <= 5 && { backgroundColor: colors.coral }]}>
            <T w="black" style={{ fontSize: 14 }}>{ar(secs)} ث</T>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>
        {hand.map((c, i) => {
          const ok = myTurn && playable(c, game.top, game.color);
          return (
            <Pressable
              key={`${c}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`ورقة ${c}`}
              disabled={!ok || busy}
              onPress={() => tap(c)}
              style={[styles.handCard, ok && styles.handCardOk, i > 0 && { marginStart: -cardW * 0.28 }]}>
              <ColorCard card={c} width={cardW} dim={myTurn && !ok} />
            </Pressable>
          );
        })}
      </ScrollView>
      <T style={{ textAlign: 'center', fontSize: 12, color: colors.textDim }}>معك {ar(hand.length)} ورقة</T>

      <Modal visible={!!wild} transparent animationType="fade" onRequestClose={() => setWild(null)}>
        <Pressable style={styles.pickBackdrop} onPress={() => setWild(null)}>
          <View style={styles.pickCard}>
            <T w="heading" style={{ fontSize: 24, lineHeight: 32 }}>اختار اللون</T>
            <View style={styles.pickRow}>
              {(['r', 'g', 'y', 'b'] as ColorKey[]).map((k) => (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityLabel={CARD_COLORS[k].name}
                  onPress={() => {
                    const card = wild;
                    setWild(null);
                    if (card) {
                      playSfx('card');
                      act(() => playCard(game.id, card, k));
                    }
                  }}
                  style={[styles.pickBtn, { backgroundColor: CARD_COLORS[k].bg }]}>
                  <T w="black" style={{ fontSize: 13, color: k === 'y' ? colors.ink : colors.white }}>{CARD_COLORS[k].name}</T>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {game.status === 'finished' && <Finished game={game} uid={uid} onBalance={setBalance} />}
    </>
  );
}

function Opponent({ p, active }: { p: ColorsPlayer; active: boolean }) {
  return (
    <View style={[styles.opp, active && styles.oppActive, p.left && { opacity: 0.4 }]}>
      <Avatar avatar={p.avatar} size={36} />
      <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>{p.bot ? `🤖 ${p.name}` : p.name}</T>
      <View style={styles.oppCount}>
        <T w="black" style={{ fontSize: 12, color: p.count === 1 ? colors.ink : colors.white }}>
          🂠 {ar(p.count)}
        </T>
      </View>
      {p.count === 1 && !p.left && <T w="black" style={{ fontSize: 11, color: colors.yellow }}>ورقة وحدة!</T>}
    </View>
  );
}

function statusText(g: ColorsGame, uid: string | null) {
  const l = g.last;
  if (!l) return 'نزّل نفس اللون أو نفس الرقم';
  const p = g.players.find((x) => x.seat === l.seat);
  const mine = p?.uid === uid;
  const who = p?.name ?? '';
  if ('draw' in l) return mine ? 'سحبت ورقة' : `${who} سحب ورقة`;
  const target = g.players.find((x) => x.seat === l.target);
  const targetName = target?.uid === uid ? 'إنت' : (target?.name ?? '');
  const v = isWild(l.play) ? l.play : l.play.slice(1);
  const verb = mine ? 'نزّلت' : `${who} نزّل`;
  if (v === 'w4') return `${verb} ألوان +4 😈 ${targetName} سحب 4`;
  if (v === 'w') return `${verb} ألوان، واللون صار ${CARD_COLORS[l.color].name}`;
  if (v === 'd') return `${verb} +2، ${targetName} سحب ورقتين`;
  if (v === 's') return `${verb} منع ⊘، ${targetName} راح دوره`;
  if (v === 'r') return `${verb} عكس ⇄`;
  if (l.uno) return `${verb} ورقة، وضل معه ورقة وحدة! 🔥`;
  return mine ? 'نزّلت ورقة' : `${who} نزّل ورقة`;
}

function Finished({ game, uid, onBalance }: { game: ColorsGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const winner = game.players.find((p) => p.seat === game.winner);
  const iWon = !!winner && winner.uid === uid;
  useResultSound(iWon);
  const [reward, setReward] = useState<{ coins: number; xp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const vsBot = game.players.some((p) => p.bot);

  useEffect(() => {
    if (!uid) return;
    myColorsResult(game.id, uid).then((r) => r && setReward(r));
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
        <T style={{ fontSize: 56, lineHeight: 70 }}>{iWon ? '🏆' : winner ? '🃏' : '👋'}</T>
        <T w="heading" style={{ fontSize: 30, lineHeight: 40, textAlign: 'center' }}>
          {iWon ? 'مبروك! خلّصت ورقك' : winner ? `${winner.name} ربح!` : 'خلصت اللعبة'}
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
            label={vsBot ? 'جولة كمان ضد الكمبيوتر' : 'صالة ألوان'}
            disabled={busy}
            onPress={async () => {
              if (!vsBot) return router.replace('/colors');
              setBusy(true);
              try {
                const id = await playColorsVsBot();
                router.replace({ pathname: '/colors-game', params: { id: String(id) } });
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
    backgroundColor: colors.purple,
    alignItems: 'center',
    gap: 2,
  },
  slots: { marginTop: 18, marginHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between' },
  slot: { width: '24%', alignItems: 'center', gap: 4 },
  slotRing: { padding: 3, borderRadius: 32, borderWidth: 3, borderColor: colors.surfaceHigh },
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
  msg: { marginTop: 6, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  opponents: { marginTop: 10, marginHorizontal: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  opp: {
    flex: 1,
    maxWidth: 120,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 4,
  },
  oppActive: { borderColor: colors.yellow, backgroundColor: '#3A1D72' },
  oppCount: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: colors.surfaceHigh, justifyContent: 'center' },
  table: {
    marginTop: 18,
    marginHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: '#24104A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  drawGlow: { borderRadius: 14, boxShadow: '0 0 0 4px rgba(255,201,60,0.7)' },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: '#FFFFFF' },
  status: { marginTop: 12, marginHorizontal: 20, textAlign: 'center', fontSize: 14, color: colors.textSoft },
  turnRow: {
    marginTop: 10,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timer: { height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.surface, justifyContent: 'center' },
  hand: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10, alignItems: 'flex-end' },
  handCard: { borderRadius: 12 },
  handCardOk: { transform: [{ translateY: -14 }] },
  pickBackdrop: { flex: 1, backgroundColor: 'rgba(10,3,24,0.7)', justifyContent: 'center', padding: 24 },
  pickCard: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 26,
    backgroundColor: '#24104A',
    borderWidth: 2,
    borderColor: colors.yellow,
    alignItems: 'center',
    gap: 14,
  },
  pickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  pickBtn: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
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
