import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { PickedFile } from '@/src/api/attachments';
import type { EntityResult } from '@/src/api/entities';
import * as recordsApi from '@/src/api/records';
import type { RecordType, Zone } from '@/src/api/types';
import { encryptText } from '@/src/crypto/masterKey';
import { useAuth } from '@/src/context/AuthContext';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import { ACCESS_LEVEL_ORDER, accessRank, type AccessLevel } from '@/src/theme/colors';
import { useTheme } from '@/src/theme/useTheme';
import {
  discardOutboxItem,
  isNetworkError,
  queueAttachmentsForExistingRecord,
  queueNewRecord,
  reserveOutboxItem,
} from '@/src/offline/outbox';
import { AttachmentPicker } from './AttachmentPicker';
import { prepareAttachmentForUpload, sendPreparedAttachment, deletePreparedFiles, type PreparedAttachment } from './attachmentUpload';
import { EntityPicker, OrgPicker } from './EntityPicker';
import { recordTypeOptionsForZone, ZONE_OPTIONS } from './labels';

type AddRecordFormProps = {
  onCreated: () => void;
  onCancel: () => void;
  // Задаётся при открытии формы из конкретного места (сейчас - дневника,
  // src/features/diary/DiaryScreen.tsx) - тогда выбор зоны вообще не
  // показывается, зона всегда та, что передана. Та же идея, что
  // fixedZone в веб-версии (frontend/src/components/AddRecordForm.jsx).
  fixedZone?: Zone;
  // Задаётся при открытии со страницы объекта (src/features/entities/
  // EntityScreen.tsx, кнопка "Прикрепить запись") - привязка к сущности
  // уже известна и не редактируется, EntityPicker вообще не показывается.
  // Та же идея, что fixedEntity в веб-версии (EntityPage.jsx).
  fixedEntity?: EntityResult;
};

/**
 * Форма создания записи - упрощённая версия (осознанно, см. корневой
 * README.md "Осознанно отложено"): без привязки к сущности Dominex.
 * Личная зона теперь поддержана - шифрование на устройстве через
 * usePersonalKey().subkey, см. handleSubmit ниже.
 */
export function AddRecordForm({ onCreated, onCancel, fixedZone, fixedEntity }: AddRecordFormProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { status: diaryStatus, subkey } = usePersonalKey();
  const { viewer } = useAuth();

  const [zone, setZone] = useState<Zone>(fixedZone ?? 'open');
  // Открыто из дневника (fixedZone==='personal') - по умолчанию именно
  // "Запись в дневник", не "Свободная заметка": это и есть основной сценарий
  // личной зоны, см. запрос пользователя про категории.
  const [recordType, setRecordType] = useState<RecordType>(fixedZone === 'personal' ? 'diary_entry' : 'note');
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
  const [entity, setEntity] = useState<EntityResult | null>(fixedEntity ?? null);
  const [relatedOrganization, setRelatedOrganization] = useState<EntityResult | null>(null);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPersonalLocked = zone === 'personal' && diaryStatus !== 'unlocked';
  const recordTypeOptions = recordTypeOptionsForZone(zone);

  // "Запись в дневник" не имеет смысла вне личной зоны (бэкенд её и не
  // примет, см. labels.ts) - если человек уже выбрал её, а потом
  // переключил зону на open/org, тихо откатываем на "Свободная заметка",
  // а не оставляем невалидную комбинацию до самой отправки формы.
  const handleZoneChange = (nextZone: Zone) => {
    setZone(nextZone);
    if (nextZone !== 'personal' && recordType === 'diary_entry') {
      setRecordType('note');
    }
    // Привязка к сущности/юрлицу не показывается и не имеет смысла для
    // личной зоны (см. EntityPicker/OrgPicker ниже) - переключение в
    // personal сбрасывает уже выбранные, чтобы не уйти в бэкенд с
    // "мёртвым" полем.
    if (nextZone === 'personal') {
      setEntity(null);
      setRelatedOrganization(null);
    }
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

    // Каталог для вложений резервируется СРАЗУ, ещё до попытки уйти в
    // сеть - см. src/offline/outbox.ts. Если в итоге всё удалось отправить
    // напрямую, каталог просто убирается (discardOutboxItem) в конце.
    const { id: outboxId, dir: outboxDir } = reserveOutboxItem();

    try {
      let prepared: PreparedAttachment[];
      try {
        prepared = await Promise.all(files.map((file) => prepareAttachmentForUpload(zone, file, subkey, outboxDir)));
      } catch (err) {
        discardOutboxItem(outboxId);
        throw err;
      }

      const payload =
        zone === 'personal'
          ? (() => {
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
              return { zone, record_type: recordType, encrypted_content: ciphertext, nonce };
            })()
          : {
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
              entity_kind: entity?.kind ?? null,
              entity_id: entity?.id ?? null,
              related_organization_id: relatedOrganization?.id ?? null,
            };

      let record;
      try {
        record = await recordsApi.createRecord(payload);
      } catch (err) {
        if (!isNetworkError(err)) {
          discardOutboxItem(outboxId);
          throw err;
        }
        // Запрос вообще не дошёл до сервера (нет сети) - вся запись, вместе
        // с уже подготовленными (миниатюра/шифрование) вложениями, остаётся
        // на телефоне и уйдёт сама, как только появится связь (см.
        // processOutbox в app/_layout.tsx и RecordsFeed.tsx). Раньше в этом
        // месте запись и вложения терялись безвозвратно.
        queueNewRecord(outboxId, payload, prepared);
        onCreated();
        Alert.alert(
          'Нет соединения',
          'Запись сохранена на телефоне и отправится автоматически, как только появится связь.',
        );
        return;
      }

      // Запись уже сохранена на сервере - закрываем форму независимо от
      // того, что будет с загрузкой файлов ниже. Раньше в веб-версии
      // была ошибка ровно наоборот (форма ждала успеха и записи, и
      // вложения одновременно) - при обрыве загрузки файла человек не
      // видел, что запись уже создана, и по повторному нажатию получал
      // дубли. Здесь тот же урок учтён сразу, для обеих зон.
      onCreated();

      if (prepared.length > 0) {
        const stillFailed: PreparedAttachment[] = [];
        for (const p of prepared) {
          try {
            await sendPreparedAttachment(record.id, p);
            deletePreparedFiles(p);
          } catch {
            stillFailed.push(p);
          }
        }
        if (stillFailed.length > 0) {
          // Файлы уже подготовлены (миниатюра/шифрование сделаны) и лежат
          // в постоянном каталоге - не потеряются, просто уйдут позже
          // (processOutbox). Раньше в этом месте они терялись насовсем -
          // Alert сообщал об ошибке, но ничего не сохранял на повтор.
          queueAttachmentsForExistingRecord(outboxId, record.id, payload, stillFailed);
          Alert.alert(
            'Сохранено, довышлется позже',
            `Файлы сохранены на телефоне и загрузятся автоматически, как только появится связь:\n${stillFailed
              .map((p) => p.file.name)
              .join('\n')}`,
          );
        } else {
          discardOutboxItem(outboxId);
        }
      } else {
        discardOutboxItem(outboxId);
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
                onPress={() => handleZoneChange(value)}
                style={[styles.zoneOption, zone === value && styles.zoneOptionActive]}>
                <Text style={[styles.zoneOptionText, zone === value && styles.zoneOptionTextActive]}>{labelText}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Категория</Text>
      <View style={styles.zoneRow}>
        {recordTypeOptions.map(([value, labelText]) => (
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
            {availableAccessLevels.map((level) => {
              const isSelected = accessLevel === level;
              // G/F бледно-серые в собственной палитре (та же, что в
              // Dominex/вебе) - на бледном фоне выбранное/невыбранное
              // состояние почти не отличалось. Теперь невыбранные ранги
              // ВСЕГДА нейтрально-серые, а выбранный - залит своим ярким
              // цветом, независимо от того, какой именно это ранг.
              return (
                <Pressable
                  key={level}
                  onPress={() => setAccessLevel(level)}
                  style={[
                    styles.accessOption,
                    isSelected
                      ? { borderColor: theme.accessLevelColors[level].border, backgroundColor: theme.accessLevelColors[level].border }
                      : { borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundCard },
                  ]}>
                  <Text style={[styles.accessOptionText, { color: isSelected ? '#fff' : theme.colors.textMuted }]}>
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {zone !== 'personal' &&
        (fixedEntity ? (
          <>
            <Text style={styles.label}>Привязано к</Text>
            <View style={styles.fixedEntityBox}>
              <Text style={styles.fixedEntityText}>{fixedEntity.display_name}</Text>
            </View>
          </>
        ) : (
          <EntityPicker value={entity} onChange={setEntity} />
        ))}
      {zone !== 'personal' && <OrgPicker value={relatedOrganization} onChange={setRelatedOrganization} />}

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
      <AttachmentPicker files={files} onChange={setFiles} />

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
    fixedEntityBox: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    fixedEntityText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
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
