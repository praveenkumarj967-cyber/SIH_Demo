import jwt from "jsonwebtoken";
import { createRateLimiter } from "@govstack/shared";

const JWT_SECRET = process.env.JWT_SECRET;

export function issueToken(payload, expiresIn = "15m") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function requireAuth(role) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (role && payload.role !== role) {
        return res.status(403).json({ error: "You do not have permission to perform this action." });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired session token." });
    }
  };
}

export const otpRequestLimiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
export const otpVerifyLimiter = createRateLimiter({ max: 8, windowMs: 10 * 60 * 1000 });
