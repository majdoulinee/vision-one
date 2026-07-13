// D.1 — Client-side verifiable PDF generator + SHA-256 + storage upload.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { fmtMAD, fmtNum } from "@/lib/format";

type DocKind = "budget" | "business_plan";

const GREEN = "#1B4332";
const GREEN_RGB: [number, number, number] = [27, 68, 50];
const GOLD_RGB: [number, number, number] = [201, 162, 39];

export interface ExportInput {
  kind: DocKind;
  orgId: string;
  sourceId: string;
  refVersion: string;
  profil: any;
  project: { name: string; zone_code: string; orientation?: string };
  // For budget:
  budget?: any;
  // For BP:
  bp?: any;
}

export interface ExportResult {
  docId: string;
  sha256: string;
  storagePath: string;
  verifyUrl: string;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildResume(input: ExportInput) {
  if (input.kind === "budget") {
    const T = input.budget.totaux;
    return {
      profilLabel: input.budget.profilLabel,
      superficieHa: input.budget.superficieHa,
      campagne: input.budget.campagne,
      recettes: T.recettes,
      charges: T.charges,
      margeCampagne: T.margeCampagne,
      coutParHa: T.coutParHa,
      coutParKg: T.coutParKg,
      besoinTresorerieMax: T.besoinTresorerieMax,
      productionKg: T.productionKg,
    };
  }
  const s = input.bp.scenarios;
  const pick = (n: string) => ({
    van: s[n].indicateurs.van,
    tri: s[n].indicateurs.tri,
    payback: s[n].indicateurs.paybackAns,
  });
  return {
    profilLabel: input.bp.profilLabel,
    superficieHa: input.bp.superficieHa,
    horizonAns: input.bp.horizonAns,
    conservateur: pick("conservateur"),
    base: pick("base"),
    optimiste: pick("optimiste"),
  };
}

export async function exportVerifiablePdf(input: ExportInput): Promise<ExportResult> {
  const { data: udata } = await supabase.auth.getUser();
  const uid = udata.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const overrides =
    input.kind === "budget"
      ? (input.budget.overrides ?? [])
      : (input.bp.overrides ?? []);
  const provenance = input.profil.provenance ?? { source: "comite_experts" };
  const resume = buildResume(input);

  // 1. Insert documents row to get id.
  const { data: ins, error: insErr } = await supabase
    .from("documents")
    .insert({
      type: input.kind,
      source_id: input.sourceId,
      org_id: input.orgId,
      ref_version: input.refVersion,
      provenance,
      overrides,
      resume,
      created_by: uid,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  const docId = ins.id;
  const verifyUrl = `${window.location.origin}/verify/${docId}`;

  // 2. QR
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 });

  // 3. Compose PDF
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const M = 40;

  // Header band
  doc.setFillColor(...GREEN_RGB);
  doc.rect(0, 0, pw, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("AGRIPLAN", M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    input.kind === "budget"
      ? "Budget de campagne — document verifiable"
      : "Business plan bancable — document verifiable",
    M,
    64,
  );
  doc.addImage(qrDataUrl, "PNG", pw - M - 65, 12, 65, 65);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Scanner pour verifier : ${verifyUrl}`, M, 108);

  let y = 130;

  const section = (title: string) => {
    doc.setFillColor(...GREEN_RGB);
    doc.rect(M, y - 12, pw - 2 * M, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, M + 8, y + 1);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 16;
  };

  const keyval = (rows: [string, string][]) => {
    autoTable(doc, {
      startY: y,
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 130, textColor: [80, 80, 80] },
      },
      theme: "plain",
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  };

  // Project section
  section("Projet");
  const p = input.profil;
  keyval([
    ["Nom", input.project.name],
    [
      "Profil",
      `${p.label}${p.culture ? " · " + p.culture : ""}${p.systeme ? " · " + p.systeme : ""}${p.techno ? " · " + p.techno : ""}`,
    ],
    ["Zone", input.project.zone_code],
    [
      "Superficie",
      `${input.kind === "budget" ? input.budget.superficieHa : input.bp.superficieHa} ha`,
    ],
    [
      "Orientation",
      String(
        input.kind === "budget"
          ? input.budget.hypotheses.orientation
          : input.bp.orientation,
      ),
    ],
    input.kind === "budget"
      ? ["Campagne", input.budget.campagne]
      : ["Horizon", `${input.bp.horizonAns} ans`],
  ]);

  // Referentiel section
  section("Referentiel");
  const prov = provenance as any;
  keyval([
    ["Version", input.refVersion],
    ["Source", String(prov.source ?? "comite_experts")],
    ...(prov.echantillon_n ? [["Echantillon N", String(prov.echantillon_n)] as [string, string]] : []),
    ...(prov.region ? [["Region", String(prov.region)] as [string, string]] : []),
    ...(prov.periode ? [["Periode", String(prov.periode)] as [string, string]] : []),
  ]);

  // Body
  if (input.kind === "budget") {
    const b = input.budget;
    const T = b.totaux;
    section("Totaux budget");
    autoTable(doc, {
      startY: y,
      head: [["Poste", "Total (MAD)"]],
      body: Object.entries(T.parPoste).map(([k, v]) => [k, fmtMAD(v as number)]),
      foot: [
        ["Recettes", fmtMAD(T.recettes)],
        ["Charges totales", fmtMAD(T.charges)],
        ["Marge de campagne", fmtMAD(T.margeCampagne)],
        ["Besoin de tresorerie max", fmtMAD(T.besoinTresorerieMax)],
      ],
      headStyles: { fillColor: GREEN_RGB },
      footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9 },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    section("Detail hebdomadaire");
    const rows: any[] = b.semaines;
    const shown = rows.length <= 44 ? rows : rows.filter((_: any, i: number) => i % 2 === 0);
    autoTable(doc, {
      startY: y,
      head: [["S", "Cal.", "Production (kg)", "Recettes", "Charges", "Flux net", "Cumul"]],
      body: shown.map((s: any) => [
        s.ordre,
        "S" + s.semaineCalendaire,
        fmtNum(s.productionKg),
        fmtMAD(s.recettes),
        fmtMAD(s.totalCharges),
        fmtMAD(s.fluxNet),
        fmtMAD(s.tresorerieCumulee),
      ]),
      headStyles: { fillColor: GREEN_RGB },
      styles: { fontSize: 8 },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  } else {
    const bp = input.bp;
    section("Plan d'investissement");
    const inv = bp.planInvestissement;
    autoTable(doc, {
      startY: y,
      body: [
        ["Serres / ha", fmtMAD(inv.detailHa.serres)],
        ["Irrigation / ha", fmtMAD(inv.detailHa.irrigation)],
        ["Plantation / ha", fmtMAD(inv.detailHa.plantation)],
        ["Machinisme / ha", fmtMAD(inv.detailHa.machinisme)],
        ["Total invest.", fmtMAD(inv.totalMAD)],
        ["Fonds propres", fmtMAD(inv.financement.fondsPropres)],
        ["Dette", fmtMAD(inv.financement.dette)],
        ["Annuite", fmtMAD(inv.financement.annuite)],
      ],
      styles: { fontSize: 9 },
      theme: "plain",
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    section("Indicateurs par scenario");
    autoTable(doc, {
      startY: y,
      head: [["Scenario", "VAN", "TRI", "Payback", "Cout/ha", "Cout/kg", "Point mort"]],
      body: (["conservateur", "base", "optimiste"] as const).map((n) => {
        const i = bp.scenarios[n].indicateurs;
        return [
          n,
          fmtMAD(i.van),
          i.tri != null ? i.tri + "%" : "—",
          i.paybackAns ? i.paybackAns + " ans" : "—",
          fmtMAD(i.coutParHaMoyen),
          i.coutParKgMoyen != null ? i.coutParKgMoyen + " MAD" : "—",
          i.pointMortKgAn ? fmtNum(i.pointMortKgAn) + " kg" : "—",
        ];
      }),
      headStyles: { fillColor: GREEN_RGB },
      styles: { fontSize: 9 },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    section("Detail annuel — scenario Base");
    autoTable(doc, {
      startY: y,
      head: [["Annee", "CA", "OPEX", "EBITDA", "Amort.", "Dette", "Resultat", "Cash-flow", "Cumul"]],
      body: bp.scenarios.base.annees.map((yr: any) => [
        yr.annee,
        fmtMAD(yr.ca),
        fmtMAD(-Math.abs(yr.opex)),
        fmtMAD(yr.ebitda),
        fmtMAD(-Math.abs(yr.amortissement)),
        fmtMAD(-Math.abs(yr.serviceDette)),
        fmtMAD(yr.resultat),
        fmtMAD(yr.cashFlow),
        fmtMAD(yr.cashCumule),
      ]),
      headStyles: { fillColor: GREEN_RGB },
      styles: { fontSize: 8 },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Overrides section
  if (y > 700) { doc.addPage(); y = 40; }
  section("Hypotheses forcees par le porteur de projet");
  if (!overrides.length) {
    doc.setFontSize(10);
    doc.text("Aucune — document 100% conforme aux normes de reference.", M, y + 2);
    y += 20;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Cle", "Valeur d'origine", "Valeur forcee", "Auteur", "Date"]],
      body: overrides.map((o: any) => [
        o.cle,
        String(o.valeurOrigine ?? "—"),
        String(o.valeur),
        String(o.auteur ?? "—"),
        o.date ? new Date(o.date).toLocaleDateString() : "—",
      ]),
      headStyles: { fillColor: GOLD_RGB },
      styles: { fontSize: 9 },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Footer on every page
  const pageCount = (doc as any).internal.getNumberOfPages();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(200);
    doc.line(M, ph - 42, pw - M, ph - 42);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Document genere par AGRIPLAN — calcul deterministe. Referentiel v${input.refVersion}. Les normes citees incluent leur provenance et leur periode.`,
      M,
      ph - 28,
      { maxWidth: pw - 2 * M },
    );
    doc.text(
      `${new Date().toLocaleString("fr-FR")} · Page ${i}/${pageCount} · Doc ${docId}`,
      M,
      ph - 14,
    );
  }

  // 4. Buffer + hash
  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  const sha256 = await sha256Hex(buffer);

  // 5. Upload
  const storagePath = `${input.orgId}/${docId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, new Blob([buffer], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) throw upErr;

  // 6. Update row with hash + path
  const { error: updErr } = await supabase
    .from("documents")
    .update({ sha256, storage_path: storagePath })
    .eq("id", docId);
  if (updErr) throw updErr;

  // 7. Audit
  await supabase.from("audit_log").insert({
    org_id: input.orgId,
    action: "document_export",
    entity_type: "document",
    entity_id: docId,
    meta: { type: input.kind, sha256_prefix: sha256.slice(0, 8), ref_version: input.refVersion },
  });

  // 8. Trigger local download from the SAME buffer used for hashing
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AGRIPLAN_${input.kind}_${docId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { docId, sha256, storagePath, verifyUrl };
}

export async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256Hex(buf);
}

export { GREEN };