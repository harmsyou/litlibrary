import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One-time migration helper: the library predates accounts, so its rows have no
 * owner. The very first account created on this instance adopts them; every
 * later account starts empty.
 */
export const claimLegacyLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orphan } = await supabaseAdmin.from("papers").select("id").is("user_id", null).limit(1);
    if (!orphan?.length) return { claimed: false as const };

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return { claimed: false as const };
    const first = [...list.users].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (!first || first.id !== context.userId) return { claimed: false as const };

    for (const table of ["papers", "topics", "highlights", "paper_topic_notes"] as const) {
      await supabaseAdmin.from(table).update({ user_id: context.userId }).is("user_id", null);
    }
    return { claimed: true as const };
  });
