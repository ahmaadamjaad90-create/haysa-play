import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// المفتاح العام (publishable) مسموح يكون ظاهر. الحماية من سياسات RLS بقاعدة البيانات.
const SUPABASE_URL = 'https://lacgtdxzjwreypnhruhg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rNenEaAFYAXBJqQywk_Bag_fiwE3tTe';

const isWeb = Platform.OS === 'web';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // الويب بيستخدم localStorage تلقائياً، والجوال AsyncStorage
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});

// على الجوال: نجدد الجلسة بس والتطبيق مفتوح
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
