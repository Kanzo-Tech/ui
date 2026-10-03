variable "team_id" {
  description = "One team per tenant: its spend, limits and logs are kept apart."
  type        = string
}

variable "alias" {
  description = "The name the admin console shows."
  type        = string
}

variable "models" {
  description = "The aliases the team may call."
  type        = list(string)
  default     = ["chat", "complete"]
}

variable "max_budget" {
  description = "USD per budget_duration. Null: unlimited."
  type        = number
  default     = null
}

variable "budget_duration" {
  type    = string
  default = "30d"
}

variable "key" {
  description = "A fixed key (development, where compose must know it). Null: LiteLLM generates one."
  type        = string
  default     = null
  sensitive   = true
}
