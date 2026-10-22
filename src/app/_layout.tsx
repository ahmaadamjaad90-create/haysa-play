import { Lalezar_400Regular } from '@expo-google-fonts/lalezar';
import {
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from '@expo-google-fonts/tajawal';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

// على الجوال: بيجهّز WebRTC لـ LiveKit قبل أي غرفة صوت
import '@/lib/livekitPlatform';
import { SessionProvider } from '@/lib/session';
// بيسجّل فتح الصوت من أول لمسة بالتطبيق (سفاري ما بيشغّل صوت بدونها)
import '@/lib/sound';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

// على الويب: react-native-web بيحتاج dir="rtl" على عنصر أب عشان يقلب start/end
// (على الجوال forcesRTL بـ app.json بيعمل نفس الشي)
const rtlWeb = Platform.OS === 'web' ? ({ dir: 'rtl' } as object) : {};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Lalezar_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <View style={{ flex: 1 }} {...rtlWeb}>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </SessionProvider>
    </View>
  );
}
