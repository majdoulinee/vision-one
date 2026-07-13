import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_project",
  title: "Get project details",
  description:
    "Fetch a single Vision One project by id, including its latest budget and business plan summaries.",
  inputSchema: {
    project_id: z.string().uuid().describe("UUID of the project to retrieve."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const [{ data: project, error: pErr }, { data: budget }, { data: bp }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).maybeSingle(),
      supabase.from("budgets").select("id, updated_at, data").eq("project_id", project_id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("business_plans").select("id, updated_at, data").eq("project_id", project_id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (pErr) return { content: [{ type: "text", text: pErr.message }], isError: true };
    if (!project) return { content: [{ type: "text", text: "Project not found or not accessible." }], isError: true };
    const payload = { project, latest_budget: budget ?? null, latest_business_plan: bp ?? null };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});