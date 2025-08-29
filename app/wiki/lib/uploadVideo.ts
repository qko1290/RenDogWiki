export async function uploadVideo(file: File, folderId: number) {
  const form = new FormData();
  form.append('files', file);
  form.append('folder_id', String(folderId));

  const res = await fetch('/api/video/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  // 이미지 라우트와 동일 포맷 유지: { videos: [...] }
  return (await res.json()) as { videos: Array<{ id: number; url: string; name: string }> };
}
