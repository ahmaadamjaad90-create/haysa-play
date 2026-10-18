-- حسابات اللاعبين ورقم ID الثابت
-- بينزل مرة وحدة من Supabase ← SQL Editor

create sequence if not exists public.profile_public_id_seq start 100000;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- رقم ID الظاهر للاعب: بيبلش من 100000 وما بيتغير
  public_id bigint not null unique default nextval('public.profile_public_id_seq'),
  name text check (char_length(name) between 2 and 16),
  avatar text not null default 'dalla',
  coins integer not null default 500 check (coins >= 0),
  gems integer not null default 0 check (gems >= 0),
  vip_points integer not null default 0 check (vip_points >= 0),
  xp integer not null default 0 check (xp >= 0),
  created_at timestamptz not null default now()
);

alter sequence public.profile_public_id_seq owned by public.profiles.public_id;

alter table public.profiles enable row level security;

-- التطبيق بيقرأ الحسابات، وبيعدّل الاسم والصورة بس.
-- العملات والجواهر وVIP وXP بتتغير من السيرفر بس، مش من الجوال.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, avatar) on public.profiles to authenticated;

create policy "signed in users can read profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- كل حساب جديد بياخد صف بـ profiles تلقائياً
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
