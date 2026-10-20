import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type DomPlayer = {
  uid: string | null;
  pid: number | null;
  name: string;
  avatar: string;
  seat: number;
  bot: boolean;
  left: boolean;
  count: number;
};

export type DomGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: DomPlayer[];
  // من اليسار لليمين
  chain: [number, number][];
  pile: number;
  turn: number | null;
  last: { seat: number; play?: string; side?: 'L' | 'R'; drew?: number; pass?: boolean; blocked?: boolean } | null;
  winner: number | null;
  pips: Record<string, number> | null;
  deadline: string | null;
  updated_at: string;
};

export const tileA = (t: string) => Number(t.split('-')[0]);
export const tileB = (t: string) => Number(t.split('-')[1]);

export const leftEnd = (g: DomGame) => (g.chain.length ? g.chain[0][0] : null);
export const rightEnd = (g: DomGame) => (g.chain.length ? g.chain[g.chain.length - 1][1] : null);

// على أي طرف بينفع الحجر
export function sidesFor(g: DomGame, t: string): ('L' | 'R')[] {
  if (!g.chain.length) return ['R'];
  const a = tileA(t);
  const b = tileB(t);
  const out: ('L' | 'R')[] = [];
  const l = leftEnd(g);
  const r = rightEnd(g);
  if (a === l || b === l) out.push('L');
  if (a === r || b === r) out.push('R');
  return out;
}

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createDom = () => rpc<number>('dom_create');
export const joinDom = (id: number) => rpc<DomGame>('dom_join', { gid: id });
export const addDomBot = (id: number) => rpc<DomGame>('dom_add_bot', { gid: id });
export const startDom = (id: number) => rpc<DomGame>('dom_start', { gid: id });
export const playTile = (id: number, tile: string, side: 'L' | 'R') => rpc<DomGame>('dom_play', { gid: id, tile, side });
export const drawTile = (id: number) => rpc<DomGame>('dom_draw', { gid: id });
export const tickDom = (id: number) => rpc<DomGame>('dom_tick', { gid: id });
export const leaveDom = (id: number) => rpc<void>('dom_leave', { gid: id });

export async function playDomVsBot() {
  const id = await createDom();
  await addDomBot(id);
  await startDom(id);
  return id;
}

export async function listWaitingDom(): Promise<DomGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('dom_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as DomGame[];
}

export async function myDomResult(id: number, uid: string) {
  const { data } = await supabase
    .from('dom_results')
    .select('won, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; coins: number; xp: number }>();
  return data;
}

// الطاولة لحظياً، وأحجاري بتتحدّث مع كل تغيير
export function useDomGame(id: number, uid: string | null) {
  const [game, setGame] = useState<DomGame | null>(null);
  const [hand, setHand] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('dom_games')
      .select('*')
      .eq('id', id)
      .single<DomGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`dom-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dom_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as DomGame)),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  const stamp = game?.updated_at;
  const started = !!game && game.status !== 'waiting';
  useEffect(() => {
    if (!uid || !started) return;
    supabase
      .from('dom_hands')
      .select('tiles')
      .eq('game_id', id)
      .eq('user_id', uid)
      .maybeSingle<{ tiles: string[] }>()
      .then(({ data }) => data && setHand([...data.tiles].sort((x, y) => tileA(x) + tileB(x) - (tileA(y) + tileB(y)))));
  }, [id, uid, started, stamp]);

  const apply = useCallback((g: DomGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, hand, error, apply };
}

function newer(old: DomGame | null, g: DomGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
