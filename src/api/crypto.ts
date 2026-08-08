import { request } from './client';
import type { WrappedKeyMaterial } from '@/src/crypto/masterKey';

/**
 * Запросы личной (зашифрованной) зоны - зеркалит соответствующие вызовы
 * веб-версии (frontend/src/api.js: cryptoStatus/cryptoSetup/cryptoMaterial/
 * cryptoOracle). Сами маршруты на бэкенде не отличают веб от мобильного -
 * что cookie-сессия, что Bearer-токен проходят через один и тот же
 * require_session() (app/core/auth.py), так что бэкенд трогать не
 * пришлось вообще, только эти тонкие обёртки на клиенте.
 */

export type CryptoProvider = { provider: string; credential_id: string | null; label: string | null };

export function cryptoStatus(): Promise<{ configured: boolean; providers: CryptoProvider[] }> {
  return request('/crypto/status');
}

export function cryptoSetup(material: WrappedKeyMaterial & { provider?: string }): Promise<{ ok: true }> {
  return request('/crypto/setup', { method: 'POST', body: material });
}

export function cryptoMaterial(provider = 'password'): Promise<WrappedKeyMaterial> {
  return request(`/crypto/material?provider=${provider}`);
}

// intermediate - base64 промежуточный результат Argon2id (см.
// deriveIntermediate в src/crypto/masterKey.ts), никогда сам пароль.
// Возвращает base64 результат оракула Dominex - см. combineIntermediateWithOracleResult.
export async function cryptoOracle(intermediateB64: string): Promise<string> {
  const data = await request<{ ok: true; result: string }>('/crypto/oracle', {
    method: 'POST',
    body: { intermediate: intermediateB64 },
  });
  return data.result;
}
