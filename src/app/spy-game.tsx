import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { BackIcon, CopyIcon, SendIcon } from '@/components/Icons';
import { GameTalk, talkOn, talkWidth } from '@/components/GameTalk';
import { PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useResultSound } from '@/lib/sound';
import {
  callVote,
  guessLocation,
  leaveSpy,
  loadCard,
  loadLocations,
  mySpyResult,
  startSpy,
  tickSpy,
  useSpyGame,
  vote,
  type SpyCard,
  type SpyChatLine,
  type SpyGame,
  type SpyLocation,
} from '@/lib/spy';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/spy'));

export default function SpyGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gid = Number(id);
  const { user, uid, loading } = useSession();
  const { game, error, apply, chat, send } = useSpyGame(gid, { uid, name: user?.name ?? '' });

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
        <Play game={game} uid={uid} apply={apply} chat={chat} send={send} />
      )}
      {game && <GameTalk game="spy" id={game.id} players={game.players} uid={uid} finished={game.status === 'finished'} withChat={false} />}
    </Screen>
  );
}

type Apply = (g: SpyGame | void) => void;

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

function Waiting({ game, uid, apply }: { game: SpyGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const n = game.players.length;

  const start = async () => {
    setBusy(true);
    setMsg('');
    try {
      apply(await startSpy(game.id));
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header
        title="طاولة الجاسوس"
        onBack={async () => {
          await leaveSpy(game.id).catch(() => {});
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
            {copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة الجاسوس'}
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
                      <Avatar avatar={p.avatar} size={48} />
                    </View>
                    <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>{p.uid === uid ? 'إنت' : p.name}</T>
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

        <View style={styles.howTo}>
          <T w="black" style={{ fontSize: 15 }}>كيف بتنلعب؟</T>
          <T style={styles.howLine}>1. الكل بياخد كرت فيه نفس المكان، إلا الجاسوس ما بيعرفه.</T>
          <T style={styles.howLine}>2. اسألوا بعض أسئلة عن المكان بدون ما تفضحوه.</T>
          <T style={styles.howLine}>3. لما يخلص الوقت بتصوّتوا مين الجاسوس.</T>
          <T style={styles.howLine}>4. الجاسوس بيربح إذا ما انمسك، أو إذا عرف المكان.</T>
        </View>

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}
        <View style={{ marginTop: 14, marginHorizontal: 20 }}>
          {isHost ? (
            <PillButton
              label={n < 3 ? `بنستنى لاعبين (${ar(n)} من 3 على الأقل)` : 'ابدأ اللعب'}
              disabled={busy || n < 3}
              onPress={start}
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

function Play({
  game,
  uid,
  apply,
  chat,
  send,
}: {
  game: SpyGame;
  uid: string | null;
  apply: Apply;
  chat: SpyChatLine[];
  send: (t: string) => void;
}) {
  const { setBalance } = useSession();
  const [card, setCard] = useState<SpyCard | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [locations, setLocations] = useState<SpyLocation[]>([]);
  const [crossed, setCrossed] = useState<Set<string>>(new Set());
  const [guessing, setGuessing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;
  const isSpy = !!card && card.location === null;
  const live = game.status !== 'finished';

  useEffect(() => {
    if (!uid) return;
    loadCard(game.id, uid).then(setCard);
    loadLocations().then(setLocations).catch(() => {});
  }, [game.id, uid]);

  // العدّاد، ولما يخلص الوقت منطلب من السيرفر ينقل للمرحلة الجاية
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1500) {
        lastTick.current = t;
        tickSpy(game.id).then(apply).catch(() => {});
      }
    }, 500);
    return () => clearInterval(timer);
  }, [live, game.deadline, game.id, apply]);

  const act = async (fn: () => Promise<SpyGame>) => {
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

  const onBack = async () => {
    if (!live || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveSpy(game.id).catch(() => {});
    back();
  };

  const secs = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;
  const clock = `${ar(Math.floor(secs / 60))}:${ar(String(secs % 60).padStart(2, '0'))}`;
  const nameOf = (u: string | null) => (u === uid ? 'إنت' : (game.players.find((p) => p.uid === u)?.name ?? ''));
  const others = game.players.filter((p) => !p.left && p.uid !== uid);
  const myVote = uid ? game.votes[uid] : undefined;
  const voted = Object.keys(game.votes).length;
  const activeCount = game.players.filter((p) => !p.left).length;
  const accusedMe = game.accused === uid;

  const pickLocation = (key: string) => {
    if (isSpy && (guessing || (game.status === 'guessing' && accusedMe))) {
      act(() => guessLocation(game.id, key));
      setGuessing(false);
      return;
    }
    setCrossed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  return (
    <>
      <Header
        title="مين الجاسوس؟"
        onBack={onBack}
        talk={talkWidth(talkOn(game.players, uid, game.status === 'finished'), false)}
        right={
          live ? (
            <View style={[styles.clock, secs <= 30 && { backgroundColor: colors.coral }]}>
              <T w="black" style={{ fontSize: 16 }}>⏱ {clock}</T>
            </View>
          ) : undefined
        }
      />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت بتخسر الجولة. اضغط رجوع كمان مرة للتأكيد</T>}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {live && me && card && (
          <Pressable accessibilityRole="button" onPress={() => setShowCard((s) => !s)} style={[styles.card, isSpy && showCard && styles.spyCard]}>
            {!showCard ? (
              <>
                <T style={{ fontSize: 40 }}>🃏</T>
                <T w="black" style={{ fontSize: 16 }}>اضغط تشوف كرتك</T>
                <T style={{ fontSize: 12, color: colors.textMuted }}>خبّيه عن اللي جنبك 👀</T>
              </>
            ) : isSpy ? (
              <>
                <T style={{ fontSize: 44 }}>🕵️</T>
                <T w="heading" style={{ fontSize: 28, lineHeight: 36 }}>إنت الجاسوس!</T>
                <T style={{ fontSize: 13, color: '#FFE0D6', textAlign: 'center' }}>
                  ما بتعرف المكان. اسمع منيح وحاول تعرفه بدون ما تنكشف
                </T>
              </>
            ) : (
              <>
                <T style={{ fontSize: 44 }}>{locations.find((l) => l.key === card.location)?.emoji ?? '📍'}</T>
                <T w="heading" style={{ fontSize: 28, lineHeight: 36, color: colors.yellow }}>
                  {locations.find((l) => l.key === card.location)?.name ?? ''}
                </T>
                <T w="bold" style={{ fontSize: 14, color: colors.textMuted }}>دورك: {card.role}</T>
              </>
            )}
          </Pressable>
        )}

        {game.status === 'playing' && (
          <>
            {game.first_asker && (
              <T w="bold" style={styles.note}>🎤 أول واحد بيسأل: {nameOf(game.first_asker)}</T>
            )}
            <View style={styles.chatBox}>
              {chat.length === 0 ? (
                <T style={{ fontSize: 13, color: colors.textDim, textAlign: 'center' }}>
                  اكتبوا أسئلتكم هون، أو احكوا بغرفة صوتية
                </T>
              ) : (
                chat.slice(-30).map((l) => (
                  <T key={l.id} style={{ fontSize: 14, lineHeight: 22 }}>
                    <T w="black" style={{ color: l.uid === uid ? colors.yellow : colors.sky }}>{l.uid === uid ? 'إنت' : l.name}: </T>
                    {l.text}
                  </T>
                ))
              )}
            </View>
            {me && (
              <View style={styles.inputRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="اسأل أو جاوب..."
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  onSubmitEditing={() => {
                    send(text);
                    setText('');
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إرسال"
                  onPress={() => {
                    send(text);
                    setText('');
                  }}
                  style={styles.sendBtn}>
                  <SendIcon />
                </Pressable>
              </View>
            )}
            {me && (
              <View style={{ marginTop: 12, marginHorizontal: 20, gap: 10 }}>
                {isSpy && (
                  <PillButton
                    label={guessing ? 'اختار المكان من تحت 👇' : '🎯 عرفت المكان!'}
                    bg={colors.coral}
                    fg={colors.white}
                    onPress={() => setGuessing((g) => !g)}
                  />
                )}
                <PillButton label="خلصنا أسئلة؟ يلا نصوّت" disabled={busy} onPress={() => act(() => callVote(game.id))} />
              </View>
            )}
          </>
        )}

        {game.status === 'voting' && (
          <View style={styles.section}>
            <T w="heading" style={styles.h2}>مين الجاسوس؟ 🤔</T>
            <T style={{ fontSize: 13, color: colors.textMuted }}>صوّتوا ({ar(voted)} من {ar(activeCount)} صوّتوا)</T>
            {me &&
              others.map((p) => (
                <Pressable
                  key={p.uid}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => act(() => vote(game.id, p.uid))}
                  style={[styles.voteRow, myVote === p.uid && styles.voteOn]}>
                  <Avatar avatar={p.avatar} size={40} />
                  <T w="black" style={{ flex: 1, fontSize: 16 }}>{p.name}</T>
                  {myVote === p.uid && <T w="black" style={{ color: colors.yellow }}>صوتك ✓</T>}
                </Pressable>
              ))}
            <T style={{ fontSize: 12, color: colors.textDim }}>لازم الأغلبية تتفق على واحد، والتعادل لصالح الجاسوس 😏</T>
          </View>
        )}

        {game.status === 'guessing' && (
          <View style={styles.section}>
            <T w="heading" style={styles.h2}>{accusedMe ? 'انكشفت! 😱' : `انمسك ${nameOf(game.accused)}! 🕵️`}</T>
            <T style={{ fontSize: 14, color: colors.textMuted }}>
              {accusedMe ? 'عندك فرصة أخيرة: اختار المكان الصح من تحت وبتربح' : 'هو الجاسوس، وهلأ عم يحاول يخمّن المكان...'}
            </T>
          </View>
        )}

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

        {live && locations.length > 0 && (
          <View style={styles.section}>
            <T w="black" style={{ fontSize: 15 }}>
              {isSpy && (guessing || (game.status === 'guessing' && accusedMe)) ? '🎯 اختار المكان' : 'كل الأماكن'}
            </T>
            <T style={{ fontSize: 12, color: colors.textDim }}>
              {isSpy && (guessing || (game.status === 'guessing' && accusedMe))
                ? 'إذا غلطت بتخسر!'
                : 'اضغط على مكان تشطبه (بيبين عندك بس)'}
            </T>
            <View style={styles.locGrid}>
              {locations.map((l) => {
                const off = crossed.has(l.key);
                const guessMode = isSpy && (guessing || (game.status === 'guessing' && accusedMe));
                return (
                  <Pressable
                    key={l.key}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => pickLocation(l.key)}
                    style={[styles.loc, guessMode && styles.locGuess, off && !guessMode && { opacity: 0.35 }]}>
                    <T style={{ fontSize: 20 }}>{l.emoji}</T>
                    <T w="bold" style={[{ fontSize: 11, textAlign: 'center' }, off && !guessMode && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
                      {l.name}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {game.status === 'finished' && <Finished game={game} uid={uid} onBalance={setBalance} />}
      </ScrollView>
    </>
  );
}

const REASONS: Record<string, string> = {
  guessed: 'الجاسوس عرف المكان 🎯',
  bad_guess: 'الجاسوس خمّن غلط',
  tie: 'التصويت تعادل، والجاسوس هرب',
  wrong: 'صوّتوا على الشخص الغلط',
  no_guess: 'انمسك الجاسوس وما لحّق يخمّن',
  spy_left: 'الجاسوس طلع من اللعبة',
  too_few: 'ما ضل لاعبين كفاية',
};

function Finished({ game, uid, onBalance }: { game: SpyGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const [reward, setReward] = useState<{ won: boolean; coins: number; xp: number } | null>(null);
  const r = game.reveal;
  const spyName = game.players.find((p) => p.uid === r?.spy);
  const iAmSpy = r?.spy === uid;
  const iWon = (game.winner === 'spy') === iAmSpy;
  useResultSound(iWon);

  useEffect(() => {
    if (!uid) return;
    mySpyResult(game.id, uid).then((x) => x && setReward(x));
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
      <T style={{ fontSize: 52, lineHeight: 64 }}>{iWon ? '🏆' : '😅'}</T>
      <T w="heading" style={{ fontSize: 28, lineHeight: 38, textAlign: 'center' }}>
        {game.winner === 'spy' ? 'الجاسوس ربح!' : 'اللاعبين ربحوا!'}
      </T>
      <T w="bold" style={{ fontSize: 14, color: colors.textMuted }}>{REASONS[r?.reason ?? ''] ?? ''}</T>
      <View style={styles.revealRow}>
        <View style={styles.revealBox}>
          <T style={{ fontSize: 12, color: colors.textDim }}>الجاسوس كان</T>
          {spyName && <Avatar avatar={spyName.avatar} size={44} />}
          <T w="black" style={{ fontSize: 15 }}>{iAmSpy ? 'إنت 🕵️' : (spyName?.name ?? '')}</T>
        </View>
        <View style={styles.revealBox}>
          <T style={{ fontSize: 12, color: colors.textDim }}>المكان كان</T>
          <T style={{ fontSize: 36, lineHeight: 46 }}>{r?.emoji}</T>
          <T w="black" style={{ fontSize: 15 }}>{r?.name}</T>
        </View>
      </View>
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
        <PillButton label="صالة الجاسوس" onPress={() => router.replace('/spy')} />
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
  h2: { fontSize: 24, lineHeight: 32 },
  clock: { height: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: colors.surface, justifyContent: 'center' },
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
  emptySlot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howTo: { marginTop: 18, marginHorizontal: 20, padding: 14, borderRadius: 20, backgroundColor: colors.surface, gap: 4 },
  howLine: { fontSize: 13, lineHeight: 21, color: colors.textMuted },
  wait: { textAlign: 'center', fontSize: 15, color: colors.textMuted },
  msg: { marginTop: 8, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  card: {
    marginTop: 12,
    marginHorizontal: 20,
    minHeight: 150,
    padding: 16,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.yellow,
    backgroundColor: '#3A1D72',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  spyCard: { backgroundColor: colors.coral, borderColor: colors.white },
  note: { marginTop: 10, marginHorizontal: 20, fontSize: 14, color: colors.textSoft, textAlign: 'center' },
  chatBox: { marginTop: 10, marginHorizontal: 20, minHeight: 80, padding: 12, borderRadius: 18, backgroundColor: colors.surface, gap: 4 },
  inputRow: { marginTop: 8, marginHorizontal: 20, flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: 'Tajawal_500Medium',
    fontSize: 15,
    textAlign: 'right',
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 14, marginHorizontal: 20, gap: 8 },
  voteRow: {
    height: 60,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voteOn: { borderColor: colors.yellow, backgroundColor: '#3A1D72' },
  locGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  loc: {
    width: '23.5%',
    height: 64,
    paddingHorizontal: 2,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  locGuess: { borderWidth: 2, borderColor: colors.coral },
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
  revealRow: { alignSelf: 'stretch', flexDirection: 'row', gap: 10 },
  revealBox: { flex: 1, padding: 12, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', gap: 4 },
  rewardPill: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.purple, justifyContent: 'center' },
});
