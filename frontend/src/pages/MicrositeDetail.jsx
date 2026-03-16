import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { wcmApi, damApi } from '../services/api';
import { SUPPORTED_LOCALES, formatDate } from '../i18n';
import {
  ArrowLeft,
  Calendar,
  User,
  Globe,
  Share2,
  Download,
  ExternalLink,
  FileText,
  Image
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function MicrositeDetail() {
  const { type, id, lang } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // Update language based on URL param
  useEffect(() => {
    if (lang && ['en', 'hi', 'mr'].includes(lang) && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [relatedContent, setRelatedContent] = useState([]);

  const isWCM = type === 'wcm';

  useEffect(() => {
    loadContent();
  }, [id, type]);

  const loadContent = async () => {
    setLoading(true);
    try {
      if (isWCM) {
        const response = await wcmApi.getContentItem(id);
        setContent(response.data);
        
        // Load related content
        const relatedRes = await wcmApi.getContent({ status: 'published', limit: 4 });
        setRelatedContent(relatedRes.data.content?.filter(c => c.id !== id).slice(0, 3) || []);
      } else {
        const response = await damApi.getAsset(id);
        setContent(response.data);
        
        // Load related assets
        const relatedRes = await damApi.getAssets({ status: 'published', limit: 4 });
        setRelatedContent(relatedRes.data.assets?.filter(a => a.id !== id).slice(0, 3) || []);
      }
    } catch (error) {
      console.error('Failed to load content:', error);
      navigate('/microsite');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const title = isWCM ? content.title : content.original_filename;
    const url = window.location.href;
    
    if (navigator.share) {
      navigator.share({ title, url });
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">{t('errors.notFound')}</p>
        <Link to="/microsite" className="btn-secondary mt-4">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Navigation */}
      <Link
        to="/microsite"
        className="inline-flex items-center gap-2 text-neutral-600 hover:text-navy-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('common.back')} to {t('microsite.title')}
      </Link>

      {/* Article/Asset Content */}
      <article 
        className="card overflow-hidden"
        lang={content.language || 'en'}
        itemScope
        itemType={isWCM ? 'https://schema.org/Article' : 'https://schema.org/ImageObject'}
      >
        {/* Header Image/Asset */}
        {!isWCM && (
          <div className="aspect-video bg-neutral-100 relative">
            {content.mime_type?.startsWith('image/') ? (
              <img
                src={`/uploads${content.file_path}`}
                alt={content.original_filename}
                className="w-full h-full object-contain"
                itemProp="contentUrl"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary-500 to-navy-800">
                <Image className="w-24 h-24 text-white/30" />
              </div>
            )}
          </div>
        )}

        <div className="p-8">
          {/* Language Badge */}
          {content.language && content.language !== 'en' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-secondary-50 text-secondary-700 mb-4">
              <Globe className="w-3 h-3" />
              {SUPPORTED_LOCALES[content.language]?.nativeName || content.language}
            </span>
          )}

          {/* Title */}
          <h1 
            className="text-3xl font-bold text-navy-800 mb-4"
            itemProp={isWCM ? 'headline' : 'name'}
          >
            {isWCM ? content.title : content.original_filename}
          </h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-500 mb-8 pb-8 border-b border-neutral-200">
            <span className="flex items-center gap-2" itemProp="author">
              <User className="w-4 h-4" />
              {content.created_by_name || content.uploaded_by_name || 'Unknown'}
            </span>
            <time 
              className="flex items-center gap-2"
              dateTime={content.published_at}
              itemProp="datePublished"
            >
              <Calendar className="w-4 h-4" />
              {formatDate(content.published_at || content.created_at)}
            </time>
            {isWCM && content.library_name && (
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {content.library_name}
              </span>
            )}
            {!isWCM && (
              <span className="text-neutral-400">
                {(content.file_size / 1024 / 1024).toFixed(2)} MB • {content.mime_type}
              </span>
            )}
          </div>

          {/* Content Body (WCM) */}
          {isWCM && content.content_elements && (
            <div 
              className="prose prose-lg max-w-none"
              itemProp="articleBody"
            >
              {Object.entries(content.content_elements).map(([key, value]) => (
                <div key={key} className="mb-6">
                  <h3 className="text-lg font-semibold text-navy-800 mb-2 capitalize">
                    {key.replace(/_/g, ' ')}
                  </h3>
                  <div 
                    className="text-neutral-700"
                    dangerouslySetInnerHTML={{ 
                      __html: typeof value === 'string' ? value : JSON.stringify(value) 
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* DAM Asset Details */}
          {!isWCM && (
            <div className="space-y-4">
              {content.tags && content.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {content.tags.map((tag, i) => (
                      <span key={i} className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {content.dx_asset_id && (
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">HCL DX Asset ID</h3>
                  <code className="text-sm bg-neutral-100 px-3 py-1 rounded">{content.dx_asset_id}</code>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-8 pt-8 border-t border-neutral-200">
            <button
              onClick={handleShare}
              className="btn-outline"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {t('microsite.shareArticle')}
            </button>
            
            {!isWCM && (
              <a
                href={`/uploads${content.file_path}`}
                download={content.original_filename}
                className="btn-secondary"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Asset
              </a>
            )}

            {content.dx_content_id && (
              <a
                href={`${process.env.HCL_DX_HOST}/wps/wcm/connect/${content.dx_content_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View in HCL DX
              </a>
            )}
          </div>
        </div>
      </article>

      {/* Translations (if available) */}
      {isWCM && content.translations && content.translations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-navy-800 mb-4">
            {t('wcm.translations')}
          </h2>
          <div className="flex gap-3">
            {content.translations.map((trans) => (
              <Link
                key={trans.language}
                to={`/microsite/wcm/${trans.id}`}
                className="card p-4 flex items-center gap-3 hover:border-secondary-500"
              >
                <Globe className="w-5 h-5 text-secondary-500" />
                <span>{SUPPORTED_LOCALES[trans.language]?.nativeName || trans.language}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Related Content */}
      {relatedContent.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-navy-800 mb-4">
            {t('microsite.relatedContent')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedContent.map((item) => (
              <Link
                key={item.id}
                to={`/microsite/${type}/${item.id}`}
                className="card p-4 hover:border-secondary-500 transition-colors"
              >
                <h3 className="font-medium text-navy-800 line-clamp-2">
                  {isWCM ? item.title : item.original_filename}
                </h3>
                <p className="text-sm text-neutral-500 mt-2">
                  {formatDate(item.published_at || item.created_at)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="text-center py-8 mt-12 border-t border-neutral-200">
        <p className="text-sm text-neutral-500">
          {t('microsite.poweredBy')}
        </p>
      </footer>
    </div>
  );
}
