import { useState, useEffect } from 'react';
import { damApi } from '../services/api';
import {
  Image,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  Loader2,
  Eye
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import WorkflowStepper from '../components/WorkflowStepper';

function ApprovalCard({ asset, onApprove, onReject, onPublish, loading }) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const isImage = asset.mime_type?.startsWith('image/');
  const isPendingApproval = asset.status === 'pending_approval';
  const isApproved = asset.status === 'approved';

  return (
    <>
      <div className="card overflow-hidden">
        {/* Preview */}
        <div 
          className="aspect-video bg-neutral-100 relative cursor-pointer group"
          onClick={() => setPreviewOpen(true)}
        >
          {isImage ? (
            <img
              src={`/uploads${asset.file_path}`}
              alt={asset.original_filename}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image className="w-16 h-16 text-neutral-300" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-navy-800 truncate" title={asset.original_filename}>
            {asset.original_filename}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-neutral-500">
            <p>Size: {(asset.file_size / 1024 / 1024).toFixed(2)} MB</p>
            <p>Type: {asset.mime_type}</p>
            <p>Uploaded by: {asset.uploaded_by_name || asset.uploaded_by_username}</p>
            <p>Submitted: {new Date(asset.updated_at).toLocaleDateString()}</p>
          </div>

          {/* Workflow Status */}
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-warning-500" />
              <span className={clsx(
                'font-medium',
                isPendingApproval && 'text-warning-600',
                isApproved && 'text-success-600'
              )}>
                {isPendingApproval ? 'Pending Approval' : 'Approved - Ready to Publish'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            {isPendingApproval && (
              <>
                <button
                  onClick={() => onApprove(asset.id)}
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={loading}
                  className="btn-outline flex-1 border-error-500 text-error-500 hover:bg-error-500 hover:text-white"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </button>
              </>
            )}
            {isApproved && (
              <button
                onClick={() => onPublish(asset.id)}
                disabled={loading}
                className="btn-secondary w-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Publish to DX
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-navy-800">Reject Asset</h3>
            <p className="text-neutral-500 mt-1">Please provide a reason for rejection</p>
            
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="input-field mt-4 h-32 resize-none"
            />

            <div className="mt-4 flex gap-3 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onReject(asset.id, rejectReason);
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="btn-primary bg-error-500 hover:bg-error-600"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="max-w-4xl max-h-[90vh]">
            {isImage ? (
              <img
                src={`/uploads${asset.file_path}`}
                alt={asset.original_filename}
                className="max-w-full max-h-[90vh] object-contain"
              />
            ) : (
              <div className="card p-12 text-center">
                <Image className="w-24 h-24 mx-auto text-neutral-400" />
                <p className="mt-4 text-white">{asset.original_filename}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function DAMApprovals() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('pending_approval');

  useEffect(() => {
    loadAssets();
  }, [filter]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const response = await damApi.getAssets({ status: filter, limit: 50 });
      setAssets(response.data.assets);
    } catch (error) {
      console.error('Failed to load assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await damApi.approveAsset(id);
      toast.success('Asset approved');
      loadAssets();
    } catch (error) {
      toast.error('Failed to approve asset');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id, reason) => {
    setActionLoading(id);
    try {
      await damApi.rejectAsset(id, reason);
      toast.success('Asset rejected');
      loadAssets();
    } catch (error) {
      toast.error('Failed to reject asset');
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
      toast.error('Failed to publish asset');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-800">DAM Approvals</h1>
        <p className="text-neutral-500 mt-1">
          Review and approve assets for publishing to HCL DX
        </p>
      </div>

      {/* Workflow Stepper */}
      <WorkflowStepper
        stages={['Draft', 'Pending Approval', 'Approved', 'Published']}
        currentStage={filter === 'pending_approval' ? 'Pending Approval' : 'Approved'}
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('pending_approval')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            filter === 'pending_approval'
              ? 'bg-primary-500 text-navy-800'
              : 'bg-white text-neutral-600 hover:bg-neutral-100'
          )}
        >
          Pending Approval
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            filter === 'approved'
              ? 'bg-primary-500 text-navy-800'
              : 'bg-white text-neutral-600 hover:bg-neutral-100'
          )}
        >
          Ready to Publish
        </button>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : assets.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-success-300 mb-4" />
          <h3 className="text-lg font-medium text-navy-800">No assets to review</h3>
          <p className="text-neutral-500 mt-2">
            {filter === 'pending_approval' 
              ? 'All caught up! No assets pending approval.'
              : 'No approved assets waiting to be published.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <ApprovalCard
              key={asset.id}
              asset={asset}
              onApprove={handleApprove}
              onReject={handleReject}
              onPublish={handlePublish}
              loading={actionLoading === asset.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
