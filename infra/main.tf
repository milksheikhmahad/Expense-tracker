data "azurerm_client_config" "current" {}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

locals {
  name   = "${var.project}-${random_string.suffix.result}"
  flat   = "${var.project}${random_string.suffix.result}"
  image  = "ghcr.io/${lower(var.github_repo)}/api:latest"
  tags   = { project = "intelligent-expense-tracker", managed_by = "terraform" }
  ocr_on = var.enable_receipt_ocr
  ai_on  = var.azure_openai_deployment != ""
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = local.tags
}

# ───────────── Monitoring (replaces CloudWatch) ─────────────
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "log-${local.name}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 0.5 # hard cap so logs can never eat the student credit
  tags                = local.tags
}

resource "azurerm_application_insights" "appi" {
  name                = "appi-${local.name}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  workspace_id        = azurerm_log_analytics_workspace.logs.id
  application_type    = "web"
  tags                = local.tags
}

# ───────────── Blob Storage for receipts (replaces S3) ─────────────
resource "azurerm_storage_account" "st" {
  name                            = "st${local.flat}"
  resource_group_name             = azurerm_resource_group.rg.name
  location                        = azurerm_resource_group.rg.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  tags                            = local.tags
}

resource "azurerm_storage_container" "receipts" {
  name                  = "receipts"
  storage_account_id    = azurerm_storage_account.st.id
  container_access_type = "private"
}

# ───────────── PostgreSQL (replaces RDS) ─────────────
resource "azurerm_postgresql_flexible_server" "pg" {
  name                          = "psql-${local.name}"
  resource_group_name           = azurerm_resource_group.rg.name
  location                      = azurerm_resource_group.rg.location
  version                       = "16"
  administrator_login           = "expenseadmin"
  administrator_password        = var.db_admin_password
  sku_name                      = "B_Standard_B1ms"
  storage_mb                    = 32768
  backup_retention_days         = 7
  public_network_access_enabled = true
  tags                          = local.tags

  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "expense"
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# 0.0.0.0 = "allow Azure services", so the Container Apps can connect.
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.pg.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ───────────── Event pipeline (replaces SNS) ─────────────
resource "azurerm_servicebus_namespace" "sb" {
  name                = "sb-${local.name}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Basic"
  tags                = local.tags
}

resource "azurerm_servicebus_queue" "alerts" {
  name               = "budget-alerts"
  namespace_id       = azurerm_servicebus_namespace.sb.id
  max_delivery_count = 5
}

resource "azurerm_email_communication_service" "email" {
  name                = "email-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  data_location       = "India"
  tags                = local.tags
}

resource "azurerm_email_communication_service_domain" "managed" {
  name              = "AzureManagedDomain"
  email_service_id  = azurerm_email_communication_service.email.id
  domain_management = "AzureManaged"
}

resource "azurerm_communication_service" "acs" {
  name                = "acs-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  data_location       = "India"
  tags                = local.tags
}

resource "azurerm_communication_service_email_domain_association" "link" {
  communication_service_id = azurerm_communication_service.acs.id
  email_service_domain_id  = azurerm_email_communication_service_domain.managed.id
}

# ───────────── Receipt OCR (new "intelligent" piece) ─────────────
resource "azurerm_cognitive_account" "docintel" {
  count                 = local.ocr_on ? 1 : 0
  name                  = "di-${local.name}"
  location              = azurerm_resource_group.rg.location
  resource_group_name   = azurerm_resource_group.rg.name
  kind                  = "FormRecognizer"
  sku_name              = "F0"
  custom_subdomain_name = "di-${local.name}"
  tags                  = local.tags
}

# ───────────── Compute (Container Apps replace EC2/ECS + ELB) ─────────────
resource "azurerm_container_app_environment" "env" {
  name                       = "cae-${local.name}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  tags                       = local.tags
}

locals {
  sender = "DoNotReply@${azurerm_email_communication_service_domain.managed.mail_from_sender_domain}"

  # name → value for every Container App secret
  secret_values = {
    "db-url"     = "postgres://expenseadmin:${urlencode(var.db_admin_password)}@${azurerm_postgresql_flexible_server.pg.fqdn}:5432/expense"
    "jwt"        = var.jwt_secret
    "storage"    = azurerm_storage_account.st.primary_connection_string
    "sb"         = azurerm_servicebus_namespace.sb.default_primary_connection_string
    "acs"        = azurerm_communication_service.acs.primary_connection_string
    "appi"       = azurerm_application_insights.appi.connection_string
    "docintel"   = local.ocr_on ? azurerm_cognitive_account.docintel[0].primary_access_key : ""
    "openai-key" = var.azure_openai_key
  }
  # Only non-sensitive booleans decide which secrets exist.
  secret_names = concat(
    ["db-url", "jwt", "storage", "sb", "acs", "appi"],
    local.ocr_on ? ["docintel"] : [],
    local.ai_on ? ["openai-key"] : [],
  )

  # env var name → secret name
  secret_env = merge(
    {
      DATABASE_URL                          = "db-url"
      JWT_SECRET                            = "jwt"
      AZURE_STORAGE_CONNECTION_STRING       = "storage"
      SERVICEBUS_CONNECTION_STRING          = "sb"
      ACS_CONNECTION_STRING                 = "acs"
      APPLICATIONINSIGHTS_CONNECTION_STRING = "appi"
    },
    local.ocr_on ? { DOCINTEL_KEY = "docintel" } : {},
    local.ai_on ? { AZURE_OPENAI_KEY = "openai-key" } : {},
  )

  plain_env = merge(
    {
      DATABASE_SSL       = "true"
      EMAIL_SENDER       = local.sender
      RECEIPTS_CONTAINER = azurerm_storage_container.receipts.name
      ALERTS_QUEUE       = azurerm_servicebus_queue.alerts.name
      APP_TIMEZONE       = "Asia/Kolkata"
      CORS_ORIGINS       = "https://${azurerm_storage_account.st.primary_web_host},http://localhost:5173"
    },
    local.ocr_on ? { DOCINTEL_ENDPOINT = azurerm_cognitive_account.docintel[0].endpoint } : {},
    local.ai_on ? {
      AZURE_OPENAI_ENDPOINT   = var.azure_openai_endpoint
      AZURE_OPENAI_DEPLOYMENT = var.azure_openai_deployment
    } : {},
  )
}

resource "azurerm_container_app" "api" {
  name                         = "ca-${var.project}-api"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"
  tags                         = local.tags

  dynamic "secret" {
    for_each = toset(local.secret_names)
    content {
      name  = secret.value
      value = local.secret_values[secret.value]
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 0 # scale to zero when idle → near-zero cost
    max_replicas = 3

    container {
      name   = "api"
      image  = local.image
      cpu    = 0.25
      memory = "0.5Gi"

      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = local.secret_env
        content {
          name        = env.key
          secret_name = env.value
        }
      }
    }

    http_scale_rule {
      name                = "http"
      concurrent_requests = "50"
    }
  }

  lifecycle {
    ignore_changes = [template[0].container[0].image] # CI/CD owns the image tag
  }
}

# The budget-alert consumer runs inside the API container (see server.js).
# Student subscriptions get "express" Container Apps environments, which
# don't support the KEDA Service Bus scaler a separate worker app would need.

# ───────────── Frontend hosting: Blob Storage static website ─────────────
# (Static Web Apps is limited to 5 regions, which student region policies
# often block. A storage static website works in any allowed region.)
resource "azurerm_storage_account_static_website" "web" {
  storage_account_id = azurerm_storage_account.st.id
  index_document     = "index.html"
  error_404_document = "index.html" # lets React Router handle deep links
}

# ───────────── GitHub Actions login without any stored password ─────────────
# A managed identity trusts GitHub's OIDC tokens for pushes to main.
# This avoids app registrations, which college tenants often block.
resource "azurerm_user_assigned_identity" "github" {
  name                = "id-${local.name}-github"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "github_main" {
  name                = "github-main"
  resource_group_name = azurerm_resource_group.rg.name
  parent_id           = azurerm_user_assigned_identity.github.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = "https://token.actions.githubusercontent.com"
  subject             = var.github_oidc_subject != "" ? var.github_oidc_subject : "repo:${var.github_repo}:ref:refs/heads/main"
}

resource "azurerm_role_assignment" "github_rg" {
  scope                = azurerm_resource_group.rg.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
}
