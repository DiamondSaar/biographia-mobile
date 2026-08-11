import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import * as recordsApi from '@/src/api/records';
import { useAuth } from '@/src/context/AuthContext';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import { RecordsFeed } from '@/src/features/records/RecordsFeed';
import { useTheme } from '@/src/theme/useTheme';

/**
 * Личный кабинет - краткая карточка "кто я" сверху (данные из useAuth(),
 * см. src/context/AuthContext.tsx) + кнопка выхода + список "моих" записей
 * (где текущий пользователь автор или ответственный) снизу - тот же
 * RecordsFeed, что и на вкладке "Вики", просто с другим источником данных
 * (fetchMyRecords вместо fetchRecentRecords).
 */
export function ProfileScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { viewer, logout } = useAuth();
  const { status: diaryStatus, clearBiometricKey, lock, tryBiometricUnlock } = usePersonalKey();
  const router = useRouter();

  // Биометрический ключ дневника (см. PersonalKeyContext.tsx) привязан к
  // конкретному username - при выходе его стоит стереть, чтобы на этом
  // же телефоне не остался работающий отпечаток/Face ID от чужого уже
  // вышедшего аккаунта. Сам ключ входа (SecureStore, tokenStorage.ts)
  // чистит useAuth().logout() сам по себе, это отдельная, но похожая
  // по духу очистка.
  const handleLogout = async () => {
    await clearBiometricKey();
    await logout();
  };

  // Замочек - единственное место, где дневник можно ЗАКРЫТЬ вручную (до
  // этого - только автоматически, при выходе из аккаунта/закрытии
  // приложения, см. lock() в PersonalKeyContext.tsx - функция уже
  // существовала, просто не была подключена ни к одной кнопке).
  // Открыть одним тапом получится только если уже включена биометрия -
  // иначе (или если биометрия не сработала) ведём на вкладку "Дневник",
  // где есть полноценная форма пароля/восстановления, короткая кнопка
  // здесь для этого не место.
  const handleToggleDiaryLock = async () => {
    if (diaryStatus === 'unlocked') {
      lock();
      return;
    }
    if (diaryStatus === 'locked') {
      const unlocked = await tryBiometricUnlock();
      if (unlocked) return;
    }
    router.push('/(tabs)/diary');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(viewer?.display_name || viewer?.username || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{viewer?.display_name || viewer?.username}</Text>
          <Text style={styles.org}>{viewer?.organization?.name ?? viewer?.username}</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={handleToggleDiaryLock}>
          <Ionicons
            name={diaryStatus === 'unlocked' ? 'lock-open-outline' : 'lock-closed-outline'}
            size={22}
            color={diaryStatus === 'unlocked' ? theme.colors.accent : theme.colors.textMuted}
          />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} color={theme.colors.textMuted} />
        </Pressable>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Выйти</Text>
        </Pressable>
      </View>

      <RecordsFeed loadRecords={recordsApi.fetchMyRecords} emptyMessage="У вас пока нет записей." />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      backgroundColor: theme.colors.backgroundCard,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    headerInfo: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    org: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    iconButton: {
      padding: theme.spacing.sm,
    },
    logoutButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    logoutButtonText: {
      color: theme.colors.danger,
      fontSize: 14,
      fontWeight: '500',
    },
  });
}
