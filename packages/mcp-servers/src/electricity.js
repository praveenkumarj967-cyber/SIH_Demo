import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createApiClient, toolResult, toolError, errorMessage } from "./common.js";

const api = createApiClient(process.env.ELECTRICITY_PORTAL_URL || "http://localhost:4104/api");
const server = new McpServer({ name: "electricity-portal-mcp", version: "1.0.0" });

server.tool(
  "electricity_lookup",
  "Find the electricity connection (consumer number, name, address) linked to a citizen's registered mobile number.",
  { mobileNumber: z.string().describe("10-digit citizen mobile number") },
  async ({ mobileNumber }) => {
    try {
      const { data } = await api.get(`/lookup/${mobileNumber}`);
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

server.tool(
  "electricity_check_bill",
  "Check the current electricity bill amount, due date and payment status for a consumer number.",
  { consumerNumber: z.string().describe("Electricity consumer number, e.g. EL5001") },
  async ({ consumerNumber }) => {
    try {
      const { data } = await api.get(`/bill/${consumerNumber.toUpperCase()}`);
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

server.tool(
  "electricity_pay_bill",
  "Pay the electricity bill for a given consumer number.",
  {
    consumerNumber: z.string().describe("Electricity consumer number, e.g. EL5001"),
    amount: z.number().describe("Amount to pay in INR"),
  },
  async ({ consumerNumber, amount }) => {
    try {
      const { data } = await api.post("/pay", { consumerNumber: consumerNumber.toUpperCase(), amount });
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
