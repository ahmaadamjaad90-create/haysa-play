import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type Suit = 's' | 'h' | 'd' | 'c';

export type KoutPlayer = {
  uid: string | null;
  pid: number | null;
  name: string;
  avatar: string;
  seat: number;
  bot: boolean;
  left: boolean;
  count: number;
};

export type KoutGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: KoutPlayer[];
  scores: [number, number];
  round: number;
  dealer: number;
  phase: 'bid' | 'trump' | 'play' | 'roundend' | null;
  bids: Record<string, number>;
  bid: number | null;
  bidder: number | null;
  malzoom: boolean;
  trump: Suit | null;
  turn: number | null;
  trick: { seat: number; card: string }[];
  played: string[];
  taken: [number, number];
  last_trick: { cards: { seat: number; card: string }[]; winner: number } | null;
  result: { made: boolean; team: number; points: number; bid: number; bidder: number } | null;
  winner: number | null;
  deadline: string | null;
  updated_at: string;
};

export const BID_NAMES: Record<number, string> = { 5: 'باب', 6: 'ستة', 7: 'سبعة', 8: 'تمانية', 9: 'بوان' };
export const TARGET = 31;
export const teamOf = (seat: number) => seat % 2;

// ترتيب الورق باليد: حسب النوع وبعدين القوة
const RANK = 'AKQJT9876';
export function sortHand(cards: string[]) {
  const order = (c: string) => (c === 'JR' ? -2 : c === 'JB' ? -1 : 'shdc'.indexOf(c[0]) * 10 + RANK.indexOf(c[1]));
  return [...cards].sort((a, b) => order(a) - order(b));
}

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createKout = () => rpc<number>('kout_create');
export const joinKout = (id: number) => rpc<KoutGame>('kout_join', { gid: id });
export const addKoutBot = (id: number) => rpc<KoutGame>('kout_add_bot', { gid: id });
export const startKout = (id: number) => rpc<KoutGame>('kout_start', { gid: id });
export const bidKout = (id: number, n: number) => rpc<KoutGame>('kout_bid', { gid: id, n });
export const chooseTrump = (id: number, suit: Suit) => rpc<KoutGame>('kout_trump', { gid: id, suit });
export const playKout = (id: number, card: string) => rpc<KoutGame>('kout_play', { gid: id, card });
export const koutLegal = (id: number) => rpc<string[]>('kout_legal', { gid: id });
export const tickKout = (id: number) => rpc<KoutGame>('kout_tick', { gid: id });
export const leaveKout = (id: number) => rpc<void>('kout_leave', { gid: id });

export async function playKoutVsBots() {
  const id = await createKout();
  for (let i = 0; i < 3; i++) await addKoutBot(id);
  await startKout(id);
  return id;
}

export async function listWaitingKout(): Promise<KoutGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('kout_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as KoutGame[];
}

export async function myKoutResult(id: number, uid: string) {
  const { data } = await supabase
    .from('kout_results')
    .select('won, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; coins: number; xp: number }>();
  return data;
}

// الطاولة لحظياً، وورقي والورق المسموح بيتحدّثوا مع كل تغيير
export function useKoutGame(id: number, uid: string | null) {
  const [game, setGame] = useState<KoutGame | null>(null);
  const [hand, setHand] = useState<string[]>([]);
  const [legal, setLegal] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('kout_games')
      .select('*')
      .eq('id', id)
      .single<KoutGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`kout-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kout_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as KoutGame)),
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
      .from('kout_hands')
      .select('cards')
      .eq('game_id', id)
      .eq('user_id', uid)
      .maybeSingle<{ cards: string[] }>()
      .then(({ data }) => data && setHand(sortHand(data.cards)));
    koutLegal(id).then(setLegal).catch(() => setLegal([]));
  }, [id, uid, started, stamp]);

  const apply = useCallback((g: KoutGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, hand, legal, error, apply };
}

function newer(old: KoutGame | null, g: KoutGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
