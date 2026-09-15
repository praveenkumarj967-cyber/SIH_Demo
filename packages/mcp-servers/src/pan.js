import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createApiClient, toolResult, toolError, errorMessage } from "./common.js";

const api = createApiClient(process.env.PAN_PORTAL_URL || "http://localhost:4102/api");
const server = new McpServer({ name: "pan-portal-mcp", version: "1.0.0" });

server.tool(
  "pan_lookup",
  "Find the PAN profile (PAN number, name, address, DOB) linked to a citizen's registered mobile number.",
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
  "pan_check_status",
  "Check the status of PAN correction requests for a given PAN number.",
  { panNumber: z.string().describe("10-character PAN number, e.g. ABCDE1234F") },
  async ({ panNumber }) => {
    try {
      const { data } = await api.get(`/status/${panNumber.toUpperCase()}`);
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

server.tool(
  "pan_request_update",
  "Submit a request to correct/update the name, address or date of birth on a PAN record.",
  {
    panNumber: z.string(),
    field: z.enum(["name", "address", "dob"]),
    newValue: z.string(),
  },
  async ({ panNumber, field, newValue }) => {
    try {
      const { data } = await api.post("/update-request", { panNumber: panNumber.toUpperCase(), field, newValue });
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
