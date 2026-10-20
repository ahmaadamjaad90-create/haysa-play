import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type Suit = 's' | 'h' | 'd' | 'c';

export type BalootPlayer = {
  uid: string | null;
  pid: number | null;
  name: string;
  avatar: string;
  seat: number;
  bot: boolean;
  left: boolean;
  count: number;
};

export type BalootGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: BalootPlayer[];
  scores: [number, number];
  round: number;
  dealer: number;
  phase: 'bid1' | 'bid2' | 'play' | 'roundend' | null;
  face: string | null;
  // sun / hokm / hokm:s / pass
  bids: Record<string, string>;
  kind: 'sun' | 'hokm' | null;
  buyer: number | null;
  trump: Suit | null;
  turn: number | null;
  trick: { seat: number; card: string }[];
  abnat: [number, number];
  tricks: number;
  last_trick: { cards: { seat: number; card: string }[]; winner: number } | null;
  projects: { seat: number; name: string; points: number; baloot?: boolean }[];
  result: {
    made: boolean;
    buyer: number;
    kind: 'sun' | 'hokm';
    abnat: [number, number];
    gain: [number, number];
    projects: [number, number];
  } | null;
  winner: number | null;
  deadline: string | null;
  updated_at: string;
};

export const TARGET = 152;
export const teamOf = (seat: number) => seat % 2;
export const KIND_NAMES = { sun: 'صن', hokm: 'حكم' } as const;

// ترتيب الورق باليد: حسب النوع وبعدين القوة
const RANK = 'ATKQJ987';
export function sortHand(cards: string[]) {
  const order = (c: string) => 'shdc'.indexOf(c[0]) * 10 + RANK.indexOf(c[1]);
  return [...cards].sort((a, b) => order(a) - order(b));
}

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createBaloot = () => rpc<number>('baloot_create');
export const joinBaloot = (id: number) => rpc<BalootGame>('baloot_join', { gid: id });
export const addBalootBot = (id: number) => rpc<BalootGame>('baloot_add_bot', { gid: id });
export const startBaloot = (id: number) => rpc<BalootGame>('baloot_start', { gid: id });
export const bidBaloot = (id: number, b: string) => rpc<BalootGame>('baloot_bid', { gid: id, b });
export const playBaloot = (id: number, card: string) => rpc<BalootGame>('baloot_play', { gid: id, card });
export const balootLegal = (id: number) => rpc<string[]>('baloot_legal', { gid: id });
export const tickBaloot = (id: number) => rpc<BalootGame>('baloot_tick', { gid: id });
export const leaveBaloot = (id: number) => rpc<void>('baloot_leave', { gid: id });

export async function playBalootVsBots() {
  const id = await createBaloot();
  for (let i = 0; i < 3; i++) await addBalootBot(id);
  await startBaloot(id);
  return id;
}

export async function listWaitingBaloot(): Promise<BalootGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('baloot_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as BalootGame[];
}

export async function myBalootResult(id: number, uid: string) {
  const { data } = await supabase
    .from('baloot_results')
    .select('won, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; coins: number; xp: number }>();
  return data;
}

// الطاولة لحظياً، وورقي والورق المسموح بيتحدّثوا مع كل تغيير
export function useBalootGame(id: number, uid: string | null) {
  const [game, setGame] = useState<BalootGame | null>(null);
  const [hand, setHand] = useState<string[]>([]);
  const [legal, setLegal] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('baloot_games')
      .select('*')
      .eq('id', id)
      .single<BalootGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`baloot-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'baloot_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as BalootGame)),
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
      .from('baloot_hands')
      .select('cards')
      .eq('game_id', id)
      .eq('user_id', uid)
      .maybeSingle<{ cards: string[] }>()
      .then(({ data }) => data && setHand(sortHand(data.cards)));
    balootLegal(id).then(setLegal).catch(() => setLegal([]));
  }, [id, uid, started, stamp]);

  const apply = useCallback((g: BalootGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, hand, legal, error, apply };
}

function newer(old: BalootGame | null, g: BalootGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
