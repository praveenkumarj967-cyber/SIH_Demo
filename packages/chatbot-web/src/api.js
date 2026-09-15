import axios from "axios";

const baseURL = import.meta.env.VITE_CHATBOT_API_URL || "http://localhost:4200";
const api = axios.create({ baseURL });

export async function sendChatMessage(sessionId, mobileNumber, message) {
  const { data } = await api.post("/api/chat", { sessionId, mobileNumber, message });
  return data;
}
