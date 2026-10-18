import type { Session as AuthSession } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

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
  // حساب ضيف لسا مش مربوط بـ Google أو غيره
  isGuest: boolean;
  // null يعني الصفحة رايحة على Google وراجعة
  signIn: (provider: Provider, phone?: string) => Promise<User | null>;
  // يربط حساب الضيف بـ Google ويضل نفس الرقم
  linkGoogle: () => Promise<void>;
  // خطأ رجع من Google (مثلاً الحساب مربوط بلاعب تاني)
  authError: string;
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

const isWeb = Platform.OS === 'web';

// بعد Google منرجع لأول صفحة بالتطبيق
function webHome() {
  return `${window.location.origin}/haysa-play/`;
}

// Google بيرجّع الخطأ بالرابط: #error_description=...
function readUrlError() {
  if (!isWeb || typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  const msg = params.get('error_description');
  if (!msg) return '';
  window.history.replaceState(null, '', window.location.pathname);
  return msg.includes('already') ? 'حساب Google هاد مربوط بلاعب تاني' : msg;
}

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
  const [authError] = useState(readUrlError);

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

  const signIn: Session['signIn'] = async (provider) => {
    if (provider === 'google' && isWeb) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: webHome() },
      });
      if (error) throw error;
      return null;
    }
    // TODO: Apple و Facebook و SMS، و Google على الجوال.
    // هلأ هدول بيعملوا حساب ضيف حقيقي بالسيرفر، وبعدين منربطه بالطريقة الحقيقية.
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

  const linkGoogle = async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: webHome() },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{
        user,
        uid: auth?.user.id ?? null,
        isGuest: !!auth?.user.is_anonymous,
        loading,
        signIn,
        linkGoogle,
        authError,
        completeSetup,
        signOut,
      }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
