output "frontend_url" {
  value = "https://${azurerm_storage_account.st.primary_web_host}"
}

output "api_url" {
  value = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

output "email_sender" {
  value = local.sender
}

# ── Copy these into GitHub → Settings → Secrets and variables → Actions ──
output "github_variables" {
  description = "Add each as a repository VARIABLE (Variables tab)"
  value = {
    AZURE_CLIENT_ID       = azurerm_user_assigned_identity.github.client_id
    AZURE_TENANT_ID       = data.azurerm_client_config.current.tenant_id
    AZURE_SUBSCRIPTION_ID = var.subscription_id
    AZURE_RESOURCE_GROUP  = azurerm_resource_group.rg.name
    API_APP_NAME          = azurerm_container_app.api.name
    WEB_STORAGE_ACCOUNT   = azurerm_storage_account.st.name
    VITE_API_URL          = "https://${azurerm_container_app.api.ingress[0].fqdn}"
  }
}

output "postgres_server" {
  description = "Name for az postgres flexible-server start/stop"
  value       = azurerm_postgresql_flexible_server.pg.name
}
