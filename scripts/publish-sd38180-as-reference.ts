// Publishes the seeded SD38180 case as the production "reference case" in
// the public reference library. Idempotent — running twice is safe.
//
// Usage (local dev / Appwrite):
//   npx ts-node --transpile-only -r tsconfig-paths/register scripts/publish-sd38180-as-reference.ts
//
// The script also exports a `publishSd38180AsReference` helper that the
// in-app seeder can call after seedSD38180IfFirstRun returns true so the
// case becomes public for the seeded user immediately.

// Re-export the in-src helper so the CLI and the in-app seeder share one
// implementation.
export {
  publishSd38180AsReference,
  REFERENCE_SLUG_PREFIX,
} from '../src/infra/seed/publishSd38180AsReference';
import { SD38180_REDACTION_POLICY } from '../src/infra/seed/sd38180-redaction';

// CLI entry point — only used for one-off operational runs.
if (require.main === module) {
  const caseId = process.env.SD38180_CASE_ID;
  const ownerId = process.env.SD38180_OWNER_ID;
  if (!caseId || !ownerId) {
    console.error(
      'Set SD38180_CASE_ID and SD38180_OWNER_ID env vars before running this script.',
    );
    process.exit(1);
  }
  // Lazy-import a CaseRepository implementation for the operator to wire up.
  // The default Appwrite implementation requires environment configuration
  // and is intentionally NOT instantiated here to avoid bundling the SDK
  // when running unit tests. Operators should plug their own repo here.
  console.error(
    'CLI mode requires operator-supplied CaseRepository. Edit this script to wire your repo.',
  );
  console.error(
    `Targeted case: ${caseId}\nOwner: ${ownerId}\nPolicy: ${JSON.stringify(SD38180_REDACTION_POLICY)}`,
  );
  process.exit(0);
}
