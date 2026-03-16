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
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import WorkflowStepper from '../components/WorkflowStepper';

const statusConfig = {
  draft: { label: 'Draft', color: 'badge-draft', icon: Clock },
  pending_approval: { label: 'Pending Approval', color: 'badge-pending', icon: Clock },
  approved: { label: 'Approved', color: 'badge-approved', icon: CheckCircle },
  published: { label: 'Published', color: 'badge-published', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'badge-rejected', icon: XCircle },
};

function AssetCard({ asset }) {
  const status = statusConfig[asset.status] || statusConfig.draft;
  const StatusIcon = status.icon;

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
        <p className="text-xs text-neutral-400 mt-2">
          By {asset.uploaded_by_name || asset.uploaded_by_username}
        </p>
      </div>
    </div>
  );
}

export default function DAMWorkflow() {
  const { isAuthor, isApprover } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
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

      {/* Workflow Stepper */}
      <WorkflowStepper
        stages={['Draft', 'Pending Approval', 'Approved', 'Published']}
        currentStage={filter ? filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : null}
      />

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
              <AssetCard key={asset.id} asset={asset} />
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
