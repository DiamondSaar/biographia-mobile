/**
 * Цветовая палитра приложения.
 *
 * ПОЧЕМУ этот файл вообще существует, а не просто разбросанные по компонентам
 * hex-коды: если завтра понадобится поменять акцентный цвет (или добавить
 * тёмную тему по-другому) - меняется одно место, а не 20 файлов компонентов.
 * Тот же принцип, что CSS-переменные (--accent, --bg-sidebar и т.д.) в
 * веб-версии Biographia (frontend/src/styles/main.css) - цвета здесь
 * СОЗНАТЕЛЬНО списаны оттуда же, чтобы мобильное приложение выглядело как
 * тот же продукт, а не отдельная "поделка".
 *
 * В React Native нет CSS и нет CSS-переменных - поэтому вместо `var(--accent)`
 * здесь просто обычный TypeScript-объект с теми же именами и значениями.
 */

// "light" - обычная (светлая) тема, "dark" - тёмная. Структура один в один
// повторяет пары значений из main.css (там же ветка `@media (prefers-color-scheme: dark)`).
export const palette = {
  light: {
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentLight: '#eff6ff',

    background: '#f8fafc',
    backgroundCard: '#ffffff',
    backgroundSidebar: '#1e293b',

    text: '#0f172a',
    textMuted: '#64748b',
    textSidebar: '#cbd5e1',

    border: '#e2e8f0',
    borderFocus: '#93c5fd',

    success: '#16a34a',
    successBg: '#f0fdf4',
    successBorder: '#86efac',

    danger: '#dc2626',
    dangerHover: '#b91c1c',

    warn: '#d97706',
    warnBg: '#fffbeb',
    warnBorder: '#fcd34d',
  },
  dark: {
    accent: '#3b82f6',
    accentHover: '#60a5fa',
    accentLight: '#1e3a5f',

    background: '#0f172a',
    backgroundCard: '#1e293b',
    backgroundSidebar: '#0f172a',

    text: '#f1f5f9',
    textMuted: '#94a3b8',
    textSidebar: '#94a3b8',

    border: '#334155',
    borderFocus: '#3b82f6',

    success: '#4ade80',
    successBg: '#052e16',
    successBorder: '#166534',

    danger: '#f87171',
    dangerHover: '#ef4444',

    warn: '#fbbf24',
    warnBg: '#27180a',
    warnBorder: '#92400e',
  },
} as const;

/**
 * Ранги доступа Dominex (G — самый открытый, S — самый закрытый).
 * Ровно та же восьмиступенчатая шкала и те же цвета, что в Dominex и
 * веб-версии Biographia (main.css: --access-G-bg / --access-G-text / ...) -
 * значок ранга должен выглядеть одинаково во всей экосистеме, не только
 * в одном продукте.
 */
export const accessLevelColors = {
  light: {
    G: { bg: '#f1f5f9', text: '#475569', border: '#94a3b8' },
    F: { bg: '#f8fafc', text: '#334155', border: '#cbd5e1' },
    E: { bg: '#f0fdf4', text: '#15803d', border: '#22c55e' },
    D: { bg: '#eff6ff', text: '#1d4ed8', border: '#3b82f6' },
    C: { bg: '#f5f3ff', text: '#6d28d9', border: '#8b5cf6' },
    B: { bg: '#fff7ed', text: '#c2410c', border: '#f97316' },
    A: { bg: '#fefce8', text: '#a16207', border: '#eab308' },
    S: { bg: '#fef2f2', text: '#b91c1c', border: '#ef4444' },
  },
  dark: {
    G: { bg: '#1e293b', text: '#cbd5e1', border: '#64748b' },
    F: { bg: '#1e293b', text: '#94a3b8', border: '#475569' },
    E: { bg: '#052e16', text: '#4ade80', border: '#22c55e' },
    D: { bg: '#1e3a5f', text: '#93c5fd', border: '#3b82f6' },
    C: { bg: '#2e1065', text: '#c4b5fd', border: '#8b5cf6' },
    B: { bg: '#27180a', text: '#fdba74', border: '#f97316' },
    A: { bg: '#422006', text: '#fde047', border: '#eab308' },
    S: { bg: '#450a0a', text: '#fca5a5', border: '#ef4444' },
  },
} as const;

// Строчный тип ранга доступа - используем везде, где ожидается буква ранга,
// чтобы опечатка вроде "Z" ловилась TypeScript'ом на этапе набора кода,
// а не падением в рантайме на телефоне пользователя.
export type AccessLevel = keyof typeof accessLevelColors.light;
