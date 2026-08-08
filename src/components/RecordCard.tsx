import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { AccessLevel } from '@/src/theme/colors';
import { useTheme } from '@/src/theme/useTheme';
import type { BiographyRecord } from '@/src/api/types';
import { usePersonalContent } from '@/src/features/diary/usePersonalContent';
import { RECORD_TYPE_LABELS, ZONE_LABELS } from '@/src/features/records/labels';
import { formatDateTime } from '@/src/utils/dates';

/**
 * Одна карточка записи в ленте. Сознательно "тупой" компонент - вся логика
 * (откуда взять список записей, что делать по нажатию) живёт выше, в
 * экране, который его вызывает; RecordCard просто рисует то, что ему дали
 * через props. Это упрощает переиспользование - одна и та же карточка
 * подойдёт и для ленты "Вики", и для "Моих записей", и позже для карточки
 * конкретной сущности - экрану не нужно ничего знать про её внутреннее
 * устройство.
 *
 * Полоска слева и цвет ранга доступа - тот же визуальный язык, что в
 * Dominex и на веб-версии Biographia (.access-badge/.access-border-* в
 * frontend/src/styles/main.css) - тот же ранг должен выглядеть одинаково
 * во всей экосистеме.
 */
export function RecordCard({ record }: { record: BiographyRecord }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { content, failed, locked } = usePersonalContent(record);

  const accessLevel = record.access_level as AccessLevel | null;
  const borderColor = accessLevel ? theme.accessLevelColors[accessLevel].border : theme.colors.border;

  // Для личной зоны заголовок/текст берутся из расшифрованного content
  // (usePersonalContent выше), а не напрямую из record - на сервере их
  // просто нет в открытом виде (см. record.encrypted_content вместо них).
  const title = record.zone === 'personal' ? content?.title : record.title;
  const body = record.zone === 'personal' ? content?.body : record.body;

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {locked ? '🔒 Личная запись' : title || '(без заголовка)'}
        </Text>
        {accessLevel && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.accessLevelColors[accessLevel].bg,
                borderColor: theme.accessLevelColors[accessLevel].border,
              },
            ]}>
            <Text style={[styles.badgeText, { color: theme.accessLevelColors[accessLevel].text }]}>
              {accessLevel}
            </Text>
          </View>
        )}
      </View>

      {locked && (
        <View style={styles.metaRow}>
          <Ionicons name="lock-closed-outline" size={13} color={theme.colors.textMuted} />
          <Text style={[styles.metaText, { marginLeft: theme.spacing.xs }]}>Разблокируйте дневник, чтобы увидеть содержимое</Text>
        </View>
      )}
      {!locked && failed && <Text style={styles.errorInline}>Не удалось расшифровать запись.</Text>}
      {!locked && !failed && !!body && (
        <Text style={styles.body} numberOfLines={4}>
          {body}
        </Text>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{ZONE_LABELS[record.zone]}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{RECORD_TYPE_LABELS[record.record_type]}</Text>
      </View>

      <Text style={styles.author}>
        {record.author_display_name || record.author_username} · {formatDateTime(record.created_at)}
      </Text>
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
      borderLeftWidth: 4,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    badge: {
      borderWidth: 1,
      borderRadius: theme.radius.round,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    body: {
      fontSize: 14,
      color: theme.colors.text,
      marginTop: theme.spacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    metaText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    metaDot: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginHorizontal: theme.spacing.xs,
    },
    errorInline: {
      fontSize: 13,
      color: theme.colors.danger,
      marginTop: theme.spacing.xs,
    },
    author: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xs,
    },
  });
}
