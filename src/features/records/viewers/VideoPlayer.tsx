import { VideoView, useVideoPlayer } from 'expo-video';

/** Локальный файл (уже скачанный/расшифрованный, см. useAttachmentFile.ts) - плеер работает с уже готовым uri, сам ничего не грузит по сети. */
export function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.play();
  });

  return <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />;
}
