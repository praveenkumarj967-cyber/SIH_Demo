async function bookCylinder() {
  const consumerId = document.getElementById("bookConsumer").value.trim().toUpperCase();
  const resultEl = document.getElementById("bookResult");
  resultEl.textContent = "Booking...";
  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumerId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    resultEl.textContent = `Booked! Booking ID: ${data.bookingId} (status: ${data.status})`;
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}

async function checkBookings() {
  const consumerId = document.getElementById("statusConsumer").value.trim().toUpperCase();
  const resultEl = document.getElementById("statusResult");
  resultEl.textContent = "Checking...";
  try {
    const res = await fetch(`/api/bookings/${consumerId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.bookings.length === 0) {
      resultEl.textContent = "No bookings found for this consumer ID.";
      return;
    }
    resultEl.innerHTML = data.bookings
      .map((b) => `<div class="row">Booking ${b.id.slice(0, 8)} — ₹${b.amount} — <span class="badge">${b.status}</span></div>`)
      .join("");
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}

let currentDocMode = "photo"; // "photo" | "vault"
let uploadedPhotoData = null;
let verifiedVaultDoc = null;

function switchDocMode(mode) {
  currentDocMode = mode;
  document.getElementById("btnOptPhoto").classList.toggle("active", mode === "photo");
  document.getElementById("btnOptVault").classList.toggle("active", mode === "vault");
  document.getElementById("sectionPhotoUpload").style.display = mode === "photo" ? "block" : "none";
  document.getElementById("sectionVaultFetch").style.display = mode === "vault" ? "block" : "none";
}

function handleDocPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    uploadedPhotoData = { fileName: file.name, dataUrl: e.target.result };
    document.getElementById("photoFileName").textContent = file.name;
    document.getElementById("photoImgPreview").src = e.target.result;
    document.getElementById("photoPreviewContainer").style.display = "flex";
  };
  reader.readAsDataURL(file);
}

async function requestVaultDocOtp() {
  const mobileNumber = document.getElementById("appMobile").value.trim();
  const statusEl = document.getElementById("vaultDocStatus");
  if (!mobileNumber || mobileNumber.length !== 10) {
    statusEl.innerHTML = `<span style="color:#dc2626;">Please enter a valid 10-digit mobile number above first.</span>`;
    return;
  }
  statusEl.innerHTML = `Requesting OTP from DigiVault...`;
  try {
    const res = await fetch("http://localhost:4000/api/documents/direct-fetch-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileNumber, documentType: "AADHAR" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    let devOtp = "";
    try {
      const inboxRes = await fetch(`http://localhost:4000/api/dev/inbox/${mobileNumber}`);
      const inboxData = await inboxRes.json();
      if (inboxData.messages?.length > 0) {
        const match = inboxData.messages[0].message.match(/\b\d{6}\b/);
        if (match) devOtp = match[0];
      }
    } catch (err) {
      console.warn("Dev inbox fetch error", err);
    }

    statusEl.innerHTML = `
      <div style="margin-top:10px; background:#fff; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">
        <div style="font-size:13px; color:#059669; font-weight:600; margin-bottom:8px;">${data.message}</div>
        <input id="vaultOtpInput" placeholder="Enter 6-digit OTP" value="${devOtp}" maxlength="6" style="margin-bottom:8px;" />
        <button class="btn-primary" type="button" onclick="verifyVaultDocOtp('${mobileNumber}')">Verify OTP & Retrieve Document</button>
      </div>
    `;
  } catch (err) {
    statusEl.innerHTML = `<span style="color:#dc2626;">Error: ${err.message}</span>`;
  }
}

async function verifyVaultDocOtp(mobileNumber) {
  const otp = document.getElementById("vaultOtpInput")?.value?.trim();
  const statusEl = document.getElementById("vaultDocStatus");
  if (!otp || otp.length !== 6) {
    alert("Enter the 6-digit OTP.");
    return;
  }
  statusEl.innerHTML = `Verifying OTP with DigiVault...`;
  try {
    const res = await fetch("http://localhost:4000/api/documents/direct-fetch-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileNumber, documentType: "AADHAR", otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    verifiedVaultDoc = data.document;
    statusEl.innerHTML = `
      <div class="verified-badge">
        ✓ DigiVault Verified Document: ${data.document.label} (${data.document.value})
      </div>
      <button class="btn-secondary" type="button" style="margin-top:8px; background:#0284c7;" onclick="verifyWithUidai()">🛡️ Verify with UIDAI e-KYC Server</button>
    `;
  } catch (err) {
    statusEl.innerHTML = `<span style="color:#dc2626;">Error: ${err.message}</span>`;
  }
}

async function verifyWithUidai() {
  const mobileNumber = document.getElementById("appMobile").value.trim();
  const statusEl = document.getElementById("vaultDocStatus");
  statusEl.innerHTML = `Connecting to UIDAI Central e-KYC Server...`;
  try {
    const res = await fetch("http://localhost:4101/api/verify-aadhar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileNumber }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    statusEl.innerHTML = `
      <div class="verified-badge" style="background:#eff6ff; color:#1d4ed8; border-color:#93c5fd;">
        🛡️ UIDAI e-KYC Certified (${data.uidaiReference}): Aadhar ${data.record.aadharNumber} (${data.record.name})
      </div>
    `;
  } catch (err) {
    statusEl.innerHTML = `<span style="color:#dc2626;">UIDAI Verification Error: ${err.message}</span>`;
  }
}

async function submitGasApplication() {
  const name = document.getElementById("appName").value.trim();
  const mobile = document.getElementById("appMobile").value.trim();
  const resultEl = document.getElementById("appResult");

  if (!name || !mobile) {
    resultEl.innerHTML = `<span style="color:#dc2626;">Please enter applicant name and mobile number.</span>`;
    return;
  }

  if (currentDocMode === "photo" && !uploadedPhotoData) {
    resultEl.innerHTML = `<span style="color:#dc2626;">Please select and attach a document photo file.</span>`;
    return;
  }

  if (currentDocMode === "vault" && !verifiedVaultDoc) {
    resultEl.innerHTML = `<span style="color:#dc2626;">Please fetch and verify your document from DigiVault via OTP first.</span>`;
    return;
  }

  const docSource = currentDocMode === "vault"
    ? `🔐 DigiVault OTP Verified (${verifiedVaultDoc.label}: ${verifiedVaultDoc.value})`
    : `📷 Attached Photo File (${uploadedPhotoData.fileName})`;

  resultEl.innerHTML = `
    <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:12px; padding:16px; margin-top:12px;">
      <h3 style="margin:0 0 6px; color:#166534; font-size:16px;">🎉 Application Submitted Successfully!</h3>
      <p style="margin:4px 0; font-size:14px;"><strong>Application Reference:</strong> GAS-APP-${Math.floor(100000 + Math.random() * 900000)}</p>
      <p style="margin:4px 0; font-size:14px;"><strong>Applicant:</strong> ${name} (${mobile})</p>
      <p style="margin:4px 0; font-size:14px;"><strong>Identity Document Source:</strong> ${docSource}</p>
    </div>
  `;
}
