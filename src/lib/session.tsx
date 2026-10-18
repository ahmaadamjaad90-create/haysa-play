import type { Session as AuthSession } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export type Provider = 'apple' | 'google' | 'facebook' | 'phone';

export type User = {
  // رقم ID ثابت ما بيتغير، بيعطيه السيرفر من تسلسل بقاعدة البيانات
  id: number;
  name: string;
  avatar: string;
  coins: number;
  gems: number;
  // false لحد ما يخلص شاشة "خلّينا نعرفك"
  ready: boolean;
};

type Session = {
  user: User | null;
  // معرّف الحساب الداخلي (uuid) بـ Supabase
  uid: string | null;
  loading: boolean;
  signIn: (provider: Provider, phone?: string) => Promise<User>;
  completeSetup: (name: string, avatar: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type ProfileRow = {
  public_id: number;
  name: string | null;
  avatar: string;
  coins: number;
  gems: number;
};

const Ctx = createContext<Session | null>(null);

function toUser(p: ProfileRow): User {
  return {
    id: p.public_id,
    name: p.name ?? '',
    avatar: p.avatar,
    coins: p.coins,
    gems: p.gems,
    ready: !!p.name,
  };
}

async function fetchProfile(uid: string): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .select('public_id, name, avatar, coins, gems')
    .eq('id', uid)
    .single<ProfileRow>();
  if (error) throw error;
  return toUser(data);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setAuth(data.session);
      if (data.session) setUser(await fetchProfile(data.session.user.id).catch(() => null));
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session);
      if (!session) setUser(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn: Session['signIn'] = async () => {
    // TODO: Apple و Google و Facebook و SMS لما نجهّز حساباتهم.
    // هلأ كل الطرق بتعمل حساب ضيف حقيقي بالسيرفر، وبعدين منربطه بالطريقة الحقيقية.
    let session = auth;
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    if (!session) throw new Error('no session');
    const u = await fetchProfile(session.user.id);
    setUser(u);
    return u;
  };

  const completeSetup: Session['completeSetup'] = async (name, avatar) => {
    if (!auth) return;
    const { error } = await supabase.from('profiles').update({ name, avatar }).eq('id', auth.user.id);
    if (error) throw error;
    setUser(await fetchProfile(auth.user.id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, uid: auth?.user.id ?? null, loading, signIn, completeSetup, signOut }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
