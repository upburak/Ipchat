import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.js';
import { api } from '../lib/api.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';
import ContactList from '../components/ContactList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import AdminPanel from '../components/AdminPanel.jsx';
import {
  conversationKeyOf,
  totalUnread,
  pageTitle,
  shouldNotify,
  shouldCoalesce,
  notificationFor,
} from '../lib/unread.js';
import { mergeContacts, trackPending, notificationText, startPoller } from '../lib/polling.js';

export default function ChatApp() {
  const {
    serverUrl,
    token,
    currentUser,
    setContacts,
    setGroups,
    setPresence,
    clearPresence,
    pendingCount,
    setPendingCount,
    appendMessage,
    upsertGroup,
    activeConversation,
    logout,
  } = useStore();

  const [showAdmin, setShowAdmin] = useState(false);
  const lastNotifiedAt = useRef({});

  useEffect(() => {
    const socket = connectSocket(serverUrl, token);

    const reflectUnread = (counts) => {
      window.ipchat?.setUnread?.(totalUnread(counts));
      document.title = pageTitle(totalUnread(counts));
    };

    // Pencere yeniden odaklanınca açık sohbet okundu sayılır.
    const markActiveRead = () => {
      if (!document.hasFocus()) return;
      const state = useStore.getState();
      const active = state.activeConversation;
      if (!active) return;
      const key = state.conversationKey(active);
      api.markRead(active.type, active.id).catch(() => {});
      state.markConversationRead(key);
      reflectUnread(useStore.getState().unread);
    };
    window.addEventListener('focus', markActiveRead);
    document.addEventListener('visibilitychange', markActiveRead);

    const dropToLogin = () => logout('Oturumun sonlandırıldı. Lütfen tekrar giriş yap.');
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') dropToLogin();
    });
    socket.on('connect_error', (err) => {
      if (err.message === 'Yetkisiz') dropToLogin();
    });
    socket.on('presence:update', ({ userId, online }) => setPresence(userId, online));
    socket.on('message:new', (message) => {
      appendMessage(message);
      const state = useStore.getState();
      const myId = state.currentUser?.id;
      if (message.sender_id === myId) return;
      const key = conversationKeyOf(message, myId);
      const activeKey = state.activeConversation ? state.conversationKey(state.activeConversation) : null;
      if (shouldNotify({ message, myId, activeKey, focused: document.hasFocus() })) {
        const now = Date.now();
        if (!shouldCoalesce(lastNotifiedAt.current[key], now)) {
          const sender = state.contacts.find((c) => c.id === message.sender_id);
          window.ipchat?.notify?.(notificationFor(message, sender?.username || 'Ipchat', myId));
          lastNotifiedAt.current[key] = now;
        }
        state.bumpUnread(key);
        reflectUnread(useStore.getState().unread);
      } else {
        api.markRead(message.recipient_type, message.recipient_type === 'group' ? message.recipient_id : message.sender_id).catch(() => {});
        state.markConversationRead(key);
      }
    });
    socket.on('group:created', (group) => upsertGroup(group));

    api.listUsers().then(setContacts).catch(() => {});
    api.listGroups().then(setGroups).catch(() => {});

    const stopContacts = startPoller(async (isStopped) => {
      const users = await api.listUsers();
      if (isStopped()) return;
      setContacts(mergeContacts(users, useStore.getState().presence));
      clearPresence();
      const counts = await api.listUnread();
      if (isStopped()) return;
      useStore.getState().setUnread(counts);
      reflectUnread(counts);
    });

    const stopOpenConversation = window.ipchat?.onOpenConversation?.(({ type, id }) => {
      const { contacts, groups } = useStore.getState();
      const found = type === 'group' ? groups.find((g) => g.id === id) : contacts.find((c) => c.id === id);
      const name = (type === 'group' ? found?.name : found?.username) || String(id);
      useStore.getState().setActiveConversation({ type, id, name });
    });

    let stopPending = null;
    if (currentUser?.isAdmin) {
      let seen = new Set();
      let first = true;
      stopPending = startPoller(async (isStopped) => {
        const { count, latest } = await api.adminPendingCount();
        if (isStopped()) return;
        setPendingCount(count);
        const result = trackPending(seen, latest, first);
        seen = result.seen;
        first = false;
        if (result.fresh.length > 0) window.ipchat?.notify?.(notificationText(result.fresh));
        window.ipchat?.setBadge?.(count);
      });
      window.ipchat?.onOpenAdmin?.(() => setShowAdmin(true));
    }

    return () => {
      window.removeEventListener('focus', markActiveRead);
      document.removeEventListener('visibilitychange', markActiveRead);
      stopContacts();
      if (typeof stopOpenConversation === 'function') stopOpenConversation();
      if (stopPending) stopPending();
      window.ipchat?.setBadge?.(0);
      window.ipchat?.setUnread?.(0);
      document.title = 'Ipchat';
      disconnectSocket();
    };
  }, []);

  return (
    <div className="chat-app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <strong>{currentUser?.username}</strong>
          <span>
            {currentUser?.isAdmin && (
              <button className="link" onClick={() => setShowAdmin(!showAdmin)}>
                Hesaplar
                {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
              </button>
            )}{' '}
            <button className="link" onClick={() => logout()}>
              Çıkış
            </button>
          </span>
        </div>
        <ContactList />
      </aside>
      <main className="main">
        {showAdmin ? (
          <AdminPanel />
        ) : activeConversation ? (
          <ChatWindow />
        ) : (
          <div className="empty-state">Sohbet başlatmak için soldan birini seç</div>
        )}
      </main>
    </div>
  );
}
