import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { entityCard, type EntityCard, type EntityResult } from '@/src/api/entities';
import { fetchEntityFeed } from '@/src/api/records';
import type { BiographyRecord } from '@/src/api/types';
import { RecordCard } from '@/src/components/RecordCard';
import { useTheme } from '@/src/theme/useTheme';
import { AddRecordForm } from '@/src/features/records/AddRecordForm';
import { TaskCard } from '@/src/features/records/TaskCard';

type EntityKind = 'entity' | 'organization';

/**
 * Страница объекта/юрлица Dominex - что это (карточка) + прикреплённая к
 * нему лента биографии + быстрое "Прикрепить запись" прямо отсюда (TZ 7.5).
 * Порт веб-версии (frontend/src/pages/EntityPage.jsx) - на мобильном такого
 * экрана раньше не было вовсе, привязка к сущности была видна только как
 * неактивный текст в RecordCard.
 */
export function EntityScreen({ kind, id }: { kind: EntityKind; id: number }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const [entity, setEntity] = useState<EntityCard | null>(null);
  const [records, setRecords] = useState<BiographyRecord[] | null>(null);
  const [tasks, setTasks] = useState<BiographyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [entityData, feedData] = await Promise.all([entityCard(kind, id), fetchEntityFeed(kind, id)]);
      setEntity(entityData);
      setRecords(feedData.results);
      setTasks(feedData.tasks);
      setError(null);
    } catch {
      setError('Не удалось загрузить объект.');
    }
  }, [kind, id]);

  useEffect(() => {
    setEntity(null);
    setRecords(null);
    setTasks([]);
    load();
  }, [load]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const handleCreated = () => {
    setShowForm(false);
    load();
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!entity || records === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  // EntityResult - форма, которую ожидает AddRecordForm/EntityPicker
  // (src/api/entities.ts) - entityCard() отдаёт чуть более широкую карточку
  // (с parent/children), здесь достаточно свести её к тем же четырём полям.
  const fixedEntity: EntityResult = {
    kind,
    id,
    display_name: entity.display_name,
    template_name: entity.template_name,
    access_class: entity.access_class,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}>
      <Text style={styles.title}>{entity.display_name}</Text>

      <View style={styles.card}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Тип</Text>
          <Text style={styles.detailValue}>{kind === 'organization' ? 'Юрлицо' : entity.template_name}</Text>
        </View>
        {entity.access_class && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Класс доступа</Text>
            <Text style={styles.detailValue}>{entity.access_class}</Text>
          </View>
        )}
        {kind === 'entity' && entity.parent && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Родитель</Text>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/entity/[kind]/[id]', params: { kind: 'entity', id: String(entity.parent!.id) } })
              }>
              <Text style={[styles.detailValue, styles.link]}>{entity.parent.display_name}</Text>
            </Pressable>
          </View>
        )}
        {kind === 'entity' && entity.children && entity.children.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Составные элементы</Text>
            <View style={{ flex: 1 }}>
              {entity.children.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() =>
                    router.push({ pathname: '/entity/[kind]/[id]', params: { kind: 'entity', id: String(c.id) } })
                  }>
                  <Text style={[styles.detailValue, styles.link]}>{c.display_name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.feedHeader}>
        <Text style={styles.sectionTitle}>Лента биографии</Text>
        <Pressable style={styles.toggleButton} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.toggleButtonText}>{showForm ? 'Закрыть форму' : 'Прикрепить запись'}</Text>
        </Pressable>
      </View>

      {showForm && <AddRecordForm fixedEntity={fixedEntity} onCreated={handleCreated} onCancel={() => setShowForm(false)} />}

      {tasks.length > 0 && (
        <View style={styles.tasksSection}>
          <Text style={styles.sectionTitle}>Предстоящие работы</Text>
          {tasks.map((t) => (
            <TaskCard key={t.id} record={t} showEntityLink={false} />
          ))}
        </View>
      )}

      {records.length === 0 ? (
        <Text style={styles.emptyText}>Для этого объекта пока нет записей.</Text>
      ) : (
        records.map((r) => <RecordCard key={r.id} record={r} showEntityLink={false} />)
      )}
    </ScrollView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.md,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    detailRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    detailLabel: {
      width: 130,
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    detailValue: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
    },
    link: {
      color: theme.colors.accent,
      fontWeight: '600',
    },
    feedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    toggleButton: {
      backgroundColor: theme.colors.accentLight,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    toggleButtonText: {
      color: theme.colors.accent,
      fontWeight: '600',
      fontSize: 13,
    },
    tasksSection: {
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    emptyText: {
      textAlign: 'center',
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xl,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 14,
    },
  });
}
