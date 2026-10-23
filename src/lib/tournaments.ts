import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type Tournament = {
  id: number;
  title: string;
  game: 'baloot';
  size: number;
  prize_coins: number;
  starts_at: string | null;
  status: 'open' | 'running' | 'finished' | 'cancelled';
  winner_team: number | null;
  created_at: string;
};

type Person = { public_id: number; name: string | null; avatar: string };

export type TournamentTeam = {
  id: number;
  name: string;
  p1: string;
  p2: string;
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

export const createTournament = (title: string, size: number, prize: number, starts: string | null) =>
  rpc<number>('admin_create_tournament', { title, size, prize, starts });
export const registerTeam = (tid: number, partner: number, name: string) =>
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
