// Permanent Fraud Registry — persists in localStorage
// Once flagged, the rider is permanently marked until manually cleared by admin

const KEY = 'rideshield_fraud_registry';

export const getFraudRecord = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; }
  catch { return null; }
};

export const isFlagged = () => !!getFraudRecord();

export const flagRider = (reason, details = {}) => {
  const existing = getFraudRecord();
  const record = {
    flaggedAt: existing?.flaggedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reasons: [...(existing?.reasons || []), reason],
    details: { ...existing?.details, ...details },
    strikeCount: (existing?.strikeCount || 0) + 1,
    status: 'RED_FLAG',
  };
  localStorage.setItem(KEY, JSON.stringify(record));
  return record;
};

export const clearFraudRecord = () => localStorage.removeItem(KEY);
