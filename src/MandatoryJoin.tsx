import React, { useState } from 'react';

export async function checkMandatoryAccess() {
  return { all_joined: true, items: [] };
}

export function MandatoryGate({ initial, onUnlocked }: { initial: any; onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="center-screen" style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
      <h2>Join Official Channels</h2>
      <p style={{ opacity: 0.7, margin: '8px 0 20px', lineHeight: 1.5 }}>
        Join our official community channel to unlock Wiener Farm.
      </p>
      <a
        href="https://t.me/WienerDogeFarmBot"
        target="_blank"
        rel="noreferrer"
        className="primary linkbtn"
        style={{ display: 'inline-block', marginBottom: 12 }}
      >
        JOIN COMMUNITY
      </a>
      <button className="secondary" disabled={busy} onClick={onUnlocked} style={{ width: '100%' }}>
        VERIFY JOIN
      </button>
    </div>
  );
}
