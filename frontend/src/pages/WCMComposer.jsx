import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { wcmApi } from '../services/api';
import {
  Save,
  Send,
  Eye,
  ChevronRight,
  FileText,
  Layout,
  Workflow,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import WorkflowStepper from '../components/WorkflowStepper';

function DynamicFormField({ element, value, onChange }) {
  const { name, type, label, required, options, placeholder } = element;

  const fieldLabel = (
    <label className="block text-sm font-medium text-navy-800 mb-2">
      {label || name}
      {required && <span className="text-error-500 ml-1">*</span>}
    </label>
  );

  switch (type) {
    case 'text':
    case 'short_text':
      return (
        <div>
          {fieldLabel}
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={placeholder || `Enter ${label || name}`}
            className="input-field"
            required={required}
          />
        </div>
      );

    case 'rich_text':
    case 'html':
      return (
        <div>
          {fieldLabel}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={placeholder || `Enter ${label || name}`}
            className="input-field h-40 resize-y"
            required={required}
          />
          <p className="text-xs text-neutral-400 mt-1">HTML formatting supported</p>
        </div>
      );

    case 'textarea':
    case 'long_text':
      return (
        <div>
          {fieldLabel}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={placeholder || `Enter ${label || name}`}
            className="input-field h-32 resize-y"
            required={required}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          {fieldLabel}
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={placeholder}
            className="input-field"
            required={required}
          />
        </div>
      );

    case 'date':
      return (
        <div>
          {fieldLabel}
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(name, e.target.value)}
            className="input-field"
            required={required}
          />
        </div>
      );

    case 'select':
    case 'option':
      return (
        <div>
          {fieldLabel}
          <select
            value={value || ''}
            onChange={(e) => onChange(name, e.target.value)}
            className="input-field"
            required={required}
          >
            <option value="">Select {label || name}</option>
            {(options || []).map((opt) => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        </div>
      );

    case 'image':
    case 'file':
      return (
        <div>
          {fieldLabel}
          <div className="border-2 border-dashed border-neutral-200 rounded-lg p-6 text-center">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(name, e.target.value)}
              placeholder="Enter image/file URL or path"
              className="input-field"
            />
            <p className="text-xs text-neutral-400 mt-2">
              Enter the URL or DAM path to the asset
            </p>
          </div>
        </div>
      );

    case 'link':
      return (
        <div>
          {fieldLabel}
          <div className="space-y-2">
            <input
              type="url"
              value={value?.url || ''}
              onChange={(e) => onChange(name, { ...value, url: e.target.value })}
              placeholder="Enter URL"
              className="input-field"
            />
            <input
              type="text"
              value={value?.text || ''}
              onChange={(e) => onChange(name, { ...value, text: e.target.value })}
              placeholder="Link text"
              className="input-field"
            />
          </div>
        </div>
      );

    default:
      return (
        <div>
          {fieldLabel}
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={placeholder || `Enter ${label || name}`}
            className="input-field"
          />
        </div>
      );
  }
}

export default function WCMComposer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  // Form data
  const [libraries, setLibraries] = useState([]);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [authoringTemplates, setAuthoringTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateDetails, setTemplateDetails] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [presentationTemplates, setPresentationTemplates] = useState([]);
  const [selectedPT, setSelectedPT] = useState(null);

  // Content data
  const [title, setTitle] = useState('');
  const [contentElements, setContentElements] = useState({});
  const [existingContent, setExistingContent] = useState(null);
  const [previewHtml, setPreviewHtml] = useState(null);

  useEffect(() => {
    if (isEditing) {
      loadExistingContent();
    } else {
      loadLibraries();
    }
  }, [id]);

  const loadExistingContent = async () => {
    try {
      const response = await wcmApi.getContentItem(id);
      const content = response.data;
      setExistingContent(content);
      setTitle(content.title);
      setContentElements(content.content_elements || {});
      setSelectedLibrary({ id: content.library_id, name: content.library_name });
      setSelectedTemplate({ id: content.authoring_template_id, name: content.authoring_template_name });
      
      // Load template details for form rendering
      if (content.authoring_template_id) {
        const templateResponse = await wcmApi.getAuthoringTemplateDetails(content.authoring_template_id);
        setTemplateDetails(templateResponse.data);
      }
      
      setStep(3); // Go directly to content editing
    } catch (error) {
      console.error('Failed to load content:', error);
      toast.error('Failed to load content');
      navigate('/wcm');
    } finally {
      setLoading(false);
    }
  };

  const loadLibraries = async () => {
    try {
      const response = await wcmApi.getLibraries();
      setLibraries(response.data?.feed?.entry || []);
    } catch (error) {
      console.error('Failed to load libraries:', error);
      // Use mock data for demo
      setLibraries([
        { id: 'lib-1', title: { value: 'Web Content' } },
        { id: 'lib-2', title: { value: 'Marketing Content' } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLibrarySelect = async (library) => {
    setSelectedLibrary(library);
    setLoading(true);
    
    try {
      const [atResponse, wfResponse, ptResponse] = await Promise.all([
        wcmApi.getAuthoringTemplates(library.id),
        wcmApi.getWorkflows(library.id),
        wcmApi.getPresentationTemplates(library.id),
      ]);
      
      setAuthoringTemplates(atResponse.data?.feed?.entry || []);
      setWorkflows(wfResponse.data?.feed?.entry || []);
      setPresentationTemplates(ptResponse.data?.feed?.entry || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      // Mock data for demo
      setAuthoringTemplates([
        { id: 'at-1', title: { value: 'Article' }, elements: [
          { name: 'headline', type: 'text', label: 'Headline', required: true },
          { name: 'summary', type: 'textarea', label: 'Summary' },
          { name: 'body', type: 'rich_text', label: 'Body Content', required: true },
          { name: 'author', type: 'text', label: 'Author Name' },
          { name: 'publishDate', type: 'date', label: 'Publish Date' },
          { name: 'featuredImage', type: 'image', label: 'Featured Image' },
        ]},
        { id: 'at-2', title: { value: 'News Item' }, elements: [
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'content', type: 'rich_text', label: 'Content', required: true },
          { name: 'category', type: 'select', label: 'Category', options: ['Company News', 'Industry', 'Events'] },
        ]},
      ]);
      setWorkflows([
        { id: 'wf-1', title: { value: 'Standard Approval' }, stages: ['Draft', 'Review', 'Approved', 'Published'] },
      ]);
      setPresentationTemplates([
        { id: 'pt-1', title: { value: 'Article Layout' } },
        { id: 'pt-2', title: { value: 'News Layout' } },
      ]);
    } finally {
      setLoading(false);
      setStep(2);
    }
  };

  const handleTemplateSelect = async (template) => {
    setSelectedTemplate(template);
    setLoading(true);
    
    try {
      const response = await wcmApi.getAuthoringTemplateDetails(template.id);
      setTemplateDetails(response.data);
    } catch (error) {
      // Use mock elements
      setTemplateDetails({
        elements: template.elements || [
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'body', type: 'rich_text', label: 'Body', required: true },
        ]
      });
    } finally {
      setLoading(false);
      setStep(3);
    }
  };

  const handleElementChange = (name, value) => {
    setContentElements(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (submit = false) => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setSaving(true);
    try {
      const data = {
        title,
        libraryId: selectedLibrary.id,
        libraryName: selectedLibrary.name || selectedLibrary.title?.value,
        authoringTemplateId: selectedTemplate.id,
        authoringTemplateName: selectedTemplate.name || selectedTemplate.title?.value,
        presentationTemplateId: selectedPT?.id,
        presentationTemplateName: selectedPT?.name || selectedPT?.title?.value,
        workflowId: selectedWorkflow?.id,
        workflowName: selectedWorkflow?.name || selectedWorkflow?.title?.value,
        contentElements,
      };

      if (isEditing) {
        await wcmApi.updateContent(id, data);
        toast.success('Content updated');
      } else {
        const response = await wcmApi.createContent(data);
        if (submit) {
          await wcmApi.submitContent(response.data.id);
          toast.success('Content created and submitted for approval');
        } else {
          toast.success('Content saved as draft');
        }
      }
      
      navigate('/wcm');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (existingContent?.id) {
      try {
        const response = await wcmApi.getContentPreview(existingContent.id);
        setPreviewHtml(response.data);
      } catch (error) {
        // Generate local preview
        setPreviewHtml({
          preview: { title, elements: contentElements },
          source: 'local'
        });
      }
    } else {
      setPreviewHtml({
        preview: { title, elements: contentElements },
        source: 'local'
      });
    }
  };

  if (loading && step === 1) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">
            {isEditing ? 'Edit Content' : 'Create Content'}
          </h1>
          <p className="text-neutral-500 mt-1">
            {isEditing ? 'Update your content item' : 'Create a new WCM content item'}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      {!isEditing && (
        <div className="card p-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { num: 1, label: 'Select Library', icon: FileText },
              { num: 2, label: 'Choose Template', icon: Layout },
              { num: 3, label: 'Create Content', icon: Workflow },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg',
                  step === s.num ? 'bg-primary-500 text-navy-800' : 
                  step > s.num ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-500'
                )}>
                  <s.icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{s.label}</span>
                </div>
                {i < 2 && (
                  <ChevronRight className="w-5 h-5 mx-2 text-neutral-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Library Selection */}
      {step === 1 && !isEditing && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-navy-800 mb-4">Select WCM Library</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {libraries.map((lib) => (
              <button
                key={lib.id}
                onClick={() => handleLibrarySelect({ id: lib.id, name: lib.title?.value || lib.name })}
                className="card p-6 text-left hover:border-secondary-500 hover:shadow-md transition-all"
              >
                <FileText className="w-8 h-8 text-secondary-500 mb-3" />
                <h3 className="font-semibold text-navy-800">{lib.title?.value || lib.name}</h3>
                <p className="text-sm text-neutral-500 mt-1">Click to select this library</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Template Selection */}
      {step === 2 && !isEditing && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-navy-800 mb-4">Select Authoring Template</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {authoringTemplates.map((at) => (
                <button
                  key={at.id}
                  onClick={() => handleTemplateSelect({ id: at.id, name: at.title?.value, elements: at.elements })}
                  className="card p-6 text-left hover:border-secondary-500 hover:shadow-md transition-all"
                >
                  <Layout className="w-8 h-8 text-secondary-500 mb-3" />
                  <h3 className="font-semibold text-navy-800">{at.title?.value || at.name}</h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    {at.elements?.length || 0} elements
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Optional: Workflow & PT Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold text-navy-800 mb-3">Workflow (Optional)</h3>
              <select
                value={selectedWorkflow?.id || ''}
                onChange={(e) => {
                  const wf = workflows.find(w => w.id === e.target.value);
                  setSelectedWorkflow(wf);
                }}
                className="input-field"
              >
                <option value="">Use default workflow</option>
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>{wf.title?.value || wf.name}</option>
                ))}
              </select>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-navy-800 mb-3">Presentation Template (Optional)</h3>
              <select
                value={selectedPT?.id || ''}
                onChange={(e) => {
                  const pt = presentationTemplates.find(p => p.id === e.target.value);
                  setSelectedPT(pt);
                }}
                className="input-field"
              >
                <option value="">Select presentation template</option>
                {presentationTemplates.map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.title?.value || pt.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="btn-ghost"
          >
            ← Back to Library Selection
          </button>
        </div>
      )}

      {/* Step 3: Content Form */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-navy-800 mb-4">Content Details</h2>
              
              {/* Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-navy-800 mb-2">
                  Content Title <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter content title"
                  className="input-field text-lg"
                />
              </div>

              {/* Dynamic Form Fields */}
              <div className="space-y-6">
                {(templateDetails?.elements || selectedTemplate?.elements || []).map((element) => (
                  <DynamicFormField
                    key={element.name}
                    element={element}
                    value={contentElements[element.name]}
                    onChange={handleElementChange}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Info Card */}
            <div className="card p-4">
              <h3 className="font-semibold text-navy-800 mb-3">Content Info</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-neutral-500">Library:</span> {selectedLibrary?.name}</p>
                <p><span className="text-neutral-500">Template:</span> {selectedTemplate?.name}</p>
                {selectedWorkflow && (
                  <p><span className="text-neutral-500">Workflow:</span> {selectedWorkflow.name || selectedWorkflow.title?.value}</p>
                )}
                {existingContent && (
                  <p><span className="text-neutral-500">Status:</span> {existingContent.status}</p>
                )}
              </div>
            </div>

            {/* Workflow Stepper */}
            {selectedWorkflow?.stages && (
              <WorkflowStepper
                stages={selectedWorkflow.stages}
                currentStage={existingContent?.current_workflow_stage || 'Draft'}
              />
            )}

            {/* Actions */}
            <div className="card p-4 space-y-3">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="btn-outline w-full"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="btn-primary w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Save & Submit
              </button>

              <button
                onClick={handlePreview}
                className="btn-secondary w-full"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </button>
            </div>

            {!isEditing && (
              <button
                onClick={() => setStep(2)}
                className="btn-ghost w-full"
              >
                ← Back to Template Selection
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-navy-800">Content Preview</h3>
              <button
                onClick={() => setPreviewHtml(null)}
                className="btn-ghost"
              >
                Close
              </button>
            </div>
            <div className="p-6">
              <h1 className="text-3xl font-bold text-navy-800 mb-6">{previewHtml.preview?.title || title}</h1>
              {Object.entries(previewHtml.preview?.elements || contentElements).map(([key, value]) => (
                <div key={key} className="mb-4">
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">{key}</h4>
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: typeof value === 'object' ? JSON.stringify(value) : value }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
