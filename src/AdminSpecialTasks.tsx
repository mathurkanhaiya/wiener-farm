import React from 'react';

export function AdminSpecialTasks({ say }: { say: (s: string) => void }) {
  return (
    <section className="card">
      <div className="eyebrow">ADMIN TOOL</div>
      <h3>Special Partner Tasks</h3>
      <p style={{ fontSize: 13, opacity: 0.7 }}>Manage high-yield partner drops and sponsored campaigns.</p>
    </section>
  );
}
