import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { SUPPORTED_LOCALES } from '../i18n';

export default function LanguageSelector({ className = '' }) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (localeCode) => {
    i18n.changeLanguage(localeCode);
    setIsOpen(false);
  };

  const currentLocale = SUPPORTED_LOCALES[i18n.language] || SUPPORTED_LOCALES.en;

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-600 hover:text-navy-800 hover:bg-neutral-100 rounded-lg transition-colors"
        aria-label={t('common.selectLanguage')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4" />
        <span>{currentLocale.nativeName}</span>
        <ChevronDown className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50"
          role="listbox"
          aria-label={t('common.selectLanguage')}
        >
          {Object.values(SUPPORTED_LOCALES).map((loc) => (
            <button
              key={loc.code}
              onClick={() => handleSelect(loc.code)}
              className={clsx(
                'w-full flex items-center justify-between px-4 py-2 text-sm transition-colors',
                i18n.language === loc.code
                  ? 'bg-primary-50 text-navy-800'
                  : 'text-neutral-700 hover:bg-neutral-50'
              )}
              role="option"
              aria-selected={i18n.language === loc.code}
              lang={loc.code}
            >
              <span className="flex items-center gap-2">
                <span>{loc.flag}</span>
                <span>{loc.nativeName}</span>
                <span className="text-neutral-400">({loc.name})</span>
              </span>
              {i18n.language === loc.code && (
                <Check className="w-4 h-4 text-success-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
