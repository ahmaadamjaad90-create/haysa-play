-- لعبة الجاسوس
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0009)
--
-- كل لاعب بياخد كرت فيه المكان ودوره، إلا واحد: الجاسوس، ما بيعرف المكان.
-- بتسألوا بعض أسئلة، وبعدين بتصوّتوا مين الجاسوس.
-- الجاسوس بيربح إذا ما انمسك، أو إذا عرف المكان.
--
-- السر (مين الجاسوس وشو المكان) بجدول ما حدا بيقدر يقراه من التطبيق،
-- وكل لاعب بيقرا كرته هو بس.

create table public.spy_locations (
  key text primary key,
  name text not null,
  emoji text not null,
  roles text[] not null
);

insert into public.spy_locations (key, name, emoji, roles) values
  ('diwaniya', 'ديوانية',        '🛋️', array['صاحب الديوانية', 'الضيف', 'صبّاب القهوة', 'الشايب', 'الشاعر', 'ولد صاحب الديوانية', 'جار']),
  ('camp',     'مخيم بر',        '⛺', array['صاحب المخيم', 'الطبّاخ', 'راعي الحلال', 'السواق', 'المصوّر', 'الضيف', 'الحارس']),
  ('souq',     'سوق شعبي',       '🧺', array['بيّاع التمر', 'بيّاع العطور', 'زبون', 'شرطي', 'حمّال', 'سايح', 'صاحب محل']),
  ('mall',     'مول',            '🛍️', array['بيّاع ملابس', 'حارس أمن', 'زبونة', 'عامل نظافة', 'مدير المحل', 'ولد ضايع', 'كاشير']),
  ('wedding',  'عرس',            '💍', array['العريس', 'أبو العريس', 'المطرب', 'المصوّر', 'الضيف', 'الطبّاخ', 'المعزّب']),
  ('airport',  'مطار',           '✈️', array['الطيّار', 'المضيفة', 'موظف الجوازات', 'مسافر', 'حمّال', 'موظف الجمارك', 'سواق تاكسي']),
  ('hospital', 'مستشفى',         '🏥', array['دكتور', 'ممرضة', 'مريض', 'زاير', 'موظف الاستقبال', 'جرّاح', 'صيدلي']),
  ('school',   'مدرسة',          '🏫', array['المدير', 'أستاذ رياضيات', 'طالب', 'الفرّاش', 'أستاذ رياضة', 'ولي أمر', 'المرشد']),
  ('stadium',  'ملعب كورة',      '⚽', array['اللاعب', 'الحكم', 'المدرب', 'مشجع', 'المعلّق', 'حارس المرمى', 'بيّاع الشاي']),
  ('chalet',   'شاليه',          '🏖️', array['صاحب الشاليه', 'الشوّاي', 'السبّاح', 'الضيف', 'الحارس', 'ولد صغير', 'الطبّاخ']),
  ('mandi',    'مطعم مندي',      '🍗', array['الطبّاخ', 'الويتر', 'الزبون', 'الكاشير', 'المدير', 'عامل التوصيل', 'المحاسب']),
  ('cafe',     'قهوة شعبية',     '☕', array['صاحب القهوة', 'لاعب كيرم', 'لاعب بلوت', 'صبّاب الشاي', 'الشايب', 'زبون جديد', 'الجرسون']),
  ('barber',   'صالون حلاقة',    '💈', array['الحلاق', 'الزبون', 'الولد الصغير', 'المنتظر', 'صاحب المحل', 'المساعد', 'بيّاع العطور']),
  ('dhow',     'لنج صيد',        '⛵', array['النوخذة', 'البحّار', 'الطبّاخ', 'الغوّاص', 'صياد', 'المساعد', 'الضيف']),
  ('zoo',      'حديقة حيوان',    '🦁', array['حارس الأسود', 'الدكتور البيطري', 'طفل', 'المصوّر', 'بيّاع الآيس كريم', 'سايح', 'المدير']),
  ('cinema',   'سينما',          '🎬', array['المتفرّج', 'بيّاع الفشار', 'موظف التذاكر', 'المخرج', 'الحارس', 'عشّاق الأفلام', 'عامل النظافة']),
  ('bank',     'بنك',            '🏦', array['موظف البنك', 'المدير', 'زبون', 'حارس الأمن', 'حرامي', 'الكاشير', 'موظف القروض']),
  ('gas',      'محطة بنزين',     '⛽', array['العامل', 'السواق', 'الكاشير', 'صاحب المحطة', 'سواق شاحنة', 'الزبون', 'ميكانيكي']),
  ('bakery',   'مخبز',           '🥖', array['الخبّاز', 'الزبون', 'بيّاع', 'عامل التوصيل', 'صاحب المخبز', 'المساعد', 'ولد صغير']),
  ('gym',      'نادي رياضي',     '🏋️', array['المدرب', 'لاعب حديد', 'المبتدئ', 'موظف الاستقبال', 'لاعب ملاكمة', 'عامل النظافة', 'المدير']),
  ('hotel',    'فندق',           '🏨', array['موظف الاستقبال', 'النزيل', 'عامل الغرف', 'الطبّاخ', 'المدير', 'الحمّال', 'الحارس']),
  ('tv',       'استوديو تلفزيون','📺', array['المذيع', 'المصوّر', 'المخرج', 'الضيف', 'الماكيير', 'الجمهور', 'المنتج']),
  ('farm',     'مزرعة',          '🐪', array['صاحب المزرعة', 'الراعي', 'الفلاح', 'البيطري', 'الزاير', 'السواق', 'الطبّاخ']),
  ('police',   'مركز شرطة',      '🚓', array['الضابط', 'الشرطي', 'المتهم', 'المحامي', 'الشاهد', 'المحقق', 'الحارس']),
  ('university','جامعة',         '🎓', array['الدكتور', 'الطالب', 'العميد', 'موظف التسجيل', 'طالب جديد', 'أمين المكتبة', 'الحارس']),
  ('plane',    'طيارة',          '🛫', array['الكابتن', 'المضيف', 'راكب', 'مساعد الطيّار', 'راكب خايف', 'طفل', 'راكب نايم']),
  ('pharmacy', 'صيدلية',         '💊', array['الصيدلي', 'المريض', 'المساعد', 'المندوب', 'الكاشير', 'أم ولد مريض', 'الدكتور']),
  ('circus',   'سيرك',           '🎪', array['المهرّج', 'مروّض الأسود', 'البهلوان', 'المتفرّج', 'الساحر', 'بيّاع الحلاوة', 'المدير']);

alter table public.spy_locations enable row level security;
revoke all on public.spy_locations from anon, authenticated;
grant select on public.spy_locations to authenticated;
create policy "everyone reads spy locations" on public.spy_locations for select to authenticated using (true);

-- الطاولة (الشي اللي الكل بيشوفه)
create table public.spy_games (
  id bigint generated always as identity (start with 5001) primary key,
  host uuid references public.profiles (id) on delete set null,
  -- waiting → playing (حكي) → voting (تصويت) → guessing (الجاسوس بيخمّن) → finished
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'voting', 'guessing', 'finished')),
  -- [{uid, pid, name, avatar, left}]
  players jsonb not null default '[]',
  -- أول واحد بيسأل
  first_asker uuid,
  deadline timestamptz,
  -- {uid: target_uid}
  votes jsonb not null default '{}',
  accused uuid,
  -- spy أو players
  winner text check (winner in ('spy', 'players')),
  -- بعد ما تخلص: {spy, location, name, emoji, reason}
  reveal jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spy_games_waiting_idx on public.spy_games (status, updated_at desc);
alter table public.spy_games enable row level security;
revoke all on public.spy_games from anon, authenticated;
grant select on public.spy_games to authenticated;
create policy "everyone can watch spy games" on public.spy_games for select to authenticated using (true);
alter publication supabase_realtime add table public.spy_games;

-- كرت كل لاعب: المكان ودوره (الجاسوس: location فاضي)
create table public.spy_cards (
  game_id bigint not null references public.spy_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  location text references public.spy_locations (key),
  role text,
  primary key (game_id, user_id)
);
alter table public.spy_cards enable row level security;
revoke all on public.spy_cards from anon, authenticated;
grant select on public.spy_cards to authenticated;
create policy "players read their own card" on public.spy_cards for select to authenticated
  using ((select auth.uid()) = user_id);

-- السر: ما حدا بيقراه من التطبيق
create table public.spy_secrets (
  game_id bigint primary key references public.spy_games (id) on delete cascade,
  spy uuid not null,
  location text not null references public.spy_locations (key)
);
alter table public.spy_secrets enable row level security;
revoke all on public.spy_secrets from anon, authenticated;

create table public.spy_results (
  game_id bigint not null references public.spy_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index spy_results_user_idx on public.spy_results (user_id, created_at desc);
alter table public.spy_results enable row level security;
revoke all on public.spy_results from anon, authenticated;
grant select on public.spy_results to authenticated;
create policy "users read their spy results" on public.spy_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية =====

create function public._spy_active(g public.spy_games)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg((p ->> 'uid')::uuid), '{}')
  from jsonb_array_elements(g.players) p where not (p ->> 'left')::boolean
$$;

create function public._spy_in(g public.spy_games)
returns boolean
language sql
stable
set search_path = ''
as $$ select auth.uid() = any (public._spy_active(g)) $$;

-- نهاية اللعبة: كشف السر والجوائز (الرابح ٥٠ XP و٥٠ عملة لحد ١٠ مرات باليوم، الخسران ١٥ XP)
create function public._spy_finish(g public.spy_games, who text, reason text)
returns public.spy_games
language plpgsql
set search_path = ''
as $$
declare
  s public.spy_secrets;
  l public.spy_locations;
  p jsonb;
  u uuid;
  won boolean;
  c integer;
  today integer;
begin
  select * into s from public.spy_secrets where game_id = g.id;
  select * into l from public.spy_locations where key = s.location;
  g.status := 'finished';
  g.winner := who;
  g.deadline := null;
  g.reveal := jsonb_build_object('spy', s.spy, 'location', l.key, 'name', l.name, 'emoji', l.emoji,
    'reason', reason);

  for p in select * from jsonb_array_elements(g.players) loop
    u := (p ->> 'uid')::uuid;
    won := (u = s.spy) = (who = 'spy');
    c := 0;
    if won then
      select count(*) into today from public.spy_results
      where user_id = u and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 50; end if;
    end if;
    insert into public.spy_results (game_id, user_id, won, coins, xp)
    values (g.id, u, won, c, case when won then 50 else 15 end)
    on conflict do nothing;
    if found then
      update public.profiles set xp = xp + case when won then 50 else 15 end, coins = coins + c where id = u;
    end if;
  end loop;
  return g;
end;
$$;

-- عدّ الأصوات: الأكتر أصوات (بدون تعادل) بيتكشف. إذا هو الجاسوس، بياخد فرصة يخمّن المكان.
create function public._spy_resolve(g public.spy_games)
returns public.spy_games
language plpgsql
set search_path = ''
as $$
declare
  top uuid;
  top_n integer;
  second_n integer;
  spy uuid;
begin
  select (value #>> '{}')::uuid, count(*) into top, top_n
  from jsonb_each(g.votes) group by 1 order by 2 desc limit 1;
  select count(*) into second_n from jsonb_each(g.votes) group by (value #>> '{}') order by 1 desc offset 1 limit 1;
  select s.spy into spy from public.spy_secrets s where s.game_id = g.id;

  if top is null or top_n = coalesce(second_n, 0) then
    return public._spy_finish(g, 'spy', 'tie');
  end if;
  g.accused := top;
  if top <> spy then
    return public._spy_finish(g, 'spy', 'wrong');
  end if;
  g.status := 'guessing';
  g.deadline := now() + interval '30 seconds';
  return g;
end;
$$;

create function public._spy_save(g public.spy_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.spy_games set
    host = g.host, status = g.status, players = g.players, first_asker = g.first_asker,
    deadline = g.deadline, votes = g.votes, accused = g.accused, winner = g.winner,
    reveal = g.reveal, updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

create function public._spy_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'left', false)
  from public.profiles where id = auth.uid()
$$;

revoke execute on function public._spy_active(public.spy_games), public._spy_in(public.spy_games),
  public._spy_finish(public.spy_games, text, text), public._spy_resolve(public.spy_games),
  public._spy_save(public.spy_games), public._spy_me_json()
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.spy_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.spy_games (host, players) values (auth.uid(), jsonb_build_array(public._spy_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.spy_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.spy_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.spy_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 8 then raise exception 'game full'; end if;
  g.players := g.players || public._spy_me_json();
  return public._spy_save(g);
end;
$$;

-- البدء: مكان عشوائي، جاسوس عشوائي، وأدوار
create function public.spy_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.spy_games;
  n integer;
  loc public.spy_locations;
  spy uuid;
  u uuid;
  i integer := 0;
  roles text[];
begin
  select * into g from public.spy_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n < 3 then raise exception 'need 3 players'; end if;

  select * into loc from public.spy_locations order by random() limit 1;
  select (p ->> 'uid')::uuid into spy from jsonb_array_elements(g.players) p order by random() limit 1;
  select array_agg(r order by random()) into roles from unnest(loc.roles) r;

  insert into public.spy_secrets (game_id, spy, location) values (g.id, spy, loc.key);
  for u in select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p loop
    if u = spy then
      insert into public.spy_cards (game_id, user_id, location, role) values (g.id, u, null, null);
    else
      insert into public.spy_cards (game_id, user_id, location, role)
      values (g.id, u, loc.key, roles[1 + i % cardinality(roles)]);
      i := i + 1;
    end if;
  end loop;

  g.status := 'playing';
  g.first_asker := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p order by random() limit 1);
  -- ٥ دقايق لـ ٣-٤ لاعبين، ٧ لأكتر
  g.deadline := now() + case when n <= 4 then interval '5 minutes' else interval '7 minutes' end;
  return public._spy_save(g);
end;
$$;

-- أي لاعب بيقدر يوقف الحكي ويبلّش التصويت
create function public.spy_call_vote(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.spy_games;
begin
  select * into g from public.spy_games where id = gid for update;
  if not found or not public._spy_in(g) then raise exception 'not in game'; end if;
  if g.status <> 'playing' then return to_jsonb(g); end if;
  g.status := 'voting';
  g.votes := '{}';
  g.deadline := now() + interval '60 seconds';
  return public._spy_save(g);
end;
$$;

create function public.spy_vote(gid bigint, target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.spy_games;
begin
  select * into g from public.spy_games where id = gid for update;
  if not found or not public._spy_in(g) then raise exception 'not in game'; end if;
  if g.status <> 'voting' then raise exception 'not voting'; end if;
  if target = auth.uid() or not target = any (public._spy_active(g)) then raise exception 'bad target'; end if;
  g.votes := g.votes || jsonb_build_object(auth.uid()::text, target);
  -- الكل صوّت؟
  if (select count(*) from jsonb_object_keys(g.votes) k where k::uuid = any (public._spy_active(g)))
     >= cardinality(public._spy_active(g)) then
    g := public._spy_resolve(g);
  end if;
  return public._spy_save(g);
end;
$$;

-- الجاسوس بيخمّن المكان (بأي وقت وهو بيلعب، أو بعد ما ينكشف)
create function public.spy_guess(gid bigint, loc text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.spy_games;
  s public.spy_secrets;
begin
  select * into g from public.spy_games where id = gid for update;
  if not found or g.status not in ('playing', 'voting', 'guessing') then raise exception 'not playing'; end if;
  select * into s from public.spy_secrets where game_id = gid;
  if s.spy is distinct from auth.uid() then raise exception 'not the spy'; end if;
  if s.location = loc then
    g := public._spy_finish(g, 'spy', 'guessed');
  else
    g := public._spy_finish(g, 'players', 'bad_guess');
  end if;
  g.reveal := g.reveal || jsonb_build_object('guess', loc);
  return public._spy_save(g);
end;
$$;

-- لما يخلص الوقت (أي حدا فاتح الطاولة بيناديها)
create function public.spy_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.spy_games;
begin
  select * into g from public.spy_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.deadline is null or g.deadline > now() then return to_jsonb(g); end if;
  if g.status = 'playing' then
    g.status := 'voting';
    g.votes := '{}';
    g.deadline := now() + interval '60 seconds';
  elsif g.status = 'voting' then
    g := public._spy_resolve(g);
  elsif g.status = 'guessing' then
    g := public._spy_finish(g, 'players', 'no_guess');
  else
    return to_jsonb(g);
  end if;
  return public._spy_save(g);
end;
$$;

create function public.spy_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.spy_games;
  i integer;
  spy uuid;
begin
  select * into g from public.spy_games where id = gid for update;
  if not found or g.status = 'finished' then return; end if;
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord)
  where p ->> 'uid' = auth.uid()::text;
  if i is null then return; end if;

  if g.status = 'waiting' then
    g.players := g.players - i;
    if g.host = auth.uid() then
      g.host := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p limit 1);
    end if;
    if g.host is null then g.status := 'finished'; end if;
    perform public._spy_save(g);
    return;
  end if;

  g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
  g.votes := g.votes - auth.uid()::text;
  select s.spy into spy from public.spy_secrets s where s.game_id = g.id;
  if spy = auth.uid() then
    g := public._spy_finish(g, 'players', 'spy_left');
  elsif cardinality(public._spy_active(g)) < 3 then
    g := public._spy_finish(g, 'spy', 'too_few');
  end if;
  perform public._spy_save(g);
end;
$$;

grant execute on function public.spy_create(), public.spy_join(bigint), public.spy_start(bigint),
  public.spy_call_vote(bigint), public.spy_vote(bigint, uuid), public.spy_guess(bigint, text),
  public.spy_tick(bigint), public.spy_leave(bigint)
to authenticated;
revoke execute on function public.spy_create(), public.spy_join(bigint), public.spy_start(bigint),
  public.spy_call_vote(bigint), public.spy_vote(bigint, uuid), public.spy_guess(bigint, text),
  public.spy_tick(bigint), public.spy_leave(bigint)
from public, anon;
