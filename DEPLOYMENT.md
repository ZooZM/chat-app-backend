# 🚀 Chat App Backend — AWS Deployment Guide

## Architecture Overview

```
Internet → ALB (Load Balancer) → ECS Fargate (NestJS App)
                                        ↓
                          MongoDB Atlas / DocumentDB
                          Redis (ElastiCache)
                          S3 (File Uploads)
                          Secrets Manager (ENV vars)
                          CloudWatch (Logs)
```

---

## Step 1: Prerequisites

```bash
# Install AWS CLI
brew install awscli          # macOS
# or: https://aws.amazon.com/cli/

# Configure credentials
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output (json)
```

---

## Step 2: Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name chat-app-backend \
  --region us-east-1
```

---

## Step 3: Build & Push Docker Image (first time)

```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t chat-app-backend .

# Tag image
docker tag chat-app-backend:latest \
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/chat-app-backend:latest

# Push to ECR
docker push \
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/chat-app-backend:latest
```

---

## Step 4: Store Secrets in AWS Secrets Manager

Run each command to store your secrets safely:

```bash
# MongoDB URI
aws secretsmanager create-secret \
  --name chat-app/mongodb-uri \
  --secret-string "mongodb+srv://user:pass@cluster.mongodb.net/chatapp"

# Redis URL (ElastiCache endpoint)
aws secretsmanager create-secret \
  --name chat-app/redis-url \
  --secret-string "redis://your-elasticache-endpoint:6379"

# JWT Secret
aws secretsmanager create-secret \
  --name chat-app/jwt-secret \
  --secret-string "your-very-long-random-secret"

# LiveKit
aws secretsmanager create-secret \
  --name chat-app/livekit-api-key \
  --secret-string "your-livekit-api-key"

aws secretsmanager create-secret \
  --name chat-app/livekit-api-secret \
  --secret-string "your-livekit-api-secret"

aws secretsmanager create-secret \
  --name chat-app/livekit-ws-url \
  --secret-string "wss://your-livekit.livekit.cloud"

# Firebase (paste full JSON as one line)
aws secretsmanager create-secret \
  --name chat-app/firebase-service-account \
  --secret-string '{"type":"service_account","project_id":"..."}'

# Frontend URL
aws secretsmanager create-secret \
  --name chat-app/frontend-url \
  --secret-string "https://your-frontend.com"

# S3 Bucket
aws secretsmanager create-secret \
  --name chat-app/s3-bucket \
  --secret-string "chat-app-uploads-prod"
```

---

## Step 5: Create S3 Bucket for File Uploads

```bash
# Create bucket
aws s3api create-bucket \
  --bucket chat-app-uploads-prod \
  --region us-east-1

# Block public access (files served via signed URLs or CloudFront)
aws s3api put-public-access-block \
  --bucket chat-app-uploads-prod \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

---

## Step 6: Create IAM Roles

### ECS Task Execution Role (allows ECS to pull image + secrets)
```bash
# Already exists in most AWS accounts as: ecsTaskExecutionRole
# Add Secrets Manager permission if missing:
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

### ECS Task Role (what your app can do)
```bash
# Create role
aws iam create-role \
  --role-name chat-app-task-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"ecs-tasks.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

# Attach S3 policy
aws iam attach-role-policy \
  --role-name chat-app-task-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

---

## Step 7: Create ECS Cluster & Service

```bash
# Create cluster
aws ecs create-cluster --cluster-name chat-app-cluster

# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/chat-app-backend

# Register task definition (update YOUR_ACCOUNT_ID in ecs-task-definition.json first)
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json

# Create ECS service (with ALB — configure ALB target group ARN)
aws ecs create-service \
  --cluster chat-app-cluster \
  --service-name chat-app-service \
  --task-definition chat-app-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-XXXXX,subnet-YYYYY],
    securityGroups=[sg-ZZZZZ],
    assignPublicIp=ENABLED
  }"
```

---

## Step 8: Add Health Check Endpoint to NestJS

Add this to your NestJS app (in `app.controller.ts` or a dedicated `health.controller.ts`):

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

**This is required** — the Dockerfile HEALTHCHECK and ALB both ping `/health`.

---

## Step 9: Migrate File Uploads to S3

Install AWS SDK in your project:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Replace Multer's local disk storage with S3 storage (ask for the migration code snippet if needed).

---

## Step 10: GitHub Actions Setup

Add these secrets to your GitHub repository:
`Settings → Secrets and variables → Actions → New repository secret`

| Secret Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | Your AWS IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS IAM user secret key |

Then update `.github/workflows/deploy.yml` with your actual:
- `AWS_REGION`
- `ECR_REPOSITORY`
- `ECS_CLUSTER`
- `ECS_SERVICE`
- `CONTAINER_NAME`

---

## Critical Checklist Before Go-Live

- [ ] Health check endpoint `/health` added to NestJS
- [ ] OTP hardcoded `123456` replaced with real SMS provider (Twilio, etc.)
- [ ] EdfaPay URL changed from `apidev.edfapay.com` to production URL
- [ ] File uploads migrated from local disk to S3
- [ ] All secrets stored in AWS Secrets Manager (no `.env` in production)
- [ ] MongoDB Atlas / DocumentDB connection tested from ECS
- [ ] Redis ElastiCache connection tested from ECS
- [ ] ALB health check configured to `/health`
- [ ] HTTPS/TLS certificate attached to ALB (ACM)
- [ ] GitHub Actions secrets added (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
