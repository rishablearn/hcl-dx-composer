import { useState, useEffect } from 'react';
import { wcmApi } from '../services/api';
import {
  FileText,
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

function ApprovalCard({ content, onApprove, onReject, onPublish, loading }) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const isPendingApproval = content.status === 'pending_approval';
  const isApproved = content.status === 'approved';

  return (
    <>
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-secondary-50 flex-shrink-0">
            <FileText className="w-6 h-6 text-secondary-500" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-navy-800 text-lg">{content.title}</h3>
            
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <p><span className="text-neutral-500">Library:</span> {content.library_name}</p>
              <p><span className="text-neutral-500">Template:</span> {content.authoring_template_name}</p>
              <p><span className="text-neutral-500">Author:</span> {content.created_by_name || content.created_by_username}</p>
              <p><span className="text-neutral-500">Submitted:</span> {new Date(content.updated_at).toLocaleDateString()}</p>
            </div>

            {/* Workflow Stage */}
            <div className="mt-4 flex items-center gap-2">
              <Clock className={clsx(
                'w-4 h-4',
                isPendingApproval ? 'text-warning-500' : 'text-success-500'
              )} />
              <span className={clsx(
                'text-sm font-medium',
                isPendingApproval ? 'text-warning-600' : 'text-success-600'
              )}>
                {content.current_workflow_stage || (isPendingApproval ? 'Pending Approval' : 'Approved')}
              </span>
            </div>

            {/* Content Preview */}
            {content.content_elements && (
              <div className="mt-4 p-4 bg-neutral-50 rounded-lg">
                <h4 className="text-xs font-medium text-neutral-500 mb-2">Content Preview</h4>
                <div className="text-sm text-neutral-700 line-clamp-3">
                  {Object.entries(content.content_elements).slice(0, 2).map(([key, value]) => (
                    <p key={key}>
                      <strong>{key}:</strong> {typeof value === 'string' ? value.substring(0, 100) : '...'}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setPreviewOpen(true)}
                className="btn-ghost py-2 px-3 text-sm"
              >
                <Eye className="w-4 h-4 mr-1" />
                View Details
              </button>

              {isPendingApproval && (
                <>
                  <button
                    onClick={() => onApprove(content.id)}
                    disabled={loading}
                    className="btn-primary py-2 px-4 text-sm"
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
                    className="btn-outline py-2 px-4 text-sm border-error-500 text-error-500 hover:bg-error-500 hover:text-white"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </button>
                </>
              )}
              
              {isApproved && (
                <button
                  onClick={() => onPublish(content.id)}
                  disabled={loading}
                  className="btn-secondary py-2 px-4 text-sm"
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
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-navy-800">Reject Content</h3>
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
                  onReject(content.id, rejectReason);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-navy-800">{content.title}</h3>
              <button onClick={() => setPreviewOpen(false)} className="btn-ghost">
                Close
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <p><span className="text-neutral-500">Library:</span> {content.library_name}</p>
                <p><span className="text-neutral-500">Template:</span> {content.authoring_template_name}</p>
                <p><span className="text-neutral-500">Author:</span> {content.created_by_name}</p>
                <p><span className="text-neutral-500">Created:</span> {new Date(content.created_at).toLocaleString()}</p>
              </div>

              <h4 className="font-semibold text-navy-800 mb-4">Content Elements</h4>
              <div className="space-y-4">
                {Object.entries(content.content_elements || {}).map(([key, value]) => (
                  <div key={key} className="border-b border-neutral-100 pb-4">
                    <h5 className="text-sm font-medium text-neutral-500 mb-1">{key}</h5>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ 
                      __html: typeof value === 'object' ? JSON.stringify(value, null, 2) : value 
                    }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function WCMApprovals() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('pending_approval');

  useEffect(() => {
    loadContent();
  }, [filter]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const response = await wcmApi.getContent({ status: filter, limit: 50 });
      setContent(response.data.content);
    } catch (error) {
      console.error('Failed to load content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await wcmApi.approveContent(id);
      toast.success('Content approved');
      loadContent();
    } catch (error) {
      toast.error('Failed to approve content');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id, reason) => {
    setActionLoading(id);
    try {
      await wcmApi.rejectContent(id, reason);
      toast.success('Content rejected');
      loadContent();
    } catch (error) {
      toast.error('Failed to reject content');
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
      toast.error('Failed to publish content');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-800">WCM Approvals</h1>
        <p className="text-neutral-500 mt-1">
          Review and approve content for publishing to HCL DX
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

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : content.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-success-300 mb-4" />
          <h3 className="text-lg font-medium text-navy-800">No content to review</h3>
          <p className="text-neutral-500 mt-2">
            {filter === 'pending_approval' 
              ? 'All caught up! No content pending approval.'
              : 'No approved content waiting to be published.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {content.map((item) => (
            <ApprovalCard
              key={item.id}
              content={item}
              onApprove={handleApprove}
              onReject={handleReject}
              onPublish={handlePublish}
              loading={actionLoading === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
