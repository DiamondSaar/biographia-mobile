import { useThemeMode } from '@/src/context/ThemeModeContext';

import { accessLevelColors, palette } from './colors';
import { radius, spacing } from './spacing';

/**
 * Главный хук темы - вызывается в начале компонента:
 *
 *   const theme = useTheme();
 *   ...
 *   <View style={{ backgroundColor: theme.colors.background }} />
 *
 * Раньше решал "светлая или тёмная" сам, глядя только на настройки
 * телефона; теперь это временно передоверено ThemeModeContext.tsx -
 * человек может выбрать конкретную тему вручную (экран настроек, из
 * личного кабинета), а не только следовать за системой. useTheme() сам
 * код экранов не меняет вообще - как и раньше, просто вызывается и
 * отдаёт готовый набор цветов.
 */
export function useTheme() {
  const { resolvedScheme } = useThemeMode();

  return {
    scheme: resolvedScheme,
    colors: palette[resolvedScheme],
    accessLevelColors: accessLevelColors[resolvedScheme],
    spacing,
    radius,
  };
}
