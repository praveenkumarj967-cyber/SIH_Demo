import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendChatMessage } from "./api.js";

const QUICK_ACTIONS = [
  "Check my Aadhar status",
  "Check my PAN status",
  "Book a gas cylinder",
  "Check my electricity bill",
  "Pay my electricity bill",
  "Track all my applications",
];

function getSessionId() {
  let id = sessionStorage.getItem("chatbot.sessionId");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("chatbot.sessionId", id);
  }
  return id;
}

export default function App() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileConfirmed, setMobileConfirmed] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hello! I am Nagrik Mitra, your unified government services assistant. Please enter your registered mobile number to get started." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sessionId = useRef(getSessionId());
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const confirmMobile = () => {
    if (!/^[6-9]\d{9}$/.test(mobileNumber)) return;
    setMobileConfirmed(true);
    setMessages((prev) => [...prev, { role: "bot", text: `Thanks! I have linked mobile ${mobileNumber} for this session. How can I help you today?` }]);
  };

  const send = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    try {
      const data = await sendChatMessage(sessionId.current, mobileConfirmed ? mobileNumber : undefined, trimmed);
      setMessages((prev) => [...prev, { role: "bot", text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Sorry, I could not reach the assistant service. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-shell">
      <header className="chat-header">
        <h1>🏛️ Nagrik Mitra</h1>
        <p>One assistant for Aadhar, PAN, Gas &amp; Electricity services</p>
      </header>

      {!mobileConfirmed && (
        <motion.div className="mobile-gate" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <input
            className="text-input"
            placeholder="Registered mobile number"
            maxLength={10}
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && confirmMobile()}
          />
          <button className="btn-primary" onClick={confirmMobile} disabled={mobileNumber.length !== 10}>Continue</button>
          <p className="hint">Try demo number 9876543210 or 9123456780</p>
        </motion.div>
      )}

      <div className="chat-window">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              className={`bubble ${m.role}`}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {m.text.split("\n").map((line, j) => (
                <div key={j}>{line}</div>
              ))}
            </motion.div>
          ))}
          {sending && (
            <motion.div
              key="typing"
              className="bubble bot typing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              Thinking
              <span className="typing-dots"><span /><span /><span /></span>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {mobileConfirmed && (
        <div className="quick-actions">
          {QUICK_ACTIONS.map((q, i) => (
            <motion.button
              key={q}
              className="chip"
              onClick={() => send(q)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              {q}
            </motion.button>
          ))}
        </div>
      )}

      <div className="chat-input-bar">
        <input
          className="text-input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn-primary" onClick={() => send()} disabled={sending}>Send</button>
      </div>
    </div>
  );
}
