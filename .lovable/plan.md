# Move your existing library into your account

You signed in as juliaharms12730@gmail.com, but the memory paper, its 48 comments, the paper note and both topics were created before accounts existed, so they still belong to nobody — which is why your reading room looks empty.

## What I'll do

1. Assign everything that currently has no owner to your account:
   - 1 paper — "The Molecular and Systems Biology of Memory"
   - 2 topics
   - 48 highlights and comments
   - 1 paper note
2. Confirm the PDF itself still opens for you. It is stored under its old filename, and the file rules already allow you to read a file that belongs to a paper you own, so no re-upload is needed.
3. Remove the automatic "first person to sign in adopts the old library" step I added earlier. It never ran, and once your data is yours it is only a risk — a friend signing in should never inherit anything.
4. Reload your home page and check the paper, the topics, and the comments all appear.

After this, anything you or a friend upload from now on is tied to whoever uploaded it.

## Technical details

- One `UPDATE ... SET user_id = 'd824c247-0686-4452-9a34-6d6ad8d66100' WHERE user_id IS NULL` per table (`papers`, `topics`, `highlights`, `paper_topic_notes`), run as a data change, not a migration.
- Delete `src/lib/claim.functions.ts` and its call in the `/_authenticated/` route loader.
- Storage `SELECT` policy on `papers` bucket already matches `papers.file_path = objects.name AND papers.user_id = auth.uid()`, so the legacy path `2a99880b-….pdf` resolves once ownership is set.
- Verify by signing in as that account in a browser check and confirming the table row and topic pages render.
