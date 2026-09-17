import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/agriplan/AdminShell";

export const Route = createFileRoute("/_authenticated/app/admin/users")({
  ssr: false,
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
