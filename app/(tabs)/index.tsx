import * as recordsApi from '@/src/api/records';
import { RecordsFeed } from '@/src/features/records/RecordsFeed';

// "Вики" - общая лента последних записей. Сам экран - буквально одна
// строчка: вся реальная работа в RecordsFeed (src/features/records/), сюда
// просто передаётся "откуда брать данные" (fetchRecentRecords).
export default function WikiScreen() {
  return (
    <RecordsFeed
      loadRecords={(filters) => recordsApi.fetchRecentRecords(50, filters)}
      emptyMessage="Пока нет ни одной записи."
      enableSearch
    />
  );
}
