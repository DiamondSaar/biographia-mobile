import { useColorScheme } from '@/components/useColorScheme';

import { accessLevelColors, palette } from './colors';
import { radius, spacing } from './spacing';

/**
 * Главный хук темы - вызывается в начале компонента:
 *
 *   const theme = useTheme();
 *   ...
 *   <View style={{ backgroundColor: theme.colors.background }} />
 *
 * Сам решает, светлая сейчас тема или тёмная (через настройки телефона,
 * useColorScheme() ниже), и отдаёт готовый набор цветов + отступов под неё.
 * Компонентам не нужно самим разбираться, какая тема активна - это ровно
 * та же идея, что useState/useContext: спрятать механику за простым вызовом.
 */
export function useTheme() {
  const scheme = useColorScheme(); // 'light' | 'dark'

  return {
    scheme,
    colors: palette[scheme],
    accessLevelColors: accessLevelColors[scheme],
    spacing,
    radius,
  };
}
