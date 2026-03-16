/**
 * Internationalization (i18n) Configuration for HCL DX Composer
 * Using react-i18next for multilingual support
 * Supports English, Hindi, and Marathi with W3C i18n compliance
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

// Supported locales with metadata
export const SUPPORTED_LOCALES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: 'en-IN'
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिंदी',
    dir: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'hi-IN'
  },
  mr: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    dir: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'mr-IN'
  }
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr }
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'mr'],
    interpolation: {
      escapeValue: false // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'hcl-dx-composer-locale'
    },
    react: {
      useSuspense: false
    }
  });

// Update document attributes when language changes
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = SUPPORTED_LOCALES[lng]?.dir || 'ltr';
});

// Set initial document attributes
document.documentElement.lang = i18n.language;
document.documentElement.dir = SUPPORTED_LOCALES[i18n.language]?.dir || 'ltr';

/**
 * Format date according to current locale
 */
export function formatDate(date, options = {}) {
  const locale = i18n.language;
  const localeCode = SUPPORTED_LOCALES[locale]?.numberFormat || 'en-IN';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  return new Intl.DateTimeFormat(localeCode, { ...defaultOptions, ...options })
    .format(new Date(date));
}

/**
 * Format number according to current locale
 */
export function formatNumber(number, options = {}) {
  const locale = i18n.language;
  const localeCode = SUPPORTED_LOCALES[locale]?.numberFormat || 'en-IN';
  
  return new Intl.NumberFormat(localeCode, options).format(number);
}

/**
 * Format currency according to current locale
 */
export function formatCurrency(amount, currency = 'INR') {
  const locale = i18n.language;
  const localeCode = SUPPORTED_LOCALES[locale]?.numberFormat || 'en-IN';
  
  return new Intl.NumberFormat(localeCode, {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  const locale = i18n.language;
  const localeCode = SUPPORTED_LOCALES[locale]?.numberFormat || 'en-IN';
  
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now - then) / 1000);

  const rtf = new Intl.RelativeTimeFormat(localeCode, { numeric: 'auto' });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
  }
}

export default i18n;
