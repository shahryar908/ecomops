# ShopSphere

A 5-microservice e-commerce platform with a React frontend, full local Docker stack, Kubernetes manifests for cloud deploy, Terraform for AWS infrastructure, and a GitOps pipeline driven by GitHub Actions + ArgoCD.

## Table of contents

- [Architecture](#architecture)
- [Stack](#stack)
- [Folder layout](#folder-layout)
- [Running locally (docker-compose)](#running-locally-docker-compose)
- [Inter-service contract](#inter-service-contract)
- [DevOps](#devops)
  - [Kubernetes manifests](#kubernetes-manifests)
  - [Terraform — VPC + EKS on AWS](#terraform--vpc--eks-on-aws)
  - [CI/CD pipeline (GitHub Actions)](#cicd-pipeline-github-actions)
  - [GitOps with ArgoCD](#gitops-with-argocd)
  - [Day-2 operations](#day-2-operations)
  - [Troubleshooting](#troubleshooting)
  - [Tearing down](#tearing-down)
- [Out of scope](#out-of-scope-intentional)

## Architecture

```mermaid
flowchart TD
    subgraph Frontend
        UI[React + Vite<br/>Port 5173]
    end

    subgraph "Backend Microservices"
        User[User Service<br/>3001<br/>JWT Issuer]
        Product[Product Service<br/>3002<br/>Catalog + Stock]
        Cart[Cart Service<br/>3003<br/>User Cart]
        Order[Order Service<br/>3004<br/>Orchestrator]
        Payment[Payment Service<br/>3005<br/>Mock Processor]
    end

    subgraph Database
        Postgres[(PostgreSQL 16<br/>5 Logical Databases)]
    end

    UI -->|axios| User
    UI -->|axios| Product
    UI -->|axios| Cart
    UI -->|axios| Order
    UI -->|axios| Payment

    User <--> Postgres
    Product <--> Postgres
    Cart <--> Postgres
    Order <--> Postgres
    Payment <--> Postgres

    Order -->|Check + Decrement Stock| Product
    Order -->|Process Payment| Payment
```

| Service          | Port | Database               | Responsibility                                  |
| ---------------- | ---- | ---------------------- | ----------------------------------------------- |
| user-service     | 3001 | shopsphere_users       | Register, login, profile (JWT issuer)           |
| product-service  | 3002 | shopsphere_products    | Product catalog + stock                         |
| cart-service     | 3003 | shopsphere_cart        | Per-user cart                                   |
| order-service    | 3004 | shopsphere_orders      | Orchestrates checkout (cart → stock → payment)  |
| payment-service  | 3005 | shopsphere_payments    | Mock payment processor (90% / 10% fail)         |
| frontend         | 5173 | —                      | React UI                                        |

## Stack

- **Backend:** Node.js + Express + Drizzle ORM + postgres.js
- **Database:** PostgreSQL 16 — one instance, five logical databases
- **Frontend:** Vite + React 18 + react-router-dom + axios (state via React Context)
- **Auth:** Shared JWT secret, validated locally by each service
- **Local orchestration:** docker-compose
- **Cloud orchestration:** Kubernetes (EKS) via Kustomize
- **Infrastructure-as-code:** Terraform (VPC + EKS)
- **CI/CD:** GitHub Actions (build + push to Docker Hub, bump tags in `kustomization.yml`)
- **GitOps:** ArgoCD watches `ops/k8s/`, syncs on every commit

## Folder layout

```mermaid
graph TD
    Root[ecommerceops/] --> Frontend[frontend/]
    Root --> User[user-service/]
    Root --> Product[product-service/]
    Root --> Cart[cart-service/]
    Root --> Order[order-service/]
    Root --> Payment[payment-service/]
    Root --> DB[db/init/]
    Root --> Ops[ops/]
    Root --> CI[.github/workflows/]

    Ops --> K8s[k8s/ <br/>Kubernetes manifests]
    Ops --> Argo[argocd/]
    Ops --> Infra[infra/ <br/>Terraform]
```

```
ecommerceops/
├── frontend/                       # Vite + React
├── user-service/                   # :3001
├── product-service/                # :3002
├── cart-service/                   # :3003
├── order-service/                  # :3004
├── payment-service/                # :3005
├── db/init/                        # Postgres init SQL (creates the 5 DBs)
├── docker-compose.yml
├── .env.example
├── ops/
│   ├── k8s/                        # Kubernetes manifests (kustomize)
│   │   ├── namespace.yml
│   │   ├── secret.yml
│   │   ├── configmap.yml
│   │   ├── postgres.yml            # StatefulSet + headless Service + init ConfigMap
│   │   ├── user-service.yml
│   │   ├── deployment.yml          # product-service
│   │   ├── cart-service.yml
│   │   ├── order-service.yml
│   │   ├── payment-service.yml
│   │   ├── frontend.yml
│   │   └── kustomization.yml       # resources + images: block (CI bumps tags here)
│   ├── argocd/
│   │   ├── application.yml         # Argo CD Application pointing at ops/k8s/
│   │   └── README.md
│   └── infra/                      # Terraform: VPC + EKS on AWS
│       ├── versions.tf
│       ├── variables.tf
│       ├── main.tf
│       ├── outputs.tf
│       └── README.md
└── .github/workflows/ci.yml        # Build + push + tag-bump
```

Each backend service has the same internal layout — `src/index.js` (bootstrap), `src/db.js` (Drizzle + postgres.js), `src/schema.js` (tables), `src/middleware/auth.js` (JWT verify), `src/routes/`, `src/controllers/`. Tables are created on startup with `CREATE TABLE IF NOT EXISTS` — no migration tooling.

## Running locally (docker-compose)

```bash
cp .env.example .env          # set JWT_SECRET
docker-compose up --build
```

Open http://localhost:5173 — register, browse products, add to cart, checkout. Postgres bootstraps the five databases via `db/init/01-create-databases.sql` on first boot. The `product-service` seeds 10 sample products.

Run a single service standalone:

```bash
cd user-service && npm install && npm run dev
```

To wipe all local state (Postgres volume + cached images):

```bash
docker-compose down -v
```

## Inter-service contract

- **Auth.** Each service validates JWTs locally with `JWT_SECRET`. The `order-service` forwards the inbound `Authorization` header on its downstream calls — there are no service-to-service tokens.
- **Service discovery.** In docker-compose: container names (`http://product-service:3002`). In k8s: ClusterIP service DNS (same name). The frontend calls `localhost:300X` from the browser.
- **Stock decrement** (`PUT /api/products/:id/stock`) is atomic via Drizzle `sql\`stock - ${qty}\`` with a `WHERE stock >= qty` guard. Negative quantities re-add stock (used by `order-service` to revert on partial-failure during checkout).

---

# DevOps

This section covers everything under `ops/` plus the CI workflow — the full lifecycle from empty AWS account to running cluster with GitOps reconciliation.

## Deployment topology (cloud)

```mermaid
flowchart TD
    Repo[GitHub repo] -->|push to main| GHA[GitHub Actions]
    GHA -->|build + push| Hub["Docker Hub<br/>shahryar371/&lt;svc&gt;:&lt;sha&gt;"]
    GHA -->|kustomize edit set image| Bot["bot commit<br/>'[skip ci]'"]
    Bot --> Repo2[GitHub repo updated]
    Repo2 -->|ArgoCD watches main| Argo[ArgoCD]
    Argo -->|kubectl apply| EKS[EKS cluster]
    EKS --> Deploys[Deployments × 6<br/>frontend + 5 backends]
    EKS --> Svcs[Services × 6<br/>ClusterIP]
    EKS --> SS[StatefulSet: postgres<br/>1 replica, EBS-backed PVC]
```

## Kubernetes manifests

Located in `ops/k8s/`. Applied via Kustomize.

### Resources

| File                  | Resources                                                            |
| --------------------- | -------------------------------------------------------------------- |
| `namespace.yml`       | `ecomops` namespace                                                  |
| `secret.yml`          | `shopsphere-secrets` — `JWT_SECRET`, `POSTGRES_PASSWORD`             |
| `configmap.yml`       | `shopsphere-config` — Postgres host/port/user, in-cluster service URLs |
| `postgres.yml`        | StatefulSet (1 replica), headless Service, init-SQL ConfigMap        |
| `user-service.yml`    | user-service Deployment + Service (ClusterIP, port 3001)             |
| `deployment.yml`      | product-service Deployment + Service (ClusterIP, port 3002)          |
| `cart-service.yml`    | cart-service Deployment + Service (ClusterIP, port 3003)             |
| `order-service.yml`   | order-service Deployment + Service (ClusterIP, port 3004)            |
| `payment-service.yml` | payment-service Deployment + Service (ClusterIP, port 3005)          |
| `frontend.yml`        | frontend Deployment + Service (ClusterIP, port 5173)                 |
| `kustomization.yml`   | resource list + `images:` block (CI rewrites this on each build)     |

### How DATABASE_URL is built

Each service's manifest pulls `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PORT` from `shopsphere-config` and `POSTGRES_PASSWORD` from `shopsphere-secrets`, then composes `DATABASE_URL` using k8s env-var interpolation (`$(VAR)` syntax). The password never appears in plaintext in the manifest.

### Apply manually

```bash
kubectl apply -k ops/k8s/

# verify
kubectl -n ecomops get pods,svc,pvc,statefulset
kubectl -n ecomops logs statefulset/postgres
kubectl -n ecomops logs deploy/order-service
```

### Reaching the services from your browser

Without an Ingress / LoadBalancer, port-forward each service:

```bash
kubectl -n ecomops port-forward svc/frontend 5173:5173
kubectl -n ecomops port-forward svc/user-service 3001:3001
kubectl -n ecomops port-forward svc/product-service 3002:3002
kubectl -n ecomops port-forward svc/cart-service 3003:3003
kubectl -n ecomops port-forward svc/order-service 3004:3004
```

Open http://localhost:5173. The frontend's `VITE_*_API` env vars already point at `localhost:300X`, so port-forwarding lines up.

For a real cluster, swap the frontend `Service` to `LoadBalancer` (or add an Ingress) and put each backend behind a path on the same Ingress to avoid CORS + per-host port-forwarding.

## Terraform — VPC + EKS on AWS

Located in `ops/infra/`. Uses the official `terraform-aws-modules/vpc/aws` and `terraform-aws-modules/eks/aws` modules.

### What it provisions

- **VPC** — `10.0.0.0/16` across 2 AZs, with public + private subnets, internet gateway, and a single NAT gateway. Subnets carry the EKS-required tags (`kubernetes.io/role/elb`, `kubernetes.io/role/internal-elb`).
- **EKS cluster** — `shopsphere-eks` (Kubernetes 1.30), public + private endpoint access, cluster creator gets admin permission automatically.
- **Managed node group** — 2× `t3.medium` by default, autoscaling 1–3, AL2 x86_64.
- **IAM roles** for cluster + nodes are created by the EKS module.

### Prerequisites

- AWS credentials available (`~/.aws/credentials` or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`)
- `terraform >= 1.5`, `awscli`, `kubectl`

### Run

```bash
cd ops/infra
terraform init
terraform plan
terraform apply           # ~15-20 minutes for EKS to come up

$(terraform output -raw kubeconfig_command)
kubectl get nodes
```

### Customizing

Override defaults in a `terraform.tfvars` (gitignored) or via CLI:

```hcl
# terraform.tfvars
region              = "us-west-2"
node_instance_type  = "t3.large"
node_desired_size   = 3
```

```bash
terraform apply -var="region=us-west-2"
```

### Variables

| Name                 | Default       | Purpose                              |
| -------------------- | ------------- | ------------------------------------ |
| `region`             | `us-east-1`   | AWS region                           |
| `project`            | `shopsphere`  | Tag + resource name prefix           |
| `vpc_cidr`           | `10.0.0.0/16` | VPC CIDR                             |
| `kubernetes_version` | `1.30`        | EKS version                          |
| `node_instance_type` | `t3.medium`   | Worker EC2 instance type             |
| `node_desired_size`  | `2`           | Initial node count                   |
| `node_min_size`      | `1`           | ASG min                              |
| `node_max_size`      | `3`           | ASG max                              |

### Cost notes

The default config runs ~$200-250/mo (EKS control plane $73 + 2× t3.medium $60 + NAT gateway $32 + EBS volumes + data transfer). Drop to one node and remove NAT (set `enable_nat_gateway = false`) for a cheaper learning setup if you're OK with workers in a public subnet.

### Tear down

Always remove the workloads **before** destroying infra — leftover Service-managed Load Balancers and EBS volumes will block VPC destruction:

```bash
kubectl delete -k ops/k8s/
terraform destroy
```

## CI/CD pipeline (GitHub Actions)

File: `.github/workflows/ci.yml`. Triggers on push to `main` and pull requests.

```mermaid
flowchart TD
    Push[Push to main] --> CI[GitHub Actions]
    CI --> Detect{Changes Detected?}
    Detect -->|Yes| Build[Build & Push Images]
    Build --> Update[Update kustomization.yml]
    Update --> Commit[Commit changes<br/>with skip ci]
    Commit --> Argo[ArgoCD]
    Argo --> Deploy[Sync to EKS Cluster]
```

### Jobs

`detect-changes` ──▶ `build-and-push` (matrix) ──▶ `update-manifests`

**1. `detect-changes`** uses `dorny/paths-filter` to figure out which of the six service folders changed. Output is a JSON array consumed by the next job's matrix strategy.

**2. `build-and-push`** runs once per changed service. Uses Docker Buildx + GHA cache (`type=gha`, scoped per service so layers are reused). On push to main: logs into Docker Hub, builds, and pushes both `:latest` and `:<commit-sha>` tags. On PRs: builds without pushing (validates Dockerfile).

**3. `update-manifests`** runs only on push to main, only if at least one image was pushed. Installs Kustomize, runs `kustomize edit set image shahryar371/<svc>=...:${{ github.sha }}` for each rebuilt service in `ops/k8s/`, commits the change as `github-actions[bot]` with `[skip ci]` in the message, and pushes back to `main`. The `[skip ci]` flag prevents the bot's commit from re-triggering CI (no infinite loop).

### Required GitHub repo secrets

- `DOCKERHUB_USERNAME` — your Docker Hub username
- `DOCKERHUB_TOKEN` — Docker Hub **access token**, not your password (Docker Hub → Account Settings → Personal access tokens)

```bash
# using gh CLI
gh secret set DOCKERHUB_USERNAME --body "shahryar371"
gh secret set DOCKERHUB_TOKEN    --body "$(read -s; echo $REPLY)"   # paste token, hidden
```

### Image tag strategy

CI pushes two tags per build:

- `:latest` — moving pointer (handy for ad-hoc `kubectl rollout restart`)
- `:<sha>` — immutable, this is what `kustomize edit set image` writes into the manifest

The git-tracked tag is always the immutable SHA, so cluster state is reproducible from any commit. The `:latest` tag is convenience-only.

## GitOps with ArgoCD

File: `ops/argocd/application.yml`. ArgoCD watches `ops/k8s/` on the `main` branch and reconciles the cluster to match.

### The full loop

```mermaid
flowchart LR
    A[push to main] --> B[GHA: detect changed services]
    B --> C["build matrix<br/>docker.io/shahryar371/&lt;svc&gt;:&lt;sha&gt;"]
    C --> D[kustomize edit set image]
    D --> E["bot commit<br/>'ci: bump tags [skip ci]'"]
    E --> F[ArgoCD detects drift]
    F --> G[kubectl apply]
    G --> H[Rolling update on EKS]
```

### Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd wait --for=condition=available deployment --all --timeout=5m
```

Get the initial admin password and port-forward the UI:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d
kubectl -n argocd port-forward svc/argocd-server 8080:443
# open https://localhost:8080  (user: admin)
```

### Register the app

Edit `ops/argocd/application.yml` — set `spec.source.repoURL` to your real Git URL — then:

```bash
kubectl apply -f ops/argocd/application.yml
```

For a private repo, register credentials first:

```bash
argocd repo add https://github.com/<user>/ecommerceops.git \
  --username <github-user> --password <personal-access-token>
```

### Sync policy

The Application uses `automated.prune: true` and `automated.selfHeal: true`:

- **Prune** — resources removed from the manifests are deleted from the cluster.
- **Self-heal** — manual `kubectl edit` changes get reverted to match git.

If that's too aggressive for you, set `automated: null` to require manual `argocd app sync shopsphere`.

## Day-2 operations

### Scaling a service

```bash
kubectl -n ecomops scale deploy/cart-service --replicas=3
```

All five backend services are stateless (Postgres holds state) and use `RollingUpdate`, so they scale freely. **Caveats:**

- `product-service` seeds 10 products if the `products` table is empty. With `replicas > 1`, two pods could race and double-seed. Either keep it at `replicas: 1` or move the seed into a `Job` / `initContainer`.
- The Postgres `StatefulSet` is `replicas: 1`. To run replicas you'd need a Postgres operator (CloudNativePG, Zalando, etc.) or split into per-service Postgres instances.

### Inspecting Postgres

```bash
kubectl -n ecomops exec -it statefulset/postgres -- psql -U shopsphere postgres
\l                              # list databases
\c shopsphere_products          # connect
\dt                             # list tables
SELECT * FROM products LIMIT 5;
```

Or port-forward and use a local client:

```bash
kubectl -n ecomops port-forward svc/postgres 5432:5432
psql postgres://shopsphere:shopsphere@localhost:5432/shopsphere_products
```

### Rotating secrets

Edit `ops/k8s/secret.yml` (or apply a fresh one), commit, push. ArgoCD picks up the change. Then bounce the pods to pick up the new env values:

```bash
kubectl -n ecomops rollout restart deploy
```

For production: don't store real secrets in git. Use Sealed Secrets, External Secrets, or AWS Secrets Manager + the External Secrets Operator.

### Forcing a redeploy

CI normally bumps tags on every push to main. To re-roll without a code change:

```bash
kubectl -n ecomops rollout restart deploy/user-service
```

ArgoCD won't undo this because it doesn't change the manifest — but `selfHeal` won't fire either since there's no drift.

### Rolling back

Every commit is an immutable, tagged image, and `kustomization.yml` history shows which SHA was deployed when. To roll back:

```bash
git revert <commit-that-bumped-tags>
git push origin main
# ArgoCD syncs the previous tag automatically
```

Or roll back imperatively:

```bash
kubectl -n ecomops rollout undo deploy/user-service
```

## Troubleshooting

### Pods stuck in `ImagePullBackOff`

Image not in the registry yet (or wrong tag). Check:

```bash
kubectl -n ecomops describe pod <pod-name>
docker manifest inspect docker.io/shahryar371/user-service:<sha>
```

If the image exists but the cluster can't pull, you may need a `imagePullSecret` for private images (Docker Hub free tier hits rate limits for unauthenticated pulls).

### `ContainerCreating` for a long time

Usually a missing PVC or pulling a large image on a slow node. Check:

```bash
kubectl -n ecomops get events --sort-by=.lastTimestamp
```

### Service crash-loops with "DATABASE_URL is required" or connection-refused

- Postgres pod isn't ready yet — check `kubectl -n ecomops get pods` and wait for `postgres-0` to be `Running 1/1`.
- Wrong credentials — verify `secret.yml` was applied and `POSTGRES_PASSWORD` matches what Postgres started with. If you changed the password after Postgres initialized, you need to either reset Postgres' password from inside the container or delete the PVC and restart.

### CI keeps looping

The `[skip ci]` token in the bot commit message is what prevents this. If the loop fires, check that the workflow is reading commit messages — older `actions/checkout` versions don't fetch commit metadata. The current setup pins `actions/checkout@v4` which is fine.

### `terraform apply` fails on `aws_eks_cluster`

Common causes: IAM permissions (your AWS user needs `eks:*`, `ec2:*`, `iam:*`), or the EKS service-linked role doesn't exist yet. Run `aws iam create-service-linked-role --aws-service-name eks.amazonaws.com` once per account.

### `terraform destroy` hangs on the VPC

Workloads weren't removed first. The Service-managed AWS Load Balancer (or EBS volumes for Postgres' PVC) holds ENIs in the subnets. Run `kubectl delete -k ops/k8s/` first, or manually delete the LB / volumes from the AWS Console.

## Tearing down

In order:

```bash
# 1. delete the workloads (releases LBs, PVCs, EBS volumes)
kubectl delete -k ops/k8s/

# 2. delete ArgoCD if you installed it
kubectl delete namespace argocd

# 3. destroy the AWS infra
cd ops/infra && terraform destroy
```

Local-only:

```bash
docker-compose down -v
```

## Out of scope (intentional)

- Automated tests (unit/integration)
- Real payment provider
- Image upload (use `image_url` strings)
- JWT refresh tokens, password reset flow
- Admin UI for product CRUD (admin endpoint exists; UI deferred)
- Per-environment overlays (only one Kustomize base today)
- Centralized logging / metrics / tracing (no Prometheus, Loki, OTel yet)
- Postgres HA / read replicas (single StatefulSet replica)
- ECR / private registry (Docker Hub public images)
- Ingress + DNS + TLS (port-forward today)
