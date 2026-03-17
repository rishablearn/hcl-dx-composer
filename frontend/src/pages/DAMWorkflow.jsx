import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { damApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Image,
  Upload,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Send,
  Trash2,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  ArrowRight
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

function AssetCard({ asset, onSubmit, onApprove, onReject, onPublish, onDelete, loading, currentUserId, isAdmin, isApprover }) {
  const status = statusConfig[asset.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const isOwner = asset.uploaded_by === currentUserId;
  const isLoading = loading === asset.id;

  const canSubmit = asset.status === 'draft' && isOwner;
  const canApprove = asset.status === 'pending_approval' && isApprover;
  const canReject = asset.status === 'pending_approval' && isApprover;
  const canPublish = asset.status === 'approved' && isApprover;
  const canDelete = (asset.status === 'draft' || asset.status === 'rejected') && (isOwner || isAdmin);

  const nextAction = canSubmit ? 'Submit for Approval' : 
                     canApprove ? 'Approve' : 
                     canPublish ? 'Publish to DX' : null;

  return (
    <div className="card card-hover overflow-hidden">
      {/* Thumbnail */}
      <div className="aspect-video bg-neutral-100 relative">
        {asset.thumbnail_path ? (
          <img
            src={`/uploads${asset.thumbnail_path}`}
            alt={asset.original_filename}
            className="w-full h-full object-cover"
          />
        ) : asset.mime_type?.startsWith('image/') ? (
          <img
            src={`/uploads${asset.file_path}`}
            alt={asset.original_filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-12 h-12 text-neutral-300" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={clsx('badge', status.color)}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.label}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium text-navy-800 truncate" title={asset.original_filename}>
          {asset.original_filename}
        </h3>
        <p className="text-sm text-neutral-500 mt-1">
          {(asset.file_size / 1024).toFixed(1)} KB • {asset.mime_type?.split('/')[1]?.toUpperCase()}
        </p>
        <p className="text-xs text-neutral-400 mt-1">
          By {asset.uploaded_by_name || asset.uploaded_by_username}
        </p>

        {/* Workflow Progress Bar */}
        <WorkflowProgress currentStatus={asset.status} />

        {/* Next Action Hint */}
        {nextAction && (
          <p className="text-xs text-secondary-600 mt-2 flex items-center">
            <ArrowRight className="w-3 h-3 mr-1" />
            Next: {nextAction}
          </p>
        )}

        {/* Rejection Reason */}
        {asset.status === 'rejected' && asset.rejection_reason && (
          <p className="text-xs text-error-600 mt-2 bg-error-50 p-2 rounded">
            Rejected: {asset.rejection_reason}
          </p>
        )}

        {/* Workflow Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Draft Actions */}
          {canSubmit && (
            <button
              onClick={() => onSubmit(asset.id)}
              disabled={isLoading}
              className="btn-primary text-xs py-1.5 px-3 flex-1"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                <><Send className="w-3 h-3 mr-1" />Submit</>
              )}
            </button>
          )}

          {/* Approval Actions */}
          {canApprove && (
            <button
              onClick={() => onApprove(asset.id)}
              disabled={isLoading}
              className="btn-primary text-xs py-1.5 px-3 flex-1 bg-success-500 hover:bg-success-600"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                <><ThumbsUp className="w-3 h-3 mr-1" />Approve</>
              )}
            </button>
          )}
          {canReject && (
            <button
              onClick={() => onReject(asset.id)}
              disabled={isLoading}
              className="btn-outline text-xs py-1.5 px-3 border-error-500 text-error-500 hover:bg-error-500 hover:text-white"
            >
              <ThumbsDown className="w-3 h-3 mr-1" />Reject
            </button>
          )}

          {/* Publish Action */}
          {canPublish && (
            <button
              onClick={() => onPublish(asset.id)}
              disabled={isLoading}
              className="btn-secondary text-xs py-1.5 px-3 flex-1"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                <><ExternalLink className="w-3 h-3 mr-1" />Publish</>
              )}
            </button>
          )}

          {/* Delete Action */}
          {canDelete && (
            <button
              onClick={() => onDelete(asset.id)}
              disabled={isLoading}
              className="btn-ghost text-xs py-1.5 px-2 text-error-500 hover:bg-error-50"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DAMWorkflow() {
  const { isAuthor, isApprover, isAdmin, user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    loadAssets();
  }, [filter, pagination.page]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 12 };
      if (filter) params.status = filter;
      
      const response = await damApi.getAssets(params);
      setAssets(response.data.assets);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (id) => {
    setActionLoading(id);
    try {
      await damApi.submitAsset(id);
      toast.success('Asset submitted for approval');
      loadAssets();
    } catch (error) {
      console.error('Failed to submit asset:', error);
      toast.error(error.response?.data?.error || 'Failed to submit asset');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    
    setActionLoading(id);
    try {
      await damApi.deleteAsset(id);
      toast.success('Asset deleted');
      loadAssets();
    } catch (error) {
      console.error('Failed to delete asset:', error);
      toast.error(error.response?.data?.error || 'Failed to delete asset');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await damApi.approveAsset(id);
      toast.success('Asset approved');
      loadAssets();
    } catch (error) {
      console.error('Failed to approve asset:', error);
      toast.error(error.response?.data?.error || 'Failed to approve asset');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    setActionLoading(id);
    try {
      await damApi.rejectAsset(id, reason);
      toast.success('Asset rejected');
      loadAssets();
    } catch (error) {
      console.error('Failed to reject asset:', error);
      toast.error(error.response?.data?.error || 'Failed to reject asset');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (id) => {
    setActionLoading(id);
    try {
      await damApi.publishAsset(id);
      toast.success('Asset published to HCL DX DAM');
      loadAssets();
    } catch (error) {
      console.error('Failed to publish asset:', error);
      toast.error(error.response?.data?.error || 'Failed to publish asset');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAssets = search
    ? assets.filter(a => a.original_filename.toLowerCase().includes(search.toLowerCase()))
    : assets;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">DAM Workflow</h1>
          <p className="text-neutral-500 mt-1">Manage digital assets through the approval workflow</p>
        </div>
        {isAuthor() && (
          <Link to="/dam/upload" className="btn-primary">
            <Upload className="w-4 h-4 mr-2" />
            Upload Assets
          </Link>
        )}
      </div>

      {/* Workflow Stages - Interactive */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          {WORKFLOW_STAGES.map((stage, idx) => {
            const isActive = filter === stage.key;
            const count = assets.filter(a => a.status === stage.key).length;
            
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
                <div className="flex items-center justify-center gap-2">
                  {idx < WORKFLOW_STAGES.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-neutral-300 absolute right-0 translate-x-1/2 hidden sm:block" />
                  )}
                </div>
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
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 py-2"
            />
          </div>
        </div>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="card p-12 text-center">
          <Image className="w-16 h-16 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium text-navy-800">No assets found</h3>
          <p className="text-neutral-500 mt-2">
            {filter ? 'Try changing the filter or ' : ''}
            {isAuthor() ? (
              <Link to="/dam/upload" className="text-secondary-500 hover:underline">
                upload new assets
              </Link>
            ) : (
              'No assets match your criteria'
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => (
              <AssetCard 
                key={asset.id} 
                asset={asset}
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
                Showing {((pagination.page - 1) * 12) + 1} - {Math.min(pagination.page * 12, pagination.total)} of {pagination.total}
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
