# Health stack

Minimal nested stack example copied from the unified-payment-service layout. It provisions a single healthcheck lambda and exposes it via API Gateway.

## Files
- `template.yaml`: orchestrates nested stacks
- `lambdas.yaml`: defines the `HealthCheck` function
- `api-gateway.yaml`: wires `GET /health` to the lambda

## Deploy (example)
```bash
sam build \
  --template-file template.yaml

sam deploy \
  --stack-name insider-case-health \
  --template-file .aws-sam/build/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    AppName=insider-case \
    EnvName=dev \
    Suffix="" \
    ReleaseVersion=0.0.1 \
    EnvTag=dev \
    ServiceTag=insider-case
```

After deploy the health endpoint is available at the `HealthApiUrl` stack output.

> Notes
- Lambda is written in TypeScript and built with SAM-managed `esbuild`. Entry point is `functions/healthcheck/app.ts`.
- `esbuild` is included as a dependency under `functions/healthcheck/package.json`. If you run locally, ensure `npm install --prefix functions/healthcheck` before `sam build` (SAM will install it automatically during build on CI).
