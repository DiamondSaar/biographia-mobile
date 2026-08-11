import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { BiographyRecord } from '@/src/api/types';
import { RecordCard } from '@/src/components/RecordCard';
import { useTheme } from '@/src/theme/useTheme';
import { formatDayHeading, groupByDay, groupBySegment } from '@/src/utils/dates';

/**
 * Лента дневника с группировкой по дням и сегментам времени (Ночь/Утро/
 * День/Вечер) - порт frontend/src/components/DiaryFeed.jsx. Несколько
 * записей за один день теперь видно сразу по общей шапке-дате, а не
 * потерянными вперемешку в общем списке - см. запрос пользователя про
 * организацию заметок.
 */
export function DiaryFeedList({ records }: { records: BiographyRecord[] }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const days = groupByDay(records);

  return (
    <View>
      {days.map(([key, dayRecords]) => (
        <View key={key} style={styles.daySection}>
          <Text style={styles.dayHeading}>{formatDayHeading(key)}</Text>
          {groupBySegment(dayRecords).map(([segment, segmentRecords]) => (
            <View key={segment} style={styles.segmentSection}>
              <Text style={styles.segmentLabel}>{segment}</Text>
              {segmentRecords.map((record) => (
                <Pressable
                  key={record.id}
                  onPress={() => router.push({ pathname: '/record/[id]', params: { id: String(record.id) } })}>
                  <RecordCard record={record} />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    daySection: {
      marginBottom: theme.spacing.lg,
    },
    dayHeading: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    segmentSection: {
      marginBottom: theme.spacing.sm,
    },
    segmentLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.xs,
    },
  });
}
