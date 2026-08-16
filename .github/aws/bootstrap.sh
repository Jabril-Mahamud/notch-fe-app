#!/usr/bin/env bash
# Phase 2 bootstrap. Creates the two ECR repositories and the GitHub OIDC role
# that Actions assumes to push to them. Run once, by hand, before the cluster
# exists. Idempotent: re-running only updates the role's policies.
set -euo pipefail

REGION=eu-west-1
ACCOUNT=570056717182
ROLE=notch-gha-ecr
HERE=$(cd "$(dirname "$0")" && pwd)

for repo in notch-frontend notch-backend; do
  echo "== ecr: $repo"
  aws ecr create-repository --repository-name "$repo" --region "$REGION" \
    --image-scanning-configuration scanOnPush=true \
    >/dev/null 2>&1 && echo "created" || echo "already exists, leaving it alone"
done

echo "== oidc provider"
if aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn "arn:aws:iam::$ACCOUNT:oidc-provider/token.actions.githubusercontent.com" \
  >/dev/null 2>&1; then
  echo "already exists"
else
  # AWS no longer validates this thumbprint for GitHub, but the argument is
  # still required.
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null
  echo "created"
fi

echo "== role: $ROLE"
if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$ROLE" \
    --policy-document "file://$HERE/trust-policy.json"
  echo "trust policy updated"
else
  aws iam create-role --role-name "$ROLE" \
    --description "GitHub Actions pushes notch images to ECR" \
    --assume-role-policy-document "file://$HERE/trust-policy.json" >/dev/null
  echo "created"
fi

aws iam put-role-policy --role-name "$ROLE" --policy-name ecr-push \
  --policy-document "file://$HERE/ecr-push-policy.json"
echo "ecr-push policy attached"

echo
echo "role arn: arn:aws:iam::$ACCOUNT:role/$ROLE"
echo "after the first workflow run, check real images exist:"
echo "  aws ecr list-images --repository-name notch-backend  --region $REGION"
echo "  aws ecr list-images --repository-name notch-frontend --region $REGION"
