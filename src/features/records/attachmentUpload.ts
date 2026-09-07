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
 * Подготовленное к отправке вложение - результат ЛОКАЛЬНОЙ части работы
 * (миниатюра +, для личной зоны, шифрование), которая никогда не зависит
 * от сети и не может провалиться из-за плохого/отсутствующего соединения.
 * Разделение prepare/send - основа офлайн-очереди (см. src/offline/outbox.ts):
 * подготовку можно сделать сразу, ДО попытки уйти в сеть, а саму отправку -
 * повторить сколько угодно раз позже, без повторного шифрования.
 */
export type PreparedAttachment =
  | { kind: 'plain'; file: PickedFile; thumbnail?: PickedFile }
  | { kind: 'encrypted'; file: PickedFile; thumbnail?: PickedFile; encryptedMeta: string; metaNonce: string };

/**
 * Локальная часть - миниатюра + (для личной зоны) шифрование. Файлы
 * копируются в destinationDir - для обычной (не через очередь) отправки
 * это временный кеш-каталог (см. scratchDirectory ниже), для очереди -
 * постоянный каталог конкретного элемента очереди (src/offline/outbox.ts),
 * переживающий перезапуск приложения.
 */
export async function prepareAttachmentForUpload(
  zone: Zone,
  file: PickedFile,
  subkey: Uint8Array | null,
  destinationDir: Directory,
): Promise<PreparedAttachment> {
  const thumbnail = await generateThumbnail(file);

  if (zone !== 'personal') {
    return {
      kind: 'plain',
      file: copyIntoDir(destinationDir, file),
      thumbnail: thumbnail ? copyIntoDir(destinationDir, thumbnail) : undefined,
    };
  }

  if (!subkey) {
    throw new Error('personal zone attachment requires an unlocked diary (subkey)');
  }

  const encryptedFile = encryptFileInto(subkey, file, destinationDir);
  const encryptedThumbnail = thumbnail ? encryptFileInto(subkey, thumbnail, destinationDir) : undefined;
  const { ciphertext: encryptedMeta, nonce: metaNonce } = encryptFileMeta(subkey, file.name, file.type);

  return { kind: 'encrypted', file: encryptedFile, thumbnail: encryptedThumbnail, encryptedMeta, metaNonce };
}

/** Сетевая часть - собственно загрузка уже готового (см. prepareAttachmentForUpload) вложения. */
export async function sendPreparedAttachment(recordId: number, prepared: PreparedAttachment): Promise<Attachment> {
  if (prepared.kind === 'plain') {
    const attachment = await uploadAttachment(recordId, prepared.file, prepared.thumbnail);
    cacheOriginalFile(attachment.id, 'full', prepared.file.uri);
    if (prepared.thumbnail) cacheOriginalFile(attachment.id, 'thumbnail', prepared.thumbnail.uri);
    return attachment;
  }

  const attachment = await uploadEncryptedAttachment(recordId, {
    file: prepared.file,
    thumbnail: prepared.thumbnail,
    encryptedMeta: prepared.encryptedMeta,
    metaNonce: prepared.metaNonce,
  });
  // Кеш хранит именно ШИФРТЕКСТ (то же самое, что только что ушло на
  // сервер) - см. src/utils/fileCache.ts на тему "почему не открытый текст".
  writeCachedAttachment(attachment.id, 'full', new File(prepared.file.uri).bytesSync());
  if (prepared.thumbnail) {
    writeCachedAttachment(attachment.id, 'thumbnail', new File(prepared.thumbnail.uri).bytesSync());
  }
  return attachment;
}

/** Удаляет временные файлы уже отправленного prepared-вложения (не нужны больше ни в каком виде). */
export function deletePreparedFiles(prepared: PreparedAttachment): void {
  cleanupFile(prepared.file.uri);
  if (prepared.thumbnail) cleanupFile(prepared.thumbnail.uri);
}

const UPLOAD_TMP_DIR_NAME = 'biographia-upload-tmp';

function scratchDirectory(): Directory {
  const dir = new Directory(Paths.cache, UPLOAD_TMP_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Единая точка входа "подготовить и сразу отправить" - для прямого
 * (не через очередь) сценария, когда соединение прямо сейчас есть и ждать
 * ретрая незачем. Используется и при создании записи (AddRecordForm.tsx -
 * там теперь чаще уходит через offline/outbox.ts при сбое сети, но при
 * успехе выглядит ровно так же), и при добавлении вложений к уже
 * существующей записи (RecordDetailScreen.tsx).
 */
export async function uploadRecordAttachment(
  recordId: number,
  zone: Zone,
  file: PickedFile,
  subkey: Uint8Array | null,
): Promise<Attachment> {
  const prepared = await prepareAttachmentForUpload(zone, file, subkey, scratchDirectory());
  const attachment = await sendPreparedAttachment(recordId, prepared);
  deletePreparedFiles(prepared);
  return attachment;
}

function copyIntoDir(dir: Directory, file: PickedFile): PickedFile {
  const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`);
  dest.write(new File(file.uri).bytesSync());
  return { uri: dest.uri, name: file.name, type: file.type };
}

function encryptFileInto(subkey: Uint8Array, file: PickedFile, dir: Directory): PickedFile {
  const plaintext = new File(file.uri).bytesSync();
  const { ciphertext, nonce } = encryptBytes(subkey, plaintext);
  const packed = packEncryptedBlob(ciphertext, nonce);

  const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  dest.write(packed);

  return { uri: dest.uri, name: file.name, type: 'application/octet-stream' };
}

function cleanupFile(uri: string): void {
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
