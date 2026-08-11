import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

import type { PickedFile } from '@/src/api/attachments';

// Ширина миниатюры - маленькая специально: миниатюра тянется всегда (при
// открытии записи), сам файл - только по тапу (см. корневой README.md,
// принцип "только заголовки/миниатюры экономят трафик"). 320px с лишним
// запасом достаточно для превью в списке вложений.
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_QUALITY = 0.6;

/**
 * Готовит маленькую JPEG-миниатюру ДО шифрования - единый генератор для
 * обеих зон (open/org и personal), см. план: миниатюра для personal-зоны
 * физически может появиться только на клиенте (сервер не видит
 * расшифрованный файл), поэтому open/org намеренно используют тот же
 * путь, а не серверную генерацию - одна логика вместо двух.
 *
 * Возвращает null для типов файлов, для которых миниатюра не имеет
 * смысла (документы и т.п.) - вызывающий код в этом случае просто не
 * прикладывает вложение `thumbnail` к запросу, список вложений покажет
 * типовую иконку (см. iconForMimeType в src/utils/files.ts).
 */
export async function generateThumbnail(file: PickedFile): Promise<PickedFile | null> {
  try {
    if (file.type.startsWith('image/')) {
      const result = await ImageManipulator.manipulateAsync(file.uri, [{ resize: { width: THUMBNAIL_WIDTH } }], {
        compress: THUMBNAIL_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      return { uri: result.uri, name: `${file.name}-thumb.jpg`, type: 'image/jpeg' };
    }

    if (file.type.startsWith('video/')) {
      const frame = await VideoThumbnails.getThumbnailAsync(file.uri, { time: 1000, quality: THUMBNAIL_QUALITY });
      const resized = await ImageManipulator.manipulateAsync(frame.uri, [{ resize: { width: THUMBNAIL_WIDTH } }], {
        compress: THUMBNAIL_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      return { uri: resized.uri, name: `${file.name}-thumb.jpg`, type: 'image/jpeg' };
    }

    return null;
  } catch {
    // Миниатюра - необязательное улучшение, не повод срывать загрузку
    // самого файла (битый/нестандартный кадр видео, повреждённое фото и
    // т.п. - список просто покажет типовую иконку).
    return null;
  }
}
