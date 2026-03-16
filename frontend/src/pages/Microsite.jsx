import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { wcmApi, damApi } from '../services/api';
import { SUPPORTED_LOCALES, formatDate, formatRelativeTime } from '../i18n';
import {
  FileText,
  Image,
  Calendar,
  User,
  Search,
  Filter,
  Globe,
  ExternalLink,
  Share2,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import LanguageSelector from '../components/LanguageSelector';

function ContentCard({ content, type = 'wcm' }) {
  const { t } = useTranslation();
  const isWCM = type === 'wcm';

  return (
    <article 
      className="card card-hover overflow-hidden"
      lang={content.language || 'en'}
    >
      {/* Thumbnail for DAM assets */}
      {!isWCM && content.thumbnail_path && (
        <div className="aspect-video bg-neutral-100">
          <img
            src={`/uploads${content.thumbnail_path || content.file_path}`}
            alt={content.original_filename || content.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-5">
        {/* Language Badge */}
        {content.language && content.language !== 'en' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-secondary-50 text-secondary-700 mb-2">
            <Globe className="w-3 h-3" />
            {SUPPORTED_LOCALES[content.language]?.nativeName || content.language}
          </span>
        )}

        {/* Title */}
        <h3 className="font-semibold text-navy-800 text-lg line-clamp-2">
          {isWCM ? content.title : content.original_filename}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-3 text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {content.created_by_name || content.uploaded_by_name || 'Unknown'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatRelativeTime(content.published_at || content.created_at)}
          </span>
        </div>

        {/* Content Preview (WCM only) */}
        {isWCM && content.content_elements && (
          <p className="mt-3 text-neutral-600 text-sm line-clamp-3">
            {typeof content.content_elements === 'object' 
              ? Object.values(content.content_elements)[0]?.toString().substring(0, 150)
              : ''}
            ...
          </p>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <Link
            to={`/microsite/${type}/${content.id}`}
            className="text-secondary-600 hover:text-secondary-700 font-medium text-sm flex items-center gap-1"
          >
            {t('microsite.readMore')}
            <ChevronRight className="w-4 h-4" />
          </Link>
          <button 
            onClick={() => {
              navigator.share?.({
                title: content.title || content.original_filename,
                url: window.location.origin + `/microsite/${type}/${content.id}`
              });
            }}
            className="p-2 text-neutral-400 hover:text-secondary-500 rounded-lg hover:bg-neutral-50"
            aria-label={t('microsite.shareArticle')}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function FeaturedContent({ content }) {
  const { t } = useTranslation();
  
  if (!content) return null;

  return (
    <article 
      className="card overflow-hidden lg:flex"
      lang={content.language || 'en'}
    >
      <div className="lg:w-1/2 aspect-video lg:aspect-auto bg-gradient-to-br from-secondary-500 to-navy-800 flex items-center justify-center">
        {content.thumbnail_path ? (
          <img
            src={`/uploads${content.thumbnail_path}`}
            alt={content.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText className="w-24 h-24 text-white/30" />
        )}
      </div>
      <div className="lg:w-1/2 p-8">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary-100 text-primary-700 mb-4">
          {t('microsite.featuredContent')}
        </span>
        <h2 className="text-2xl font-bold text-navy-800 mb-3">{content.title}</h2>
        <p className="text-neutral-600 mb-4 line-clamp-3">
          {typeof content.content_elements === 'object' 
            ? Object.values(content.content_elements)[0]?.toString().substring(0, 200)
            : ''}
          ...
        </p>
        <div className="flex items-center gap-4 text-sm text-neutral-500 mb-6">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {content.created_by_name}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(content.published_at)}
          </span>
        </div>
        <Link
          to={`/microsite/wcm/${content.id}`}
          className="btn-secondary inline-flex"
        >
          {t('microsite.readMore')}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Link>
      </div>
    </article>
  );
}

export default function Microsite() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const [loading, setLoading] = useState(true);
  
  // Update language based on URL param
  useEffect(() => {
    if (lang && ['en', 'hi', 'mr'].includes(lang) && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);
  const [wcmContent, setWcmContent] = useState([]);
  const [damAssets, setDamAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadPublishedContent();
  }, []);

  const loadPublishedContent = async () => {
    setLoading(true);
    try {
      const [wcmRes, damRes] = await Promise.all([
        wcmApi.getContent({ status: 'published', limit: 50 }),
        damApi.getAssets({ status: 'published', limit: 50 })
      ]);
      setWcmContent(wcmRes.data.content || []);
      setDamAssets(damRes.data.assets || []);
    } catch (error) {
      console.error('Failed to load published content:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter content
  const filteredWcm = wcmContent.filter(c => {
    const matchesSearch = !search || 
      c.title?.toLowerCase().includes(search.toLowerCase());
    const matchesLanguage = !languageFilter || c.language === languageFilter;
    return matchesSearch && matchesLanguage;
  });

  const filteredDam = damAssets.filter(a => {
    const matchesSearch = !search || 
      a.original_filename?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const featuredContent = wcmContent[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-800">{t('microsite.title')}</h1>
          <p className="text-neutral-500 mt-1">{t('microsite.description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <a 
            href={process.env.HCL_DX_HOST ? `https://${process.env.HCL_DX_HOST}/wps/portal` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Open HCL DX Portal
          </a>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="search"
              placeholder={t('microsite.searchContent')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
              aria-label={t('microsite.searchContent')}
            />
          </div>

          {/* Language Filter */}
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-neutral-400" />
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="input-field py-2 w-40"
              aria-label={t('microsite.filterByLanguage')}
            >
              <option value="">{t('microsite.allLanguages')}</option>
              {Object.values(SUPPORTED_LOCALES).map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.nativeName}
                </option>
              ))}
            </select>
          </div>

          {/* Content Type Tabs */}
          <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
            {[
              { id: 'all', label: t('common.all') },
              { id: 'wcm', label: 'WCM' },
              { id: 'dam', label: 'DAM' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-white text-navy-800 shadow-sm'
                    : 'text-neutral-600 hover:text-navy-800'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Content */}
      {featuredContent && activeTab !== 'dam' && (
        <FeaturedContent content={featuredContent} />
      )}

      {/* Content Grid */}
      {(filteredWcm.length === 0 && filteredDam.length === 0) ? (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium text-navy-800">{t('microsite.noPublishedContent')}</h3>
        </div>
      ) : (
        <>
          {/* WCM Content */}
          {(activeTab === 'all' || activeTab === 'wcm') && filteredWcm.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-navy-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-secondary-500" />
                {t('microsite.latestArticles')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWcm.slice(activeTab === 'all' ? 1 : 0).map((content) => (
                  <ContentCard key={content.id} content={content} type="wcm" />
                ))}
              </div>
            </section>
          )}

          {/* DAM Assets */}
          {(activeTab === 'all' || activeTab === 'dam') && filteredDam.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-navy-800 mb-4 flex items-center gap-2">
                <Image className="w-5 h-5 text-secondary-500" />
                {t('microsite.publishedContent')} (DAM)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredDam.map((asset) => (
                  <ContentCard key={asset.id} content={asset} type="dam" />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Footer */}
      <footer className="text-center py-6 border-t border-neutral-200">
        <p className="text-sm text-neutral-500">
          {t('microsite.poweredBy')}
        </p>
      </footer>
    </div>
  );
}
