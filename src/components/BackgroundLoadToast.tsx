import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/src/theme/useTheme';

/**
 * Маленький баннер "файл грузится" - показывается только если загрузка
 * реально затянулась (см. SLOW_THRESHOLD_MS в useAttachmentFile.ts),
 * чтобы не мигать им на каждый мгновенный тап по уже закешированному
 * файлу. Не модальный, не блокирует остальной интерфейс - человек может
 * продолжать пользоваться приложением, пока файл тянется.
 */
export function BackgroundLoadToast({ filename }: { filename: string }) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={theme.colors.accent} />
      <Text style={styles.text} numberOfLines={1}>
        Загрузка «{filename}» идёт в фоне...
      </Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    text: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.textMuted,
    },
  });
}
