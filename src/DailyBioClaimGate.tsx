import React, { useState } from 'react';
import type { Snapshot } from './lib';
import { api } from './lib';

export function DailyBioClaimGate({
  open,
  data,
  run,
  onClose,
  successMessage,
}: {
  open: boolean;
  data: Snapshot;
  run: any;
  onClose: () => void;
  successMessage: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const botUser = String(data.settings?.bot_username || 'WienerDogeFarmBot').replace('@', '');
  const refLink = `t.me/${botUser}?startapp=ref_${data.user?.telegram_id || ''}`;

  const copyBio = async () => {
    try {
      await navigator.clipboard.writeText(`🌭 Wiener Farm · ${refLink}`);
    } catch {}
  };

  const checkAndClaim = async () => {
    try {
      setBusy(true);
      setError('');
      await api('daily_bio_check');
      await run('daily_claim', {}, successMessage);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Bio verification pending. Please add Wiener Farm to your Telegram bio.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reward-modal-backdrop" onClick={onClose}>
      <div className="reward-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reward-modal-icon">🌭</div>
        <h2>Add to Telegram Bio</h2>
        <p style={{ fontSize: 13, opacity: 0.75, margin: '8px 0 16px', lineHeight: 1.4 }}>
          Add Wiener Farm to your Telegram profile bio to unlock your consecutive loyalty streak bonus.
        </p>
        <div style={{ background: 'rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: 12, marginBottom: 14, fontSize: 12, wordBreak: 'break-all' }}>
          🌭 Wiener Farm · {refLink}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="secondary small" onClick={copyBio} style={{ flex: 1 }}>
            📋 COPY BIO
          </button>
          <button className="primary small" disabled={busy} onClick={checkAndClaim} style={{ flex: 1.5 }}>
            {busy ? 'CHECKING…' : 'VERIFY & CLAIM'}
          </button>
        </div>
        {error && <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 6 }}>{error}</div>}
        <button className="secondary" onClick={onClose} style={{ marginTop: 10, width: '100%', minHeight: 38 }}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
