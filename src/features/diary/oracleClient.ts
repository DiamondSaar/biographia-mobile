import { cryptoOracle } from '@/src/api/crypto';
import { ApiError } from '@/src/api/client';

/**
 * Общее для Setup/Unlock/Recovery - пересылает локально посчитанный
 * промежуточный результат KDF на оракул Dominex (см.
 * src/crypto/masterKey.ts's wrapMasterKeyWithOracle/unwrapMasterKeyWithOracle).
 * Зеркалит oracleCall/oracleErrorMessage из веб-версии
 * (frontend/src/pages/DiaryPage.jsx) дословно.
 */
export async function oracleCall(intermediateB64: string): Promise<string> {
  return cryptoOracle(intermediateB64);
}

export function oracleErrorMessage(err: unknown): string {
  const code = err instanceof ApiError ? (err.data as { error?: string } | null)?.error : undefined;
  switch (code) {
    case 'rate_limited':
      return 'Слишком много попыток. Подождите некоторое время и попробуйте снова.';
    case 'inactive':
      return 'Учётная запись заблокирована. Обратитесь к администратору.';
    case 'unknown_user':
      return 'Пользователь не найден.';
    case 'oracle_unavailable':
      return 'Сервис проверки временно недоступен. Попробуйте позже.';
    default:
      return 'Не удалось завершить операцию: ' + (err instanceof Error ? err.message : 'неизвестная ошибка');
  }
}
