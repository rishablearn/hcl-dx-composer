import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { damApi, wcmApi } from '../services/api';
import {
  Image,
  FileText,
  Upload,
  CheckSquare,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

function StatCard({ title, value, icon: Icon, color, trend }) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    secondary: 'bg-secondary-50 text-secondary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
  };

  return (
    <div className="card p-6 card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-navy-800">{value}</p>
          {trend && (
            <p className="mt-2 flex items-center text-sm text-success-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ title, description, href, icon: Icon }) {
  return (
    <Link
      to={href}
      className="card p-5 card-hover flex items-center gap-4 group"
    >
      <div className="p-3 rounded-xl bg-secondary-50 text-secondary-600 group-hover:bg-secondary-100 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-navy-800">{title}</h3>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-secondary-500 transition-colors" />
    </Link>
  );
}

function ActivityItem({ action, entityName, user, time, status }) {
  const statusIcons = {
    approved: <CheckCircle className="w-4 h-4 text-success-500" />,
    rejected: <XCircle className="w-4 h-4 text-error-500" />,
    pending: <Clock className="w-4 h-4 text-warning-500" />,
    published: <CheckCircle className="w-4 h-4 text-secondary-500" />,
  };

  return (
    <div className="flex items-start gap-3 py-3">
      {statusIcons[status] || <Clock className="w-4 h-4 text-neutral-400" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy-800">
          <span className="font-medium">{user}</span>{' '}
          <span className="text-neutral-500">{action}</span>{' '}
          <span className="font-medium truncate">{entityName}</span>
        </p>
        <p className="text-xs text-neutral-400 mt-0.5">{time}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAuthor, isApprover } = useAuth();
  const { brand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [damStats, setDamStats] = useState(null);
  const [wcmStats, setWcmStats] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [damResponse, wcmResponse] = await Promise.all([
        damApi.getWorkflowStats(),
        wcmApi.getWorkflowStats(),
      ]);
      setDamStats(damResponse.data);
      setWcmStats(wcmResponse.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const totalDAMAssets = damStats ? Object.values(damStats.stats).reduce((a, b) => a + b, 0) : 0;
  const totalWCMContent = wcmStats ? Object.values(wcmStats.stats).reduce((a, b) => a + b, 0) : 0;
  const pendingApprovals = (damStats?.stats?.pending_approval || 0) + (wcmStats?.stats?.pending_approval || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-800">
          Welcome back, {user?.displayName || user?.username}
        </h1>
        <p className="text-neutral-500 mt-1">
          {brand.appName ? `${brand.appName} — ` : ''}Here's an overview of your content management activities
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total DAM Assets"
          value={totalDAMAssets}
          icon={Image}
          color="primary"
        />
        <StatCard
          title="WCM Content Items"
          value={totalWCMContent}
          icon={FileText}
          color="secondary"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingApprovals}
          icon={Clock}
          color="warning"
        />
        <StatCard
          title="Published Today"
          value={(damStats?.stats?.published || 0) + (wcmStats?.stats?.published || 0)}
          icon={CheckCircle}
          color="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-navy-800">Quick Actions</h2>
          <div className="space-y-3">
            {isAuthor() && (
              <>
                <QuickAction
                  title="AI Creative Studio"
                  description="Generate content with AI"
                  href="/ai-studio"
                  icon={Sparkles}
                />
                <QuickAction
                  title="Upload Assets"
                  description="Add new images to DAM"
                  href="/dam/upload"
                  icon={Upload}
                />
                <QuickAction
                  title="Create Content"
                  description="Start a new WCM article"
                  href="/wcm/compose"
                  icon={FileText}
                />
              </>
            )}
            {isApprover() && (
              <QuickAction
                title="Review Approvals"
                description={`${pendingApprovals} items pending`}
                href="/dam/approvals"
                icon={CheckSquare}
              />
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-navy-800 mb-4">Recent Activity</h2>
          <div className="card divide-y divide-neutral-100">
            <div className="p-4">
              <h3 className="text-sm font-medium text-neutral-500 mb-2">DAM Workflow</h3>
              {damStats?.recentActivity?.length > 0 ? (
                damStats.recentActivity.slice(0, 5).map((activity, index) => (
                  <ActivityItem
                    key={index}
                    action={activity.action}
                    entityName={activity.original_filename}
                    user={activity.display_name || activity.username}
                    time={formatTimeAgo(activity.created_at)}
                    status={activity.to_status}
                  />
                ))
              ) : (
                <p className="text-sm text-neutral-400 py-3">No recent activity</p>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-sm font-medium text-neutral-500 mb-2">WCM Workflow</h3>
              {wcmStats?.recentActivity?.length > 0 ? (
                wcmStats.recentActivity.slice(0, 5).map((activity, index) => (
                  <ActivityItem
                    key={index}
                    action={activity.action}
                    entityName={activity.title}
                    user={activity.display_name || activity.username}
                    time={formatTimeAgo(activity.created_at)}
                    status={activity.to_status}
                  />
                ))
              ) : (
                <p className="text-sm text-neutral-400 py-3">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DAM Status */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-navy-800 mb-4">DAM Workflow Status</h3>
          <div className="space-y-3">
            {[
              { label: 'Draft', value: damStats?.stats?.draft || 0, color: 'bg-neutral-200' },
              { label: 'Pending Approval', value: damStats?.stats?.pending_approval || 0, color: 'bg-warning-500' },
              { label: 'Approved', value: damStats?.stats?.approved || 0, color: 'bg-success-500' },
              { label: 'Published', value: damStats?.stats?.published || 0, color: 'bg-secondary-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-neutral-600">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-navy-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WCM Status */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-navy-800 mb-4">WCM Workflow Status</h3>
          <div className="space-y-3">
            {[
              { label: 'Draft', value: wcmStats?.stats?.draft || 0, color: 'bg-neutral-200' },
              { label: 'Pending Approval', value: wcmStats?.stats?.pending_approval || 0, color: 'bg-warning-500' },
              { label: 'Approved', value: wcmStats?.stats?.approved || 0, color: 'bg-success-500' },
              { label: 'Published', value: wcmStats?.stats?.published || 0, color: 'bg-secondary-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-neutral-600">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-navy-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
