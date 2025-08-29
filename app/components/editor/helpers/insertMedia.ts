import { Transforms } from 'slate';
import type { Editor } from 'slate';
import { insertImage } from './insertImage';

function looksLikeVideo(url: string) {
  const u = url.split('?')[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(u);
}

export function insertMedia(
  editor: Editor,
  media: { url: string; mime?: string | null; width?: number; height?: number }
) {
  const isVideo = (media.mime?.startsWith('video/') ?? false) || looksLikeVideo(media.url);

  if (!isVideo) {
    // 기존 이미지 삽입 로직 재사용
    insertImage(editor as any, media.url);
    return;
  }

  // 영상 노드 삽입
  Transforms.insertNodes(editor, {
    type: 'video',
    url: media.url,
    width: media.width ?? 720,
    height: media.height,
    children: [{ text: '' }],
  } as any);
}
