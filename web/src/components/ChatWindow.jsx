import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.js';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';
import { initial, avatarColor } from '../lib/avatar.js';

export default function ChatWindow() {
  const { activeConversation, messages, setMessages, markConversationRead, conversationKey, currentUser, serverUrl } = useStore();
  const key = conversationKey(activeConversation);
  const list = messages[key] || [];
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const params =
      activeConversation.type === 'user' ? { withUser: activeConversation.id } : { withGroup: activeConversation.id };
    api
      .listMessages(params)
      .then((msgs) => {
        setMessages(key, msgs);
        return api.markRead(activeConversation.type, activeConversation.id);
      })
      .then(() => markConversationRead(key))
      .catch(() => {});
  }, [key]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length]);

  function sendMessage(body, file) {
    getSocket().emit('message:send', {
      recipientType: activeConversation.type,
      recipientId: activeConversation.id,
      body: body || null,
      fileUrl: file?.url,
      fileName: file?.fileName,
      fileType: file?.fileType,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text.trim());
    setText('');
  }

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.upload(file);
      sendMessage('', result);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="chat-window"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="chat-header">
        <span className="avatar small" style={{ background: avatarColor(activeConversation.name) }}>
          {activeConversation.type === 'group' ? '#' : initial(activeConversation.name)}
        </span>
        {activeConversation.name}
      </div>

      <div className="message-list">
        {list.map((m) => (
          <div key={m.id} className={`message ${m.sender_id === currentUser.id ? 'own' : ''}`}>
            {m.body && <p>{m.body}</p>}
            {m.file_url && m.file_type?.startsWith('image/') && (
              <img src={`${serverUrl}${m.file_url}`} alt={m.file_name} className="message-image" />
            )}
            {m.file_url && !m.file_type?.startsWith('image/') && (
              <a href={`${serverUrl}${m.file_url}`} target="_blank" rel="noreferrer">
                📎 {m.file_name}
              </a>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {dragOver && <div className="drop-hint">Dosyayı buraya bırak</div>}

      <form className="composer" onSubmit={handleSubmit}>
        <label className="attach-btn">
          📎
          <input type="file" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mesaj yaz…"
          disabled={uploading}
        />
        <button type="submit" disabled={uploading}>
          Gönder
        </button>
      </form>
    </div>
  );
}
