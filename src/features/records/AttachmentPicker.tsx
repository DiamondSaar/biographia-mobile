import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { PickedFile } from '@/src/api/attachments';
import { useTheme } from '@/src/theme/useTheme';
import { VoiceRecorderOverlay } from './VoiceRecorderOverlay';

/**
 * Выбор файлов для прикрепления - контролируемый компонент (files/
 * onChange), используется и при создании записи (AddRecordForm.tsx), и
 * при её редактировании (RecordDetailScreen.tsx) - раньше это был кусок
 * логики+разметки только внутри AddRecordForm, при добавлении
 * возможности прикреплять файлы к уже существующей записи пришлось бы
 * либо копировать его, либо (как здесь) вынести один раз.
 */
export function AttachmentPicker({ files, onChange }: { files: PickedFile[]; onChange: (files: PickedFile[]) => void }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [isRecording, setIsRecording] = useState(false);

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (result.canceled || !result.assets) return;
    onChange([
      ...files,
      ...result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      })),
    ]);
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (result.canceled || !result.assets) return;
    onChange([
      ...files,
      ...result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `media-${Date.now()}-${index}`,
        type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      })),
    ]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets) return;
    onChange([
      ...files,
      ...result.assets.map((asset, index) => ({
        uri: asset.uri,
        // Камера не всегда отдаёт имя файла (особенно на Android) -
        // придумываем своё, чтобы не отправлять на сервер пустую строку.
        name: asset.fileName || `photo-${Date.now()}-${index}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      })),
    ]);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <View>
      {isRecording ? (
        <VoiceRecorderOverlay
          onDone={(file) => {
            onChange([...files, file]);
            setIsRecording(false);
          }}
          onCancel={() => setIsRecording(false)}
        />
      ) : (
        <View style={styles.attachRow}>
          <Pressable style={styles.attachButton} onPress={pickFiles}>
            <Ionicons name="attach-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.attachButtonText}>Выбрать файлы</Text>
          </Pressable>
          <Pressable style={styles.attachButton} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.attachButtonText}>Из галереи</Text>
          </Pressable>
          <Pressable style={styles.attachButton} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.attachButtonText}>Сделать фото</Text>
          </Pressable>
          <Pressable style={styles.attachButton} onPress={() => setIsRecording(true)}>
            <Ionicons name="mic-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.attachButtonText}>Надиктовать</Text>
          </Pressable>
        </View>
      )}
      {files.length > 0 && (
        <View style={styles.fileList}>
          {files.map((file, index) => (
            <View key={`${file.uri}-${index}`} style={styles.fileRow}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Pressable onPress={() => removeFile(index)}>
                <Ionicons name="close-circle-outline" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    attachRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    attachButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    attachButtonText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    fileList: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    fileName: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.text,
    },
  });
}
