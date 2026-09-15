import axios from "axios";

const baseURL = import.meta.env.VITE_VAULT_API_URL || "http://localhost:4000";

export const api = axios.create({ baseURL });

export function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const DEV_MODE = import.meta.env.DEV;

export async function fetchDevInbox(mobileNumber) {
  const { data } = await api.get(`/api/dev/inbox/${mobileNumber}`);
  return data.messages;
}
