# Deprecated: Use Oracle Checklist

AWS deployment is no longer the recommended path for this project.

Use:

```text
ORACLE_24H_ALWAYS_FREE_DEPLOYMENT_STEP_BY_STEP.txt
```

Quick Oracle target:

- Provider: Oracle Cloud Infrastructure
- Plan: Always Free
- Shape: `VM.Standard.A1.Flex`
- Recommended size: 1 OCPU / 6 GB or 2 OCPU / 12 GB
- Runtime: Docker
- App port: `8000`

The active runtime files are already Oracle-oriented:

- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `config.py`
- `README.md`
