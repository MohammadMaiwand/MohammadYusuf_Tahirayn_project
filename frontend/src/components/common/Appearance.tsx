import { useEffect } from 'react';
import { Moon, Sun, PanelTop, PanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../stores/preferences';
import { Button } from './ui';

// Runs above authentication so login and logout retain the same visual preference.
export function ThemeProvider() {
  const theme = usePreferences((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return null;
}
export function AppearanceControls({
  preferences = false,
  themeOnly = false,
}: {
  preferences?: boolean;
  themeOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { theme, navigationMode, setTheme, setNavigationMode } =
    usePreferences();
  if (preferences)
    return (
      <div className="appearance-preferences">
        <label>
          {t('design.theme')}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
          >
            <option value="light">{t('design.light')}</option>
            <option value="dark">{t('design.dark')}</option>
          </select>
        </label>
        <label>
          {t('design.navigation')}
          <select
            value={navigationMode}
            onChange={(e) =>
              setNavigationMode(e.target.value as typeof navigationMode)
            }
          >
            <option value="sidebar">{t('design.sidebar')}</option>
            <option value="top">{t('design.top')}</option>
          </select>
        </label>
      </div>
    );
  return (
    <div className="appearance-controls">
      <Button
        className="ghost icon-button"
        title={t('design.theme')}
        aria-label={t('design.theme')}
        aria-pressed={theme === 'dark'}
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </Button>
      {!themeOnly && (
        <Button
          className="ghost icon-button"
          title={t('design.navigation')}
          aria-label={t('design.navigation')}
          aria-pressed={navigationMode === 'top'}
          onClick={() =>
            setNavigationMode(navigationMode === 'sidebar' ? 'top' : 'sidebar')
          }
        >
          {navigationMode === 'sidebar' ? (
            <PanelTop size={18} />
          ) : (
            <PanelLeft size={18} />
          )}
        </Button>
      )}
    </div>
  );
}
