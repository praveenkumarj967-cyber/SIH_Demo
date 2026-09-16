import React, { useState, useEffect, useRef } from "react";
import { api, authHeader } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import DocumentCanvas from "../components/DocumentCanvas.jsx";
import { downloadDocumentImage } from "../utils/documentArt.js";

export default function OfficialPortal() {
  const { official, setOfficial } = useAuth();
  const [loginMode, setLoginMode] = useState("otp"); // "otp" or "password"
  const [username, setUsername] = useState("officer1");
  const [password, setPassword] = useState("Officer@123");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpInfo, setOtpInfo] = useState("");
  const [loginError, setLoginError] = useState("");

  const [mobileNumber, setMobileNumber] = useState("");
  const [citizenProfile, setCitizenProfile] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [reason, setReason] = useState("");
  const [consentRequestId, setConsentRequestId] = useState(null);
  const [consentStatus, setConsentStatus] = useState(null);
  const [revealedDocs, setRevealedDocs] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const requestOtp = async (e) => {
    e?.preventDefault();
    setLoginError("");
    setOtpInfo("");
    try {
      const { data } = await api.post("/api/official/request-otp", { identifier: username });
      setOtpSent(true);
      setOtpInfo(data.message);

      // Auto check inbox in dev mode
      try {
        const { data: inbox } = await api.get(`/api/dev/inbox/${data.mobileNumber || "9876543210"}`);
        if (inbox.messages?.length > 0) {
          const match = inbox.messages[0].message.match(/\b\d{6}\b/);
          if (match) setOtp(match[0]);
        }
      } catch (err) {
        console.warn("Dev inbox check failed", err);
      }
    } catch (err) {
      setLoginError(err.response?.data?.error || "Failed to request OTP.");
    }
  };

  const loginWithOtp = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const { data } = await api.post("/api/official/verify-otp", { identifier: username, otp });
      setOfficial({ token: data.token, name: data.name, department: data.department });
    } catch (err) {
      setLoginError(err.response?.data?.error || "OTP Verification failed.");
    }
  };

  const loginWithPassword = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const { data } = await api.post("/api/official/login", { username, password });
      setOfficial({ token: data.token, name: data.name, department: data.department });
    } catch (err) {
      setLoginError(err.response?.data?.error || "Login failed.");
    }
  };

  const searchCitizen = async () => {
    setError("");
    setCitizenProfile(null);
    setRevealedDocs(null);
    setConsentStatus(null);
    try {
      const { data } = await api.get(`/api/official/citizen/${mobileNumber}`, authHeader(official.token));
      setCitizenProfile(data);
    } catch (err) {
      setError(err.response?.data?.error || "Citizen not found.");
    }
  };

  const requestConsent = async () => {
    setError("");
    try {
      const { data } = await api.post(
        "/api/official/consent-request",
        { mobileNumber, documentIds: [...selected], reason },
        authHeader(official.token)
      );
      setConsentRequestId(data.requestId);
      setConsentStatus("PENDING");
    } catch (err) {
      setError(err.response?.data?.error || "Could not create consent request.");
    }
  };

  useEffect(() => {
    if (!consentRequestId || revealedDocs) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/official/consent-request/${consentRequestId}`, authHeader(official.token));
        setConsentStatus(data.status);
        if (data.status === "APPROVED") {
          setRevealedDocs(data.documents);
          clearInterval(pollRef.current);
        } else if (["DENIED", "EXPIRED"].includes(data.status)) {
          clearInterval(pollRef.current);
        }
      } catch {
        clearInterval(pollRef.current);
      }
    }, 2500);
    return () => clearInterval(pollRef.current);
  }, [consentRequestId, revealedDocs]);

  const loadAuditLog = async () => {
    const { data } = await api.get("/api/official/audit-log", authHeader(official.token));
    setAuditLog(data.entries);
  };

  if (!official) {
    return (
      <div className="page-center">
        <div className="auth-card">
          <h1>Official Console</h1>
          <p className="tagline">Consolidated, consent-gated view of citizen records.</p>
          
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              className={loginMode === "otp" ? "btn-primary" : "btn-secondary"}
              style={{ flex: 1 }}
              onClick={() => setLoginMode("otp")}
            >
              📲 OTP Login
            </button>
            <button
              type="button"
              className={loginMode === "password" ? "btn-primary" : "btn-secondary"}
              style={{ flex: 1 }}
              onClick={() => setLoginMode("password")}
            >
              🔑 Password Login
            </button>
          </div>

          {loginMode === "otp" ? (
            <form onSubmit={otpSent ? loginWithOtp : requestOtp}>
              <label>Official Username / Mobile</label>
              <input
                className="text-input"
                placeholder="officer1 or registered mobile"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {otpSent && (
                <>
                  <label style={{ marginTop: "12px" }}>Enter 6-Digit OTP</label>
                  <input
                    className="text-input"
                    placeholder="Enter OTP"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  />
                </>
              )}
              {otpInfo && <div style={{ color: "#059669", fontSize: "0.875rem", marginTop: "8px" }}>{otpInfo}</div>}
              {loginError && <div className="form-error">{loginError}</div>}
              <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                {!otpSent ? (
                  <button className="btn-primary full-width" type="submit">
                    Send OTP
                  </button>
                ) : (
                  <>
                    <button className="btn-primary" style={{ flex: 1 }} type="submit">
                      Verify OTP & Sign In
                    </button>
                    <button className="btn-secondary" type="button" onClick={requestOtp}>
                      Resend OTP
                    </button>
                  </>
                )}
              </div>
              <p className="hint" style={{ marginTop: "12px" }}>Demo official: officer1 or 9876543210</p>
            </form>
          ) : (
            <form onSubmit={loginWithPassword}>
              <label>Username</label>
              <input className="text-input" value={username} onChange={(e) => setUsername(e.target.value)} />
              <label style={{ marginTop: "8px" }}>Password</label>
              <input className="text-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {loginError && <div className="form-error">{loginError}</div>}
              <button className="btn-primary full-width" style={{ marginTop: "16px" }} type="submit">Sign in</button>
              <p className="hint" style={{ marginTop: "12px" }}>Demo login: officer1 / Officer@123</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <h2>Official Console</h2>
        <div>
          <span className="welcome-text">{official.name} · {official.department}</span>
          <button className="btn-secondary" onClick={() => setOfficial(null)}>Logout</button>
        </div>
      </header>

      <div className="official-grid">
        <section className="panel">
          <h3>Look up citizen</h3>
          <input
            className="text-input"
            placeholder="Citizen mobile number"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
          />
          <button className="btn-primary" onClick={searchCitizen}>Search</button>
          {error && <div className="form-error">{error}</div>}

          {citizenProfile && (
            <div className="citizen-card">
              <h4>{citizenProfile.name}</h4>
              <ul className="doc-list">
                {citizenProfile.documents.map((d) => (
                  <li key={d.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            next.has(d.id) ? next.delete(d.id) : next.add(d.id);
                            return next;
                          })
                        }
                      />
                      {d.label} <span className="masked">{d.maskedPreview}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <input
                className="text-input"
                placeholder="Reason for access (e.g. subsidy eligibility check)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button className="btn-primary" disabled={selected.size === 0 || !reason} onClick={requestConsent}>
                Request citizen consent
              </button>

              {consentStatus && (
                <div className="consent-status">
                  Status: <strong>{consentStatus}</strong>
                  {consentStatus === "PENDING" && " — waiting for citizen to approve in their Vault app..."}
                  {consentStatus === "AWAITING_OTP" && " — citizen is confirming with OTP..."}
                </div>
              )}

              {revealedDocs && (
                <div className="revealed-box">
                  <h4>Consented documents</h4>
                  <div className="revealed-doc-grid">
                    {revealedDocs.map((d) => (
                      <div key={d.id} className="revealed-doc-item">
                        <DocumentCanvas type={d.type} label={d.label} value={d.value} citizenName={citizenProfile.name} />
                        <button
                          className="btn-secondary download-btn"
                          onClick={() => downloadDocumentImage({ type: d.type, label: d.label, value: d.value, citizenName: citizenProfile.name })}
                        >
                          ⬇ Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <h3>Audit log</h3>
          <button className="btn-secondary" onClick={loadAuditLog}>Refresh</button>
          <div className="audit-log">
            {auditLog.map((entry) => (
              <div key={entry.id} className="audit-row">
                <span className="audit-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="audit-action">{entry.action}</span>
                <span className="audit-actor">{entry.actor}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
