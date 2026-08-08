import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

/**
 * "Какую тему показывать" - отдельно от AuthContext.tsx (тот про "кто
 * залогинен", этот про "как выглядит интерфейс"), потому что это две
 * независимые вещи: тема не требует входа в аккаунт и должна помниться
 * даже после выхода.
 *
 * 'system' - как настроено на телефоне (было единственным вариантом
 * раньше, см. src/theme/useTheme.ts); 'light'/'dark' - зафиксировано
 * вручную, не следует за системой. AsyncStorage, а не SecureStore - это
 * не секрет, обычная настройка интерфейса, шифровать её незачем (в
 * отличие от токена входа, см. src/api/tokenStorage.ts).
 */

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'biographia_theme_mode';

type ThemeModeState = {
  mode: ThemeMode;
  // Итоговая схема после применения выбора - то, что реально нужно
  // компонентам для покраски (см. src/theme/useTheme.ts). Если mode
  // 'system' - берётся из настроек телефона, иначе - то, что выбрал
  // пользователь напрямую.
  resolvedScheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeState | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  };

  const resolvedScheme: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  return (
    <ThemeModeContext.Provider value={{ mode, resolvedScheme, setMode }}>{children}</ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeState {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode() must be used inside <ThemeModeProvider>');
  }
  return context;
}
