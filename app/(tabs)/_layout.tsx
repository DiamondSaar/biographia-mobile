import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/src/theme/useTheme';

/**
 * Нижняя навигация - три вкладки, ровно те же три раздела, что в
 * сайдбаре/таб-баре веб-версии (frontend/src/components/Layout.jsx):
 * Вики / Дневник / Личный кабинет. Названия файлов внутри app/(tabs)/
 * (index.tsx, diary.tsx, profile.tsx) сами становятся вкладками -
 * Expo Router читает структуру папки, отдельно нигде "регистрировать"
 * экраны не нужно.
 *
 * Ionicons вместо SymbolView (которая была в шаблоне по умолчанию) -
 * SymbolView привязана к системным иконкам конкретной платформы (свои
 * имена для iOS/Android/веба на каждую иконку), Ionicons - один и тот же
 * набор иконок везде, и с ним гораздо проще искать нужную иконку
 * (https://icons.expo.fyi позволяет посмотреть все доступные названия).
 */
export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.backgroundSidebar,
          borderTopColor: theme.colors.border,
        },
        headerStyle: { backgroundColor: theme.colors.backgroundSidebar },
        headerTintColor: '#fff',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Вики',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Дневник',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Личный кабинет',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
