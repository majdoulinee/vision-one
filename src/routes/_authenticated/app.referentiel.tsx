import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { usePublishedVersion } from "@/hooks/use-referentiel";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/referentiel")({
  ssr: false,
  component: RefConsole,
});

// ---- Column specs (spec-conformant) --------------------------------------
const ZONE_COLS = ["code","label","bbox_lng_min","bbox_lat_min","bbox_lng_max","bbox_lat_max"] as const;
const PROFIL_COLS = [
  "code","label","culture","variete","systeme","techno","orientation","risque",
  "perenne","annees_avant_production","duree_vie_ans","duree_semaines","semaine_debut_typique",
  "invest_serres","invest_irrigation","invest_plantation","invest_machinisme","invest_total",
  "amortissement_ans","rendement_kg_ha","prix_export_mad_kg","prix_local_mad_kg","min_capital_mad_ha",
  "provenance_source","provenance_echantillon_n","provenance_region","provenance_periode",
] as const;
const NORME_COLS = [
  "profil_code","semaine",
  "main_oeuvre","intrants","irrigation_eau","energie","recolte_conditionnement","autres_charges",
  "part_production",
] as const;
const MAPPING_COLS = ["profil_code","zone_code","statut"] as const;

const TECHNO = ["basse","moyenne","haute"];
const ORIENTATION = ["export","local"];
const RISQUE = ["faible","moyen","eleve"];
const PROV_SOURCE = ["bee_one","comite_experts"];
const STATUT = ["optimal","eligible","exclu"];

type ValidationErr = { line: number; col?: string; message: string };
type DiffStatus = "nouveau" | "modifie" | "inchange";
type DiffRow = {
  line: number;
  code: string;
  status: DiffStatus;
  cle_norme: string;
  profil_code?: string | null;
  zone_code?: string | null;
  nouvelle_valeur: any;
};

const TEMPLATES: Record<string, { cols: readonly string[]; sample: any[] }> = {
  zones: {
    cols: ZONE_COLS,
    sample: [{ code: "SOUSS", label: "Souss-Massa", bbox_lng_min: -10.4, bbox_lat_min: 29.6, bbox_lng_max: -8.4, bbox_lat_max: 30.9 }],
  },
  profils: {
    cols: PROFIL_COLS,
    sample: [{
      code: "TOM-SERRE-EXP", label: "Tomate serre export", culture: "Tomate", variete: "Cherry", systeme: "Serre",
      techno: "haute", orientation: "export", risque: "moyen", perenne: 0,
      annees_avant_production: 0, duree_vie_ans: 1, duree_semaines: 40, semaine_debut_typique: 36,
      invest_serres: 600000, invest_irrigation: 90000, invest_plantation: 40000, invest_machinisme: 70000, invest_total: 800000,
      amortissement_ans: 10, rendement_kg_ha: 180000, prix_export_mad_kg: 9, prix_local_mad_kg: 4, min_capital_mad_ha: 1500000,
      provenance_source: "bee_one", provenance_echantillon_n: 41, provenance_region: "Souss-Massa", provenance_periode: "2023-2025",
    }],
  },
  normes: {
    cols: NORME_COLS,
    sample: [{ profil_code: "TOM-SERRE-EXP", semaine: 1, main_oeuvre: 1200, intrants: 800, irrigation_eau: 400, energie: 300, recolte_conditionnement: 0, autres_charges: 100, part_production: 0.0 }],
  },
  mappings: {
    cols: MAPPING_COLS,
    sample: [{ profil_code: "TOM-SERRE-EXP", zone_code: "SOUSS", statut: "optimal" }],
  },
};

function num(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function downloadTemplates() {
  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(tpl.sample, { header: tpl.cols as unknown as string[] });
    XLSX.utils.book_append_sheet(wb, ws, key);
    XLSX.writeFile(wb, `agriplan-${key}.xlsx`);
  }
}

// ---- Transformation vers la forme stockee (zones.data / profils_production.data) --
function buildZonePayload(r: any) {
  return {
    name: String(r.label ?? r.code).trim(),
    data: {
      bbox_lng_min: num(r.bbox_lng_min), bbox_lat_min: num(r.bbox_lat_min),
      bbox_lng_max: num(r.bbox_lng_max), bbox_lat_max: num(r.bbox_lat_max),
    },
  };
}

function buildProfilPayload(r: any) {
  const perenne = num(r.perenne) === 1;
  return {
    name: String(r.label ?? r.code).trim(),
    data: {
      culture: r.culture, variete: r.variete ?? null, systeme: r.systeme ?? null,
      techno: r.techno, orientation: r.orientation, risque: r.risque, perenne,
      annees_avant_production: num(r.annees_avant_production) ?? 0,
      duree_vie_ans: num(r.duree_vie_ans) ?? 1,
      duree_semaines: num(r.duree_semaines) ?? 40,
      semaine_debut_typique: num(r.semaine_debut_typique) ?? 1,
      invest_serres: num(r.invest_serres) ?? 0,
      invest_irrigation: num(r.invest_irrigation) ?? 0,
      invest_plantation: num(r.invest_plantation) ?? 0,
      invest_machinisme: num(r.invest_machinisme) ?? 0,
      invest_total: num(r.invest_total) ?? 0,
      amortissement_ans: num(r.amortissement_ans) ?? 10,
      rendement_kg_ha: num(r.rendement_kg_ha) ?? 0,
      prix_export_mad_kg: num(r.prix_export_mad_kg) ?? 0,
      prix_local_mad_kg: num(r.prix_local_mad_kg) ?? 0,
      min_capital_mad_ha: num(r.min_capital_mad_ha) ?? 0,
      provenance: {
        source: r.provenance_source, n: num(r.provenance_echantillon_n),
        region: r.provenance_region, periode: r.provenance_periode,
      },
    },
  };
}

function buildMappingPayload(r: any) {
  return { quality: String(r.statut).trim() };
}

// ---- Diff vs version publiee (zones/profils_production n'ont qu'une ligne
// par code : la ligne actuelle EST la verite courante, quelle que soit la
// version qui l'a ecrite en dernier) ---------------------------------------
async function diffZones(rows: any[]): Promise<DiffRow[]> {
  const codes = Array.from(new Set(rows.map((r) => String(r.code ?? "").trim()).filter(Boolean)));
  const { data } = codes.length
    ? await supabase.from("zones").select("code,name,data").in("code", codes)
    : { data: [] as any[] };
  const byCode = new Map((data ?? []).map((z: any) => [z.code, { name: z.name, data: z.data }]));
  return rows.map((r, i) => {
    const code = String(r.code ?? "").trim();
    const nv = buildZonePayload(r);
    const cur = byCode.get(code);
    const status: DiffStatus = !cur ? "nouveau" : jsonEq(cur, nv) ? "inchange" : "modifie";
    return { line: i + 2, code, status, cle_norme: `zone:${code}`, zone_code: code, nouvelle_valeur: nv };
  });
}

async function diffProfils(rows: any[]): Promise<DiffRow[]> {
  const codes = Array.from(new Set(rows.map((r) => String(r.code ?? "").trim()).filter(Boolean)));
  const { data } = codes.length
    ? await supabase.from("profils_production").select("code,name,data").in("code", codes)
    : { data: [] as any[] };
  const byCode = new Map((data ?? []).map((p: any) => [p.code, { name: p.name, data: p.data }]));
  return rows.map((r, i) => {
    const code = String(r.code ?? "").trim();
    const nv = buildProfilPayload(r);
    const cur = byCode.get(code);
    const status: DiffStatus = !cur ? "nouveau" : jsonEq(cur, nv) ? "inchange" : "modifie";
    return { line: i + 2, code, status, cle_norme: `profil:${code}`, profil_code: code, nouvelle_valeur: nv };
  });
}

async function diffMappings(rows: any[], publishedVersion: string | undefined): Promise<DiffRow[]> {
  const pairs = rows.map((r) => ({ p: String(r.profil_code ?? "").trim(), z: String(r.zone_code ?? "").trim() }));
  const profCodes = Array.from(new Set(pairs.map((x) => x.p).filter(Boolean)));
  const zoneCodes = Array.from(new Set(pairs.map((x) => x.z).filter(Boolean)));
  const { data } = publishedVersion && profCodes.length && zoneCodes.length
    ? await supabase.from("profil_zone_mappings").select("profile_code,zone_code,quality")
        .eq("ref_version", publishedVersion).in("profile_code", profCodes).in("zone_code", zoneCodes)
    : { data: [] as any[] };
  const byKey = new Map((data ?? []).map((m: any) => [`${m.profile_code}/${m.zone_code}`, { quality: m.quality }]));
  return rows.map((r, i) => {
    const p = String(r.profil_code ?? "").trim();
    const z = String(r.zone_code ?? "").trim();
    const nv = buildMappingPayload(r);
    const cur = byKey.get(`${p}/${z}`);
    const status: DiffStatus = !cur ? "nouveau" : jsonEq(cur, nv) ? "inchange" : "modifie";
    return { line: i + 2, code: `${p}/${z}`, status, cle_norme: `mapping:${p}/${z}`, profil_code: p, zone_code: z, nouvelle_valeur: nv };
  });
}

async function diffNormes(updates: NormeUpdate[]): Promise<DiffRow[]> {
  const codes = updates.map((u) => u.code);
  const { data } = codes.length
    ? await supabase.from("profils_production").select("code,data").in("code", codes)
    : { data: [] as any[] };
  const byCode = new Map((data ?? []).map((p: any) => [p.code, p.data ?? {}]));
  return updates.map((u): DiffRow => {
    const nv = { charges_hebdo: u.charges, production_hebdo: u.production };
    const cur = byCode.get(u.code);
    const curSlice = cur ? { charges_hebdo: cur.charges_hebdo ?? null, production_hebdo: cur.production_hebdo ?? null } : null;
    const status: DiffStatus = !cur ? "nouveau" : jsonEq(curSlice, nv) ? "inchange" : "modifie";
    return { line: 0, code: u.code, status, cle_norme: `normes:${u.code}`, profil_code: u.code, nouvelle_valeur: nv };
  });
}

// ---- Creation des propositions (aucune ecriture directe dans les tables --
// live : tout passe par ref_lots / ref_propositions, puis le cycle comite -->
// admin --> publication deja cable ailleurs dans l'appli) ------------------
async function findOrCreateLot(version: string): Promise<string> {
  const { data: existing, error: e1 } = await supabase
    .from("ref_lots").select("id").eq("version_cible", version).neq("statut", "publie")
    .order("cree_le", { ascending: false }).limit(1).maybeSingle();
  if (e1) throw e1;
  if (existing) return existing.id;
  const { data: created, error: e2 } = await supabase
    .from("ref_lots").insert({ version_cible: version }).select("id").single();
  if (e2) throw e2;
  return created.id;
}

async function createPropositions(
  diffs: DiffRow[], version: string, justification: string,
): Promise<{ n: number; lotId: string }> {
  const toCreate = diffs.filter((d) => d.status !== "inchange");
  if (toCreate.length === 0) return { n: 0, lotId: "" };
  const { data: userData } = await supabase.auth.getUser();
  const lotId = await findOrCreateLot(version);
  const payload = toCreate.map((d) => ({
    lot_id: lotId,
    cle_norme: d.cle_norme,
    profil_code: d.profil_code ?? null,
    zone_code: d.zone_code ?? null,
    nouvelle_valeur: d.nouvelle_valeur,
    provenance: "comite_experts" as const,
    justification: justification.trim(),
    auteur: userData.user?.id ?? null,
  }));
  const { error } = await supabase.from("ref_propositions").insert(payload as any);
  if (error) throw error;
  await supabase.from("audit_log").insert({
    user_id: userData.user?.id ?? null,
    action: "referentiel_import_propositions",
    entity_type: "ref_lot",
    entity_id: lotId,
    meta: { version, n: toCreate.length, cles: toCreate.map((d) => d.cle_norme) },
  } as any);
  return { n: toCreate.length, lotId };
}

function RefConsole() {
  const { t } = useTranslation();
  const role = usePlatformRole();
  const published = usePublishedVersion();
  const { current } = useCurrentOrg();
  void current;
  const [newVersion, setNewVersion] = useState("");
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    if (!newVersion && published.data?.version) setNewVersion(published.data.version);
  }, [published.data?.version, newVersion]);

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

  const activeLot = useQuery({
    queryKey: ["ref-active-lot", newVersion],
    enabled: !!newVersion,
    queryFn: async () => {
      const { data } = await supabase.from("ref_lots").select("id,statut")
        .eq("version_cible", newVersion).neq("statut", "publie")
        .order("cree_le", { ascending: false }).limit(1).maybeSingle();
      return data ?? null;
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

  function onCreated(n: number) {
    setCreatedCount((c) => c + n);
    activeLot.refetch();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("referentiel.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("referentiel.subtitle")}</p>
      </div>

      <div className="rounded border border-accent/60 bg-accent/15 p-3 text-sm flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>{t("referentiel.governanceTitle")}</strong> {t("referentiel.governanceHint")}{" "}
          <Link to="/app/comite/propositions" className="underline font-medium">{t("referentiel.goToComite")}</Link>
        </div>
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
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <Label>{t("referentiel.versionLabel")}</Label>
              <Input
                placeholder={t("referentiel.versionPlaceholder") ?? ""}
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("referentiel.sharedVersionHint")}</p>
            </div>
            <Button variant="outline" onClick={downloadTemplates}>{t("referentiel.downloadTemplates")}</Button>
          </div>
          {newVersion && (
            <p className="text-xs text-muted-foreground">
              {activeLot.data
                ? t("referentiel.lotExisting", { version: newVersion })
                : t("referentiel.lotWillCreate", { version: newVersion })}
            </p>
          )}
          {createdCount > 0 && (
            <p className="text-xs text-muted-foreground">{t("referentiel.importsCount", { n: createdCount })}</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="zones">
        <TabsList>
          <TabsTrigger value="zones">{t("referentiel.importZones")}</TabsTrigger>
          <TabsTrigger value="profils">{t("referentiel.importProfils")}</TabsTrigger>
          <TabsTrigger value="normes">{t("referentiel.importNormes")}</TabsTrigger>
          <TabsTrigger value="mappings">{t("referentiel.importMappings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="zones">
          <ImportTab
            kind="zones"
            columns={ZONE_COLS as unknown as string[]}
            version={newVersion}
            validate={validateZones}
            diff={diffZones}
            onCreated={onCreated}
          />
        </TabsContent>

        <TabsContent value="profils">
          <ImportTab
            kind="profils"
            columns={PROFIL_COLS as unknown as string[]}
            version={newVersion}
            validate={validateProfils}
            diff={diffProfils}
            onCreated={onCreated}
          />
        </TabsContent>

        <TabsContent value="normes">
          <NormesTab version={newVersion} onCreated={onCreated} />
        </TabsContent>

        <TabsContent value="mappings">
          <ImportTab
            kind="mappings"
            columns={MAPPING_COLS as unknown as string[]}
            version={newVersion}
            validate={(rows) => validateMappings(rows)}
            diff={(rows) => diffMappings(rows, published.data?.version)}
            onCreated={onCreated}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DiffBlock({ diffs }: { diffs: DiffRow[] | null }) {
  const { t } = useTranslation();
  if (!diffs) return null;
  const nouveau = diffs.filter((d) => d.status === "nouveau").length;
  const modifie = diffs.filter((d) => d.status === "modifie").length;
  const inchange = diffs.filter((d) => d.status === "inchange").length;
  return (
    <div className="rounded border p-2 text-xs space-y-1">
      <div className="font-semibold">{t("referentiel.diffTitle")}</div>
      <div className="text-muted-foreground">{t("referentiel.diffSummary", { nouveau, modifie, inchange })}</div>
      <div className="max-h-40 overflow-auto rounded border mt-1">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left">{t("referentiel.line")}</th>
              <th className="px-2 py-1 text-left">code</th>
              <th className="px-2 py-1 text-left">statut</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{d.line || "—"}</td>
                <td className="px-2 py-1 font-mono">{d.code}</td>
                <td className="px-2 py-1">
                  {d.status === "nouveau" && <span className="text-emerald-600 dark:text-emerald-400">{t("referentiel.diffNew")}</span>}
                  {d.status === "modifie" && <span className="text-amber-600 dark:text-amber-400">{t("referentiel.diffChanged")}</span>}
                  {d.status === "inchange" && <span className="text-muted-foreground">{t("referentiel.diffUnchanged")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JustificationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <Label>{t("referentiel.justificationLabel")}</Label>
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("referentiel.justificationHint") ?? ""} />
      <div className="text-[10px] text-muted-foreground text-end tabular-nums">{value.length} / 20 min.</div>
    </div>
  );
}

function ImportTab({
  kind, columns, version, validate, diff, onCreated,
}: {
  kind: string;
  columns: string[];
  version: string;
  validate: (rows: any[]) => Promise<ValidationErr[]> | ValidationErr[];
  diff: (rows: any[]) => Promise<DiffRow[]>;
  onCreated: (n: number) => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[] | null>(null);
  const [errors, setErrors] = useState<ValidationErr[] | null>(null);
  const [diffs, setDiffs] = useState<DiffRow[] | null>(null);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
      setRows(json);
      setDiffs(null);
      const errs = await validate(json);
      setErrors(errs);
      if (errs.length === 0) setDiffs(await diff(json));
    } catch (e) {
      toast.error(String(e));
    }
  }

  function reset() {
    setRows(null); setErrors(null); setDiffs(null); setJustification("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function doCreate() {
    if (!version) return toast.error(t("referentiel.missingVersion"));
    if (!diffs) return toast.error(t("referentiel.noFile"));
    if (errors && errors.length > 0) return toast.error(t("referentiel.importDisabled"));
    if (justification.trim().length < 20) return toast.error(t("referentiel.justificationTooShort"));
    setBusy(true);
    try {
      const { n } = await createPropositions(diffs, version, justification);
      if (n === 0) {
        toast.message(t("referentiel.noChanges") ?? "");
      } else {
        toast.success(t("referentiel.propositionsCreated", { n, version }) ?? "");
        onCreated(n);
      }
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const hasChanges = !!diffs && diffs.some((d) => d.status !== "inchange");
  const canCreate = !!diffs && !!version && !!errors && errors.length === 0 && hasChanges && justification.trim().length >= 20 && !busy;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind}</CardTitle>
        <CardDescription>
          {t("referentiel.expectedCols")}: <code className="text-xs">{columns.join(", ")}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm"
        />
        {rows && (
          <>
            <div className="rounded border p-2 text-xs text-muted-foreground">
              {t("referentiel.rowsCount", { n: rows.length })}
            </div>
            <div className="max-h-64 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
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
            <ErrorsBlock errors={errors} />
            {errors && errors.length === 0 && <DiffBlock diffs={diffs} />}
            {errors && errors.length === 0 && hasChanges && (
              <JustificationField value={justification} onChange={setJustification} />
            )}
            <Button disabled={!canCreate} onClick={doCreate}>{t("referentiel.createPropositions")}</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorsBlock({ errors }: { errors: ValidationErr[] | null }) {
  const { t } = useTranslation();
  if (!errors) return null;
  if (errors.length === 0) {
    return <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">{t("referentiel.validationOk")}</div>;
  }
  return (
    <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
      <div className="mb-1 font-semibold text-destructive">{t("referentiel.errors")} ({errors.length})</div>
      <ul className="max-h-40 space-y-0.5 overflow-auto">
        {errors.slice(0, 200).map((e, i) => (
          <li key={i}>
            <span className="text-muted-foreground">{t("referentiel.line")} {e.line}{e.col ? ` · ${t("referentiel.column")} ${e.col}` : ""}: </span>
            {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function checkCols(row: any, cols: readonly string[], line: number, errs: ValidationErr[]) {
  for (const c of cols) {
    if (!(c in row)) errs.push({ line, col: c, message: "colonne manquante" });
  }
}

function validateZones(rows: any[]): ValidationErr[] {
  const errs: ValidationErr[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    checkCols(r, ZONE_COLS, line, errs);
    if (!r.code || String(r.code).trim() === "") errs.push({ line, col: "code", message: "code requis" });
    const lnmin = num(r.bbox_lng_min), lnmax = num(r.bbox_lng_max);
    const ltmin = num(r.bbox_lat_min), ltmax = num(r.bbox_lat_max);
    for (const [k, v] of [["bbox_lng_min", lnmin], ["bbox_lng_max", lnmax], ["bbox_lat_min", ltmin], ["bbox_lat_max", ltmax]] as const) {
      if (v === null) errs.push({ line, col: k, message: "valeur numérique requise" });
    }
    if (lnmin !== null && lnmax !== null && !(lnmin < lnmax)) errs.push({ line, col: "bbox_lng_*", message: "min < max requis" });
    if (ltmin !== null && ltmax !== null && !(ltmin < ltmax)) errs.push({ line, col: "bbox_lat_*", message: "min < max requis" });
  });
  return errs;
}

function validateProfils(rows: any[]): ValidationErr[] {
  const errs: ValidationErr[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    checkCols(r, PROFIL_COLS, line, errs);
    if (!r.code) errs.push({ line, col: "code", message: "code requis" });
    if (!TECHNO.includes(String(r.techno))) errs.push({ line, col: "techno", message: `∈ ${TECHNO.join("/")}` });
    if (!ORIENTATION.includes(String(r.orientation))) errs.push({ line, col: "orientation", message: `∈ ${ORIENTATION.join("/")}` });
    if (!RISQUE.includes(String(r.risque))) errs.push({ line, col: "risque", message: `∈ ${RISQUE.join("/")}` });
    if (!PROV_SOURCE.includes(String(r.provenance_source))) errs.push({ line, col: "provenance_source", message: `∈ ${PROV_SOURCE.join("/")}` });
    const s = (num(r.invest_serres) ?? 0) + (num(r.invest_irrigation) ?? 0) + (num(r.invest_plantation) ?? 0) + (num(r.invest_machinisme) ?? 0);
    const total = num(r.invest_total) ?? 0;
    if (total <= 0) errs.push({ line, col: "invest_total", message: "> 0 requis" });
    else if (Math.abs(total - s) / total > 0.01) errs.push({ line, col: "invest_total", message: `écart >1% avec somme (${s})` });
    if ((num(r.min_capital_mad_ha) ?? -1) < 0) errs.push({ line, col: "min_capital_mad_ha", message: "≥ 0 requis" });
  });
  return errs;
}

function validateMappings(rows: any[]): ValidationErr[] {
  const errs: ValidationErr[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    checkCols(r, MAPPING_COLS, line, errs);
    if (!STATUT.includes(String(r.statut))) errs.push({ line, col: "statut", message: `∈ ${STATUT.join("/")}` });
    if (!r.profil_code) errs.push({ line, col: "profil_code", message: "profil_code requis" });
    if (!r.zone_code) errs.push({ line, col: "zone_code", message: "zone_code requis" });
  });
  return errs;
}

type NormeUpdate = {
  code: string;
  charges: Record<string, number[]>;
  production: number[];
};

function NormesTab({ version, onCreated }: { version: string; onCreated: (n: number) => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[] | null>(null);
  const [errors, setErrors] = useState<ValidationErr[] | null>(null);
  const [updates, setUpdates] = useState<NormeUpdate[] | null>(null);
  const [diffs, setDiffs] = useState<DiffRow[] | null>(null);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cols = NORME_COLS as unknown as string[];

  async function handleFile(f: File) {
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
      setRows(json);
      setDiffs(null);
      const { errs, updates: u } = await validateAndBuildNormes(json);
      setErrors(errs);
      if (errs.length === 0) {
        setUpdates(u);
        setDiffs(await diffNormes(u));
      } else {
        setUpdates(null);
      }
    } catch (e) {
      toast.error(String(e));
    }
  }

  function reset() {
    setRows(null); setErrors(null); setUpdates(null); setDiffs(null); setJustification("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function doCreate() {
    if (!version) return toast.error(t("referentiel.missingVersion"));
    if (!diffs) return toast.error(t("referentiel.importDisabled"));
    if (justification.trim().length < 20) return toast.error(t("referentiel.justificationTooShort"));
    setBusy(true);
    try {
      const { n } = await createPropositions(diffs, version, justification);
      if (n === 0) {
        toast.message(t("referentiel.noChanges") ?? "");
      } else {
        toast.success(t("referentiel.propositionsCreated", { n, version }) ?? "");
        onCreated(n);
      }
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const hasChanges = !!diffs && diffs.some((d) => d.status !== "inchange");
  const canCreate = !!diffs && !!version && hasChanges && justification.trim().length >= 20 && !busy;

  return (
    <Card>
      <CardHeader>
        <CardTitle>normes</CardTitle>
        <CardDescription>
          {t("referentiel.expectedCols")}: <code className="text-xs">{cols.join(", ")}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm"
        />
        {rows && (
          <>
            <div className="rounded border p-2 text-xs text-muted-foreground">
              {t("referentiel.rowsCount", { n: rows.length })}
            </div>
            <div className="max-h-64 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>{cols.map((c) => <th key={c} className="px-2 py-1 text-left">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-t">
                      {cols.map((c) => <td key={c} className="px-2 py-1">{String(r[c] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ErrorsBlock errors={errors} />
            {errors && errors.length === 0 && <DiffBlock diffs={diffs} />}
            {errors && errors.length === 0 && hasChanges && (
              <JustificationField value={justification} onChange={setJustification} />
            )}
            <Button disabled={!canCreate} onClick={doCreate}>{t("referentiel.createPropositions")}</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

async function validateAndBuildNormes(rows: any[]): Promise<{ errs: ValidationErr[]; updates: NormeUpdate[] }> {
  const errs: ValidationErr[] = [];
  const updates: NormeUpdate[] = [];

  rows.forEach((r, i) => {
    const line = i + 2;
    checkCols(r, NORME_COLS, line, errs);
    for (const c of NORME_COLS) {
      if (c === "profil_code") continue;
      const v = num(r[c]);
      if (v === null) errs.push({ line, col: c, message: "numérique requis" });
      else if (v < 0) errs.push({ line, col: c, message: "≥ 0 requis" });
    }
  });

  const codes = Array.from(new Set(rows.map((r) => String(r.profil_code)).filter(Boolean)));
  // Les normes revisent un profil DEJA publie (le profil doit deja exister en
  // base) : une revision de normes ne peut pas porter sur un profil encore
  // seulement propose dans le meme lot. Importer profils, le faire publier,
  // puis importer ses normes hebdomadaires revisees.
  const { data: profs } = codes.length
    ? await supabase.from("profils_production").select("code, data").in("code", codes)
    : { data: [] as any[] };
  const profMap = new Map<string, any>();
  for (const p of profs ?? []) profMap.set((p as any).code, (p as any).data);

  const byProfil = new Map<string, any[]>();
  for (const r of rows) {
    const c = String(r.profil_code ?? "");
    if (!c) continue;
    if (!byProfil.has(c)) byProfil.set(c, []);
    byProfil.get(c)!.push(r);
  }

  for (const [code, group] of byProfil) {
    const prof = profMap.get(code);
    if (!prof) {
      errs.push({ line: 0, col: "profil_code", message: `profil ${code} introuvable (doit déjà être publié)` });
      continue;
    }
    const duree = Number(prof.duree_semaines ?? 0);
    if (group.length !== duree) {
      errs.push({ line: 0, col: code, message: `nombre de lignes (${group.length}) ≠ duree_semaines (${duree})` });
    }
    const sorted = [...group].sort((a, b) => Number(a.semaine) - Number(b.semaine));
    for (let i = 0; i < sorted.length; i++) {
      const expected = i + 1;
      if (Number(sorted[i].semaine) !== expected) {
        errs.push({ line: 0, col: code, message: `semaine ${sorted[i].semaine} attendue ${expected}` });
        break;
      }
    }
    const sumProd = sorted.reduce((s, r) => s + (num(r.part_production) ?? 0), 0);
    if (sumProd < 0.99 || sumProd > 1.01) {
      errs.push({ line: 0, col: code, message: `somme part_production = ${sumProd.toFixed(4)} (doit être ∈ [0.99, 1.01])` });
    }
    const charges: Record<string, number[]> = {
      main_oeuvre: [], intrants: [], irrigation_eau: [], energie: [], recolte_conditionnement: [], autres_charges: [],
    };
    const production: number[] = [];
    for (const r of sorted) {
      for (const k of Object.keys(charges)) charges[k].push(num(r[k]) ?? 0);
      production.push(num(r.part_production) ?? 0);
    }
    updates.push({ code, charges, production });
  }
  return { errs, updates };
}
