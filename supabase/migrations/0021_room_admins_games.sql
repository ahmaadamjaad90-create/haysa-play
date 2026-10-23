-- مشرفين الغرف، والطرد، والألعاب جوّا الغرفة
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0020)
--
-- صاحب الغرفة بيضيف لحد 10 مشرفين برقم الـ ID.
-- المشرف (وصاحب الغرفة) بيقدر: يكتم مايك حدا، ينزّله عن المقعد، يطرده (ما بيرجع 10 دقايق)، ويفتح لعبة بالغرفة.
-- الكتم والتنزيل والطرد بيصيروا من دالة livekit (لأنها بتحكي مع سيرفر الصوت).

create table public.room_admins (
  room_owner uuid not null references public.rooms (owner) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_owner, user_id)
);
alter table public.room_admins enable row level security;
revoke all on public.room_admins from anon, authenticated;
grant select on public.room_admins to authenticated;
create policy "everyone sees room admins" on public.room_admins for select to authenticated using (true);
alter publication supabase_realtime add table public.room_admins;

-- المطرودين: بس دالة livekit بتكتب وبتقرا (بمفتاح السيرفر)
create table public.room_bans (
  room_owner uuid not null references public.rooms (owner) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  until timestamptz not null,
  primary key (room_owner, user_id)
);
alter table public.room_bans enable row level security;
revoke all on public.room_bans from anon, authenticated;

-- اللعبة المفتوحة بالغرفة هلأ: {game, id, by}
alter table public.rooms add column game jsonb;

-- صاحب الغرفة أو مشرف فيها؟
create function public.is_room_mod(num bigint, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rooms r
    where r.number = num
      and (r.owner = uid or exists (select 1 from public.room_admins a where a.room_owner = r.owner and a.user_id = uid))
  )
$$;
revoke execute on function public.is_room_mod(bigint, uuid) from public, anon;
grant execute on function public.is_room_mod(bigint, uuid) to authenticated, service_role;

create function public.room_add_admin(pid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target public.profiles;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.rooms where owner = me) then raise exception 'no room'; end if;
  select * into target from public.profiles where public_id = pid;
  if not found then raise exception 'player not found'; end if;
  if target.id = me then raise exception 'you own the room'; end if;
  if (select count(*) from public.room_admins where room_owner = me) >= 10 then raise exception 'too many admins'; end if;
  insert into public.room_admins (room_owner, user_id) values (me, target.id) on conflict do nothing;
  return jsonb_build_object('pid', target.public_id, 'name', target.name, 'avatar', target.avatar);
end;
$$;

create function public.room_remove_admin(pid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.room_admins
  where room_owner = auth.uid() and user_id = (select id from public.profiles where public_id = pid);
end;
$$;

-- فتح لعبة بالغرفة (أو سكّرها بـ null)
create function public.room_set_game(num bigint, g jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_room_mod(num, auth.uid()) then raise exception 'not a room admin'; end if;
  if g is not null and (
    g ->> 'game' not in ('ludo', 'spy', 'colors', 'trivia', 'draw', 'mafia', 'codewords', 'domino', 'backgammon', 'kout', 'baloot')
    or (g ->> 'id') !~ '^[0-9]+$'
  ) then
    raise exception 'bad game';
  end if;
  update public.rooms
  set game = case when g is null then null
    else jsonb_build_object('game', g ->> 'game', 'id', (g ->> 'id')::bigint,
      'by', (select coalesce(name, 'لاعب') from public.profiles where id = auth.uid()))
    end
  where number = num;
end;
$$;

revoke execute on function public.room_add_admin(bigint), public.room_remove_admin(bigint), public.room_set_game(bigint, jsonb)
  from public, anon;
grant execute on function public.room_add_admin(bigint), public.room_remove_admin(bigint), public.room_set_game(bigint, jsonb)
  to authenticated;
