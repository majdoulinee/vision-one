import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import listOrganizationsTool from "./tools/list-organizations";
import getWalletTool from "./tools/get-wallet";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "vision-one-mcp",
  title: "Vision One",
  version: "0.1.0",
  instructions:
    "Vision One agroforestry planning tools. Use these to inspect the signed-in user's organisations, projects, budgets, and wallet credits. All calls run as the authenticated user under RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrganizationsTool, listProjectsTool, getProjectTool, getWalletTool],
});