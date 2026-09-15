async function checkBill() {
  const consumerNumber = document.getElementById("billConsumer").value.trim().toUpperCase();
  const resultEl = document.getElementById("billResult");
  resultEl.textContent = "Checking...";
  try {
    const res = await fetch(`/api/bill/${consumerNumber}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    resultEl.innerHTML = `Amount due: ₹${data.amount} — Due date: ${data.dueDate} — <span class="badge">${data.status}</span>`;
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}

async function payBill() {
  const consumerNumber = document.getElementById("payConsumer").value.trim().toUpperCase();
  const amount = Number(document.getElementById("payAmount").value);
  const resultEl = document.getElementById("payResult");
  resultEl.textContent = "Processing payment...";
  try {
    const res = await fetch("/api/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumerNumber, amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    resultEl.textContent = `Payment successful! ₹${data.receipt.amount} paid at ${new Date(data.receipt.paidAt).toLocaleString()}`;
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}
