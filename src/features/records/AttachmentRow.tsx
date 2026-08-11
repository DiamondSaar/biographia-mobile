import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Attachment } from '@/src/api/types';
import { formatFileSize, iconForMimeType } from '@/src/utils/files';
import { useTheme } from '@/src/theme/useTheme';
import { useAttachmentMeta } from './useAttachmentMeta';
import { useAttachmentThumbnail } from './useAttachmentThumbnail';

/**
 * Одна строка в списке вложений - миниатюра (если есть, тянется сразу
 * через useAttachmentThumbnail) или типовая иконка по MIME-типу,
 * настоящее имя файла (расшифрованное для личной зоны, см.
 * useAttachmentMeta.ts). Тап открывает просмотрщик - сам файл при этом
 * ещё не скачан, это только начало (см. AttachmentViewerModal.tsx).
 */
export function AttachmentRow({ attachment, onPress }: { attachment: Attachment; onPress: () => void }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const meta = useAttachmentMeta(attachment);
  const thumbnailUri = useAttachmentThumbnail(attachment);

  const displayName = meta?.filename ?? (attachment.filename === null ? 'Личный файл' : attachment.filename);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
      ) : (
        <View style={styles.iconBox}>
          <Ionicons name={iconForMimeType(meta?.contentType) as any} size={18} color={theme.colors.textMuted} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {displayName}
      </Text>
      <Text style={styles.size}>{formatFileSize(attachment.size_bytes)}</Text>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    thumbnail: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.background,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.text,
    },
    size: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });
}
