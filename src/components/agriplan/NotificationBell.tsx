import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { useState } from "react";

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString();
}

function kindTone(kind: string) {
  if (kind === "credit_empty" || kind === "request_refusee") return "border-l-destructive";
  if (kind === "low_credit") return "border-l-accent";
  if (kind === "request_accordee" || kind === "credits_octroi_admin" || kind === "credits_remboursement")
    return "border-l-primary";
  return "border-l-muted";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications(20);
  const navigate = useNavigate();

  const list = data ?? [];

  function openNotif(n: Notification) {
    if (!n.read_at) markAsRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      navigate({ to: n.link as any });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-accent/10"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground h-[18px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => markAllAsRead.mutate()}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" /> Tout lu
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/app/inbox" });
              }}
            >
              Voir tout
            </Button>
          </div>
        </div>
        <div className="max-h-96 overflow-auto">
          {list.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Aucune notification.</div>
          )}
          {list.map((n) => (
            <div
              key={n.id}
              className={`group flex gap-2 border-l-4 px-3 py-2.5 text-sm hover:bg-muted/50 ${kindTone(n.kind)} ${
                n.read_at ? "opacity-70" : "bg-primary/5"
              }`}
            >
              <button className="flex-1 text-start" onClick={() => openNotif(n)}>
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {formatWhen(n.created_at)}
                </div>
              </button>
              <div className="flex flex-col items-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!n.read_at && (
                  <button
                    className="rounded p-1 hover:bg-background"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead.mutate(n.id);
                    }}
                    title="Marquer comme lu"
                    aria-label="Marquer comme lu"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  className="rounded p-1 hover:bg-background"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove.mutate(n.id);
                  }}
                  title="Supprimer"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}