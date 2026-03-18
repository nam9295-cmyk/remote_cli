#!/usr/bin/env node

const engine = process.argv[2] || "custom";
const jobId = process.argv[3] || "unknown-job";
const prompt = process.argv.slice(4).join(" ");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[runner] engine=${engine} job=${jobId}`);
  console.log(`[runner] prompt=${prompt.slice(0, 160)}`);
  console.log("[runner] initializing workspace");
  await sleep(200);

  if (engine === "gemini") {
    console.log("[gemini] collecting context");
    await sleep(200);
    console.log("[gemini] drafting concise summary");
    await sleep(250);
    console.log("RESULT_SUMMARY: Gemini runner finished the draft and saved a concise summary.");
    return;
  }

  if (engine === "codex") {
    console.log("[codex] inspecting repository");
    await sleep(200);
    console.log("[codex] generating implementation notes");
    await sleep(250);
    console.log("RESULT_SUMMARY: Codex runner completed code-focused analysis and prepared actionable output.");
    return;
  }

  console.error("[custom] loading custom workflow");
  await sleep(200);
  console.error("[custom] missing required custom command configuration");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
