async function checkStatus() {
  const aadharNumber = document.getElementById("statusAadhar").value.trim();
  const resultEl = document.getElementById("statusResult");
  resultEl.textContent = "Checking...";
  try {
    const res = await fetch(`/api/status/${aadharNumber}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.requests.length === 0) {
      resultEl.textContent = "No update requests found for this Aadhar number.";
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
  const aadharNumber = document.getElementById("updateAadhar").value.trim();
  const field = document.getElementById("field").value;
  const newValue = document.getElementById("newValue").value.trim();
  const resultEl = document.getElementById("updateResult");
  resultEl.textContent = "Submitting...";
  try {
    const res = await fetch("/api/update-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aadharNumber, field, newValue }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    resultEl.textContent = `Request submitted. Reference ID: ${data.requestId} (status: ${data.status})`;
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}
