import { useEffect } from 'react';

export function useReferralHome(active: boolean) {
  useEffect(() => {
    if (!active) return;
    // Log or check referral bonus notification if applicable
  }, [active]);
}
