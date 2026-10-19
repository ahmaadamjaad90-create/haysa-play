-- متجر الجواهر
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0006)
--
-- الشراء الحقيقي بيجي من RevenueCat (آبل وقوقل) لما نجهّز حسابات المطورين:
-- دالة على السيرفر بتستقبل إشعار الشراء وبتنادي credit_gem_package.
-- لحد هداك الوقت: حسابات التجربة (testers) بتقدر "تشتري" ببلاش عشان نجرّب.

create table public.gem_packages (
  key text primary key,
  name text not null,
  gems integer not null check (gems > 0),
  price_usd numeric(6, 2) not null,
  -- رقم المنتج بمتجر آبل وقوقل (RevenueCat)
  store_product_id text not null unique,
  sort integer not null
);

insert into public.gem_packages (key, name, gems, price_usd, store_product_id, sort) values
  ('cup',      'فنجان جواهر',  200,   0.99,  'haysa_gems_200',   1),
  ('dalla',    'دلّة جواهر',   1100,  4.99,  'haysa_gems_1100',  2),
  ('tray',     'صينية جواهر',  2300,  9.99,  'haysa_gems_2300',  3),
  ('crate',    'سحّارة جواهر', 5000,  19.99, 'haysa_gems_5000',  4),
  ('safe',     'خزنة جواهر',   13000, 49.99, 'haysa_gems_13000', 5),
  ('treasure', 'كنز جواهر',    28000, 99.99, 'haysa_gems_28000', 6);

alter table public.gem_packages enable row level security;
revoke all on public.gem_packages from anon, authenticated;
grant select on public.gem_packages to authenticated;
create policy "everyone reads packages" on public.gem_packages for select to authenticated using (true);

-- كل عملية شراء (وحدة بس لكل رقم عملية من المتجر)
create table public.gem_purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  package text not null references public.gem_packages (key),
  gems integer not null,
  doubled boolean not null,
  store_tx_id text not null unique,
  created_at timestamptz not null default now()
);

create index gem_purchases_user_idx on public.gem_purchases (user_id, package);

alter table public.gem_purchases enable row level security;
revoke all on public.gem_purchases from anon, authenticated;
grant select on public.gem_purchases to authenticated;
create policy "users read their purchases" on public.gem_purchases for select to authenticated
  using ((select auth.uid()) = user_id);

-- حسابات التجربة: بتنضاف يدوياً من SQL Editor
create table public.testers (
  user_id uuid primary key references public.profiles (id) on delete cascade
);
alter table public.testers enable row level security;
revoke all on public.testers from anon, authenticated;

-- إعلانات الجواهر المجانية (١٠ باليوم، كل وحدة ١٠ جواهر)
create table public.ad_rewards (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  gems integer not null,
  created_at timestamptz not null default now()
);
create index ad_rewards_user_day_idx on public.ad_rewards (user_id, created_at desc);
alter table public.ad_rewards enable row level security;
revoke all on public.ad_rewards from anon, authenticated;
grant select on public.ad_rewards to authenticated;
create policy "users read their ad rewards" on public.ad_rewards for select to authenticated
  using ((select auth.uid()) = user_id);

-- إضافة جواهر الباقة. أول شراء لكل باقة: ضعف الجواهر.
-- ما بتنادى من التطبيق مباشرة، بس من السيرفر أو من tester_purchase.
create function public.credit_gem_package(buyer uuid, pkg text, tx_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.gem_packages;
  first_time boolean;
  amount integer;
begin
  select * into p from public.gem_packages where key = pkg;
  if not found then raise exception 'unknown package'; end if;

  -- نفس العملية ما بتنحسب مرتين
  if exists (select 1 from public.gem_purchases where store_tx_id = tx_id) then
    return (select gems from public.profiles where id = buyer);
  end if;

  perform 1 from public.profiles where id = buyer for update;
  first_time := not exists (select 1 from public.gem_purchases where user_id = buyer and package = pkg);
  amount := case when first_time then p.gems * 2 else p.gems end;

  insert into public.gem_purchases (user_id, package, gems, doubled, store_tx_id)
  values (buyer, pkg, amount, first_time, tx_id);
  update public.profiles set gems = gems + amount where id = buyer;

  return (select gems from public.profiles where id = buyer);
end;
$$;

revoke execute on function public.credit_gem_package(uuid, text, text) from public, anon, authenticated;

-- شراء تجريبي ببلاش، لحسابات التجربة بس
create function public.tester_purchase(pkg text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.testers where user_id = auth.uid()) then
    raise exception 'not a tester';
  end if;
  return public.credit_gem_package(auth.uid(), pkg, 'test-' || gen_random_uuid());
end;
$$;

revoke execute on function public.tester_purchase(text) from public, anon;
grant execute on function public.tester_purchase(text) to authenticated;

-- هل أنا حساب تجربة؟
create function public.am_i_tester()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.testers where user_id = auth.uid());
$$;
revoke execute on function public.am_i_tester() from public, anon;
grant execute on function public.am_i_tester() to authenticated;

-- مكافأة إعلان. ما بتنادى من التطبيق مباشرة:
-- لاحقاً AdMob بيأكد إن الإعلان انشاف (Server-Side Verification) وبعدين السيرفر بيناديها.
create function public.credit_ad_reward(viewer uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today integer;
begin
  perform 1 from public.profiles where id = viewer for update;
  select count(*) into today from public.ad_rewards
  where user_id = viewer and created_at >= date_trunc('day', now());
  if today >= 10 then raise exception 'daily limit'; end if;

  insert into public.ad_rewards (user_id, gems) values (viewer, 10);
  update public.profiles set gems = gems + 10 where id = viewer;
  return (select gems from public.profiles where id = viewer);
end;
$$;

revoke execute on function public.credit_ad_reward(uuid) from public, anon, authenticated;
