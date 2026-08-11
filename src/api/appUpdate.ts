/**
 * Проверка обновлений приложения - читает маленький статический
 * latest.json рядом с APK на biographia.ssod.pro/builds/ (та же
 * статика, что и сам файл, см. корневой README.md/план про локальные
 * сборки). Не через общий src/api/client.ts's request() - это не API
 * бэкенда, а обычный статический файл, авторизация ни при чём.
 */
export type LatestBuildInfo = {
  versionCode: number;
  versionName: string;
  url: string;
  notes?: string;
};

const LATEST_BUILD_URL = 'https://biographia.ssod.pro/builds/latest.json';

export async function fetchLatestBuildInfo(): Promise<LatestBuildInfo> {
  const response = await fetch(LATEST_BUILD_URL, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) {
    throw new Error(`Не удалось получить сведения об обновлении (${response.status})`);
  }
  return response.json();
}
