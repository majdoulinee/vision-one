import { useConsultantLinksForClient } from "@/hooks/use-consultant-links";
import { Users } from "lucide-react";

export function ConsultantBanner() {
  const { data } = useConsultantLinksForClient();
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-md border border-accent/60 bg-accent/10 px-4 py-2 text-sm flex flex-wrap items-center gap-3">
      <Users className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        {data.map((l: any) => (
          <div key={l.id}>
            Le cabinet <strong>{l.consultant_org?.name}</strong> a accès à votre organisation ({l.role}), accordé le {new Date(l.accorde_le).toLocaleDateString()}.
          </div>
        ))}
      </div>
      <a href="/settings" className="text-xs underline">Gérer</a>
    </div>
  );
}
