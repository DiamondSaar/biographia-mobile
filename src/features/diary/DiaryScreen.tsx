import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/useTheme';

/**
 * Личный дневник - заглушка в этой первой версии, ЧЕСТНО, а не притворяясь
 * рабочей функцией. Причина не техническая лень, а реальная зависимость:
 * личные записи на бэкенде хранятся зашифрованными на стороне клиента
 * (zone=personal, поле encrypted_content) - устройство само шифрует текст
 * перед отправкой, сервер вообще не видит содержимое. Эта крипто-часть
 * (веб-версия: frontend/src/crypto/masterKey.ts) на мобильном ещё не
 * перенесена - см. корневой README.md, раздел "Осознанно отложено".
 *
 * Когда до этого дойдёт очередь: понадобится порт masterKey.ts на RN
 * (сами крипто-библиотеки - @noble/*, @scure/bip39 - чистый JS/TS без
 * платформенных завязок, должны заработать и в React Native почти без
 * изменений) плюс экран разблокировки (пароль/сид-фраза).
 */
export function DiaryScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed-outline" size={48} color={theme.colors.textMuted} />
      <Text style={styles.title}>Личный дневник ещё не готов</Text>
      <Text style={styles.text}>
        Личные записи шифруются на устройстве перед отправкой на сервер. Этот механизм пока перенесён
        только в веб-версию. Загляните на biographia.ssod.pro, чтобы вести личный дневник уже сейчас.
      </Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.background,
      gap: theme.spacing.md,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
    },
    text: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
