import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createApiClient, toolResult, toolError, errorMessage } from "./common.js";

const api = createApiClient(process.env.AADHAR_PORTAL_URL || "http://localhost:4101/api");
const server = new McpServer({ name: "aadhar-portal-mcp", version: "1.0.0" });

server.tool(
  "aadhar_lookup",
  "Find the Aadhar profile (Aadhar number, name, address, DOB) linked to a citizen's registered mobile number.",
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
  "aadhar_check_status",
  "Check the status of Aadhar detail update/correction requests for a given Aadhar number.",
  { aadharNumber: z.string().describe("12-digit Aadhar number") },
  async ({ aadharNumber }) => {
    try {
      const { data } = await api.get(`/status/${aadharNumber}`);
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

server.tool(
  "aadhar_request_update",
  "Submit a request to correct/update the name, address or date of birth on an Aadhar record.",
  {
    aadharNumber: z.string().describe("12-digit Aadhar number"),
    field: z.enum(["name", "address", "dob"]),
    newValue: z.string(),
  },
  async ({ aadharNumber, field, newValue }) => {
    try {
      const { data } = await api.post("/update-request", { aadharNumber, field, newValue });
      return toolResult(data);
    } catch (e) {
      return toolError(errorMessage(e));
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
