import { recordsStore } from "./store.js";

export function seed() {
  if (!recordsStore.isEmpty("records")) {
    console.log("[portal-aadhar] Data already seeded, skipping.");
    return;
  }
  recordsStore.update((data) => {
    data.records.push(
      { mobileNumber: "9876543210", aadharNumber: "123456789012", name: "Asha Rao", address: "12 MG Road, Bengaluru", dob: "1990-05-14" },
      { mobileNumber: "9123456780", aadharNumber: "234567890123", name: "Ravi Kumar", address: "45 Anna Salai, Chennai", dob: "1988-11-02" }
    );
  });
  console.log("[portal-aadhar] Seed data created.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
