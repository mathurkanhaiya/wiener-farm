import React from 'react';

export function Splash({ text = 'Opening your farm…' }: { text?: string }) {
  return (
    <div className="wf-boot">
      <div className="wf-boot-core">
        <div className="wf-boot-emblem">
          <div className="wf-boot-orbit">
            <i />
            <i />
            <i />
          </div>
          <div className="wf-boot-mark">
            <b>W</b>
            <span>FARM</span>
          </div>
        </div>
        <div className="wf-boot-wordmark">
          <strong>WIENER</strong>
          <b>FARM</b>
        </div>
        <div className="wf-boot-tagline">EARN · GROW · WITHDRAW</div>
        <div className="wf-boot-status">{text}</div>
        <div className="wf-boot-track">
          <i />
        </div>
        <div className="wf-boot-secure">SECURE TELEGRAM MINI APP</div>
      </div>
      <div className="wf-boot-ambient">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
