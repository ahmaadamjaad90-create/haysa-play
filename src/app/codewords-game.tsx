import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { BackIcon, CopyIcon } from '@/components/Icons';
import { GameTalk, talkOn, talkWidth } from '@/components/GameTalk';
import { PillButton, Screen, T } from '@/components/ui';
import {
  TEAMS,
  codeKey,
  giveClue,
  leaveCode,
  myCodeResult,
  passTurn,
  pickCard,
  startCode,
  tickCode,
  useCodeGame,
  type CardColor,
  type CodeGame,
  type Team,
} from '@/lib/codewords';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { playSfx, useResultSound, useTurnSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/codewords'));

// لون كل كرت بعد ما ينكشف
const CARD: Record<CardColor, { bg: string; fg: string }> = {
  r: { bg: TEAMS.r.color, fg: colors.white },
  b: { bg: TEAMS.b.color, fg: colors.ink },
  n: { bg: '#E8DCC4', fg: colors.ink },
  x: { bg: '#0E0520', fg: colors.white },
};

export default function CodeWordsGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, uid, loading } = useSession();
  const { game, error, apply } = useCodeGame(Number(id));

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
      {game && <GameTalk game="codewords" id={game.id} players={game.players} uid={uid} finished={game.status === 'finished'} />}
    </Screen>
  );
}

type Apply = (g: CodeGame | void) => void;

function Header({ title, onBack, right, talk }: { title: string; onBack: () => void; right?: ReactNode; talk?: number }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={onBack} style={styles.back}>
        <BackIcon />
      </Pressable>
      <T w="heading" style={styles.h1}>{title}</T>
      {right}
      {!!talk && <View style={{ width: talk }} />}
    </View>
  );
}

// ===== قبل ما يبلّش =====

function Waiting({ game, uid, apply }: { game: CodeGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const n = game.players.length;

  return (
    <>
      <Header
        title="طاولة كلمات السر"
        onBack={async () => {
          await leaveCode(game.id).catch(() => {});
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
          <T w="bold" style={{ fontSize: 14, color: '#FFE0D6' }}>رقم الطاولة</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T w="heading" style={{ fontSize: 44, lineHeight: 56 }}>{ar(game.id)}</T>
            <CopyIcon size={20} />
          </View>
          <T w="bold" style={{ fontSize: 13, color: '#FFE0D6' }}>
            {copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة كلمات السر'}
          </T>
        </Pressable>

        <View style={styles.grid}>
          {game.players.map((p) => (
            <View key={p.uid} style={styles.slot}>
              <View style={[styles.ring, p.uid === game.host && { borderColor: colors.yellow }]}>
                <Avatar avatar={p.avatar} size={44} />
              </View>
              <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>{p.uid === uid ? 'إنت' : p.name}</T>
            </View>
          ))}
        </View>
        <T style={styles.count}>{ar(n)} من 10 · لازم 4 على الأقل</T>

        <View style={styles.howTo}>
          <T w="black" style={{ fontSize: 15 }}>كيف بتنلعب؟</T>
          <T style={styles.howLine}>1. بنتقسّم لفريقين، ولكل فريق رئيس بيشوف ألوان الكلمات.</T>
          <T style={styles.howLine}>2. الرئيس بيعطي كلمة وحدة ورقم، متل «بحر 2» يعني في كلمتين إلهم علاقة بالبحر.</T>
          <T style={styles.howLine}>3. الفريق بيكشف الكلمات. إذا طلعت لون التاني أو محايدة، بيروح الدور.</T>
          <T style={styles.howLine}>4. القنبلة 💣 = خسارة فوراً. أول فريق بيكشف كلماته كلها بيربح.</T>
        </View>

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}
        <View style={{ marginTop: 14, marginHorizontal: 20 }}>
          {isHost ? (
            <PillButton
              label={n < 4 ? `بنستنى لاعبين (${ar(n)} من 4)` : 'ابدأ اللعب'}
              disabled={busy || n < 4}
              onPress={async () => {
                setBusy(true);
                setMsg('');
                try {
                  apply(await startCode(game.id));
                } catch (e) {
                  setMsg(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : (
            <T style={styles.wait}>بنستنى صاحب الطاولة يبدأ...</T>
          )}
        </View>
      </ScrollView>
    </>
  );
}

// ===== اللعب =====

function Play({ game, uid, apply }: { game: CodeGame; uid: string | null; apply: Apply }) {
  const { setBalance } = useSession();
  const [key, setKey] = useState<CardColor[] | null>(null);
  const [clue, setClue] = useState('');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  const live = game.status === 'playing';
  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;
  const myTeam = me?.team ?? null;
  const isBoss = !!me?.boss;
  const ourTurn = live && myTeam === game.turn;
  useTurnSound(ourTurn);
  const canGuess = ourTurn && !isBoss && game.phase === 'guess';
  const canClue = ourTurn && isBoss && game.phase === 'clue';

  useEffect(() => {
    if (!isBoss) return;
    codeKey(game.id).then(setKey).catch(() => {});
  }, [isBoss, game.id]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1500) {
        lastTick.current = t;
        tickCode(game.id).then(apply).catch(() => {});
      }
    }, 500);
    return () => clearInterval(timer);
  }, [live, game.deadline, game.id, apply]);

  const act = async (fn: () => Promise<CodeGame>) => {
    setBusy(true);
    setMsg('');
    try {
      apply(await fn());
    } catch (e) {
      const t = errorText(e);
      setMsg(
        t.includes('one word') ? 'التلميحة لازم تكون كلمة وحدة'
        : t.includes('on board') ? 'ما بيصير تلمّح بكلمة موجودة عالطاولة'
        : t,
      );
    } finally {
      setBusy(false);
    }
  };

  const onBack = async () => {
    if (!live || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveCode(game.id).catch(() => {});
    back();
  };

  const secs = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;
  const left = (t: Team) => (game.goal?.[t] ?? 0) - (game.revealed ?? []).filter((c) => c === t).length;
  const turnName = game.turn ? TEAMS[game.turn].name : '';
  const shownKey = game.key ?? key;

  const lastText = (() => {
    const l = game.last;
    if (!l) return '';
    if (l.skip) return 'خلص الوقت، وراح الدور';
    if (l.pass) return `${l.by} وقّف التخمين`;
    if (l.pick !== undefined && game.words) {
      const w = game.words[l.pick];
      const c = l.color;
      return `${l.by} كشف "${w}": ${c === 'x' ? 'قنبلة 💣' : c === 'n' ? 'محايدة' : `للفريق ${TEAMS[c as Team].name}`}`;
    }
    return '';
  })();

  return (
    <>
      <Header
        title="كلمات السر"
        onBack={onBack}
        talk={talkWidth(talkOn(game.players, uid, game.status === 'finished'))}
        right={
          live ? (
            <View style={[styles.clock, secs <= 15 && { backgroundColor: colors.coral }]}>
              <T w="black" style={{ fontSize: 14 }}>⏱ {ar(secs)}</T>
            </View>
          ) : undefined
        }
      />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت فريقك ممكن يخسر. اضغط رجوع كمان مرة للتأكيد</T>}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.score}>
          {(['r', 'b'] as Team[]).map((t) => (
            <View key={t} style={[styles.scoreBox, { backgroundColor: TEAMS[t].color }, game.turn === t && live && styles.scoreOn]}>
              <T w="heading" style={{ fontSize: 30, lineHeight: 36, color: t === 'b' ? colors.ink : colors.white }}>{ar(left(t))}</T>
              <T w="black" style={{ fontSize: 12, color: t === 'b' ? colors.ink : colors.white }}>
                {TEAMS[t].name}{myTeam === t ? ' (فريقك)' : ''}
              </T>
            </View>
          ))}
        </View>

        {me && (
          <T w="bold" style={styles.me}>
            إنت بالفريق <T w="black" style={{ color: myTeam ? TEAMS[myTeam].color : colors.white }}>{myTeam ? TEAMS[myTeam].name : ''}</T>
            {isBoss ? ' · إنت الرئيس 👑 (بتشوف الألوان)' : ''}
          </T>
        )}

        {live && (
          <View style={[styles.banner, game.turn && { borderColor: TEAMS[game.turn].color }]}>
            {game.phase === 'clue' ? (
              canClue ? (
                <>
                  <T w="black" style={{ fontSize: 15 }}>دورك تلمّح لفريقك 👑</T>
                  <View style={styles.clueRow}>
                    <TextInput
                      value={clue}
                      onChangeText={(t) => setClue(t.replace(/\s/g, ''))}
                      placeholder="كلمة وحدة"
                      placeholderTextColor={colors.placeholder}
                      style={styles.clueInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={!clue || busy}
                      onPress={() => act(() => giveClue(game.id, clue, count)).then(() => setClue(''))}
                      style={[styles.clueBtn, (!clue || busy) && { opacity: 0.5 }]}>
                      <T w="black" style={{ fontSize: 15, color: colors.ink }}>أرسل</T>
                    </Pressable>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                      <Pressable
                        key={n}
                        accessibilityRole="button"
                        onPress={() => setCount(n)}
                        style={[styles.num, count === n && styles.numOn]}>
                        <T w="black" style={{ fontSize: 14, color: count === n ? colors.ink : colors.white }}>{n === 0 ? '∞' : ar(n)}</T>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <T w="black" style={{ fontSize: 15, textAlign: 'center' }}>رئيس الفريق {turnName} عم يفكّر بتلميحة... 🤔</T>
              )
            ) : (
              <>
                <T style={{ fontSize: 13, color: colors.textMuted }}>تلميحة الفريق {turnName}</T>
                <T w="heading" style={{ fontSize: 30, lineHeight: 40 }}>
                  {game.clue?.word} · {game.clue?.count === 0 ? '∞' : ar(game.clue?.count ?? 0)}
                </T>
                <T style={{ fontSize: 12, color: colors.textMuted }}>
                  {canGuess ? 'اضغطوا على الكلمات اللي إلها علاقة' : `الفريق ${turnName} عم يخمّن`}
                  {game.guesses_left !== null && game.guesses_left < 25 ? ` · باقي ${ar(game.guesses_left)} محاولات` : ''}
                </T>
                {canGuess && (
                  <Pressable accessibilityRole="button" onPress={() => act(() => passTurn(game.id))} style={styles.pass}>
                    <T w="black" style={{ fontSize: 13 }}>خلصنا، وقّف ✋</T>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}
        {!!lastText && <T w="bold" style={styles.last}>{lastText}</T>}
        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

        <View style={styles.board}>
          {(game.words ?? []).map((w, i) => {
            const shown = game.revealed?.[i] ?? null;
            const hidden = shownKey?.[i] ?? null;
            const tappable = canGuess && !shown && !busy;
            const style = shown ? CARD[shown] : null;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                disabled={!tappable}
                onPress={() => (playSfx('card'), act(() => pickCard(game.id, i)))}
                style={[
                  styles.card,
                  style && { backgroundColor: style.bg },
                  !shown && hidden && { borderColor: CARD[hidden].bg, borderWidth: 3 },
                  !shown && hidden === 'x' && { borderColor: colors.white },
                ]}>
                <T
                  w="black"
                  numberOfLines={2}
                  style={[styles.word, style && { color: style.fg }, !!shown && !live && { opacity: 0.85 }]}>
                  {shown === 'x' ? `💣 ${w}` : w}
                </T>
                {!shown && hidden === 'x' && <T style={styles.bomb}>💣</T>}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.teams}>
          {(['r', 'b'] as Team[]).map((t) => (
            <View key={t} style={[styles.teamCol, { borderColor: TEAMS[t].color }]}>
              <T w="black" style={{ fontSize: 14, color: TEAMS[t].color }}>الفريق {TEAMS[t].name}</T>
              {game.players
                .filter((p) => p.team === t)
                .map((p) => (
                  <View key={p.uid} style={[styles.member, p.left && { opacity: 0.4 }]}>
                    <Avatar avatar={p.avatar} size={24} />
                    <T w="bold" style={{ fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
                      {p.boss ? '👑 ' : ''}{p.uid === uid ? 'إنت' : p.name}
                    </T>
                  </View>
                ))}
            </View>
          ))}
        </View>

        {game.status === 'finished' && <Finished game={game} uid={uid} onBalance={setBalance} />}
      </ScrollView>
    </>
  );
}

function Finished({ game, uid, onBalance }: { game: CodeGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const [reward, setReward] = useState<{ won: boolean; coins: number; xp: number } | null>(null);
  useResultSound(reward ? reward.won : null);
  const bomb = (game.revealed ?? []).includes('x');

  useEffect(() => {
    if (!uid) return;
    myCodeResult(game.id, uid).then((r) => r && setReward(r));
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
      <T style={{ fontSize: 52, lineHeight: 64 }}>{reward?.won ? '🏆' : bomb ? '💣' : '🔑'}</T>
      <T w="heading" style={{ fontSize: 28, lineHeight: 38, textAlign: 'center' }}>
        {game.winner ? `الفريق ${TEAMS[game.winner].name} ربح!` : 'خلصت اللعبة'}
      </T>
      {bomb && <T w="bold" style={{ fontSize: 14, color: colors.peach }}>انكشفت القنبلة 💣</T>}
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
        <PillButton label="صالة كلمات السر" onPress={() => router.replace('/codewords')} />
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
  clock: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center' },
  confirm: { marginTop: 6, marginHorizontal: 20, fontSize: 13, color: colors.peach, textAlign: 'center' },
  codeCard: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.coral,
    alignItems: 'center',
    gap: 2,
  },
  grid: { marginTop: 16, marginHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  slot: { width: '25%', alignItems: 'center', gap: 4 },
  ring: { padding: 2, borderRadius: 30, borderWidth: 3, borderColor: colors.surfaceHigh },
  count: { marginTop: 10, textAlign: 'center', fontSize: 13, color: colors.textMuted },
  howTo: { marginTop: 14, marginHorizontal: 20, padding: 14, borderRadius: 20, backgroundColor: colors.surface, gap: 4 },
  howLine: { fontSize: 13, lineHeight: 21, color: colors.textMuted },
  wait: { textAlign: 'center', fontSize: 15, color: colors.textMuted },
  msg: { marginTop: 6, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  score: { marginTop: 10, marginHorizontal: 20, flexDirection: 'row', gap: 10 },
  scoreBox: { flex: 1, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent', opacity: 0.6 },
  scoreOn: { borderColor: colors.white, opacity: 1 },
  me: { marginTop: 8, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.textSoft },
  banner: {
    marginTop: 10,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 8,
  },
  clueRow: { alignSelf: 'stretch', flexDirection: 'row', gap: 8 },
  clueInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.tabBar,
    color: colors.white,
    fontFamily: 'Tajawal_700Bold',
    fontSize: 16,
    textAlign: 'right',
  },
  clueBtn: { height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.yellow, justifyContent: 'center' },
  num: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A1D72', alignItems: 'center', justifyContent: 'center' },
  numOn: { backgroundColor: colors.yellow },
  pass: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#3A1D72', justifyContent: 'center' },
  last: { marginTop: 8, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.textSoft },
  board: { marginTop: 10, marginHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  card: {
    width: '18.5%',
    height: 58,
    paddingHorizontal: 2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#F7F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: { fontSize: 13, lineHeight: 18, color: colors.ink, textAlign: 'center' },
  bomb: { position: 'absolute', top: 1, end: 3, fontSize: 10 },
  teams: { marginTop: 14, marginHorizontal: 20, flexDirection: 'row', gap: 10 },
  teamCol: { flex: 1, padding: 10, borderRadius: 18, borderWidth: 2, backgroundColor: colors.surface, gap: 6 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
