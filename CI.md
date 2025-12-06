# CI/CD

GitHub Actions deploys the SAM stack on every commit to the dev branch (master).

## Workflows
- `.github/workflows/sam-deploy-dev.yml`: triggers on pushes to `master`.

Workflow steps:
- assume an AWS role via OIDC,
- run `sam build` and `sam deploy` with `--resolve-s3`,
- pass template parameters for the health stack (AppName, EnvName, Suffix, ReleaseVersion, EnvTag, ServiceTag).

## Required secrets
- `AWS_REGION`: target region
- `AWS_ROLE_TO_ASSUME_DEV`: role ARN for dev deploys (master branch)

Optional: adjust stack names, env tags, or suffixes via the `env` section inside the workflow file.
