import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import * as recordsApi from '@/src/api/records';
import type { Zone } from '@/src/api/types';
import { useTheme } from '@/src/theme/useTheme';
import { ZONE_OPTIONS } from './labels';

/**
 * Форма создания записи - упрощённая первая версия (осознанно, см.
 * корневой README.md "Осознанно отложено"): без привязки к сущности
 * Dominex и без вложений. Веб-версия (frontend/src/components/
 * AddRecordForm.jsx) умеет больше - когда до этого дойдёт очередь,
 * добавляются новые поля сюда же, а не переписывается всё заново.
 *
 * zone может быть только 'open' или 'org' - 'personal' (личный дневник)
 * специально не предлагается: та зона на бэкенде требует зашифрованного
 * содержимого (encrypted_content), а крипто-часть на мобильном ещё не
 * перенесена (см. src/features/diary/DiaryScreen.tsx).
 */
export function AddRecordForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [zone, setZone] = useState<Zone>('open');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nonPersonalZones = ZONE_OPTIONS.filter(([value]) => value !== 'personal');

  const handleSubmit = async () => {
    if (!title.trim() && !body.trim()) {
      setError('Нужен заголовок или текст.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await recordsApi.createRecord({
        zone,
        record_type: 'note',
        title: title.trim() || null,
        body: body.trim() || null,
        // 'G' - самый открытый ранг. Веб-версия даёт выбрать ранг при
        // создании; здесь для простоты первой версии он фиксирован -
        // при необходимости запись всегда можно поднять в ранге через
        // веб-интерфейс (владелец/суперадмин).
        access_level: 'G',
      });
      onCreated();
    } catch {
      setError('Не удалось сохранить запись. Проверьте соединение.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Зона</Text>
      <View style={styles.zoneRow}>
        {nonPersonalZones.map(([value, labelText]) => (
          <Pressable
            key={value}
            onPress={() => setZone(value)}
            style={[styles.zoneOption, zone === value && styles.zoneOptionActive]}>
            <Text style={[styles.zoneOptionText, zone === value && styles.zoneOptionTextActive]}>{labelText}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Заголовок</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Заголовок записи" />

      <Text style={styles.label}>Текст</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={body}
        onChangeText={setBody}
        placeholder="Что произошло..."
        multiline
      />

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Отмена</Text>
        </Pressable>
        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Сохранить</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: 15,
      color: theme.colors.text,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    zoneRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    zoneOption: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.round,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    zoneOptionActive: {
      backgroundColor: theme.colors.accentLight,
      borderColor: theme.colors.accent,
    },
    zoneOptionText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    zoneOptionTextActive: {
      color: theme.colors.accent,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    cancelButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    cancelButtonText: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    submitButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      minWidth: 100,
      alignItems: 'center',
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    errorBox: {
      backgroundColor: theme.colors.warnBg,
      borderColor: theme.colors.warnBorder,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    errorText: {
      color: theme.colors.warn,
      fontSize: 13,
    },
  });
}
