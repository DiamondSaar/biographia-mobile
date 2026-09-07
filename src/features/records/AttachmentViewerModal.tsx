import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
// expo-media-library's default export (SDK 57) - новый class-based API,
// requestPermissionsAsync/saveToLibraryAsync там нет вообще - при вызове
// падает с "Method saveToLibraryAsync ... is deprecated" (проверено на
// реальном телефоне). /legacy - тот же функциональный API, что и в
// остальном коде этого файла, просто по другому пути импорта.
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Attachment } from '@/src/api/types';
import { isOfficeDocument } from '@/src/utils/files';
import { useTheme } from '@/src/theme/useTheme';
import { BackgroundLoadToast } from '@/src/components/BackgroundLoadToast';
import { useAttachmentFile } from './useAttachmentFile';
import { useAttachmentMeta } from './useAttachmentMeta';
import { ImageViewer } from './viewers/ImageViewer';
import { VideoPlayer } from './viewers/VideoPlayer';
import { AudioPlayer } from './viewers/AudioPlayer';
import { PdfViewer } from './viewers/PdfViewer';
import { TextViewer } from './viewers/TextViewer';

type Kind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'external';

function pickViewerKind(contentType: string, hasPreview: boolean): Kind {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('text/')) return 'text';
  // Office-документ с готовым серверным PDF-превью (open/org зона,
  // app/core/office_convert.py) - показываем превью тем же PdfViewer'ом.
  // Личная зона такого превью не имеет никогда (has_preview всегда
  // false), для неё и для всего остального без превью - только
  // "открыть во внешнем приложении" (см. handleOpenExternally ниже).
  if (hasPreview && isOfficeDocument(contentType)) return 'pdf';
  return 'external';
}

// MediaLibrary (Android) требует, чтобы у файла в имени БЫЛО расширение -
// без него saveToLibraryAsync падает с "Could not get the file's
// extension." Временные файлы приложения (кеш вложений/расшифровка, см.
// fileCache.ts/attachmentFile.ts) называются просто "<id>-<kind>", без
// расширения - поэтому перед сохранением файл копируется под именем с
// правильным расширением (см. handleSaveToGallery ниже). Сначала пробуем
// взять расширение из настоящего имени файла (оно почти всегда есть -
// пришло от пикера/камеры при загрузке), и только если его нет - гадаем
// по MIME-типу (только image/video - ровно то, что вообще может попасть
// в "Сохранить в галерею", см. canSaveToGallery).
function guessSaveExtension(filename: string | null | undefined, contentType: string): string {
  const fromName = filename?.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  const byMimeType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/3gpp': '3gp',
  };
  return byMimeType[contentType] ?? (contentType.startsWith('video/') ? 'mp4' : 'jpg');
}

/**
 * Выбирает нужный просмотрщик по MIME-типу расшифрованных/полученных
 * метаданных (useAttachmentMeta.ts) и управляет жизненным циклом
 * скачивания/расшифровки конкретно ЭТОГО вложения (useAttachmentFile.ts) -
 * скачивание начинается только когда модалка открылась, и явно
 * останавливается (temp-файл расшифровки удаляется) при закрытии, см.
 * reset() в самом хуке.
 */
export function AttachmentViewerModal({
  attachment,
  visible,
  onClose,
}: {
  attachment: Attachment | null;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const meta = useAttachmentMeta(attachment ?? ({} as Attachment));
  const contentType = meta?.contentType ?? '';
  const viewerKind = useMemo(() => pickViewerKind(contentType, attachment?.has_preview ?? false), [contentType, attachment]);
  const fetchKind = viewerKind === 'pdf' && attachment?.has_preview && isOfficeDocument(contentType) ? 'preview' : 'full';
  const { state, open, reset } = useAttachmentFile(attachment ?? ({ id: -1 } as Attachment), fetchKind);
  const [isSaving, setIsSaving] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && attachment && viewerKind !== 'external') {
      open();
    }
    if (!visible) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, attachment?.id, viewerKind]);

  if (!attachment) return null;

  // Первый тап (state ещё не 'ready') - запускает скачивание/расшифровку,
  // кнопка сама поменяет подпись на "Открыть в другом приложении" (см.
  // JSX ниже) как только состояние станет 'ready' - повторный тап уже
  // открывает системный share-sheet.
  const handleOpenExternally = async () => {
    if (state.status !== 'ready') {
      await open();
      return;
    }
    await handleShare();
  };

  // "Поделиться" - для пересылки по почте/печати доступно для ЛЮБОГО
  // типа вложения (не только "external"), см. хедер модалки ниже. Файл к
  // этому моменту уже расшифрован (для личной зоны) - handleShare ничего
  // не знает про шифрование, работает с готовым локальным uri, как и
  // сами просмотрщики (ImageViewer/VideoPlayer/...).
  const handleShare = async () => {
    if (state.status !== 'ready') return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(state.uri, { mimeType: contentType || undefined });
    }
  };

  // Сохранение в галерею - только для фото/видео (это единственные типы,
  // для которых у ОС вообще есть понятие "галерея" - MediaLibrary не
  // делает ничего осмысленного с PDF/текстом/т.п., см. обсуждение с
  // пользователем). Аудио и остальные файлы - через "Поделиться" выше
  // (тоже решает исходную задачу "переслать по почте/распечатать", просто
  // не даёт постоянной копии в галерее, которой для этих типов у ОС и
  // не бывает).
  const handleSaveToGallery = async () => {
    if (state.status !== 'ready') return;
    setIsSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert('Нет доступа', 'Приложению не разрешено сохранять файлы в галерею.');
        return;
      }
      // См. комментарий у guessSaveExtension выше - без расширения в
      // имени файла MediaLibrary падает с непонятной пользователю ошибкой.
      const ext = guessSaveExtension(meta?.filename, contentType);
      const dir = new Directory(Paths.cache, 'biographia-save-tmp');
      if (!dir.exists) dir.create({ intermediates: true });
      const named = new File(dir, `save-${attachment.id}-${Date.now()}.${ext}`);
      named.write(new File(state.uri).bytesSync());
      try {
        await MediaLibrary.saveToLibraryAsync(named.uri);
        Alert.alert('Сохранено', 'Файл добавлен в галерею телефона.');
      } finally {
        if (named.exists) named.delete();
      }
    } catch (err) {
      Alert.alert('Не удалось сохранить', err instanceof Error ? err.message : 'неизвестная ошибка');
    } finally {
      setIsSaving(false);
    }
  };

  const canSaveToGallery = (viewerKind === 'image' || viewerKind === 'video') && state.status === 'ready';
  const canShare = viewerKind !== 'external' && state.status === 'ready';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {meta?.filename ?? attachment.filename ?? 'Вложение'}
          </Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {viewerKind === 'external' ? (
            <View style={styles.center}>
              <Ionicons name="document-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.hintText}>Просмотр внутри приложения недоступен для этого типа файла.</Text>
              <Pressable style={styles.externalButton} onPress={handleOpenExternally}>
                <Text style={styles.externalButtonText}>
                  {state.status === 'ready' ? 'Открыть в другом приложении' : 'Скачать'}
                </Text>
              </Pressable>
              {state.status === 'loading' && <BackgroundLoadToast filename={meta?.filename ?? 'файл'} />}
            </View>
          ) : state.status === 'error' ? (
            <View style={styles.center}>
              <Text style={styles.hintText}>Не удалось загрузить файл.</Text>
            </View>
          ) : state.status !== 'ready' ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
              {state.status === 'loading' && state.slow && <BackgroundLoadToast filename={meta?.filename ?? 'файл'} />}
            </View>
          ) : viewerKind === 'image' ? (
            <ImageViewer uri={state.uri} />
          ) : viewerKind === 'video' ? (
            <VideoPlayer uri={state.uri} />
          ) : viewerKind === 'audio' ? (
            <AudioPlayer uri={state.uri} />
          ) : viewerKind === 'pdf' ? (
            <PdfViewer uri={state.uri} />
          ) : (
            <TextViewer uri={state.uri} />
          )}
        </View>

        {(canSaveToGallery || canShare) && (
          // Внизу, не в шапке - там кнопки перекрывались с системной
          // информацией в верхнем углу экрана (см. запрос пользователя).
          // paddingBottom учитывает нижнюю safe area (жестовая навигация/
          // "чёлка" снизу на части устройств).
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
            {canSaveToGallery && (
              <Pressable onPress={handleSaveToGallery} style={styles.bottomButton} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Ionicons name="download-outline" size={20} color={theme.colors.text} />
                )}
                <Text style={styles.bottomButtonText}>Сохранить в галерею</Text>
              </Pressable>
            )}
            {canShare && (
              <Pressable onPress={handleShare} style={styles.bottomButton}>
                <Ionicons name="share-outline" size={20} color={theme.colors.text} />
                <Text style={styles.bottomButtonText}>Поделиться</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text, marginRight: theme.spacing.md },
    closeButton: { padding: theme.spacing.xs },
    body: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg, gap: theme.spacing.md },
    hintText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' },
    externalButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    externalButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    bottomBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    bottomButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    bottomButtonText: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },
  });
}
