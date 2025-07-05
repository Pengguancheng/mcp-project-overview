// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 1. 建立 MCP Server
const server = new McpServer({
  name: "hello-world-server",
  version: "1.0.0"
});

interface HelloWorldInput {}

// 2. 註冊一個最簡單的 Tool，沒有任何輸入參數，直接回傳 "hello world"
server.registerTool(
  "hello",                                  // tool 名稱
  {
    title: "Hello Tool",
    description: "Returns hello world",
    inputSchema: { name: z.string()}                         // 空的 schema 表示不需參數
  },
  async (param) => ({
    content: [
      { type: "text", text: `hello ${param.name}` }
    ]
  })
);

// 3. 使用 stdio transport 接收與回應
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error("伺服器啟動失敗：", err);
  process.exit(1);
});
