import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as recordsApi from '@/src/api/records';
import { ApiError } from '@/src/api/client';
import { encryptText } from '@/src/crypto/masterKey';
import type { AccessLevel } from '@/src/theme/colors';
import { useTheme } from '@/src/theme/useTheme';
import { useAuth } from '@/src/context/AuthContext';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import type { Attachment, BiographyRecord } from '@/src/api/types';
import { usePersonalContent } from '@/src/features/diary/usePersonalContent';
import { AttachmentRow } from './AttachmentRow';
import { AttachmentViewerModal } from './AttachmentViewerModal';
import { RECORD_TYPE_LABELS, ZONE_LABELS } from './labels';
import { formatDateTime } from '@/src/utils/dates';

/**
 * Просмотр записи + правка на месте. Кто может редактировать сразу, а
 * чья правка уйдёт на согласование владельцу - решает бэкенд
 * (app/records/routes.py::can_edit_record), не эта форма - мы просто
 * показываем разный текст на кнопке и разный результат (см. handleSave).
 * Правило то же самое, что и на веб-версии (frontend/src/components/
 * RecordCard.jsx's EditRecordForm): владелец/суперадмин правят сразу,
 * остальные - через предложение.
 *
 * Личная зона: содержимое расшифровывается на устройстве (usePersonalContent
 * ниже), а не берётся из record.title/record.body напрямую - на сервере
 * их для personal-записей просто нет в открытом виде.
 */
export function RecordDetailScreen({ id }: { id: number }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { viewer } = useAuth();
  const { subkey } = usePersonalKey();

  const [record, setRecord] = useState<BiographyRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { content: personalContent, failed: decryptFailed, locked } = usePersonalContent(record);

  const load = useCallback(async () => {
    try {
      const data = await recordsApi.fetchRecordDetail(id);
      setRecord(data);
      if (data.zone !== 'personal') {
        setTitle(data.title || '');
        setBody(data.body || '');
      }
      setError(null);
    } catch {
      setError('Не удалось загрузить запись.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Для личной зоны заголовок/текст формы редактирования подставляются
  // из уже расшифрованного content, как только он готов (расшифровка в
  // usePersonalContent идёт асинхронно, отдельным эффектом от load() выше).
  useEffect(() => {
    if (record?.zone === 'personal' && personalContent) {
      setTitle(personalContent.title || '');
      setBody(personalContent.body || '');
    }
  }, [record?.zone, personalContent]);

  // Та же проверка, что can_edit_record на бэкенде - здесь только для
  // того, чтобы решить, ЧТО показать (кнопка "Сохранить" против
  // "Отправить на согласование"), сервер всё равно перепроверяет сам,
  // это не единственная защита.
  const canEditDirectly = !!viewer && (viewer.role === 'superadmin' || viewer.username === record?.owner_username);

  const handleSave = async () => {
    if (!record) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const payload =
        record.zone === 'personal'
          ? (() => {
              const { ciphertext, nonce } = encryptText(
                subkey!,
                JSON.stringify({ title: title.trim() || null, body: body.trim() || null }),
              );
              return { encrypted_content: ciphertext, nonce };
            })()
          : { title: title.trim() || null, body: body.trim() || null };

      const result = await recordsApi.editRecord(record.id, payload);
      if ('pending' in result) {
        setSaveMessage(result.message);
        setIsEditing(false);
      } else {
        setRecord(result);
        setIsEditing(false);
      }
    } catch (err) {
      setSaveMessage(err instanceof ApiError ? err.message : 'Не удалось сохранить.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const accessLevel = record.access_level as AccessLevel | null;
  const displayTitle = record.zone === 'personal' ? personalContent?.title : record.title;
  const displayBody = record.zone === 'personal' ? personalContent?.body : record.body;
  // Личную запись нельзя ни прочитать, ни предложить правку, пока
  // дневник заблокирован - редактирование "вслепую" не имеет смысла и
  // могло бы затереть содержимое, которое сам предлагающий не видит.
  const canShowEditButton = record.zone !== 'personal' || !locked;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {saveMessage && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{saveMessage}</Text>
        </View>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{ZONE_LABELS[record.zone]}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{RECORD_TYPE_LABELS[record.record_type]}</Text>
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

      {locked ? (
        <View style={styles.lockedBox}>
          <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} />
          <Text style={styles.lockedText}>Разблокируйте личный дневник, чтобы увидеть эту запись.</Text>
        </View>
      ) : decryptFailed ? (
        <Text style={styles.errorText}>Не удалось расшифровать запись.</Text>
      ) : isEditing ? (
        <>
          <Text style={styles.label}>Заголовок</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} />
          <Text style={styles.label}>Текст</Text>
          <TextInput style={[styles.input, styles.textArea]} value={body} onChangeText={setBody} multiline />
          {!canEditDirectly && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Вы не владелец этой записи — правка уйдёт на согласование и не применится сразу.
              </Text>
            </View>
          )}
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{canEditDirectly ? 'Сохранить' : 'Отправить на согласование'}</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>{displayTitle || '(без заголовка)'}</Text>
          {!!displayBody && <Text style={styles.body}>{displayBody}</Text>}

          {record.attachments.length > 0 && (
            <View style={styles.attachmentsBox}>
              <Text style={styles.label}>Вложения</Text>
              {record.attachments.map((attachment) => (
                <AttachmentRow key={attachment.id} attachment={attachment} onPress={() => setViewingAttachment(attachment)} />
              ))}
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.author}>
              Автор: {record.author_display_name || record.author_username}
            </Text>
            <Text style={styles.author}>
              Ответственный: {record.owner_display_name || record.owner_username}
            </Text>
            <Text style={styles.author}>{formatDateTime(record.created_at)}</Text>
          </View>

          {canShowEditButton && (
            <Pressable style={styles.editButton} onPress={() => setIsEditing(true)}>
              <Text style={styles.editButtonText}>{canEditDirectly ? 'Редактировать' : 'Предложить правку'}</Text>
            </Pressable>
          )}
        </>
      )}

      <AttachmentViewerModal
        attachment={viewingAttachment}
        visible={!!viewingAttachment}
        onClose={() => setViewingAttachment(null)}
      />
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
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    metaText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    metaDot: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    badge: {
      borderWidth: 1,
      borderRadius: theme.radius.round,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      marginLeft: theme.spacing.xs,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    body: {
      fontSize: 15,
      color: theme.colors.text,
      lineHeight: 22,
    },
    footer: {
      marginTop: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: theme.spacing.xs,
    },
    author: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    editButton: {
      marginTop: theme.spacing.lg,
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentLight,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    editButtonText: {
      color: theme.colors.accent,
      fontWeight: '600',
      fontSize: 14,
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
      minHeight: 120,
      textAlignVertical: 'top',
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
    infoBox: {
      backgroundColor: theme.colors.warnBg,
      borderColor: theme.colors.warnBorder,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    infoText: {
      color: theme.colors.warn,
      fontSize: 13,
    },
    lockedBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    lockedText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      flex: 1,
    },
    attachmentsBox: {
      marginTop: theme.spacing.lg,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 14,
    },
  });
}
