variable "region" {
  type        = string
  description = "AWS region for the cluster and VPC"
  default     = "us-east-1"
}

variable "project" {
  type        = string
  description = "Project name, used for tagging and resource names"
  default     = "shopsphere"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "kubernetes_version" {
  type        = string
  description = "EKS cluster Kubernetes version"
  default     = "1.30"
}

variable "node_instance_type" {
  type        = string
  description = "EC2 instance type for managed node group"
  default     = "t3.medium"
}

variable "node_desired_size" {
  type        = number
  description = "Desired number of worker nodes"
  default     = 2
}

variable "node_min_size" {
  type        = number
  description = "Minimum number of worker nodes"
  default     = 1
}

variable "node_max_size" {
  type        = number
  description = "Maximum number of worker nodes"
  default     = 3
}
