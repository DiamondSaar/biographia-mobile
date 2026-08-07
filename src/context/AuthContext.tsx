import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import * as authApi from '@/src/api/auth';
import { getStoredToken } from '@/src/api/tokenStorage';
import type { Viewer } from '@/src/api/types';

/**
 * "Кто сейчас залогинен" - доступно любому экрану через useAuth().
 * Аналог ViewerContext.jsx у веб-версии (frontend/src/ViewerContext.jsx),
 * только там источник правды - cookie-сессия браузера, а здесь - токен
 * в SecureStore (см. src/api/tokenStorage.ts).
 *
 * ПОЧЕМУ через React Context, а не просто глобальная переменная: когда
 * пользователь входит/выходит, все экраны, которые показывают "кто я" или
 * решают "пускать на этот экран или нет" (см. app/_layout.tsx), должны
 * узнать об этом и перерисоваться - именно для этого и нужен Context,
 * обычная переменная такого оповещения не даёт.
 */

type AuthState = {
  viewer: Viewer | null;
  // true, пока приложение при запуске проверяет, есть ли сохранённый
  // токен - экран логина не должен на долю секунды мелькнуть перед тем,
  // как выяснится, что пользователь уже был залогинен.
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // При старте приложения: если токен уже лежит в SecureStore (человек
  // логинился раньше и не выходил) - подтверждаем его на сервере через
  // GET /whoami и сразу пускаем внутрь, не заставляя вводить пароль заново
  // при каждом открытии приложения. Если токен успел стать недействительным
  // (например, отозван через /auth/mobile/logout с другого устройства) -
  // /whoami ответит 401, и мы просто остаёмся разлогиненными (экран входа).
  useEffect(() => {
    getStoredToken().then(async (token) => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const restoredViewer = await authApi.fetchViewer();
        setViewer(restoredViewer);
      } catch {
        // Токен есть, но невалиден - ничего страшного, просто не логиним.
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  const login = async (username: string, password: string) => {
    const loggedInViewer = await authApi.login(username, password);
    setViewer(loggedInViewer);
  };

  const logout = async () => {
    await authApi.logout();
    setViewer(null);
  };

  return <AuthContext.Provider value={{ viewer, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

// Хук для использования в экранах: const { viewer, logout } = useAuth();
// Бросает понятную ошибку, если кто-то забудет обернуть дерево компонентов
// в <AuthProvider> - без этой проверки было бы непонятное "cannot read
// property of null" где-то в глубине компонента.
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider>');
  }
  return context;
}
