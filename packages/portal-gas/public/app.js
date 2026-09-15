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
