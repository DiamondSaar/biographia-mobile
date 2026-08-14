import { NativeModules } from 'react-native';

/**
 * Нативный модуль android/app/src/main/java/pro/ssod/biographia/ContentUriModule.kt -
 * открывает ACTION_VIEW на content:// URI (через уже зарегистрированный
 * expo-file-system FileProvider). expo-sharing для этого не подходит - он
 * умеет только ACTION_SEND ("поделиться"), на который Package Installer не
 * реагирует (см. UpdateSection.tsx).
 */
export function installApk(fileUri: string): Promise<void> {
  return NativeModules.ContentUriModule.getContentUriAndInstall(fileUri);
}
