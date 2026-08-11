import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { useTheme } from '@/src/theme/useTheme';

function formatSeconds(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Локальный файл (уже скачанный/расшифрованный, см. useAttachmentFile.ts) - тот же принцип, что VideoPlayer.tsx. */
export function AudioPlayer({ uri }: { uri: string }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.playButton} onPress={togglePlayback}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={32} color="#fff" />
      </Pressable>
      <Text style={styles.time}>
        {formatSeconds(status.currentTime)} / {formatSeconds(status.duration)}
      </Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.lg,
    },
    playButton: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    time: {
      fontSize: 15,
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
  });
}
