import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/agriplan/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/admin/organizations")({
  ssr: false,
  component: () => <AdminShell><OrgsView /></AdminShell>,
});

function OrgsView() {
  const [q, setQ] = useState("");
  const orgs = useQuery({
    queryKey: ["admin_orgs_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, type, country, created_at, wallets(credits, plan_code, credits_alerte), org_members(user_id), projects(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo(() => {
    const list = orgs.data ?? [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((o: any) => o.name?.toLowerCase().includes(s)) : list;
  }, [orgs.data, q]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Organisations ({rows.length})</CardTitle>
        <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
            <tr>
              <th className="p-2 text-start">Organisation</th>
              <th className="p-2 text-start">Type</th>
              <th className="p-2 text-end">Membres</th>
              <th className="p-2 text-end">Projets</th>
              <th className="p-2 text-end">Plan</th>
              <th className="p-2 text-end">Solde</th>
              <th className="p-2 text-start">Créée le</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((o: any) => {
              const w = Array.isArray(o.wallets) ? o.wallets[0] : o.wallets;
              const credits = w?.credits ?? 0;
              const alerte = w?.credits_alerte ?? 3;
              const tone = credits === 0 ? "bg-destructive/10" : credits <= alerte ? "bg-accent/10" : "";
              return (
                <tr key={o.id} className={tone}>
                  <td className="p-2">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{o.id.slice(0,8)}</div>
                  </td>
                  <td className="p-2 text-xs uppercase font-mono">{o.type}</td>
                  <td className="p-2 text-end tabular-nums">{o.org_members?.length ?? 0}</td>
                  <td className="p-2 text-end tabular-nums">{o.projects?.length ?? 0}</td>
                  <td className="p-2 text-end text-xs">{w?.plan_code ?? "—"}</td>
                  <td className="p-2 text-end tabular-nums font-semibold">{credits}</td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-3 text-xs text-muted-foreground border-t">
          L'admin voit les compteurs mais jamais le contenu des budgets/BP — isolation multi-tenant.
        </div>
      </CardContent>
    </Card>
  );
}