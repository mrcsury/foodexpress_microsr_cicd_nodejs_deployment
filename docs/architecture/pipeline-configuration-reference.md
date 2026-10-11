# Pipeline configuration reference

Every configuration value shown on the diagram, with the file it comes from.

**Status column**

| Status | Meaning |
|---|---|
| Configured | The value is written in a file in this repository. |
| Documented | The repository describes it in a guide, but it is created by hand outside the repository. |
| Inferred | Not written anywhere in the repository. A reasonable assumption. |
| Missing | Not present at all. |

No secret values are listed. Variables are shown by name only.

---

## 1. GitLab

| Setting | Value | File | What it controls | Status |
|---|---|---|---|---|
| Project path | `devops_slate/foodexpress-monolithic-nodejs` | Git remote `origin` | Where the code lives | Configured |
| Default branch | `main` | Git | The branch that deploys | Configured |
| Pipeline file | `.gitlab-ci.yml` | repository root | Defines the pipeline | Configured |
| Stages | `test`, `package`, `deploy` | `.gitlab-ci.yml` | Order of the jobs | Configured |
| Trigger | Any push (branch pipeline) | `.gitlab-ci.yml` (no `workflow` block) | When a pipeline starts | Configured by default |
| `test` rule | No rule: runs on every branch | `.gitlab-ci.yml` | Which pushes are tested | Configured |
| `package` rule | `$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` | `.gitlab-ci.yml` | Zip is built on the default branch only | Configured |
| `deploy` rule | `$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` | `.gitlab-ci.yml` | Deploys from the default branch only | Configured |
| Merge-request pipeline | None | | Separate validation for merge requests | Missing |
| Webhook | None | | External trigger | Missing |
| Runner | GitLab.com shared runners with the Docker executor | | Where jobs run | Inferred |
| Protected branch settings | Not in the repository | | Who may push to `main` | Missing |

### Jobs

| Setting | `test` | `package` | `deploy` |
|---|---|---|---|
| Image | `node:20` | `node:20` | `amazon/aws-cli:latest` (entrypoint cleared) |
| Script | `npm ci`, `npm test` | `git archive --format=zip -o foodexpress.zip HEAD` | See below |
| Artifact | None | `foodexpress.zip`, expires in 1 week | None |
| Environment | None | None | `production` |
| Resource group | None | None | `production` |
| Retry, timeout | Not set (GitLab defaults) | Not set | Not set |

All values in this table: `.gitlab-ci.yml`, status Configured.

### `deploy` script, in order

| Step | Command | What it does |
|---|---|---|
| 1 | `echo "$GITLAB_OIDC_TOKEN" > /tmp/gitlab_oidc_token` | Saves the OIDC token to a file |
| 2 | `export AWS_WEB_IDENTITY_TOKEN_FILE=/tmp/gitlab_oidc_token` | Tells the AWS CLI where the token is |
| 3 | `export AWS_ROLE_SESSION_NAME="gitlab-$CI_PIPELINE_ID"` | Names the AWS session after the pipeline |
| 4 | `aws s3 cp foodexpress.zip "s3://$S3_BUCKET/$S3_KEY"` | Uploads the zip |
| 5 | `aws deploy create-deployment ...` | Starts the deployment, captures its ID |
| 6 | `aws deploy wait deployment-successful --deployment-id ...` | Waits. Fails the job if the deployment fails |

### CI/CD variables

Set in GitLab under Settings > CI/CD > Variables. Names are in `.gitlab-ci.yml`. Values are not in the repository.

| Variable | Purpose | Status |
|---|---|---|
| `AWS_ROLE_ARN` | IAM role the deploy job assumes | Name configured, value set in GitLab |
| `AWS_DEFAULT_REGION` | AWS region for S3 and CodeDeploy | Name configured, value set in GitLab |
| `S3_BUCKET` | Bucket that stores the zips | Name configured, value set in GitLab |
| `CODEDEPLOY_APPLICATION` | CodeDeploy application name | Name configured, value set in GitLab |
| `CODEDEPLOY_DEPLOYMENT_GROUP` | CodeDeploy deployment group name | Name configured, value set in GitLab |

Variables defined inside the pipeline file:

| Variable | Value | Purpose | Status |
|---|---|---|---|
| `S3_KEY` | `foodexpress/$CI_COMMIT_SHORT_SHA.zip` | Object name of the zip in S3 | Configured |
| `GITLAB_OIDC_TOKEN` | Issued by GitLab, `aud: https://gitlab.com` | Proves the job's identity to AWS | Configured |

---

## 2. Jenkins

| Setting | Value | Status |
|---|---|---|
| Jenkinsfile | None | Missing |
| Jenkins trigger, credentials, agents | None | Missing |

Jenkins is not used. GitLab CI/CD runs the pipeline.

---

## 3. Docker

| Setting | Value | Status |
|---|---|---|
| Dockerfile | None | Missing |
| `.dockerignore`, Docker Compose | None | Missing |
| Application container image | None | Missing |

Docker images appear only as the environments in which pipeline jobs run (`node:20`, `amazon/aws-cli:latest`). The application is not containerised.

---

## 4. Amazon ECR

| Setting | Value | Status |
|---|---|---|
| Repository, tags, scanning, lifecycle policy | None | Missing |

The artifact store is Amazon S3.

---

## 5. Artifact storage: Amazon S3

| Setting | Value | File | What it controls | Status |
|---|---|---|---|---|
| Bucket name | `${S3_BUCKET}` | `.gitlab-ci.yml` | Where zips are uploaded | Name of variable configured |
| Object key | `foodexpress/<short commit id>.zip` | `.gitlab-ci.yml` | One zip per commit | Configured |
| Bundle type | `zip` | `.gitlab-ci.yml` | Format CodeDeploy expects | Configured |
| Zip contents | Every committed file at `HEAD` | `.gitlab-ci.yml` (`git archive`) | What reaches the server | Configured |
| Public access | Blocked | `docs/CodeDeploy-Setup-Walkthrough.md` | Bucket privacy | Documented |
| Lifecycle rule for old zips | None | | Cleaning up old zips | Missing |

---

## 6. AWS CodeDeploy

| Setting | Value | File | What it controls | Status |
|---|---|---|---|---|
| Application | `${CODEDEPLOY_APPLICATION}` | `.gitlab-ci.yml` | Which CodeDeploy application | Name of variable configured |
| Deployment group | `${CODEDEPLOY_DEPLOYMENT_GROUP}` | `.gitlab-ci.yml` | Which servers | Name of variable configured |
| Suggested names | `foodexpress`, `foodexpress-prod` | `docs/CodeDeploy-Setup-Walkthrough.md` | | Documented |
| Compute platform | EC2/On-premises | `docs/CodeDeploy-Setup-Walkthrough.md` | | Documented |
| Deployment type | In-place | `docs/CodeDeploy-Setup-Walkthrough.md` | Update the existing server | Documented |
| Deployment configuration | `CodeDeployDefault.AllAtOnce` | `docs/CodeDeploy-Setup-Walkthrough.md` | All servers at once | Documented |
| Target selection | EC2 tag `App = foodexpress` | `docs/CodeDeploy-Setup-Walkthrough.md` | How the server is found | Documented |
| Load balancer | None | `docs/CodeDeploy-Setup-Walkthrough.md` | | Documented |
| Automatic rollback | None | | Recovery after a failed deployment | Missing |

### `appspec.yml`

| Setting | Value | What it controls | Status |
|---|---|---|---|
| `version` | `0.0` | AppSpec format | Configured |
| `os` | `linux` | Target operating system | Configured |
| `files.source` | `/` | Copy the whole zip | Configured |
| `files.destination` | `/opt/foodexpress` | Install folder | Configured |
| `file_exists_behavior` | `OVERWRITE` | Replace files that are already there | Configured |
| `AfterInstall` | `deploy/setup-ec2.sh`, timeout 600, runs as `root` | Install and restart | Configured |
| `ValidateService` | `deploy/validate-service.sh`, timeout 60, runs as `root` | Health check | Configured |
| `ApplicationStop`, `BeforeInstall`, `ApplicationStart` | No script | | Not used |

---

## 7. IAM (all created by hand)

| Setting | Value | File | Status |
|---|---|---|---|
| Identity provider | `gitlab.com`, OpenID Connect, audience `https://gitlab.com` | `docs/CodeDeploy-Setup-Walkthrough.md` | Documented |
| Pipeline role | `${AWS_ROLE_ARN}` (suggested name `GitLabFoodExpressDeploy`) | `.gitlab-ci.yml`, walkthrough | Variable configured, role documented |
| Pipeline role trust | This GitLab project, `main` branch only | walkthrough | Documented |
| Pipeline role permissions | `s3:PutObject` on `foodexpress/*` in the bucket; five `codedeploy:` actions | walkthrough | Documented |
| CodeDeploy service role | Suggested name `CodeDeployServiceRole`, policy `AWSCodeDeployRole` | walkthrough | Documented |
| EC2 instance role | Suggested name `FoodExpressEC2Role`, policy `AmazonS3ReadOnlyAccess` | walkthrough | Documented |
| Infrastructure as code for any of these | None | | Missing |

---

## 8. EC2 instance and operating system

| Setting | Value | File | What it controls | Status |
|---|---|---|---|---|
| Operating system | Amazon Linux 2023 | `deploy/setup-ec2.sh`, `README.md` | Package manager (`dnf`) | Configured in scripts |
| Instance type, AMI, VPC, subnet | Not in the repository | | | Missing |
| Security group inbound | TCP 22, TCP 3000, and TCP 80 with Nginx | `README.md`, walkthrough | Who can reach the server | Documented |
| CodeDeploy agent | Installed once by hand | walkthrough | Performs deployments | Documented |
| Node.js | Version 20 or newer, installed if missing | `deploy/setup-ec2.sh`, `package.json` | Runtime | Configured |
| Install folder (`APP_DIR`) | `/opt/foodexpress` | `deploy/setup-ec2.sh` | Where the app lives | Configured |
| Linux user (`APP_USER`) | `foodexpress`, system user, no login shell | `deploy/setup-ec2.sh` | Who runs the app | Configured |
| Dependency install | `npm ci --omit=dev` | `deploy/setup-ec2.sh` | Production dependencies only | Configured |

### systemd unit (written by `deploy/setup-ec2.sh`)

| Setting | Value | What it controls |
|---|---|---|
| Unit file | `/etc/systemd/system/foodexpress.service` | |
| `ExecStart` | `node server.js` (full path to `node`) | Start command |
| `WorkingDirectory` | `/opt/foodexpress` | |
| `User`, `Group` | `foodexpress` | Unprivileged process |
| `Environment` | `NODE_ENV=production` | Production mode |
| `Restart` | `on-failure` | Restart after a crash |
| `RestartSec` | `5` | Wait 5 seconds before restarting |
| `WantedBy` | `multi-user.target` | Start on boot |
| Hardening | `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=full`, `ProtectHome=read-only` | Limits what the process can touch |
| Capability | `CAP_NET_BIND_SERVICE` | Allows binding a port below 1024 if PORT is changed |

All status: Configured.

### Health checks

| Check | Value | File | Status |
|---|---|---|---|
| After restart, informational | 15 tries, 1 second apart, on `/health` | `deploy/setup-ec2.sh` | Configured |
| ValidateService, fails the deployment | 30 tries, 1 second apart, on `http://127.0.0.1:$PORT/health` | `deploy/validate-service.sh` | Configured |
| Port used | `PORT` from `/opt/foodexpress/.env`, default 3000 | `deploy/validate-service.sh` | Configured |

### Optional Nginx (manual, not run by the pipeline)

| Setting | Value | File | Status |
|---|---|---|---|
| Listen | Port 80, IPv4 and IPv6 | `deploy/nginx_installation.sh` | Configured in script |
| Proxy target | `http://127.0.0.1:3000` | `deploy/nginx_installation.sh` | Configured in script |
| Server name | `bharathonlineshopping.com`, `www.bharathonlineshopping.com` | `deploy/nginx_installation.sh` | Configured in script |
| Config file | `/etc/nginx/conf.d/bharathonlineshopping.com.conf` | `deploy/nginx_installation.sh` | Configured in script |
| HTTPS | Certbot suggested as a manual step | `deploy/nginx_installation.sh` | Missing |

---

## 9. Amazon EKS and Kubernetes

| Setting | Value | Status |
|---|---|---|
| Cluster, namespaces, Deployments, Services, Ingress | None | Missing |
| Probes, resource limits, autoscaling, ConfigMaps, Secrets | None | Missing |
| Helm charts, Kustomize | None | Missing |

Kubernetes is not used. The application is one process on one EC2 instance.

---

## 10. Application

| Setting | Value | File | What it controls | Status |
|---|---|---|---|---|
| Entry point | `server.js` | `package.json` | | Configured |
| Start command | `node server.js` | `package.json` | | Configured |
| Test command | `node --test` | `package.json` | | Configured |
| Dependencies | `express`, `helmet`, `nodemailer`, `dotenv` | `package.json` | | Configured |
| Port | `PORT`, default 3000 | `config.js` | Listening port | Configured |
| Health endpoint | `GET /health` | `server.js` | Liveness check | Configured |
| JSON body limit | `10kb` | `server.js` | Maximum request size | Configured |
| Security headers | Helmet with a Content-Security-Policy; HSTS in production | `server.js` | Browser protections | Configured |
| Allowed image source | `https://images.unsplash.com` | `server.js` | Menu photos | Configured |
| Storage | In memory, at most 1000 orders | `config.js`, `data/orderStore.js` | Orders are lost on restart | Configured |
| Database | None | | | Missing |

### API endpoints

| Method and path | Rate limit per IP per minute | File |
|---|---|---|
| `GET /api/products` | None | `routes/products.js` |
| `GET /api/products/:id` | None | `routes/products.js` |
| `POST /api/orders` | 60, or `RATE_LIMIT_ORDERS_PER_MIN` | `routes/orders.js`, `config.js` |
| `GET /api/orders/:id` | 60 | `routes/orders.js` |
| `POST /api/orders/:id/resend-email` | 10 | `routes/orders.js` |

### Environment variables (`.env`)

Names from `.env.example`. Real values exist only in `/opt/foodexpress/.env` on the server.

| Variable | Default in `.env.example` | What it controls |
|---|---|---|
| `PORT` | `3000` | Listening port |
| `NODE_ENV` | `development` (the systemd unit sets `production`) | Mode |
| `TRUST_PROXY` | `0` | Set to 1 behind Nginx |
| `SMTP_HOST` | empty | Mail server |
| `SMTP_PORT` | `587` | Mail server port |
| `SMTP_SECURE` | `false` | STARTTLS or implicit TLS |
| `SMTP_USER` | empty | Mail login. Secret. |
| `SMTP_PASS` | empty | Mail password. Secret. |
| `EMAIL_FROM` | `"FoodExpress <orders@example.com>"` | Sender address |
| `RATE_LIMIT_ORDERS_PER_MIN` | not listed, default 60 | Order rate limit (`config.js`) |

The `.env` file has mode 600, is owned by `foodexpress`, is ignored by Git and is never overwritten by a deployment (`deploy/setup-ec2.sh`, `.gitignore`).

---

## 11. Monitoring

| Setting | Value | File | Status |
|---|---|---|---|
| Health endpoint | `GET /health` | `server.js` | Configured |
| Application logs | journald, unit `foodexpress` | `deploy/setup-ec2.sh` | Configured |
| Metrics endpoint (`/metrics`) | None | | Missing |
| Prometheus: scrape interval, jobs, targets | None | | Missing |
| Node exporter | None | | Missing |
| Grafana: data source, dashboards | None | | Missing |
| Alert rules, notification channels | None | | Missing |
| CloudWatch agent, alarms | None | | Missing |
