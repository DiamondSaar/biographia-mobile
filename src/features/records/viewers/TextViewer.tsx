import { File } from 'expo-file-system';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/src/theme/useTheme';

export function TextViewer({ uri }: { uri: string }) {
  const theme = useTheme();
  const styles = createStyles(theme);

  // textSync() - тот же синхронный новый File API, что и остальной кеш/
  // расшифровка (см. src/utils/fileCache.ts) - файл уже локальный,
  // читать его асинхронно смысла нет.
  const content = useMemo(() => {
    try {
      return new File(uri).textSync();
    } catch {
      return null;
    }
  }, [uri]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.text}>{content ?? 'Не удалось прочитать файл как текст.'}</Text>
    </ScrollView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.backgroundCard },
    content: { padding: theme.spacing.md },
    text: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  });
}
