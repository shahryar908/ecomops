# ArgoCD GitOps

ArgoCD watches `ops/k8s/` in this repo and reconciles the cluster to match. CI updates the image tags in `ops/k8s/kustomization.yml` after every merge to `main`; ArgoCD picks up the change and rolls the new pods.

## The loop

```
push to main
   │
   ▼
GitHub Actions: detect changed services
   │
   ▼
build + push docker.io/shahryar371/<svc>:<sha>
   │
   ▼
kustomize edit set image (in ops/k8s/kustomization.yml)
   │
   ▼
commit "ci: bump image tags to <sha> [skip ci]" and push to main
   │
   ▼
ArgoCD detects the kustomization change
   │
   ▼
ArgoCD applies → kubectl rolls new pods with new image tag
```

## Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Wait for it to come up:

```bash
kubectl -n argocd wait --for=condition=available deployment --all --timeout=5m
```

Get the initial admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
```

Port-forward the UI:

```bash
kubectl -n argocd port-forward svc/argocd-server 8080:443
# open https://localhost:8080  (user: admin)
```

## Register the app

Edit `application.yml` — set `spec.source.repoURL` to your real Git URL — then apply:

```bash
kubectl apply -f ops/argocd/application.yml
```

ArgoCD will sync `ops/k8s/` into the `ecomops` namespace and self-heal any drift.

## Repo permissions

Public repo: nothing else to do.

Private repo: register credentials so ArgoCD can clone it:

```bash
argocd repo add https://github.com/shahryar371/ecommerceops.git \
  --username <github-user> \
  --password <personal-access-token>
```

## Verifying the GitOps loop

1. Push a code change to `main` (e.g., bump a `console.log` in `user-service`).
2. Watch CI → `build-and-push` builds + pushes `:<sha>`, `update-manifests` commits the bump.
3. The new commit lands as `ci: bump image tags to <sha> [skip ci]`.
4. ArgoCD UI flips the `shopsphere` app to **OutOfSync** and (since `automated.selfHeal=true`) immediately syncs.
5. `kubectl -n ecomops rollout status deploy/user-service` shows the rolling update.

## Notes

- `[skip ci]` in the bot's commit message prevents the CI pipeline from re-triggering on its own commit.
- `prune: true` lets ArgoCD delete resources removed from the manifests. If you don't want that, set it to `false`.
- `ServerSideApply=true` avoids the "last-applied-configuration" annotation getting huge.
- For multi-environment setups, copy `application.yml` per env and point each at a different overlay (e.g., `ops/k8s/overlays/staging`, `ops/k8s/overlays/prod`). Today there's just one base — fine for a learning project.
