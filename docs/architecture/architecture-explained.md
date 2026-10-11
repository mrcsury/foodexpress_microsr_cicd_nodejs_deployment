# FoodExpress architecture explained

A student-friendly companion to `cicd-architecture.drawio`. Read it with the diagram open.

Everything here was taken from the files in this repository. Where a detail is not in the repository, this document says so.

## 1. Project overview

FoodExpress is a small online food ordering application built as a **monolith**: one Node.js program serves the website, the JSON API, the order logic and the confirmation emails. There is no separate frontend project, no second service and no database.

On every push to the `main` branch, a GitLab pipeline tests the code, packs it into a zip file and asks AWS CodeDeploy to install it on one EC2 server.

```
Developer -> Git -> GitLab -> GitLab CI/CD -> Amazon S3 -> AWS CodeDeploy -> EC2 instance -> running app
```

**What this project does not use.** The repository contains no Jenkins, no Docker, no Amazon ECR, no Amazon EKS or Kubernetes, no Terraform or CloudFormation, no Prometheus and no Grafana. The diagram shows Prometheus and Grafana as dashed "proposed" boxes only, so students can see where monitoring would attach.

## 2. Repository files used as evidence

| File | What it tells us |
|---|---|
| `.gitlab-ci.yml` | The pipeline: stages, images, commands, branch rules, variables |
| `appspec.yml` | What CodeDeploy does on the server and in which order |
| `deploy/setup-ec2.sh` | How the app is installed and started (Node.js, npm, systemd) |
| `deploy/validate-service.sh` | How a deployment is checked |
| `deploy/nginx_installation.sh` | The optional Nginx reverse proxy |
| `server.js`, `config.js` | Port, middleware, routes, health endpoint, settings |
| `routes/`, `services/`, `data/`, `middleware/` | The API, business logic, in-memory storage, rate limiting |
| `package.json` | Node.js version, dependencies, the `test` script |
| `test/` | The 12 automated tests |
| `.env.example` | Which settings exist (no real values) |
| `README.md`, `docs/CodeDeploy-Setup-Walkthrough.md` | How the AWS side is created by hand |

## 3. End-to-end flow (diagram page 1)

Follow page 1 from left to right.

1. **The developer writes code** in VS Code. Claude Code is an AI assistant in the editor. It helps write and review code, the pipeline file, the deploy scripts and documentation. It is a development aid. It is not connected to the pipeline and does not trigger it.
2. **Git records the change** as a commit on the developer's laptop.
3. **`git push` sends the commit to GitLab.** GitLab stores the source code.
4. **GitLab starts a pipeline**, because the repository contains `.gitlab-ci.yml`.
5. **Stage 1, `test`:** the tests run. If one fails, everything stops here.
6. **Stage 2, `package`:** the committed files are packed into `foodexpress.zip`.
7. **Stage 3, `deploy`:** the job signs in to AWS, uploads the zip to S3 and tells CodeDeploy to deploy it. Then it waits for the result.
8. **The CodeDeploy agent on the EC2 instance** downloads the zip, copies the files to `/opt/foodexpress` and runs two scripts.
9. **`setup-ec2.sh`** installs dependencies and restarts the application.
10. **`validate-service.sh`** calls the health endpoint. If the app answers, the deployment succeeds and the pipeline turns green.
11. **Customers** open the site in a browser on port 3000.

## 4. The components

### Zone A: developer and GitLab

| Component | Role |
|---|---|
| Developer | Writes and tests code locally (`npm test`, `npm run dev`). |
| VS Code + Claude Code | Editor plus AI assistant. Not part of CI/CD. |
| Local Git repository | Holds commits before they are pushed. Default branch: `main`. |
| GitLab.com project | `devops_slate/foodexpress-monolithic-nodejs`. Stores code and runs the pipeline. |

### Zone B: GitLab CI/CD

Three jobs, one per stage, defined in `.gitlab-ci.yml`: `test`, `package`, `deploy`. Each job runs in a fresh container.

### Zone C: AWS

| Component | Role |
|---|---|
| IAM identity provider `gitlab.com` | Lets AWS check tokens issued by GitLab. |
| IAM role for the pipeline | What the `deploy` job is allowed to do in AWS. |
| S3 bucket | Stores one zip per deployed commit. |
| CodeDeploy application and deployment group | Records each deployment and knows which server to deploy to. |
| EC2 instance | The one server that runs the app. Amazon Linux 2023. |
| CodeDeploy agent | Software on the server that performs the deployment. |
| systemd service `foodexpress` | Keeps the app running and restarts it after a crash or reboot. |

None of these AWS resources are defined as code in the repository. They are created by hand, following `docs/CodeDeploy-Setup-Walkthrough.md`.

### Zone D: the application

One Node.js process, started with `node server.js`, listening on port 3000.

| Part | Folder | What it does |
|---|---|---|
| Website | `public/` | HTML, CSS and JavaScript pages |
| JSON API | `routes/` | `/api/products` and `/api/orders` |
| Business logic | `services/` | Validation, pricing, order creation, email |
| Data | `data/` | The menu and an in-memory order store |
| Health check | `server.js` | `GET /health` |

### Zone E: monitoring

Only two things exist today: the `/health` endpoint and logs. See section 9.

## 5. The important connections

| From -> To | What travels | Colour on the diagram |
|---|---|---|
| Developer -> GitLab | Source code (`git push`) | Blue |
| GitLab -> `test` job | The pushed commit | Blue |
| `package` -> `deploy` | `foodexpress.zip` as a job artifact | Blue |
| `deploy` -> IAM role | A GitLab OIDC token, exchanged for temporary AWS credentials | Purple |
| `deploy` -> S3 | The zip file | Blue |
| `deploy` -> CodeDeploy | "Deploy this zip to this group", then waiting for the result | Orange |
| CodeDeploy -> agent | The deployment instruction. The agent asks CodeDeploy for work; CodeDeploy does not log in to the server. | Orange |
| S3 -> agent | The zip file | Blue |
| agent -> scripts -> systemd | Install, set up, restart | Orange |
| Browser -> app | Web pages and API calls on port 3000 | Green |
| App -> SMTP server | The order confirmation email | Blue |

**Control path and user traffic are separate.** Orange arrows are about deploying. Green arrows are customers using the site. The pipeline never opens an SSH session to the server, and customers can never reach CodeDeploy.

## 6. CI/CD stage by stage (diagram page 2)

### Stage 1: `test`

- Image: `node:20`
- Runs on every branch
- Commands: `npm ci`, then `npm test`
- `npm test` runs `node --test`, which finds 12 tests: 11 in `test/api.test.js` and 1 in `test/email-failure.test.js`

### Stage 2: `package`

- Image: `node:20`
- Runs only on the default branch
- Command: `git archive --format=zip -o foodexpress.zip HEAD`
- The zip is kept as a job artifact for 1 week and handed to the next stage

### Stage 3: `deploy`

- Image: `amazon/aws-cli:latest`
- Runs only on the default branch
- GitLab environment: `production`
- `resource_group: production` means only one deploy job runs at a time

What it does:

1. Receives an OIDC token from GitLab (`GITLAB_OIDC_TOKEN`, audience `https://gitlab.com`) and writes it to a temporary file.
2. Uploads the zip: `aws s3 cp foodexpress.zip s3://$S3_BUCKET/foodexpress/$CI_COMMIT_SHORT_SHA.zip`
3. Starts the deployment: `aws deploy create-deployment`
4. Waits: `aws deploy wait deployment-successful`

### CodeDeploy on the server

| Event | What happens |
|---|---|
| DownloadBundle | The agent downloads the zip from S3. |
| Install | Files are copied to `/opt/foodexpress`. Existing files are overwritten. |
| AfterInstall | `deploy/setup-ec2.sh` runs as root, with a 600-second limit. |
| ValidateService | `deploy/validate-service.sh` runs as root, with a 60-second limit. |

`setup-ec2.sh` does this, and is safe to run again and again:

1. Installs Node.js 20 if it is missing.
2. Creates the Linux user `foodexpress` if it does not exist.
3. Runs `npm ci --omit=dev`.
4. Creates `.env` from `.env.example` only if there is no `.env` yet.
5. Writes the systemd unit and restarts the service.

### Continuous Integration and Continuous Deployment

- **Continuous Integration** is stages 1 and 2. Every push is tested and packaged automatically.
- **Continuous Deployment** is stage 3 plus CodeDeploy. A tested package reaches the server with no manual step.

## 7. The artifact lifecycle (this project has no Docker image)

Students often expect a Docker image here. This project does not build one.

| Idea | In a container project | In this project |
|---|---|---|
| What is built | A Docker image | `foodexpress.zip`, a snapshot of the repository at one commit |
| Where it is stored | A registry such as Amazon ECR | An S3 bucket |
| How it is named | An image tag | `foodexpress/<short commit id>.zip` |
| What runs | A container | A Node.js process started by systemd |
| Dependencies | Baked into the image | Installed on the server by `npm ci --omit=dev` |

The zip contains source code only. Nothing is compiled. It never contains `.git`, `node_modules` or `.env`.

## 8. The deployment lifecycle (this project has no Kubernetes)

| Idea | In Kubernetes | In this project |
|---|---|---|
| Unit that runs the app | Pod | One Node.js process |
| What keeps it running | Deployment and ReplicaSet | systemd (`Restart=on-failure`) |
| How traffic reaches it | Service and Ingress | Directly on port 3000, or through optional Nginx on port 80 |
| How a new version arrives | Rolling update | Files replaced, then the process restarts |
| Copies running | Several replicas | One |
| Rollback | `kubectl rollout undo` | Not configured |

Consequences students should notice on page 3:

- The site is unavailable for a few seconds during each deployment.
- Orders are stored in memory, so every deployment and every restart erases them.

## 9. Monitoring and troubleshooting (diagram page 3)

**Configured today**

| Tool | How to use it |
|---|---|
| Health endpoint | `curl http://127.0.0.1:3000/health` returns `status`, `uptimeSeconds`, `timestamp`, `environment`, `emailConfigured` |
| Application log | `sudo journalctl -u foodexpress -n 50 --no-pager` |
| CodeDeploy agent log | `/var/log/aws/codedeploy-agent/codedeploy-agent.log` |
| Deployment history | CodeDeploy console, lifecycle events of each deployment |
| Pipeline history | GitLab, Build > Pipelines |

The health endpoint is checked automatically once per deployment. Nothing checks it between deployments.

**Not configured**

There is no metrics endpoint, no Prometheus, no node exporter, no Grafana, no alerting and no CloudWatch agent. If these were added, students would watch CPU and memory of the server, process restarts, request rate, error rate and response time.

**Metrics collection and dashboards are different things.** Collection means a tool reads numbers on a schedule and stores them. A dashboard only draws what was stored. This project has neither.

**Troubleshooting order**

1. Is the pipeline red? Open the failed job and read its log.
2. Did CodeDeploy fail? Open the deployment and read the failed lifecycle event.
3. Is the service running? `sudo systemctl status foodexpress`
4. What does the app say? `sudo journalctl -u foodexpress -n 50 --no-pager`

## 10. Failure scenarios and recovery

| What fails | What happens | Server state | Recovery |
|---|---|---|---|
| A test | `test` job is red. `package` and `deploy` do not run. | Unchanged | Fix the code, push again |
| AWS sign-in or S3 upload | `deploy` job is red before CodeDeploy starts | Unchanged | Fix the IAM role, bucket or GitLab variable, re-run the job |
| `setup-ec2.sh` | AfterInstall fails, deployment Failed, job red | New files are already copied. The service may not have restarted. | Read the event, fix, push again |
| Health check | ValidateService fails, deployment Failed, job red | The new version is installed but not healthy | Read `journalctl`, fix, push again |
| App crashes later | systemd restarts it after 5 seconds | In-memory orders are lost | Read `journalctl` |

**No automatic rollback is configured**, neither in the pipeline nor in the repository's CodeDeploy settings. Recovery means pushing a fix, or re-deploying an earlier zip from S3 by hand.

## 11. Security and secrets

- **No AWS access keys are stored anywhere.** The `deploy` job proves its identity with a short-lived GitLab OIDC token. AWS returns temporary credentials that expire on their own.
- **The IAM role trusts one project and one branch.** A pipeline from another project or another branch is refused. (This is set up in AWS, as documented in the walkthrough.)
- **The pipeline role can do very little:** upload into one folder of one bucket, and start and read CodeDeploy deployments.
- **`.env` holds the real secrets** (SMTP login). It lives only on the server, with file mode 600. It is ignored by Git, it is not in the zip, and deployments never overwrite it.
- **The app runs as an unprivileged user**, `foodexpress`, with systemd hardening options.
- **The app itself** sets security headers with Helmet, limits request size to 10 kB, rate-limits the order endpoints and never returns stack traces.

No password, token or key appears in the diagram or in these documents.

## 12. Actual configuration settings

See `pipeline-configuration-reference.md` for the full list with file paths.

The most important ones:

| Setting | Value | Source |
|---|---|---|
| Node.js version | 20 or newer | `package.json` |
| Application port | 3000 | `config.js`, `.env.example` |
| Install folder | `/opt/foodexpress` | `appspec.yml` |
| Service name | `foodexpress` | `deploy/setup-ec2.sh` |
| Health endpoint | `GET /health` | `server.js` |
| S3 key | `foodexpress/$CI_COMMIT_SHORT_SHA.zip` | `.gitlab-ci.yml` |

## 13. Missing or proposed components

| Component | Status |
|---|---|
| Jenkins | Not in the repository. GitLab CI/CD does this job. |
| Dockerfile, container image | Not in the repository. |
| Amazon ECR | Not used. S3 stores the artifact. |
| Amazon EKS, Kubernetes manifests, Helm | Not in the repository. |
| Terraform, CloudFormation | Not in the repository. AWS resources are created by hand. |
| Prometheus, Grafana, alerts | Not in the repository. Shown as proposed on the diagram. |
| CloudWatch agent or alarms | Not configured. |
| Lint, code quality, security scanning | No such pipeline job. |
| Merge-request pipeline | Not configured. |
| Automatic rollback | Not configured. |
| Database | None. Orders are kept in memory. |
| HTTPS | Not configured. The Nginx script mentions certbot as an optional manual step. |

## 14. Suggested classroom demonstration

1. **Show page 1** and trace one push from left to right.
2. **Open `.gitlab-ci.yml`** and match the three jobs to the three cards in zone B.
3. **Make a visible change** in `public/index.html`, commit and push.
4. **Watch the pipeline** in GitLab (Build > Pipelines). Open the `deploy` job log.
5. **Switch to the CodeDeploy console** and open the deployment. Show the lifecycle events and match them to page 2.
6. **Reload the site** and show the change.
7. **Place an order, then push another change.** After the deployment, look up the order. It is gone. Use page 3 to explain why.
8. **Break a test on purpose** and push. Show that `package` and `deploy` do not run and the site is unchanged.
9. **Ask the class:** what would have to be added to see CPU usage on a dashboard? Use zone E on page 3.
