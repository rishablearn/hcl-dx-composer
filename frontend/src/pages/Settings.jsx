import { useState, useEffect } from 'react';
import { configApi, damApi, wcmApi } from '../services/api';
import { useBrand } from '../context/BrandContext';
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
  RefreshCw,
  FolderOpen,
  Database,
  Image,
  FileText,
  ExternalLink,
  AlertCircle,
  Palette,
  Type,
  Save
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
  const [activeTab, setActiveTab] = useState('branding');

  // Whitelabel branding
  const { brand, updateBrand } = useBrand();
  const [brandForm, setBrandForm] = useState({});
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandDirty, setBrandDirty] = useState(false);
  
  // Role mappings
  const [roleMappings, setRoleMappings] = useState([]);
  const [ldapGroups, setLdapGroups] = useState([]);
  
  // DX Connection
  const [dxConnection, setDxConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // DAM Collections
  const [dxStatus, setDxStatus] = useState(null);
  const [damCollections, setDamCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [initializingCollections, setInitializingCollections] = useState(false);

  // WCM
  const [wcmLibraries, setWcmLibraries] = useState([]);
  const [loadingWcm, setLoadingWcm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setBrandForm({ ...brand });
    setBrandDirty(false);
  }, [brand]);

  const handleBrandChange = (key, value) => {
    setBrandForm(prev => ({ ...prev, [key]: value }));
    setBrandDirty(true);
  };

  const handleBrandSave = async () => {
    setSavingBrand(true);
    try {
      await updateBrand(brandForm);
      setBrandDirty(false);
      toast.success('Branding settings saved successfully');
    } catch (err) {
      toast.error('Failed to save branding settings');
    } finally {
      setSavingBrand(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dam') {
      loadDamData();
    } else if (activeTab === 'wcm') {
      loadWcmLibraries();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mappingsResult, groupsResult] = await Promise.allSettled([
        configApi.getRoleMappings(),
        configApi.getLdapGroups()
      ]);

      if (mappingsResult.status === 'fulfilled') {
        setRoleMappings(Array.isArray(mappingsResult.value.data) ? mappingsResult.value.data : []);
      } else {
        console.error('Failed to load role mappings:', mappingsResult.reason);
        setRoleMappings([]);
      }

      if (groupsResult.status === 'fulfilled') {
        setLdapGroups(Array.isArray(groupsResult.value.data) ? groupsResult.value.data : []);
      } else {
        console.error('Failed to load LDAP groups:', groupsResult.reason);
        // Set fallback demo data
        setLdapGroups([
          { dn: 'CN=ContentAuthors,OU=Groups,DC=domain,DC=com', name: 'ContentAuthors', memberCount: 15 },
          { dn: 'CN=ContentApprovers,OU=Groups,DC=domain,DC=com', name: 'ContentApprovers', memberCount: 5 },
          { dn: 'CN=PortalAdmins,OU=Groups,DC=domain,DC=com', name: 'PortalAdmins', memberCount: 3 },
          { dn: 'CN=Marketing,OU=Groups,DC=domain,DC=com', name: 'Marketing', memberCount: 25 },
          { dn: 'CN=Communications,OU=Groups,DC=domain,DC=com', name: 'Communications', memberCount: 10 },
        ]);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
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
      const response = await damApi.testConnection();
      setDxConnection(response.data);
      if (response.data.success) {
        toast.success('HCL DX connection successful');
      } else {
        toast.error(response.data.error || 'HCL DX connection failed');
      }
    } catch (error) {
      setDxConnection({ success: false, error: error.message });
      toast.error('Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
  };

  const loadDamData = async () => {
    setLoadingCollections(true);
    try {
      const [statusResult, collectionsResult] = await Promise.allSettled([
        damApi.getDxStatus(),
        damApi.getDxCollections()
      ]);

      if (statusResult.status === 'fulfilled') {
        setDxStatus(statusResult.value.data);
      } else {
        console.error('Failed to load DX status:', statusResult.reason);
        setDxStatus({ configured: false, error: statusResult.reason?.message || 'Failed to load status' });
      }

      if (collectionsResult.status === 'fulfilled') {
        setDamCollections(collectionsResult.value.data?.contents || []);
      } else {
        console.error('Failed to load DAM collections:', collectionsResult.reason);
        setDamCollections([]);
      }
    } catch (error) {
      console.error('Failed to load DAM data:', error);
      setDxStatus({ configured: false, error: error.message });
      setDamCollections([]);
    } finally {
      setLoadingCollections(false);
    }
  };

  const initializeCollections = async () => {
    setInitializingCollections(true);
    try {
      const response = await damApi.initCollections();
      if (response.data.success) {
        toast.success('DAM collections initialized successfully');
        loadDamData();
      } else {
        toast.error(response.data.message || 'Failed to initialize collections');
      }
    } catch (error) {
      toast.error('Failed to initialize DAM collections: ' + error.message);
    } finally {
      setInitializingCollections(false);
    }
  };

  const loadWcmLibraries = async () => {
    setLoadingWcm(true);
    try {
      // Try the WCM API route first (returns WCM API v2 format with demo data fallback)
      let response;
      try {
        response = await wcmApi.getLibraries();
      } catch {
        // Fallback to DAM WCM route
        response = await damApi.getWcmLibraries();
      }
      // WCM API v2 format: { items: [{id, title: {lang, value}, name, type: "Library", ...}], total }
      const entries = response.data?.items || response.data?.feed?.entry || [];
      setWcmLibraries(entries);
    } catch (error) {
      console.error('Failed to load WCM libraries:', error);
      setWcmLibraries([]);
    } finally {
      setLoadingWcm(false);
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
      <div className="flex gap-2 border-b border-neutral-200 overflow-x-auto">
        {[
          { id: 'branding', label: 'Whitelabel', icon: Palette },
          { id: 'roles', label: 'Role Mappings', icon: Users },
          { id: 'dam', label: 'DAM Collections', icon: Database },
          { id: 'wcm', label: 'WCM Libraries', icon: FileText },
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

      {/* Whitelabel Branding Tab */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          <div className="card p-4 bg-secondary-50 border-secondary-200">
            <div className="flex items-start gap-3">
              <Palette className="w-5 h-5 text-secondary-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-navy-800">Whitelabel Branding</h3>
                <p className="text-sm text-neutral-600 mt-1">
                  Customize the application appearance including logo, colors, and application name.
                  Changes will apply across the entire application for all users.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* App Identity */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-navy-800 mb-4">Application Identity</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-navy-800 mb-1">Application Name</label>
                  <input
                    type="text"
                    value={brandForm.appName || ''}
                    onChange={(e) => handleBrandChange('appName', e.target.value)}
                    placeholder="DX Composer"
                    className="input-field"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Displayed in sidebar header and browser title</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-800 mb-1">Subtitle / Organization</label>
                  <input
                    type="text"
                    value={brandForm.appSubtitle || ''}
                    onChange={(e) => handleBrandChange('appSubtitle', e.target.value)}
                    placeholder="Your Organization"
                    className="input-field"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Shown below the app name in the sidebar</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-800 mb-1">Logo URL</label>
                  <input
                    type="text"
                    value={brandForm.logoUrl || ''}
                    onChange={(e) => handleBrandChange('logoUrl', e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="input-field"
                  />
                  <p className="text-xs text-neutral-400 mt-1">URL to your logo image (recommended: 80x80px, PNG or SVG)</p>
                </div>
                {/* Logo Preview */}
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Sidebar Preview</p>
                  <div
                    className="flex items-center gap-3 h-14 px-4 rounded-lg"
                    style={{ backgroundColor: brandForm.sidebarColor || '#1E3A5F' }}
                  >
                    {brandForm.logoUrl ? (
                      <img
                        src={brandForm.logoUrl}
                        alt="Preview"
                        className="w-9 h-9 object-contain rounded"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-white/20 flex items-center justify-center">
                        <Type className="w-5 h-5 text-white/60" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{brandForm.appName || 'DX Composer'}</p>
                      {brandForm.appSubtitle && (
                        <p className="text-[10px] text-white/70 truncate">{brandForm.appSubtitle}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Color Scheme */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-navy-800 mb-4">Color Scheme</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-navy-800 mb-1">Sidebar Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandForm.sidebarColor || '#1E3A5F'}
                      onChange={(e) => handleBrandChange('sidebarColor', e.target.value)}
                      className="w-10 h-10 rounded border border-neutral-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandForm.sidebarColor || '#1E3A5F'}
                      onChange={(e) => handleBrandChange('sidebarColor', e.target.value)}
                      className="input-field flex-1"
                      placeholder="#1E3A5F"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-800 mb-1">Primary / Highlight Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandForm.primaryColor || '#FFCD00'}
                      onChange={(e) => handleBrandChange('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded border border-neutral-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandForm.primaryColor || '#FFCD00'}
                      onChange={(e) => handleBrandChange('primaryColor', e.target.value)}
                      className="input-field flex-1"
                      placeholder="#FFCD00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-800 mb-1">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandForm.accentColor || '#0A6ED1'}
                      onChange={(e) => handleBrandChange('accentColor', e.target.value)}
                      className="w-10 h-10 rounded border border-neutral-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandForm.accentColor || '#0A6ED1'}
                      onChange={(e) => handleBrandChange('accentColor', e.target.value)}
                      className="input-field flex-1"
                      placeholder="#0A6ED1"
                    />
                  </div>
                </div>

                {/* Color Swatches Preview */}
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Color Preview</p>
                  <div className="flex gap-3">
                    <div className="text-center">
                      <div
                        className="w-12 h-12 rounded-lg shadow-sm border border-neutral-200"
                        style={{ backgroundColor: brandForm.sidebarColor || '#1E3A5F' }}
                      />
                      <p className="text-[10px] text-neutral-500 mt-1">Sidebar</p>
                    </div>
                    <div className="text-center">
                      <div
                        className="w-12 h-12 rounded-lg shadow-sm border border-neutral-200"
                        style={{ backgroundColor: brandForm.primaryColor || '#FFCD00' }}
                      />
                      <p className="text-[10px] text-neutral-500 mt-1">Primary</p>
                    </div>
                    <div className="text-center">
                      <div
                        className="w-12 h-12 rounded-lg shadow-sm border border-neutral-200"
                        style={{ backgroundColor: brandForm.accentColor || '#0A6ED1' }}
                      />
                      <p className="text-[10px] text-neutral-500 mt-1">Accent</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleBrandSave}
              disabled={!brandDirty || savingBrand}
              className={clsx(
                'btn-primary px-6 py-2.5',
                (!brandDirty || savingBrand) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {savingBrand ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Branding
            </button>
          </div>
        </div>
      )}

      {/* DAM Collections Tab */}
      {activeTab === 'dam' && (
        <div className="space-y-6">
          {/* DX Status Banner */}
          {dxStatus && !dxStatus.configured && (
            <div className="card p-4 bg-warning-50 border-warning-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-navy-800">HCL DX Not Configured</h3>
                  <p className="text-sm text-neutral-600 mt-1">
                    {dxStatus.error || 'Configure HCL_DX_HOST, HCL_DX_USERNAME, and HCL_DX_PASSWORD in your .env file'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* DAM Collections */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-navy-800">DAM Collections</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  Manage HCL DX Digital Asset Management collections
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadDamData}
                  disabled={loadingCollections}
                  className="btn-outline py-1.5 px-3 text-sm"
                >
                  {loadingCollections ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Refresh
                    </>
                  )}
                </button>
                <button
                  onClick={initializeCollections}
                  disabled={initializingCollections || !dxStatus?.configured}
                  className="btn-primary py-1.5 px-3 text-sm"
                >
                  {initializingCollections ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Initialize Collections
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Required Collections Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className={clsx(
                'p-4 rounded-lg border-2',
                dxStatus?.collections?.notApproved 
                  ? 'bg-success-50 border-success-200' 
                  : 'bg-neutral-50 border-neutral-200'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {dxStatus?.collections?.notApproved ? (
                    <CheckCircle className="w-5 h-5 text-success-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-neutral-400" />
                  )}
                  <h4 className="font-medium text-navy-800">Not Approved Assets</h4>
                </div>
                <p className="text-sm text-neutral-600">
                  {dxStatus?.collections?.notApproved 
                    ? `ID: ${dxStatus.collections.notApproved.id}`
                    : 'Collection not created yet'}
                </p>
              </div>

              <div className={clsx(
                'p-4 rounded-lg border-2',
                dxStatus?.collections?.approved 
                  ? 'bg-success-50 border-success-200' 
                  : 'bg-neutral-50 border-neutral-200'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {dxStatus?.collections?.approved ? (
                    <CheckCircle className="w-5 h-5 text-success-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-neutral-400" />
                  )}
                  <h4 className="font-medium text-navy-800">Approved Assets</h4>
                </div>
                <p className="text-sm text-neutral-600">
                  {dxStatus?.collections?.approved 
                    ? `ID: ${dxStatus.collections.approved.id}`
                    : 'Collection not created yet'}
                </p>
              </div>
            </div>

            {/* All Collections List */}
            <h4 className="font-medium text-navy-800 mb-3">All DAM Collections ({damCollections.length})</h4>
            {loadingCollections ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-secondary-500" />
              </div>
            ) : damCollections.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-8">
                No collections found. Click "Initialize Collections" to create the required collections.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {damCollections.map((collection) => (
                  <div key={collection.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="w-5 h-5 text-secondary-500" />
                      <div>
                        <p className="font-medium text-navy-800">{collection.name}</p>
                        <p className="text-xs text-neutral-500">ID: {collection.id}</p>
                      </div>
                    </div>
                    {(collection.name === 'Not Approved Assets' || collection.name === 'Approved Assets') && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                        Workflow Collection
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DAM URL Format Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-navy-800 mb-4">DAM Asset URL Format</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Published assets will be accessible via the following URL pattern:
            </p>
            <div className="bg-neutral-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-neutral-300 font-mono">
{`${dxStatus?.host || 'your-dx-server'}/dx/api/dam/v1/collections/{collectionId}/items/{assetId}/renditions/original`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* WCM Libraries Tab */}
      {activeTab === 'wcm' && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-navy-800">WCM Libraries</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  Web Content Manager libraries available on HCL DX
                </p>
              </div>
              <button
                onClick={loadWcmLibraries}
                disabled={loadingWcm}
                className="btn-outline py-1.5 px-3 text-sm"
              >
                {loadingWcm ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </>
                )}
              </button>
            </div>

            {loadingWcm ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-secondary-500" />
              </div>
            ) : wcmLibraries.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
                <p className="text-sm text-neutral-400">
                  No WCM libraries found. Ensure HCL DX is configured and click Refresh.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {wcmLibraries.map((library, index) => (
                  <div key={library.id || index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-secondary-500" />
                      <div>
                        <p className="font-medium text-navy-800">
                          {library.displayTitle || (typeof library.title === 'string' ? library.title : library.title?.value) || library.name || 'Untitled'}
                        </p>
                        <p className="text-xs text-neutral-500">
                          ID: {(library.id || '').replace(/^wcmrest:/, '')}
                          {library.type && <span className="ml-2">&bull; {library.type}</span>}
                          {library.data?.enabled !== undefined && (
                            <span className={`ml-2 ${library.data.enabled ? 'text-success-600' : 'text-neutral-400'}`}>
                              &bull; {library.data.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {wcmLibraries[0]?._demo && (
                  <p className="text-xs text-amber-500 mt-2 text-center">
                    Demo data &mdash; Connect to HCL DX to load real WCM libraries
                  </p>
                )}
              </div>
            )}
          </div>
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
