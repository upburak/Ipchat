import { useState } from 'react';
import { useStore } from '../state/store.js';
import GroupCreateModal from './GroupCreateModal.jsx';
import { initial, avatarColor } from '../lib/avatar.js';

export default function ContactList() {
  const { contacts, groups, activeConversation, setActiveConversation, unread } = useStore();
  const [showGroupModal, setShowGroupModal] = useState(false);

  return (
    <div className="contact-list">
      <div className="section">
        <div className="section-header">
          <span>Kişiler</span>
        </div>
        {contacts.map((c) => (
          <button
            key={c.id}
            className={`contact-item ${activeConversation?.type === 'user' && activeConversation.id === c.id ? 'active' : ''} ${unread[`user:${c.id}`] > 0 ? 'unread' : ''}`}
            onClick={() => setActiveConversation({ type: 'user', id: c.id, name: c.username })}
          >
            <span className="avatar" style={{ background: avatarColor(c.username) }}>
              {initial(c.username)}
              <span className={`status-dot ${c.online ? 'online' : 'offline'}`} />
            </span>
            <span className="contact-name">{c.username}</span>
            {unread[`user:${c.id}`] > 0 && <span className="unread-dot" />}
          </button>
        ))}
      </div>

      <div className="section">
        <div className="section-header">
          <span>Gruplar</span>
          <button className="link" onClick={() => setShowGroupModal(true)}>
            + Yeni
          </button>
        </div>
        {groups.map((g) => (
          <button
            key={g.id}
            className={`contact-item ${activeConversation?.type === 'group' && activeConversation.id === g.id ? 'active' : ''} ${unread[`group:${g.id}`] > 0 ? 'unread' : ''}`}
            onClick={() => setActiveConversation({ type: 'group', id: g.id, name: g.name })}
          >
            <span className="avatar" style={{ background: avatarColor(g.name) }}>
              #
            </span>
            <span className="contact-name">{g.name}</span>
            {unread[`group:${g.id}`] > 0 && <span className="unread-dot" />}
          </button>
        ))}
      </div>

      {showGroupModal && <GroupCreateModal onClose={() => setShowGroupModal(false)} />}
    </div>
  );
}
