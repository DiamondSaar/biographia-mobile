import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as recordsApi from '@/src/api/records';
import type { BiographyRecord } from '@/src/api/types';
import { useDiaryViewMode } from '@/src/context/DiaryViewModeContext';
import { AddRecordForm } from '@/src/features/records/AddRecordForm';
import { useTheme } from '@/src/theme/useTheme';
import { DiaryCalendarView } from './DiaryCalendarView';
import { DiaryFeedList } from './DiaryFeedList';

/**
 * Тело дневника, когда он разблокирован - порт PersonalFeed из веб-версии
 * (frontend/src/pages/DiaryPage.jsx:327-388): переключатель Лента/
 * Календарь (стартовое значение - из настроек, DiaryViewModeContext) +
 * кнопка добавления записи + сам список, сгруппированный по дням
 * (DiaryFeedList) или показанный календарём (DiaryCalendarView).
 *
 * Отдельный компонент от общего RecordsFeed.tsx (используется "Вики"/
 * "Мои записи") - там группировка по дням не нужна, только у дневника,
 * ровно как и на веб-версии (DiaryFeed/DiaryCalendar никогда не
 * переиспользуются вне DiaryPage).
 */
export function DiaryPersonalFeed() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { mode, setMode } = useDiaryViewMode();

  const [records, setRecords] = useState<BiographyRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await recordsApi.fetchMyPersonalRecords();
      setRecords(data.results);
      setError(null);
    } catch {
      setError('Не удалось загрузить записи.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = () => {
    setShowForm(false);
    load();
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, mode === 'feed' && styles.modeButtonActive]}
            onPress={() => setMode('feed')}>
            <Text style={[styles.modeButtonText, mode === 'feed' && styles.modeButtonTextActive]}>Лента</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'calendar' && styles.modeButtonActive]}
            onPress={() => setMode('calendar')}>
            <Text style={[styles.modeButtonText, mode === 'calendar' && styles.modeButtonTextActive]}>Календарь</Text>
          </Pressable>
        </View>
        <Pressable style={styles.addButton} onPress={() => setShowForm((v) => !v)}>
          <Ionicons name={showForm ? 'close' : 'add'} size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showForm && <AddRecordForm fixedZone="personal" onCreated={handleCreated} onCancel={() => setShowForm(false)} />}

        {error && <Text style={styles.errorText}>{error}</Text>}
        {records === null && !error && (
          <ActivityIndicator color={theme.colors.accent} style={styles.loadingIndicator} />
        )}
        {records !== null && records.length === 0 && (
          <Text style={styles.emptyText}>Пока нет ни одной личной записи.</Text>
        )}
        {records !== null && records.length > 0 && (mode === 'feed' ? (
          <DiaryFeedList records={records} />
        ) : (
          <DiaryCalendarView records={records} />
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    modeRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    modeButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.round,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modeButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    modeButtonText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    modeButtonTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: theme.spacing.md,
      flexGrow: 1,
    },
    loadingIndicator: {
      marginTop: theme.spacing.xl,
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
  });
}
