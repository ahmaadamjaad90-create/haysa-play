import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type BgPlayer = { uid: string | null; pid: number | null; name: string; avatar: string; seat: number; bot: boolean; left: boolean };

export type BgGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: BgPlayer[];
  // board[i-1] = البيت i: موجب للاعب ٠، سالب للاعب ١
  board: number[];
  bar: [number, number];
  off: [number, number];
  turn: number | null;
  phase: 'roll' | 'move' | null;
  dice: number[];
  rolled: number[];
  // [from, to, die]
  legal: [number, number, number][];
  last: { seat: number; roll?: number[]; stuck?: boolean; from?: number; to?: number; hit?: boolean } | null;
  winner: number | null;
  deadline: string | null;
  updated_at: string;
};

// البار والطلوع لكل مقعد (بإحداثيات السيرفر)
export const barOf = (seat: number) => (seat === 0 ? 25 : 0);
export const offOf = (seat: number) => (seat === 0 ? 0 : 25);

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createBg = () => rpc<number>('bg_create');
export const joinBg = (id: number) => rpc<BgGame>('bg_join', { gid: id });
export const addBgBot = (id: number) => rpc<BgGame>('bg_add_bot', { gid: id });
export const startBg = (id: number) => rpc<BgGame>('bg_start', { gid: id });
export const rollBg = (id: number) => rpc<BgGame>('bg_roll', { gid: id });
export const moveBg = (id: number, f: number, t: number) => rpc<BgGame>('bg_move', { gid: id, f, t });
export const tickBg = (id: number) => rpc<BgGame>('bg_tick', { gid: id });
export const leaveBg = (id: number) => rpc<void>('bg_leave', { gid: id });

export async function playBgVsBot() {
  const id = await createBg();
  await addBgBot(id);
  await startBg(id);
  return id;
}

export async function listWaitingBg(): Promise<BgGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('bg_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as BgGame[];
}

export async function myBgResult(id: number, uid: string) {
  const { data } = await supabase
    .from('bg_results')
    .select('won, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; coins: number; xp: number }>();
  return data;
}

export function useBgGame(id: number) {
  const [game, setGame] = useState<BgGame | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('bg_games')
      .select('*')
      .eq('id', id)
      .single<BgGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`bg-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bg_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as BgGame)),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  const apply = useCallback((g: BgGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, error, apply };
}

function newer(old: BgGame | null, g: BgGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
