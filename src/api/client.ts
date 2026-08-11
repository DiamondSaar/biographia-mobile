import { API_BASE_URL } from './config';
import { getStoredToken } from './tokenStorage';

/**
 * Единая ошибка API - вместо того чтобы каждый вызов сам разбирал ответ
 * сервера, весь код приложения ловит именно ApiError и читает `.status`/
 * `.data`. Мирроит то, как это устроено в веб-версии (frontend/src/api.js) -
 * там та же идея, просто без отдельного класса (JS попроще с типами).
 */
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Готовый FormData (для загрузки файлов) - тогда JSON.stringify делать
   *  не нужно и заголовок Content-Type ставить тоже не нужно (fetch сам
   *  выставит правильный multipart-boundary). */
  isFormData?: boolean;
};

/**
 * Главная функция похода на бэкенд. Всё остальное в src/api/ (auth.ts,
 * records.ts, entities.ts) - это просто именованные обёртки вокруг
 * request() под конкретные маршруты, ни один из них не работает с fetch()
 * напрямую - если завтра поменяется, например, база URL или появится
 * refresh-логика токена, правится только этот файл.
 */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getStoredToken();

  const headers: Record<string, string> = {};
  if (!options.isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
  });

  // Сервер иногда отвечает без тела (например, пустой 204) - json() упал бы
  // с ошибкой на пустой строке, поэтому .catch(() => null) вместо await.
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data && (data as { error?: string }).error) || `request_failed_${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

/**
 * Скачивание бинарного содержимого (вложение/миниатюра/PDF-превью) -
 * отдельная функция, а не ветка внутри request(), потому что ответ там
 * не JSON вообще, разбирать его через response.json() было бы ошибкой.
 * Тот же Bearer-токен, тот же базовый URL - просто другой способ читать
 * тело ответа.
 */
export async function requestBytes(path: string): Promise<Uint8Array> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    throw new ApiError(`request_failed_${response.status}`, response.status, null);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
