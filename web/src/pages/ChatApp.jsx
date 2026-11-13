import { useEffect, useState } from 'react';
import { useStore } from '../state/store.js';
import { api } from '../lib/api.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';
import ContactList from '../components/ContactList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import AdminPanel from '../components/AdminPanel.jsx';

export default function ChatApp() {
  const {
    serverUrl,
    token,
    currentUser,
    setContacts,
    setGroups,
    setPresence,
    appendMessage,
    upsertGroup,
    activeConversation,
    logout,
  } = useStore();

  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const socket = connectSocket(serverUrl, token);

    const dropToLogin = () => logout('Oturumun sonlandırıldı. Lütfen tekrar giriş yap.');
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') dropToLogin();
    });
    socket.on('connect_error', (err) => {
      if (err.message === 'Yetkisiz') dropToLogin();
    });
    socket.on('presence:update', ({ userId, online }) => setPresence(userId, online));
    socket.on('message:new', (message) => appendMessage(message));
    socket.on('group:created', (group) => upsertGroup(group));

    api.listUsers().then(setContacts).catch(() => {});
    api.listGroups().then(setGroups).catch(() => {});

    return () => disconnectSocket();
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
