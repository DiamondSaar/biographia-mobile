import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as cryptoApi from '@/src/api/crypto';
import { ApiError } from '@/src/api/client';
import { unwrapMasterKey, unwrapMasterKeyWithOracle } from '@/src/crypto/masterKey';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import { useTheme } from '@/src/theme/useTheme';
import { RecoveryScreen } from './RecoveryScreen';
import { oracleCall, oracleErrorMessage } from './oracleClient';

/**
 * Разблокировка личной зоны - зеркалит UnlockForm веб-версии (пароль +
 * ссылка "забыли пароль" → RecoveryScreen), плюс то, чего на вебе нет:
 * кнопка биометрической разблокировки сверху, если она уже включена
 * (см. PersonalKeyContext.tsx's tryBiometricUnlock/hasBiometricKeyStored).
 * WebAuthn PRF (физический ключ) сюда не переносится - для телефона это
 * решается проще, встроенной биометрией.
 */
export function UnlockScreen({ onUnlocked }: { onUnlocked: (offerBiometricEnable: boolean) => void }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { canUseBiometrics, hasBiometricKeyStored, tryBiometricUnlock, unlock } = usePersonalKey();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isBiometricBusy, setIsBiometricBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const unlockWithPassword = async () => {
    setError(null);
    setIsUnlocking(true);
    try {
      const material = await cryptoApi.cryptoMaterial();
      const masterKey =
        material.kdf_algorithm === 'argon2id+oracle'
          ? await unwrapMasterKeyWithOracle(password, material, oracleCall)
          : unwrapMasterKey(password, material); // старые (до оракула) строки
      unlock(masterKey);
      // Разблокировано паролем - если биометрия доступна и ещё не
      // включена, стоит предложить её прямо сейчас (см. DiaryScreen.tsx).
      onUnlocked(canUseBiometrics && !hasBiometricKeyStored);
    } catch (err) {
      // err.data значит, что оракул/relay вернул структурированную ошибку
      // (rate-limited, inactive, ...) - обычная ошибка расшифровки AEAD
      // (неверный пароль) такого поля не несёт, для неё общий текст.
      setError(err instanceof ApiError && err.data ? oracleErrorMessage(err) : 'Неверный пароль или повреждённые данные.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const unlockWithBiometrics = async () => {
    setError(null);
    setIsBiometricBusy(true);
    try {
      const ok = await tryBiometricUnlock();
      // tryBiometricUnlock() сам вызывает unlock() из PersonalKeyContext
      // при успехе - биометрия уже была включена раньше, предлагать её
      // снова не нужно (offerBiometricEnable: false).
      if (ok) onUnlocked(false);
      else setError('Не удалось разблокировать биометрией — попробуйте пароль.');
    } finally {
      setIsBiometricBusy(false);
    }
  };

  if (showRecovery) {
    return (
      <View style={styles.container}>
        <RecoveryScreen
          onUnlocked={(key) => {
            unlock(key);
            onUnlocked(canUseBiometrics && !hasBiometricKeyStored);
          }}
        />
        <Pressable onPress={() => setShowRecovery(false)}>
          <Text style={styles.linkText}>Назад ко входу по паролю</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Разблокировать личную зону</Text>

      {canUseBiometrics && hasBiometricKeyStored && (
        <Pressable style={styles.biometricButton} onPress={unlockWithBiometrics} disabled={isBiometricBusy}>
          {isBiometricBusy ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <>
              <Ionicons name="finger-print-outline" size={20} color={theme.colors.accent} />
              <Text style={styles.biometricButtonText}>Разблокировать биометрией</Text>
            </>
          )}
        </Pressable>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Пароль</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
      <Pressable style={styles.primaryButton} onPress={unlockWithPassword} disabled={isUnlocking}>
        {isUnlocking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Разблокировать</Text>}
      </Pressable>
      <Pressable onPress={() => setShowRecovery(true)}>
        <Text style={styles.linkText}>Забыли пароль? Восстановить по seed-фразе</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    biometricButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    biometricButtonText: {
      color: theme.colors.accent,
      fontSize: 15,
      fontWeight: '600',
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: 15,
      color: theme.colors.text,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    linkText: {
      color: theme.colors.accent,
      fontSize: 13,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
    errorBox: {
      backgroundColor: theme.colors.warnBg,
      borderColor: theme.colors.warnBorder,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    errorText: {
      color: theme.colors.warn,
      fontSize: 13,
    },
  });
}
