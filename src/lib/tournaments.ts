import { useCallback, useEffect, useState } from 'react';

import { ar } from './format';
import { roomGame } from './roomGames';
import { supabase } from './supabase';

export type Tournament = {
  id: number;
  title: string;
  game: TournamentGame;
  size: number;
  prize_coins: number;
  prize_gems: number;
  starts_at: string | null;
  status: 'open' | 'running' | 'finished' | 'cancelled';
  winner_team: number | null;
  created_by: string | null;
  created_at: string;
};

type Person = { public_id: number; name: string | null; avatar: string };

export type TournamentTeam = {
  id: number;
  name: string;
  p1: string;
  // null بالألعاب الفردية
  p2: string | null;
  eliminated: boolean;
  a: Person | null;
  b: Person | null;
};

export type TournamentMatch = {
  id: number;
  round: number;
  slot: number;
  team_a: number | null;
  team_b: number | null;
  game_id: number | null;
  winner: number | null;
  status: 'pending' | 'playing' | 'done';
};

// الألعاب اللي فيها بطولات (فرق من اتنين بالبلوت والكوت، والباقي لاعب ضد لاعب)
export const TOURNAMENT_GAMES = ['baloot', 'kout', 'ludo', 'colors', 'domino', 'backgammon', 'trivia'] as const;
export type TournamentGame = (typeof TOURNAMENT_GAMES)[number];
export const isTeamGame = (g: string) => g === 'baloot' || g === 'kout';
export const gameInfo = (g: string) => roomGame(g)!;

// « · الجائزة 100 🪙 + 5 💎» أو فاضي
export function prizeText(t: Tournament) {
  const parts = [t.prize_coins && `${ar(t.prize_coins.toLocaleString('en'))} 🪙`, t.prize_gems && `${ar(t.prize_gems.toLocaleString('en'))} 💎`].filter(Boolean);
  return parts.length ? ` · الجائزة ${parts.join(' + ')}` : '';
}

export const STATUS_NAMES: Record<Tournament['status'], string> = {
  open: 'التسجيل مفتوح',
  running: 'شغّالة',
  finished: 'خلصت',
  cancelled: 'انلغت',
};

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createTournament = (game: TournamentGame, title: string, size: number, coins: number, gems: number) =>
  rpc<number>('admin_create_tournament', { game, title, size, prize_coins: coins, prize_gems: gems, starts: null });
// partner = null بالألعاب الفردية
export const registerTeam = (tid: number, partner: number | null, name: string) =>
  rpc<number>('tournament_register', { tid, partner, team_name: name });
export const leaveTournament = (tid: number) => rpc<void>('tournament_leave', { tid });
export const startTournament = (tid: number) => rpc<void>('admin_start_tournament', { tid });
export const setMatchWinner = (mid: number, side: 'a' | 'b') => rpc<void>('admin_set_match_winner', { mid, side });
export const cancelTournament = (tid: number) => rpc<void>('admin_cancel_tournament', { tid });

export async function listTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*').order('id', { ascending: false }).limit(30);
  if (error) throw error;
  return data as Tournament[];
}

// اسم الجولة حسب كم باقي للنهائي
export function roundName(round: number, size: number) {
  const left = Math.log2(size) - round;
  return left === 0 ? 'النهائي' : left === 1 ? 'نص النهائي' : left === 2 ? 'ربع النهائي' : `الجولة ${round}`;
}

// البطولة وفرقها ومبارياتها، وأي تغيير بيوصل فوراً
export function useTournament(id: number) {
  const [t, setT] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single<Tournament>(),
        supabase
          .from('tournament_teams')
          .select(
            'id, name, p1, p2, eliminated, a:profiles!tournament_teams_p1_fkey(public_id, name, avatar), b:profiles!tournament_teams_p2_fkey(public_id, name, avatar)',
          )
          .eq('tournament_id', id)
          .order('id'),
        supabase.from('tournament_matches').select('*').eq('tournament_id', id).order('round').order('slot'),
      ]);
      if (a.error) throw a.error;
      setT(a.data);
      setTeams((b.data ?? []) as unknown as TournamentTeam[]);
      setMatches((c.data ?? []) as TournamentMatch[]);
    } catch (e) {
      setError(e);
    }
  }, [id]);

  useEffect(() => {
    // التحميل الأول بعد ما يخلص الرندر
    const first = setTimeout(load, 0);
    const ch = supabase
      .channel(`tournament-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_teams', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, load)
      .subscribe();
    return () => {
      clearTimeout(first);
      supabase.removeChannel(ch);
    };
  }, [id, load]);

  return { t, teams, matches, error, reload: load };
}
