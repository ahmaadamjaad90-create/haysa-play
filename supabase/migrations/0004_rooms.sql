-- الغرف الصوتية: كل لاعب إله غرفة وحدة، ورقمها نفس رقم الـ ID تبعه
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0003)
-- الصوت نفسه على LiveKit، وهون بس معلومات الغرفة

create table public.rooms (
  owner uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- رقم الغرفة = رقم صاحبها (بيتعبّى تلقائياً)
  number bigint not null unique,
  name text not null check (char_length(name) between 2 and 24),
  seats integer not null default 8 check (seats between 2 and 16),
  category text not null default 'سوالف' check (char_length(category) between 1 and 12),
  created_at timestamptz not null default now()
);

create function public.set_room_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select public_id into new.number from public.profiles where id = new.owner;
  return new;
end;
$$;

create trigger rooms_set_number
  before insert on public.rooms
  for each row execute function public.set_room_number();

alter table public.rooms enable row level security;

-- الكل بيشوف الغرف، وصاحب الغرفة بس بيعدّلها
revoke all on public.rooms from anon, authenticated;
grant select, delete on public.rooms to authenticated;
grant insert (name, seats, category) on public.rooms to authenticated;
grant update (name, seats, category) on public.rooms to authenticated;

create policy "signed in users can see rooms"
  on public.rooms for select to authenticated
  using (true);

create policy "users create their own room"
  on public.rooms for insert to authenticated
  with check ((select auth.uid()) = owner);

create policy "owners update their room"
  on public.rooms for update to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

create policy "owners delete their room"
  on public.rooms for delete to authenticated
  using ((select auth.uid()) = owner);

-- لما صاحب الغرفة يغيّر عدد المقاعد، اللي جوّا بيشوفوه فوراً
alter publication supabase_realtime add table public.rooms;
