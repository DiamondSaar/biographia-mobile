import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { ApiError } from '@/src/api/client';
import * as cryptoApi from '@/src/api/crypto';
import { deriveSubkey } from '@/src/crypto/masterKey';
import { bytesToBase64, base64ToBytes } from '@/src/crypto/masterKey';
import { useAuth } from './AuthContext';

/**
 * "Разблокирован ли личный дневник прямо сейчас" - зеркалит
 * PersonalKeyContext.jsx веб-версии
 * (D:\projects\biographia\frontend\src\crypto\PersonalKeyContext.jsx):
 * тот же принцип zero-knowledge - мастер-ключ живёт ТОЛЬКО в памяти
 * (React state), нигде не сохраняется в открытом виде, теряется при
 * закрытии приложения. Единственное, что здесь есть сверх веб-версии -
 * необязательный биометрический быстрый путь (см. ниже), но и он
 * хранит ключ не "в открытую", а за системным Face ID/отпечатком.
 */

type Status = 'loading' | 'not_configured' | 'locked' | 'unlocked' | 'error';

type PersonalKeyState = {
  status: Status;
  // Заполняется только при status==='error' - раньше ошибка проверки
  // статуса шифрования просто проглатывалась (переход в 'error' без
  // единой подробности), человек видел только неизменное "не удалось
  // проверить состояние шифрования" без намёка на причину.
  errorMessage: string | null;
  providers: cryptoApi.CryptoProvider[];
  masterKey: Uint8Array | null;
  subkey: Uint8Array | null;
  unlock: (key: Uint8Array) => void;
  lock: () => void;
  refreshStatus: () => void;
  // Биометрия - см. src/features/diary/BiometricUnlockPrompt.tsx для UI.
  canUseBiometrics: boolean;
  hasBiometricKeyStored: boolean;
  enableBiometricUnlock: () => Promise<void>;
  tryBiometricUnlock: () => Promise<boolean>;
  clearBiometricKey: () => Promise<void>;
};

const PersonalKeyContext = createContext<PersonalKeyState | null>(null);

// Ключ хранится с привязкой к username - на одном телефоне может
// теоретически логиниться больше одного человека (выход/вход другим
// аккаунтом), у каждого свой отдельный биометрический слот, они не
// перезаписывают друг друга.
function biometricStoreKey(username: string) {
  return `personal_master_key_${username}`;
}

export function PersonalKeyProvider({ children }: { children: ReactNode }) {
  const { viewer } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [providers, setProviders] = useState<cryptoApi.CryptoProvider[]>([]);
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [hasBiometricKeyStored, setHasBiometricKeyStored] = useState(false);

  const refreshStatus = () => {
    cryptoApi
      .cryptoStatus()
      .then((data) => {
        setErrorMessage(null);
        setProviders(data.providers || []);
        setStatus((current) => (current === 'unlocked' ? current : data.configured ? 'locked' : 'not_configured'));
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : 'Не удалось соединиться с сервером.');
        setStatus('error');
      });
  };

  useEffect(refreshStatus, []);

  // Проверяем один раз при входе: поддерживает ли устройство биометрию
  // вообще, и есть ли для ЭТОГО пользователя уже сохранённый ключ с
  // прошлого раза (SecureStore.getItemAsync с requireAuthentication:true
  // ниже сам покажет системный запрос при попытке прочитать - здесь
  // просто "есть ли что читать", без запроса Face ID/отпечатка).
  useEffect(() => {
    if (!viewer) return;
    // Синхронная функция (не Promise), несмотря на "Async" в имени
    // соседних методов SecureStore - проверено по фактической ошибке
    // типов, не по памяти/докам.
    try {
      setCanUseBiometrics(SecureStore.canUseBiometricAuthentication());
    } catch {
      setCanUseBiometrics(false);
    }
    SecureStore.getItemAsync(biometricStoreKey(viewer.username), { requireAuthentication: false })
      .then((value) => setHasBiometricKeyStored(!!value))
      .catch(() => setHasBiometricKeyStored(false));
  }, [viewer]);

  const unlock = (key: Uint8Array) => {
    setMasterKey(key);
    setStatus('unlocked');
  };

  const lock = () => {
    setMasterKey(null);
    setStatus('locked');
  };

  // Вызывается после успешной разблокировки паролем, если человек
  // согласился на "Запомнить через биометрию" (см. UnlockScreen.tsx).
  // requireAuthentication: true - при следующем ЧТЕНИИ этого значения ОС
  // сама покажет системный экран биометрии, само значение при этом
  // хранится в Keystore (Android) / Keychain (iOS), не в обычном файле.
  const enableBiometricUnlock = async () => {
    if (!viewer || !masterKey) return;
    await SecureStore.setItemAsync(biometricStoreKey(viewer.username), bytesToBase64(masterKey), {
      requireAuthentication: true,
      authenticationPrompt: 'Разблокировать личный дневник',
    });
    setHasBiometricKeyStored(true);
  };

  // true - разблокировано, false - отменено/не настроено/устройство не
  // подтвердило личность. Не бросает исключение на отказе - это обычный,
  // ожидаемый исход (человек передумал/не приложил палец), а не ошибка.
  const tryBiometricUnlock = async (): Promise<boolean> => {
    if (!viewer) return false;
    try {
      const stored = await SecureStore.getItemAsync(biometricStoreKey(viewer.username), {
        requireAuthentication: true,
        authenticationPrompt: 'Разблокировать личный дневник',
      });
      if (!stored) return false;
      unlock(base64ToBytes(stored));
      return true;
    } catch {
      return false;
    }
  };

  const clearBiometricKey = async () => {
    if (!viewer) return;
    await SecureStore.deleteItemAsync(biometricStoreKey(viewer.username));
    setHasBiometricKeyStored(false);
  };

  const subkey = masterKey ? deriveSubkey(masterKey, 'biographia') : null;

  return (
    <PersonalKeyContext.Provider
      value={{
        status,
        errorMessage,
        providers,
        masterKey,
        subkey,
        unlock,
        lock,
        refreshStatus,
        canUseBiometrics,
        hasBiometricKeyStored,
        enableBiometricUnlock,
        tryBiometricUnlock,
        clearBiometricKey,
      }}>
      {children}
    </PersonalKeyContext.Provider>
  );
}

export function usePersonalKey(): PersonalKeyState {
  const context = useContext(PersonalKeyContext);
  if (!context) {
    throw new Error('usePersonalKey() must be used inside <PersonalKeyProvider>');
  }
  return context;
}
