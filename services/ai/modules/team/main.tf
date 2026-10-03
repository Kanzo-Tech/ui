# One tenant's access to the gateway: a team carrying its budget, and one service-account
# key the tenant's server presents. The key never reaches a browser; the application's
# server is the BFF that injects it. Configure the `litellm` provider with the gateway's
# management URL and master key (modules/gateway's `master_key`).

resource "litellm_team" "this" {
  team_id         = var.team_id
  team_alias      = var.alias
  models          = var.models
  max_budget      = var.max_budget
  budget_duration = var.max_budget == null ? null : var.budget_duration
}

resource "litellm_key" "this" {
  key                = var.key
  key_alias          = var.team_id
  service_account_id = var.team_id
  team_id            = litellm_team.this.team_id
}
