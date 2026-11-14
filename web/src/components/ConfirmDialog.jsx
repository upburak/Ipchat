import { useEffect, useRef } from 'react';
import { dialogOutcome } from '../lib/dialog.js';

export default function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Yalnizca acilista calisir: ust bilesen her 3 sn yeniden cizilse de odak calinmaz.
  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e) {
      if (dialogOutcome({ key: e.key }) === 'cancel') onCancelRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onOverlayClick(e) {
    if (dialogOutcome({ isBackdrop: e.target === e.currentTarget }) === 'cancel') onCancel();
  }

  return (
    <div className="modal-overlay" onClick={onOverlayClick}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={message}>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions confirm-actions">
          <button type="button" className="btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="btn-primary" ref={cancelRef} onClick={onCancel}>
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
