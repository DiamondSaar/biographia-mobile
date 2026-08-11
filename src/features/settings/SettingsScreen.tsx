import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDiaryViewMode, type DiaryViewMode } from '@/src/context/DiaryViewModeContext';
import { useThemeMode, type ThemeMode } from '@/src/context/ThemeModeContext';
import { useTheme } from '@/src/theme/useTheme';

const MODE_OPTIONS: [ThemeMode, string][] = [
  ['system', 'Как в системе'],
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
];

const DIARY_VIEW_OPTIONS: [DiaryViewMode, string][] = [
  ['feed', 'Лента'],
  ['calendar', 'Календарь'],
];

/**
 * Настройки приложения. Пока единственный раздел - тема оформления
 * (см. ThemeModeContext.tsx); со временем сюда естественно добавятся
 * другие настройки (например, тут напрашивается со временем управление
 * привязкой устройства, см. обсуждение в корневом README.md про
 * ssod_auth API-ключи) - отдельная папка src/features/settings/ под это
 * уже заведена, не придётся создавать с нуля.
 */
export function SettingsScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { mode, setMode } = useThemeMode();
  const { mode: diaryViewMode, setMode: setDiaryViewMode } = useDiaryViewMode();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Тема оформления</Text>
      <Text style={styles.sectionHint}>
        Цвета приложения совпадают с Dominex и веб-версией Biographia — единая палитра на всю экосистему,
        отдельной "фирменной" темы Dominex не существует отдельно от этой.
      </Text>

      <View style={styles.optionsList}>
        {MODE_OPTIONS.map(([value, label]) => (
          <Pressable key={value} style={styles.optionRow} onPress={() => setMode(value)}>
            <Text style={styles.optionLabel}>{label}</Text>
            <View style={[styles.radio, mode === value && styles.radioActive]}>
              {mode === value && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Дневник: вид по умолчанию</Text>
      <Text style={styles.sectionHint}>Как открывать личный дневник — списком записей или календарём месяца.</Text>

      <View style={styles.optionsList}>
        {DIARY_VIEW_OPTIONS.map(([value, label]) => (
          <Pressable key={value} style={styles.optionRow} onPress={() => setDiaryViewMode(value)}>
            <Text style={styles.optionLabel}>{label}</Text>
            <View style={[styles.radio, diaryViewMode === value && styles.radioActive]}>
              {diaryViewMode === value && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    sectionHint: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.md,
      lineHeight: 18,
    },
    sectionSpacing: {
      marginTop: theme.spacing.lg,
    },
    optionsList: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    optionLabel: {
      fontSize: 15,
      color: theme.colors.text,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: theme.radius.round,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: {
      borderColor: theme.colors.accent,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.accent,
    },
  });
}
