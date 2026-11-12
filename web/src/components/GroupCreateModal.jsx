import { useState } from 'react';
import { useStore } from '../state/store.js';
import { getSocket } from '../lib/socket.js';

export default function GroupCreateModal({ onClose }) {
  const contacts = useStore((s) => s.contacts);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || selected.length === 0) {
      setError('Grup adı ve en az bir üye seç');
      return;
    }
    getSocket().emit('group:create', { name, memberUserIds: selected }, (res) => {
      if (res?.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Yeni grup</h2>
        <form onSubmit={handleCreate}>
          <input placeholder="Grup adı" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="member-list">
            {contacts.map((c) => (
              <label key={c.id} className="member-item">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.username}
              </label>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="link" onClick={onClose}>
              İptal
            </button>
            <button type="submit">Oluştur</button>
          </div>
        </form>
      </div>
    </div>
  );
}
