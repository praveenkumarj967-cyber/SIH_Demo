import { Router } from "express";
import { isValidMobile, isValidOtp } from "@govstack/shared";
import { usersStore, auditLogger, sendMockSms } from "./store.js";
import { createOtp, verifyOtp } from "./otpService.js";
import { issueToken, otpRequestLimiter, otpVerifyLimiter } from "./middleware.js";

const router = Router();

router.post("/request-otp", (req, res) => {
  const { mobileNumber } = req.body || {};
  if (!isValidMobile(mobileNumber)) {
    return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });
  }
  if (!otpRequestLimiter.check(mobileNumber)) {
    return res.status(429).json({ error: "Too many OTP requests. Please try again in a few minutes." });
  }
  const { users } = usersStore.read();
  const user = users.find((u) => u.mobileNumber === mobileNumber);
  if (!user) {
    auditLogger.log({ actor: mobileNumber, action: "LOGIN_OTP_REQUESTED", target: mobileNumber, result: "NOT_REGISTERED" });
    return res.status(404).json({ error: "No vault is registered for this mobile number." });
  }
  const { otp } = createOtp(mobileNumber, "LOGIN");
  sendMockSms(mobileNumber, `Your Document Vault login OTP is ${otp}. Valid for 5 minutes. Do not share this OTP with anyone.`);
  auditLogger.log({ actor: mobileNumber, action: "LOGIN_OTP_REQUESTED", target: mobileNumber });
  res.json({ success: true, message: "An OTP has been sent to your registered mobile number." });
});

router.post("/verify-otp", (req, res) => {
  const { mobileNumber, otp } = req.body || {};
  if (!isValidMobile(mobileNumber) || !isValidOtp(otp)) {
    return res.status(400).json({ error: "Enter the 6-digit OTP sent to your mobile number." });
  }
  if (!otpVerifyLimiter.check(mobileNumber)) {
    return res.status(429).json({ error: "Too many attempts. Please request a new OTP shortly." });
  }
  const result = verifyOtp(mobileNumber, "LOGIN", otp);
  if (!result.ok) {
    auditLogger.log({ actor: mobileNumber, action: "LOGIN_FAILED", target: mobileNumber, result: "FAILURE", meta: { reason: result.reason } });
    return res.status(401).json({ error: result.reason });
  }
  const { users } = usersStore.read();
  const user = users.find((u) => u.mobileNumber === mobileNumber);
  const token = issueToken({ sub: mobileNumber, role: "citizen", name: user.name });
  auditLogger.log({ actor: mobileNumber, action: "LOGIN_SUCCESS", target: mobileNumber });
  res.json({ token, name: user.name, mobileNumber });
});

export default router;
