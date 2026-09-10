# Private reading rooms: sign in with Google

Right now the site has no accounts, so everyone who opens the link is looking at the same shelf. Making the code repo public didn't leak anything — the code isn't the problem; the site simply treats all visitors as one person. The fix is accounts: each person signs in with Google and sees only their own papers, notes, highlights and topics.

## What changes for you

- A sign-in screen with a single "Continue with Google" button. Anyone can sign up; each account starts empty.
- The whole reading room (home, topic pages, paper reader) sits behind sign-in.
- A small account menu in the header with your email and "Sign out".
- Every paper you upload, every note, comment and topic is stamped with your account and is invisible to everyone else — including the PDF files themselves.

## Your existing library

There are two papers in there today:

- "The Molecular and Systems Biology of Memory" (Sep 6) — yours, along with its 48 comments, 1 note and both topics. This gets attached to your account the first time you sign in.
- "How Do Co-folding Models Organize Structural Information?" (Sep 10) — uploaded by your friend. Since it isn't yours and there is no account to attach it to, it and its PDF get removed; your friend can re-upload it into their own account.

Tell me if that split is wrong and I'll adjust before building.

## Technical details

**Auth**
- Enable the Google provider (managed credentials) and disable email/password.
- Public `/auth` route using `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.
- Move `index`, `topics.$slug`, `papers.$id` under `src/routes/_authenticated/`; add the integration-managed `_authenticated/route.tsx` gate. `src/routes/index.tsx` is deleted in the same edit as `_authenticated/index.tsx` is created, to avoid a duplicate `/` route.
- Root route: single `onAuthStateChange` subscriber filtered to `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED` → `router.invalidate()`, plus query invalidation when a session exists. Sign-out follows cancel → clear → signOut → `navigate({ to: "/auth", replace: true })`.

**Data ownership (migration)**
- Add `user_id uuid not null` to `papers`, `topics`, `highlights`, `paper_topic_notes` (added nullable, backfilled, then set not null).
- Backfill: the memory paper and its highlights/notes plus both topics get Julia's `auth.uid()` (a small one-time SQL step run right after her first sign-in, since no auth user exists yet); the co-folding paper, its rows and its storage object are deleted.
- Replace the four `USING (true)` policies with per-operation policies scoped to `auth.uid() = user_id`, `TO authenticated`. Drop the `anon` grants; keep `authenticated` and `service_role` grants.
- Client inserts in `src/lib/db.ts` (`createTopic`, `uploadPaper`, `upsertPaperNote`, `createHighlight`) set `user_id` from the current session; ownership is never accepted from caller input.

**Storage**
- Store PDFs at `<user_id>/<paper_id>.pdf`; `uploadPaper` builds that path.
- Replace the bucket's open policies with owner-scoped ones on `storage.objects` where `bucket_id = 'papers'` and the first path segment equals `auth.uid()::text`. Existing memory-paper object is moved to the new path in the same migration step.

**Server function**
- `analyzePaper` currently writes with `supabaseAdmin` and trusts `paperId`. Add `requireSupabaseAuth` middleware and scope the update to `.eq("id", paperId).eq("user_id", context.userId)`, so a signed-in user can only analyze their own paper. `attachSupabaseAuth` is already registered in `src/start.ts`.

**SEO / metadata**
- `/auth` gets its own title and description; protected routes keep theirs.
