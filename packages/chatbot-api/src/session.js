const sessions = new Map();

export function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, { mobileNumber: null, pending: null, history: [] });
  }
  return sessions.get(id);
}

export function resetSession(id) {
  sessions.delete(id);
}
