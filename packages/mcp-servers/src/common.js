import axios from "axios";

export function createApiClient(baseURL) {
  return axios.create({ baseURL, timeout: 5000 });
}

export function toolResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function toolError(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

export function errorMessage(e) {
  return e.response?.data?.error || e.message || "Unknown error";
}
