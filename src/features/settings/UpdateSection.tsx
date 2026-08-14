import Constants from 'expo-constants';
import { Directory, File, Paths, DownloadTask } from 'expo-file-system';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchLatestBuildInfo, type LatestBuildInfo } from '@/src/api/appUpdate';
import { installApk } from '@/src/utils/contentUri';
import { useTheme } from '@/src/theme/useTheme';

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up_to_date' }
  | { kind: 'available'; info: LatestBuildInfo }
  | { kind: 'downloading'; info: LatestBuildInfo; progress: number }
  | { kind: 'error'; message: string };

const CURRENT_VERSION_CODE = Constants.expoConfig?.android?.versionCode ?? 0;

const UPDATE_DIR_NAME = 'biographia-update';

function updateDirectory(): Directory {
  const dir = new Directory(Paths.cache, UPDATE_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Обновление apk прямо из приложения - убирает необходимость каждый раз
 * вручную скачивать файл (по ссылке/QR из раздела "Репозиторий" в ссод
 * аус, см. корневой README.md). Технически - не "автообновление" в
 * смысле expo-updates (тот механизм только для JS-бандла, не для
 * нативного apk, здесь не подключён и не подходит для этого сценария):
 * скачиваем файл сами (expo-file-system, с прогрессом - вложение почти
 * 120 МБ, может занять время на медленной сети), дальше открываем его
 * через ContentUriModule (нативный код, см.
 * android/app/src/main/java/pro/ssod/biographia/ContentUriModule.kt) -
 * ACTION_VIEW с content:// URI и MIME-типом apk. Раньше здесь стоял
 * expo-sharing, но тот открывает только ACTION_SEND ("поделиться"), а
 * Android Package Installer реагирует ИМЕННО на ACTION_VIEW - в списке
 * "поделиться" установщика в принципе не бывает, ни на одном устройстве
 * (проверено - установщик не появлялся на реальном телефоне пользователя).
 */
export function UpdateSection() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [state, setState] = useState<State>({ kind: 'idle' });

  const handleCheck = async () => {
    setState({ kind: 'checking' });
    try {
      const info = await fetchLatestBuildInfo();
      setState(info.versionCode > CURRENT_VERSION_CODE ? { kind: 'available', info } : { kind: 'up_to_date' });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'неизвестная ошибка' });
    }
  };

  const handleDownloadAndInstall = async (info: LatestBuildInfo) => {
    setState({ kind: 'downloading', info, progress: 0 });
    try {
      const destination = new File(updateDirectory(), 'biographia-update.apk');
      // DownloadTaskOptions не поддерживает idempotent (в отличие от
      // File.downloadFileAsync) - если файл от прошлой попытки остался,
      // убираем сами, иначе загрузка упадёт "уже существует".
      if (destination.exists) destination.delete();
      const task = new DownloadTask(info.url, destination, {
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) {
            setState({ kind: 'downloading', info, progress: bytesWritten / totalBytes });
          }
        },
      });
      const downloaded = await task.downloadAsync();
      if (!downloaded) throw new Error('Загрузка не завершилась.');

      await installApk(downloaded.uri);
      setState({ kind: 'idle' });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'неизвестная ошибка' });
    }
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Обновление</Text>
      <Text style={styles.sectionHint}>
        Текущая сборка: {CURRENT_VERSION_CODE}. Проверка скачивает маленький файл со сведениями о последней
        локальной сборке (biographia.ssod.pro/builds/) - без загрузки самого apk.
      </Text>

      <View style={styles.card}>
        {state.kind === 'idle' && (
          <Pressable style={styles.button} onPress={handleCheck}>
            <Text style={styles.buttonText}>Проверить обновления</Text>
          </Pressable>
        )}

        {state.kind === 'checking' && (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={styles.hintText}>Проверяем...</Text>
          </View>
        )}

        {state.kind === 'up_to_date' && (
          <View>
            <Text style={styles.hintText}>У вас последняя версия.</Text>
            <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleCheck}>
              <Text style={styles.buttonSecondaryText}>Проверить снова</Text>
            </Pressable>
          </View>
        )}

        {state.kind === 'available' && (
          <View>
            <Text style={styles.hintText}>
              Доступна сборка {state.info.versionCode}
              {state.info.notes ? ` — ${state.info.notes}` : ''}.
            </Text>
            <Pressable style={styles.button} onPress={() => handleDownloadAndInstall(state.info)}>
              <Text style={styles.buttonText}>Скачать и установить</Text>
            </Pressable>
          </View>
        )}

        {state.kind === 'downloading' && (
          <View>
            <Text style={styles.hintText}>Загрузка обновления... {Math.round(state.progress * 100)}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(state.progress * 100)}%` }]} />
            </View>
          </View>
        )}

        {state.kind === 'error' && (
          <View>
            <Text style={styles.errorText}>{state.message}</Text>
            <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleCheck}>
              <Text style={styles.buttonSecondaryText}>Повторить</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
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
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    hintText: {
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.danger,
      marginBottom: theme.spacing.sm,
    },
    button: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    buttonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    buttonSecondary: {
      backgroundColor: theme.colors.accentLight,
    },
    buttonSecondaryText: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    progressTrack: {
      height: 8,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.accent,
    },
  });
}
