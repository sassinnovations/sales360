import { NextResponse } from "next/server";
import { all } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canExport } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!canExport(user.role)) return new NextResponse("Export is not allowed for this role.", { status: 403 });
  const owner = user.role === "bdm" ? "and o.owner_id = ?" : "";
  const params = user.role === "bdm" ? [user.tenantId, user.id] : [user.tenantId];
  const rows = all<{ name: string; account: string; stage: string; amount: number; currency: string; status: string }>(
    `select o.name, a.name as account, s.name as stage, o.amount, o.currency, o.status
     from opportunities o
     left join accounts a on a.id = o.account_id
     left join stages s on s.id = o.stage_id
     where o.tenant_id = ? ${owner}`,
    ...params,
  );
  const header = "name,account,stage,amount,currency,status";
  const body = rows
    .map((row) => [row.name, row.account, row.stage, row.amount, row.currency, row.status].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  return new NextResponse(`${header}\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=pipeline.csv",
    },
  });
}
