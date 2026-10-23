import type { Href } from 'expo-router';

import { createBg, joinBg } from './backgammon';
import { createBaloot, joinBaloot } from './baloot';
import { createCode, joinCode } from './codewords';
import { createColors, joinColors } from './colors';
import { createDom, joinDom } from './domino';
import { createDraw, joinDraw } from './draw';
import { createKout, joinKout } from './kout';
import { createGame, joinGame } from './ludo';
import { createMafia, joinMafia } from './mafia';
import { createSpy, joinSpy } from './spy';
import { supabase } from './supabase';
import { createTrivia, joinTrivia } from './trivia';

// الألعاب اللي بتنفتح جوّا غرفة صوتية: الكل بيضل بصوت الغرفة وبيلعبوا على نفس الطاولة
export type RoomGameDef = {
  key: string;
  name: string;
  emoji: string;
  table: string;
  route: string;
  create: () => Promise<number>;
  join: (id: number) => Promise<unknown>;
};

export const ROOM_GAMES: RoomGameDef[] = [
  { key: 'ludo', name: 'لودو', emoji: '🎲', table: 'ludo_games', route: '/ludo-game', create: createGame, join: joinGame },
  { key: 'baloot', name: 'البلوت', emoji: '♠️', table: 'baloot_games', route: '/baloot-game', create: createBaloot, join: joinBaloot },
  { key: 'kout', name: 'كوت بو ستة', emoji: '🃏', table: 'kout_games', route: '/kout-game', create: createKout, join: joinKout },
  { key: 'spy', name: 'الجاسوس', emoji: '🕵️', table: 'spy_games', route: '/spy-game', create: createSpy, join: joinSpy },
  { key: 'mafia', name: 'المافيا', emoji: '🔪', table: 'mafia_games', route: '/mafia-game', create: createMafia, join: joinMafia },
  { key: 'trivia', name: 'تحدي الأسئلة', emoji: '🧠', table: 'trivia_games', route: '/trivia-game', create: () => createTrivia('mix'), join: joinTrivia },
  { key: 'draw', name: 'احزر الرسمة', emoji: '🎨', table: 'draw_games', route: '/draw-game', create: createDraw, join: joinDraw },
  { key: 'codewords', name: 'كلمات السر', emoji: '🔑', table: 'code_games', route: '/codewords-game', create: createCode, join: joinCode },
  { key: 'colors', name: 'ألوان', emoji: '🌈', table: 'colors_games', route: '/colors-game', create: createColors, join: joinColors },
  { key: 'domino', name: 'دومينو', emoji: '🁫', table: 'dom_games', route: '/domino-game', create: createDom, join: joinDom },
  { key: 'backgammon', name: 'طاولة الزهر', emoji: '🎯', table: 'bg_games', route: '/backgammon-game', create: createBg, join: joinBg },
];

export const roomGame = (key: string) => ROOM_GAMES.find((g) => g.key === key);

export const roomGameHref = (g: RoomGameDef, id: number, room: number) =>
  ({ pathname: g.route, params: { id: String(id), room: String(room) } }) as unknown as Href;

// حالة الطاولة (بنستنى، شغّالة، خلصت)
export async function roomGameStatus(g: RoomGameDef, id: number) {
  const { data } = await supabase.from(g.table).select('status').eq('id', id).maybeSingle<{ status: string }>();
  return data?.status ?? null;
}
