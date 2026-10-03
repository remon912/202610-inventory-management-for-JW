import { useState } from 'react';

const KEY = 'inventory.theme';
const ORDER = ['system', 'light', 'dark'];
const LABEL = { system: '시스템', light: '라이트', dark: '다크' };
const ICON = { system: '◐', light: '☀', dark: '☾' };

function readTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return ORDER.includes(t) ? t : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // 저장 불가 환경은 무시
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme);

  const next = () => {
    const t = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    applyTheme(t);
    setTheme(t);
  };

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={next}
      aria-label={`화면 테마: ${LABEL[theme]}. 눌러서 변경`}
      title={`테마: ${LABEL[theme]}`}
    >
      <span aria-hidden="true">{ICON[theme]}</span>
      <span>{LABEL[theme]}</span>
    </button>
  );
}
