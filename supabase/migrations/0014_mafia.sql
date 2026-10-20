-- لعبة المافيا
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0013)
--
-- الأدوار: مافيا، دكتور، شرطي، مواطن. الأدوار مخبّاية بالسيرفر.
-- الليل: المافيا بتختار مين تقتل، الدكتور بيحمي واحد، الشرطي بيفحص واحد.
-- الصبح: منعرف مين مات. النهار: حكي وبعدين تصويت مين يطلع.
-- المواطنين بيربحوا إذا طلّعوا كل المافيا، والمافيا بتربح إذا صار عددها قد الباقي.

create table public.mafia_games (
  id bigint generated always as identity (start with 6001) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{key, uid, pid, name, avatar, bot, alive, left, role (بس بعد ما يموت)}]
  players jsonb not null default '[]',
  -- night ليل / morning صبح / day نقاش / vote تصويت / verdict نتيجة التصويت
  phase text check (phase in ('night', 'morning', 'day', 'vote', 'verdict')),
  day integer not null default 0,
  -- تصويت النهار مفتوح: {key: target أو skip}
  votes jsonb not null default '{}',
  -- آخر شي صار: {killed, saved, out, role}
  last jsonb,
  -- town أو mafia
  winner text check (winner in ('town', 'mafia')),
  -- كل الأدوار بآخر اللعبة
  roles jsonb,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mafia_games_waiting_idx on public.mafia_games (status, updated_at desc);
alter table public.mafia_games enable row level security;
revoke all on public.mafia_games from anon, authenticated;
grant select on public.mafia_games to authenticated;
create policy "everyone can watch mafia" on public.mafia_games for select to authenticated using (true);
alter publication supabase_realtime add table public.mafia_games;

-- الأدوار (مخبّاية، بتنقرا من mafia_info بس)
create table public.mafia_roles (
  game_id bigint not null references public.mafia_games (id) on delete cascade,
  key text not null,
  role text not null check (role in ('mafia', 'doctor', 'cop', 'citizen')),
  primary key (game_id, key)
);
alter table public.mafia_roles enable row level security;
revoke all on public.mafia_roles from anon, authenticated;

-- اختيارات الليل
create table public.mafia_actions (
  game_id bigint not null references public.mafia_games (id) on delete cascade,
  night integer not null,
  actor text not null,
  kind text not null check (kind in ('kill', 'save', 'check')),
  target text not null,
  primary key (game_id, night, actor)
);
alter table public.mafia_actions enable row level security;
revoke all on public.mafia_actions from anon, authenticated;

-- نتايج الشرطي
create table public.mafia_checks (
  game_id bigint not null references public.mafia_games (id) on delete cascade,
  night integer not null,
  target text not null,
  is_mafia boolean not null,
  primary key (game_id, night)
);
alter table public.mafia_checks enable row level security;
revoke all on public.mafia_checks from anon, authenticated;

create table public.mafia_results (
  game_id bigint not null references public.mafia_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  role text not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index mafia_results_user_idx on public.mafia_results (user_id, created_at desc);
alter table public.mafia_results enable row level security;
revoke all on public.mafia_results from anon, authenticated;
grant select on public.mafia_results to authenticated;
create policy "users read their mafia results" on public.mafia_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية =====

create function public._mafia_role(gid bigint, k text)
returns text
language sql
stable
set search_path = ''
as $$ select role from public.mafia_roles where game_id = gid and key = k $$;

-- مفاتيح اللي لسا عايشين
create function public._mafia_alive(g public.mafia_games)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(p ->> 'key'), '{}') from jsonb_array_elements(g.players) p
  where (p ->> 'alive')::boolean
$$;

create function public._mafia_my_key(g public.mafia_games)
returns text
language sql
stable
set search_path = ''
as $$
  select p ->> 'key' from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text
$$;

-- موت لاعب: بيبين دوره للكل
create function public._mafia_kill(g public.mafia_games, k text)
returns public.mafia_games
language plpgsql
stable
set search_path = ''
as $$
declare
  i integer;
begin
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord) where p ->> 'key' = k;
  if i is not null then
    g.players := jsonb_set(g.players, array[i::text, 'alive'], 'false');
    g.players := jsonb_set(g.players, array[i::text, 'role'], to_jsonb(public._mafia_role(g.id, k)));
  end if;
  return g;
end;
$$;

create function public._mafia_save(g public.mafia_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.mafia_games set
    host = g.host, status = g.status, players = g.players, phase = g.phase, day = g.day, votes = g.votes,
    last = g.last, winner = g.winner, roles = g.roles, deadline = g.deadline, updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

-- في رابح؟ الرابحين ٥٠ XP و٥٠ عملة (إذا في ٣ ناس حقيقيين أو أكتر، لحد ١٠ باليوم)، والباقي ١٥ XP
create function public._mafia_check_end(g public.mafia_games)
returns public.mafia_games
language plpgsql
set search_path = ''
as $$
declare
  m integer;
  t integer;
  p jsonb;
  r text;
  won boolean;
  humans integer;
  c integer;
  today integer;
begin
  select count(*) filter (where public._mafia_role(g.id, k) = 'mafia'),
         count(*) filter (where public._mafia_role(g.id, k) <> 'mafia')
  into m, t from unnest(public._mafia_alive(g)) k;
  if m > 0 and m < t then return g; end if;

  g.winner := case when m = 0 then 'town' else 'mafia' end;
  g.status := 'finished';
  g.deadline := null;
  select jsonb_object_agg(key, role) into g.roles from public.mafia_roles where game_id = g.id;
  select count(*) into humans from jsonb_array_elements(g.players) q where not (q ->> 'bot')::boolean;

  for p in select * from jsonb_array_elements(g.players) loop
    continue when (p ->> 'bot')::boolean;
    r := public._mafia_role(g.id, p ->> 'key');
    won := (r = 'mafia') = (g.winner = 'mafia');
    c := 0;
    if won and humans >= 3 then
      select count(*) into today from public.mafia_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 50; end if;
    end if;
    insert into public.mafia_results (game_id, user_id, won, role, coins, xp)
    values (g.id, (p ->> 'uid')::uuid, won, r, c, case when won then 50 else 15 end)
    on conflict do nothing;
    if found then
      update public.profiles set xp = xp + case when won then 50 else 15 end, coins = coins + c
      where id = (p ->> 'uid')::uuid;
    end if;
  end loop;
  return g;
end;
$$;

-- آخر الليل: الكمبيوتر بيختار، وبعدين منشوف مين مات
create function public._mafia_night_end(g public.mafia_games)
returns public.mafia_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  alive text[] := public._mafia_alive(g);
  b record;
  victim text;
  saved text;
  checked text;
begin
  -- الكمبيوتر اللي ما اختار
  for b in
    select p ->> 'key' as k, public._mafia_role(g.id, p ->> 'key') as role
    from jsonb_array_elements(g.players) p
    where (p ->> 'bot')::boolean and (p ->> 'alive')::boolean
  loop
    continue when b.role = 'citizen';
    insert into public.mafia_actions (game_id, night, actor, kind, target)
    select g.id, g.day, b.k,
      case b.role when 'mafia' then 'kill' when 'doctor' then 'save' else 'check' end,
      x from unnest(alive) x
    where case b.role
      when 'mafia' then public._mafia_role(g.id, x) <> 'mafia'
      when 'cop' then x <> b.k
      else true end
    order by random() limit 1
    on conflict do nothing;
  end loop;

  select target into victim from public.mafia_actions
  where game_id = g.id and night = g.day and kind = 'kill'
  group by target order by count(*) desc, random() limit 1;
  select target into saved from public.mafia_actions where game_id = g.id and night = g.day and kind = 'save' limit 1;
  select target into checked from public.mafia_actions where game_id = g.id and night = g.day and kind = 'check' limit 1;

  if checked is not null then
    insert into public.mafia_checks (game_id, night, target, is_mafia)
    values (g.id, g.day, checked, public._mafia_role(g.id, checked) = 'mafia')
    on conflict do nothing;
  end if;

  if victim is not null and victim is distinct from saved then
    g := public._mafia_kill(g, victim);
    g.last := jsonb_build_object('killed', victim, 'role', public._mafia_role(g.id, victim));
  else
    g.last := jsonb_build_object('killed', null, 'saved', victim is not null);
  end if;

  g := public._mafia_check_end(g);
  if g.status = 'playing' then
    g.phase := 'morning';
    g.deadline := now() + interval '6 seconds';
  end if;
  return g;
end;
$$;

-- آخر التصويت: الكمبيوتر بيصوّت، وبعدين الأكتر أصوات بيطلع (التعادل = ما حدا بيطلع)
create function public._mafia_vote_end(g public.mafia_games)
returns public.mafia_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  alive text[] := public._mafia_alive(g);
  b record;
  top text;
  top_n integer;
  second_n integer;
begin
  for b in
    select p ->> 'key' as k, public._mafia_role(g.id, p ->> 'key') as role
    from jsonb_array_elements(g.players) p
    where (p ->> 'bot')::boolean and (p ->> 'alive')::boolean and not g.votes ? (p ->> 'key')
  loop
    g.votes := g.votes || jsonb_build_object(b.k, (
      select x from unnest(alive) x
      where x <> b.k and (b.role <> 'mafia' or public._mafia_role(g.id, x) <> 'mafia')
      order by random() limit 1));
  end loop;

  select value #>> '{}', count(*) into top, top_n from jsonb_each(g.votes)
  where value #>> '{}' <> 'skip' and key = any (alive)
  group by 1 order by 2 desc limit 1;
  select count(*) into second_n from jsonb_each(g.votes)
  where value #>> '{}' <> 'skip' and key = any (alive)
  group by value #>> '{}' order by 1 desc offset 1 limit 1;

  if top is not null and top_n > coalesce(second_n, 0)
     and top_n > (select count(*) from jsonb_each(g.votes) where value #>> '{}' = 'skip') then
    g := public._mafia_kill(g, top);
    g.last := jsonb_build_object('out', top, 'role', public._mafia_role(g.id, top));
  else
    g.last := jsonb_build_object('out', null);
  end if;

  g := public._mafia_check_end(g);
  if g.status = 'playing' then
    g.phase := 'verdict';
    g.deadline := now() + interval '6 seconds';
  end if;
  return g;
end;
$$;

create function public._mafia_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('key', id::text, 'uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'bot', false, 'alive', true, 'left', false)
  from public.profiles where id = auth.uid()
$$;

revoke execute on function public._mafia_role(bigint, text), public._mafia_alive(public.mafia_games),
  public._mafia_my_key(public.mafia_games), public._mafia_kill(public.mafia_games, text),
  public._mafia_save(public.mafia_games), public._mafia_check_end(public.mafia_games),
  public._mafia_night_end(public.mafia_games), public._mafia_vote_end(public.mafia_games),
  public._mafia_me_json()
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.mafia_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.mafia_games (host, players) values (auth.uid(), jsonb_build_array(public._mafia_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.mafia_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.mafia_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if public._mafia_my_key(g) is not null then return to_jsonb(g); end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 12 then raise exception 'game full'; end if;
  g.players := g.players || public._mafia_me_json();
  return public._mafia_save(g);
end;
$$;

create function public.mafia_add_bot(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
  bots integer;
begin
  select * into g from public.mafia_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 12 then raise exception 'game full'; end if;
  select count(*) into bots from jsonb_array_elements(g.players) p where (p ->> 'bot')::boolean;
  g.players := g.players || jsonb_build_object('key', 'bot-' || (bots + 1), 'uid', null, 'pid', null,
    'name', (array['الدلّة', 'الفنجان', 'المبخرة', 'التمرة', 'الصقر', 'السدو', 'الهيل', 'الزعفران', 'النخلة', 'اللؤلؤة', 'البشت'])[1 + bots % 11],
    'avatar', 'dalla', 'bot', true, 'alive', true, 'left', false);
  return public._mafia_save(g);
end;
$$;

-- البدء: توزيع الأدوار
create function public.mafia_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
  n integer;
  roles text[];
  m integer;
begin
  select * into g from public.mafia_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n < 4 then raise exception 'need 4 players'; end if;

  m := case when n <= 6 then 1 when n <= 9 then 2 else 3 end;
  roles := array_fill('mafia'::text, array[m]) || array['doctor']
    || case when n >= 5 then array['cop'] else '{}'::text[] end;
  roles := roles || array_fill('citizen'::text, array[n - cardinality(roles)]);

  insert into public.mafia_roles (game_id, key, role)
  select g.id, k, r from
    (select p ->> 'key' as k, row_number() over (order by random()) as i from jsonb_array_elements(g.players) p) a
    join (select r, row_number() over () as i from unnest(roles) r) b using (i);

  g.status := 'playing';
  g.day := 1;
  g.phase := 'night';
  g.votes := '{}';
  g.last := null;
  g.deadline := now() + interval '30 seconds';
  return public._mafia_save(g);
end;
$$;

-- معلوماتي السرية: دوري، فريق المافيا (إذا أنا مافيا)، اختياراتهم، ونتايج الشرطي
create function public.mafia_info(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
  me text;
  r text;
begin
  select * into g from public.mafia_games where id = gid;
  if not found then return null; end if;
  me := public._mafia_my_key(g);
  if me is null then return null; end if;
  r := public._mafia_role(gid, me);
  return jsonb_build_object(
    'key', me,
    'role', r,
    'team', case when r = 'mafia' then
      (select jsonb_agg(key) from public.mafia_roles where game_id = gid and role = 'mafia') end,
    'picks', case when r = 'mafia' then
      (select jsonb_object_agg(actor, target) from public.mafia_actions where game_id = gid and night = g.day and kind = 'kill') end,
    'my_pick', (select target from public.mafia_actions where game_id = gid and night = g.day and actor = me),
    'checks', case when r = 'cop' then
      (select jsonb_agg(jsonb_build_object('target', target, 'is_mafia', is_mafia, 'night', night) order by night)
       from public.mafia_checks where game_id = gid) end
  );
end;
$$;

-- اختيار الليل (حسب دوري)
create function public.mafia_act(gid bigint, target text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
  me text;
  r text;
  alive text[];
  need integer;
  done integer;
begin
  select * into g from public.mafia_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'night' then raise exception 'not night'; end if;
  me := public._mafia_my_key(g);
  alive := public._mafia_alive(g);
  if me is null or not me = any (alive) then raise exception 'not alive'; end if;
  if not target = any (alive) then raise exception 'bad target'; end if;
  r := public._mafia_role(gid, me);
  if r = 'citizen' then raise exception 'no night action'; end if;
  if r = 'mafia' and public._mafia_role(gid, target) = 'mafia' then raise exception 'bad target'; end if;
  if r = 'cop' and target = me then raise exception 'bad target'; end if;

  insert into public.mafia_actions (game_id, night, actor, kind, target)
  values (gid, g.day, me, case r when 'mafia' then 'kill' when 'doctor' then 'save' else 'check' end, target)
  on conflict (game_id, night, actor) do update set target = excluded.target;

  -- كل الناس اللي عندهم دور بالليل اختاروا؟ منخلّص الليل بدري
  select count(*) into need from unnest(alive) k
  where public._mafia_role(gid, k) <> 'citizen'
    and not exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'key' = k and (p ->> 'bot')::boolean);
  select count(*) into done from public.mafia_actions a
  where a.game_id = gid and a.night = g.day
    and not exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'key' = a.actor and (p ->> 'bot')::boolean);
  if done >= need then
    g.deadline := least(g.deadline, now() + interval '2 seconds');
  end if;
  return public._mafia_save(g);
end;
$$;

-- أي حدا عايش بيقدر يوقف النقاش ويبلّش التصويت
create function public.mafia_call_vote(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
begin
  select * into g from public.mafia_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'day' then return to_jsonb(g); end if;
  if not public._mafia_my_key(g) = any (public._mafia_alive(g)) then raise exception 'not alive'; end if;
  g.phase := 'vote';
  g.votes := '{}';
  g.deadline := now() + interval '40 seconds';
  return public._mafia_save(g);
end;
$$;

-- تصويت النهار: مفتاح لاعب أو skip
create function public.mafia_vote(gid bigint, target text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
  me text;
  alive text[];
  humans integer;
begin
  select * into g from public.mafia_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'vote' then raise exception 'not voting'; end if;
  me := public._mafia_my_key(g);
  alive := public._mafia_alive(g);
  if me is null or not me = any (alive) then raise exception 'not alive'; end if;
  if target <> 'skip' and (target = me or not target = any (alive)) then raise exception 'bad target'; end if;
  g.votes := g.votes || jsonb_build_object(me, target);

  select count(*) into humans from jsonb_array_elements(g.players) p
  where (p ->> 'alive')::boolean and not (p ->> 'bot')::boolean;
  if (select count(*) from jsonb_object_keys(g.votes) k
      where k = any (alive) and not exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'key' = k and (p ->> 'bot')::boolean)) >= humans then
    g := public._mafia_vote_end(g);
  end if;
  return public._mafia_save(g);
end;
$$;

create function public.mafia_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
begin
  select * into g from public.mafia_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  if g.phase = 'night' then
    g := public._mafia_night_end(g);
  elsif g.phase = 'morning' then
    g.phase := 'day';
    g.deadline := now() + interval '90 seconds';
  elsif g.phase = 'day' then
    g.phase := 'vote';
    g.votes := '{}';
    g.deadline := now() + interval '40 seconds';
  elsif g.phase = 'vote' then
    g := public._mafia_vote_end(g);
  else
    g.day := g.day + 1;
    g.phase := 'night';
    g.votes := '{}';
    g.deadline := now() + interval '30 seconds';
  end if;
  return public._mafia_save(g);
end;
$$;

create function public.mafia_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mafia_games;
  i integer;
  me text;
begin
  select * into g from public.mafia_games where id = gid for update;
  if not found or g.status = 'finished' then return; end if;
  me := public._mafia_my_key(g);
  if me is null then return; end if;
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord) where p ->> 'key' = me;

  if g.status = 'waiting' then
    g.players := g.players - i;
    if g.host = auth.uid() then
      g.host := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p
                 where not (p ->> 'bot')::boolean limit 1);
    end if;
    if g.host is null then g.status := 'finished'; end if;
  else
    g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
    if (g.players -> i ->> 'alive')::boolean then
      g := public._mafia_kill(g, me);
    end if;
    if not exists (select 1 from jsonb_array_elements(g.players) p
                   where not (p ->> 'left')::boolean and not (p ->> 'bot')::boolean) then
      g.status := 'finished';
      g.deadline := null;
    else
      g := public._mafia_check_end(g);
    end if;
  end if;
  perform public._mafia_save(g);
end;
$$;

grant execute on function public.mafia_create(), public.mafia_join(bigint), public.mafia_add_bot(bigint),
  public.mafia_start(bigint), public.mafia_info(bigint), public.mafia_act(bigint, text),
  public.mafia_call_vote(bigint), public.mafia_vote(bigint, text), public.mafia_tick(bigint),
  public.mafia_leave(bigint)
to authenticated;
revoke execute on function public.mafia_create(), public.mafia_join(bigint), public.mafia_add_bot(bigint),
  public.mafia_start(bigint), public.mafia_info(bigint), public.mafia_act(bigint, text),
  public.mafia_call_vote(bigint), public.mafia_vote(bigint, text), public.mafia_tick(bigint),
  public.mafia_leave(bigint)
from public, anon;
