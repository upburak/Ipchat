import { useEffect } from 'react';
import { useStore } from '../state/store.js';
import { api } from '../lib/api.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';
import ContactList from '../components/ContactList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';

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

  useEffect(() => {
    const socket = connectSocket(serverUrl, token);

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
          <button className="link" onClick={logout}>
            Çıkış
          </button>
        </div>
        <ContactList />
      </aside>
      <main className="main">
        {activeConversation ? <ChatWindow /> : <div className="empty-state">Sohbet başlatmak için soldan birini seç</div>}
      </main>
    </div>
  );
}
