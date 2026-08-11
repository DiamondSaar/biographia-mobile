import { useCallback, useRef, useState } from 'react';

import type { Attachment } from '@/src/api/types';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import { cleanupViewerTempFile, resolveAttachmentFileUri } from './attachmentFile';
import type { AttachmentFileKind } from '@/src/utils/fileCache';

// Порог "грузится в фоне" - см. план: баннер не должен мигать на каждый
// тап (большинство файлов либо уже в кеше, либо качаются быстро), только
// когда реально видно, что это надолго (медленная сеть/большой файл).
const SLOW_THRESHOLD_MS = 2000;

export type AttachmentFileState =
  | { status: 'idle' }
  | { status: 'loading'; slow: boolean }
  | { status: 'ready'; uri: string }
  | { status: 'error' };

/**
 * Полный файл вложения - тянется и (для личной зоны) расшифровывается
 * только по явному open(), никогда заранее (в отличие от миниатюры, см.
 * useAttachmentThumbnail.ts) - именно это "не тащить всю базу на
 * телефон" из плана. reset() убирает временную расшифрованную копию
 * (личная зона) при закрытии просмотрщика.
 */
// kind='preview' - серверная PDF-конвертация Office-документа
// (см. AttachmentViewerModal.tsx) вместо оригинального файла.
export function useAttachmentFile(attachment: Attachment, kind: AttachmentFileKind = 'full') {
  const { subkey } = usePersonalKey();
  const [state, setState] = useState<AttachmentFileState>({ status: 'idle' });
  const requestId = useRef(0);

  const open = useCallback(async () => {
    const myRequestId = ++requestId.current;
    setState({ status: 'loading', slow: false });

    const slowTimer = setTimeout(() => {
      if (requestId.current === myRequestId) {
        setState((current) => (current.status === 'loading' ? { status: 'loading', slow: true } : current));
      }
    }, SLOW_THRESHOLD_MS);

    try {
      const uri = await resolveAttachmentFileUri(attachment, kind, subkey);
      if (requestId.current === myRequestId) {
        setState({ status: 'ready', uri });
      }
    } catch {
      if (requestId.current === myRequestId) {
        setState({ status: 'error' });
      }
    } finally {
      clearTimeout(slowTimer);
    }
  }, [attachment, kind, subkey]);

  const reset = useCallback(() => {
    requestId.current++; // отменяет любой ещё летящий open()
    cleanupViewerTempFile(attachment.id, kind);
    setState({ status: 'idle' });
  }, [attachment.id, kind]);

  return { state, open, reset };
}
