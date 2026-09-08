import { createFileRoute, redirect } from "@tanstack/react-router";

// /verify (no id) previously 404'd. Redirect to the published demonstration
// document so the "scan a QR, land on a public proof page" promise is always
// reachable, even without a specific document id in hand.
const DEMO_DOC_ID = "63e2456e-b738-4a93-9e36-982cdbd82654";

export const Route = createFileRoute("/verify/")({
  beforeLoad: () => {
    throw redirect({ to: "/verify/$docId", params: { docId: DEMO_DOC_ID } });
  },
});
