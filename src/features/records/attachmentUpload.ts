import { Directory, File, Paths } from 'expo-file-system';

import {
  uploadAttachment,
  uploadEncryptedAttachment,
  type PickedFile,
} from '@/src/api/attachments';
import type { Attachment, Zone } from '@/src/api/types';
import { encryptBytes, encryptFileMeta, packEncryptedBlob } from '@/src/crypto/masterKey';
import { writeCachedAttachment } from '@/src/utils/fileCache';
import { generateThumbnail } from '@/src/utils/thumbnails';

/**
 * Единая точка входа для прикрепления файла к записи - используется и
 * для open/org, и для личной зоны (AddRecordForm.tsx сам не должен знать
 * детали шифрования/упаковки, только "вот файл, вот зона, вот subkey
 * если он нужен"). Одна функция вместо двух отдельных веток в форме -
 * тот же принцип, что usePersonalContent.ts уже применяет к чтению
 * записей (общий код вместо копий, которые могут разойтись).
 */
export async function uploadRecordAttachment(
  recordId: number,
  zone: Zone,
  file: PickedFile,
  subkey: Uint8Array | null,
): Promise<Attachment> {
  const thumbnail = await generateThumbnail(file);

  if (zone !== 'personal') {
    const attachment = await uploadAttachment(recordId, file, thumbnail ?? undefined);
    cacheOriginalFile(attachment.id, 'full', file.uri);
    if (thumbnail) cacheOriginalFile(attachment.id, 'thumbnail', thumbnail.uri);
    return attachment;
  }

  if (!subkey) {
    throw new Error('personal zone attachment requires an unlocked diary (subkey)');
  }

  const { blob: encryptedFile, tempUri: fileTempUri } = encryptFileToTemp(subkey, file);
  const { ciphertext: encryptedMeta, nonce: metaNonce } = encryptFileMeta(subkey, file.name, file.type);

  let encryptedThumbnail: PickedFile | undefined;
  let thumbnailTempUri: string | undefined;
  if (thumbnail) {
    const packed = encryptFileToTemp(subkey, thumbnail);
    encryptedThumbnail = packed.blob;
    thumbnailTempUri = packed.tempUri;
  }

  const attachment = await uploadEncryptedAttachment(recordId, {
    file: encryptedFile,
    thumbnail: encryptedThumbnail,
    encryptedMeta,
    metaNonce,
  });

  // Кеш хранит именно ШИФРТЕКСТ (то же самое, что только что ушло на
  // сервер) - см. src/utils/fileCache.ts на тему "почему не открытый
  // текст". Временные файлы можно сразу убрать, копия уже осела в
  // постоянном кеше под собственным путём.
  writeCachedAttachment(attachment.id, 'full', readTempFile(fileTempUri));
  cleanupTempFile(fileTempUri);
  if (thumbnailTempUri) {
    writeCachedAttachment(attachment.id, 'thumbnail', readTempFile(thumbnailTempUri));
    cleanupTempFile(thumbnailTempUri);
  }

  return attachment;
}

const UPLOAD_TMP_DIR_NAME = 'biographia-upload-tmp';

function uploadTmpDirectory(): Directory {
  const dir = new Directory(Paths.cache, UPLOAD_TMP_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Шифрует файл и пишет результат во временный файл в кеш-директории (не
 * в постоянной - это промежуточный шаг только для самой загрузки, не
 * часть кеша вложений). React Native FormData умеет прикладывать файл
 * только по uri, не по сырым байтам напрямую - поэтому шифртекст нужно
 * на секунду положить на диск, даже если он тут же уйдёт на сервер.
 */
function encryptFileToTemp(subkey: Uint8Array, file: PickedFile): { blob: PickedFile; tempUri: string } {
  const plaintext = new File(file.uri).bytesSync();
  const { ciphertext, nonce } = encryptBytes(subkey, plaintext);
  const packed = packEncryptedBlob(ciphertext, nonce);

  const tempFile = new File(uploadTmpDirectory(), `${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  tempFile.write(packed);

  return { blob: { uri: tempFile.uri, name: file.name, type: 'application/octet-stream' }, tempUri: tempFile.uri };
}

function readTempFile(uri: string): Uint8Array {
  return new File(uri).bytesSync();
}

function cleanupTempFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Временный файл - не критично, если не получилось убрать сразу.
  }
}

function cacheOriginalFile(attachmentId: number, kind: 'full' | 'thumbnail', uri: string): void {
  try {
    writeCachedAttachment(attachmentId, kind, new File(uri).bytesSync());
  } catch {
    // Кеш - это оптимизация, а не гарантия; запись уже сохранена на
    // сервере независимо от того, получилось ли закешировать локально.
  }
}
