/** Common data-standard validators shared across all connected departments. */
export const isValidMobile = (m) => /^[6-9]\d{9}$/.test(String(m || ""));
export const isValidAadhar = (a) => /^\d{12}$/.test(String(a || "").replace(/\s+/g, ""));
export const isValidPan = (p) => /^[A-Z]{5}\d{4}[A-Z]$/.test(String(p || "").toUpperCase());
export const isValidOtp = (o) => /^\d{6}$/.test(String(o || ""));
