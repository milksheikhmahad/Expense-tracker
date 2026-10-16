terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # State is kept locally (terraform.tfstate). Don't delete it — it's how
  # `terraform destroy` knows what to tear down. Don't commit it either.
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    cognitive_account {
      purge_soft_delete_on_destroy = true
    }
  }
  subscription_id = var.subscription_id
  # Providers are registered manually once (see SETUP.md step 3), because
  # student subscriptions don't always allow Terraform to register them.
  resource_provider_registrations = "none"
}
