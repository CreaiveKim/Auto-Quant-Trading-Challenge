# Deployment Guide

The active deployment target is Oracle Cloud Always Free.

Read this file first:

```text
ORACLE_24H_ALWAYS_FREE_DEPLOYMENT_STEP_BY_STEP.txt
```

The Oracle guide includes:

- account creation
- Always Free checks
- Ampere A1 instance creation
- VCN and security list setup
- Ubuntu server access
- Docker installation
- `.env` configuration
- 24-hour container operation
- health checks
- cost safety checks

Recommended target:

- Cloud: Oracle Cloud Infrastructure
- Shape: `VM.Standard.A1.Flex`
- Region example: `ap-seoul-1`
- CPU/memory: 1 OCPU / 6 GB minimum, 2 OCPU / 12 GB recommended
- Port: `8000`

The old AWS Free Tier instructions were removed from this guide to avoid accidentally following a paid or resource-constrained path.
