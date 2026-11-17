import { chooseWorkspace, preauthWorkspaces } from "@/lib/actions/auth";

export const instant = false;

export default async function WorkspacePage() {
  const users = await preauthWorkspaces();
  return (
    <main className="auth-panel">
      <div className="auth-card">
        <h1>Choose a workspace</h1>
        {users.length === 0 ? <p>That sign-in step expired. Go back and try again.</p> : null}
        {users.map((user) => (
          <form key={user.id} action={chooseWorkspace}>
            <input type="hidden" name="userId" value={user.id} />
            <button className="btn-ghost">{user.tenantName}</button>
          </form>
        ))}
      </div>
    </main>
  );
}
