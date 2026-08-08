// Личная (шифрованная) зона - перенос веб-версии
// (D:\projects\biographia\frontend\src\crypto\masterKey.ts) почти без
// изменений: это чистый JS/TS без Node-специфичных API, поэтому логика
// переносится как есть - меняется не крипто-код, а окружение вокруг
// него (см. два пункта ниже).
//
// Сервер (бэкенд Biographia, реестр ssod_auth) никогда не видит пароль,
// сид-фразу или расшифрованный ключ - только результат wrapMasterKey()
// (шифртекст + публичные параметры KDF). Как и на вебе: полноценного
// профессионального крипто-ревью схема ещё не проходила - это рабочий
// срез (пароль + сид-фраза, без WebAuthn PRF), не заявление "уже
// проверено".
//
// ДВЕ ВЕЩИ, КОТОРЫЕ ЕСТЬ В БРАУЗЕРЕ, НО НЕ САМИ СОБОЙ РАЗУМЕЮТСЯ В REACT NATIVE:
//
// 1. `@noble/hashes`'s randomBytes() требует `crypto.getRandomValues` -
//    в браузере есть из коробки, в RN нет без полифилла. Поэтому в точке
//    входа приложения (app/_layout.tsx, самая первая строка) подключён
//    `react-native-get-random-values` - он подставляет
//    global.crypto.getRandomValues, ДО того как этот файл (или что-либо
//    ещё) успеет вызвать randomBytes(). Если полифилл не был бы
//    подключён - randomBytes() либо упал бы, либо (что хуже) тихо
//    использовал бы небезопасный источник случайности где-то в цепочке.
//
// 2. `btoa`/`atob` (кодирование base64 ниже) - в современном React Native
//    (Hermes) уже должны быть глобально доступны, но это стоит явно
//    проверить на реальном устройстве при первом прогоне этого экрана
//    (не только в `--web`, там браузерные btoa/atob точно есть и ничего
//    не докажут). Если на устройстве их не окажется - нужно заменить эти
//    две функции на ручную реализацию (десяток строк, без новой
//    зависимости), сам остальной код менять не придётся.

import { argon2id } from "@noble/hashes/argon2";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { randomBytes } from "@noble/hashes/utils";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

export interface KdfParams {
  memoryKib: number;
  iterations: number;
  parallelism: number;
}

// Совпадает с DEFAULT_KDF_PARAMS в веб-версии - защита не в самом Argon2id
// (эта работа теперь на Dominex-оракуле, см. wrapMasterKeyWithOracle),
// а просто разумные умолчания, если оракул почему-то недоступен.
export const DEFAULT_KDF_PARAMS: KdfParams = { memoryKib: 12288, iterations: 2, parallelism: 1 };

export interface WrappedKeyMaterial {
  wrapped_master_key: string;
  nonce: string;
  kdf_algorithm: "argon2id" | "argon2id+oracle";
  kdf_salt: string;
  kdf_memory_kib: number;
  kdf_iterations: number;
  kdf_parallelism: number;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Общий AEAD wrap/unwrap для уже готового 32-байтного ключа обёртки -
// путь с паролем получает его через Argon2id (см. wrapMasterKey/
// unwrapMasterKey ниже). Одна реализация AEAD, не две копии, которые
// могли бы незаметно разойтись.
export function wrapMasterKeyWithKey(
  masterKey: Uint8Array,
  wrappingKey: Uint8Array,
): { ciphertext: string; nonce: string } {
  const nonce = randomBytes(24);
  const ciphertext = xchacha20poly1305(wrappingKey, nonce).encrypt(masterKey);
  return { ciphertext: bytesToBase64(ciphertext), nonce: bytesToBase64(nonce) };
}

export function unwrapMasterKeyWithKey(wrappingKey: Uint8Array, ciphertext: string, nonce: string): Uint8Array {
  return xchacha20poly1305(wrappingKey, base64ToBytes(nonce)).decrypt(base64ToBytes(ciphertext));
}

export function generateSeedPhrase(): string {
  return generateMnemonic(wordlist, 128); // 12 слов
}

export function isValidSeedPhrase(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim(), wordlist);
}

// Сид-фраза - первоисточник мастер-ключа (как в крипто-кошельках):
// детерминированно, восстановление никогда не требует состояния на
// сервере - повторный ввод тех же 12 слов всегда даёт тот же ключ.
export function masterKeyFromSeedPhrase(mnemonic: string): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic.trim());
  return hkdf(sha256, seed, undefined, "biographia-master-key", 32);
}

// Результат Argon2id - финальный ключ обёртки на старом (без оракула)
// пути, но только промежуточное значение на пути с оракулом (см.
// combineIntermediateWithOracleResult ниже) - сам по себе необратим к
// паролю, но ещё не защищён от неограниченного офлайн-перебора, для
// этого и нужен оракул.
export function deriveIntermediate(password: string, salt: Uint8Array, params: KdfParams): Uint8Array {
  return argon2id(password, salt, {
    m: params.memoryKib,
    t: params.iterations,
    p: params.parallelism,
    dkLen: 32,
  });
}

// Старый (без оракула) путь - результат Argon2id используется как ключ
// обёртки напрямую. Оставлен только для чтения уже существующих строк
// (kdf_algorithm === "argon2id") - новые всегда идут через
// wrapMasterKeyWithOracle ниже.
export function wrapMasterKey(
  masterKey: Uint8Array,
  password: string,
  kdfParams: KdfParams = DEFAULT_KDF_PARAMS,
): WrappedKeyMaterial {
  const salt = randomBytes(16);
  const wrappingKey = deriveIntermediate(password, salt, kdfParams);
  const { ciphertext, nonce } = wrapMasterKeyWithKey(masterKey, wrappingKey);

  return {
    wrapped_master_key: ciphertext,
    nonce,
    kdf_algorithm: "argon2id",
    kdf_salt: bytesToBase64(salt),
    kdf_memory_kib: kdfParams.memoryKib,
    kdf_iterations: kdfParams.iterations,
    kdf_parallelism: kdfParams.parallelism,
  };
}

// Бросает исключение (не возвращает null) на неверном пароле - ошибка
// аутентификации AEAD и есть тот самый сигнал "неверный пароль",
// отдельная проверка не нужна.
export function unwrapMasterKey(password: string, material: WrappedKeyMaterial): Uint8Array {
  const salt = base64ToBytes(material.kdf_salt);
  const wrappingKey = deriveIntermediate(password, salt, {
    memoryKib: material.kdf_memory_kib,
    iterations: material.kdf_iterations,
    parallelism: material.kdf_parallelism,
  });
  return unwrapMasterKeyWithKey(wrappingKey, material.wrapped_master_key, material.nonce);
}

// Соединяет локальный результат KDF с HMAC-результатом оракула Dominex
// в итоговый ключ обёртки - oracleResult (зависит от секрета, известен
// только после запроса к Dominex) как исходный материал ключа,
// intermediate (вычислим локально, "публичен" относительно секрета
// оракула) как соль HKDF.
export function combineIntermediateWithOracleResult(intermediate: Uint8Array, oracleResult: Uint8Array): Uint8Array {
  return hkdf(sha256, oracleResult, intermediate, "biographia-oracle-wrap-v1", 32);
}

// Разрешается в base64-результат оракула, либо бросает/отклоняет при
// ошибке (rate_limited, inactive, unavailable, ...) - см. src/api/crypto.ts.
export type OracleCall = (intermediateB64: string) => Promise<string>;

// Обёртка с оракулом - новый путь по умолчанию для любой новой настройки
// пароля или восстановления. Та же форма, что wrapMasterKey выше, но
// ключ обёртки дополнительно зависит от секрета Dominex для этого
// пользователя, поэтому офлайн-перебор одного только шифртекста больше
// не помогает - см. раздел про крипто-оракул в biographia_tz.md.
export async function wrapMasterKeyWithOracle(
  masterKey: Uint8Array,
  password: string,
  oracleCall: OracleCall,
  kdfParams: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<WrappedKeyMaterial> {
  const salt = randomBytes(16);
  const intermediate = deriveIntermediate(password, salt, kdfParams);
  const oracleResultB64 = await oracleCall(bytesToBase64(intermediate));
  const wrappingKey = combineIntermediateWithOracleResult(intermediate, base64ToBytes(oracleResultB64));
  const { ciphertext, nonce } = wrapMasterKeyWithKey(masterKey, wrappingKey);

  return {
    wrapped_master_key: ciphertext,
    nonce,
    kdf_algorithm: "argon2id+oracle",
    kdf_salt: bytesToBase64(salt),
    kdf_memory_kib: kdfParams.memoryKib,
    kdf_iterations: kdfParams.iterations,
    kdf_parallelism: kdfParams.parallelism,
  };
}

// Обратная операция - используется когда material.kdf_algorithm === "argon2id+oracle".
export async function unwrapMasterKeyWithOracle(
  password: string,
  material: WrappedKeyMaterial,
  oracleCall: OracleCall,
): Promise<Uint8Array> {
  const salt = base64ToBytes(material.kdf_salt);
  const intermediate = deriveIntermediate(password, salt, {
    memoryKib: material.kdf_memory_kib,
    iterations: material.kdf_iterations,
    parallelism: material.kdf_parallelism,
  });
  const oracleResultB64 = await oracleCall(bytesToBase64(intermediate));
  const wrappingKey = combineIntermediateWithOracleResult(intermediate, base64ToBytes(oracleResultB64));
  return unwrapMasterKeyWithKey(wrappingKey, material.wrapped_master_key, material.nonce);
}

// Подключ на конкретный сервис (у Biographia - "biographia") - личные
// данные шифруются именно им, никогда напрямую сырым мастер-ключом.
export function deriveSubkey(masterKey: Uint8Array, label = "biographia"): Uint8Array {
  return hkdf(sha256, masterKey, undefined, label, 32);
}

export function encryptText(subkey: Uint8Array, plaintext: string): { ciphertext: string; nonce: string } {
  const nonce = randomBytes(24);
  const bytes = new TextEncoder().encode(plaintext);
  const ciphertext = xchacha20poly1305(subkey, nonce).encrypt(bytes);
  return { ciphertext: bytesToBase64(ciphertext), nonce: bytesToBase64(nonce) };
}

export function decryptText(subkey: Uint8Array, ciphertext: string, nonce: string): string {
  const decrypted = xchacha20poly1305(subkey, base64ToBytes(nonce)).decrypt(base64ToBytes(ciphertext));
  return new TextDecoder().decode(decrypted);
}
