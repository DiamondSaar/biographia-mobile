import { request } from './client';
import { clearStoredToken, setStoredToken } from './tokenStorage';
import type { Viewer } from './types';

// Ответ сервера на успешный вход - Viewer (кто залогинен) + сам токен.
// Токен показывается только здесь, один раз - дальше он живёт только в
// SecureStore (см. tokenStorage.ts), наружу из api/ больше не "торчит".
type LoginResponse = Viewer & { ok: true; token: string };

/**
 * Вход по логину/паролю (см. POST /auth/mobile/login на бэкенде).
 * Пароль проверяется не здесь и не на Biographia вообще - Biographia
 * пересылает его в Dominex (единственное хранилище паролей во всей
 * экосистеме ССОД) и просто получает "да/нет" в ответ.
 *
 * При успехе сразу сохраняет токен в SecureStore - вызывающему коду
 * (см. src/context/AuthContext.tsx) не нужно самому вызывать setStoredToken.
 */
export async function login(username: string, password: string): Promise<Viewer> {
  const response = await request<LoginResponse>('/auth/mobile/login', {
    method: 'POST',
    body: { username, password },
  });

  await setStoredToken(response.token);

  // Дальше отдаём наружу только "профильную" часть ответа - без токена,
  // компонентам экрана логина/AuthContext он не нужен, они его уже никогда
  // не увидят (и не должны - хранится только в SecureStore).
  const { display_name, access_class, organization, role } = response;
  return { username: response.username, display_name, access_class, organization, role };
}

// Ответ /whoami при успехе - используется при запуске приложения, чтобы
// понять, кто залогинен, если токен уже был сохранён с прошлого раза
// (см. AuthContext.tsx).
type WhoamiResponse = Viewer & { authenticated: true };

/**
 * "Кто я" по уже сохранённому токену - см. GET /whoami на бэкенде
 * (app/main.py::whoami, тоже принимает Bearer-токен через
 * app/core/auth.py::require_session). Бросит ApiError со статусом 401,
 * если токен невалиден/отозван - AuthContext.tsx это ловит и просто не
 * логинит пользователя автоматически (ведёт на экран входа).
 */
export async function fetchViewer(): Promise<Viewer> {
  const response = await request<WhoamiResponse>('/whoami');
  const { username, display_name, access_class, organization, role } = response;
  return { username, display_name, access_class, organization, role };
}

/**
 * Выход - гасит токен на сервере (см. POST /auth/mobile/logout) И убирает
 * его с телефона. Порядок важен: сервер гасим, пока токен ещё сохранён
 * локально (запрос идёт с Authorization-заголовком), а стираем локально
 * уже после - на случай, если запрос к серверу не прошёл (нет сети и т.п.),
 * всё равно считаем пользователя вышедшим на этом устройстве.
 */
export async function logout(): Promise<void> {
  try {
    await request('/auth/mobile/logout', { method: 'POST' });
  } catch {
    // Не страшно, если сервер недоступен - токен всё равно сотрём ниже,
    // человек не должен "застрять" залогиненным из-за обрыва связи.
  }
  await clearStoredToken();
}
