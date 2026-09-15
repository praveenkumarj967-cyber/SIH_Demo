# GovStack — Cross-Department Interoperability Platform (Prototype)

A working prototype of a **secure, standards-based interoperability framework** for
government services: a centralized citizen **document vault** with OTP-gated,
consent-based access; four independent **department portals** (Aadhar, PAN, Gas,
Electricity) simulating legacy/modern siloed systems; a set of **MCP connectors**
that expose each portal's APIs as reusable tools; and a **unified chatbot**
("Nagrik Mitra") that talks to all departments through those connectors so a
citizen never has to visit multiple portals or repeat the same information.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how each requirement in the
problem statement maps to a concrete component.

## Services

| Service | Package | Port | Description |
|---|---|---|---|
| Document Vault API | `@govstack/document-vault-api` | 4000 | OTP auth, encrypted document storage, masking, consent workflow, audit log |
| Document Vault Web | `@govstack/document-vault-web` | 5173 | Citizen + official UI with envelope unlock animation |
| Aadhar Portal | `@govstack/portal-aadhar` | 4101 | Dummy legacy-style Aadhar self-service portal |
| PAN Portal | `@govstack/portal-pan` | 4102 | Dummy legacy-style PAN self-service portal |
| Gas Portal | `@govstack/portal-gas` | 4103 | Dummy LPG cylinder booking portal |
| Electricity Portal | `@govstack/portal-electricity` | 4104 | Dummy electricity bill payment portal |
| MCP Servers | `@govstack/mcp-servers` | (stdio) | One MCP server per portal, spawned on demand |
| Chatbot API | `@govstack/chatbot-api` | 4200 | Rule-based NLU + session + MCP orchestration |
| Chatbot Web | `@govstack/chatbot-web` | 5174 | "Nagrik Mitra" unified chat UI |

All backend services are plain Node.js/Express with a shared `@govstack/shared`
library (JSON-file storage, AES-256-GCM encryption, OTP hashing, audit logging,
validators, rate limiting) — no native database drivers required, so `npm install`
works out of the box on any machine with Node 18+.

## Quick start

```powershell
npm install         # installs every workspace package
npm run seed         # seeds demo data (citizens, documents, official account)
npm run dev          # starts all 8 services concurrently
```

Then open:
- Citizen Vault: http://localhost:5173
- Official Console: http://localhost:5173/official
- Aadhar Portal: http://localhost:4101
- PAN Portal: http://localhost:4102
- Gas Portal: http://localhost:4103
- Electricity Portal: http://localhost:4104
- Chatbot: http://localhost:5174

### Demo credentials
- Citizen mobile numbers: `9876543210` (Asha Rao) or `9123456780` (Ravi Kumar)
- Official login: `officer1` / `Officer@123`

### About OTPs (mock SMS gateway)
There is no live SMS gateway wired up (no third-party credentials were provided),
so OTPs are delivered to a **mock inbox** instead of a real phone. In development
mode the Vault/Chatbot web apps automatically read the most recent OTP from this
mock inbox so the demo works end-to-end without extra steps. In production you
would replace `sendMockSms()` in `document-vault-api/src/store.js` with a real
gateway (Twilio, MSG91, etc.) — no other code changes are required.

## Demo script

1. **Citizen Vault**: Log in with `9876543210`, select 2–3 documents (e.g. Aadhar +
   PAN), click "Unlock" — a single OTP unlocks all selected documents, each
   animating out of its sealed envelope, then auto re-masking after 30s.
2. **Official Console**: Log in as `officer1`, search `9876543210`, select a
   document, request consent with a reason. Switch to the Vault tab as the
   citizen, approve the pending consent request with an OTP — the official's
   screen updates automatically once approved (consent-based data sharing).
3. **Portals**: Submit an Aadhar address-correction request directly on the
   Aadhar portal (http://localhost:4101) and watch its status progress from
   `PENDING` → `IN_REVIEW` → `APPROVED` over ~30 seconds.
4. **Chatbot**: Open http://localhost:5174, enter `9876543210`, then try:
   - "Check my Aadhar status"
   - "Update my PAN address to 221B Baker Street"
   - "Book a gas cylinder"
   - "Check my electricity bill" → "Pay my electricity bill"
   - "Track all my applications" (fans out to all 4 departments in parallel)

## Architecture highlights

- **Master data / common identifier**: mobile number is the cross-department
  join key. Each portal exposes `/api/lookup/:mobileNumber` so any connector can
  resolve a citizen's department-specific ID (Aadhar/PAN/consumer numbers)
  without the citizen re-entering it anywhere.
- **API-based exchange & reusable connectors**: every portal is a plain REST
  API; the MCP servers in `packages/mcp-servers` wrap those REST APIs as typed,
  reusable tools that any MCP-compatible client (this chatbot, or e.g. Claude
  Desktop / VS Code) can call without bespoke integration code.
- **Consent-based data sharing**: officials never see unmasked data without an
  explicit citizen-approved, OTP-confirmed consent request (`routes.documents.js`,
  `routes.official.js` in the Vault API).
- **Security**: documents are AES-256-GCM encrypted at rest, OTPs are salted +
  hashed (never stored/logged in plain text), JWT-based sessions, per-mobile
  rate limiting on OTP requests, and role-based access (`citizen` vs `official`).
- **Audit logs & monitoring**: every sensitive action (OTP issuance, document
  reveal, consent approval, official access, chatbot tool calls) is written to
  an append-only audit log, viewable from the Official Console.
- **Exception handling**: the chatbot's "track all" flow uses
  `Promise.allSettled` so one department being down never blocks the others —
  it just reports that department as temporarily unavailable.

## Project structure

```
packages/
  shared/                  reusable library: storage, crypto, OTP, audit, validators
  document-vault-api/      citizen document vault backend
  document-vault-web/      citizen + official vault UI (React + framer-motion)
  portal-aadhar/           dummy Aadhar portal (API + legacy-style UI)
  portal-pan/              dummy PAN portal
  portal-gas/              dummy LPG gas booking portal
  portal-electricity/      dummy electricity billing portal
  mcp-servers/             MCP tool servers wrapping each portal's API
  chatbot-api/             NLU + dialog manager + MCP client orchestration
  chatbot-web/             "Nagrik Mitra" chat UI
```

## Notes & future enhancements

This is a functional prototype, not a production system. For a real rollout you
would additionally want: a proper OIDC/SAML federated identity provider instead
of vault-issued JWTs, a message broker (Kafka/RabbitMQ) for true event-driven
notifications across departments, a managed database per service (Postgres),
horizontal scaling + centralized logging (ELK), a real SMS/OTP gateway, and a
formal data-exchange standard (e.g. India's DEPA/API Setu conventions) governing
each connector's schema.
