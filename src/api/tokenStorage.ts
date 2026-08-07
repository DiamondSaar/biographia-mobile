import * as SecureStore from 'expo-secure-store';

/**
 * Хранение токена устройства (см. POST /auth/mobile/login на бэкенде -
 * app/auth/routes.py::mobile_login в D:\projects\biographia).
 *
 * Почему именно SecureStore, а не, скажем, AsyncStorage: токен - это
 * фактически пароль многоразового действия ("предъявил токен - тебе
 * поверили, что ты залогинен"), поэтому его нельзя хранить в обычном
 * хранилище (AsyncStorage хранит данные как есть, без шифрования).
 * SecureStore на Android использует Keystore, на iOS - Keychain -
 * встроенные механизмы ОС для хранения именно секретов.
 *
 * Все функции ниже - тонкие обёртки в одном месте, чтобы остальной код
 * (AuthContext, api/auth.ts) не знал деталей SecureStore вообще, только
 * "положить токен"/"достать токен"/"убрать токен".
 */

const TOKEN_KEY = 'biographia_device_token';

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
