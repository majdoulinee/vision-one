import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { usePublishedVersion } from "@/hooks/use-referentiel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/app/referentiel")({
  ssr: false,
  component: RefConsole,
});

function RefConsole() {
  const { t } = useTranslation();
  const role = usePlatformRole();
  const qc = useQueryClient();
  const published = usePublishedVersion();
  const [newVersion, setNewVersion] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = useQuery({
    queryKey: ["ref-counts", published.data?.version],
    enabled: !!published.data?.version,
    queryFn: async () => {
      const v = published.data!.version;
      const [z, p, m] = await Promise.all([
        supabase.from("zones").select("code", { count: "exact", head: true }).eq("ref_version", v),
        supabase.from("profils_production").select("code", { count: "exact", head: true }).eq("ref_version", v),
        supabase.from("profil_zone_mappings").select("id", { count: "exact", head: true }).eq("ref_version", v),
      ]);
      return { zones: z.count ?? 0, profils: p.count ?? 0, mappings: m.count ?? 0 };
    },
  });

  if (role.isLoading) return <div>{t("common.loading")}</div>;
  if (role.data !== "admin" && role.data !== "comite") {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{t("referentiel.title")}</CardTitle>
            <CardDescription>{t("referentiel.denied")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  async function createDraft() {
    if (!newVersion) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("ref_versions")
        .insert({ version: newVersion, status: "draft", notes: null });
      if (error) throw error;
      toast.success("OK");
      setNewVersion("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("referentiel.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("referentiel.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("referentiel.published")} · {published.data?.version ?? "—"}</CardTitle>
          <CardDescription>
            {counts.data
              ? t("referentiel.counts", {
                  zones: counts.data.zones,
                  profils: counts.data.profils,
                  mappings: counts.data.mappings,
                })
              : "…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label>{t("referentiel.versionLabel")}</Label>
            <Input
              placeholder={t("referentiel.versionPlaceholder") ?? ""}
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
            />
          </div>
          <Button onClick={createDraft} disabled={busy || !newVersion}>
            {t("referentiel.import")}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="zones">
        <TabsList>
          <TabsTrigger value="zones">{t("referentiel.importZones")}</TabsTrigger>
          <TabsTrigger value="profils">{t("referentiel.importProfils")}</TabsTrigger>
          <TabsTrigger value="mappings">{t("referentiel.importMappings")}</TabsTrigger>
        </TabsList>
        <TabsContent value="zones">
          <ImportTab
            kind="zones"
            columns={["code", "label", "notes"]}
            insert={async (rows, ver) => {
              const payload = rows.map((r: any) => ({
                code: String(r.code),
                label: String(r.label ?? r.code),
                notes: r.notes ? String(r.notes) : null,
                ref_version: ver,
              }));
              const { error } = await supabase.from("zones").upsert(payload as any, { onConflict: "code,ref_version" });
              if (error) throw error;
              return payload.length;
            }}
          />
        </TabsContent>
        <TabsContent value="profils">
          <div className="p-4 text-sm text-muted-foreground">
            Import de profils (courbes JSON) — v2. Utilisez la migration SQL pour l'instant.
          </div>
        </TabsContent>
        <TabsContent value="mappings">
          <ImportTab
            kind="mappings"
            columns={["profil_code", "zone_code", "statut"]}
            insert={async (rows, ver) => {
              const payload = rows.map((r: any) => ({
                profil_code: String(r.profil_code),
                zone_code: String(r.zone_code),
                statut: String(r.statut ?? "possible"),
                ref_version: ver,
              }));
              const { error } = await supabase.from("profil_zone_mappings").upsert(payload as any, {
                onConflict: "profil_code,zone_code,ref_version",
              });
              if (error) throw error;
              return payload.length;
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ImportTab({
  kind, columns, insert,
}: {
  kind: string;
  columns: string[];
  insert: (rows: any[], version: string) => Promise<number>;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[] | null>(null);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws) as any[];
        setRows(json);
      } catch (e) {
        toast.error(String(e));
      }
    };
    reader.readAsBinaryString(f);
  }

  async function doImport() {
    if (!rows || !version) return;
    setBusy(true);
    try {
      const n = await insert(rows, version);
      toast.success(t("referentiel.importSuccess", { n }));
      setRows(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind}</CardTitle>
        <CardDescription>Colonnes attendues: {columns.join(", ")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>{t("referentiel.versionLabel")}</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex. 2026.3" />
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full text-sm"
          />
        </div>
        {rows && (
          <>
            <div className="rounded border p-2 text-xs text-muted-foreground">
              {t("referentiel.preview")}: {rows.length} lignes
            </div>
            <div className="max-h-64 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>{columns.map((c) => <th key={c} className="px-2 py-1 text-left">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t">
                      {columns.map((c) => <td key={c} className="px-2 py-1">{String(r[c] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button disabled={busy || !version} onClick={doImport}>
              {t("referentiel.import")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}