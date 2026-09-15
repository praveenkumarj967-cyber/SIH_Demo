import { consumersStore, billsStore } from "./store.js";

export function seed() {
  if (!consumersStore.isEmpty("consumers")) {
    console.log("[portal-electricity] Data already seeded, skipping.");
    return;
  }
  consumersStore.update((data) => {
    data.consumers.push(
      { mobileNumber: "9876543210", consumerNumber: "EL5001", name: "Asha Rao", address: "12 MG Road, Bengaluru" },
      { mobileNumber: "9123456780", consumerNumber: "EL5002", name: "Ravi Kumar", address: "45 Anna Salai, Chennai" }
    );
  });
  const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  billsStore.update((data) => {
    data.bills.push(
      { consumerNumber: "EL5001", amount: 842, dueDate, status: "UNPAID", history: [] },
      { consumerNumber: "EL5002", amount: 1210, dueDate, status: "UNPAID", history: [] }
    );
  });
  console.log("[portal-electricity] Seed data created.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
