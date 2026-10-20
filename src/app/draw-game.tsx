import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { DrawCanvas } from '@/components/DrawCanvas';
import { BackIcon, CopyIcon, SendIcon } from '@/components/Icons';
import { GameTalk, talkOn, talkWidth } from '@/components/GameTalk';
import { PillButton, Screen, T } from '@/components/ui';
import {
  drawSecret,
  guessWord,
  leaveDraw,
  myDrawResult,
  pickWord,
  startDraw,
  tickDraw,
  useDrawGame,
  type DrawGame,
} from '@/lib/draw';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/draw'));
const fmt = (n: number) => ar(n.toLocaleString('en'));

// ألوان الرسم (الأبيض = ممحاة)
const INKS = ['#1C0A3A', '#D9381E', '#FFC93C', '#2FB760', '#1E8FB0', '#6A35C9', '#8A4E2C', '#FFFFFF'];

export default function DrawGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, uid, loading } = useSession();
  const room = useDrawGame(Number(id), { uid, name: user?.name ?? '' });

  if (!loading && !user) return <Redirect href="/login" />;

  const { game, error } = room;
  return (
    <Screen>
      {!game ? (
        <View style={styles.center}>
          <T style={{ color: colors.textMuted }}>{error ? errorText(error) : 'لحظة...'}</T>
        </View>
      ) : game.status === 'waiting' ? (
        <Waiting game={game} uid={uid} apply={room.apply} />
      ) : (
        <Play room={room} game={game} uid={uid} />
      )}
      {game && <GameTalk game="draw" id={game.id} players={game.players} uid={uid} finished={game.status === 'finished'} />}
    </Screen>
  );
}

type Room = ReturnType<typeof useDrawGame>;
type Apply = Room['apply'];

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

function Waiting({ game, uid, apply }: { game: DrawGame; uid: string | null; apply: Apply }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const n = game.players.length;

  return (
    <>
      <Header
        title="طاولة الرسم"
        onBack={async () => {
          await leaveDraw(game.id).catch(() => {});
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
            {copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة احزر الرسمة'}
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

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}
        <View style={{ marginTop: 16, marginHorizontal: 20 }}>
          {isHost ? (
            <PillButton
              label={n < 2 ? 'بنستنى لاعب تاني...' : 'ابدأ اللعب'}
              disabled={busy || n < 2}
              onPress={async () => {
                setBusy(true);
                setMsg('');
                try {
                  apply(await startDraw(game.id));
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

function Play({ room, game, uid }: { room: Room; game: DrawGame; uid: string | null }) {
  const { width } = useWindowDimensions();
  const { setBalance } = useSession();
  const { apply, strokes, chat, beginStroke, addPoint, endStroke, clear, say } = room;
  const size = Math.min(width - 40, 420);
  const live = game.status === 'playing';
  const me = game.players.find((p) => p.uid === uid && !p.left) ?? null;
  const amDrawer = live && !!uid && game.drawer === uid;
  const iGuessed = !!uid && game.guessed.some((g) => g.uid === uid);
  const drawerName = game.players.find((p) => p.uid === game.drawer)?.name ?? '';

  const [secret, setSecret] = useState<{ choices: string[]; word: string | null } | null>(null);
  const [ink, setInk] = useState(INKS[0]);
  const [thick, setThick] = useState(false);
  const [text, setText] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  // الرسّام بيجيب الخيارات أو كلمته
  const secretKey = `${game.turn}-${game.phase}-${amDrawer}`;
  useEffect(() => {
    if (!amDrawer || game.phase === 'reveal') return;
    drawSecret(game.id).then(setSecret).catch(() => {});
  }, [secretKey, amDrawer, game.id, game.phase]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1500) {
        lastTick.current = t;
        tickDraw(game.id).then(apply).catch(() => {});
      }
    }, 500);
    return () => clearInterval(timer);
  }, [live, game.deadline, game.id, apply]);

  const sendGuess = async () => {
    const t = text.trim();
    if (!t || !me || amDrawer || iGuessed || game.phase !== 'drawing') return;
    setText('');
    try {
      const r = await guessWord(game.id, t);
      if (r.correct) {
        apply(r.game);
        say('عرفها! 🎉', true);
      } else {
        say(t);
      }
    } catch {
      say(t);
    }
  };

  const onBack = async () => {
    if (!live || !me) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveDraw(game.id).catch(() => {});
    back();
  };

  const secs = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;
  const ranked = [...game.players].filter((p) => !p.left).sort((a, b) => b.score - a.score);
  const myWord = secret?.word;

  return (
    <>
      <Header
        title="احزر الرسمة"
        onBack={onBack}
        talk={talkOn(game.players, uid, game.status === 'finished') ? talkWidth() : 0}
        right={
          live ? (
            <View style={[styles.clock, secs <= 10 && game.phase === 'drawing' && { backgroundColor: colors.coral }]}>
              <T w="black" style={{ fontSize: 14 }}>⏱ {ar(secs)}</T>
            </View>
          ) : undefined
        }
      />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت بتخسر الجولة. اضغط رجوع كمان مرة للتأكيد</T>}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.players}>
          {ranked.map((p) => {
            const guessed = game.guessed.some((g) => g.uid === p.uid);
            const drawing = p.uid === game.drawer && live;
            return (
              <View key={p.uid} style={[styles.chip, drawing && styles.chipDrawer, guessed && styles.chipGuessed]}>
                <Avatar avatar={p.avatar} size={28} />
                <View>
                  <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>
                    {drawing ? '✏️ ' : guessed ? '✅ ' : ''}{p.uid === uid ? 'إنت' : p.name}
                  </T>
                  <T w="bold" style={{ fontSize: 11, color: colors.yellow }}>{fmt(p.score)}</T>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {live && (
          <View style={styles.banner}>
            {game.phase === 'choosing' ? (
              amDrawer ? (
                <>
                  <T w="black" style={{ fontSize: 15 }}>دورك ترسم! اختار كلمة:</T>
                  <View style={styles.choices}>
                    {(secret?.choices ?? []).map((w, i) => (
                      <Pressable
                        key={w}
                        accessibilityRole="button"
                        onPress={async () => {
                          try {
                            apply(await pickWord(game.id, i));
                            setSecret({ choices: secret?.choices ?? [], word: w });
                          } catch {
                            // الوقت خلص
                          }
                        }}
                        style={styles.choice}>
                        <T w="black" style={{ fontSize: 16, color: colors.ink }}>{w}</T>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <T w="black" style={{ fontSize: 16 }}>✏️ {drawerName} عم يختار كلمة...</T>
              )
            ) : game.phase === 'drawing' ? (
              amDrawer ? (
                <T w="black" style={{ fontSize: 16 }}>
                  ارسم: <T w="heading" style={{ fontSize: 22, color: colors.yellow }}>{myWord ?? '...'}</T>
                </T>
              ) : (
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <T w="heading" style={styles.hint}>{game.hint}</T>
                  <T style={{ fontSize: 12, color: colors.textMuted }}>
                    {iGuessed ? 'عرفتها! 🎉 استنى الباقي' : `${ar((game.hint ?? '').replace(/ /g, '').length)} حروف`}
                  </T>
                </View>
              )
            ) : (
              <T w="black" style={{ fontSize: 16 }}>
                الكلمة كانت: <T w="heading" style={{ fontSize: 22, color: colors.yellow }}>{game.reveal?.word}</T>
              </T>
            )}
          </View>
        )}

        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <DrawCanvas
            size={size}
            strokes={strokes}
            canDraw={amDrawer && game.phase === 'drawing'}
            color={ink}
            width={ink === '#FFFFFF' ? 40 : thick ? 18 : 7}
            onBegin={beginStroke}
            onMove={addPoint}
            onEnd={endStroke}
          />
        </View>

        {amDrawer && game.phase === 'drawing' && (
          <View style={styles.tools}>
            {INKS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={c === '#FFFFFF' ? 'ممحاة' : 'لون'}
                onPress={() => setInk(c)}
                style={[styles.ink, { backgroundColor: c }, ink === c && styles.inkOn]}>
                {c === '#FFFFFF' && <T style={{ fontSize: 14 }}>🧽</T>}
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setThick((t) => !t)} style={styles.tool}>
              <T w="black" style={{ fontSize: 13 }}>{thick ? '● عريض' : '• رفيع'}</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={clear} style={styles.tool}>
              <T w="black" style={{ fontSize: 13 }}>🗑️ مسح</T>
            </Pressable>
          </View>
        )}

        {live && (
          <>
            <View style={styles.chatBox}>
              {chat.length === 0 ? (
                <T style={{ fontSize: 13, color: colors.textDim, textAlign: 'center' }}>التخمينات بتبين هون</T>
              ) : (
                chat.slice(-8).map((l) => (
                  <T key={l.id} style={{ fontSize: 14, lineHeight: 22, color: l.ok ? '#7CF0A0' : colors.white }}>
                    <T w="black" style={{ color: l.uid === uid ? colors.yellow : colors.sky }}>{l.uid === uid ? 'إنت' : l.name}: </T>
                    {l.text}
                  </T>
                ))
              )}
            </View>
            {me && !amDrawer && (
              <View style={styles.inputRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  editable={game.phase === 'drawing' && !iGuessed}
                  placeholder={iGuessed ? 'عرفتها! 🎉' : 'شو هاي الرسمة؟'}
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  onSubmitEditing={sendGuess}
                />
                <Pressable accessibilityRole="button" accessibilityLabel="خمّن" onPress={sendGuess} style={styles.sendBtn}>
                  <SendIcon />
                </Pressable>
              </View>
            )}
          </>
        )}

        {game.status === 'finished' && <Finished game={game} uid={uid} onBalance={setBalance} />}
      </ScrollView>
    </>
  );
}

function Finished({ game, uid, onBalance }: { game: DrawGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const [reward, setReward] = useState<{ won: boolean; coins: number; xp: number } | null>(null);
  const winner = game.players.find((p) => p.uid === game.winner);

  useEffect(() => {
    if (!uid) return;
    myDrawResult(game.id, uid).then((r) => r && setReward(r));
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
      <T style={{ fontSize: 52, lineHeight: 64 }}>{reward?.won ? '🏆' : '🎨'}</T>
      <T w="heading" style={{ fontSize: 28, lineHeight: 38, textAlign: 'center' }}>
        {reward?.won ? 'إنت الفنان الأول!' : winner ? `${winner.name} ربح!` : 'خلصت اللعبة'}
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
        <PillButton label="صالة الرسم" onPress={() => router.replace('/draw')} />
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
  players: { marginTop: 10, paddingHorizontal: 20, gap: 8 },
  chip: {
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipDrawer: { borderColor: colors.yellow, backgroundColor: '#3A1D72' },
  chipGuessed: { borderColor: '#2FB760' },
  banner: {
    marginTop: 10,
    marginHorizontal: 20,
    minHeight: 56,
    padding: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hint: { fontSize: 26, lineHeight: 34, letterSpacing: 2, direction: 'rtl' },
  choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  choice: { height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.yellow, justifyContent: 'center' },
  tools: {
    marginTop: 10,
    marginHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ink: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  inkOn: { borderWidth: 3, borderColor: colors.yellow, transform: [{ scale: 1.15 }] },
  tool: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.surface, justifyContent: 'center' },
  chatBox: { marginTop: 10, marginHorizontal: 20, minHeight: 60, padding: 12, borderRadius: 18, backgroundColor: colors.surface, gap: 2 },
  inputRow: { marginTop: 8, marginHorizontal: 20, flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: 'Tajawal_700Bold',
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
