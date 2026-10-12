export function initialSettings(saved = {}, search = '', language = 'zh') {
  const params = new URLSearchParams(search);
  const pick = (key, allowed, fallback) =>
    allowed.includes(saved[key])
      ? saved[key]
      : allowed.includes(params.get(key))
        ? params.get(key)
        : fallback;
  return {
    lang: pick('lang', ['zh', 'en'], language.startsWith('zh') ? 'zh' : 'en'),
    theme: pick('theme', ['light', 'dark'], 'light'),
    muted: typeof saved.muted === 'boolean' ? saved.muted : true,
  };
}
