# Deprecated: Oracle Always Free Guide Used Instead

This project is no longer documented for AWS Free Tier deployment.

Use the Oracle Cloud Always Free deployment guide instead:

```text
ORACLE_24H_ALWAYS_FREE_DEPLOYMENT_STEP_BY_STEP.txt
```

Reason:

- Oracle Cloud Always Free Ampere A1 provides a larger always-free compute allowance.
- This project is now configured for `VM.Standard.A1.Flex`.
- `Dockerfile`, `docker-compose.yml`, `.env.example`, `config.py`, and `README.md` are Oracle-first.

Do not follow old AWS instructions for this project unless you intentionally decide to move away from the free Oracle setup.
