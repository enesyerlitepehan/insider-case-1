# CI/CD

GitHub Actions deploys the SAM stack on every commit to the dev branch (master).

## Workflows
- `.github/workflows/sam-deploy-dev.yml`: triggers on pushes to `master`.

Workflow steps:
- assume an AWS role via OIDC,
- build with `sam build` and deploy with `sam deploy` using an explicit S3 artifacts bucket and capabilities `CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND`,
  - `CAPABILITY_NAMED_IAM` is required because we create a named `AWS::IAM::ManagedPolicy` in the Messages nested stack,
- pass template parameters for the health stack (AppName, EnvName, ReleaseVersion, EnvTag, ServiceTag). Suffix is omitted to use the template default ("").

### Artifacts S3 bucket
- The workflow resolves (or creates) an artifacts bucket before deploy.
  - If `SAM_ARTIFACTS_BUCKET` env/secret is provided, it will be used as-is.
  - Otherwise it derives a deterministic name: `sam-artifacts-<account-id>-<region>` and creates it if missing (handles the `us-east-1` create-bucket special case).
- `sam deploy` is invoked with `--s3-bucket <bucket>` to ensure nested templates and layer content can be uploaded.

Required IAM permissions for the assumed role:
- `sts:GetCallerIdentity`
- `s3:HeadBucket`, `s3:ListBucket`
- `s3:CreateBucket` (if the derived bucket may need to be created)
- `s3:PutObject`, `s3:AbortMultipartUpload`, `s3:ListBucketMultipartUploads`

## Required secrets
- `AWS_REGION`: target region
- `AWS_ROLE_TO_ASSUME_DEV`: role ARN for dev deploys (master branch)

Optional: adjust stack names, env tags, or suffixes via the `env` section inside the workflow file.
