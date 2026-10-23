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
import {
  ROLES,
  addMafiaBot,
  callMafiaVote,
  leaveMafia,
  mafiaInfo,
  mafiaVote,
  myMafiaResult,
  nightAct,
  playMafiaVsBots,
  startMafia,
  tickMafia,
  useMafiaGame,
  type MafiaGame,
  type MafiaInfo,
  type MafiaPlayer,
  type MafiaRole,
} from '@/lib/mafia';
import { useSession } from '@/lib/session';
import { useResultSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/mafia'));

export default function MafiaGameScreen() {
  // room: الطاولة مفتوحة من غرفة صوتية (الصوت من الغرفة نفسها)
  const { id, room: inRoom } = useLocalSearchParams<{ id: string; room?: string }>();
  const { user, uid, loading } = useSession();
  const room = useMafiaGame(Number(id), { uid, name: user?.name ?? '' });

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
      {game && <GameTalk game="mafia" id={game.id} players={game.players} uid={uid} finished={game.status === 'finished'} inRoom={!!inRoom} withChat={false} />}
    </Screen>
  );
}

type Room = ReturnType<typeof useMafiaGame>;

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

function Waiting({ game, uid, apply }: { game: MafiaGame; uid: string | null; apply: Room['apply'] }) {
  const isHost = game.host === uid;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const n = game.players.length;

  const act = async (fn: () => Promise<MafiaGame>) => {
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
        title="طاولة المافيا"
        onBack={async () => {
          await leaveMafia(game.id).catch(() => {});
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
            {copied ? 'انتسخ ✓' : 'ابعته لأصحابك عشان يدخلوا من صفحة المافيا'}
          </T>
        </Pressable>

        <View style={styles.grid}>
          {game.players.map((p) => (
            <View key={p.key} style={styles.slot}>
              <View style={[styles.ring, p.uid === game.host && { borderColor: colors.yellow }]}>
                <Avatar avatar={p.avatar} size={44} />
              </View>
              <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>
                {p.bot ? `🤖 ${p.name}` : p.uid === uid ? 'إنت' : p.name}
              </T>
            </View>
          ))}
        </View>
        <T style={styles.count}>{ar(n)} من 12 · لازم 4 على الأقل</T>

        <View style={styles.howTo}>
          <T w="black" style={{ fontSize: 15 }}>الأدوار</T>
          {(Object.keys(ROLES) as MafiaRole[]).map((r) => (
            <T key={r} style={styles.howLine}>
              {ROLES[r].emoji} <T w="black">{ROLES[r].name}:</T> {ROLES[r].job}
            </T>
          ))}
        </View>

        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}
        <View style={{ marginTop: 14, marginHorizontal: 20, gap: 10 }}>
          {isHost ? (
            <>
              {n < 12 && (
                <PillButton label="ضيف كمبيوتر 🤖" bg={colors.surface} fg={colors.white} disabled={busy} onPress={() => act(() => addMafiaBot(game.id))} />
              )}
              <PillButton
                label={n < 4 ? `بنستنى لاعبين (${ar(n)} من 4)` : 'ابدأ اللعب'}
                disabled={busy || n < 4}
                onPress={() => act(() => startMafia(game.id))}
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

function Play({ room, game, uid }: { room: Room; game: MafiaGame; uid: string | null }) {
  const { setBalance } = useSession();
  const { apply, chat, say } = room;
  const [info, setInfo] = useState<MafiaInfo | null>(null);
  const [showRole, setShowRole] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  const live = game.status === 'playing';
  const me = game.players.find((p) => p.uid === uid) ?? null;
  const alive = !!me && me.alive;

  useEffect(() => {
    mafiaInfo(game.id).then(setInfo).catch(() => {});
  }, [game.id, game.updated_at]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (game.deadline && t > Date.parse(game.deadline) + 300 && t - lastTick.current > 1500) {
        lastTick.current = t;
        tickMafia(game.id).then(apply).catch(() => {});
      }
    }, 500);
    return () => clearInterval(timer);
  }, [live, game.deadline, game.id, apply]);

  const act = async (fn: () => Promise<MafiaGame>) => {
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
    if (!live || !alive) return back();
    if (!confirmLeave) return setConfirmLeave(true);
    await leaveMafia(game.id).catch(() => {});
    back();
  };

  const secs = game.deadline ? Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000)) : 0;
  const role = info?.role;
  const team = new Set(info?.team ?? []);
  const checks = new Map((info?.checks ?? []).map((c) => [c.target, c.is_mafia]));
  const nameOf = (k?: string | null) => {
    const p = game.players.find((x) => x.key === k);
    return p ? (p.uid === uid ? 'إنت' : p.name) : '';
  };
  const livePlayers = game.players.filter((p) => p.alive);

  // مين بقدر أختار بالليل
  const nightTargets =
    role && role !== 'citizen'
      ? livePlayers.filter((p) => (role === 'mafia' ? !team.has(p.key) : role === 'cop' ? p.key !== info?.key : true))
      : [];
  const nightVerb = role === 'mafia' ? 'مين بدكم تطلّعوا؟' : role === 'doctor' ? 'مين بدك تحمي؟' : 'مين بدك تفحص؟';

  const voteCount = (k: string) => Object.values(game.votes).filter((v) => v === k).length;
  const myVote = info?.key ? game.votes[info.key] : undefined;

  const phaseLabel =
    game.phase === 'night' ? `🌙 الليلة ${ar(game.day)}` : game.phase === 'vote' ? '🗳️ التصويت' : `☀️ اليوم ${ar(game.day)}`;

  return (
    <>
      <Header
        title="المافيا"
        onBack={onBack}
        talk={talkWidth(talkOn(game.players, uid, game.status === 'finished'), false)}
        right={
          live ? (
            <View style={[styles.pill, game.phase === 'night' && { backgroundColor: '#0E0520' }]}>
              <T w="black" style={{ fontSize: 13 }}>{phaseLabel}{'\u200F · '}⏱ {ar(secs)}</T>
            </View>
          ) : undefined
        }
      />
      {confirmLeave && <T w="bold" style={styles.confirm}>إذا طلعت بتخسر الجولة. اضغط رجوع كمان مرة للتأكيد</T>}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {role && live && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowRole((s) => !s)}
            style={[styles.roleCard, showRole && { borderColor: ROLES[role].color }]}>
            {showRole ? (
              <>
                <T style={{ fontSize: 36 }}>{ROLES[role].emoji}</T>
                <T w="heading" style={{ fontSize: 26, lineHeight: 34, color: ROLES[role].color }}>إنت {ROLES[role].name}</T>
                <T style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>{ROLES[role].job}</T>
                {role === 'mafia' && team.size > 1 && (
                  <T w="bold" style={{ fontSize: 13, color: colors.peach }}>
                    جماعتك: {[...team].filter((k) => k !== info?.key).map(nameOf).join('، ')}
                  </T>
                )}
                {!alive && <T w="black" style={{ fontSize: 14, color: colors.peach }}>💀 طلعت من اللعبة، بس بتقدر تتفرّج</T>}
              </>
            ) : (
              <>
                <T style={{ fontSize: 30 }}>🎭</T>
                <T w="black" style={{ fontSize: 15 }}>اضغط تشوف دورك</T>
              </>
            )}
          </Pressable>
        )}

        {live && (
          <View style={styles.banner}>
            {game.phase === 'night' ? (
              alive && nightTargets.length > 0 ? (
                <>
                  <T w="heading" style={styles.bannerTitle}>{nightVerb}</T>
                  <View style={styles.targets}>
                    {nightTargets.map((p) => {
                      const mine = info?.my_pick === p.key;
                      const teamPick = role === 'mafia' && Object.values(info?.picks ?? {}).includes(p.key);
                      return (
                        <Pressable
                          key={p.key}
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() => act(() => nightAct(game.id, p.key))}
                          style={[styles.target, teamPick && { borderColor: colors.peach }, mine && styles.targetOn]}>
                          <Avatar avatar={p.avatar} size={36} />
                          <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>{p.uid === uid ? 'إنت' : p.name}</T>
                          {teamPick && !mine && <T style={{ fontSize: 10, color: colors.peach }}>جماعتك اختاروه</T>}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <T style={{ fontSize: 40 }}>😴</T>
                  <T w="heading" style={styles.bannerTitle}>الكل نايم...</T>
                  <T style={{ fontSize: 13, color: colors.textMuted }}>المافيا عم تشتغل بالسر</T>
                </>
              )
            ) : game.phase === 'morning' ? (
              <>
                <T style={{ fontSize: 40 }}>☀️</T>
                {game.last?.killed ? (
                  <T w="heading" style={styles.bannerTitle}>
                    المافيا طلّعت {nameOf(game.last.killed)}! كان {ROLES[game.last.role ?? 'citizen'].name} {ROLES[game.last.role ?? 'citizen'].emoji}
                  </T>
                ) : (
                  <T w="heading" style={styles.bannerTitle}>
                    {game.last?.saved ? 'الدكتور أنقذ واحد الليلة! 💉 ما حدا مات' : 'ليلة هادية، ما حدا مات'}
                  </T>
                )}
              </>
            ) : game.phase === 'day' ? (
              <>
                <T w="heading" style={styles.bannerTitle}>احكوا: مين بتشكّوا فيه؟ 🤔</T>
                {alive && <PillButton label="خلصنا حكي؟ يلا نصوّت" disabled={busy} onPress={() => act(() => callMafiaVote(game.id))} />}
              </>
            ) : game.phase === 'vote' ? (
              <>
                <T w="heading" style={styles.bannerTitle}>صوّتوا: مين يطلع؟</T>
                <T style={{ fontSize: 12, color: colors.textMuted }}>لازم الأغلبية تتفق، والتعادل ما بيطلّع حدا</T>
                {alive && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => act(() => mafiaVote(game.id, 'skip'))}
                    style={[styles.skip, myVote === 'skip' && styles.targetOn]}>
                    <T w="black" style={{ fontSize: 13 }}>ما بدي أصوّت لحدا</T>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <T style={{ fontSize: 40 }}>⚖️</T>
                {game.last?.out ? (
                  <T w="heading" style={styles.bannerTitle}>
                    طلع {nameOf(game.last.out)}، وكان {ROLES[game.last.role ?? 'citizen'].name} {ROLES[game.last.role ?? 'citizen'].emoji}
                  </T>
                ) : (
                  <T w="heading" style={styles.bannerTitle}>ما اتفقتوا، ما حدا طلع</T>
                )}
              </>
            )}
          </View>
        )}
        {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}

        <View style={styles.people}>
          {game.players.map((p) => (
            <PersonCard
              key={p.key}
              p={p}
              me={p.uid === uid}
              teammate={team.has(p.key) && p.uid !== uid}
              check={checks.get(p.key)}
              finalRole={game.roles?.[p.key]}
              votes={game.phase === 'vote' ? voteCount(p.key) : 0}
              votable={live && game.phase === 'vote' && alive && p.alive && p.key !== info?.key}
              voted={myVote === p.key}
              onVote={() => act(() => mafiaVote(game.id, p.key))}
            />
          ))}
        </View>

        {live && (game.phase === 'day' || game.phase === 'vote' || game.phase === 'morning' || game.phase === 'verdict') && (
          <>
            <View style={styles.chatBox}>
              {chat.length === 0 ? (
                <T style={{ fontSize: 13, color: colors.textDim, textAlign: 'center' }}>احكوا هون، أو بغرفة صوتية</T>
              ) : (
                chat.slice(-12).map((l) => (
                  <T key={l.id} style={{ fontSize: 14, lineHeight: 22 }}>
                    <T w="black" style={{ color: l.uid === uid ? colors.yellow : colors.sky }}>{l.uid === uid ? 'إنت' : l.name}: </T>
                    {l.text}
                  </T>
                ))
              )}
            </View>
            {alive && (
              <View style={styles.inputRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="شو رأيك؟"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  onSubmitEditing={() => {
                    say(text);
                    setText('');
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إرسال"
                  onPress={() => {
                    say(text);
                    setText('');
                  }}
                  style={styles.sendBtn}>
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

function PersonCard({
  p,
  me,
  teammate,
  check,
  finalRole,
  votes,
  votable,
  voted,
  onVote,
}: {
  p: MafiaPlayer;
  me: boolean;
  teammate: boolean;
  check?: boolean;
  finalRole?: MafiaRole;
  votes: number;
  votable: boolean;
  voted: boolean;
  onVote: () => void;
}) {
  const shown = p.role ?? finalRole;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!votable}
      onPress={onVote}
      style={[styles.person, !p.alive && { opacity: 0.45 }, voted && styles.targetOn, votable && styles.votable]}>
      <Avatar avatar={p.avatar} size={40} />
      <T w="black" style={{ fontSize: 12 }} numberOfLines={1}>
        {p.bot ? '🤖 ' : ''}{me ? 'إنت' : p.name}
      </T>
      {!p.alive && <T style={{ fontSize: 11 }}>💀</T>}
      {shown ? (
        <T w="bold" style={{ fontSize: 11, color: ROLES[shown].color }}>{ROLES[shown].emoji} {ROLES[shown].name}</T>
      ) : teammate ? (
        <T w="bold" style={{ fontSize: 11, color: colors.peach }}>🔪 جماعتك</T>
      ) : check !== undefined ? (
        <T w="bold" style={{ fontSize: 11, color: check ? colors.peach : '#7CF0A0' }}>{check ? '🔪 مافيا!' : '✅ بريء'}</T>
      ) : null}
      {votes > 0 && (
        <View style={styles.voteBadge}>
          <T w="black" style={{ fontSize: 11, color: colors.ink }}>{ar(votes)}</T>
        </View>
      )}
    </Pressable>
  );
}

function Finished({ game, uid, onBalance }: { game: MafiaGame; uid: string | null; onBalance: (c: number, g: number) => void }) {
  const [reward, setReward] = useState<{ won: boolean; coins: number; xp: number } | null>(null);
  useResultSound(reward ? reward.won : null);
  const [busy, setBusy] = useState(false);
  const vsBots = game.players.filter((p) => !p.bot).length === 1;

  useEffect(() => {
    if (!uid) return;
    myMafiaResult(game.id, uid).then((r) => r && setReward(r));
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
      <T style={{ fontSize: 52, lineHeight: 64 }}>{game.winner === 'mafia' ? '🔪' : '🎉'}</T>
      <T w="heading" style={{ fontSize: 28, lineHeight: 38, textAlign: 'center' }}>
        {game.winner === 'mafia' ? 'المافيا ربحت!' : game.winner === 'town' ? 'المواطنين ربحوا!' : 'خلصت اللعبة'}
      </T>
      {reward && (
        <>
          <T w="bold" style={{ fontSize: 15, color: reward.won ? '#7CF0A0' : colors.peach }}>{reward.won ? 'فريقك ربح 🏆' : 'فريقك خسر'}</T>
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
        </>
      )}
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 6 }}>
        <PillButton
          label={vsBots ? 'جولة كمان' : 'صالة المافيا'}
          disabled={busy}
          onPress={async () => {
            if (!vsBots) return router.replace('/mafia');
            setBusy(true);
            try {
              const id = await playMafiaVsBots();
              router.replace({ pathname: '/mafia-game', params: { id: String(id) } });
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
  pill: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center' },
  confirm: { marginTop: 6, marginHorizontal: 20, fontSize: 13, color: colors.peach, textAlign: 'center' },
  codeCard: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#3A1D72',
    alignItems: 'center',
    gap: 2,
  },
  grid: { marginTop: 16, marginHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  slot: { width: '25%', alignItems: 'center', gap: 4 },
  ring: { padding: 2, borderRadius: 30, borderWidth: 3, borderColor: colors.surfaceHigh },
  count: { marginTop: 10, textAlign: 'center', fontSize: 13, color: colors.textMuted },
  howTo: { marginTop: 14, marginHorizontal: 20, padding: 14, borderRadius: 20, backgroundColor: colors.surface, gap: 6 },
  howLine: { fontSize: 13, lineHeight: 21, color: colors.textMuted },
  wait: { textAlign: 'center', fontSize: 15, color: colors.textMuted },
  msg: { marginTop: 8, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  roleCard: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    backgroundColor: '#24104A',
    alignItems: 'center',
    gap: 4,
  },
  banner: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 10,
  },
  bannerTitle: { fontSize: 20, lineHeight: 30, textAlign: 'center' },
  targets: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  target: {
    width: '30%',
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#3A1D72',
    alignItems: 'center',
    gap: 3,
  },
  targetOn: { borderColor: colors.yellow, backgroundColor: '#4A2A8A' },
  skip: { height: 38, paddingHorizontal: 16, borderRadius: 19, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#3A1D72', justifyContent: 'center' },
  people: { marginTop: 12, marginHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  person: {
    width: '23%',
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 2,
  },
  votable: { borderColor: colors.surfaceHigh },
  voteBadge: {
    position: 'absolute',
    top: 4,
    end: 4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBox: { marginTop: 12, marginHorizontal: 20, minHeight: 60, padding: 12, borderRadius: 18, backgroundColor: colors.surface, gap: 2 },
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
