import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { BackButton, PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar, toLatinDigits } from '@/lib/format';
import { useSession } from '@/lib/session';
import {
  STATUS_NAMES,
  cancelTournament,
  leaveTournament,
  registerTeam,
  roundName,
  setMatchWinner,
  startTournament,
  useTournament,
  type TournamentMatch,
  type TournamentTeam,
} from '@/lib/tournaments';
import { colors, fonts } from '@/theme';

const ERRORS: [string, string][] = [
  ['partner not found', 'ما في لاعب بهالرقم'],
  ['partner is you', 'اكتب رقم شريكك، مش رقمك'],
  ['already registered', 'إنت أو شريكك مسجّلين أصلاً'],
  ['tournament full', 'البطولة امتلت'],
  ['registration closed', 'التسجيل سكّر'],
  ['banned', 'واحد منكم محظور'],
  ['need 2 teams', 'لازم فريقين ع الأقل'],
];
const friendly = (e: unknown) => {
  const t = errorText(e);
  return ERRORS.find(([k]) => t.includes(k))?.[1] ?? t;
};

// صفحة بطولة: التسجيل، الفرق، الشجرة، ومباراتي
export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, uid, loading } = useSession();
  const { t, teams, matches, error, reload } = useTournament(Number(id));
  const [partner, setPartner] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!loading && !user) return <Redirect href="/login" />;

  if (!t) {
    return (
      <Screen>
        <View style={styles.header}>
          <BackButton fallback="/tournaments" />
        </View>
        <T style={{ marginTop: 40, textAlign: 'center', color: colors.textMuted }}>{error ? errorText(error) : 'لحظة...'}</T>
      </Screen>
    );
  }

  const isAdmin = !!user?.isAdmin;
  const myTeam = teams.find((x) => x.p1 === uid || x.p2 === uid);
  const teamOf = (tid: number | null) => teams.find((x) => x.id === tid);
  const myMatch = myTeam && matches.find((m) => m.status === 'playing' && (m.team_a === myTeam.id || m.team_b === myTeam.id));
  const winner = teamOf(t.winner_team);
  const rounds = Math.log2(t.size);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/tournaments" />
        <T w="heading" style={styles.h1} numberOfLines={1}>{t.title}</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <T style={{ fontSize: 44, lineHeight: 54 }}>🏆</T>
          <View style={{ flex: 1, gap: 2 }}>
            <T w="black" style={{ fontSize: 16 }}>بطولة بلوت · {ar(t.size)} فرق · {STATUS_NAMES[t.status]}</T>
            <T style={{ fontSize: 13, color: '#FFE0D6' }}>
              {t.prize_coins ? `الجائزة: ${ar(t.prize_coins.toLocaleString('en'))} 🪙 لكل لاعب بالفريق الفائز` : 'بطولة ودّية'}
            </T>
            <T style={{ fontSize: 12, color: '#FFE0D6' }}>فريقين من لاعبين اتنين · خروج المغلوب · كل مباراة لـ 152</T>
          </View>
        </View>

        {winner && (
          <View style={[styles.card, { borderColor: colors.yellow, borderWidth: 2, alignItems: 'center' }]}>
            <T w="heading" style={{ fontSize: 22, lineHeight: 30 }}>👑 الأبطال: {winner.name}</T>
            <T style={{ color: colors.textMuted }}>{winner.a?.name} و {winner.b?.name}</T>
          </View>
        )}

        {myMatch && myMatch.game_id && (
          <PillButton
            label="مباراتك جاهزة! يلا العب ♠️"
            onPress={() => router.push({ pathname: '/baloot-game', params: { id: String(myMatch.game_id) } })}
          />
        )}

        {t.status === 'open' &&
          (myTeam ? (
            <View style={styles.card}>
              <T w="black" style={{ fontSize: 16 }}>إنت مسجّل بفريق «{myTeam.name}» ✅</T>
              <T style={{ fontSize: 13, color: colors.textMuted }}>لما تبلّش البطولة بتطلعلك مباراتك هون.</T>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => act(() => leaveTournament(t.id))}>
                <T w="bold" style={{ fontSize: 13, color: colors.peach }}>انسحاب</T>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <T w="black" style={{ fontSize: 16 }}>سجّل فريقك</T>
              <TextInput
                value={teamName}
                onChangeText={setTeamName}
                maxLength={20}
                placeholder="اسم الفريق"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
              <TextInput
                value={partner}
                onChangeText={(x) => setPartner(x.replace(/[^0-9٠-٩]/g, ''))}
                keyboardType="number-pad"
                placeholder="رقم الـ ID تبع شريكك"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
              <PillButton
                label="سجّل"
                disabled={busy || teamName.trim().length < 2 || !partner}
                onPress={() => act(() => registerTeam(t.id, Number(toLatinDigits(partner)), teamName.trim()))}
              />
            </View>
          ))}

        {!!msg && <T w="bold" style={{ color: colors.peach, textAlign: 'center' }}>{msg}</T>}

        {isAdmin && (t.status === 'open' || t.status === 'running') && (
          <View style={[styles.card, { borderColor: colors.sky, borderWidth: 1 }]}>
            <T w="black" style={{ fontSize: 15, color: colors.sky }}>👑 تحكم الأدمن</T>
            {t.status === 'open' && (
              <PillButton label={`ابدأ البطولة (${ar(teams.length)} فرق)`} disabled={busy} onPress={() => act(() => startTournament(t.id))} />
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => (confirmCancel ? act(() => cancelTournament(t.id)) : setConfirmCancel(true))}>
              <T w="bold" style={{ fontSize: 13, color: confirmCancel ? colors.alert : colors.textDim, textAlign: 'center' }}>
                {confirmCancel ? 'متأكد؟ اضغط كمان مرة لإلغاء البطولة' : 'إلغاء البطولة'}
              </T>
            </Pressable>
          </View>
        )}

        {matches.length > 0 &&
          Array.from({ length: rounds }, (_, i) => i + 1).map((r) => {
            const ms = Array.from({ length: t.size / 2 ** r }, (_, slot) => matches.find((m) => m.round === r && m.slot === slot));
            return (
              <View key={r} style={{ gap: 8 }}>
                <T w="heading" style={{ fontSize: 20, lineHeight: 28 }}>{roundName(r, t.size)}</T>
                {ms.map((m, slot) => (
                  <MatchCard
                    key={slot}
                    m={m}
                    a={teamOf(m?.team_a ?? null)}
                    b={teamOf(m?.team_b ?? null)}
                    mine={myTeam?.id}
                    admin={isAdmin && t.status === 'running'}
                    busy={busy}
                    onWin={(side) => m && act(() => setMatchWinner(m.id, side))}
                  />
                ))}
              </View>
            );
          })}

        <T w="heading" style={{ fontSize: 20, lineHeight: 28 }}>الفرق ({ar(teams.length)} من {ar(t.size)})</T>
        {teams.length === 0 && <T style={{ color: colors.textMuted }}>لسا ما في فرق. كون أول فريق!</T>}
        {teams.map((x) => (
          <TeamRow key={x.id} team={x} mine={x.id === myTeam?.id} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function TeamRow({ team, mine }: { team: TournamentTeam; mine: boolean }) {
  return (
    <View style={[styles.team, mine && { borderColor: colors.yellow }, team.eliminated && { opacity: 0.45 }]}>
      <View style={{ flexDirection: 'row' }}>
        <Avatar avatar={team.a?.avatar ?? 'dalla'} size={32} />
        <View style={{ marginStart: -10 }}>
          <Avatar avatar={team.b?.avatar ?? 'dalla'} size={32} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="black" style={{ fontSize: 15 }} numberOfLines={1}>{team.name}</T>
        <T style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>{team.a?.name ?? 'لاعب'} و {team.b?.name ?? 'لاعب'}</T>
      </View>
      {team.eliminated && <T style={{ fontSize: 12, color: colors.textDim }}>خرج</T>}
    </View>
  );
}

function MatchCard({
  m,
  a,
  b,
  mine,
  admin,
  busy,
  onWin,
}: {
  m?: TournamentMatch;
  a?: TournamentTeam;
  b?: TournamentTeam;
  mine?: number;
  admin: boolean;
  busy: boolean;
  onWin: (side: 'a' | 'b') => void;
}) {
  const side = (team: TournamentTeam | undefined, s: 'a' | 'b') => {
    const won = !!m?.winner && m.winner === team?.id;
    const lost = !!m?.winner && !!team && m.winner !== team.id;
    return (
      <View style={styles.side}>
        <T
          w={won ? 'black' : 'bold'}
          style={[{ fontSize: 14, flex: 1 }, won && { color: colors.yellow }, lost && { color: colors.textDim }, team?.id === mine && { textDecorationLine: 'underline' }]}
          numberOfLines={1}>
          {won ? '🏅 ' : ''}{team?.name ?? (m?.status === 'done' || (m && !m.team_b && s === 'b') ? '—' : 'بنستنى...')}
        </T>
        {admin && m?.status !== 'done' && team && (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => onWin(s)} style={styles.winBtn}>
            <T w="black" style={{ fontSize: 11, color: colors.ink }}>رابح</T>
          </Pressable>
        )}
      </View>
    );
  };
  return (
    <View style={styles.match}>
      {side(a, 'a')}
      <View style={styles.vs}>
        <T w="black" style={{ fontSize: 11, color: colors.textDim }}>
          {m?.status === 'playing' ? '🔴 عم يلعبوا' : m?.status === 'done' ? 'خلصت' : 'ضد'}
        </T>
      </View>
      {side(b, 'b')}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { flex: 1, fontSize: 26, lineHeight: 36 },
  hero: { padding: 16, borderRadius: 24, backgroundColor: '#8A4E2C', flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { padding: 14, borderRadius: 20, backgroundColor: colors.surface, gap: 10 },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.bg,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'right',
  },
  team: {
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  match: { borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' },
  side: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  vs: { paddingHorizontal: 14, paddingVertical: 2, backgroundColor: colors.bg },
  winBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.yellow },
});
