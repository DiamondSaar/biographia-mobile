import { StyleSheet, Text, View } from 'react-native';

import type { AccessLevel } from '@/src/theme/colors';
import { useTheme } from '@/src/theme/useTheme';
import type { BiographyRecord } from '@/src/api/types';
import { usePersonalContent } from '@/src/features/diary/usePersonalContent';
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
export function RecordCard({
  record,
  showEntityLink = true,
}: {
  record: BiographyRecord;
  // false на самой странице объекта (src/features/entities/EntityScreen.tsx) -
  // там ссылка вела бы саму на себя, как и showEntityLink на веб-версии
  // (frontend/src/pages/EntityPage.jsx: <RecordCard showEntityLink={false} />).
  showEntityLink?: boolean;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { content, locked } = usePersonalContent(record);

  const accessLevel = record.access_level as AccessLevel | null;
  const borderColor = accessLevel ? theme.accessLevelColors[accessLevel].border : theme.colors.border;

  // Для личной зоны заголовок берётся из расшифрованного content
  // (usePersonalContent выше), а не напрямую из record - на сервере его
  // просто нет в открытом виде (см. record.encrypted_content вместо него).
  // Текст/тело записи в компактной плитке больше не показывается (см. ниже).
  const title = record.zone === 'personal' ? content?.title : record.title;

  // По запросу пользователя - плитка в списке сжата до двух строк (название +
  // "кем создан / юрлицо / когда"), всё остальное (текст, зона/категория,
  // привязка к объекту, вложения) смотрится по раскрытию - на мобильном это
  // переход на отдельный экран записи (app/record/[id].tsx), поэтому здесь
  // просто убрано, а не спрятано за состоянием - RecordDetailScreen.tsx
  // показывает это всё сам.
  const orgName = showEntityLink ? record.related_organization_display_name : null;

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
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

      <Text style={styles.metaText} numberOfLines={1}>
        {record.author_display_name || record.author_username}
        {orgName ? ` · ${orgName}` : ''}
        {' · '}
        {formatDateTime(record.created_at)}
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
    metaText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xs,
    },
  });
}
