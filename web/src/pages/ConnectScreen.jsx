import { useState } from 'react';
import { useStore } from '../state/store.js';

function normalizeUrl(value) {
  let url = value.trim();
  if (!/^https?:\/\//.test(url)) url = `http://${url}`;
  return url.replace(/\/$/, '');
}

export default function ConnectScreen({ onConnected }) {
  const setServerUrl = useStore((s) => s.setServerUrl);
  const [value, setValue] = useState('http://localhost:3000');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleConnect(e) {
    e.preventDefault();
    setError('');
    const url = normalizeUrl(value);
    setChecking(true);
    try {
      const res = await fetch(`${url}/api/users`, { headers: { Authorization: 'Bearer x' } });
      if (res.status !== 401 && !res.ok) throw new Error('Sunucuya ulaşılamadı');
      setServerUrl(url);
      onConnected();
    } catch (err) {
      setError('Sunucuya bağlanılamadı. IP:port doğru mu, sunucu çalışıyor mu?');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="screen">
      <div className="card">
        <h1>Ipchat</h1>
        <p className="subtitle">Sunucunun yerel ağ adresini gir</p>
        <form onSubmit={handleConnect}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="192.168.1.10:3000"
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={checking}>
            {checking ? 'Bağlanıyor…' : 'Bağlan'}
          </button>
        </form>
      </div>
    </div>
  );
}
