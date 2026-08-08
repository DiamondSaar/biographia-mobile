// Тот же формат, что formatSize в веб-версии
// (frontend/src/components/AttachmentList.jsx) - размер файла должен
// читаться одинаково что на сайте, что в приложении.
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
