/**
 * Общие типы данных, которыми обмениваются приложение и бэкенд Biographia.
 *
 * Один файл для всех типов вместо того, чтобы объявлять их прямо в
 * api/records.ts или api/auth.ts - типы используются в нескольких местах
 * (например, Viewer нужен и в AuthContext, и на экране профиля, и при
 * отображении автора записи), удобнее держать их отдельно от самих
 * функций-запросов.
 *
 * Поля здесь один в один повторяют то, что реально отдаёт бэкенд Flask
 * (см. app/records/routes.py::_record_payload и app/auth/routes.py::mobile_login
 * в D:\projects\biographia) - не придумываются заранее "на будущее".
 */

// Организация - минимальный набор полей, которые реально приходят с бэкенда
// (см. app/auth/routes.py: projection.get("organization")).
export type Organization = {
  id: number;
  name: string;
  inn: string | null;
};

// "Кто сейчас залогинен" - одинаковая форма что после логина, что при
// последующих обращениях к профилю. Совпадает по смыслу с ViewerContext.jsx
// у веб-версии (frontend/src/ViewerContext.jsx).
export type Viewer = {
  username: string;
  display_name: string | null;
  access_class: string | null;
  organization: Organization | null;
  role: string | null;
};

// Три зоны видимости записи - см. app/models/biography.py::Zone.
export type Zone = 'open' | 'org' | 'personal';

// Типы событий - см. app/models/biography.py::RecordType.
export type RecordType =
  | 'installation'
  | 'documents'
  | 'maintenance'
  | 'component_replacement'
  | 'relocation'
  | 'incident'
  | 'note';

export type Attachment = {
  id: number;
  // Личная зона: filename/content_type всегда null на сервере (никогда
  // не видел их в открытом виде) - настоящие значения в encrypted_meta/
  // meta_nonce, расшифровываются на устройстве через decryptFileMeta
  // (src/crypto/masterKey.ts). Open/org - как обычно, обычные строки.
  filename: string | null;
  content_type: string | null;
  size_bytes: number;
  caption: string | null;
  encrypted_meta: string | null;
  meta_nonce: string | null;
  // has_thumbnail/has_preview - только флаги, не сами байты. Сами байты -
  // отдельные маршруты GET /attachments/<id>/thumbnail и .../preview
  // (см. src/api/attachments.ts). Для личной зоны миниатюра - тоже
  // шифртекст, nonce встроен в первые 24 байта самого блока (та же
  // договорённость, что и для основного файла - см. encryptBytes/
  // decryptBytes в src/crypto/masterKey.ts), отдельного поля не нужно.
  has_thumbnail: boolean;
  has_preview: boolean;
  uploaded_by: string;
  created_at: string;
};

// Запись биографии - как она приходит с /records/recent, /records/mine,
// /records/<id>, /entities/<kind>/<id>/records (везде одна и та же форма,
// см. _record_payload на бэкенде).
export type BiographyRecord = {
  id: number;
  zone: Zone;
  record_type: RecordType;
  title: string | null;
  body: string | null;
  // Личная (зашифрованная) зона - пока не поддерживается на мобильном,
  // см. корневой README.md, раздел "Осознанно отложено". Поля здесь есть
  // просто чтобы форма ответа сервера была типизирована полностью.
  encrypted_content: string | null;
  nonce: string | null;
  access_level: string | null;
  entity_kind: 'entity' | 'organization' | null;
  entity_id: number | null;
  org_id: number | null;
  author_username: string;
  author_display_name: string | null;
  owner_username: string;
  owner_display_name: string | null;
  status: 'active' | 'hidden';
  pending_count: number;
  version_count: number;
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
};

// Тело запроса на создание записи - то, что уходит на POST /records.
// Специально не переиспользует BiographyRecord целиком (там есть поля вроде
// id/created_at, которых при создании ещё не существует).
export type CreateRecordPayload = {
  zone: Zone;
  record_type: RecordType;
  // Открытая/org зона: title/body как есть. Личная зона: сервер их не
  // видит вообще - вместо них encrypted_content/nonce (один AEAD-блок
  // над {title, body}, см. encryptText в src/crypto/masterKey.ts) -
  // бэкенд явно требует ровно один из этих двух наборов полей за раз
  // (app/records/routes.py::create_record), никогда оба сразу.
  title?: string | null;
  body?: string | null;
  encrypted_content?: string;
  nonce?: string;
  access_level?: string | null;
  entity_kind?: 'entity' | 'organization' | null;
  entity_id?: number | null;
  org_id?: number | null;
};
