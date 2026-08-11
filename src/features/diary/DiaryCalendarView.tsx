import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import type { BiographyRecord } from '@/src/api/types';
import { RecordCard } from '@/src/components/RecordCard';
import { useTheme } from '@/src/theme/useTheme';
import { dayKey, formatDayHeading, monthGrid, monthLabel, WEEKDAY_LABELS } from '@/src/utils/dates';

// Фото/видео - отдельные корзины (самые частые и самые узнаваемые с
// первого взгляда), всё остальное (документы, PDF, аудио и т.п.) - одна
// общая "прочее" - порт той же классификации, что и на веб-версии
// (frontend/src/components/DiaryCalendar.jsx::classifyAttachment).
function classifyAttachment(contentType: string | null): 'photo' | 'video' | 'other' {
  const type = (contentType || '').toLowerCase();
  if (type.startsWith('image/')) return 'photo';
  if (type.startsWith('video/')) return 'video';
  return 'other';
}

type DayStats = { records: number; photo: number; video: number; other: number };

const STAT_DEFS: { key: keyof DayStats; label: string; color: string }[] = [
  { key: 'records', label: 'Записи', color: '#64748b' },
  { key: 'photo', label: 'Фото', color: '#16a34a' },
  { key: 'video', label: 'Видео', color: '#2563eb' },
  { key: 'other', label: 'Прочие файлы', color: '#d97706' },
];

/**
 * Календарь месяца дневника - порт frontend/src/components/
 * DiaryCalendar.jsx. Обычная сетка на View/Pressable, без сторонней
 * календарной библиотеки - тот же принцип, что и веб-версия (там тоже
 * просто div'ы).
 */
export function DiaryCalendarView({ records }: { records: BiographyRecord[] }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const statsByDay = useMemo(() => {
    const stats = new Map<string, DayStats>();
    for (const record of records) {
      const key = dayKey(record.created_at);
      if (!stats.has(key)) stats.set(key, { records: 0, photo: 0, video: 0, other: 0 });
      const entry = stats.get(key)!;
      entry.records += 1;
      for (const attachment of record.attachments) {
        entry[classifyAttachment(attachment.content_type)] += 1;
      }
    }
    return stats;
  }, [records]);

  const cells = monthGrid(year, month);
  const todayKey = dayKey(new Date().toISOString());
  const selectedRecords = selectedDay ? records.filter((r) => dayKey(r.created_at) === selectedDay) : [];

  const changeMonth = (delta: number) => {
    setCursor(new Date(year, month + delta, 1));
    setSelectedDay(null);
  };

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.header}>
          <Pressable onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.textMuted} />
          </Pressable>
          <Text style={styles.headerLabel}>{monthLabel(year, month)}</Text>
          <Pressable onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {WEEKDAY_LABELS.map((w) => (
            <View key={w} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{w}</Text>
            </View>
          ))}
          {cells.map((cell, index) => {
            if (!cell.key) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const stats = statsByDay.get(cell.key);
            const hasRecords = !!stats && stats.records > 0;
            const isSelected = cell.key === selectedDay;
            const isToday = cell.key === todayKey;
            return (
              <Pressable
                key={cell.key}
                disabled={!hasRecords}
                onPress={() => setSelectedDay(cell.key)}
                style={[
                  styles.dayCell,
                  hasRecords && styles.dayCellActive,
                  isSelected && styles.dayCellSelected,
                  isToday && styles.dayCellToday,
                ]}>
                <Text style={styles.dayNumber}>{cell.date!.getDate()}</Text>
                {hasRecords && (
                  <View style={styles.statRow}>
                    {STAT_DEFS.map((def) => {
                      const count = stats![def.key];
                      if (count === 0) return null;
                      return (
                        <View key={def.key} style={[styles.statDot, { backgroundColor: def.color }]}>
                          <Text style={styles.statDotText}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {selectedDay && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedHeading}>{formatDayHeading(selectedDay)}</Text>
          {selectedRecords.map((record) => (
            <Pressable
              key={record.id}
              onPress={() => router.push({ pathname: '/record/[id]', params: { id: String(record.id) } })}>
              <RecordCard record={record} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    headerLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    weekdayCell: {
      width: '14.28%',
      alignItems: 'center',
      paddingBottom: theme.spacing.xs,
    },
    weekdayText: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    dayCell: {
      width: '14.28%',
      minHeight: 48,
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
    },
    dayCellActive: {
      backgroundColor: theme.colors.accentLight,
    },
    dayCellSelected: {
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    dayCellToday: {
      backgroundColor: theme.colors.background,
    },
    dayNumber: {
      fontSize: 13,
      color: theme.colors.text,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
      justifyContent: 'center',
      marginTop: 2,
    },
    statDot: {
      minWidth: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    statDotText: {
      fontSize: 9,
      color: '#fff',
      fontWeight: '700',
    },
    selectedSection: {
      marginTop: theme.spacing.lg,
    },
    selectedHeading: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
  });
}
