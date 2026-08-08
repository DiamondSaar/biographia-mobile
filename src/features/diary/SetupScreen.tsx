import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import * as cryptoApi from '@/src/api/crypto';
import {
  DEFAULT_KDF_PARAMS,
  generateSeedPhrase,
  masterKeyFromSeedPhrase,
  wrapMasterKeyWithOracle,
} from '@/src/crypto/masterKey';
import { useTheme } from '@/src/theme/useTheme';
import { oracleCall, oracleErrorMessage } from './oracleClient';

/**
 * Первая настройка личной зоны - зеркалит SetupForm из веб-версии
 * (frontend/src/pages/DiaryPage.jsx) шаг в шаг: пароль → сид-фраза на
 * экран "запишите и сохраните" → отправка обёрнутого ключа через оракул.
 * Сервер не видит ни пароль, ни сид-фразу, ни расшифрованный ключ -
 * только результат wrapMasterKeyWithOracle (шифртекст + публичные
 * параметры KDF).
 */
export function SetupScreen({ onDone }: { onDone: (masterKey: Uint8Array) => void }) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [step, setStep] = useState<'password' | 'seed'>('password');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startSetup = () => {
    setError(null);
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    const phrase = generateSeedPhrase();
    setMnemonic(phrase);
    setMasterKey(masterKeyFromSeedPhrase(phrase));
    setStep('seed');
  };

  const finishSetup = async () => {
    if (!masterKey) return;
    setIsSaving(true);
    setError(null);
    try {
      const material = await wrapMasterKeyWithOracle(masterKey, password, oracleCall, DEFAULT_KDF_PARAMS);
      await cryptoApi.cryptoSetup(material);
      onDone(masterKey);
    } catch (err) {
      setError(oracleErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 'password') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Настройка шифрования личной зоны</Text>
        <Text style={styles.hint}>
          Сервер никогда не увидит ни ваш пароль, ни расшифрованные данные — только зашифрованную копию ключа.
        </Text>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <Text style={styles.label}>Пароль</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
        <Text style={styles.label}>Повторите пароль</Text>
        <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry />
        <Pressable style={styles.primaryButton} onPress={startSetup}>
          <Text style={styles.primaryButtonText}>Далее</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Сохраните seed-фразу</Text>
      <View style={styles.warnBox}>
        <Text style={styles.warnText}>
          Это единственный способ восстановить доступ, если пароль будет забыт. Запишите и сохраните офлайн — на
          сервере она не хранится нигде и никогда.
        </Text>
      </View>
      <Text style={styles.mnemonic}>{mnemonic}</Text>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable style={styles.primaryButton} onPress={finishSetup} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Я сохранил фразу — завершить настройку</Text>
        )}
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
      marginBottom: theme.spacing.sm,
    },
    hint: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.lg,
      lineHeight: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.sm,
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
      marginTop: theme.spacing.lg,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    warnBox: {
      backgroundColor: theme.colors.warnBg,
      borderColor: theme.colors.warnBorder,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    warnText: {
      color: theme.colors.warn,
      fontSize: 13,
      lineHeight: 18,
    },
    mnemonic: {
      fontFamily: 'monospace',
      fontSize: 16,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.text,
    },
    errorBox: {
      backgroundColor: theme.colors.warnBg,
      borderColor: theme.colors.warnBorder,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    errorText: {
      color: theme.colors.warn,
      fontSize: 13,
    },
  });
}
