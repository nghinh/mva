terraform {
  required_version = ">= 1.6.0"
}

variable "name" {
  type = string
}

output "app_name" {
  value = var.name
}
