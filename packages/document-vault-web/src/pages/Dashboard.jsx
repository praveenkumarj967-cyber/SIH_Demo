import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, authHeader, fetchDevInbox, DEV_MODE } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import EnvelopeCard from "../components/EnvelopeCard.jsx";
import OtpModal from "../components/OtpModal.jsx";

const REVEAL_SECONDS = 30;

export default function Dashboard() {
  const { citizen, setCitizen } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [revealed, setRevealed] = useState({}); // id -> { value, countdown }
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const timers = useRef({});

  useEffect(() => {
    if (!citizen) {
      navigate("/");
      return;
    }
    api
      .get("/api/documents", authHeader(citizen.token))
      .then(({ data }) => setDocuments(data.documents))
      .catch(() => setError("Failed to load documents."));
  }, [citizen]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const requestReveal = async () => {
    setError("");
    setDevOtp(null);
    try {
      await api.post("/api/documents/reveal-request", { documentIds: [...selected] }, authHeader(citizen.token));
      setModalOpen(true);
      if (DEV_MODE) {
        const messages = await fetchDevInbox(citizen.mobileNumber).catch(() => []);
        const match = messages[0]?.message?.match(/\b\d{6}\b/);
        if (match) setDevOtp(match[0]);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Could not request OTP.");
    }
  };

  const confirmReveal = async (otp) => {
    setError("");
    try {
      const { data } = await api.post(
        "/api/documents/reveal-confirm",
        { otp, documentIds: [...selected] },
        authHeader(citizen.token)
      );
      setModalOpen(false);
      const nextRevealed = { ...revealed };
      data.documents.forEach((doc) => {
        nextRevealed[doc.id] = { value: doc.value, countdown: data.revealTtlSeconds };
        startCountdown(doc.id, data.revealTtlSeconds);
      });
      setRevealed(nextRevealed);
      setSelected(new Set());
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed.");
    }
  };

  const startCountdown = (id, seconds) => {
    clearInterval(timers.current[id]);
    let remaining = seconds;
    timers.current[id] = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timers.current[id]);
        setRevealed((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        setRevealed((prev) => ({ ...prev, [id]: { ...prev[id], countdown: remaining } }));
      }
    }, 1000);
  };

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newType, setNewType] = useState("AADHAR");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUploadAndVerify = async (e) => {
    e.preventDefault();
    setUploadError("");
    setUploadStatus("");
    if (!newValue.trim()) {
      setUploadError("Enter the document number/value.");
      return;
    }
    setUploading(true);
    setUploadStatus("Connecting to central issuer registry (UIDAI / Income Tax)...");
    try {
      const { data } = await api.post(
        "/api/documents/upload",
        { type: newType, label: newLabel || `${newType} Card`, value: newValue.trim() },
        authHeader(citizen.token)
      );
      setUploadStatus(`✓ Verified via ${data.verification?.badge || "Issuer"}!`);
      // Reload documents
      const docsRes = await api.get("/api/documents", authHeader(citizen.token));
      setDocuments(docsRes.data.documents);
      setTimeout(() => {
        setAddModalOpen(false);
        setNewValue("");
        setUploadStatus("");
        setUploading(false);
      }, 1200);
    } catch (err) {
      setUploading(false);
      setUploadStatus("");
      setUploadError(err.response?.data?.error || "Verification failed.");
    }
  };

  const logout = () => {
    setCitizen(null);
    navigate("/");
  };

  return (
    <div className="page">
      <header className="topbar">
        <h2>DigiVault</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span className="welcome-text">Hello, {citizen?.name}</span>
          <button className="btn-primary" onClick={() => setAddModalOpen(true)}>+ Add / Verify Document</button>
          <button className="btn-secondary" onClick={logout}>Logout</button>
        </div>
      </header>

      <p className="hint">Select one or more sealed documents and unlock them all with a single OTP.</p>
      {error && <div className="form-error">{error}</div>}

      <div className="envelope-grid">
        {documents.map((doc, i) => (
          <EnvelopeCard
            key={doc.id}
            doc={doc}
            index={i}
            selected={selected.has(doc.id)}
            onToggleSelect={toggleSelect}
            revealedValue={revealed[doc.id]?.value}
            countdown={revealed[doc.id]?.countdown}
            citizenName={citizen?.name}
          />
        ))}
      </div>

      <div className="action-bar">
        <button className="btn-primary" disabled={selected.size === 0} onClick={requestReveal}>
          Unlock {selected.size > 0 ? `${selected.size} document(s)` : ""} with OTP
        </button>
      </div>

      {addModalOpen && (
        <div className="modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <h2>➕ Add & Live Verify Document</h2>
            <p className="tagline">Every uploaded document is verified live against UIDAI / Department servers before insertion into your Vault.</p>
            <form onSubmit={handleUploadAndVerify}>
              <label>Document Type</label>
              <select className="text-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
                <option value="AADHAR">Aadhar Card (Verifies with UIDAI Central Server)</option>
                <option value="PAN">PAN Card (Verifies with Income Tax Dept)</option>
                <option value="DRIVING_LICENSE">Driving Licence</option>
                <option value="MARKSHEET">10th Marksheet</option>
              </select>

              <label style={{ marginTop: "10px" }}>Document Label</label>
              <input
                className="text-input"
                placeholder="e.g. Aadhar Card"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />

              <label style={{ marginTop: "10px" }}>Document Number / Value</label>
              <input
                className="text-input"
                placeholder={newType === "AADHAR" ? "1234 5678 9012" : "ABCDE1234F"}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />

              {uploadStatus && <div style={{ color: "#0284c7", fontSize: "0.875rem", marginTop: "10px", fontWeight: "600" }}>{uploadStatus}</div>}
              {uploadError && <div className="form-error" style={{ marginTop: "10px" }}>{uploadError}</div>}

              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button className="btn-primary" style={{ flex: 1 }} type="submit" disabled={uploading}>
                  {uploading ? "Verifying..." : "Upload & Verify with Issuer"}
                </button>
                <button className="btn-secondary" type="button" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalOpen && (
        <OtpModal
          title="Unlock documents"
          subtitle={`A single OTP was sent to ${citizen.mobileNumber} for all selected documents.`}
          error={error}
          devOtp={devOtp}
          onSubmit={confirmReveal}
          onClose={() => setModalOpen(false)}
          onResend={requestReveal}
        />
      )}
    </div>
  );
}
