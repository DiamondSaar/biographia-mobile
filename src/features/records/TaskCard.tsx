import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/src/api/client';
import { completeTask } from '@/src/api/records';
import type { BiographyRecord } from '@/src/api/types';
import { RecordCard } from '@/src/components/RecordCard';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/useTheme';

/**
 * Обёртка над RecordCard для "Предстоящих работ" (src/features/entities/
 * EntityScreen.tsx, src/features/profile/ProfileScreen.tsx) - добавляет
 * действие "Выполнено" с обязательным комментарием "что и как сделано" (по
 * требованию пользователя - нельзя закрыть задачу без следа исполнения, см.
 * app/records/routes.py::complete_task). Не в самой RecordCard - та
 * намеренно "тупая" и переиспользуется везде (Вики, Мои записи), а это
 * действие есть только у задач.
 */
export function TaskCard({ record, showEntityLink = true }: { record: BiographyRecord; showEntityLink?: boolean }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { viewer } = useAuth();

  const [current, setCurrent] = useState(record);
  const [showComplete, setShowComplete] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Та же проверка, что can_edit_record на бэкенде - закрывать задачу
  // может только владелец/суперадмин, как и любое другое прямое действие
  // над записью (см. RecordDetailScreen.tsx's canEditDirectly).
  const canEdit = !!viewer && (viewer.role === 'superadmin' || viewer.username === current.owner_username);

  const submit = async () => {
    if (!comment.trim()) {
      Alert.alert('Нужен комментарий', 'Опишите, что и как было сделано — без этого задачу закрыть нельзя.');
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await completeTask(current.id, comment.trim());
      setCurrent(updated);
      setShowComplete(false);
      setComment('');
    } catch (err) {
      Alert.alert('Не удалось сохранить', err instanceof ApiError ? err.message : 'Проверьте соединение.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={() => router.push({ pathname: '/record/[id]', params: { id: String(current.id) } })}>
        <RecordCard record={current} showEntityLink={showEntityLink} />
      </Pressable>

      {canEdit && current.status === 'active' && !showComplete && (
        <Pressable style={styles.actionButton} onPress={() => setShowComplete(true)}>
          <Text style={styles.actionButtonText}>Выполнено</Text>
        </Pressable>
      )}

      {current.status === 'hidden' && <Text style={styles.doneText}>✅ Выполнено</Text>}

      {showComplete && (
        <View style={styles.completeBox}>
          <TextInput
            style={styles.input}
            placeholder="Что и как было сделано..."
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <View style={styles.completeActions}>
            <Pressable onPress={() => setShowComplete(false)}>
              <Text style={styles.cancelText}>Отмена</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Отметить выполненным</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrapper: {
      marginBottom: theme.spacing.md,
    },
    actionButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      backgroundColor: theme.colors.accentLight,
      borderRadius: theme.radius.md,
    },
    actionButtonText: {
      color: theme.colors.accent,
      fontWeight: '600',
      fontSize: 13,
    },
    doneText: {
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    completeBox: {
      marginTop: theme.spacing.sm,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: 14,
      color: theme.colors.text,
      minHeight: 70,
      textAlignVertical: 'top',
    },
    completeActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.md,
      alignItems: 'center',
    },
    cancelText: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    submitButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      minWidth: 170,
      alignItems: 'center',
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
