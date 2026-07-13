import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ComiteShell } from "@/components/agriplan/ComiteShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/comite/versions")({
  ssr: false,
  component: () => <ComiteShell><View /></ComiteShell>,
});

function View() {
  const versions = useQuery({
    queryKey: ["comite_ref_versions_published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ref_versions")
        .select("*")
        .not("publiee_le", "is", null)
        .order("publiee_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lots = useQuery({
    queryKey: ["comite_ref_lots_published"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_lots").select("id, version_cible");
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useQuery({
    queryKey: ["comite_ref_propositions_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ref_propositions")
        .select("lot_id, statut")
        .eq("statut", "publiee");
      if (error) throw error;
      const by: Record<string, number> = {};
      (data ?? []).forEach((p: any) => { by[p.lot_id] = (by[p.lot_id] ?? 0) + 1; });
      return by;
    },
  });

  function countFor(version: string) {
    const lot = (lots.data ?? []).find((l: any) => l.version_cible === version);
    if (!lot) return 0;
    return counts.data?.[lot.id] ?? 0;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Versions publiées</CardTitle>
        <CardDescription>Chaque version est figée à vie. Les documents générés sur une version restent vérifiables même après une publication ultérieure.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {(versions.data ?? []).map((v: any) => (
            <div key={v.version} className="p-4 flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-semibold text-lg text-ink">v{v.version}</span>
                  <Badge variant="ochre">publiée · immuable</Badge>
                </div>
                {v.note_publication && <p className="text-sm text-muted-foreground italic max-w-2xl">« {v.note_publication} »</p>}
                <div className="text-xs text-muted-foreground">
                  Publiée le {v.publiee_le ? new Date(v.publiee_le).toLocaleString() : "—"}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="tabular-nums font-semibold">{countFor(v.version)} norme(s)</div>
                <div className="text-muted-foreground">modifiée(s) dans cette version</div>
              </div>
            </div>
          ))}
          {(versions.data ?? []).length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Aucune version publiée pour l'instant.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}