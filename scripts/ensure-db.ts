import "dotenv/config";
import { authStorage } from "../server/integrations/auth/storage";
import { projectStorage } from "../server/integrations/projects/storage";
import { adminAuditStorage } from "../server/integrations/admin/storage";
import { billingStorage } from "../server/integrations/billing/storage";
import { planStorage } from "../server/integrations/billing/planStorage";
import { announcementStorage } from "../server/integrations/admin/announcementStorage";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await adminAuditStorage.ensureSchema();
  await billingStorage.ensureSchema();
  await planStorage.ensureSchema();
  await announcementStorage.ensureSchema();
  await authStorage.ensureSchema();
  await projectStorage.ensureSchema();

  const tables = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'video_projects', 'video_reels')
    ORDER BY table_name
  `);

  console.log("Database schema updated successfully.");
  console.log(
    "Verified tables:",
    (tables.rows as { table_name: string }[]).map((r) => r.table_name).join(", "),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Database update failed:", error);
    process.exit(1);
  });
