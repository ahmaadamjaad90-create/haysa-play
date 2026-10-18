-- الأصدقاء وطلبات الصداقة
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0001)
-- التطبيق ما بيلمس الجدول مباشرة: كل شي من خلال الدوال تحت

create table public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- علاقة وحدة بس بين أي شخصين، مهما كان مين بعت الطلب
create unique index friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

-- بعت طلب صداقة برقم الـ ID
-- النتيجة: sent | accepted | already_friends | already_sent | not_found | self
create function public.send_friend_request(target_public_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
  existing public.friendships;
begin
  if me is null then raise exception 'not signed in'; end if;

  select id into target from public.profiles where public_id = target_public_id;
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;

  select * into existing from public.friendships
  where (requester = me and addressee = target) or (requester = target and addressee = me);

  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.requester = me then return 'already_sent'; end if;
    -- هو بعتلي طلب من قبل: منصير أصحاب على طول
    update public.friendships set status = 'accepted'
    where requester = target and addressee = me;
    return 'accepted';
  end if;

  insert into public.friendships (requester, addressee) values (me, target);
  return 'sent';
end;
$$;

-- قبول أو رفض طلب وصلني
create function public.respond_friend_request(other_public_id bigint, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select id into other from public.profiles where public_id = other_public_id;

  if accept then
    update public.friendships set status = 'accepted'
    where requester = other and addressee = me and status = 'pending';
  else
    delete from public.friendships
    where requester = other and addressee = me and status = 'pending';
  end if;
end;
$$;

-- حذف صديق، أو إلغاء طلب أنا بعته
create function public.remove_friend(other_public_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select id into other from public.profiles where public_id = other_public_id;

  delete from public.friendships
  where (requester = me and addressee = other) or (requester = other and addressee = me);
end;
$$;

-- كل أصدقائي وطلباتي (الواصلة والمبعوتة)
create function public.my_friends()
returns table (public_id bigint, name text, avatar text, status text, incoming boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.public_id, p.name, p.avatar, f.status, f.addressee = auth.uid()
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by f.created_at desc;
$$;

revoke execute on function public.send_friend_request(bigint) from public, anon;
revoke execute on function public.respond_friend_request(bigint, boolean) from public, anon;
revoke execute on function public.remove_friend(bigint) from public, anon;
revoke execute on function public.my_friends() from public, anon;

grant execute on function public.send_friend_request(bigint) to authenticated;
grant execute on function public.respond_friend_request(bigint, boolean) to authenticated;
grant execute on function public.remove_friend(bigint) to authenticated;
grant execute on function public.my_friends() to authenticated;
