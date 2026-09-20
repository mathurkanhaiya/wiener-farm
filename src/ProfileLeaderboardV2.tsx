import React from 'react';
import type { Snapshot } from './lib';
import { LeaderboardPage, ProfilePage } from './pages';

export function LeaderboardPageV2({ data }: { data: Snapshot }) {
  return <LeaderboardPage data={data} />;
}

export function ProfilePageV2({ data, setTab }: { data: Snapshot; setTab: (t: any) => void }) {
  return <ProfilePage data={data} setTab={setTab} />;
}
