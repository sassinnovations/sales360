# AI Sales360

Local web app for the AI Sales360 CRM: multi-tenant workspaces, B2B pipeline, IT staffing, commercial records, and an assistant that answers from data the signed-in role can see.

## Run

```bash
cd ai-sales360
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first sign-in creates `data/sales360.db` and loads the Northstar Systems demo.

Owner sign-in: `info@sassinnovations.com` / `Sass@2021`. Other seeded users use `Sales360!`.

| Person | Role | Email |
| --- | --- | --- |
| Leah Okonkwo | BDM | leah.okonkwo@northstar.example |
| Arun Mehta | Sales manager | arun.mehta@northstar.example |
| Rohan Iyer | Recruiter | rohan.iyer@northstar.example |
| Maya Chen | Delivery | maya.chen@northstar.example |
| Nora Khan | Finance | nora.khan@northstar.example |
| Sam Patel | Auditor | sam.patel@northstar.example |
| Priya Shah | Owner | info@sassinnovations.com |

Delete `data/sales360.db` and restart to rebuild the demo. There is no external mail, model, or payment provider in this build. Reset codes and invitation links are shown in the app.
