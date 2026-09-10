import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Reading Room" },
      { name: "description", content: "Sign in to your private reading room of annotated papers and topic notes." },
      { property: "og:title", content: "Sign in — Reading Room" },
      { property: "og:description", content: "Sign in to your private reading room of annotated papers and topic notes." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message ?? "Could not sign in");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="label-mono mb-3">Personal Research Library</p>
        <h1 className="text-2xl font-semibold tracking-tight">Reading Room</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Your papers, highlights and topic notes are private to your account. Sign in to open your own reading room.
        </p>
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="mt-8 flex h-11 w-full items-center justify-center gap-2 border border-foreground text-sm font-medium transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}
