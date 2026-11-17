import fs from "fs";
import { NextResponse } from "next/server";
import { one } from "@/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const row = one<{ resumePath: string | null; resumeName: string | null; tenantId: string }>(
    `select resume_path, resume_name, tenant_id from candidates where id = ?`,
    id,
  );
  if (!row || row.tenantId !== user.tenantId || !row.resumePath || !row.resumePath.includes(`${user.tenantId}`)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const file = fs.readFileSync(row.resumePath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${row.resumeName ?? "resume"}"`,
    },
  });
}
