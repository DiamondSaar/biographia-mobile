import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/useTheme';
import { listOutboxItems, onOutboxChanged, processOutbox, type OutboxItem } from './outbox';

function attachmentWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'вложение';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'вложения';
  return 'вложений';
}

/**
 * Показывает, что в офлайн-очереди (src/offline/outbox.ts) что-то ждёт
 * отправки - без этого баннера человек не узнал бы, что данные вообще
 * сохранены (а не потеряны), пока сам не откроет запись и не увидит
 * недостающее вложение. Тап - ручная попытка отправить сейчас, не дожидаясь
 * следующего открытия/pull-to-refresh экрана.
 */
export function OutboxBanner() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  const refresh = useCallback(() => {
    listOutboxItems().then(setItems);
  }, []);

  useEffect(() => {
    refresh();
    return onOutboxChanged(refresh);
  }, [refresh]);

  if (items.length === 0) return null;

  const attachmentCount = items.reduce((sum, item) => sum + item.attachments.length, 0);

  const handleRetry = async () => {
    setIsSending(true);
    await processOutbox();
    setIsSending(false);
  };

  return (
    <Pressable style={styles.banner} onPress={handleRetry} disabled={isSending}>
      {isSending ? (
        <ActivityIndicator size="small" color={theme.colors.warn} />
      ) : (
        <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.warn} />
      )}
      <View style={styles.textBlock}>
        <Text style={styles.title}>
          {items.length} {items.length === 1 ? 'запись ждёт' : 'записи/файла ждут'} отправки
        </Text>
        <Text style={styles.hint}>
          {attachmentCount > 0
            ? `${attachmentCount} ${attachmentWord(attachmentCount)} сохранено на телефоне - нажмите, чтобы отправить сейчас`
            : 'Нет соединения - нажмите, чтобы попробовать сейчас'}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.warnBg,
      borderWidth: 1,
      borderColor: theme.colors.warnBorder,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      margin: theme.spacing.md,
      marginBottom: 0,
    },
    textBlock: { flex: 1 },
    title: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.warn,
    },
    hint: {
      fontSize: 12,
      color: theme.colors.warn,
      marginTop: 2,
    },
  });
}
