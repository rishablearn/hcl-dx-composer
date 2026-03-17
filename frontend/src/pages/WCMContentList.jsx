import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { wcmApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  PenTool,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Send,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const statusConfig = {
  draft: { label: 'Draft', color: 'badge-draft', icon: Clock },
  pending_approval: { label: 'Pending Approval', color: 'badge-pending', icon: Clock },
  approved: { label: 'Approved', color: 'badge-approved', icon: CheckCircle },
  published: { label: 'Published', color: 'badge-published', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'badge-rejected', icon: XCircle },
};

const WORKFLOW_STAGES = [
  { key: 'draft', label: 'Draft', step: 1 },
  { key: 'pending_approval', label: 'Pending Approval', step: 2 },
  { key: 'approved', label: 'Approved', step: 3 },
  { key: 'published', label: 'Published', step: 4 },
];

function WorkflowProgress({ currentStatus }) {
  const currentStage = WORKFLOW_STAGES.find(s => s.key === currentStatus);
  const currentStep = currentStage?.step || (currentStatus === 'rejected' ? 0 : 1);

  return (
    <div className="flex items-center gap-1 mt-2">
      {WORKFLOW_STAGES.map((stage, idx) => {
        const isComplete = currentStep > stage.step;
        const isCurrent = currentStep === stage.step;
        const isRejected = currentStatus === 'rejected';
        
        return (
          <div key={stage.key} className="flex items-center flex-1">
            <div
              className={clsx(
                'h-1.5 flex-1 rounded-full transition-colors',
                isComplete ? 'bg-success-500' : 
                isCurrent ? 'bg-primary-500' : 
                isRejected ? 'bg-error-200' : 'bg-neutral-200'
              )}
              title={stage.label}
            />
            {idx < WORKFLOW_STAGES.length - 1 && <div className="w-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

function ContentCard({ content, onDelete, onSubmit, onApprove, onReject, onPublish, loading, currentUserId, isAdmin, isApprover }) {
  const status = statusConfig[content.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const isOwner = content.created_by === currentUserId;
  const isLoading = loading === content.id;
  
  const canEdit = content.status === 'draft' || content.status === 'rejected';
  const canSubmit = content.status === 'draft' && isOwner;
  const canApprove = content.status === 'pending_approval' && isApprover;
  const canReject = content.status === 'pending_approval' && isApprover;
  const canPublish = content.status === 'approved' && isApprover;
  const canDelete = (content.status === 'draft' || content.status === 'rejected') && (isOwner || isAdmin);

  const nextAction = canSubmit ? 'Submit for Approval' : 
                     canApprove ? 'Approve' : 
                     canPublish ? 'Publish to DX' : null;

  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-secondary-500 flex-shrink-0" />
            <h3 className="font-semibold text-navy-800 truncate">{content.title}</h3>
          </div>
          
          <div className="mt-2 space-y-1 text-sm text-neutral-500">
            <p>Library: {content.library_name}</p>
            <p>Template: {content.authoring_template_name}</p>
            <p>Created by: {content.created_by_name || content.created_by_username}</p>
          </div>
        </div>

        <span className={clsx('badge flex-shrink-0', status.color)}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {status.label}
        </span>
      </div>

      {/* Workflow Progress Bar */}
      <WorkflowProgress currentStatus={content.status} />

      {/* Next Action Hint */}
      {nextAction && (
        <p className="text-xs text-secondary-600 mt-2 flex items-center">
          <ArrowRight className="w-3 h-3 mr-1" />
          Next: {nextAction}
        </p>
      )}

      {/* Rejection Reason */}
      {content.status === 'rejected' && content.rejection_reason && (
        <p className="text-xs text-error-600 mt-2 bg-error-50 p-2 rounded">
          Rejected: {content.rejection_reason}
        </p>
      )}

      {/* Workflow Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canEdit && (
          <Link
            to={`/wcm/edit/${content.id}`}
            className="btn-outline py-1.5 px-3 text-sm"
          >
            <PenTool className="w-3.5 h-3.5 mr-1" />
            Edit
          </Link>
        )}
        
        {/* Submit */}
        {canSubmit && (
          <button
            onClick={() => onSubmit(content.id)}
            disabled={isLoading}
            className="btn-primary py-1.5 px-3 text-sm"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
              <><Send className="w-3.5 h-3.5 mr-1" />Submit</>
            )}
          </button>
        )}

        {/* Approve */}
        {canApprove && (
          <button
            onClick={() => onApprove(content.id)}
            disabled={isLoading}
            className="btn-primary py-1.5 px-3 text-sm bg-success-500 hover:bg-success-600"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
              <><ThumbsUp className="w-3.5 h-3.5 mr-1" />Approve</>
            )}
          </button>
        )}

        {/* Reject */}
        {canReject && (
          <button
            onClick={() => onReject(content.id)}
            disabled={isLoading}
            className="btn-outline py-1.5 px-3 text-sm border-error-500 text-error-500 hover:bg-error-500 hover:text-white"
          >
            <ThumbsDown className="w-3.5 h-3.5 mr-1" />Reject
          </button>
        )}

        {/* Publish */}
        {canPublish && (
          <button
            onClick={() => onPublish(content.id)}
            disabled={isLoading}
            className="btn-secondary py-1.5 px-3 text-sm"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
              <><ExternalLink className="w-3.5 h-3.5 mr-1" />Publish</>
            )}
          </button>
        )}

        <Link
          to={`/wcm/edit/${content.id}`}
          className="btn-ghost py-1.5 px-3 text-sm"
        >
          <Eye className="w-3.5 h-3.5 mr-1" />
          View
        </Link>
        
        {/* Delete */}
        {canDelete && (
          <button
            onClick={() => onDelete(content.id)}
            disabled={isLoading}
            className="btn-ghost py-1.5 px-2 text-sm text-error-500 hover:bg-error-50"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function WCMContentList() {
  const { isAuthor, isApprover, isAdmin, user } = useAuth();
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    loadContent();
  }, [filter, pagination.page]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 10 };
      if (filter) params.status = filter;
      
      const response = await wcmApi.getContent(params);
      setContent(response.data.content);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (id) => {
    setActionLoading(id);
    try {
      await wcmApi.submitContent(id);
      toast.success('Content submitted for approval');
      loadContent();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit content');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await wcmApi.approveContent(id);
      toast.success('Content approved');
      loadContent();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve content');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    setActionLoading(id);
    try {
      await wcmApi.rejectContent(id, reason);
      toast.success('Content rejected');
      loadContent();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject content');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (id) => {
    setActionLoading(id);
    try {
      await wcmApi.publishContent(id);
      toast.success('Content published to HCL DX WCM');
      loadContent();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to publish content');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    
    setActionLoading(id);
    try {
      await wcmApi.deleteContent(id);
      toast.success('Content deleted');
      loadContent();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete content');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredContent = search
    ? content.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : content;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">WCM Content</h1>
          <p className="text-neutral-500 mt-1">Manage web content through the approval workflow</p>
        </div>
        {isAuthor() && (
          <Link to="/wcm/compose" className="btn-primary">
            <PenTool className="w-4 h-4 mr-2" />
            Create Content
          </Link>
        )}
      </div>

      {/* Workflow Stages - Interactive */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          {WORKFLOW_STAGES.map((stage, idx) => {
            const isActive = filter === stage.key;
            const count = content.filter(c => c.status === stage.key).length;
            
            return (
              <button
                key={stage.key}
                onClick={() => {
                  setFilter(isActive ? '' : stage.key);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className={clsx(
                  'flex-1 p-3 rounded-lg border-2 transition-all text-center',
                  isActive 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'
                )}
              >
                <p className={clsx(
                  'text-sm font-medium',
                  isActive ? 'text-primary-700' : 'text-neutral-600'
                )}>
                  {stage.label}
                </p>
                <p className={clsx(
                  'text-2xl font-bold mt-1',
                  isActive ? 'text-primary-600' : 'text-navy-800'
                )}>
                  {count}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="input-field py-2 w-40"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 py-2"
            />
          </div>
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredContent.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium text-navy-800">No content found</h3>
          <p className="text-neutral-500 mt-2">
            {filter ? 'Try changing the filter or ' : ''}
            {isAuthor() ? (
              <Link to="/wcm/compose" className="text-secondary-500 hover:underline">
                create new content
              </Link>
            ) : (
              'No content matches your criteria'
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {filteredContent.map((item) => (
              <ContentCard
                key={item.id}
                content={item}
                onSubmit={handleSubmit}
                onApprove={handleApprove}
                onReject={handleReject}
                onPublish={handlePublish}
                onDelete={handleDelete}
                loading={actionLoading}
                currentUserId={user?.id}
                isAdmin={isAdmin()}
                isApprover={isApprover()}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                Showing {((pagination.page - 1) * 10) + 1} - {Math.min(pagination.page * 10, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="btn-ghost p-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-navy-800">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="btn-ghost p-2 disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
