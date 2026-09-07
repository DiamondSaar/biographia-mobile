import { Directory, File, Paths } from 'expo-file-system';

import { ApiError } from '@/src/api/client';
import * as recordsApi from '@/src/api/records';
import type { CreateRecordPayload } from '@/src/api/types';
import type { PickedFile } from '@/src/api/attachments';
import {
  deletePreparedFiles,
  sendPreparedAttachment,
  type PreparedAttachment,
} from '@/src/features/records/attachmentUpload';

/**
 * Локальная очередь на отправку - "сначала сохранить локально, потом
 * догрузить, когда появится связь", см. запрос пользователя (потерял пару
 * фото из-за плохого соединения при создании записи). Порт идеи из
 * веб-версии (frontend/src/offline/queue.js, IndexedDB), но под мобильные
 * реалии - файлы вложений не Blob в памяти, а реальные файлы на диске,
 * которые должны пережить перезапуск приложения и чистку кеша ОС, поэтому
 * каталог - Paths.document (постоянный), не Paths.cache (см. тот же принцип
 * в src/utils/fileCache.ts).
 *
 * Два случая в одном формате элемента очереди:
 * - recordId === null - не удалось создать саму запись (нет сети вообще).
 *   При повторе сначала создаём запись, потом грузим вложения.
 * - recordId !== null - запись уже создана, не удалось загрузить часть
 *   вложений. При повторе загружаем только их.
 *
 * Вложения кладутся в очередь уже ПОДГОТОВЛЕННЫМИ (см.
 * attachmentUpload.ts::prepareAttachmentForUpload) - миниатюра и (для
 * личной зоны) шифрование уже сделаны в момент постановки в очередь, пока
 * subkey ещё точно доступен (дневник разблокирован - иначе саму форму
 * создания записи было бы не открыть). Повторная отправка позже не требует
 * ни subkey, ни какой-либо дополнительной локальной работы - только сеть.
 */

export type OutboxAttachmentManifest =
  | { kind: 'plain'; fileUri: string; fileName: string; fileType: string; thumbnailUri?: string; thumbnailName?: string; thumbnailType?: string }
  | { kind: 'encrypted'; fileUri: string; fileName: string; thumbnailUri?: string; thumbnailName?: string; encryptedMeta: string; metaNonce: string };

export type OutboxItem = {
  id: string;
  queuedAt: string;
  recordId: number | null;
  payload: CreateRecordPayload;
  attachments: OutboxAttachmentManifest[];
  lastError?: string;
};

const OUTBOX_DIR_NAME = 'biographia-outbox';
const MANIFEST_FILE_NAME = 'manifest.json';

function outboxRoot(): Directory {
  const dir = new Directory(Paths.document, OUTBOX_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function itemDirectory(id: string): Directory {
  return new Directory(outboxRoot(), id);
}

/** Резервирует каталог для нового элемента очереди - файлы вложений копируются сюда ДО того, как известно, потребуется ли вообще очередь (см. AddRecordForm.tsx). */
export function reserveOutboxItem(): { id: string; dir: Directory } {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dir = itemDirectory(id);
  if (!dir.exists) dir.create({ intermediates: true });
  return { id, dir };
}

/** Ничего сохранять не потребовалось (всё успешно отправилось сразу) - убрать зарезервированный каталог. */
export function discardOutboxItem(id: string): void {
  try {
    const dir = itemDirectory(id);
    if (dir.exists) dir.delete();
  } catch {
    // Не критично - максимум останется несколько пустых/висячих файлов.
  }
}

function toManifestAttachment(prepared: PreparedAttachment): OutboxAttachmentManifest {
  if (prepared.kind === 'plain') {
    return {
      kind: 'plain',
      fileUri: prepared.file.uri,
      fileName: prepared.file.name,
      fileType: prepared.file.type,
      thumbnailUri: prepared.thumbnail?.uri,
      thumbnailName: prepared.thumbnail?.name,
      thumbnailType: prepared.thumbnail?.type,
    };
  }
  return {
    kind: 'encrypted',
    fileUri: prepared.file.uri,
    fileName: prepared.file.name,
    thumbnailUri: prepared.thumbnail?.uri,
    thumbnailName: prepared.thumbnail?.name,
    encryptedMeta: prepared.encryptedMeta,
    metaNonce: prepared.metaNonce,
  };
}

function fromManifestAttachment(m: OutboxAttachmentManifest): PreparedAttachment {
  if (m.kind === 'plain') {
    return {
      kind: 'plain',
      file: { uri: m.fileUri, name: m.fileName, type: m.fileType },
      thumbnail: m.thumbnailUri ? { uri: m.thumbnailUri, name: m.thumbnailName!, type: m.thumbnailType! } : undefined,
    };
  }
  return {
    kind: 'encrypted',
    file: { uri: m.fileUri, name: m.fileName, type: 'application/octet-stream' },
    thumbnail: m.thumbnailUri ? { uri: m.thumbnailUri, name: m.thumbnailName!, type: 'application/octet-stream' } : undefined,
    encryptedMeta: m.encryptedMeta,
    metaNonce: m.metaNonce,
  };
}

function writeManifest(id: string, item: Omit<OutboxItem, 'id'>): void {
  const dir = itemDirectory(id);
  if (!dir.exists) dir.create({ intermediates: true });
  const manifestFile = new File(dir, MANIFEST_FILE_NAME);
  manifestFile.write(JSON.stringify({ id, ...item }));
}

/** Ставит в очередь запись, которую не удалось создать вообще (нет сети) - payload уже содержит готовый шифртекст для личной зоны. */
export function queueNewRecord(
  outboxId: string,
  payload: CreateRecordPayload,
  preparedAttachments: PreparedAttachment[],
): void {
  writeManifest(outboxId, {
    queuedAt: new Date().toISOString(),
    recordId: null,
    payload,
    attachments: preparedAttachments.map(toManifestAttachment),
  });
  notifyChanged();
}

/** Ставит в очередь вложения, которые не загрузились у УЖЕ созданной записи. */
export function queueAttachmentsForExistingRecord(
  outboxId: string,
  recordId: number,
  payload: CreateRecordPayload,
  failedAttachments: PreparedAttachment[],
): void {
  writeManifest(outboxId, {
    queuedAt: new Date().toISOString(),
    recordId,
    payload,
    attachments: failedAttachments.map(toManifestAttachment),
  });
  notifyChanged();
}

// Асинхронная - у File нет синхронного чтения текста (bytesSync() есть,
// текста - только через await text()/json()), в отличие от записи (write()
// синхронный, см. writeManifest).
export async function listOutboxItems(): Promise<OutboxItem[]> {
  const root = outboxRoot();
  const items: OutboxItem[] = [];
  for (const entry of root.list()) {
    if (!(entry instanceof Directory)) continue;
    try {
      const manifestFile = new File(entry, MANIFEST_FILE_NAME);
      if (!manifestFile.exists) continue;
      items.push((await manifestFile.json()) as OutboxItem);
    } catch {
      // Повреждённый/незавершённый элемент - пропускаем, не валим весь список.
    }
  }
  items.sort((a, b) => (a.queuedAt < b.queuedAt ? -1 : 1));
  return items;
}

function removeOutboxItem(id: string): void {
  discardOutboxItem(id);
}

// Простая подписка на изменения очереди - тот же принцип, что и
// CHANGED_EVENT в веб-версии (offline/queue.js), но без window/DOM
// (React Native) - обычный набор колбэков.
const listeners = new Set<() => void>();
function notifyChanged() {
  listeners.forEach((fn) => fn());
}
export function onOutboxChanged(handler: () => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

// Отличает "запрос вообще не дошёл до сервера" (офлайн/DNS/обрыв) от
// "сервер ответил ошибкой" - у ApiError всегда есть .status, у обычного
// Error (fetch сам бросил) - нет. Тот же принцип, что isNetworkError в
// веб-версии (offline/queue.js).
export function isNetworkError(err: unknown): boolean {
  return !(err instanceof ApiError);
}

let isProcessing = false;

/**
 * Пытается отправить всё, что накопилось в очереди - вызывается при
 * старте приложения и при pull-to-refresh ленты (см. app/_layout.tsx,
 * RecordsFeed.tsx), не по таймеру/подписке на сеть (не хотелось тащить
 * новую зависимость ради live-детектора соединения) - "открыли
 * приложение/потянули список вниз" на практике достаточно частый повод.
 * Элементы обрабатываются последовательно и независимо - обрыв на одном
 * не мешает остальным. Есть простая защита от повторного входа - если уже
 * идёт обработка (например, стартовый вызов ещё не закончился, а человек
 * уже потянул список), новый вызов просто выходит сразу.
 */
export async function processOutbox(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const items = await listOutboxItems();
    for (const item of items) {
      await processOutboxItem(item);
    }
  } finally {
    isProcessing = false;
  }
}

async function processOutboxItem(item: OutboxItem): Promise<void> {
  let recordId = item.recordId;

  if (recordId === null) {
    try {
      const record = await recordsApi.createRecord(item.payload);
      recordId = record.id;
    } catch {
      // Всё ещё нет сети (или сервер недоступен) - оставляем как есть,
      // попробуем в следующий processOutbox(). Реальная ошибка валидации
      // здесь маловероятна (payload уже был провалидирован на клиенте при
      // первой попытке), но даже если случится - лучше молча подождать
      // следующей попытки, чем тихо потерять запись насовсем.
      return;
    }
  }

  const stillFailed: OutboxAttachmentManifest[] = [];
  for (const manifestAttachment of item.attachments) {
    const prepared = fromManifestAttachment(manifestAttachment);
    try {
      await sendPreparedAttachment(recordId, prepared);
      deletePreparedFiles(prepared);
    } catch {
      stillFailed.push(manifestAttachment);
    }
  }

  if (stillFailed.length === 0) {
    removeOutboxItem(item.id);
  } else {
    writeManifest(item.id, { ...item, recordId, attachments: stillFailed });
  }
  notifyChanged();
}
