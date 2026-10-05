// Run with node --import tsx scripts/review-source-mcp.mjs. Read-only public-source review.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GitHubStudyReader } from "../server/services/sources/github.ts";
const client = new Client({
  name: "codex-air-source-review",
  version: "1.0.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["scripts/start-github-study-mcp.mjs"],
  stderr: "inherit",
});
const repo = { owner: "octocat", repo: "Hello-World" };
const read = async (name, args) => {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError)
    throw new Error(result.content?.[0]?.text || "MCP read failed");
  return JSON.parse(result.content[0].text).data;
};
try {
  await client.connect(transport);
  const catalog = await client.listTools();
  const metadata = await read("get_repository", repo);
  const revision = await read("get_source_revision", repo);
  const files = await read("list_study_files", {
    ...repo,
    commit: revision.commit,
  });
  const selected =
    files.candidates.find((file) => /^readme/i.test(file.path)) ||
    files.candidates[0];
  if (!selected) throw new Error("No eligible study file found");
  const mcp = await read("read_study_file", {
    ...repo,
    commit: revision.commit,
    path: selected.path,
  });
  const reader = new GitHubStudyReader();
  await reader.repository(repo.owner, repo.repo);
  const direct = await reader.file(
    repo.owner,
    repo.repo,
    revision.commit,
    selected,
  );
  if (direct.hash !== mcp.hash)
    throw new Error("MCP and production adapter snapshots differ");
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        workflow:
          "Actual MCP stdio calls made during Codex review; no global MCP registration",
        repository: metadata.title,
        commit: revision.commit,
        path: selected.path,
        hash: direct.hash,
        matchingProductionReader: true,
        tools: catalog.tools.map((tool) => ({
          name: tool.name,
          annotations: tool.annotations,
        })),
        writesToSource: false,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
