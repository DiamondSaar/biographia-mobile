import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { PickedFile } from '@/src/api/attachments';
import * as recordsApi from '@/src/api/records';
import type { RecordType, Zone } from '@/src/api/types';
import { encryptText } from '@/src/crypto/masterKey';
import { useAuth } from '@/src/context/AuthContext';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import { ACCESS_LEVEL_ORDER, accessRank, type AccessLevel } from '@/src/theme/colors';
import { useTheme } from '@/src/theme/useTheme';
import { uploadRecordAttachment } from './attachmentUpload';
import { RECORD_TYPE_OPTIONS, ZONE_OPTIONS } from './labels';

type AddRecordFormProps = {
  onCreated: () => void;
  onCancel: () => void;
  // Задаётся при открытии формы из конкретного места (сейчас - дневника,
  // src/features/diary/DiaryScreen.tsx) - тогда выбор зоны вообще не
  // показывается, зона всегда та, что передана. Та же идея, что
  // fixedZone в веб-версии (frontend/src/components/AddRecordForm.jsx).
  fixedZone?: Zone;
};

/**
 * Форма создания записи - упрощённая версия (осознанно, см. корневой
 * README.md "Осознанно отложено"): без привязки к сущности Dominex.
 * Личная зона теперь поддержана - шифрование на устройстве через
 * usePersonalKey().subkey, см. handleSubmit ниже.
 */
export function AddRecordForm({ onCreated, onCancel, fixedZone }: AddRecordFormProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { status: diaryStatus, subkey } = usePersonalKey();
  const { viewer } = useAuth();

  const [zone, setZone] = useState<Zone>(fixedZone ?? 'open');
  const [recordType, setRecordType] = useState<RecordType>('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // Ранг доступа - ограничен собственным рангом пользователя (нельзя
  // создать запись строже своего допуска), та же проверка, что бэкенд
  // всё равно сделает сам (_validate_access_level_ceiling в
  // app/records/routes.py) - здесь просто чтобы не предлагать заведомо
  // отклоняемые варианты. По умолчанию - самый открытый доступный ранг,
  // не собственный максимум (записи по умолчанию не должны запираться
  // сильнее, чем нужно).
  const maxAllowedRank = accessRank(viewer?.access_class);
  const availableAccessLevels = ACCESS_LEVEL_ORDER.filter((level) => accessRank(level) <= maxAllowedRank);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('G');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPersonalLocked = zone === 'personal' && diaryStatus !== 'unlocked';

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (result.canceled || !result.assets) return;
    setFiles((prev) => [
      ...prev,
      ...result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      })),
    ]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Нет разрешения на использование камеры.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets) return;
    setFiles((prev) => [
      ...prev,
      ...result.assets.map((asset, index) => ({
        uri: asset.uri,
        // Камера не всегда отдаёт имя файла (особенно на Android) -
        // придумываем своё, чтобы не отправлять на сервер пустую строку.
        name: asset.fileName || `photo-${Date.now()}-${index}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      })),
    ]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim() && !body.trim()) {
      setError('Нужен заголовок или текст.');
      return;
    }
    if (isPersonalLocked) {
      setError('Сначала разблокируйте личный дневник.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      let record;
      if (zone === 'personal') {
        // Открытый текст {title, body} никогда не покидает устройство -
        // шифруется в один AEAD-блок (см. encryptText в
        // src/crypto/masterKey.ts) тем же способом, что и на веб-версии;
        // сервер получает только шифртекст. subkey гарантированно не
        // null здесь - проверка isPersonalLocked выше уже отсекла случай
        // "дневник заблокирован".
        const { ciphertext, nonce } = encryptText(
          subkey!,
          JSON.stringify({ title: title.trim() || null, body: body.trim() || null }),
        );
        record = await recordsApi.createRecord({ zone, record_type: recordType, encrypted_content: ciphertext, nonce });
      } else {
        record = await recordsApi.createRecord({
          zone,
          record_type: recordType,
          title: title.trim() || null,
          body: body.trim() || null,
          access_level: accessLevel,
          // org-зона требует org_id (app/records/routes.py:
          // org_id_required_for_org_zone) - у обычного пользователя это
          // всегда его собственная организация, отдельного пикера не
          // нужно (в отличие от владельца/ответственного, тех можно
          // сменить только на веб-версии).
          org_id: zone === 'org' ? (viewer?.organization?.id ?? null) : null,
        });
      }

      // Запись уже сохранена на сервере - закрываем форму независимо от
      // того, что будет с загрузкой файлов ниже. Раньше в веб-версии
      // была ошибка ровно наоборот (форма ждала успеха и записи, и
      // вложения одновременно) - при обрыве загрузки файла человек не
      // видел, что запись уже создана, и по повторному нажатию получал
      // дубли. Здесь тот же урок учтён сразу, для обеих зон.
      onCreated();

      if (files.length > 0) {
        const failed: string[] = [];
        for (const file of files) {
          try {
            await uploadRecordAttachment(record.id, zone, file, subkey);
          } catch {
            failed.push(file.name);
          }
        }
        if (failed.length > 0) {
          // setError() здесь не поможет - форма уже закрылась строчкой
          // выше (onCreated() обычно прячет её в родителе), обычный
          // Alert - единственный способ вообще показать эту ошибку.
          Alert.alert('Не всё прикрепилось', `Запись сохранена, но не удалось прикрепить: ${failed.join(', ')}`);
        }
      }
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
      {isPersonalLocked && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Сначала разблокируйте личный дневник.</Text>
        </View>
      )}

      {!fixedZone && (
        <>
          <Text style={styles.label}>Зона</Text>
          <View style={styles.zoneRow}>
            {ZONE_OPTIONS.map(([value, labelText]) => (
              <Pressable
                key={value}
                onPress={() => setZone(value)}
                style={[styles.zoneOption, zone === value && styles.zoneOptionActive]}>
                <Text style={[styles.zoneOptionText, zone === value && styles.zoneOptionTextActive]}>{labelText}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Категория</Text>
      <View style={styles.zoneRow}>
        {RECORD_TYPE_OPTIONS.map(([value, labelText]) => (
          <Pressable
            key={value}
            onPress={() => setRecordType(value)}
            style={[styles.zoneOption, recordType === value && styles.zoneOptionActive]}>
            <Text style={[styles.zoneOptionText, recordType === value && styles.zoneOptionTextActive]}>
              {labelText}
            </Text>
          </Pressable>
        ))}
      </View>

      {zone !== 'personal' && (
        <>
          <Text style={styles.label}>Ранг доступа</Text>
          <View style={styles.zoneRow}>
            {availableAccessLevels.map((level) => (
              <Pressable
                key={level}
                onPress={() => setAccessLevel(level)}
                style={[
                  styles.accessOption,
                  {
                    borderColor: theme.accessLevelColors[level].border,
                    backgroundColor:
                      accessLevel === level ? theme.accessLevelColors[level].bg : theme.colors.backgroundCard,
                  },
                ]}>
                <Text style={[styles.accessOptionText, { color: theme.accessLevelColors[level].text }]}>{level}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

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

      <Text style={styles.label}>Вложения (необязательно)</Text>
      <View style={styles.attachRow}>
        <Pressable style={styles.attachButton} onPress={pickFiles}>
          <Ionicons name="attach-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.attachButtonText}>Выбрать файлы</Text>
        </Pressable>
        <Pressable style={styles.attachButton} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.attachButtonText}>Сделать фото</Text>
        </Pressable>
      </View>
      {files.length > 0 && (
        <View style={styles.fileList}>
          {files.map((file, index) => (
            <View key={`${file.uri}-${index}`} style={styles.fileRow}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Pressable onPress={() => removeFile(index)}>
                <Ionicons name="close-circle-outline" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

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
      flexWrap: 'wrap',
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
    accessOption: {
      borderWidth: 1,
      borderRadius: theme.radius.round,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accessOptionText: {
      fontSize: 13,
      fontWeight: '700',
    },
    attachRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    attachButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    attachButtonText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    fileList: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    fileName: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.text,
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
