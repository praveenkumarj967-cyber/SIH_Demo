import { JsonStore } from "./jsonStore.js";

/**
 * Append-only audit trail shared by every service. Never pass raw sensitive
 * values (OTPs, decrypted document contents) into `meta` - log identifiers
 * and outcomes only.
 */
export function createAuditLogger(filePath) {
  const store = new JsonStore(filePath, { entries: [] });

  return {
    log({ actor, action, target, result = "SUCCESS", meta = {} }) {
      store.update((data) => {
        data.entries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          actor,
          action,
          target,
          result,
          meta,
        });
        if (data.entries.length > 5000) data.entries.shift();
      });
    },
    recent(limit = 100) {
      const { entries } = store.read();
      return entries.slice(-limit).reverse();
    },
  };
}
