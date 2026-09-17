import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/agriplan/LanguageSwitcher";
import { BrandLogo } from "@/components/agriplan/BrandLogo";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import { formatError } from "@/lib/format-error";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  // Only allow same-origin relative paths.
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  ssr: false,
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const next = safeNext(search.next);
      if (next) throw redirect({ href: next });
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Connexion — Vision One" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  // Rempli quand un email de confirmation a été envoyé (inscription, ou
  // tentative de connexion sur un compte pas encore confirmé) : bascule
  // l'écran vers un état dédié plutôt que de laisser le formulaire affiché
  // avec un simple toast, qui prêtait à confusion (l'utilisateur pouvait
  // re-soumettre en pensant que rien ne s'était passé).
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const next = safeNext(search.next);
  const postAuthNavigate = () => {
    if (next) {
      window.location.href = next;
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + (next ?? "/dashboard"),
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // Si la confirmation d'email est activée côté Supabase (Authentication
        // > Providers > Email > "Confirm email"), signUp() ne renvoie PAS de
        // session tant que le lien reçu par email n'a pas été cliqué : on
        // bascule alors vers l'écran "vérifiez votre boîte mail" plutôt que
        // de rester sur le formulaire. Si la confirmation est désactivée
        // (comportement précédent), une session est retournée immédiatement
        // et on enchaîne normalement.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          postAuthNavigate();
        } else {
          setPendingConfirmation(email);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Message Supabase brut ("Email not confirmed") détecté pour
          // proposer directement le renvoi de l'email plutôt qu'une erreur
          // générique peu actionnable.
          if (/email not confirmed/i.test(formatError(error))) {
            setPendingConfirmation(email);
            return;
          }
          throw error;
        }
        postAuthNavigate();
      }
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth" + (next ? `?next=${encodeURIComponent(next)}` : ""),
      },
    });
    if (error) {
      toast.error(formatError(error) || "OAuth error");
      setBusy(false);
      return;
    }
    // Supabase performs a full-page redirect to Google from here; no further action needed.
  }

  async function handleResend() {
    if (!pendingConfirmation) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingConfirmation,
        options: {
          emailRedirectTo: window.location.origin + (next ?? "/dashboard"),
        },
      });
      if (error) throw error;
      toast.success(t("auth.resendSuccess"));
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute left-4 top-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md border border-line bg-parch-2/60 px-3 py-2 text-sm font-medium text-ink transition hover:bg-parch-2 hover:border-ink/30"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("common.backHome")}</span>
        </Link>
      </div>
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        {pendingConfirmation ? (
          <>
            <CardHeader className="text-center">
              <Link to="/" className="mx-auto flex items-center gap-2">
                <BrandLogo size="sm" />
              </Link>
              <Mail className="mx-auto h-8 w-8 text-primary" />
              <CardTitle>{t("auth.confirmEmailTitle")}</CardTitle>
              <CardDescription>
                {t("auth.confirmEmailDesc", { email: pendingConfirmation })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resending}
              >
                {t("auth.resendEmail")}
              </Button>
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="w-full text-center text-sm font-medium text-primary hover:underline"
              >
                {t("auth.backToSignIn")}
              </button>
            </CardContent>
          </>
        ) : (
        <>
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto flex items-center gap-2">
            <BrandLogo size="sm" />
          </Link>
          <CardTitle>{mode === "signup" ? t("auth.signUp") : t("auth.signIn")}</CardTitle>
          <CardDescription>{t("app.tagline")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            {t("auth.continueWithGoogle")}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? mode === "signup"
                  ? t("auth.signingUp")
                  : t("auth.signingIn")
                : mode === "signup"
                  ? t("auth.signUp")
                  : t("auth.signIn")}
            </Button>
          </form>
          <div className="text-center text-sm text-muted-foreground">
            {mode === "signup" ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "signup" ? t("auth.signIn") : t("auth.signUp")}
            </button>
          </div>
        </CardContent>
        </>
        )}
      </Card>
    </div>
  );
}