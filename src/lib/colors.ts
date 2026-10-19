import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type ColorKey = 'r' | 'g' | 'y' | 'b';

export type ColorsPlayer = {
  uid: string | null;
  pid: number | null;
  name: string;
  avatar: string;
  seat: number;
  bot: boolean;
  left: boolean;
  count: number;
};

export type ColorsLast =
  | { seat: number; draw: number }
  | { seat: number; play: string; color: ColorKey; target?: number; drawn?: number; uno?: boolean };

export type ColorsGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: ColorsPlayer[];
  turn: number | null;
  direction: 1 | -1;
  top: string | null;
  color: ColorKey | null;
  deadline: string | null;
  winner: number | null;
  last: ColorsLast | null;
  updated_at: string;
};

export const CARD_COLORS: Record<ColorKey, { bg: string; dark: string; name: string }> = {
  r: { bg: '#E5533A', dark: '#9E2412', name: 'أحمر' },
  g: { bg: '#2FB760', dark: '#1C7A3F', name: 'أخضر' },
  y: { bg: '#FFC93C', dark: '#B8860B', name: 'أصفر' },
  b: { bg: '#4FC3F7', dark: '#1E8FB0', name: 'أزرق' },
};

export const isWild = (c: string) => c === 'w' || c === 'w4';

// نفس فحص السيرفر
export function playable(c: string, top: string | null, color: ColorKey | null) {
  if (!top || !color) return false;
  return isWild(c) || c[0] === color || (!isWild(top) && c.slice(1) === top.slice(1));
}

// ترتيب الورق باليد: حسب اللون وبعدين القيمة
const ORDER = 'rgybw';
export function sortHand(cards: string[]) {
  return [...cards].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]) || a.localeCompare(b));
}

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createColors = () => rpc<number>('colors_create');
export const joinColors = (id: number) => rpc<ColorsGame>('colors_join', { gid: id });
export const addColorsBot = (id: number) => rpc<ColorsGame>('colors_add_bot', { gid: id });
export const startColors = (id: number) => rpc<ColorsGame>('colors_start', { gid: id });
export const playCard = (id: number, card: string, pick?: ColorKey) =>
  rpc<ColorsGame>('colors_play', { gid: id, card, pick: pick ?? null });
export const drawCard = (id: number) => rpc<ColorsGame>('colors_draw', { gid: id });
export const tickColors = (id: number) => rpc<ColorsGame>('colors_tick', { gid: id });
export const leaveColors = (id: number) => rpc<void>('colors_leave', { gid: id });

export async function playColorsVsBot() {
  const id = await createColors();
  await addColorsBot(id);
  await addColorsBot(id);
  await startColors(id);
  return id;
}

export async function listWaitingColors(): Promise<ColorsGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('colors_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as ColorsGame[];
}

export async function myColorsResult(id: number, uid: string) {
  const { data } = await supabase
    .from('colors_results')
    .select('won, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; coins: number; xp: number }>();
  return data;
}

// الطاولة لحظياً، وورقي بيتحدّث مع كل تغيير فيها
export function useColorsGame(id: number, uid: string | null) {
  const [game, setGame] = useState<ColorsGame | null>(null);
  const [hand, setHand] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('colors_games')
      .select('*')
      .eq('id', id)
      .single<ColorsGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`colors-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'colors_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as ColorsGame)),
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
      .from('colors_hands')
      .select('cards')
      .eq('game_id', id)
      .eq('user_id', uid)
      .maybeSingle<{ cards: string[] }>()
      .then(({ data }) => data && setHand(sortHand(data.cards)));
  }, [id, uid, started, stamp]);

  const apply = useCallback((g: ColorsGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, hand, error, apply };
}

function newer(old: ColorsGame | null, g: ColorsGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
