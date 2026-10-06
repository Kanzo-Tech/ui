variable "realm_id" {
  description = "The realm the API trusts: the platform's one realm."
  type        = string
}

variable "client_id" {
  description = "The API's name in the realm. It is the `aud` its tokens carry and the scope an application asks for, so the API validates `aud` against exactly this."
  type        = string
}

variable "name" {
  type    = string
  default = null
}

variable "description" {
  type    = string
  default = ""
}
