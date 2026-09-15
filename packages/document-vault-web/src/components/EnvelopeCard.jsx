import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import DocumentCanvas from "./DocumentCanvas.jsx";
import { downloadDocumentImage } from "../utils/documentArt.js";

const TYPE_ICONS = {
  AADHAR: "🇮🇳",
  PAN: "🧾",
  DRIVING_LICENSE: "🚗",
  MARKSHEET: "🎓",
};

/**
 * Renders a document as a sealed envelope. When `revealedValue` is provided
 * the flap opens to reveal a document-type-accurate ID card, downloadable as a PNG.
 */
export default function EnvelopeCard({ doc, index = 0, selected, onToggleSelect, revealedValue, countdown, citizenName }) {
  const isRevealed = Boolean(revealedValue);

  const handleDownload = () => {
    downloadDocumentImage({ type: doc.type, label: doc.label, value: revealedValue, citizenName });
  };

  return (
    <motion.div
      className={`envelope-card ${selected ? "selected" : ""} ${isRevealed ? "is-open" : ""}`}
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -6 }}
    >
      <label className="envelope-select">
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(doc.id)} disabled={isRevealed} />
        <span>{TYPE_ICONS[doc.type] || "📄"} {doc.label}</span>
      </label>

      <div className="envelope">
        <motion.div
          className="envelope-flap"
          animate={{ rotateX: isRevealed ? -170 : 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        <div className="envelope-shadow-body" />
        <div className="envelope-body">
          <AnimatePresence mode="wait">
            {isRevealed ? (
              <motion.div
                key="card"
                className="revealed-card"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: -30, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
              >
                <DocumentCanvas type={doc.type} label={doc.label} value={revealedValue} citizenName={citizenName} />
                {countdown != null && <div className="countdown">Re-masking in {countdown}s</div>}
              </motion.div>
            ) : (
              <motion.div key="mask" className="masked-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {doc.maskedPreview}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isRevealed && (
        <button className="btn-secondary download-btn" onClick={handleDownload}>
          ⬇ Download
        </button>
      )}
    </motion.div>
  );
}
