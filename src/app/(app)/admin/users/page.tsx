import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { inviteUser, revokeInvite } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/types";
import { roleLabel } from "@/lib/permissions";
import { usersInTenant } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "admin") redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const people = usersInTenant(user.tenantId);
  const invite = q(sp.invite);
  return (
    <div className="stack">
      <PageHeader eyebrow="Administration" title="Users and roles" />
      <Notice text={q(sp.notice)} />
      {invite ? <p className="banner">Invitation link: /invite/{invite}</p> : null}
      <EntityForm
        action={inviteUser}
        submitLabel="Send invitation"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "role", label: "Role", type: "select", options: ROLES.filter((role) => user.role === "owner" || role !== "owner").map((role) => ({ value: role, label: roleLabel(role) })) },
          { name: "team", label: "Team" },
        ]}
      />
      <div className="table-wrap">
        <table>
          <thead><tr>{["Name", "Email", "Role", "Status", ""].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td>{person.email}</td>
                <td>{roleLabel(person.role as Role)}</td>
                <td><Pill value={person.status} /></td>
                <td>
                  {person.status === "invited" ? (
                    <form action={revokeInvite}><input type="hidden" name="id" value={person.id} /><button className="btn-danger">Revoke</button></form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
