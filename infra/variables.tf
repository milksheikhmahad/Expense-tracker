variable "subscription_id" {
  description = "Your Azure for Students subscription id (az account show --query id -o tsv)"
  type        = string
}

variable "project" {
  description = "Short lowercase name used in resource names"
  type        = string
  default     = "expensetrk"
  validation {
    condition     = can(regex("^[a-z0-9]{3,12}$", var.project))
    error_message = "Use 3-12 lowercase letters/digits."
  }
}

variable "location" {
  description = "Region for most resources. Must be in your subscription's allowed-regions policy."
  type        = string
  default     = "centralindia"
}

variable "swa_location" {
  description = "Region for Static Web Apps metadata (limited list: eastasia, eastus2, westeurope, centralus, westus2)"
  type        = string
  default     = "eastasia"
}

variable "github_repo" {
  description = "GitHub repo that may deploy, as owner/name (e.g. mahad/expense-tracker)"
  type        = string
}

variable "alert_email" {
  description = "Email that receives infrastructure (Azure Monitor) alarms"
  type        = string
}

variable "db_admin_password" {
  description = "PostgreSQL admin password (8+ chars, upper, lower, digit)"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Random string used to sign login tokens (32+ chars)"
  type        = string
  sensitive   = true
}

variable "enable_receipt_ocr" {
  description = "Create a free (F0) Azure AI Document Intelligence resource for receipt scanning"
  type        = bool
  default     = true
}

variable "azure_openai_endpoint" {
  description = "Optional: existing Azure OpenAI endpoint for AI insights"
  type        = string
  default     = ""
}

variable "azure_openai_key" {
  description = "Optional: Azure OpenAI key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_openai_deployment" {
  description = "Optional: Azure OpenAI deployment name (e.g. gpt-4o-mini)"
  type        = string
  default     = ""
}
