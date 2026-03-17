import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  validate: () => api.get('/auth/validate'),
  getLdapGroups: (filter = '') => api.get(`/auth/ldap/groups?filter=${filter}`),
};

// DAM API
export const damApi = {
  getAssets: (params) => api.get('/dam/assets', { params }),
  getAsset: (id) => api.get(`/dam/assets/${id}`),
  uploadAsset: (formData, onProgress) => api.post('/dam/assets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }),
  uploadMultiple: (formData, onProgress) => api.post('/dam/assets/upload-multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }),
  submitAsset: (id) => api.post(`/dam/assets/${id}/submit`),
  approveAsset: (id) => api.post(`/dam/assets/${id}/approve`),
  rejectAsset: (id, reason) => api.post(`/dam/assets/${id}/reject`, { reason }),
  publishAsset: (id) => api.post(`/dam/assets/${id}/publish`),
  deleteAsset: (id) => api.delete(`/dam/assets/${id}`),
  getCollections: () => api.get('/dam/collections'),
  createCollection: (data) => api.post('/dam/collections', data),
  getWorkflowStats: () => api.get('/dam/workflow-stats'),
  // HCL DX DAM Integration
  getDxStatus: () => api.get('/dam/dx/status'),
  getDxCollections: () => api.get('/dam/dx/collections'),
  getDxCollectionItems: (id, params) => api.get(`/dam/dx/collections/${id}/items`, { params }),
  initCollections: () => api.post('/dam/dx/init-collections'),
  testConnection: () => api.get('/dam/dx/test'),
  getAssetUrl: (collectionId, assetId) => api.get(`/dam/dx/asset-url/${collectionId}/${assetId}`),
  // WCM via DAM routes
  getWcmLibraries: () => api.get('/dam/dx/wcm/libraries'),
  getWcmTemplates: (libraryId) => api.get(`/dam/dx/wcm/libraries/${libraryId}/templates`),
};

// WCM API
export const wcmApi = {
  getLibraries: () => api.get('/wcm/libraries'),
  getAuthoringTemplates: (libraryId) => api.get(`/wcm/libraries/${libraryId}/authoring-templates`),
  getAuthoringTemplateDetails: (id) => api.get(`/wcm/authoring-templates/${id}`),
  getPresentationTemplates: (libraryId) => api.get(`/wcm/libraries/${libraryId}/presentation-templates`),
  getWorkflows: (libraryId) => api.get(`/wcm/libraries/${libraryId}/workflows`),
  getWorkflowDetails: (id) => api.get(`/wcm/workflows/${id}`),
  getContent: (params) => api.get('/wcm/content', { params }),
  getContentItem: (id) => api.get(`/wcm/content/${id}`),
  createContent: (data) => api.post('/wcm/content', data),
  updateContent: (id, data) => api.put(`/wcm/content/${id}`, data),
  submitContent: (id) => api.post(`/wcm/content/${id}/submit`),
  approveContent: (id) => api.post(`/wcm/content/${id}/approve`),
  rejectContent: (id, reason) => api.post(`/wcm/content/${id}/reject`, { reason }),
  publishContent: (id) => api.post(`/wcm/content/${id}/publish`),
  getContentPreview: (id) => api.get(`/wcm/content/${id}/preview`),
  deleteContent: (id) => api.delete(`/wcm/content/${id}`),
  getWorkflowStats: () => api.get('/wcm/workflow-stats'),
};

// Config API
export const configApi = {
  getRoleMappings: () => api.get('/config/role-mappings'),
  getRoleMappingsForRole: (role) => api.get(`/config/role-mappings/${role}`),
  createRoleMapping: (data) => api.post('/config/role-mappings', data),
  deleteRoleMapping: (id) => api.delete(`/config/role-mappings/${id}`),
  getRoles: () => api.get('/config/roles'),
  getLdapGroups: (filter = '') => api.get(`/config/ldap-groups?filter=${filter}`),
  getSystemConfig: () => api.get('/config/system'),
  getConfigValue: (key) => api.get(`/config/system/${key}`),
  updateConfigValue: (key, value, description) => api.put(`/config/system/${key}`, { value, description }),
  testDxConnection: () => api.get('/config/dx-connection'),
};

export default api;
