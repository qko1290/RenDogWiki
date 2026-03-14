'use client';

import { useEffect } from 'react';

export default function Track() {
  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      cache: 'no-store',
    }).catch(() => {});
  }, []);

  return null;
}
