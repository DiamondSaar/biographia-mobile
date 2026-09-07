import { Stack, useLocalSearchParams } from 'expo-router';

import { RecordDetailScreen } from '@/src/features/records/RecordDetailScreen';

// [id] в имени файла - динамический сегмент маршрута, Expo Router сам
// достаёт id из адреса (например /record/42) и отдаёт через
// useLocalSearchParams(). Тот же приём использует app/entity/[kind]/[id].tsx.
export default function RecordRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Запись', headerBackTitle: 'Назад' }} />
      <RecordDetailScreen id={Number(id)} />
    </>
  );
}
