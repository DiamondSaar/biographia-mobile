import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RecordCard } from '@/src/components/RecordCard';
import { useTheme } from '@/src/theme/useTheme';
import type { BiographyRecord } from '@/src/api/types';
import { AddRecordForm } from './AddRecordForm';

type RecordsFeedProps = {
  // Внедряется снаружи (fetchRecentRecords или fetchMyRecords из
  // src/api/records.ts) - RecordsFeed не знает и не должен знать, "Вики"
  // он показывает или "Мои записи". Тот же приём, что и с RecordCard -
  // компонент переиспользуется, потому что не завязан на конкретный
  // источник данных.
  loadRecords: () => Promise<{ results: BiographyRecord[] }>;
  emptyMessage: string;
};

/**
 * Лента записей + кнопка "Добавить" + форма создания. И "Вики" (лента
 * последних записей), и раздел "Мои записи" в личном кабинете - это одна
 * и та же механика с разным источником данных, поэтому она вынесена в
 * общий компонент, а не продублирована дважды.
 */
export function RecordsFeed({ loadRecords, emptyMessage }: RecordsFeedProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [records, setRecords] = useState<BiographyRecord[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await loadRecords();
      setRecords(data.results);
      setError(null);
    } catch {
      setError('Не удалось загрузить записи.');
    }
  }, [loadRecords]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const handleCreated = () => {
    setShowForm(false);
    load(); // обновляем ленту, чтобы новая запись сразу стала видна
  };

  if (records === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={records ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <RecordCard record={item} />}
        contentContainerStyle={styles.listContent}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={showForm ? <AddRecordForm onCreated={handleCreated} onCancel={() => setShowForm(false)} /> : null}
        ListEmptyComponent={
          error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          )
        }
      />

      {!showForm && (
        <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    listContent: {
      padding: theme.spacing.md,
      flexGrow: 1,
    },
    emptyText: {
      textAlign: 'center',
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xl,
    },
    errorText: {
      textAlign: 'center',
      color: theme.colors.danger,
      marginTop: theme.spacing.xl,
    },
    fab: {
      position: 'absolute',
      right: theme.spacing.lg,
      bottom: theme.spacing.lg,
      width: 56,
      height: 56,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5, // тень на Android (shadow* работает только на iOS)
    },
  });
}
