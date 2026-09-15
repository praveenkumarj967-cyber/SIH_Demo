import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createApiClient, toolResult, toolError, errorMessage } from "./common.js";

const api = createApiClient(process.env.GAS_PORTAL_URL || "http://localhost:4103/api");
const server = new McpServer({ name: "gas-portal-mcp", version: "1.0.0" });

server.tool(
  "gas_lookup",
  "Find the LPG gas connection (consumer ID, name, address) linked to a citizen's registered mobile number.",
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
  "gas_check_bookings",
  "Check cylinder booking status/history for a given gas consumer ID.",
  { consumerId: z.string().describe("Gas consumer ID, e.g. GC1001") },
  async ({ consumerId }) => {
    try {
      const { data } = await api.get(`/bookings/${consumerId.toUpperCase()}`);
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

server.tool(
  "gas_book_cylinder",
  "Book a new LPG cylinder refill for a given gas consumer ID.",
  { consumerId: z.string().describe("Gas consumer ID, e.g. GC1001") },
  async ({ consumerId }) => {
    try {
      const { data } = await api.post("/book", { consumerId: consumerId.toUpperCase() });
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
