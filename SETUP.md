# Setup guide — exactly what *you* need to do

Everything marked 👤 is a step only you can do (accounts, passwords, clicks in
the portal). Copy the commands as they are. Commands are written for
**macOS/Linux/Git Bash**; on Windows PowerShell they work the same unless noted.

Total time: about 1–1.5 hours, most of it waiting for Azure.

---

## Part A — Accounts and tools (one time)

### 1. 👤 Activate Azure for Students
1. Open https://azure.microsoft.com/free/students and click **Start free**.
2. Sign in with your **college email**. Do **not** start the normal 30-day
   free trial with that email first — that blocks the student offer.
3. Finish the verification.
4. Open https://portal.azure.com → **Subscriptions**. You should see
   "Azure for Students" with a $100 credit.

### 2. 👤 Install the tools
| Tool | Check it works |
|---|---|
| Git | `git --version` |
| Node.js 20 LTS | `node -v` |
| Azure CLI — https://aka.ms/installazurecli | `az version` |
| Terraform ≥ 1.6 — https://developer.hashicorp.com/terraform/install | `terraform -version` |
| Docker Desktop (only for running locally) | `docker -v` |

### 3. 👤 Log in and register the Azure services
```bash
az login
az account show --query "{name:name, id:id}" -o table     # note the id
```
Register the services this project uses (run each line; takes a few minutes in the background):
```bash
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.Insights
az provider register --namespace Microsoft.DBforPostgreSQL
az provider register --namespace Microsoft.ServiceBus
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.Communication
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.CognitiveServices
az provider register --namespace Microsoft.ManagedIdentity
```
Check progress (all should say `Registered` before step 9):
```bash
az provider list --query "[?contains('Microsoft.App Microsoft.Communication Microsoft.DBforPostgreSQL Microsoft.ServiceBus Microsoft.Web', namespace)].{ns:namespace, state:registrationState}" -o table
```

### 4. 👤 Find your allowed regions
Student subscriptions only allow a few regions.
Portal → search **Policy** → **Assignments** → open
**"Allowed resource deployment regions"** → note the list.
You'll use one of them as `location` in step 8 (`centralindia` if allowed).

### 5. 👤 Set a spending alert
Portal → **Cost Management** → **Budgets** → **+ Add** → $20, email alert at 80%.

---

## Part B — Deploy

### 6. 👤 Put the code on GitHub
Create an **empty** repo on GitHub (no README), e.g. `expense-tracker`. Then,
inside the unzipped project folder:
```bash
git init
git add .
git commit -m "Initial commit: Azure expense tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/expense-tracker.git
git push -u origin main
```
Open the repo's **Actions** tab. Two workflows run:
- **CI** — tests, frontend build, Terraform validate. All should go green.
- **Deploy** — only `test` and `image` run now; this publishes the Docker
  image to GitHub Container Registry. The Azure jobs are skipped until step 10.

### 7. 👤 Make the container image public
Azure needs to pull the image without a password.
GitHub → click your profile picture → **Your profile** → **Packages** tab →
open **expense-tracker/api** → **Package settings** (right side) →
**Change visibility** → **Public**.

> The image contains only app code — no secrets. Secrets are injected by Azure at runtime.

### 8. 👤 Fill in the Terraform variables
```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars`:
| Variable | What to put |
|---|---|
| `subscription_id` | id from step 3 |
| `github_repo` | `<your-username>/expense-tracker`, exactly as in the URL |
| `alert_email` | your email (gets Azure Monitor alarms) |
| `location` | an allowed region from step 4 |
| `db_admin_password` | make one up: 12+ chars, upper + lower + digit |
| `jwt_secret` | any long random string (40+ characters) |

`terraform.tfvars` is git-ignored. **Never commit it, and never paste it anywhere.**

### 9. 👤 Create the infrastructure
```bash
terraform init
terraform plan        # read it: ~25 resources to add
terraform apply       # type "yes"; takes 10–20 min (PostgreSQL is the slow one)
```
If it fails, check the table at the end of this guide, fix the cause, and run
`terraform apply` again — it continues where it stopped.

### 10. 👤 Connect GitHub Actions to Azure
Print the values:
```bash
terraform output github_variables
```
In GitHub → repo **Settings** → **Secrets and variables** → **Actions**:
- **Variables** tab → add each of the 7 entries from `github_variables`
  (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`,
  `AZURE_RESOURCE_GROUP`, `API_APP_NAME`, `WEB_STORAGE_ACCOUNT`, `VITE_API_URL`).

No secrets are needed.

Shortcut if you have the GitHub CLI (`gh auth login` first), run inside `infra/`:
```bash
terraform output -json github_variables | python3 -c "import json,sys;[print(k,v) for k,v in json.load(sys.stdin).items()]" | while read k v; do gh variable set "$k" --body "$v"; done
```

No Azure password is stored anywhere: GitHub logs in through a managed
identity that trusts only pushes to `main` of your repo.

### 11. 👤 Run the full deploy
GitHub → **Actions** → **Deploy** → **Run workflow** → `main`.
All four jobs should be green. The **Smoke test** step prints `{"status":"ok"...}`.

### 12. 👤 Try it
```bash
terraform output frontend_url
```
1. Open the URL and **create an account with an email you can check**.
2. Set the budget to ₹1000 on the **Budget** page.
3. Add an expense of ₹850 → the page shows the 80% warning, and an email arrives.
4. Add ₹200 → "Budget exceeded" → a second email.
5. Check **spam** the first time. The sender is `DoNotReply@<something>.azurecomm.net`.

The first request after idle takes ~10–20 s, because the API scales to zero.
The alert email normally arrives within a few seconds.

---

## Demo day checklist
Run these ~10 minutes before presenting so everything is instant (`RG` and `API` from `terraform output github_variables`; server name from `terraform output postgres_server`):
```bash
az postgres flexible-server start -g <RG> -n <postgres-server-name>   # if you stopped it
az containerapp update -g <RG> -n <API> --min-replicas 1              # no cold start
```
Afterwards set it back to `--min-replicas 0` to save credit.

Things to show:
- **Budget alert** — add an expense, then show the email arriving. Also show Service Bus → queue
  metrics and the API's log stream in the portal (`[alerts] received ...` lines).
- **CI/CD** — change some text in `frontend/src/pages/Login.jsx`, push, show the
  Actions run, and refresh the site.
- **Infrastructure as code** — `terraform plan` shows "No changes". For the rebuild
  claim, run `terraform destroy` then `terraform apply`. Rehearse this before the demo:
  resource names get a new suffix, so redo step 10 afterwards.
- **Monitoring** — Application Insights → **Live metrics** / **Application map**;
  Monitor → **Alerts** (5xx and dead-letter rules).

## Saving credit
- PostgreSQL is the only thing that bills while idle. Stop it when you're not working:
  `az postgres flexible-server stop -g <RG> -n <server>`. Azure auto-starts it after 7 days.
- Everything else scales to zero or is free tier.
- When the project is graded: `cd infra && terraform destroy`.

## Running locally (no Azure needed)
```bash
docker compose up --build             # API on http://localhost:8080
cd frontend && npm install && npm run dev   # UI on http://localhost:5173
```
Alert emails are printed in the API logs instead of being sent. To send real
ones locally, copy `backend/.env.example` to `backend/.env` and fill in the ACS
values (Portal → your Communication Service → Keys).

## If something fails
| Error mentions | Fix |
|---|---|
| `RequestDisallowedByPolicy` / location | Region not allowed. Change `location` in `terraform.tfvars` to an allowed one (step 4) |
| `MissingSubscriptionRegistration` | A provider from step 3 isn't registered yet. Wait a few minutes and re-run |
| PostgreSQL `SKU not available` / quota | Try another allowed region for `location` |
| Cognitive Services `F0` already exists / quota | You already have a free Document Intelligence resource. Set `enable_receipt_ocr = false` |
| Role assignment `AuthorizationFailed` | Your account isn't Owner of the subscription. Check Subscriptions → Access control (IAM) |
| Deploy job: `AADSTS70021 / no matching federated identity` | `github_repo` in tfvars doesn't exactly match the repo, or you pushed to a branch other than `main` |
| Container App stuck: `ImagePullBackOff` / unauthorized | The GHCR package isn't public (step 7) |
| No email | Check spam. Look at the API's **Log stream** in the portal. Look at `budget_alerts.status` in the Dashboard table (`queued` = the alert was published but not processed) |
