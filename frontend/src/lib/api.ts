import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor для добавления токена
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor для обработки 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Auth API ---
export const authApi = {
  register: (data: { name: string; email: string; password: string; password_confirmation: string }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  logout: () => api.post('/logout'),

  me: () => api.get('/me'),

  updateProfile: (data: { name?: string; email?: string }) =>
    api.put('/profile', data),

  changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
    api.put('/password', data),

  googleRedirect: () => api.get('/auth/google'),
};

// --- Projects API ---
export const projectsApi = {
  list: (page = 1) => api.get(`/projects?page=${page}`),

  create: (name: string) => api.post('/projects', { name }),

  get: (uuid: string) => api.get(`/projects/${uuid}`),

  update: (uuid: string, data: { name?: string }) =>
    api.put(`/projects/${uuid}`, data),

  delete: (uuid: string) => api.delete(`/projects/${uuid}`),

  duplicate: (uuid: string) => api.post(`/projects/${uuid}/duplicate`),

  uploadVideo: (uuid: string, file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('video', file);
    return api.post(`/projects/${uuid}/video`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
  },

  getVideoUrl: (uuid: string) => `${API_BASE}/projects/${uuid}/video`,

  getThumbnailUrl: (uuid: string) => `${API_BASE}/projects/${uuid}/thumbnail`,

  render: (uuid: string) => api.post(`/projects/${uuid}/render`),

  renderStatus: (uuid: string) => api.get(`/projects/${uuid}/render-status`),

  getDownloadUrl: (uuid: string) => `${API_BASE}/projects/${uuid}/download`,
};

// --- Overlays API ---
export const overlaysApi = {
  list: (projectUuid: string) => api.get(`/projects/${projectUuid}/overlays`),

  create: (projectUuid: string, data: FormData) =>
    api.post(`/projects/${projectUuid}/overlays`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (projectUuid: string, overlayUuid: string, data: Record<string, unknown>) =>
    api.put(`/projects/${projectUuid}/overlays/${overlayUuid}`, data),

  delete: (projectUuid: string, overlayUuid: string) =>
    api.delete(`/projects/${projectUuid}/overlays/${overlayUuid}`),

  reorder: (projectUuid: string, order: string[]) =>
    api.put(`/projects/${projectUuid}/overlays/reorder`, { order }),

  addFromAsset: (projectUuid: string, assetUuid: string) =>
    api.post(`/projects/${projectUuid}/overlays/from-asset`, { asset_uuid: assetUuid }),

  getFileUrl: (overlayUuid: string) => `${API_BASE}/overlays/${overlayUuid}/file`,
};

// --- Assets API ---
export const assetsApi = {
  list: () => api.get('/assets'),

  system: () => api.get('/assets/system'),

  upload: (file: File, name?: string, category?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (category) formData.append('category', category);
    return api.post('/assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  delete: (uuid: string) => api.delete(`/assets/${uuid}`),

  getFileUrl: (uuid: string) => `${API_BASE}/assets/${uuid}/file`,
  getThumbnailUrl: (uuid: string) => `${API_BASE}/assets/${uuid}/thumbnail`,
};

// --- Subscription API ---
export const subscriptionApi = {
  current: () => api.get('/subscription'),

  plans: () => api.get('/plans'),

  checkout: (plan: string) => api.post('/subscription/checkout', { plan }),

  portal: () => api.get('/subscription/portal'),
};

export default api;
