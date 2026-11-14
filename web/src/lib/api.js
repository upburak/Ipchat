import { useStore } from '../state/store.js';

async function request(pathname, { method = 'GET', body, auth = false, isForm = false } = {}) {
  const { serverUrl, token } = useStore.getState();
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${serverUrl}${pathname}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) {
      useStore.getState().logout('Oturumun sonlandırıldı. Lütfen tekrar giriş yap.');
    }
    throw new Error(data.error || 'İstek başarısız');
  }
  return data;
}

export const api = {
  register: (username, password) => request('/api/register', { method: 'POST', body: { username, password } }),
  login: (username, password) => request('/api/login', { method: 'POST', body: { username, password } }),
  loginWithPin: (deviceToken, pin) => request('/api/login-pin', { method: 'POST', body: { deviceToken, pin } }),
  setPin: (pin) => request('/api/pin/set', { method: 'POST', body: { pin }, auth: true }),
  me: () => request('/api/me', { auth: true }),

  adminPendingCount: () => request('/api/admin/pending-count', { auth: true }),
  adminListUsers: () => request('/api/admin/users', { auth: true }),
  adminAction: (id, action) => request(`/api/admin/users/${id}/${action}`, { method: 'POST', auth: true }),

  listUsers: () => request('/api/users', { auth: true }),
  listGroups: () => request('/api/groups', { auth: true }),
  listUnread: () => request('/api/unread', { auth: true }),
  markRead: (type, id) => request('/api/read', { method: 'POST', body: { type, id }, auth: true }),
  listMessages: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/messages?${qs}`, { auth: true });
  },

  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/upload', { method: 'POST', body: form, auth: true, isForm: true });
  },
};
