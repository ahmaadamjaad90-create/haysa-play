import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type Team = 'r' | 'b';
// r أحمر، b أزرق، n محايد، x قنبلة
export type CardColor = Team | 'n' | 'x';

export const TEAMS: Record<Team, { name: string; color: string; dark: string }> = {
  r: { name: 'الأحمر', color: '#E5533A', dark: '#9E2412' },
  b: { name: 'الأزرق', color: '#4FC3F7', dark: '#1E8FB0' },
};

export type CodePlayer = {
  uid: string;
  pid: number;
  name: string;
  avatar: string;
  team: Team | null;
  boss: boolean;
  left: boolean;
};

export type CodeGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: CodePlayer[];
  words: string[] | null;
  revealed: (CardColor | null)[] | null;
  goal: Record<Team, number> | null;
  turn: Team | null;
  phase: 'clue' | 'guess' | null;
  clue: { word: string; count: number } | null;
  guesses_left: number | null;
  last: { pick?: number; color?: CardColor; by?: string; pass?: boolean; skip?: boolean } | null;
  winner: Team | null;
  key: CardColor[] | null;
  deadline: string | null;
  updated_at: string;
};

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createCode = () => rpc<number>('code_create');
export const joinCode = (id: number) => rpc<CodeGame>('code_join', { gid: id });
export const startCode = (id: number) => rpc<CodeGame>('code_start', { gid: id });
export const codeKey = (id: number) => rpc<CardColor[] | null>('code_key', { gid: id });
export const giveClue = (id: number, word: string, cnt: number) => rpc<CodeGame>('code_clue', { gid: id, word, cnt });
export const pickCard = (id: number, idx: number) => rpc<CodeGame>('code_pick', { gid: id, idx });
export const passTurn = (id: number) => rpc<CodeGame>('code_pass', { gid: id });
export const tickCode = (id: number) => rpc<CodeGame>('code_tick', { gid: id });
export const leaveCode = (id: number) => rpc<void>('code_leave', { gid: id });

export async function listWaitingCode(): Promise<CodeGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('code_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as CodeGame[];
}

export async function myCodeResult(id: number, uid: string) {
  const { data } = await supabase
    .from('code_results')
    .select('won, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; coins: number; xp: number }>();
  return data;
}

export function useCodeGame(id: number) {
  const [game, setGame] = useState<CodeGame | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('code_games')
      .select('*')
      .eq('id', id)
      .single<CodeGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`code-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'code_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as CodeGame)),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  const apply = useCallback((g: CodeGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, error, apply };
}

function newer(old: CodeGame | null, g: CodeGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
