import { Platform } from 'react-native';
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
 * ВАЖНАЯ ОГОВОРКА: SecureStore физически не существует в браузере (нет
 * ни Keychain, ни Keystore у веб-страницы) - на вебе `expo-secure-store`
 * не заглушка с ошибкой, а падает в рантайме при вызове. Раз в проекте
 * всё равно есть `--web` режим (для быстрого просмотра на ПК, см. корневой
 * README.md), здесь два разных хранилища под капотом: настоящий SecureStore
 * на телефоне (iOS/Android) и localStorage браузера на вебе. localStorage
 * не шифрует данные - для веб-режима, который существует только как
 * удобство разработки, а не как то, чем будут пользоваться реальные люди,
 * это осознанно приемлемый компромисс, не строгий стандарт безопасности.
 *
 * Все функции ниже - тонкие обёртки в одном месте, чтобы остальной код
 * (AuthContext, api/auth.ts) не знал про это разделение вообще, только
 * "положить токен"/"достать токен"/"убрать токен".
 */

const TOKEN_KEY = 'biographia_device_token';
const isWeb = Platform.OS === 'web';

export async function getStoredToken(): Promise<string | null> {
  if (isWeb) {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
