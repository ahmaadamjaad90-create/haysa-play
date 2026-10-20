// دالة على Supabase بتعطي اللاعب "تذكرة" لصوت LiveKit، وبتجيب عدد الناس بالغرف.
// المفاتيح السرية بتنحط بـ Supabase ← Edge Functions ← Secrets:
//   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken, RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';

const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL') ?? '';
const API_KEY = Deno.env.get('LIVEKIT_API_KEY') ?? '';
const API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// مفتاح السيرفر تبع Supabase: القديم (service_role) أو الجديد (sb_secret_...)
function serverKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  return (keys.default ?? Object.values(keys)[0]) as string;
}

// صوت ورسائل جوّا الألعاب: اسم اللعبة ← جدولها
const GAME_TABLES: Record<string, string> = {
  ludo: 'ludo_games',
  spy: 'spy_games',
  colors: 'colors_games',
  trivia: 'trivia_games',
  draw: 'draw_games',
  mafia: 'mafia_games',
  codewords: 'code_games',
  domino: 'dom_games',
  backgammon: 'bg_games',
  kout: 'kout_games',
  baloot: 'baloot_games',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey());
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: auth } = await admin.auth.getUser(jwt);
    if (!auth.user) return json({ error: 'not signed in' }, 401);

    const body = await req.json();

    // عدد الناس وعدد اللي على المايك بكل غرفة شغّالة
    if (body.action === 'stats') {
      const svc = new RoomServiceClient(LIVEKIT_URL.replace('wss://', 'https://'), API_KEY, API_SECRET);
      const rooms = await svc.listRooms();
      return json(
        Object.fromEntries(rooms.map((r) => [r.name, { listeners: r.numParticipants, onMic: r.numPublishers }])),
      );
    }

    // تذكرة دخول لغرفة، أو لطاولة لعبة (بس للاعبين اللي عليها)
    let roomName: string;
    let isOwner = false;
    if (body.action === 'game') {
      const table = GAME_TABLES[body.game];
      if (!table) return json({ error: 'unknown game' }, 400);
      const { data: game } = await admin.from(table).select('players').eq('id', Number(body.id)).maybeSingle();
      const players = (game?.players ?? []) as { uid?: string | null }[];
      if (!players.some((p) => p.uid === auth.user!.id)) return json({ error: 'not a player' }, 403);
      roomName = `game-${body.game}-${Number(body.id)}`;
    } else {
      const number = Number(body.room);
      const { data: room } = await admin.from('rooms').select('owner').eq('number', number).maybeSingle();
      if (!room) return json({ error: 'room not found' }, 404);
      roomName = String(number);
      isOwner = room.owner === auth.user.id;
    }

    const { data: me } = await admin
      .from('profiles')
      .select('public_id, name, avatar')
      .eq('id', auth.user.id)
      .single();
    if (!me) return json({ error: 'no profile' }, 400);

    const token = new AccessToken(API_KEY, API_SECRET, {
      identity: String(me.public_id),
      name: me.name ?? '',
      metadata: JSON.stringify({ avatar: me.avatar }),
      ttl: '6h',
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      // اللاعب بيحدد مقعده بنفسه (attributes.seat)
      canUpdateOwnMetadata: true,
    });

    return json({ token: await token.toJwt(), url: LIVEKIT_URL, isOwner });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
