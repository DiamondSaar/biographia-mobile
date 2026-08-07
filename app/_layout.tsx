import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Не даём заставке (splash screen) спрятаться самой - сначала дождёмся и
// шрифтов, и проверки "залогинен ли пользователь" (см. RootNavigator ниже),
// иначе человек на долю секунды увидит не тот экран (например, ленту
// записей, а через миг - что его перекинуло на логин).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  if (!fontsLoaded) {
    return null;
  }

  // AuthProvider оборачивает вообще всё дерево экранов - это единственное
  // место, где он нужен, дальше любой экран может позвать useAuth() и
  // узнать, кто залогинен (см. src/context/AuthContext.tsx).
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { viewer, isLoading } = useAuth();

  useEffect(() => {
    // Как только AuthProvider закончил проверку сохранённого токена
    // (см. AuthContext.tsx's useEffect) - можно наконец показать экран.
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null; // заставка ещё на экране, здесь рисовать нечего
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/*
          Stack.Protected - официальный механизм Expo Router (с SDK 53) для
          "показывать этот экран только если условие истинно". Если guard
          становится false, пока человек на защищённом экране - его
          автоматически перекидывает на первый доступный экран (здесь -
          на login, у него guard true как раз в этом случае). Так что
          отдельно вручную писать router.replace('/login') при выходе
          не нужно - см. useAuth().logout() в src/context/AuthContext.tsx.
        */}
        <Stack.Protected guard={!!viewer}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!viewer}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
