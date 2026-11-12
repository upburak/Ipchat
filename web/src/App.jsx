import { useEffect, useState } from 'react';
import { useStore } from './state/store.js';
import ConnectScreen from './pages/ConnectScreen.jsx';
import LoginScreen from './pages/LoginScreen.jsx';
import ChatApp from './pages/ChatApp.jsx';

export default function App() {
  const { serverUrl, currentUser, setServerUrl } = useStore();
  const [connected, setConnected] = useState(Boolean(serverUrl));
  const [checking, setChecking] = useState(!serverUrl);

  // Sayfa sunucunun kendisinden servis ediliyorsa (production, tek port)
  // IP sormaya gerek yok: kendi origin'imiz zaten sunucudur.
  useEffect(() => {
    if (serverUrl) return;
    fetch(`${window.location.origin}/api/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.app === 'ipchat') {
          setServerUrl(window.location.origin);
          setConnected(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!connected) return <ConnectScreen onConnected={() => setConnected(true)} />;
  if (!currentUser) return <LoginScreen onLoggedIn={() => {}} />;
  return <ChatApp />;
}
