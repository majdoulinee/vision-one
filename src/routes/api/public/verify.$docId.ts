import { createFileRoute } from "@tanstack/react-router";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Cache-Control": "no-store",
  };
}

export const Route = createFileRoute("/api/public/verify/$docId")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: async ({ params }) => {
        const docId = params.docId;
        if (!/^[0-9a-f-]{36}$/i.test(docId)) {
          return new Response("Not found", { status: 404, headers: corsHeaders() });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("documents")
          .select("type, created_at, ref_version, provenance, overrides, resume, sha256")
          .eq("id", docId)
          .maybeSingle();
        if (error || !data) {
          return new Response("Not found", { status: 404, headers: corsHeaders() });
        }
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "content-type": "application/json", ...corsHeaders() },
        });
      },
    },
  },
});