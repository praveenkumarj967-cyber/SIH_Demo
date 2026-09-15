import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

/** AES-256-GCM encrypt. keyHex must be a 64 hex-char (32 byte) key. */
export function encrypt(plainText, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(payload, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Masks all but the last `visibleTail` characters, e.g. "1234 5678 9012" -> "XXXX XXXX 9012". */
export function maskValue(value, visibleTail = 4) {
  const clean = String(value).replace(/\s+/g, "");
  const tail = clean.slice(-visibleTail);
  const hidden = "X".repeat(Math.max(clean.length - visibleTail, 0));
  return `${hidden}${tail}`.replace(/(.{4})/g, "$1 ").trim();
}

export function generateOtp(length = 6) {
  let otp = "";
  for (let i = 0; i < length; i += 1) otp += crypto.randomInt(0, 10);
  return otp;
}

export function newSalt() {
  return crypto.randomBytes(8).toString("hex");
}

/** OTPs are never stored in plain text, only as a salted hash. */
export function hashOtp(otp, salt) {
  return crypto.createHash("sha256").update(`${salt}:${otp}`).digest("hex");
}

export function verifyOtpHash(otp, salt, expectedHash) {
  return hashOtp(otp, salt) === expectedHash;
}
