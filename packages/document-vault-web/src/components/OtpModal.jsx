import React, { useState } from "react";
import { motion } from "framer-motion";

export default function OtpModal({ title, subtitle, onSubmit, onClose, onResend, error, devOtp }) {
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(otp);
    setSubmitting(false);
  };

  return (
    <div className="modal-backdrop">
      <motion.div
        className="modal-card"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
      >
        <h3>{title}</h3>
        <p className="modal-subtitle">{subtitle}</p>
        <form onSubmit={handleSubmit}>
          <input
            className="otp-input"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          {error && <div className="form-error">{error}</div>}
          {devOtp && (
            <div className="dev-hint">Dev inbox OTP: <strong>{devOtp}</strong></div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            {onResend && (
              <button type="button" className="btn-secondary" onClick={onResend}>Resend OTP</button>
            )}
            <button type="submit" className="btn-primary" disabled={otp.length !== 6 || submitting}>
              {submitting ? "Verifying..." : "Verify"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
