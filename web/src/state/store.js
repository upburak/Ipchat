import { create } from 'zustand';

const LS_SERVER_URL = 'ipchat.serverUrl';
const LS_DEVICE_TOKEN = 'ipchat.deviceToken';
const LS_USERNAME = 'ipchat.username';

export const useStore = create((set, get) => ({
  serverUrl: localStorage.getItem(LS_SERVER_URL) || '',
  deviceToken: localStorage.getItem(LS_DEVICE_TOKEN) || '',
  rememberedUsername: localStorage.getItem(LS_USERNAME) || '',

  token: '',
  currentUser: null, // { id, username }

  contacts: [], // [{id, username, online}]
  groups: [], // [{id, name, members}]
  presence: {}, // { [userId]: boolean }

  activeConversation: null, // { type: 'user'|'group', id, name }
  messages: {}, // { 'user:5': [...], 'group:2': [...] }

  setServerUrl: (url) => {
    localStorage.setItem(LS_SERVER_URL, url);
    set({ serverUrl: url });
  },

  setSession: ({ userId, username, token }) => {
    set({ currentUser: { id: userId, username }, token });
  },

  setAuthPending: ({ token }) => {
    set({ token });
  },

  setDeviceToken: (deviceToken, username) => {
    localStorage.setItem(LS_DEVICE_TOKEN, deviceToken);
    localStorage.setItem(LS_USERNAME, username);
    set({ deviceToken, rememberedUsername: username });
  },

  clearDevice: () => {
    localStorage.removeItem(LS_DEVICE_TOKEN);
    localStorage.removeItem(LS_USERNAME);
    set({ deviceToken: '', rememberedUsername: '' });
  },

  logout: () => set({ token: '', currentUser: null, contacts: [], groups: [], messages: {}, activeConversation: null }),

  setContacts: (contacts) => set({ contacts }),
  setGroups: (groups) => set({ groups }),

  setPresence: (userId, online) =>
    set((state) => ({
      presence: { ...state.presence, [userId]: online },
      contacts: state.contacts.map((c) => (c.id === userId ? { ...c, online } : c)),
    })),

  setActiveConversation: (conversation) => set({ activeConversation: conversation }),

  conversationKey: (conversation) => `${conversation.type}:${conversation.id}`,

  setMessages: (key, msgs) =>
    set((state) => ({ messages: { ...state.messages, [key]: msgs } })),

  appendMessage: (message) =>
    set((state) => {
      const key =
        message.recipient_type === 'user'
          ? `user:${message.sender_id === get().currentUser?.id ? message.recipient_id : message.sender_id}`
          : `group:${message.recipient_id}`;
      const existing = state.messages[key] || [];
      return { messages: { ...state.messages, [key]: [...existing, message] } };
    }),

  upsertGroup: (group) =>
    set((state) => {
      const idx = state.groups.findIndex((g) => g.id === group.id);
      if (idx === -1) return { groups: [...state.groups, group] };
      const groups = [...state.groups];
      groups[idx] = group;
      return { groups };
    }),
}));
