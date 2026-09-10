import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Meta = Record<string, unknown> | undefined;

function guessFirstName(meta: Meta): string {
  if (!meta) return "";
  const given = typeof meta["given_name"] === "string" ? (meta["given_name"] as string) : "";
  if (given) return given.trim();
  const full = typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : "";
  if (full) return full.trim().split(/\s+/)[0] ?? "";
  const name = typeof meta["name"] === "string" ? (meta["name"] as string) : "";
  return name.trim().split(/\s+/)[0] ?? "";
}

export function useFirstName() {
  const [firstName, setFirstName] = useState<string | null>(null);
  const [suggested, setSuggested] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const meta = data.user?.user_metadata as Meta;
      const stored = meta && typeof meta["first_name"] === "string" ? (meta["first_name"] as string).trim() : "";
      setFirstName(stored ? stored : null);
      setSuggested(guessFirstName(meta));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const { error } = await supabase.auth.updateUser({ data: { first_name: trimmed } });
    if (error) throw error;
    setFirstName(trimmed);
  }, []);

  return { firstName, suggested, loading, save };
}
