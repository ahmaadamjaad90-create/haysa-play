import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type LudoPlayer = {
  uid: string | null;
  pid: number | null;
  name: string;
  avatar: string;
  seat: number;
  bot: boolean;
  left: boolean;
};

export type LudoLast =
  | { seat: number; roll: number; three_sixes?: boolean }
  | {
      seat: number;
      token: number;
      from: number;
      to: number;
      dice: number;
      captured: { seat: number; token: number; from: number }[];
    };

export type LudoGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: LudoPlayer[];
  // tokens[seat*4 + i]: -1 بالبيت، 0..50 عالطريق، 51..55 الممر الملون، 56 وصل
  tokens: number[];
  turn: number | null;
  phase: 'roll' | 'move' | null;
  dice: number | null;
  deadline: string | null;
  winner: number | null;
  last: LudoLast | null;
  updated_at: string;
};

// لون كل مقعد (المقعد 0 فوق عاليسار، وبعدين مع عقارب الساعة)
export const SEAT_COLORS = ['#E5533A', '#2FB760', '#FFC93C', '#4FC3F7'];
export const SEAT_DARK = ['#9E2412', '#1C7A3F', '#B8860B', '#1E8FB0'];
export const SEAT_NAMES = ['الأحمر', 'الأخضر', 'الأصفر', 'الأزرق'];

// ===== شكل اللوح (15×15) =====

type Cell = [number, number]; // [عمود، صف]

function line(from: Cell, to: Cell): Cell[] {
  const out: Cell[] = [];
  const dc = Math.sign(to[0] - from[0]);
  const dr = Math.sign(to[1] - from[1]);
  for (let c = from[0], r = from[1]; ; c += dc, r += dr) {
    out.push([c, r]);
    if (c === to[0] && r === to[1]) break;
  }
  return out;
}

// الطريق المشترك (52 مربع) من بداية المقعد 0
export const TRACK: Cell[] = [
  ...line([1, 6], [5, 6]),
  ...line([6, 5], [6, 0]),
  [7, 0],
  ...line([8, 0], [8, 5]),
  ...line([9, 6], [14, 6]),
  [14, 7],
  ...line([14, 8], [9, 8]),
  ...line([8, 9], [8, 14]),
  [7, 14],
  ...line([6, 14], [6, 9]),
  ...line([5, 8], [0, 8]),
  [0, 7],
  [0, 6],
];

export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

// زاوية بيت كل مقعد
export const BASE_ORIGIN: Cell[] = [
  [0, 0],
  [9, 0],
  [9, 9],
  [0, 9],
];
const BASE_SPOTS: Cell[] = [
  [2, 2],
  [4, 2],
  [2, 4],
  [4, 4],
];

// الممر الملون لكل مقعد (خطوة 1..5)
function homeCell(seat: number, step: number): Cell {
  switch (seat) {
    case 0:
      return [step, 7];
    case 1:
      return [7, step];
    case 2:
      return [14 - step, 7];
    default:
      return [7, 14 - step];
  }
}

export function homeColumn(seat: number): Cell[] {
  return [1, 2, 3, 4, 5].map((s) => homeCell(seat, s));
}

const FINISH: Cell[] = [
  [6.85, 7.5],
  [7.5, 6.85],
  [8.15, 7.5],
  [7.5, 8.15],
];

// مركز الحجر بوحدات المربعات
export function tokenCenter(seat: number, token: number, rel: number): Cell {
  if (rel < 0) {
    const o = BASE_ORIGIN[seat];
    const s = BASE_SPOTS[token];
    return [o[0] + s[0], o[1] + s[1]];
  }
  if (rel >= 56) return FINISH[seat];
  const cell = rel <= 50 ? TRACK[(seat * 13 + rel) % 52] : homeCell(seat, rel - 50);
  return [cell[0] + 0.5, cell[1] + 0.5];
}

// نفس فحص السيرفر: أي أحجار بتقدر تتحرك
export function legalTokens(g: LudoGame): number[] {
  if (g.turn == null || g.dice == null || g.phase !== 'move') return [];
  const out: number[] = [];
  for (let t = 0; t < 4; t++) {
    const r = g.tokens[g.turn * 4 + t];
    if ((r === -1 && g.dice === 6) || (r >= 0 && r + g.dice <= 56)) out.push(t);
  }
  return out;
}

// ===== السيرفر =====

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createGame = () => rpc<number>('ludo_create');
export const joinGame = (id: number) => rpc<LudoGame>('ludo_join', { gid: id });
export const addBot = (id: number) => rpc<LudoGame>('ludo_add_bot', { gid: id });
export const startGame = (id: number) => rpc<LudoGame>('ludo_start', { gid: id });
export const rollDice = (id: number) => rpc<LudoGame>('ludo_roll', { gid: id });
export const moveToken = (id: number, token: number) => rpc<LudoGame>('ludo_move', { gid: id, token });
export const tickGame = (id: number) => rpc<LudoGame>('ludo_tick', { gid: id });
export const leaveGame = (id: number) => rpc<void>('ludo_leave', { gid: id });

// طاولة ضد الكمبيوتر: بتبدأ فوراً
export async function playVsBot() {
  const id = await createGame();
  await addBot(id);
  await startGame(id);
  return id;
}

export async function listWaiting(): Promise<LudoGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('ludo_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as LudoGame[];
}

export async function myResult(id: number, uid: string) {
  const { data } = await supabase
    .from('ludo_results')
    .select('won, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; coins: number; xp: number }>();
  return data;
}

// الطاولة لحظياً: أول تحميل + كل تغيير من السيرفر
export function useLudoGame(id: number) {
  const [game, setGame] = useState<LudoGame | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('ludo_games')
      .select('*')
      .eq('id', id)
      .single<LudoGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`ludo-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ludo_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as LudoGame)),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  // نتيجة الطلب نفسه بتوصل قبل الرسالة اللحظية، فمنعرضها فوراً
  const apply = useCallback((g: LudoGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, error, apply };
}

function newer(old: LudoGame | null, g: LudoGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
