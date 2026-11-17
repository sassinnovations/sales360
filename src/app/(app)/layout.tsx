import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { navFor } from "@/lib/permissions";
import { unreadCount } from "@/lib/queries";
import { Shell } from "@/components/shell";

export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="boot">Opening your workspace…</div>}>
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}

async function Workspace({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = unreadCount(user);
  return (
    <Shell user={user} nav={navFor(user.role)} unread={unread}>
      {children}
    </Shell>
  );
}
