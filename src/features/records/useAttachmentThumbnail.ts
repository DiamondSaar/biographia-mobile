import { useEffect, useState } from 'react';

import type { Attachment } from '@/src/api/types';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import { resolveAttachmentFileUri } from './attachmentFile';

/**
 * Миниатюра - в отличие от полного файла (useAttachmentFile.ts) тянется
 * СРАЗУ при показе списка вложений открытой записи, не по тапу: она
 * маленькая (см. THUMBNAIL_WIDTH в src/utils/thumbnails.ts), это и есть
 * компромисс "не тащить всю базу, но видно что там" из плана. null, пока
 * не готова или если её нет вообще (has_thumbnail === false) - вызывающий
 * код в этом случае показывает типовую иконку по MIME-типу.
 */
export function useAttachmentThumbnail(attachment: Attachment): string | null {
  const { subkey } = usePersonalKey();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    setUri(null);
    if (!attachment.has_thumbnail) return;

    let cancelled = false;
    resolveAttachmentFileUri(attachment, 'thumbnail', subkey)
      .then((resolved) => {
        if (!cancelled) setUri(resolved);
      })
      .catch(() => {
        // Битая/недоступная миниатюра - молча остаёмся на иконке-заглушке.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id, attachment.has_thumbnail, subkey]);

  return uri;
}
