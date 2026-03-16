import { useState, useEffect } from 'react';
import { configApi } from '../services/api';
import {
  Settings as SettingsIcon,
  Users,
  Shield,
  Server,
  Plus,
  Trash2,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const roleInfo = {
  dxcontentauthors: {
    name: 'Content Authors',
    description: 'Can create and edit content, upload assets',
    color: 'bg-secondary-100 text-secondary-700'
  },
  dxcontentapprovers: {
    name: 'Content Approvers',
    description: 'Can review and approve content for publishing',
    color: 'bg-success-100 text-success-700'
  },
  wpsadmin: {
    name: 'Administrators',
    description: 'Full administrative access to all features',
    color: 'bg-primary-100 text-primary-700'
  }
};

function RoleMappingSection({ role, mappings, ldapGroups, onAdd, onRemove, loading }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);

  const info = roleInfo[role];
  const filteredGroups = ldapGroups.filter(g => 
    g.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !mappings.some(m => m.ldap_group_dn === g.dn)
  );

  const handleAdd = () => {
    if (selectedGroup) {
      onAdd(role, selectedGroup);
      setShowAddModal(false);
      setSelectedGroup(null);
      setSearchTerm('');
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={clsx('px-2 py-1 rounded text-xs font-medium', info.color)}>
              {info.name}
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">{info.description}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-outline py-1.5 px-3 text-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Group
        </button>
      </div>

      {/* Mapped Groups */}
      {mappings.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4 text-center">
          No LDAP groups mapped to this role
        </p>
      ) : (
        <div className="space-y-2">
          {mappings.map((mapping) => (
            <div
              key={mapping.id}
              className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-navy-800">{mapping.ldap_group_name}</p>
                <p className="text-xs text-neutral-500 truncate max-w-md">{mapping.ldap_group_dn}</p>
              </div>
              <button
                onClick={() => onRemove(mapping.id)}
                disabled={loading}
                className="p-2 text-neutral-400 hover:text-error-500 hover:bg-error-50 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Group Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-navy-800 mb-4">
              Add LDAP Group to {info.name}
            </h3>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search LDAP groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>

            {/* Group List */}
            <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
              {filteredGroups.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-4">
                  No matching groups found
                </p>
              ) : (
                filteredGroups.map((group) => (
                  <button
                    key={group.dn}
                    onClick={() => setSelectedGroup(group)}
                    className={clsx(
                      'w-full text-left p-3 rounded-lg transition-colors',
                      selectedGroup?.dn === group.dn
                        ? 'bg-secondary-100 border-2 border-secondary-500'
                        : 'bg-neutral-50 hover:bg-neutral-100'
                    )}
                  >
                    <p className="font-medium text-navy-800">{group.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{group.dn}</p>
                    {group.memberCount > 0 && (
                      <p className="text-xs text-neutral-400 mt-1">{group.memberCount} members</p>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedGroup(null);
                  setSearchTerm('');
                }}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!selectedGroup || loading}
                className="btn-primary"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Mapping'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('roles');
  
  // Role mappings
  const [roleMappings, setRoleMappings] = useState([]);
  const [ldapGroups, setLdapGroups] = useState([]);
  
  // DX Connection
  const [dxConnection, setDxConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mappingsRes, groupsRes] = await Promise.all([
        configApi.getRoleMappings(),
        configApi.getLdapGroups()
      ]);
      setRoleMappings(mappingsRes.data);
      setLdapGroups(groupsRes.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Set mock data for demo
      setLdapGroups([
        { dn: 'CN=ContentAuthors,OU=Groups,DC=domain,DC=com', name: 'ContentAuthors', memberCount: 15 },
        { dn: 'CN=ContentApprovers,OU=Groups,DC=domain,DC=com', name: 'ContentApprovers', memberCount: 5 },
        { dn: 'CN=PortalAdmins,OU=Groups,DC=domain,DC=com', name: 'PortalAdmins', memberCount: 3 },
        { dn: 'CN=Marketing,OU=Groups,DC=domain,DC=com', name: 'Marketing', memberCount: 25 },
        { dn: 'CN=Communications,OU=Groups,DC=domain,DC=com', name: 'Communications', memberCount: 10 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = async (role, group) => {
    setActionLoading(true);
    try {
      await configApi.createRoleMapping({
        ldapGroupDn: group.dn,
        ldapGroupName: group.name,
        appRole: role
      });
      toast.success(`${group.name} added to ${roleInfo[role].name}`);
      loadData();
    } catch (error) {
      toast.error('Failed to add role mapping');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMapping = async (mappingId) => {
    if (!confirm('Remove this role mapping?')) return;
    
    setActionLoading(true);
    try {
      await configApi.deleteRoleMapping(mappingId);
      toast.success('Role mapping removed');
      loadData();
    } catch (error) {
      toast.error('Failed to remove role mapping');
    } finally {
      setActionLoading(false);
    }
  };

  const testDxConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await configApi.testDxConnection();
      setDxConnection(response.data);
      if (response.data.connected) {
        toast.success('HCL DX connection successful');
      } else {
        toast.error('HCL DX connection failed');
      }
    } catch (error) {
      setDxConnection({ connected: false, message: error.message });
      toast.error('Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
  };

  const getMappingsForRole = (role) => {
    return roleMappings.filter(m => m.app_role === role);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-800">System Settings</h1>
        <p className="text-neutral-500 mt-1">
          Configure role mappings and system integrations
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200">
        {[
          { id: 'roles', label: 'Role Mappings', icon: Users },
          { id: 'connection', label: 'DX Connection', icon: Server },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-secondary-500 text-secondary-600'
                : 'border-transparent text-neutral-500 hover:text-navy-800'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Role Mappings Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="card p-4 bg-secondary-50 border-secondary-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-secondary-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-navy-800">LDAP Group to Role Mapping</h3>
                <p className="text-sm text-neutral-600 mt-1">
                  Map Active Directory groups to application roles. Users in mapped groups will automatically 
                  receive the corresponding permissions when they log in.
                </p>
              </div>
            </div>
          </div>

          {Object.keys(roleInfo).map((role) => (
            <RoleMappingSection
              key={role}
              role={role}
              mappings={getMappingsForRole(role)}
              ldapGroups={ldapGroups}
              onAdd={handleAddMapping}
              onRemove={handleRemoveMapping}
              loading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* DX Connection Tab */}
      {activeTab === 'connection' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-navy-800 mb-4">HCL DX Connection Status</h3>
            
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-neutral-500" />
                  <div>
                    <p className="font-medium text-navy-800">HCL Digital Experience</p>
                    <p className="text-sm text-neutral-500">
                      {dxConnection?.host || process.env.HCL_DX_HOST || 'Not configured'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {dxConnection && (
                    <span className={clsx(
                      'flex items-center gap-1 px-2 py-1 rounded text-sm font-medium',
                      dxConnection.connected 
                        ? 'bg-success-100 text-success-700'
                        : 'bg-error-100 text-error-700'
                    )}>
                      {dxConnection.connected ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Connected
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Disconnected
                        </>
                      )}
                    </span>
                  )}
                  <button
                    onClick={testDxConnection}
                    disabled={testingConnection}
                    className="btn-outline py-1.5 px-3 text-sm"
                  >
                    {testingConnection ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Test
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Connection Details */}
              {dxConnection && (
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <h4 className="font-medium text-navy-800 mb-2">Connection Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-neutral-500">Host:</span> {dxConnection.host}</p>
                    <p><span className="text-neutral-500">Port:</span> {dxConnection.port}</p>
                    <p><span className="text-neutral-500">Protocol:</span> {dxConnection.protocol}</p>
                    <p><span className="text-neutral-500">Status:</span> {dxConnection.status || 'N/A'}</p>
                  </div>
                  {dxConnection.message && (
                    <p className="mt-2 text-sm text-error-600">{dxConnection.message}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Environment Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-navy-800 mb-4">Environment Configuration</h3>
            <p className="text-sm text-neutral-500 mb-4">
              The following environment variables control the DX connection. Update your .env file to modify these settings.
            </p>
            
            <div className="bg-neutral-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-neutral-300 font-mono">
{`HCL_DX_HOST=your-dx-server.domain.com
HCL_DX_PORT=443
HCL_DX_PROTOCOL=https
HCL_DX_API_KEY=your_api_key
HCL_DX_DAM_BASE_URL=/dx/api/dam/v1
HCL_DX_WCM_BASE_URL=/wps/mycontenthandler/wcmrest`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
