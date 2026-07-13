import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCheck, Check, Trash2, Inbox } from "lucide-react";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { BackButton } from "@/components/agriplan/BackButton";

export const Route = createFileRoute("/_authenticated/app/inbox")({
  ssr: false,
  component: InboxPage,
});

type Filter = "all" | "unread" | "read";

function InboxPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications(100);
  const navigate = useNavigate();

  const items = (data ?? []).filter((n) => {
    if (filter === "unread") return !n.read_at;
    if (filter === "read") return !!n.read_at;
    return true;
  });

  function openNotif(n: Notification) {
    if (!n.read_at) markAsRead.mutate(n.id);
    if (n.link) navigate({ to: n.link as any });
  }

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Alertes internes : décisions de demandes, octrois, solde bas.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllAsRead.mutate()}>
            <CheckCheck className="mr-2 h-4 w-4" /> Tout marquer comme lu
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {(["all", "unread", "read"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              filter === f ? "border-primary bg-primary/5 font-medium" : "border-border"
            }`}
          >
            {f === "all" ? "Toutes" : f === "unread" ? `Non lues (${unreadCount})` : "Lues"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historique</CardTitle>
          <CardDescription>Cliquez pour ouvrir la ressource liée.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <div>Aucune notification.</div>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 p-4 transition-colors hover:bg-muted/40 ${
                    n.read_at ? "opacity-70" : "bg-primary/5"
                  }`}
                >
                  <button className="flex-1 text-start" onClick={() => openNotif(n)}>
                    <div className="font-medium">{n.title}</div>
                    {n.body && <div className="mt-0.5 text-sm text-muted-foreground">{n.body}</div>}
                    <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      <span>·</span>
                      <span>{n.kind}</span>
                      {n.link && (
                        <>
                          <span>·</span>
                          <span className="text-primary underline">Ouvrir</span>
                        </>
                      )}
                    </div>
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    {!n.read_at && (
                      <button
                        className="rounded p-1.5 hover:bg-background"
                        onClick={() => markAsRead.mutate(n.id)}
                        title="Marquer comme lu"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      className="rounded p-1.5 hover:bg-background"
                      onClick={() => remove.mutate(n.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}