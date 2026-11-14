/**
 * src/assets/welcome içindeki statik görselleri Vite glob ile güvenli yükler.
 * Klasör boşsa veya silinmişse derleme (build) kırılmaz; boş harita döner ve
 * bileşenler yerleşik SVG / CSS fallback tasarımlarına düşer.
 */
const rawAssetModules = import.meta.glob('../assets/welcome/*.{webp,png,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const ASSET_BY_BASENAME = Object.entries(rawAssetModules || {}).reduce((acc, [filePath, url]) => {
  const fileName = String(filePath).split('/').pop() || '';
  const baseName = fileName.replace(/\.(webp|png|jpe?g)$/i, '').toLowerCase();
  if (baseName && url) {
    acc[baseName] = url;
  }
  return acc;
}, {});

/**
 * Uzantısız dosya adıyla (ör. 'hero-bg', 'cover-demo-1', 'cover-seyahat') URL döndürür.
 */
export function getWelcomeAsset(baseName) {
  if (!baseName) return null;
  return ASSET_BY_BASENAME[String(baseName).toLowerCase()] || null;
}

export function getLoadedWelcomeAssetKeys() {
  return Object.keys(ASSET_BY_BASENAME);
}
