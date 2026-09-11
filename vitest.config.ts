import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Ces tests appellent le vrai projet Supabase (création d'utilisateurs,
    // signInWithPassword, plusieurs requêtes séquentielles) : les délais par
    // défaut de vitest sont trop courts pour ça.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
