import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import * as recordsApi from '@/src/api/records';
import { usePersonalKey } from '@/src/context/PersonalKeyContext';
import { RecordsFeed } from '@/src/features/records/RecordsFeed';
import { useTheme } from '@/src/theme/useTheme';
import { SetupScreen } from './SetupScreen';
import { UnlockScreen } from './UnlockScreen';

/**
 * Личный дневник - зеркалит DiaryPage.jsx веб-версии: экран сам решает,
 * что показать, по статусу из PersonalKeyContext (loading/not_configured/
 * locked/unlocked/error) - ни один вызывающий код (таб-навигация,
 * app/(tabs)/diary.tsx) не должен знать об этой логике.
 */
export function DiaryScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { status, unlock, refreshStatus, canUseBiometrics, enableBiometricUnlock } = usePersonalKey();

  // После разблокировки паролем (не биометрией - она уже включена, раз
  // сработала) - один раз предлагаем "запомнить через биометрию", чтобы
  // в следующий раз не набирать длинный пароль заново. Ставится в true
  // из UnlockScreen/SetupScreen, самим этим экраном же и гасится после
  // ответа пользователя (да/нет).
  const [offerBiometric, setOfferBiometric] = useState(false);

  const handleEnableBiometric = async () => {
    await enableBiometricUnlock();
    setOfferBiometric(false);
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось проверить состояние шифрования.</Text>
      </View>
    );
  }

  if (status === 'not_configured') {
    return (
      <View style={styles.container}>
        <SetupScreen
          onDone={(masterKey) => {
            unlock(masterKey);
            refreshStatus();
            setOfferBiometric(canUseBiometrics);
          }}
        />
      </View>
    );
  }

  if (status === 'locked') {
    return (
      <View style={styles.container}>
        <UnlockScreen onUnlocked={setOfferBiometric} />
      </View>
    );
  }

  // status === 'unlocked'
  return (
    <View style={styles.container}>
      {offerBiometric && (
        <View style={styles.biometricPrompt}>
          <Text style={styles.biometricPromptText}>Запомнить через биометрию, чтобы не вводить пароль каждый раз?</Text>
          <View style={styles.biometricPromptActions}>
            <Pressable onPress={() => setOfferBiometric(false)}>
              <Text style={styles.biometricPromptSkip}>Не сейчас</Text>
            </Pressable>
            <Pressable style={styles.biometricPromptButton} onPress={handleEnableBiometric}>
              <Text style={styles.biometricPromptButtonText}>Включить</Text>
            </Pressable>
          </View>
        </View>
      )}
      <RecordsFeed
        loadRecords={recordsApi.fetchMyPersonalRecords}
        emptyMessage="Пока нет ни одной личной записи."
        fixedZone="personal"
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 14,
    },
    biometricPrompt: {
      backgroundColor: theme.colors.accentLight,
      margin: theme.spacing.md,
      marginBottom: 0,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    biometricPromptText: {
      color: theme.colors.text,
      fontSize: 13,
      marginBottom: theme.spacing.sm,
    },
    biometricPromptActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.md,
      alignItems: 'center',
    },
    biometricPromptSkip: {
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    biometricPromptButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    biometricPromptButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
