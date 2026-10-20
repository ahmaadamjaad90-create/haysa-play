-- كلمات السر
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0014)
--
-- فريقين (أحمر r وأزرق b)، ولكل فريق رئيس. عالطاولة ٢٥ كلمة.
-- الرئيس بس بيعرف ألوان الكلمات: ٩ للفريق اللي بيبدأ، ٨ للتاني، ٧ محايدة (n)، وقنبلة وحدة (x).
-- الرئيس بيعطي تلميحة (كلمة + رقم)، وفريقه بيخمّن الكلمات.
-- القنبلة = خسارة فوراً. أول فريق بيكشف كل كلماته بيربح.
-- الألوان مخبّاية بالسيرفر، وما بتبين إلا للرؤساء أو بعد ما تنكشف.

create table public.code_words (
  word text primary key
);
alter table public.code_words enable row level security;
revoke all on public.code_words from anon, authenticated;

insert into public.code_words (word)
select unnest(array[
  'بحر', 'جمل', 'نخلة', 'قهوة', 'دلة', 'صقر', 'خيمة', 'سيف', 'تاج', 'قمر',
  'شمس', 'نجمة', 'مطر', 'رمل', 'جبل', 'وادي', 'سوق', 'مسجد', 'برج', 'جسر',
  'سفينة', 'طيارة', 'سيارة', 'قطار', 'دراجة', 'صاروخ', 'غواصة', 'مرساة', 'شراع', 'لؤلؤ',
  'ذهب', 'فضة', 'حديد', 'زجاج', 'خشب', 'ورق', 'قلم', 'كتاب', 'مكتبة', 'مدرسة',
  'جامعة', 'مستشفى', 'دكتور', 'ممرضة', 'شرطي', 'حرامي', 'ملك', 'أمير', 'وزير', 'سفير',
  'جاسوس', 'ساحر', 'مهرج', 'طباخ', 'خياط', 'نجار', 'حلاق', 'صياد', 'راعي', 'فلاح',
  'أسد', 'نمر', 'ذئب', 'ثعلب', 'أرنب', 'غزال', 'حصان', 'كلب', 'قطة', 'فأر',
  'حوت', 'قرش', 'دلفين', 'سمكة', 'سلحفاة', 'تمساح', 'ثعبان', 'عقرب', 'نحلة', 'نملة',
  'فراشة', 'بومة', 'غراب', 'حمامة', 'ببغاء', 'نسر', 'بطريق', 'دب', 'فيل', 'زرافة',
  'تفاحة', 'موز', 'تمر', 'عنب', 'رمان', 'ليمون', 'بطيخ', 'بصل', 'ثوم', 'فلفل',
  'خبز', 'رز', 'لحم', 'دجاج', 'بيض', 'حليب', 'عسل', 'سكر', 'ملح', 'شاي',
  'كيكة', 'حلاوة', 'آيس كريم', 'بيتزا', 'برجر', 'مندي', 'كبسة', 'هريس', 'لقيمات', 'سمبوسة',
  'باب', 'شباك', 'مفتاح', 'قفل', 'كرسي', 'طاولة', 'سرير', 'مخدة', 'سجادة', 'ستارة',
  'ساعة', 'جوال', 'شاشة', 'كاميرا', 'سماعة', 'راديو', 'تلفزيون', 'كمبيوتر', 'روبوت', 'بطارية',
  'نار', 'ثلج', 'ريح', 'رعد', 'برق', 'غيمة', 'قوس قزح', 'بركان', 'زلزال', 'عاصفة',
  'ليل', 'نهار', 'صيف', 'شتا', 'ربيع', 'خريف', 'عيد', 'رمضان', 'عرس', 'حفلة',
  'كورة', 'ملعب', 'هدف', 'حكم', 'كأس', 'ميدالية', 'سباق', 'سباحة', 'ملاكمة', 'شطرنج',
  'ورقة', 'زهر', 'دومينو', 'بلوت', 'لغز', 'كنز', 'خريطة', 'بوصلة', 'جزيرة', 'قرصان',
  'شبح', 'وحش', 'تنين', 'عملاق', 'قزم', 'حورية', 'جني', 'مصباح', 'سجادة طايرة', 'قلعة',
  'قلب', 'عين', 'يد', 'رأس', 'سن', 'شعر', 'ظل', 'مراية', 'حلم', 'ضحكة',
  'هدية', 'بالون', 'شمعة', 'وردة', 'شجرة', 'غابة', 'صحراء', 'واحة', 'بير', 'نبع',
  'بنك', 'فلوس', 'دينار', 'ريال', 'درهم', 'محفظة', 'شنطة', 'نظارة', 'خاتم', 'عقال',
  'شماغ', 'بشت', 'عباية', 'ثوب', 'حذاء', 'جوارب', 'قبعة', 'مظلة', 'عصا', 'حبل'
]);

create table public.code_games (
  id bigint generated always as identity (start with 4001) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{uid, pid, name, avatar, team, boss, left}]
  players jsonb not null default '[]',
  words text[],
  -- ٢٥ خانة: r / b / n / x للي انكشف، و null للي لسا مخبّى
  revealed text[],
  -- كم كلمة لازم يكشف كل فريق
  goal jsonb,
  turn text check (turn in ('r', 'b')),
  phase text check (phase in ('clue', 'guess')),
  -- {word, count}
  clue jsonb,
  guesses_left integer,
  -- آخر حركة: {pick, color, by} أو {pass, by} أو {skip}
  last jsonb,
  winner text check (winner in ('r', 'b')),
  -- بآخر اللعبة: كل الألوان
  key text[],
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index code_games_waiting_idx on public.code_games (status, updated_at desc);
alter table public.code_games enable row level security;
revoke all on public.code_games from anon, authenticated;
grant select on public.code_games to authenticated;
create policy "everyone can watch code words" on public.code_games for select to authenticated using (true);
alter publication supabase_realtime add table public.code_games;

-- ألوان الكلمات (مخبّاية)
create table public.code_keys (
  game_id bigint primary key references public.code_games (id) on delete cascade,
  colors text[] not null
);
alter table public.code_keys enable row level security;
revoke all on public.code_keys from anon, authenticated;

create table public.code_results (
  game_id bigint not null references public.code_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index code_results_user_idx on public.code_results (user_id, created_at desc);
alter table public.code_results enable row level security;
revoke all on public.code_results from anon, authenticated;
grant select on public.code_results to authenticated;
create policy "users read their code results" on public.code_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية =====

create function public._code_me(g public.code_games)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select p from jsonb_array_elements(g.players) p
  where p ->> 'uid' = auth.uid()::text and not (p ->> 'left')::boolean
$$;

create function public._code_save(g public.code_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.code_games set
    host = g.host, status = g.status, players = g.players, words = g.words, revealed = g.revealed,
    goal = g.goal, turn = g.turn, phase = g.phase, clue = g.clue, guesses_left = g.guesses_left,
    last = g.last, winner = g.winner, key = g.key, deadline = g.deadline, updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

-- النهاية: الرابحين ٥٠ XP و٥٠ عملة (لحد ١٠ باليوم)، والباقي ١٥ XP
create function public._code_finish(g public.code_games, team text)
returns public.code_games
language plpgsql
set search_path = ''
as $$
declare
  p jsonb;
  won boolean;
  c integer;
  today integer;
begin
  g.status := 'finished';
  g.winner := team;
  g.phase := null;
  g.deadline := null;
  select colors into g.key from public.code_keys where game_id = g.id;
  for p in select * from jsonb_array_elements(g.players) loop
    won := p ->> 'team' = team;
    c := 0;
    if won then
      select count(*) into today from public.code_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 50; end if;
    end if;
    insert into public.code_results (game_id, user_id, won, coins, xp)
    values (g.id, (p ->> 'uid')::uuid, won, c, case when won then 50 else 15 end)
    on conflict do nothing;
    if found then
      update public.profiles set xp = xp + case when won then 50 else 15 end, coins = coins + c
      where id = (p ->> 'uid')::uuid;
    end if;
  end loop;
  return g;
end;
$$;

-- الدور للفريق التاني
create function public._code_switch(g public.code_games)
returns public.code_games
language plpgsql
stable
set search_path = ''
as $$
begin
  g.turn := case when g.turn = 'r' then 'b' else 'r' end;
  g.phase := 'clue';
  g.clue := null;
  g.guesses_left := null;
  g.deadline := now() + interval '90 seconds';
  return g;
end;
$$;

-- كم كلمة انكشفت لفريق
create function public._code_found(g public.code_games, team text)
returns integer
language sql
immutable
set search_path = ''
as $$ select count(*)::integer from unnest(g.revealed) c where c = team $$;

create function public._code_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'team', null, 'boss', false, 'left', false)
  from public.profiles where id = auth.uid()
$$;

revoke execute on function public._code_me(public.code_games), public._code_save(public.code_games),
  public._code_finish(public.code_games, text), public._code_switch(public.code_games),
  public._code_found(public.code_games, text), public._code_me_json()
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.code_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.code_games (host, players) values (auth.uid(), jsonb_build_array(public._code_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.code_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.code_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.code_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 10 then raise exception 'game full'; end if;
  g.players := g.players || public._code_me_json();
  return public._code_save(g);
end;
$$;

-- البدء: فرق عشوائية، أول واحد بكل فريق رئيس، و٢٥ كلمة
create function public.code_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.code_games;
  n integer;
  first text := case when random() < 0.5 then 'r' else 'b' end;
  second text;
  cols text[];
begin
  select * into g from public.code_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n < 4 then raise exception 'need 4 players'; end if;
  second := case when first = 'r' then 'b' else 'r' end;

  -- الفرق بالتناوب بعد الخلط، وأول واحد من كل فريق رئيس
  select jsonb_agg(p || jsonb_build_object(
      'team', case when i % 2 = 0 then 'r' else 'b' end,
      'boss', i < 2) order by i)
  into g.players
  from (select p, (row_number() over (order by random()) - 1)::integer as i
        from jsonb_array_elements(g.players) p) x;

  select array_agg(word) into g.words from (select word from public.code_words order by random() limit 25) w;
  select array_agg(c order by random()) into cols from unnest(
    array_fill(first, array[9]) || array_fill(second, array[8]) || array_fill('n'::text, array[7]) || array['x']
  ) c;
  insert into public.code_keys (game_id, colors) values (g.id, cols);

  g.revealed := array_fill(null::text, array[25]);
  g.goal := jsonb_build_object(first, 9, second, 8);
  g.status := 'playing';
  g.turn := first;
  g.phase := 'clue';
  g.clue := null;
  g.last := null;
  g.deadline := now() + interval '90 seconds';
  return public._code_save(g);
end;
$$;

-- الرؤساء بيشوفوا كل الألوان
create function public.code_key(gid bigint)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.code_games;
begin
  select * into g from public.code_games where id = gid;
  if not found or not coalesce((public._code_me(g) ->> 'boss')::boolean, false) then return null; end if;
  return (select colors from public.code_keys where game_id = gid);
end;
$$;

-- التلميحة: كلمة ورقم (٠ = بدون حد)
create function public.code_clue(gid bigint, word text, cnt integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.code_games;
  me jsonb;
begin
  select * into g from public.code_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'clue' then raise exception 'not clue time'; end if;
  me := public._code_me(g);
  if me is null or not (me ->> 'boss')::boolean or me ->> 'team' <> g.turn then raise exception 'not your clue'; end if;
  word := btrim(word);
  if word = '' or char_length(word) > 30 or word ~ '\s' then raise exception 'one word'; end if;
  if cnt < 0 or cnt > 9 then raise exception 'bad count'; end if;
  if exists (select 1 from unnest(g.words) w where public._draw_norm(w) = public._draw_norm(word)) then
    raise exception 'word on board';
  end if;
  g.clue := jsonb_build_object('word', word, 'count', cnt);
  g.guesses_left := case when cnt = 0 then 25 else cnt + 1 end;
  g.phase := 'guess';
  g.last := null;
  g.deadline := now() + interval '120 seconds';
  return public._code_save(g);
end;
$$;

-- كشف كلمة (أي واحد من الفريق اللي عليه الدور، غير الرئيس)
create function public.code_pick(gid bigint, idx integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.code_games;
  me jsonb;
  col text;
  other text;
begin
  select * into g from public.code_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'guess' then raise exception 'not guess time'; end if;
  me := public._code_me(g);
  if me is null or (me ->> 'boss')::boolean or me ->> 'team' <> g.turn then raise exception 'not your turn'; end if;
  if idx < 0 or idx > 24 or g.revealed[idx + 1] is not null then raise exception 'bad card'; end if;

  select colors[idx + 1] into col from public.code_keys where game_id = gid;
  g.revealed[idx + 1] := col;
  g.last := jsonb_build_object('pick', idx, 'color', col, 'by', me ->> 'name');
  other := case when g.turn = 'r' then 'b' else 'r' end;

  if col = 'x' then
    return public._code_save(public._code_finish(g, other));
  end if;
  if public._code_found(g, 'r') >= (g.goal ->> 'r')::integer then
    return public._code_save(public._code_finish(g, 'r'));
  end if;
  if public._code_found(g, 'b') >= (g.goal ->> 'b')::integer then
    return public._code_save(public._code_finish(g, 'b'));
  end if;

  if col = g.turn then
    g.guesses_left := g.guesses_left - 1;
    if g.guesses_left <= 0 then g := public._code_switch(g); end if;
  else
    g := public._code_switch(g);
  end if;
  return public._code_save(g);
end;
$$;

-- الفريق بيوقف التخمين
create function public.code_pass(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.code_games;
  me jsonb;
begin
  select * into g from public.code_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'guess' then raise exception 'not guess time'; end if;
  me := public._code_me(g);
  if me is null or me ->> 'team' <> g.turn then raise exception 'not your turn'; end if;
  g := public._code_switch(g);
  g.last := jsonb_build_object('pass', true, 'by', me ->> 'name');
  return public._code_save(g);
end;
$$;

create function public.code_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.code_games;
begin
  select * into g from public.code_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  g := public._code_switch(g);
  g.last := jsonb_build_object('skip', true);
  return public._code_save(g);
end;
$$;

create function public.code_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.code_games;
  i integer;
  team text;
  j integer;
begin
  select * into g from public.code_games where id = gid for update;
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
    perform public._code_save(g);
    return;
  end if;

  team := g.players -> i ->> 'team';
  g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
  -- إذا طلع الرئيس، أول واحد ضل بفريقه بيصير رئيس
  if (g.players -> i ->> 'boss')::boolean then
    g.players := jsonb_set(g.players, array[i::text, 'boss'], 'false');
    select (ord - 1)::integer into j from jsonb_array_elements(g.players) with ordinality as x(p, ord)
    where p ->> 'team' = team and not (p ->> 'left')::boolean limit 1;
    if j is not null then
      g.players := jsonb_set(g.players, array[j::text, 'boss'], 'true');
    end if;
  end if;
  -- فريق فاضي = التاني ربح
  if not exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'team' = team and not (p ->> 'left')::boolean) then
    g := public._code_finish(g, case when team = 'r' then 'b' else 'r' end);
  end if;
  perform public._code_save(g);
end;
$$;

grant execute on function public.code_create(), public.code_join(bigint), public.code_start(bigint),
  public.code_key(bigint), public.code_clue(bigint, text, integer), public.code_pick(bigint, integer),
  public.code_pass(bigint), public.code_tick(bigint), public.code_leave(bigint)
to authenticated;
revoke execute on function public.code_create(), public.code_join(bigint), public.code_start(bigint),
  public.code_key(bigint), public.code_clue(bigint, text, integer), public.code_pick(bigint, integer),
  public.code_pass(bigint), public.code_tick(bigint), public.code_leave(bigint)
from public, anon;
