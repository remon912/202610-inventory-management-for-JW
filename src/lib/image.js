// 사진 업로드 전 처리: 브라우저에서 크기를 줄이고 JPEG로 변환한다.
// (휴대폰 원본 사진도 수백 KB로 줄어 서버 요청 한도 안에 들어간다)

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_SIDE = 1280;
const THUMB_SIDE = 320;
const MAX_IMAGE_B64 = 2_900_000; // 서버 한도(3,000,000)보다 약간 작게

async function load(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, cleanup: () => bitmap.close() };
    } catch {
      // 일부 브라우저는 옵션 또는 형식을 지원하지 않음 → <img>로 재시도
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  return { source: img, cleanup: () => URL.revokeObjectURL(url) };
}

function toJpegDataUrl(source, maxSide, quality) {
  const w0 = source.width;
  const h0 = source.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * scale));
  canvas.height = Math.max(1, Math.round(h0 * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // 투명 PNG는 흰 배경으로
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

const stripPrefix = (dataUrl) => dataUrl.slice(dataUrl.indexOf(',') + 1);

/**
 * 이미지 파일 → { image, thumb (base64 JPEG), previewUrl (data URL) }
 * 실패하면 사용자에게 보여줄 메시지를 담은 Error를 던진다.
 */
export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 등록할 수 있습니다.');
  if (file.size > MAX_FILE_BYTES) throw new Error('20MB 이하의 사진만 등록할 수 있습니다.');

  let loaded;
  try {
    loaded = await load(file);
  } catch {
    throw new Error('사진을 읽을 수 없습니다. JPG 또는 PNG 사진으로 다시 시도해 주세요.');
  }

  try {
    let quality = 0.82;
    let image = toJpegDataUrl(loaded.source, IMAGE_SIDE, quality);
    while (image.length > MAX_IMAGE_B64 && quality > 0.45) {
      quality -= 0.1;
      image = toJpegDataUrl(loaded.source, IMAGE_SIDE, quality);
    }
    const thumb = toJpegDataUrl(loaded.source, THUMB_SIDE, 0.75);
    return { image: stripPrefix(image), thumb: stripPrefix(thumb), previewUrl: thumb };
  } finally {
    loaded.cleanup();
  }
}
