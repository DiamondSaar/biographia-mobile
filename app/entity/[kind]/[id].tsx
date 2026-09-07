import { Stack, useLocalSearchParams } from 'expo-router';

import { EntityScreen } from '@/src/features/entities/EntityScreen';

// [kind]/[id] - тот же принцип, что у record/[id] (см. его комментарий) -
// путь вида /entity/entity/117 или /entity/organization/3, ровно как на
// веб-версии (frontend/src/pages/EntityPage.jsx, роут /entity/:kind/:id).
export default function EntityRoute() {
  const { kind, id } = useLocalSearchParams<{ kind: 'entity' | 'organization'; id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Объект', headerBackTitle: 'Назад' }} />
      <EntityScreen kind={kind} id={Number(id)} />
    </>
  );
}
