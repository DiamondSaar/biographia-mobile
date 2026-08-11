import Pdf from 'react-native-pdf';
import { StyleSheet } from 'react-native';

/**
 * Тот же компонент для двух случаев: настоящий PDF-файл и серверный
 * PDF-превью Office-документа (app/core/office_convert.py) - для этого
 * просмотрщика разницы нет, оба раза это просто локальный .pdf-файл.
 */
export function PdfViewer({ uri }: { uri: string }) {
  return <Pdf source={{ uri, cache: false }} style={styles.pdf} />;
}

const styles = StyleSheet.create({
  pdf: { flex: 1, width: '100%', height: '100%' },
});
