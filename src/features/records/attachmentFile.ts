import { Directory, File, Paths } from 'expo-file-system';

import { downloadAttachmentFile, downloadAttachmentPreview, downloadAttachmentThumbnail } from '@/src/api/attachments';
import type { Attachment } from '@/src/api/types';
import { decryptBytes, unpackEncryptedBlob } from '@/src/crypto/masterKey';
import { cachedAttachmentUri, isAttachmentCached, writeCachedAttachment, type AttachmentFileKind } from '@/src/utils/fileCache';

/**
 * Общий путь "достать файл, готовый к показу" - используется и для
 * миниатюр (useAttachmentThumbnail.ts, всегда тянутся сразу), и для
 * самого файла (useAttachmentFile.ts, только по тапу). Личная зона
 * (attachment.filename === null, см. useAttachmentMeta.ts) хранит на
 * диске ШИФРТЕКСТ даже в постоянном кеше - здесь единственное место,
 * где он на мгновение расшифровывается во временный файл специально для
 * показа (см. src/utils/fileCache.ts на тему "почему не в открытом виде
 * в кеше").
 */
export async function resolveAttachmentFileUri(
  attachment: Attachment,
  kind: AttachmentFileKind,
  subkey: Uint8Array | null,
): Promise<string> {
  if (!isAttachmentCached(attachment.id, kind)) {
    const bytes = await (kind === 'thumbnail'
      ? downloadAttachmentThumbnail(attachment.id)
      : kind === 'preview'
        ? downloadAttachmentPreview(attachment.id)
        : downloadAttachmentFile(attachment.id));
    writeCachedAttachment(attachment.id, kind, bytes);
  }

  // preview - серверная PDF-конвертация Office-документа
  // (app/core/office_convert.py), всегда plaintext и всегда только для
  // open/org (has_preview никогда не бывает true для личной зоны) - для
  // неё расшифровка не нужна и не имеет смысла.
  const isPersonal = kind !== 'preview' && attachment.filename === null; // см. useAttachmentMeta.ts
  if (!isPersonal) {
    return cachedAttachmentUri(attachment.id, kind);
  }

  if (!subkey) {
    throw new Error('personal zone file requires an unlocked diary (subkey)');
  }

  const ciphertextBlob = new File(cachedAttachmentUri(attachment.id, kind)).bytesSync();
  const { ciphertext, nonce } = unpackEncryptedBlob(ciphertextBlob);
  const plaintext = decryptBytes(subkey, ciphertext, nonce);

  return writeViewerTempFile(attachment.id, kind, plaintext);
}

const VIEWER_TMP_DIR_NAME = 'biographia-view-tmp';

function viewerTmpDirectory(): Directory {
  const dir = new Directory(Paths.cache, VIEWER_TMP_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function writeViewerTempFile(attachmentId: number, kind: AttachmentFileKind, plaintext: Uint8Array): string {
  const file = new File(viewerTmpDirectory(), `${attachmentId}-${kind}`);
  file.write(plaintext);
  return file.uri;
}

/**
 * Расшифрованные временные копии (только личная зона) - убираются, как
 * только просмотрщик закрылся (AttachmentViewerModal.tsx), а не ждут
 * следующей чистки кеша ОС - открытый текст личных файлов не должен
 * задерживаться на диске дольше, чем реально нужно для показа.
 */
export function cleanupViewerTempFile(attachmentId: number, kind: AttachmentFileKind): void {
  try {
    const file = new File(viewerTmpDirectory(), `${attachmentId}-${kind}`);
    if (file.exists) file.delete();
  } catch {
    // Не критично - Paths.cache и так может быть очищен системой сама.
  }
}
