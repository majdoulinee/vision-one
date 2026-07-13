import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sha256OfFile } from "@/lib/pdf-export";
import { CheckCircle2, XCircle, Upload, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/verify/$docId")({
  head: () => ({
    meta: [
      { title: "AGRIPLAN — Verification de document" },
      { name: "description", content: "Verifiez l'authenticite d'un document AGRIPLAN via son empreinte SHA-256." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { docId } = Route.useParams();
  const { t } = useTranslation();

  const q = useQuery({
    queryKey: ["verify", docId],
    queryFn: async () => {
      const r = await fetch(`/api/public/verify/${docId}`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Erreur");
      return (await r.json()) as {
        type: string;
        created_at: string;
        ref_version: string | null;
        provenance: any;
        overrides: any[];
        resume: any;
        sha256: string | null;
      };
    },
  });

  const [status, setStatus] = useState<"idle" | "checking" | "match" | "mismatch">("idle");
  const [uploadedHash, setUploadedHash] = useState<string>("");

  async function onFile(f: File) {
    setStatus("checking");
    try {
      const h = await sha256OfFile(f);
      setUploadedHash(h);
      setStatus(h === q.data?.sha256 ? "match" : "mismatch");
    } catch {
      setStatus("mismatch");
    }
  }

  if (q.isLoading) {
    return <div className="mx-auto max-w-2xl p-8 text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!q.data) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>{t("verify.notFound")}</CardTitle>
            <CardDescription>{t("verify.notFoundDesc")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const d = q.data;
  const prov = d.provenance ?? {};
  const hasOverrides = (d.overrides ?? []).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary py-8 text-primary-foreground">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6">
          <ShieldCheck className="h-8 w-8" />
          <div>
            <div className="text-2xl font-bold">AGRIPLAN</div>
            <div className="text-sm opacity-90">{t("verify.title")}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t(`verify.type.${d.type}`)}</Badge>
          <span className="text-sm text-muted-foreground">
            {t("verify.issuedAt")} {new Date(d.created_at).toLocaleString()}
          </span>
          {hasOverrides ? (
            <Badge variant="secondary" className="bg-accent text-accent-foreground">
              {t("verify.hasOverrides", { count: d.overrides.length })}
            </Badge>
          ) : (
            <Badge variant="outline">{t("verify.noOverrides")}</Badge>
          )}
        </div>

        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle>{t("verify.refVersion")}: {d.ref_version ?? "—"}</CardTitle>
            <CardDescription>{t("verify.provenance")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <KV k={t("verify.source")} v={String(prov.source ?? "comite_experts")} />
            {prov.echantillon_n && <KV k="Echantillon N" v={String(prov.echantillon_n)} />}
            {prov.region && <KV k={t("verify.region")} v={String(prov.region)} />}
            {prov.periode && <KV k={t("verify.period")} v={String(prov.periode)} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("verify.overrides")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasOverrides ? (
              <div className="text-sm text-muted-foreground">{t("verify.noOverridesDesc")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2">{t("verify.key")}</th>
                      <th>{t("verify.original")}</th>
                      <th>{t("verify.forced")}</th>
                      <th>{t("verify.date")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.overrides.map((o: any, i: number) => (
                      <tr key={i}>
                        <td className="py-1.5">{o.cle}</td>
                        <td>{String(o.valeurOrigine ?? "—")}</td>
                        <td className="font-medium">{String(o.valeur)}</td>
                        <td>{o.date ? new Date(o.date).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("verify.resume")}</CardTitle></CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
              {JSON.stringify(d.resume, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("verify.hash")}</CardTitle>
            <CardDescription>{t("verify.hashDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="break-all rounded bg-muted p-3 font-mono text-xs">
              {d.sha256 ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("verify.checkBlock")}</CardTitle>
            <CardDescription>{t("verify.checkBlockDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted p-8 text-sm text-muted-foreground hover:border-primary hover:bg-primary/5">
              <Upload className="h-6 w-6" />
              <span>{t("verify.drop")}</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>

            {status === "checking" && <div className="text-sm">{t("verify.checking")}</div>}
            {status === "match" && (
              <div className="flex items-start gap-3 rounded-lg bg-primary p-4 text-primary-foreground">
                <CheckCircle2 className="h-10 w-10 flex-shrink-0" />
                <div>
                  <div className="text-lg font-bold">{t("verify.match")}</div>
                  <div className="text-sm opacity-90">{t("verify.matchDesc")}</div>
                </div>
              </div>
            )}
            {status === "mismatch" && (
              <div className="flex items-start gap-3 rounded-lg bg-destructive p-4 text-destructive-foreground">
                <XCircle className="h-10 w-10 flex-shrink-0" />
                <div>
                  <div className="text-lg font-bold">{t("verify.mismatch")}</div>
                  <div className="text-sm opacity-90">{t("verify.mismatchDesc")}</div>
                  {uploadedHash && (
                    <div className="mt-2 break-all font-mono text-xs">
                      {t("verify.uploadedHash")}: {uploadedHash}
                    </div>
                  )}
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              onClick={() => { setStatus("idle"); setUploadedHash(""); }}
            >
              {t("verify.reset")}
            </Button>
          </CardContent>
        </Card>

        <p className="pt-4 text-center text-xs text-muted-foreground">
          {t("verify.footer")}
        </p>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}