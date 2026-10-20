import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from './supabase';

export type DrawPlayer = { uid: string; pid: number; name: string; avatar: string; left: boolean; score: number };

export type DrawGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: DrawPlayer[];
  turn: number;
  total: number;
  drawer: string | null;
  phase: 'choosing' | 'drawing' | 'reveal' | null;
  hint: string | null;
  guessed: { uid: string; points: number }[];
  reveal: { word: string } | null;
  deadline: string | null;
  winner: string | null;
  updated_at: string;
};

// خط بالرسمة: النقاط من 0 لـ 1000 (x, y, x, y...) عشان تطلع نفس الشي على كل الشاشات
export type Stroke = { id: string; c: string; w: number; p: number[] };
export type DrawChat = { id: string; uid: string; name: string; text: string; ok?: boolean };

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createDraw = () => rpc<number>('draw_create');
export const joinDraw = (id: number) => rpc<DrawGame>('draw_join', { gid: id });
export const startDraw = (id: number) => rpc<DrawGame>('draw_start', { gid: id });
export const drawSecret = (id: number) =>
  rpc<{ choices: string[]; word: string | null } | null>('draw_secret', { gid: id });
export const pickWord = (id: number, idx: number) => rpc<DrawGame>('draw_pick', { gid: id, idx });
export const guessWord = (id: number, guess: string) =>
  rpc<{ correct: boolean; game?: DrawGame }>('draw_guess', { gid: id, guess });
export const tickDraw = (id: number) => rpc<DrawGame>('draw_tick', { gid: id });
export const leaveDraw = (id: number) => rpc<void>('draw_leave', { gid: id });

export async function listWaitingDraw(): Promise<DrawGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('draw_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as DrawGame[];
}

export async function myDrawResult(id: number, uid: string) {
  const { data } = await supabase
    .from('draw_results')
    .select('won, score, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; score: number; coins: number; xp: number }>();
  return data;
}

type Channel = ReturnType<typeof supabase.channel>;

// الطاولة لحظياً + الرسمة والشات (بينبعتوا مباشرة بين الجوالات، ما بينحفظوا)
export function useDrawGame(id: number, me: { uid: string | null; name: string }) {
  const [game, setGame] = useState<DrawGame | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [drawn, setDrawn] = useState<{ key: string; list: Stroke[] }>({ key: '', list: [] });
  const [chat, setChat] = useState<DrawChat[]>([]);
  const channel = useRef<Channel | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const pending = useRef<{ id: string; p: number[] } | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // الرسمة مربوطة بالدور، فلما يتغير الدور بيصير اللوح فاضي
  const keyRef = useRef('');
  const setAll = useCallback((next: Stroke[]) => {
    strokesRef.current = next;
    setDrawn({ key: keyRef.current, list: next });
  }, []);

  useEffect(() => {
    let alive = true;
    supabase
      .from('draw_games')
      .select('*')
      .eq('id', id)
      .single<DrawGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`draw-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'draw_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as DrawGame)),
      )
      .on('broadcast', { event: 'start' }, ({ payload }) => setAll([...strokesRef.current, payload as Stroke]))
      .on('broadcast', { event: 'pts' }, ({ payload }) => {
        const { id: sid, p } = payload as { id: string; p: number[] };
        setAll(strokesRef.current.map((s) => (s.id === sid ? { ...s, p: [...s.p, ...p] } : s)));
      })
      .on('broadcast', { event: 'clear' }, () => setAll([]))
      .on('broadcast', { event: 'all' }, ({ payload }) => setAll((payload as { strokes: Stroke[] }).strokes))
      // واحد فات جديد وبده الرسمة كاملة: الرسّام بيبعتها
      .on('broadcast', { event: 'need' }, () => {
        if (strokesRef.current.length) ch.send({ type: 'broadcast', event: 'all', payload: { strokes: strokesRef.current } });
      })
      .on('broadcast', { event: 'msg' }, ({ payload }) => setChat((c) => [...c.slice(-60), payload as DrawChat]))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'need', payload: {} });
      });
    channel.current = ch;
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id, setAll]);

  const turnKey = `${game?.turn}-${game?.drawer}`;
  useEffect(() => {
    keyRef.current = turnKey;
    strokesRef.current = [];
  }, [turnKey]);
  const strokes = drawn.key === turnKey ? drawn.list : [];

  const send = useCallback(
    (event: string, payload: object) => channel.current?.send({ type: 'broadcast', event, payload }),
    [],
  );

  const flush = useCallback(() => {
    flushTimer.current = null;
    if (pending.current && pending.current.p.length) send('pts', pending.current);
    pending.current = pending.current ? { id: pending.current.id, p: [] } : null;
  }, [send]);

  const beginStroke = useCallback(
    (c: string, w: number, x: number, y: number) => {
      flush();
      const s: Stroke = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, c, w, p: [x, y] };
      setAll([...strokesRef.current, s]);
      pending.current = { id: s.id, p: [] };
      send('start', s);
    },
    [flush, setAll, send],
  );

  const addPoint = useCallback(
    (x: number, y: number) => {
      const cur = pending.current;
      if (!cur) return;
      setAll(strokesRef.current.map((s) => (s.id === cur.id ? { ...s, p: [...s.p, x, y] } : s)));
      cur.p.push(x, y);
      if (!flushTimer.current) flushTimer.current = setTimeout(flush, 70);
    },
    [flush, setAll],
  );

  const endStroke = useCallback(() => {
    flush();
    pending.current = null;
  }, [flush]);

  const clear = useCallback(() => {
    setAll([]);
    send('clear', {});
  }, [setAll, send]);

  const say = useCallback(
    (text: string, ok?: boolean) => {
      if (!me.uid) return;
      const line: DrawChat = { id: `${Date.now()}-${Math.random()}`, uid: me.uid, name: me.name, text: text.slice(0, 80), ok };
      setChat((c) => [...c.slice(-60), line]);
      send('msg', line);
    },
    [me.uid, me.name, send],
  );

  const apply = useCallback((g: DrawGame | void | undefined) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, error, apply, strokes, chat, beginStroke, addPoint, endStroke, clear, say };
}

function newer(old: DrawGame | null, g: DrawGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
