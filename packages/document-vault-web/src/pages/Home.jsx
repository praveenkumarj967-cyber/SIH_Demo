import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, fetchDevInbox, DEV_MODE } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import OtpModal from "../components/OtpModal.jsx";

export default function Home() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [stage, setStage] = useState("mobile"); // mobile | otp
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const { setCitizen } = useAuth();
  const navigate = useNavigate();

  const requestOtp = async () => {
    setError("");
    setInfo("");
    setDevOtp(null);
    try {
      const { data } = await api.post("/api/auth/request-otp", { mobileNumber });
      setInfo(data.message);
      setStage("otp");
      if (DEV_MODE) {
        const messages = await fetchDevInbox(mobileNumber).catch(() => []);
        const match = messages[0]?.message?.match(/\b\d{6}\b/);
        if (match) setDevOtp(match[0]);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    }
  };

  const verifyOtp = async (otp) => {
    setError("");
    try {
      const { data } = await api.post("/api/auth/verify-otp", { mobileNumber, otp });
      setCitizen({ token: data.token, name: data.name, mobileNumber: data.mobileNumber });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed.");
    }
  };

  return (
    <div className="page-center">
      <motion.div className="auth-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1>DigiVault</h1>
        <p className="tagline">Your government documents, one secure link — no photocopies, no repeated submissions.</p>

        {stage === "mobile" && (
          <>
            <label>Registered mobile number</label>
            <input
              className="text-input"
              inputMode="numeric"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
            />
            {error && <div className="form-error">{error}</div>}
            <button className="btn-primary full-width" onClick={requestOtp} disabled={mobileNumber.length !== 10}>
              Send OTP
            </button>
            <p className="hint">Try demo number 9876543210 or 9123456780</p>
          </>
        )}

        {stage === "otp" && (
          <OtpModal
            title="Verify your mobile number"
            subtitle={info}
            error={error}
            devOtp={devOtp}
            onSubmit={verifyOtp}
            onClose={() => setStage("mobile")}
            onResend={requestOtp}
          />
        )}
      </motion.div>
    </div>
  );
}
