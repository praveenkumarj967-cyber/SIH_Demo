import "dotenv/config";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { encrypt, maskValue } from "@govstack/shared";
import { usersStore, documentsStore, officialsStore, auditLogger } from "./store.js";

const ENC_KEY = process.env.VAULT_ENC_KEY || "4f3c2a1e9b8d7c6a5f4e3d2c1b0a99887766554433221100ffeeddccbbaa9988";

function seedDocument(mobileNumber, type, label, fullValue) {
  return {
    id: uuid(),
    mobileNumber,
    type,
    label,
    maskedPreview: maskValue(fullValue),
    encryptedValue: encrypt(fullValue, ENC_KEY),
    createdAt: new Date().toISOString(),
  };
}

export function seed() {
  if (!usersStore.isEmpty("users")) {
    console.log("[document-vault-api] Data already seeded, skipping.");
    return;
  }

  usersStore.update((data) => {
    data.users.push(
      { mobileNumber: "9876543210", name: "Asha Rao", createdAt: new Date().toISOString() },
      { mobileNumber: "9123456780", name: "Ravi Kumar", createdAt: new Date().toISOString() }
    );
  });

  documentsStore.update((data) => {
    data.documents.push(
      seedDocument("9876543210", "AADHAR", "Aadhar Card", "1234 5678 9012"),
      seedDocument("9876543210", "PAN", "PAN Card", "ABCDE1234F"),
      seedDocument("9876543210", "DRIVING_LICENSE", "Driving Licence", "KA0120230001234"),
      seedDocument("9876543210", "MARKSHEET", "10th Marksheet", "SSLC/2010/00123456"),
      seedDocument("9123456780", "AADHAR", "Aadhar Card", "5678 1234 4321"),
      seedDocument("9123456780", "PAN", "PAN Card", "PQRSX5678K")
    );
  });

  officialsStore.update((data) => {
    data.officials.push({
      username: "officer1",
      passwordHash: bcrypt.hashSync("Officer@123", 10),
      name: "Officer Meera Nair",
      department: "District e-Governance Cell",
    });
  });

  auditLogger.log({ actor: "system", action: "SEED_DATA_LOADED", target: "document-vault-api", meta: {} });
  console.log("[document-vault-api] Seed data created. Demo citizen mobile: 9876543210 / 9123456780");
  console.log("[document-vault-api] Demo official login: officer1 / Officer@123");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
