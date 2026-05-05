# Terraform — VPC + EKS

Provisions an AWS VPC (2 AZs, public + private subnets, single NAT gateway) and an EKS cluster with one managed node group. Uses the official `terraform-aws-modules` for VPC and EKS — minimal config, production patterns.

## Files

| File           | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `versions.tf`  | Terraform + AWS provider version pins, default tags  |
| `variables.tf` | Inputs (region, project, instance type, node sizing) |
| `main.tf`      | VPC + EKS module calls                               |
| `outputs.tf`   | Cluster name, endpoint, kubeconfig command, IDs      |

## Prerequisites

- AWS account + credentials available (`~/.aws/credentials` or env vars)
- `terraform >= 1.5`
- `awscli` and `kubectl`

## Usage

```bash
cd ops/infra
terraform init
terraform plan
terraform apply        # ~15-20 minutes for EKS to come up
```

After apply, point `kubectl` at the new cluster:

```bash
$(terraform output -raw kubeconfig_command)

# verify
kubectl get nodes
```

Then deploy ShopSphere onto it:

```bash
kubectl apply -k ../k8s/
kubectl -n ecomops get pods
```

## Tearing down

```bash
kubectl delete -k ../k8s/      # remove workloads first so LBs/PVCs clean up
terraform destroy
```

The `kubectl delete` step is important — if you skip it, leftover Service-managed AWS Load Balancers and EBS volumes will block VPC destruction.

## Customizing

Override defaults via a `terraform.tfvars` file (gitignored):

```hcl
region             = "us-west-2"
node_instance_type = "t3.large"
node_desired_size  = 3
```

Or pass on the CLI: `terraform apply -var="region=us-west-2"`.

## Notes

- **Single NAT gateway.** Saves money. For HA across AZs, set `single_nat_gateway = false` in `main.tf`.
- **Public + private subnets.** Worker nodes live in private subnets; load balancers can place ENIs in public subnets. Subnets are tagged so EKS auto-discovers them for ELB/ALB.
- **No state backend.** State lives in `terraform.tfstate` next to the code. For team use, swap in an S3 + DynamoDB backend.
- **No ECR.** Per project decision — images come from Docker Hub (`shahryar371/*`). The k8s manifests already point there.
- **Postgres.** Currently runs as an in-cluster `StatefulSet` (see `ops/k8s/postgres.yml`). To swap to RDS, delete that file and add an `aws_db_instance` here, then update each service's `DATABASE_URL` to point at the RDS endpoint.
