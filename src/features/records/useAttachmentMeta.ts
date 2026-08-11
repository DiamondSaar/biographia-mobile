import { useMemo } from 'react';

import type { Attachment } from '@/src/api/types';
import { decryptFileMeta } from '@/src/crypto/masterKey';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';

export type AttachmentMeta = { filename: string; contentType: string };

/**
 * Имя файла и MIME-тип - для open/org просто поля с сервера, для личной
 * зоны сервер их вообще не хранит в открытом виде (см. корневой
 * README.md, encrypted_meta/meta_nonce в src/api/types.ts) - здесь
 * единая точка расшифровки, используется и списком вложений
 * (RecordDetailScreen.tsx), и просмотрщиком (чтобы выбрать нужный
 * AttachmentViewerModal по MIME-типу).
 *
 * null - либо личная зона ещё заблокирована (нечем расшифровать), либо
 * расшифровка не удалась (повреждённые метаданные) - вызывающий код
 * должен показать типовую иконку/заглушку, не падать.
 */
export function useAttachmentMeta(attachment: Attachment): AttachmentMeta | null {
  const { subkey } = usePersonalKey();

  return useMemo(() => {
    if (attachment.filename !== null) {
      return { filename: attachment.filename, contentType: attachment.content_type ?? 'application/octet-stream' };
    }
    if (!subkey || !attachment.encrypted_meta || !attachment.meta_nonce) return null;
    try {
      const meta = decryptFileMeta(subkey, attachment.encrypted_meta, attachment.meta_nonce);
      return { filename: meta.filename, contentType: meta.content_type };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id, attachment.filename, attachment.encrypted_meta, subkey]);
}
