# Kubernetes manifests

Per-service Deployments + Services, backed by a single PostgreSQL StatefulSet that hosts five logical databases (one per service).

## Files

| File                  | Contents                                                       |
| --------------------- | -------------------------------------------------------------- |
| `namespace.yml`       | `ecomops` namespace                                            |
| `secret.yml`          | `shopsphere-secrets` (JWT_SECRET, POSTGRES_PASSWORD) — **edit before apply** |
| `configmap.yml`       | `shopsphere-config` (Postgres host/port/user, in-cluster service URLs) |
| `postgres.yml`        | StatefulSet + headless Service + init-SQL ConfigMap            |
| `user-service.yml`    | user-service (port 3001)                                       |
| `deployment.yml`      | product-service (port 3002)                                    |
| `cart-service.yml`    | cart-service (port 3003)                                       |
| `order-service.yml`   | order-service (port 3004)                                      |
| `payment-service.yml` | payment-service (port 3005)                                    |
| `frontend.yml`        | frontend (port 5173)                                           |
| `kustomization.yml`   | applies all of the above                                       |

## Build & push images

The manifests reference `shahryar371/<service>:latest`. Push your local images first:

```bash
# from repo root, after `docker-compose build`
for svc in user-service product-service cart-service order-service payment-service frontend; do
  docker tag ecommerceops-${svc}:latest shahryar371/${svc}:latest
  docker push shahryar371/${svc}:latest
done
```

## Apply

```bash
# edit secret.yml — change JWT_SECRET and POSTGRES_PASSWORD
kubectl apply -k ops/k8s/

# verify
kubectl -n ecomops get pods,svc,pvc,statefulset
kubectl -n ecomops logs statefulset/postgres
```

The Postgres pod runs `db/init/01-create-databases.sql` (mounted from the `postgres-init` ConfigMap) on first boot, creating the five databases. Each service's `DATABASE_URL` is composed at container start from secret + configmap values.

## Reaching the services from your browser

`Service` types are `ClusterIP`. The simplest way to hit them locally:

```bash
kubectl -n ecomops port-forward svc/frontend 5173:5173
kubectl -n ecomops port-forward svc/user-service 3001:3001
kubectl -n ecomops port-forward svc/product-service 3002:3002
kubectl -n ecomops port-forward svc/cart-service 3003:3003
kubectl -n ecomops port-forward svc/order-service 3004:3004
```

Then open http://localhost:5173. The frontend's `VITE_*_API` env vars already point at `localhost:300X`, so port-forwarding lines up.

For a real cluster, swap the frontend `Service` to `LoadBalancer` (or add an Ingress) and put each backend behind a path on the same Ingress to avoid CORS + per-host port-forwarding.

## Inspecting Postgres

```bash
kubectl -n ecomops exec -it statefulset/postgres -- psql -U shopsphere postgres
\l                                # list databases
\c shopsphere_products            # connect to one
\dt                               # list tables
SELECT * FROM products LIMIT 5;
```

## Notes

- **Stateless services.** All five backends are now stateless and use `RollingUpdate`. They can be scaled (`kubectl scale deploy/cart-service --replicas=3`) without contention.
- **Postgres scaling caveat.** The Postgres StatefulSet is `replicas: 1`. To run multiple replicas you'd need a Postgres operator (Zalando, CloudNativePG, etc.) or split into per-service Postgres instances.
- **Seed race.** `product-service` seeds 10 products if the table is empty. With `replicas > 1` two pods could race and double-seed. Either keep product-service at `replicas: 1` or move the seed into a `Job` / `initContainer`.
- **Image pull policy.** `IfNotPresent` so locally-loaded images (kind/minikube/k3s) work without registry pulls.
- **Health checks.** Each service exposes `/health`; readiness/liveness probes use it. Postgres uses `pg_isready`.
- **Storage size.** `postgres.yml`'s PVC is sized at the value in the manifest — adjust `volumeClaimTemplates.resources.requests.storage` to match your environment.
