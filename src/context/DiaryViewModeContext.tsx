import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * "Лента или календарь по умолчанию" в дневнике - тот же паттерн, что
 * ThemeModeContext.tsx (AsyncStorage, не SecureStore - обычная настройка
 * интерфейса, не секрет). Отдельный контекст, а не поле внутри
 * ThemeModeContext - тема и вид дневника меняются независимо друг от
 * друга и концептуально не связаны.
 */

export type DiaryViewMode = 'feed' | 'calendar';

const STORAGE_KEY = 'biographia_diary_view_mode';

type DiaryViewModeState = {
  mode: DiaryViewMode;
  setMode: (mode: DiaryViewMode) => void;
};

const DiaryViewModeContext = createContext<DiaryViewModeState | null>(null);

export function DiaryViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DiaryViewMode>('feed');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'feed' || saved === 'calendar') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = (newMode: DiaryViewMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  };

  return <DiaryViewModeContext.Provider value={{ mode, setMode }}>{children}</DiaryViewModeContext.Provider>;
}

export function useDiaryViewMode(): DiaryViewModeState {
  const context = useContext(DiaryViewModeContext);
  if (!context) {
    throw new Error('useDiaryViewMode() must be used inside <DiaryViewModeProvider>');
  }
  return context;
}
