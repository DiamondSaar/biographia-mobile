import { Stack, useLocalSearchParams } from 'expo-router';

import { RecordDetailScreen } from '@/src/features/records/RecordDetailScreen';

// [id] в имени файла - динамический сегмент маршрута, Expo Router сам
// достаёт id из адреса (например /record/42) и отдаёт через
// useLocalSearchParams(). Точно та же идея, что и app/entity/[kind]/[id]
// на веб-версии (frontend/src/pages/EntityPage.jsx), запланировано для
// будущего экрана сущности здесь же.
export default function RecordRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Запись', headerBackTitle: 'Назад' }} />
      <RecordDetailScreen id={Number(id)} />
    </>
  );
}
