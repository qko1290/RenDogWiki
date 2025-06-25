export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // 공백 -> -
    .replace(/[^\w\-가-힣]+/g, '')   // 특수문자 제거 (한글은 허용)
    .replace(/\-\-+/g, '-')         // 중복 하이픈 제거
    .replace(/^-+/, '')             // 앞 하이픈 제거
    .replace(/-+$/, '');            // 뒤 하이픈 제거
}
