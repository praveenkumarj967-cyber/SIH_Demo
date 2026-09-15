async function checkStatus() {
  const panNumber = document.getElementById("statusPan").value.trim().toUpperCase();
  const resultEl = document.getElementById("statusResult");
  resultEl.textContent = "Checking...";
  try {
    const res = await fetch(`/api/status/${panNumber}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.requests.length === 0) {
      resultEl.textContent = "No correction requests found for this PAN.";
      return;
    }
    resultEl.innerHTML = data.requests
      .map((r) => `<div class="row"><strong>${r.field}</strong> → "${r.newValue}" — <span class="badge">${r.status}</span></div>`)
      .join("");
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}

async function submitUpdate() {
  const panNumber = document.getElementById("updatePan").value.trim().toUpperCase();
  const field = document.getElementById("field").value;
  const newValue = document.getElementById("newValue").value.trim();
  const resultEl = document.getElementById("updateResult");
  resultEl.textContent = "Submitting...";
  try {
    const res = await fetch("/api/update-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panNumber, field, newValue }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    resultEl.textContent = `Request submitted. Reference ID: ${data.requestId} (status: ${data.status})`;
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}
