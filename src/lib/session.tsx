import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Provider = 'apple' | 'google' | 'facebook' | 'phone';

export type User = {
  // رقم ID ثابت ما بيتغير. مؤقتاً بينولد على الجهاز، ولما نربط Supabase
  // بيصير السيرفر هو اللي يعطيه من تسلسل (sequence) بقاعدة البيانات.
  id: number;
  provider: Provider;
  phone?: string;
  name: string;
  avatar: string;
  coins: number;
  gems: number;
  // false لحد ما يخلص شاشة "خلّينا نعرفك"
  ready: boolean;
};

type Session = {
  user: User | null;
  loading: boolean;
  signIn: (provider: Provider, phone?: string) => Promise<User>;
  completeSetup: (name: string, avatar: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const KEY = 'haysa.session.v1';
const Ctx = createContext<Session | null>(null);

function newPublicId() {
  return 100000 + Math.floor(Math.random() * 900000);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setUser(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (next: User | null) => {
    setUser(next);
    if (next) await AsyncStorage.setItem(KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(KEY);
  };

  const signIn: Session['signIn'] = async (provider, phone) => {
    // TODO(Supabase): تسجيل دخول حقيقي بـ Apple/Google/Facebook/OTP
    const next: User = user ?? {
      id: newPublicId(),
      provider,
      phone,
      name: '',
      avatar: 'dalla',
      coins: 500,
      gems: 0,
      ready: false,
    };
    await save(next);
    return next;
  };

  const completeSetup: Session['completeSetup'] = async (name, avatar) => {
    if (!user) return;
    await save({ ...user, name, avatar, ready: true });
  };

  const signOut = () => save(null);

  return (
    <Ctx.Provider value={{ user, loading, signIn, completeSetup, signOut }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
