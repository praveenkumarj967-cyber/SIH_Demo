import React, { useState, useEffect, useRef } from "react";
import { api, authHeader } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import DocumentCanvas from "../components/DocumentCanvas.jsx";
import { downloadDocumentImage } from "../utils/documentArt.js";

export default function OfficialPortal() {
  const { official, setOfficial } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

  const login = async (e) => {
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
        <form className="auth-card" onSubmit={login}>
          <h1>Official Console</h1>
          <p className="tagline">Consolidated, consent-gated view of citizen records.</p>
          <label>Username</label>
          <input className="text-input" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label>Password</label>
          <input className="text-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {loginError && <div className="form-error">{loginError}</div>}
          <button className="btn-primary full-width" type="submit">Sign in</button>
          <p className="hint">Demo login: officer1 / Officer@123</p>
        </form>
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
