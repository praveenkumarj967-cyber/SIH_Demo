import { v4 as uuid } from "uuid";
import { generateOtp, newSalt, hashOtp, verifyOtpHash } from "@govstack/shared";
import { otpStore } from "./store.js";

const OTP_TTL_MS = Number(process.env.OTP_TTL_MS || 5 * 60 * 1000);

/** Creates and persists a hashed OTP for a given purpose (LOGIN / REVEAL / CONSENT_APPROVE). */
export function createOtp(mobileNumber, purpose, meta = {}) {
  const otp = generateOtp(6);
  const salt = newSalt();
  const record = {
    id: uuid(),
    mobileNumber,
    purpose,
    otpHash: hashOtp(otp, salt),
    salt,
    expiresAt: Date.now() + OTP_TTL_MS,
    consumed: false,
    attempts: 0,
    meta,
    createdAt: new Date().toISOString(),
  };
  otpStore.update((data) => {
    data.otps.push(record);
  });
  return { id: record.id, otp };
}

/** Verifies against the most recent, unconsumed OTP for this mobile+purpose. */
export function verifyOtp(mobileNumber, purpose, otp) {
  return otpStore.update((data) => {
    const candidates = data.otps
      .filter((o) => o.mobileNumber === mobileNumber && o.purpose === purpose && !o.consumed)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const record = candidates[0];
    if (!record) return { ok: false, reason: "No active OTP request found. Please request a new OTP." };
    if (Date.now() > record.expiresAt) return { ok: false, reason: "OTP has expired. Please request a new one." };
    if (record.attempts >= 5) return { ok: false, reason: "Too many incorrect attempts. Please request a new OTP." };
    record.attempts += 1;
    const valid = verifyOtpHash(otp, record.salt, record.otpHash);
    if (!valid) return { ok: false, reason: "Incorrect OTP. Please try again." };
    record.consumed = true;
    return { ok: true, meta: record.meta };
  });
}
