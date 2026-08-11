import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';

import type { PickedFile } from '@/src/api/attachments';
import { useTheme } from '@/src/theme/useTheme';

// Голосовая заметка - не музыка: моно, невысокая частота дискретизации,
// AAC/M4A - "золотая середина" веса/качества, которую просил пользователь
// (не тяжёлый FLAC, но и не пережатый до нечитаемости голос). Один явно
// заданный набор параметров вместо RecordingPresets.HIGH_QUALITY/
// LOW_QUALITY (те - под музыку/звонки, не под этот сценарий).
const VOICE_NOTE_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    extension: '.m4a',
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
  },
  web: { mimeType: 'audio/mp4', bitsPerSecond: 64000 },
};

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Оверлей записи голосовой заметки - показывается вместо обычных кнопок
 * прикрепления (AttachmentPicker.tsx), пока идёт запись. По готовности
 * отдаёт обычный PickedFile - дальше он ничем не отличается от файла,
 * выбранного из галереи/документов, и идёт через тот же
 * uploadRecordAttachment (шифрование для личной зоны уже устроено
 * зоно-агностично).
 */
export function VoiceRecorderOverlay({
  onDone,
  onCancel,
}: {
  onDone: (file: PickedFile) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const recorder = useAudioRecorder(VOICE_NOTE_RECORDING_OPTIONS);
  const [seconds, setSeconds] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let interval: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onCancel();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsReady(true);
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    })();

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (deliver: boolean) => {
    if (recorder.isRecording) {
      await recorder.stop();
    }
    await setAudioModeAsync({ allowsRecording: false });
    if (deliver && recorder.uri) {
      onDone({ uri: recorder.uri, name: `voice-${Date.now()}.m4a`, type: 'audio/mp4' });
    } else {
      onCancel();
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.recordingRow}>
        <View style={styles.recordingDot} />
        <Text style={styles.timer}>{formatSeconds(seconds)}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={() => finish(false)}>
          <Text style={styles.cancelButtonText}>Отмена</Text>
        </Pressable>
        <Pressable style={styles.doneButton} onPress={() => finish(true)} disabled={!isReady}>
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.doneButtonText}>Готово</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    overlay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    recordingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.danger,
    },
    timer: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    cancelButton: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    cancelButtonText: {
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    doneButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    doneButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
