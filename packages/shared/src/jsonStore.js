import fs from "node:fs";
import path from "node:path";

/**
 * Minimal file-backed JSON store used to simulate each department's own
 * database without requiring native drivers. Reads/writes are synchronous
 * and atomic (write-to-temp then rename) which is sufficient for this
 * prototype's request volume.
 */
export class JsonStore {
  constructor(filePath, defaultData = {}) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
  }

  read() {
    return JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
  }

  write(data) {
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  /** Read -> mutate -> write in one step, returns whatever the mutator returns. */
  update(mutatorFn) {
    const data = this.read();
    const result = mutatorFn(data);
    this.write(data);
    return result;
  }

  isEmpty(collectionKey) {
    const data = this.read();
    const collection = data[collectionKey];
    return !Array.isArray(collection) || collection.length === 0;
  }
}
