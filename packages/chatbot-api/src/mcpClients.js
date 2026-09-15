import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpDir = path.join(__dirname, "..", "..", "mcp-servers", "src");

const SERVERS = {
  aadhar: "aadhar.js",
  pan: "pan.js",
  gas: "gas.js",
  electricity: "electricity.js",
};

const clients = {};

/** Spawns each department's MCP server as a child process over stdio and connects a client to it. */
export async function initMcpClients() {
  await Promise.all(
    Object.entries(SERVERS).map(async ([key, file]) => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.join(mcpDir, file)],
        env: process.env,
      });
      const client = new Client({ name: `chatbot-${key}-client`, version: "1.0.0" });
      await client.connect(transport);
      clients[key] = client;
      console.log(`[chatbot-api] connected to ${key} MCP server`);
    })
  );
}

export function getClient(key) {
  const client = clients[key];
  if (!client) throw new Error(`MCP client "${key}" is not initialized.`);
  return client;
}

export async function callTool(key, toolName, args) {
  const client = getClient(key);
  const result = await client.callTool({ name: toolName, arguments: args });
  const text = result.content?.[0]?.text ?? "";
  if (result.isError) throw new Error(text.replace(/^Error:\s*/, ""));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function closeAllMcpClients() {
  await Promise.all(Object.values(clients).map((c) => c.close()));
}
