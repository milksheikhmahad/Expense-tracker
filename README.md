# Cloud-Based Intelligent Expense & Finance Tracker (Azure)

A cloud-native web app for logging and categorizing expenses, seeing where the
money goes, and getting an **email the moment monthly spending crosses the
budget** (warnings at 80% and 100%).

**→ To deploy it, follow [SETUP.md](SETUP.md).**

## Architecture

```
 Browser ──► Blob Storage static website (React)
    │
    └──► Azure Container Apps: API (Node.js/Express, scales 0→3, built-in HTTPS ingress/LB)
             │        │            │                    │
             │        │            │                    └─► Azure AI Document Intelligence (receipt OCR)
             │        │            └─► Azure Blob Storage (receipt images, private + SAS links)
             │        └─► Azure Database for PostgreSQL Flexible Server
             │
             └─ budget crossed ─► Azure Service Bus queue "budget-alerts"
                                       │
                                       ▼
                         Alert consumer (runs in the API container) ─► Azure Communication Services Email ─► user's inbox

 Terraform (azurerm) provisions everything · GitHub Actions (OIDC) builds, tests, deploys
 Azure Monitor + Application Insights: logs, traces, metrics, alert rules
```

## AWS → Azure mapping (vs. the synopsis)

| Synopsis (AWS) | This implementation (Azure) |
|---|---|
| Compute (unspecified) + Elastic Load Balancer / API Gateway | Azure Container Apps with built-in ingress |
| React hosting | Azure Blob Storage static website |
| Amazon RDS (PostgreSQL) | Azure Database for PostgreSQL Flexible Server (B1ms) |
| Amazon S3 | Azure Blob Storage |
| Amazon SNS email | Azure Service Bus → alert consumer → Azure Communication Services Email |
| Amazon CloudWatch | Azure Monitor, Log Analytics, Application Insights |
| LLM API (optional) | Azure OpenAI (optional), with rule-based fallback |
| — | Azure AI Document Intelligence (receipt scanning, auto-categorization) |
| Terraform, GitHub Actions, Docker | Unchanged |

## Modules

| Module | Where |
|---|---|
| User authentication (email + password, JWT) | `backend/src/auth.js` |
| Expense entry & categorization (manual + receipt scan) | `backend/src/routes/expenses.js`, `services/categorizer.js`, `services/receiptOcr.js` |
| Analytics & visualization | `backend/src/routes/analytics.js`, `frontend/src/pages/Dashboard.jsx` |
| Budget alert & notification (event-driven) | `services/alerts.js` → Service Bus → `services/alertConsumer.js` → `services/email.js` |
| AI insights | `services/insights.js`, `frontend/src/pages/Insights.jsx` |
| Cloud infrastructure & DevOps | `infra/*.tf`, `.github/workflows/*.yml` |

### How the budget alert works
1. `POST /api/expenses` saves the expense.
2. The API compares the month total before and after it against the budget (`crossedThresholds`).
3. For each newly crossed threshold, a row is inserted into `budget_alerts`. A unique
   (user, month, threshold) constraint makes each alert fire once per month.
4. An event is published to the Service Bus queue.
5. The Service Bus consumer (running inside the API container) receives it, emails the user
   through Azure Communication Services and marks the alert `sent`.
6. If sending fails 5 times, the message is dead-lettered, which fires an Azure Monitor alert.

## Project layout
```
backend/    Express API + Service Bus alert consumer, unit tests
frontend/   React + Vite + Recharts
infra/      Terraform for all Azure resources
.github/    CI (tests, build, terraform validate) and Deploy workflows
docker-compose.yml   local Postgres + Azurite + API
```

## Tests
```bash
cd backend && npm install && npm test
```
