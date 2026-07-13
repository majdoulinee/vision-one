import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/agriplan/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/audit")({
  ssr: false,
  component: () => <AdminShell><AuditView /></AdminShell>,
});

function AuditView() {
  const [q, setQ] = useState("");
  const rows = useQuery({
    queryKey: ["admin_audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log").select("*").order("at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (rows.data ?? []).filter((r: any) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return JSON.stringify(r).toLowerCase().includes(s);
  });

  function exportCsv() {
    const header = ["at","user_id","org_id","action","entity_type","entity_id","meta"];
    const csv = [header.join(",")].concat(
      filtered.map((r: any) => [r.at, r.user_id, r.org_id ?? "", r.action, r.entity_type ?? "", r.entity_id ?? "", JSON.stringify(r.meta ?? {})].map((v) => JSON.stringify(v ?? "")).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Journal d'audit ({filtered.length}, max 500)</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Filtrer (action, org, motif…)" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
            <tr>
              <th className="p-2 text-start">Date</th>
              <th className="p-2 text-start">Action</th>
              <th className="p-2 text-start">Entité</th>
              <th className="p-2 text-start">Acteur</th>
              <th className="p-2 text-start">Org</th>
              <th className="p-2 text-start">Motif</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r: any) => (
              <tr key={r.id}>
                <td className="p-2 whitespace-nowrap text-xs">{new Date(r.at).toLocaleString()}</td>
                <td className="p-2 font-mono text-xs">{r.action}</td>
                <td className="p-2 text-xs">{r.entity_type ?? "—"} {r.entity_id ? <span className="text-muted-foreground">· {String(r.entity_id).slice(0,8)}</span> : null}</td>
                <td className="p-2 text-[10px] font-mono text-muted-foreground">{r.user_id ? String(r.user_id).slice(0,8) : "—"}</td>
                <td className="p-2 text-[10px] font-mono text-muted-foreground">{r.org_id ? String(r.org_id).slice(0,8) : "—"}</td>
                <td className="p-2 text-xs text-muted-foreground max-w-md truncate">{r.meta?.motif ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
