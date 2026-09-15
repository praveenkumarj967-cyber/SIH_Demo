import { consumersStore } from "./store.js";

export function seed() {
  if (!consumersStore.isEmpty("consumers")) {
    console.log("[portal-gas] Data already seeded, skipping.");
    return;
  }
  consumersStore.update((data) => {
    data.consumers.push(
      { mobileNumber: "9876543210", consumerId: "GC1001", name: "Asha Rao", address: "12 MG Road, Bengaluru", connectionType: "Domestic 14.2kg" },
      { mobileNumber: "9123456780", consumerId: "GC1002", name: "Ravi Kumar", address: "45 Anna Salai, Chennai", connectionType: "Domestic 14.2kg" }
    );
  });
  console.log("[portal-gas] Seed data created.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
