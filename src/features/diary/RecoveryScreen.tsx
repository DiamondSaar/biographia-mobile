import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import * as cryptoApi from '@/src/api/crypto';
import { DEFAULT_KDF_PARAMS, isValidSeedPhrase, masterKeyFromSeedPhrase, wrapMasterKeyWithOracle } from '@/src/crypto/masterKey';
import { useTheme } from '@/src/theme/useTheme';
import { oracleCall, oracleErrorMessage } from './oracleClient';

/**
 * Восстановление по сид-фразе - зеркалит RecoveryForm веб-версии.
 * Заодно точка перехода на новую (защищённую оракулом) схему для тех,
 * у кого ключ ещё завёрнут по старой (см. комментарий в wrapMasterKeyWithOracle
 * в src/crypto/masterKey.ts) - принудительной миграции больше нигде нет.
 */
export function RecoveryScreen({ onUnlocked }: { onUnlocked: (masterKey: Uint8Array) => void }) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [mnemonic, setMnemonic] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const recover = async () => {
    setError(null);
    if (!isValidSeedPhrase(mnemonic)) {
      setError('Похоже, seed-фраза введена неверно.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Новый пароль должен быть не короче 8 символов.');
      return;
    }
    setIsBusy(true);
    try {
      const masterKey = masterKeyFromSeedPhrase(mnemonic);
      const material = await wrapMasterKeyWithOracle(masterKey, newPassword, oracleCall, DEFAULT_KDF_PARAMS);
      await cryptoApi.cryptoSetup(material);
      onUnlocked(masterKey);
    } catch (err) {
      setError(oracleErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Text style={styles.label}>Seed-фраза (12 слов)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={mnemonic}
        onChangeText={setMnemonic}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.label}>Новый пароль</Text>
      <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <Pressable style={styles.button} onPress={recover} disabled={isBusy}>
        {isBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Восстановить доступ</Text>}
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      marginTop: theme.spacing.md,
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
    textArea: {
      minHeight: 70,
      textAlignVertical: 'top',
    },
    button: {
      backgroundColor: theme.colors.textMuted,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    buttonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    errorBox: {
      backgroundColor: theme.colors.warnBg,
      borderColor: theme.colors.warnBorder,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    errorText: {
      color: theme.colors.warn,
      fontSize: 13,
    },
  });
}
