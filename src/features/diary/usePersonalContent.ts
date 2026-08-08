import { useEffect, useState } from 'react';

import { decryptText } from '@/src/crypto/masterKey';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import type { BiographyRecord } from '@/src/api/types';

/**
 * Расшифровка личной записи для отображения - зеркалит usePersonalContent
 * из веб-версии (frontend/src/components/RecordCard.jsx). Общий хук, а не
 * скопированная логика в RecordCard.tsx и RecordDetailScreen.tsx отдельно -
 * оба места показывают одну и ту же запись, расхождение в реализации было
 * бы источником трудноуловимых багов.
 */
// record может быть ещё null (например, RecordDetailScreen.tsx только
// начал грузить запись) - хук всё равно должен вызываться безусловно на
// каждый рендер (правило хуков), поэтому null здесь обрабатывается
// внутри, а не проверкой на стороне вызывающего кода перед вызовом хука.
export function usePersonalContent(record: BiographyRecord | null) {
  const { status, subkey } = usePersonalKey();
  const [content, setContent] = useState<{ title: string | null; body: string | null } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!record || record.zone !== 'personal') return;
    if (status !== 'unlocked' || !subkey || !record.encrypted_content || !record.nonce) return;
    try {
      const json = decryptText(subkey, record.encrypted_content, record.nonce);
      setContent(JSON.parse(json));
      setFailed(false);
    } catch {
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, record?.encrypted_content, status]);

  return { content, failed, locked: record?.zone === 'personal' && status !== 'unlocked' };
}
