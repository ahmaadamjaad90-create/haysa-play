import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { BackIcon, CopyIcon } from '@/components/Icons';
import { PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import {
  CATEGORIES,
  addTriviaBot,
  answerTrivia,
  leaveTrivia,
  myTriviaResult,
  playTriviaVsBots,
  playerKey,
  startTrivia,
  tickTrivia,
  useTriviaGame,
  type TriviaGame,
} from '@/lib/trivia';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/trivia'));
const fmt = (n: number) => ar(n.toLocaleString('en'));
const OPTION_COLORS = [colors.coral, colors.purple, '#2FB760', '#1E8FB0'];

export default function TriviaGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, uid, loading } = useSession();
  const { game, error, apply } = useTriviaGame(Number(id));

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

type Apply = (g: TriviaGame | void) => void;

function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={onBack} style={styles.back}>
        <BackIcon />
      </Pressable>
      <T w="heading" style={styles.h1}>{title}</T>
      {right}
    </View>
  );
}

// ===== قبل ما يبلّش =====

function Waiting({ game, uid, apply }: { game: TriviaGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const cat = CATEGORIES.find((c) => c.key === game.category);

  const act = async (fn: () => Promise<TriviaGame>) => {
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
        title="طاولة الأسئلة"
        onBack={async () => {
          await leaveTrivia(game.id).catch(() => {});
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
          <T w="bold" style={{ fontSize: 14, color: colors.ink }}>رقم الطاولة · {cat?.emoji} {cat?.label}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T w="heading" style={{ fontSize: 44, lineHeight: 56, color: colors.ink }}>{ar(game.id)}</T>
            <CopyIcon size={20} color={colors.ink} />
          </View>
          <T w="bold" style={{ fontSize: 13, color: colors.ink }}>
            {copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة تحدي الأسئلة'}
          </T>
        </Pressable>

        <View style={styles.grid}>
          {Array.from({ length: 8 }, (_, i) => {
            const p = game.players[i];
            return (
              <View key={i} style={styles.slot}>
                {p ? (
                  <>
                    <View style={[styles.ring, p.uid === game.host && { borderColor: colors.yellow }]}>
                      <Avatar avatar={p.avatar} size={46} />
                    </View>
                    <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>
                      {p.bot ? `🤖 ${p.name}` : p.uid === uid ? 'إنت' : p.name}
                    </T>
                  </>
                ) : (
                  <>
                    <View style={styles.emptySlot}>
                      <T w="black" style={{ fontSize: 20, color: colors.textDim }}>+</T>
                    </View>
                    <T style={{ fontSize: 11, color: colors.textDim }}>فاضي</T>
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
              {game.players.length < 8 && (
                <PillButton label="ضيف كمبيوتر 🤖" bg={colors.surface} fg={colors.white} disabled={busy} onPress={() => act(() => addTriviaBot(game.id))} />
              )}
              <PillButton label="ابدأ التحدي" disabled={busy} onPress={() => act(() => startTrivia(game.id))} />
            </>
          ) : (
            <T style={styles.wait}>بنستنى صاحب الطاولة يبدأ...</T>
          )}
        </View>
      </ScrollView>
    </>
  );
}

// ===== الأسئلة =====

function Play({ game, uid, apply }: { game: TriviaGame; uid: string | null; apply: Apply }) {
  const { setBalance } = useSession();
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<{ round: number; choice: number } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  const live = game.status === 'playing';
  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1200) {
        lastTick.current = t;
        tickTrivia(game.id).then(apply).catch(() => {});
      }
    }, 250);
    return () => clearInterval(timer);
  }, [live, game.deadline, game.id, apply]);

  const answer = async (choice: number) => {
    if (!me || busy || game.phase !== 'question' || (uid && game.answered.includes(uid))) return;
    setMine({ round: game.round, choice });
    setBusy(true);
    try {
      apply(await answerTrivia(game.id, choice));
    } catch {
      // الوقت خلص أو جاوب قبل
    } finally {
      setBusy(false);
    }
  };

  const onBack = async () => {
    if (!live || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveTrivia(game.id).catch(() => {});
    back();
  };

  const q = game.question;
  const reveal = game.phase === 'reveal' ? game.reveal : null;
  const myKey = uid ?? '';
  const myChoice = mine?.round === game.round ? mine.choice : reveal?.picks[myKey];
  const answered = !!uid && game.answered.includes(uid);
  const msLeft = game.deadline ? Math.max(0, Date.parse(game.deadline) - now) : 0;
  const progress = game.phase === 'question' ? Math.min(1, msLeft / 15000) : 0;
  const cat = CATEGORIES.find((c) => c.key === q?.category);
  const ranked = game.players
    .map((p, i) => ({ p, k: playerKey(p, i) }))
    .filter((x) => !x.p.left)
    .sort((a, b) => b.p.score - a.p.score);

  return (
    <>
      <Header
        title="تحدي الأسئلة"
        onBack={onBack}
        right={
          live ? (
            <View style={styles.roundPill}>
              <T w="black" style={{ fontSize: 14 }}>{ar(game.round)} / {ar(game.total)}</T>
            </View>
          ) : undefined
        }
      />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت بتخسر نقاطك. اضغط رجوع كمان مرة للتأكيد</T>}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {live && q && (
          <>
            <View style={styles.timeBar}>
              <View style={[styles.timeFill, { width: `${progress * 100}%` }, progress < 0.3 && { backgroundColor: colors.coral }]} />
            </View>
            <View style={styles.qCard}>
              <T w="bold" style={{ fontSize: 13, color: colors.textMuted }}>{cat?.emoji} {cat?.label}</T>
              <T w="heading" style={styles.qText}>{q.text}</T>
            </View>

            <View style={[styles.options, q.options.length === 2 && { flexDirection: 'row' }]}>
              {q.options.map((o, i) => {
                const isAnswer = reveal?.answer === i;
                const isMine = myChoice === i;
                const wrong = !!reveal && isMine && !isAnswer;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    disabled={!me || answered || !!reveal || busy}
                    onPress={() => answer(i)}
                    style={[
                      styles.option,
                      q.options.length === 2 && { flex: 1, height: 90 },
                      { backgroundColor: OPTION_COLORS[i % 4] },
                      reveal && !isAnswer && !wrong && { opacity: 0.35 },
                      isAnswer && styles.optionRight,
                      wrong && styles.optionWrong,
                      !reveal && answered && !isMine && { opacity: 0.45 },
                      !reveal && isMine && styles.optionMine,
                    ]}>
                    <T w="black" style={{ fontSize: 17, textAlign: 'center' }}>{o}</T>
                    {isAnswer && <T style={styles.mark}>✅</T>}
                    {wrong && <T style={styles.mark}>❌</T>}
                  </Pressable>
                );
              })}
            </View>

            <T w="bold" style={styles.status}>
              {reveal
                ? myChoice === reveal.answer
                  ? `صح! +${fmt(reveal.gains[myKey] ?? 0)} 🎉`
                  : myChoice === undefined
                    ? 'ما لحّقت تجاوب 😅'
                    : 'غلط 😬'
                : answered
                  ? `جاوبت! بنستنى الباقي (${ar(game.answered.length)} جاوبوا)`
                  : `باقي ${ar(Math.ceil(msLeft / 1000))} ثانية`}
            </T>
          </>
        )}

        <View style={styles.board}>
          <T w="black" style={{ fontSize: 15 }}>الترتيب</T>
          {ranked.map(({ p, k }, i) => (
            <View key={k} style={[styles.rankRow, p.uid === uid && { backgroundColor: '#3A1D72' }]}>
              <T w="black" style={{ width: 22, fontSize: 15, color: i === 0 ? colors.yellow : colors.textMuted }}>{ar(i + 1)}</T>
              <Avatar avatar={p.avatar} size={32} />
              <T w="black" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                {p.bot ? `🤖 ${p.name}` : p.uid === uid ? 'إنت' : p.name}
              </T>
              {reveal && (reveal.gains[k] ?? 0) > 0 && (
                <T w="black" style={{ fontSize: 12, color: '#7CF0A0' }}>+{fmt(reveal.gains[k])}</T>
              )}
              {!reveal && live && p.uid && game.answered.includes(p.uid) && <T style={{ fontSize: 13 }}>✔️</T>}
              <T w="black" style={{ fontSize: 15, minWidth: 54, textAlign: 'left' }}>{fmt(p.score)}</T>
            </View>
          ))}
        </View>

        {game.status === 'finished' && <Finished game={game} uid={uid} onBalance={setBalance} />}
      </ScrollView>
    </>
  );
}

function Finished({ game, uid, onBalance }: { game: TriviaGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const [reward, setReward] = useState<{ won: boolean; coins: number; xp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const winner = game.players.find((p) => p.uid && p.uid === game.winner);
  const iWon = !!reward?.won;
  const vsBots = game.players.filter((p) => !p.bot).length === 1;

  useEffect(() => {
    if (!uid) return;
    myTriviaResult(game.id, uid).then((r) => r && setReward(r));
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
    <View style={styles.finish}>
      <T style={{ fontSize: 52, lineHeight: 64 }}>{iWon ? '🏆' : '🧠'}</T>
      <T w="heading" style={{ fontSize: 28, lineHeight: 38, textAlign: 'center' }}>
        {iWon ? 'إنت الأشطر!' : winner ? `${winner.name} هو الأشطر!` : 'خلص التحدي'}
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
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 6 }}>
        <PillButton
          label={vsBots ? 'تحدي جديد' : 'صالة الأسئلة'}
          disabled={busy}
          onPress={async () => {
            if (!vsBots) return router.replace('/trivia');
            setBusy(true);
            try {
              const id = await playTriviaVsBots(game.category);
              router.replace({ pathname: '/trivia-game', params: { id: String(id) } });
            } finally {
              setBusy(false);
            }
          }}
        />
        <PillButton label="الرئيسية" bg={colors.surface} fg={colors.white} onPress={() => router.replace('/home')} />
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
  h1: { flex: 1, fontSize: 26, lineHeight: 36 },
  roundPill: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center' },
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
  grid: { marginTop: 16, marginHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  slot: { width: '25%', alignItems: 'center', gap: 4 },
  ring: { padding: 2, borderRadius: 30, borderWidth: 3, borderColor: colors.surfaceHigh },
  emptySlot: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wait: { textAlign: 'center', fontSize: 15, color: colors.textMuted },
  msg: { marginTop: 8, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  timeBar: { marginTop: 12, marginHorizontal: 20, height: 10, borderRadius: 5, backgroundColor: colors.tabBar, overflow: 'hidden', flexDirection: 'row' },
  timeFill: { height: '100%', borderRadius: 5, backgroundColor: colors.yellow },
  qCard: {
    marginTop: 12,
    marginHorizontal: 20,
    minHeight: 130,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qText: { fontSize: 24, lineHeight: 36, textAlign: 'center' },
  options: { marginTop: 12, marginHorizontal: 20, gap: 10 },
  option: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionMine: { borderColor: colors.white },
  optionRight: { borderColor: '#7CF0A0', backgroundColor: '#2FB760' },
  optionWrong: { borderColor: colors.white, backgroundColor: '#9E2412' },
  mark: { position: 'absolute', end: 14, fontSize: 18 },
  status: { marginTop: 12, marginHorizontal: 20, textAlign: 'center', fontSize: 16, color: colors.textSoft },
  board: { marginTop: 16, marginHorizontal: 20, padding: 12, borderRadius: 20, backgroundColor: colors.surface, gap: 6 },
  rankRow: { height: 44, paddingHorizontal: 8, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  finish: {
    marginTop: 14,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.yellow,
    backgroundColor: '#24104A',
    alignItems: 'center',
    gap: 8,
  },
  rewardPill: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.purple, justifyContent: 'center' },
});
