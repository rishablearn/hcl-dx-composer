import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Wand2,
  Image,
  Download,
  Send,
  Loader2,
  Settings,
  History,
  ChevronDown,
  Check,
  AlertCircle,
  Palette,
  Zap,
  RefreshCw,
  ArrowRight,
  FolderPlus
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const STYLE_PRESETS = [
  { id: 'corporate', name: 'Corporate', icon: '🏢', description: 'Professional business style' },
  { id: 'marketing', name: 'Marketing', icon: '📢', description: 'Eye-catching promotional' },
  { id: 'social', name: 'Social Media', icon: '📱', description: 'Optimized for social' },
  { id: 'minimal', name: 'Minimal', icon: '✨', description: 'Clean and elegant' },
  { id: 'energetic', name: 'Energetic', icon: '⚡', description: 'Dynamic and bold' }
];

const SIZE_OPTIONS = [
  { id: '1024x1024', name: 'Square (1:1)', description: '1024×1024' },
  { id: '1792x1024', name: 'Landscape (16:9)', description: '1792×1024' },
  { id: '1024x1792', name: 'Portrait (9:16)', description: '1024×1792' }
];

const QUALITY_OPTIONS = [
  { id: 'standard', name: 'Standard', description: 'Fast generation' },
  { id: 'hd', name: 'HD', description: 'Higher detail' }
];

export default function AICreativeStudio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [prompt, setPrompt] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('corporate');
  const [selectedSize, setSelectedSize] = useState('1024x1024');
  const [selectedQuality, setSelectedQuality] = useState('standard');
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [providers, setProviders] = useState({});
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [addToDAM, setAddToDAM] = useState(true);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');

  useEffect(() => {
    loadProviders();
    loadHistory();
    loadCollections();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await api.get('/ai/providers');
      setProviders(response.data);
      // Set default provider based on availability
      if (response.data.openai?.available) {
        setSelectedProvider('openai');
      } else if (response.data.stability?.available) {
        setSelectedProvider('stability');
      }
    } catch (err) {
      console.error('Failed to load AI providers:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.get('/ai/history?limit=10');
      setHistory(response.data.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const loadCollections = async () => {
    try {
      const response = await api.get('/dam/collections');
      setCollections(response.data || []);
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  };

  const enhancePrompt = async () => {
    if (!prompt.trim()) return;
    
    setEnhancing(true);
    try {
      const response = await api.post('/ai/enhance-prompt', {
        prompt: prompt.trim(),
        style: selectedStyle
      });
      setEnhancedPrompt(response.data.enhanced);
    } catch (err) {
      setError('Failed to enhance prompt');
    } finally {
      setEnhancing(false);
    }
  };

  const generateImage = async () => {
    const finalPrompt = enhancedPrompt || prompt;
    if (!finalPrompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const endpoint = addToDAM ? '/ai/generate-and-stage' : '/ai/generate';
      const response = await api.post(endpoint, {
        prompt: finalPrompt.trim(),
        provider: selectedProvider,
        size: selectedSize,
        quality: selectedQuality,
        style: selectedStyle,
        collection_id: selectedCollection || null,
        tags: [selectedStyle, 'ai-generated'],
        metadata: {
          style: selectedStyle,
          originalPrompt: prompt
        }
      });

      if (addToDAM) {
        setGeneratedImages(response.data.assets.map(asset => ({
          ...asset,
          url: `/uploads${asset.file_path}`,
          staged: true
        })));
      } else {
        setGeneratedImages(response.data.images.map(img => ({
          ...img,
          url: `/uploads${img.path}`,
          staged: false
        })));
      }

      loadHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate image');
    } finally {
      setGenerating(false);
    }
  };

  const useHistoryPrompt = (historyItem) => {
    setPrompt(historyItem.prompt);
    setEnhancedPrompt('');
    setShowHistory(false);
  };

  const goToDAM = () => {
    navigate('/dam');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-secondary-500" />
            {t('ai.title', 'AI Creative Studio')}
          </h1>
          <p className="text-neutral-600 mt-1">
            {t('ai.subtitle', 'Generate stunning visuals with AI and add them to your Digital Asset Workflow')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={clsx(
              'btn-ghost',
              showHistory && 'bg-neutral-100'
            )}
          >
            <History className="w-4 h-4 mr-2" />
            History
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={clsx(
              'btn-ghost',
              showSettings && 'bg-neutral-100'
            )}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Generation Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt Input */}
          <div className="card p-6">
            <label className="block text-sm font-medium text-navy-800 mb-2">
              {t('ai.promptLabel', 'Describe your creative')}
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setEnhancedPrompt('');
                }}
                placeholder={t('ai.promptPlaceholder', 'A modern fuel station with Bharat Petroleum branding at sunset, photorealistic...')}
                className="input-field min-h-[120px] pr-24 resize-none"
                disabled={generating}
              />
              <button
                onClick={enhancePrompt}
                disabled={!prompt.trim() || enhancing || generating}
                className="absolute right-2 bottom-2 btn-ghost text-sm py-1.5 px-3"
              >
                {enhancing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-1" />
                    Enhance
                  </>
                )}
              </button>
            </div>

            {enhancedPrompt && (
              <div className="mt-3 p-3 bg-secondary-50 border border-secondary-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-secondary-700 mb-1">
                  <Sparkles className="w-4 h-4" />
                  Enhanced Prompt
                </div>
                <p className="text-sm text-neutral-700">{enhancedPrompt}</p>
              </div>
            )}
          </div>

          {/* Style Selection */}
          <div className="card p-6">
            <label className="block text-sm font-medium text-navy-800 mb-3">
              {t('ai.styleLabel', 'Creative Style')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {STYLE_PRESETS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={clsx(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    selectedStyle === style.id
                      ? 'border-secondary-500 bg-secondary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  )}
                >
                  <span className="text-2xl block mb-1">{style.icon}</span>
                  <span className="font-medium text-sm text-navy-800">{style.name}</span>
                  <span className="text-xs text-neutral-500 block">{style.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size & Quality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <label className="block text-sm font-medium text-navy-800 mb-2">
                Image Size
              </label>
              <div className="space-y-2">
                {SIZE_OPTIONS.map((size) => (
                  <label
                    key={size.id}
                    className={clsx(
                      'flex items-center gap-3 p-2 rounded cursor-pointer',
                      selectedSize === size.id ? 'bg-secondary-50' : 'hover:bg-neutral-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="size"
                      value={size.id}
                      checked={selectedSize === size.id}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="text-secondary-500"
                    />
                    <div>
                      <span className="font-medium text-sm">{size.name}</span>
                      <span className="text-xs text-neutral-500 ml-2">{size.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <label className="block text-sm font-medium text-navy-800 mb-2">
                Quality
              </label>
              <div className="space-y-2">
                {QUALITY_OPTIONS.map((quality) => (
                  <label
                    key={quality.id}
                    className={clsx(
                      'flex items-center gap-3 p-2 rounded cursor-pointer',
                      selectedQuality === quality.id ? 'bg-secondary-50' : 'hover:bg-neutral-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="quality"
                      value={quality.id}
                      checked={selectedQuality === quality.id}
                      onChange={(e) => setSelectedQuality(e.target.value)}
                      className="text-secondary-500"
                    />
                    <div>
                      <span className="font-medium text-sm">{quality.name}</span>
                      <span className="text-xs text-neutral-500 ml-2">{quality.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* DAM Integration Toggle */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  addToDAM ? 'bg-primary-100 text-primary-600' : 'bg-neutral-100 text-neutral-500'
                )}>
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-navy-800">Add to DAM Workflow</h3>
                  <p className="text-sm text-neutral-500">
                    Automatically stage generated images for approval
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddToDAM(!addToDAM)}
                className={clsx(
                  'relative w-12 h-6 rounded-full transition-colors',
                  addToDAM ? 'bg-primary-500' : 'bg-neutral-300'
                )}
              >
                <span className={clsx(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  addToDAM ? 'left-7' : 'left-1'
                )} />
              </button>
            </div>

            {addToDAM && collections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Collection (optional)
                </label>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="input-field"
                >
                  <option value="">No collection</option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={generateImage}
            disabled={generating || !prompt.trim()}
            className="btn-primary w-full py-4 text-lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Generate Creative
              </>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Generated Images */}
          {generatedImages.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-navy-800">Generated Images</h3>
                {addToDAM && (
                  <button onClick={goToDAM} className="btn-secondary text-sm">
                    View in DAM
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedImages.map((image, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border border-neutral-200">
                    <img
                      src={image.url}
                      alt={`Generated ${index + 1}`}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={image.url}
                        download
                        className="btn-secondary text-sm"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </a>
                    </div>
                    {image.staged && (
                      <div className="absolute top-2 left-2 right-2 flex justify-between">
                        <div className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          📁 Not Approved Assets
                        </div>
                        <div className="bg-primary-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Pending
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {generatedImages[0]?.revisedPrompt && (
                <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
                  <p className="text-xs text-neutral-500 mb-1">AI Revised Prompt:</p>
                  <p className="text-sm text-neutral-700">{generatedImages[0].revisedPrompt}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Provider Selection */}
          {showSettings && (
            <div className="card p-4">
              <h3 className="font-semibold text-navy-800 mb-3">AI Provider</h3>
              <div className="space-y-2">
                {Object.entries(providers).map(([key, provider]) => (
                  <label
                    key={key}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer',
                      !provider.available && 'opacity-50 cursor-not-allowed',
                      selectedProvider === key
                        ? 'border-secondary-500 bg-secondary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={key}
                      checked={selectedProvider === key}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      disabled={!provider.available}
                      className="text-secondary-500"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-sm">{provider.name}</span>
                      {!provider.available && (
                        <span className="text-xs text-red-500 block">API key not configured</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {showHistory && (
            <div className="card p-4">
              <h3 className="font-semibold text-navy-800 mb-3">Recent Generations</h3>
              {history.length === 0 ? (
                <p className="text-sm text-neutral-500">No generation history yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => useHistoryPrompt(item)}
                      className="w-full text-left p-3 rounded-lg border border-neutral-200 hover:border-secondary-300 hover:bg-secondary-50 transition-colors"
                    >
                      <p className="text-sm text-navy-800 line-clamp-2">{item.prompt}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                        <span>{item.provider}</span>
                        <span>•</span>
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Tips */}
          <div className="card p-4 bg-gradient-to-br from-secondary-50 to-primary-50">
            <h3 className="font-semibold text-navy-800 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-secondary-500" />
              Quick Tips
            </h3>
            <ul className="space-y-2 text-sm text-neutral-700">
              <li className="flex items-start gap-2">
                <span className="text-secondary-500 mt-0.5">•</span>
                Be specific about colors, lighting, and composition
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary-500 mt-0.5">•</span>
                Use the Enhance button to improve your prompt
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary-500 mt-0.5">•</span>
                Enable DAM integration to start the approval workflow
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary-500 mt-0.5">•</span>
                Brand colors: Green (#006B3F) and Yellow (#FFC72C)
              </li>
            </ul>
          </div>

          {/* Workflow Info */}
          {addToDAM && (
            <div className="card p-4 border-primary-200 bg-primary-50">
              <h3 className="font-semibold text-navy-800 mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary-500" />
                HCL DX DAM Workflow
              </h3>
              <p className="text-sm text-neutral-700 mb-3">
                Generated images are uploaded to HCL DX DAM and follow the approval workflow via DAM API.
              </p>
              
              {/* Collection-based workflow visualization */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1.5 bg-amber-100 text-amber-800 rounded font-medium border border-amber-200">
                        📁 Not Approved Assets
                      </span>
                      <ArrowRight className="w-4 h-4 text-neutral-400" />
                      <span className="px-2 py-1.5 bg-green-100 text-green-800 rounded font-medium border border-green-200">
                        ✓ Approved Assets
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-neutral-600 space-y-1">
                  <p><strong>1. Generate:</strong> AI creates image locally</p>
                  <p><strong>2. Upload:</strong> Image uploaded to "Not Approved Assets" collection</p>
                  <p><strong>3. Approve:</strong> Approver reviews and approves</p>
                  <p><strong>4. Move:</strong> Asset moved to "Approved Assets" collection</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
