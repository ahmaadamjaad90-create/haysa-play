import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { DominoBack, DominoTile } from '@/components/DominoTile';
import { BackIcon, CopyIcon } from '@/components/Icons';
import { GameTalk } from '@/components/GameTalk';
import { PillButton, Screen, T } from '@/components/ui';
import {
  addDomBot,
  drawTile,
  leaveDom,
  leftEnd,
  myDomResult,
  playDomVsBot,
  playTile,
  rightEnd,
  sidesFor,
  startDom,
  tickDom,
  tileA,
  tileB,
  useDomGame,
  type DomGame,
  type DomPlayer,
} from '@/lib/domino';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { playSfx, useResultSound, useTurnSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/domino'));

export default function DominoGameScreen() {
  // room: الطاولة مفتوحة من غرفة صوتية (الصوت من الغرفة نفسها)
  const { id, room: inRoom } = useLocalSearchParams<{ id: string; room?: string }>();
  const { user, uid, loading } = useSession();
  const { game, hand, error, apply } = useDomGame(Number(id), uid);

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
      {game && <GameTalk game="domino" id={game.id} players={game.players} uid={uid} finished={game.status === 'finished'} inRoom={!!inRoom} />}
    </Screen>
  );
}

type Apply = (g: DomGame | void) => void;

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

function Waiting({ game, uid, apply }: { game: DomGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const act = async (fn: () => Promise<DomGame>) => {
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
        title="طاولة دومينو"
        onBack={async () => {
          await leaveDom(game.id).catch(() => {});
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
            {copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة الدومينو'}
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
                <PillButton label="ضيف كمبيوتر 🤖" bg={colors.surface} fg={colors.white} disabled={busy} onPress={() => act(() => addDomBot(game.id))} />
              )}
              <PillButton
                label={game.players.length < 2 ? 'بنستنى لاعب تاني...' : 'ابدأ اللعب'}
                disabled={busy || game.players.length < 2}
                onPress={() => act(() => startDom(game.id))}
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

function Play({ game, hand, uid, apply }: { game: DomGame; hand: string[]; uid: string | null; apply: Apply }) {
  const { setBalance } = useSession();
  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;
  const myTurn = game.status === 'playing' && !!me && game.turn === me.seat;
  useTurnSound(myTurn);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<string | null>(null);
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
        tickDom(game.id).then(apply).catch(() => {});
      }
    }, 400);
    return () => clearInterval(timer);
  }, [game.status, game.deadline, game.id, apply]);

  const act = async (fn: () => Promise<DomGame>) => {
    setBusy(true);
    setMsg('');
    setPending(null);
    try {
      apply(await fn());
    } catch (e) {
      const t = errorText(e);
      if (!t.includes('not your turn')) setMsg(t.includes('can play') ? 'عندك حجر بينفع، نزّله' : t);
    } finally {
      setBusy(false);
    }
  };

  const tap = (t: string) => {
    if (!myTurn || busy) return;
    const sides = sidesFor(game, t);
    if (!sides.length) return;
    if (sides.length === 1 || leftEnd(game) === rightEnd(game)) return (playSfx('card'), act(() => playTile(game.id, t, sides[0])));
    setPending(pending === t ? null : t);
  };

  const onBack = async () => {
    if (game.status !== 'playing' || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveDom(game.id).catch(() => {});
    back();
  };

  const others = game.players.filter((p) => p.uid !== uid || p.left);
  const turnPlayer = game.players.find((p) => p.seat === game.turn);
  const secs = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;
  const canPlay = myTurn && hand.some((t) => sidesFor(game, t).length > 0);

  return (
    <>
      <Header title="دومينو" onBack={onBack} />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت بتخسر الجولة. اضغط رجوع كمان مرة للتأكيد</T>}

      <View style={styles.opponents}>
        {others.map((p) => (
          <Opponent key={p.seat} p={p} active={p.seat === game.turn && game.status === 'playing'} />
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
        <View style={styles.table}>
          {game.chain.length === 0 ? (
            <T w="bold" style={{ fontSize: 14, color: colors.textMuted }}>الطاولة فاضية، أول حجر بيفتح اللعب</T>
          ) : (
            <View style={styles.chain}>
              {game.chain.map(([a, b], i) => (
                <DominoTile key={i} a={a} b={b} size={18} vertical={a === b} />
              ))}
            </View>
          )}
          <View style={styles.ends}>
            <View style={styles.endPill}>
              <T w="black" style={{ fontSize: 15 }}>{ar(leftEnd(game) ?? '-')}</T>
            </View>
            <T w="black" style={{ fontSize: 13, color: colors.textMuted }}>🁫 الكومة: {ar(game.pile)}</T>
            <View style={styles.endPill}>
              <T w="black" style={{ fontSize: 15 }}>{ar(rightEnd(game) ?? '-')}</T>
            </View>
          </View>
        </View>

        <T w="bold" style={styles.status}>{statusText(game, uid)}</T>
        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}
      </ScrollView>

      <View style={styles.turnRow}>
        <T w="heading" style={{ fontSize: 22, lineHeight: 30, color: myTurn ? colors.yellow : colors.white }}>
          {game.status !== 'playing'
            ? ''
            : myTurn
              ? canPlay
                ? 'دورك! نزّل حجر'
                : game.pile > 0
                  ? 'ما عندك حجر بينفع'
                  : 'ما عندك ولا الكومة'
              : `دور ${turnPlayer?.name ?? ''}`}
        </T>
        {game.status === 'playing' && (
          <View style={[styles.timer, secs <= 5 && { backgroundColor: colors.coral }]}>
            <T w="black" style={{ fontSize: 14 }}>{ar(secs)} ث</T>
          </View>
        )}
      </View>
      {myTurn && !canPlay && (
        <PillButton
          label={game.pile > 0 ? 'اسحب من الكومة 🁫' : 'مرّر الدور'}
          disabled={busy}
          onPress={() => (playSfx('card'), act(() => drawTile(game.id)))}
          style={{ marginHorizontal: 20, marginTop: 6 }}
        />
      )}
      {pending && (
        <View style={[styles.sideRow, { direction: 'ltr' }]}>
          <Pressable accessibilityRole="button" onPress={() => (playSfx('card'), act(() => playTile(game.id, pending, 'L')))} style={styles.sideBtn}>
            <T w="black" style={{ fontSize: 15, color: colors.ink }}>◀ عاليسار</T>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => (playSfx('card'), act(() => playTile(game.id, pending, 'R')))} style={styles.sideBtn}>
            <T w="black" style={{ fontSize: 15, color: colors.ink }}>عاليمين ▶</T>
          </Pressable>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>
        {hand.map((t) => {
          const ok = myTurn && sidesFor(game, t).length > 0;
          return (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={`حجر ${t}`}
              disabled={!ok || busy}
              onPress={() => tap(t)}>
              <DominoTile a={tileA(t)} b={tileB(t)} size={28} vertical glow={ok || pending === t} dim={myTurn && !ok} />
            </Pressable>
          );
        })}
      </ScrollView>

      {game.status === 'finished' && <Finished game={game} uid={uid} onBalance={setBalance} />}
    </>
  );
}

function Opponent({ p, active }: { p: DomPlayer; active: boolean }) {
  return (
    <View style={[styles.opp, active && styles.oppActive, p.left && { opacity: 0.4 }]}>
      <Avatar avatar={p.avatar} size={34} />
      <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>{p.bot ? `🤖 ${p.name}` : p.name}</T>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {Array.from({ length: Math.min(p.count, 7) }, (_, i) => (
          <DominoBack key={i} size={7} />
        ))}
      </View>
      <T w="bold" style={{ fontSize: 11, color: p.count === 1 ? colors.yellow : colors.textMuted }}>
        {p.count === 1 ? 'حجر واحد! 🔥' : `${ar(p.count)} أحجار`}
      </T>
    </View>
  );
}

function statusText(g: DomGame, uid: string | null) {
  const l = g.last;
  if (!l) return 'اللي معه أكبر دبل بيبدأ';
  const p = g.players.find((x) => x.seat === l.seat);
  const mine = p?.uid === uid;
  const who = p?.name ?? '';
  if (l.blocked) return 'تسكّرت! اللي نقاطه أقل بيربح';
  if (l.play) {
    const t = ar(l.play.replace('-', '|'));
    return mine ? `نزّلت ${t}` : `${who} نزّل ${t}`;
  }
  if (l.pass) return mine ? `ما عندك، مرّرت الدور${l.drew ? ` بعد ما سحبت ${ar(l.drew)}` : ''}` : `${who} مرّر الدور`;
  if (l.drew) return mine ? `سحبت ${ar(l.drew)} من الكومة` : `${who} سحب ${ar(l.drew)} من الكومة`;
  return '';
}

function Finished({ game, uid, onBalance }: { game: DomGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const winner = game.players.find((p) => p.seat === game.winner);
  const iWon = !!winner && winner.uid === uid;
  useResultSound(iWon);
  const [reward, setReward] = useState<{ coins: number; xp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const vsBot = game.players.some((p) => p.bot);

  useEffect(() => {
    if (!uid) return;
    myDomResult(game.id, uid).then((r) => r && setReward(r));
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
        <T style={{ fontSize: 56, lineHeight: 70 }}>{iWon ? '🏆' : '🁫'}</T>
        <T w="heading" style={{ fontSize: 30, lineHeight: 40, textAlign: 'center' }}>
          {iWon ? 'مبروك! ربحت' : winner ? `${winner.name} ربح!` : 'خلصت اللعبة'}
        </T>
        {game.last?.blocked && <T w="bold" style={{ fontSize: 13, color: colors.textMuted }}>تسكّرت، وربح صاحب أقل نقاط</T>}
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
            label={vsBot ? 'جولة كمان ضد الكمبيوتر' : 'صالة الدومينو'}
            disabled={busy}
            onPress={async () => {
              if (!vsBot) return router.replace('/domino');
              setBusy(true);
              try {
                const id = await playDomVsBot();
                router.replace({ pathname: '/domino-game', params: { id: String(id) } });
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
    backgroundColor: '#1E8FB0',
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
  table: {
    marginTop: 12,
    marginHorizontal: 14,
    minHeight: 160,
    padding: 12,
    borderRadius: 24,
    backgroundColor: '#1F6B4A',
    borderWidth: 4,
    borderColor: '#8A4E2C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chain: { direction: 'ltr', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 3 },
  endPill: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  ends: { direction: 'ltr', alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { marginTop: 10, marginHorizontal: 20, textAlign: 'center', fontSize: 14, color: colors.textSoft },
  turnRow: {
    marginTop: 6,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timer: { height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.surface, justifyContent: 'center' },
  sideRow: { marginTop: 8, marginHorizontal: 20, flexDirection: 'row', gap: 10 },
  sideBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  hand: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, gap: 8, alignItems: 'flex-end' },
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
