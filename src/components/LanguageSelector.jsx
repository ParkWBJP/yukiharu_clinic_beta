import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  const setLang = (lng) => {
    i18n.changeLanguage(lng);
  };

  const [theme, setTheme] = React.useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('theme') || 'light';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <div className="lang-selector" role="group" aria-label="language selector and theme">
      <button
        type="button"
        className={`lang-btn ${i18n.resolvedLanguage === 'ko' ? 'active' : ''}`}
        onClick={() => setLang('ko')}
        aria-pressed={i18n.resolvedLanguage === 'ko'}
        title="한국어"
      >
        <span role="img" aria-label="Korean flag">🇰🇷</span>
      </button>
      <button
        type="button"
        className={`lang-btn ${i18n.resolvedLanguage === 'jp' ? 'active' : ''}`}
        onClick={() => setLang('jp')}
        aria-pressed={i18n.resolvedLanguage === 'jp'}
        title="日本語"
      >
        <span role="img" aria-label="Japanese flag">🇯🇵</span>
      </button>
      <div className="theme-switch" role="switch" aria-checked={theme === 'dark'} onClick={toggleTheme}>
        <span className={`opt ${theme === 'dark' ? 'active' : ''}`}>Dark</span>
        <div className={`thumb ${theme === 'dark' ? 'right' : 'left'}`}></div>
        <span className={`opt ${theme !== 'dark' ? 'active' : ''}`}>White</span>
      </div>
    </div>
  );
}
