import React, { useState } from 'react';

export function AdminMiniAppTaskCreator({ say }: { say: (s: string) => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  return (
    <section className="card">
      <div className="eyebrow">ADMIN TOOL</div>
      <h3>Mini App Task Creator</h3>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <input placeholder="Task Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Telegram Link or URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="primary"
          onClick={() => {
            if (!title.trim()) return;
            say(`Task "${title}" scheduled`);
            setTitle('');
            setUrl('');
          }}
        >
          SAVE TASK
        </button>
      </div>
    </section>
  );
}
