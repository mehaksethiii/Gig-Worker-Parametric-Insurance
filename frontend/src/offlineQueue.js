// Offline claim queue — stores claims locally when offline, syncs when back online

const QUEUE_KEY = 'offlineClaimQueue';

export const queueClaim = (claim) => {
  const queue = getQueue();
  queue.push({ ...claim, queuedAt: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const getQueue = () => {
  const q = localStorage.getItem(QUEUE_KEY);
  return q ? JSON.parse(q) : [];
};

export const clearQueue = () => localStorage.removeItem(QUEUE_KEY);

export const syncOfflineClaims = async (token) => {
  const queue = getQueue();
  if (!queue.length) return { synced: 0 };

  try {
    const res = await fetch('https://gig-worker-parametric-insurance.onrender.com/api/claims/sync-offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ offlineClaims: queue }),
    });
    if (res.ok) {
      clearQueue();
      return await res.json();
    }
  } catch (_) {}
  return { synced: 0 };
};

// Auto-sync when connection is restored
export const watchOnline = (token, onSync) => {
  const handler = async () => {
    const result = await syncOfflineClaims(token);
    if (result.synced > 0) onSync(result);
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
};
