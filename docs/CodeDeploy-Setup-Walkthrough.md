# FoodExpress: AWS CodeDeploy setup walkthrough

A step-by-step script for setting up automatic deployment of FoodExpress to an EC2 instance, using GitLab CI/CD and AWS CodeDeploy. Follow the steps in order, top to bottom. Every step ends with a **Checkpoint** that tells you what you should see before moving on.

- **Starting point:** the code (including `.gitlab-ci.yml` and `appspec.yml`) has been pushed to the `main` branch of a GitLab.com project.
- **End result:** every push to `main` runs the tests and deploys the app to EC2 with no manual login to the server.
- **Time:** 60 to 90 minutes the first time.

> AWS and GitLab change the wording of their screens from time to time. If a button or label looks slightly different from this guide, look for the closest match on the same screen. The values you type are what matter.

---

## Contents

1. [How the pipeline works](#1-how-the-pipeline-works)
2. [What you need before you start](#2-what-you-need-before-you-start)
3. [Write down your values](#3-write-down-your-values)
4. [What you see right after the first push](#4-what-you-see-right-after-the-first-push)
5. [Step 1: Create the S3 bucket](#5-step-1-create-the-s3-bucket)
6. [Step 2: Create the IAM role for the EC2 instance](#6-step-2-create-the-iam-role-for-the-ec2-instance)
7. [Step 3: Attach the role to the instance and tag it](#7-step-3-attach-the-role-to-the-instance-and-tag-it)
8. [Step 4: Install the CodeDeploy agent on the instance](#8-step-4-install-the-codedeploy-agent-on-the-instance)
9. [Step 5: Create the CodeDeploy service role](#9-step-5-create-the-codedeploy-service-role)
10. [Step 6: Create the CodeDeploy application](#10-step-6-create-the-codedeploy-application)
11. [Step 7: Create the CodeDeploy deployment group](#11-step-7-create-the-codedeploy-deployment-group)
12. [Step 8: Add GitLab as an identity provider in AWS](#12-step-8-add-gitlab-as-an-identity-provider-in-aws)
13. [Step 9: Create the IAM role for the GitLab pipeline](#13-step-9-create-the-iam-role-for-the-gitlab-pipeline)
14. [Step 10: Add the CI/CD variables in GitLab](#14-step-10-add-the-cicd-variables-in-gitlab)
15. [Step 11: Run the pipeline and watch the deployment](#15-step-11-run-the-pipeline-and-watch-the-deployment)
16. [Step 12: Check the application](#16-step-12-check-the-application)
17. [Step 13: Prove the automation with a code change](#17-step-13-prove-the-automation-with-a-code-change)
18. [Summary of everything you created](#18-summary-of-everything-you-created)
19. [Troubleshooting](#19-troubleshooting)
20. [Clean up](#20-clean-up)

---

## 1. How the pipeline works

```
git push  -->  GitLab CI/CD  -->  Amazon S3  -->  AWS CodeDeploy  -->  EC2 instance
 (you)         test + zip        stores zip      orders deploy        app restarts
```

After each push to `main`:

1. GitLab starts a pipeline with three jobs, one after another: `test`, `package`, `deploy`.
2. `test` runs `npm test`. If a test fails, the pipeline stops and nothing is deployed.
3. `package` puts the committed files into `foodexpress.zip`.
4. `deploy` signs in to AWS, uploads the zip to the S3 bucket, and asks CodeDeploy to deploy it.
5. The CodeDeploy agent on the EC2 instance downloads the zip, copies the files to `/opt/foodexpress`, and runs the two scripts named in `appspec.yml`:
   - `deploy/setup-ec2.sh` installs Node.js if needed, runs `npm ci`, and restarts the `foodexpress` service.
   - `deploy/validate-service.sh` calls `/health`. If the app does not answer, the deployment fails and the pipeline turns red.

There are **three IAM roles** in this setup. Students often mix them up, so it helps to name them early:

| Role | Who uses it | What it is allowed to do |
|---|---|---|
| `FoodExpressEC2Role` | The EC2 instance | Download the zip from S3 |
| `CodeDeployServiceRole` | The CodeDeploy service | Find EC2 instances by tag |
| `GitLabFoodExpressDeploy` | The GitLab pipeline | Upload the zip to S3 and start a deployment |

---

## 2. What you need before you start

- [ ] An AWS account, signed in to the AWS Console as a user who can create IAM roles, S3 buckets and CodeDeploy resources (an administrator user is simplest for a lab).
- [ ] Your own copy of the FoodExpress project on **GitLab.com**, with permission to change its settings (Maintainer or Owner).
- [ ] The project contains these four files:
  - `.gitlab-ci.yml` (top folder)
  - `appspec.yml` (top folder)
  - `deploy/setup-ec2.sh`
  - `deploy/validate-service.sh`
- [ ] An EC2 instance running **Amazon Linux 2023**, in the **running** state, that you can connect to (SSH or EC2 Instance Connect).
- [ ] The instance has a public IP address and internet access.
- [ ] The instance's security group allows these inbound rules:

  | Type | Port | Source | Why |
  |---|---|---|---|
  | SSH | 22 | Your IP | To install the CodeDeploy agent |
  | Custom TCP | 3000 | Anywhere (0.0.0.0/0) | To open the app in a browser |

The instance does **not** need the app or Node.js installed. The first deployment installs both.

> **This pipeline does not install Nginx.** The app is reached on port 3000. Nginx (port 80) is a separate, optional, one-time step using `deploy/nginx_installation.sh`.

---

## 3. Write down your values

Several steps use values that differ for every person. Write yours down now. Wherever this guide shows a placeholder in angle brackets, type your own value **without** the angle brackets.

| Placeholder | What it is | Example |
|---|---|---|
| `<REGION>` | The AWS region of your EC2 instance. Use the same region in every step. | `ap-south-1` |
| `<ACCOUNT_ID>` | Your 12-digit AWS account number. Click your name at the top right of the AWS Console to see it. Type it without dashes. | `123456789012` |
| `<BUCKET>` | A name for your S3 bucket. Must be unique in the whole world, lowercase letters, numbers and dashes only. | `foodexpress-deploy-asha-2026` |
| `<GITLAB_PROJECT_PATH>` | The part of your GitLab project address after `gitlab.com/`. | `asha/foodexpress-monolithic-nodejs` |
| `<EC2_PUBLIC_IP>` | The public IPv4 address of your instance (EC2 console, Instances page). | `13.201.10.25` |

Names used in this guide. Keep them exactly as written, because later steps refer to them:

| Resource | Name |
|---|---|
| IAM role for the EC2 instance | `FoodExpressEC2Role` |
| IAM role for CodeDeploy | `CodeDeployServiceRole` |
| IAM role for the GitLab pipeline | `GitLabFoodExpressDeploy` |
| Inline policy on the pipeline role | `FoodExpressDeployPolicy` |
| EC2 tag | Key `App`, value `foodexpress` |
| CodeDeploy application | `foodexpress` |
| CodeDeploy deployment group | `foodexpress-prod` |

---

## 4. What you see right after the first push

1. In GitLab, open your project and go to **Build > Pipelines**.
2. A pipeline has started for your push. Open it.

What to expect:

| Job | Result | Why |
|---|---|---|
| `test` | Passed | The tests need nothing from AWS. |
| `package` | Passed | It only builds the zip. |
| `deploy` | **Failed** | AWS is not set up yet and the GitLab variables do not exist. |

**The failed `deploy` job is expected at this point.** Nothing was sent to the server. The rest of this guide creates everything the `deploy` job needs. In Step 11 you run it again and it passes.

---

## 5. Step 1: Create the S3 bucket

The pipeline uploads each zip to this bucket. The EC2 instance downloads it from here.

1. In the AWS Console, look at the region shown at the top right. Change it to `<REGION>` if it is different.
2. In the search bar type **S3** and open it.
3. Choose **Create bucket**.
4. **Bucket type:** General purpose (if the option is shown).
5. **Bucket name:** type your `<BUCKET>` value.
6. Leave every other setting unchanged. In particular, **Block all public access** stays **on**.
7. Scroll down and choose **Create bucket**.

**Checkpoint:** your bucket appears in the bucket list, and the region column shows `<REGION>`.

---

## 6. Step 2: Create the IAM role for the EC2 instance

The instance needs permission to download the zip from S3.

> **First check whether your instance already has a role.** In the EC2 console select the instance and look at the **Security** tab, field **IAM Role**. If a role is already listed, do **not** create a new one. Open that existing role in IAM, choose **Add permissions > Attach policies**, attach `AmazonS3ReadOnlyAccess`, and skip to Step 3 part B.

1. In the search bar type **IAM** and open it.
2. In the left menu choose **Roles**, then **Create role**.
3. **Trusted entity type:** AWS service.
4. **Service or use case:** EC2. **Use case:** EC2. Choose **Next**.
5. In the permissions search box type `AmazonS3ReadOnlyAccess`. Tick the box next to it. Choose **Next**.
6. **Role name:** `FoodExpressEC2Role`
7. Choose **Create role**.

**Role details**

| Item | Value |
|---|---|
| Role name | `FoodExpressEC2Role` |
| Trusted entity | `ec2.amazonaws.com` (the EC2 service) |
| Permissions | AWS managed policy `AmazonS3ReadOnlyAccess` |

**Checkpoint:** the role `FoodExpressEC2Role` appears in the Roles list.

---

## 7. Step 3: Attach the role to the instance and tag it

### Part A: Attach the role

1. In the search bar type **EC2** and open it.
2. In the left menu choose **Instances**. Tick the box next to your instance.
3. Choose **Actions > Security > Modify IAM role**.
4. In the list select `FoodExpressEC2Role`.
5. Choose **Update IAM role**.

### Part B: Add the tag

CodeDeploy finds the server by its tag, not by its name or IP address.

1. With the instance still selected, open the **Tags** tab in the lower panel.
2. Choose **Manage tags**, then **Add new tag**.
3. **Key:** `App`
4. **Value:** `foodexpress`
5. Choose **Save**.

Both the key and the value are case-sensitive. `app` or `FoodExpress` will not match.

**Checkpoint:** on the **Security** tab the instance shows IAM Role `FoodExpressEC2Role`, and on the **Tags** tab it shows `App = foodexpress`.

---

## 8. Step 4: Install the CodeDeploy agent on the instance

The agent is the program on the server that carries out each deployment.

1. Connect to the instance. Easiest way: in the EC2 console select the instance, choose **Connect**, open the **EC2 Instance Connect** tab, choose **Connect**.
2. Run these commands one at a time. In the second command, replace `<REGION>` in **both** places.

```bash
sudo dnf install -y ruby wget
```

```bash
wget https://aws-codedeploy-<REGION>.s3.<REGION>.amazonaws.com/latest/install
```

Example for the Mumbai region:
`wget https://aws-codedeploy-ap-south-1.s3.ap-south-1.amazonaws.com/latest/install`

```bash
chmod +x ./install
```

```bash
sudo ./install auto
```

```bash
sudo systemctl status codedeploy-agent
```

3. Restart the agent once, so it is certain to use the IAM role from Step 3:

```bash
sudo systemctl restart codedeploy-agent
```

**Checkpoint:** `sudo systemctl status codedeploy-agent` shows `active (running)` in green. Press `q` to leave the status screen.

---

## 9. Step 5: Create the CodeDeploy service role

CodeDeploy itself needs permission to look up EC2 instances by tag.

1. Open **IAM > Roles > Create role**.
2. **Trusted entity type:** AWS service.
3. **Service or use case:** type `CodeDeploy` and select **CodeDeploy**.
4. **Use case:** select the plain **CodeDeploy** option. Do **not** select "CodeDeploy for Lambda" or "CodeDeploy - ECS".
5. Choose **Next**. The policy `AWSCodeDeployRole` is already attached. Choose **Next** again.
6. **Role name:** `CodeDeployServiceRole`
7. Choose **Create role**.

**Role details**

| Item | Value |
|---|---|
| Role name | `CodeDeployServiceRole` |
| Trusted entity | `codedeploy.amazonaws.com` (the CodeDeploy service) |
| Permissions | AWS managed policy `AWSCodeDeployRole` |

**Checkpoint:** the role `CodeDeployServiceRole` appears in the Roles list.

---

## 10. Step 6: Create the CodeDeploy application

1. In the search bar type **CodeDeploy** and open it.
2. Check the region at the top right is still `<REGION>`.
3. In the left menu choose **Deploy > Applications**.
4. Choose **Create application**.
5. **Application name:** `foodexpress`
6. **Compute platform:** EC2/On-premises
7. Choose **Create application**.

**Checkpoint:** you land on the `foodexpress` application page with a green "Application created" message.

---

## 11. Step 7: Create the CodeDeploy deployment group

1. On the `foodexpress` application page, choose **Create deployment group**.
2. Fill in the form from top to bottom:

| Section | Field | Value |
|---|---|---|
| Deployment group name | Enter a deployment group name | `foodexpress-prod` |
| Service role | Enter a service role | `CodeDeployServiceRole` |
| Deployment type | | **In-place** |
| Environment configuration | Tick box | **Amazon EC2 instances** |
| Environment configuration | Tag group 1, Key | `App` |
| Environment configuration | Tag group 1, Value | `foodexpress` |
| Agent configuration with AWS Systems Manager | Install AWS CodeDeploy Agent | **Never** |
| Deployment settings | Deployment configuration | `CodeDeployDefault.AllAtOnce` |
| Load balancer | Enable load balancing | **Clear the tick box** |

3. Choose **Create deployment group**.

Why these choices:

- **In-place** updates the app on the existing server. Blue/green would create new servers.
- **Never** for the agent, because you installed it yourself in Step 4.
- **No load balancer**, because there is a single server with none in front of it. If the box stays ticked, the form asks for a load balancer and cannot be saved.

**Checkpoint:** after you enter the tag, the form shows **"1 unique matched instance"** under the tag fields. If it shows 0, the tag on the instance does not match, or the instance is stopped. Fix that (Step 3 part B) before you continue.

---

## 12. Step 8: Add GitLab as an identity provider in AWS

The `deploy` job needs AWS permissions. Instead of storing AWS access keys in GitLab, AWS is told to trust pipelines that come from GitLab. GitLab gives each pipeline a signed token that says which project and branch it belongs to. AWS checks that token and hands out temporary credentials that expire on their own.

1. Open **IAM**. In the left menu choose **Identity providers**.
2. Choose **Add provider**.
3. **Provider type:** OpenID Connect.
4. **Provider URL:** `https://gitlab.com`
   (no slash at the end)
5. **Audience:** `https://gitlab.com`
6. If the screen shows a **Get thumbprint** button, choose it. Newer screens do not show it.
7. Choose **Add provider**.

> One AWS account can hold only one provider for `https://gitlab.com`. If it is already in the list, skip this step and reuse it.

**Checkpoint:** the Identity providers list shows `gitlab.com` with type OpenID Connect.

---

## 13. Step 9: Create the IAM role for the GitLab pipeline

This is the role the `deploy` job uses. It has two parts: a **trust policy** (who may use the role) and a **permissions policy** (what the role may do).

### Part A: Create the role with its trust policy

1. Open **IAM > Roles > Create role**.
2. **Trusted entity type:** Custom trust policy.
3. Delete everything in the editor and paste this policy.
4. Replace `<ACCOUNT_ID>` and `<GITLAB_PROJECT_PATH>` with your values.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/gitlab.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "gitlab.com:aud": "https://gitlab.com",
          "gitlab.com:sub": "project_path:<GITLAB_PROJECT_PATH>:ref_type:branch:ref:main"
        }
      }
    }
  ]
}
```

Example of the finished `sub` line for the project `gitlab.com/asha/foodexpress-monolithic-nodejs`:

```
"gitlab.com:sub": "project_path:asha/foodexpress-monolithic-nodejs:ref_type:branch:ref:main"
```

5. Choose **Next**.
6. On the **Add permissions** page select **nothing**. Choose **Next**.
7. **Role name:** `GitLabFoodExpressDeploy`
8. Choose **Create role**.

What the trust policy says, line by line:

| Line | Meaning |
|---|---|
| `Federated ... oidc-provider/gitlab.com` | Only identities confirmed by GitLab.com are considered. |
| `sts:AssumeRoleWithWebIdentity` | They may exchange a GitLab token for temporary AWS credentials. |
| `gitlab.com:aud` | The token must have been issued for AWS use (matches `aud` in `.gitlab-ci.yml`). |
| `gitlab.com:sub` | The token must come from **your project** and the **`main` branch**. Any other project or branch is refused. |

> The `sub` line is the lock on this role. The project path must be spelled exactly as in the GitLab address, including upper and lower case, with no `https://gitlab.com/` in front and no slash at the end.

### Part B: Add the permissions policy

1. In **IAM > Roles**, open `GitLabFoodExpressDeploy`.
2. On the **Permissions** tab choose **Add permissions > Create inline policy**.
3. Switch the editor to **JSON**.
4. Delete everything in the editor and paste this policy.
5. Replace `<BUCKET>` with your bucket name.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::<BUCKET>/foodexpress/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "codedeploy:CreateDeployment",
        "codedeploy:GetDeployment",
        "codedeploy:GetDeploymentConfig",
        "codedeploy:GetApplicationRevision",
        "codedeploy:RegisterApplicationRevision"
      ],
      "Resource": "*"
    }
  ]
}
```

6. Choose **Next**.
7. **Policy name:** `FoodExpressDeployPolicy`
8. Choose **Create policy**.

What the permissions policy allows:

| Permission | Used for |
|---|---|
| `s3:PutObject` on `<BUCKET>/foodexpress/*` | Uploading the zip. Only into the `foodexpress/` folder of your bucket. |
| `codedeploy:CreateDeployment` | Starting the deployment. |
| `codedeploy:RegisterApplicationRevision`, `GetApplicationRevision`, `GetDeploymentConfig` | Needed by CodeDeploy when a deployment is created from a new zip. |
| `codedeploy:GetDeployment` | Waiting for the result, so the job can turn green or red. |

### Part C: Copy the role ARN

1. Stay on the `GitLabFoodExpressDeploy` role page.
2. In the **Summary** box at the top, copy the **ARN**. It looks like this:
   `arn:aws:iam::<ACCOUNT_ID>:role/GitLabFoodExpressDeploy`
3. Keep it for the next step.

**Role details**

| Item | Value |
|---|---|
| Role name | `GitLabFoodExpressDeploy` |
| Trusted entity | The `gitlab.com` identity provider, limited to your project and the `main` branch |
| Permissions | Inline policy `FoodExpressDeployPolicy` |

**Checkpoint:** the role page shows the policy `FoodExpressDeployPolicy` on the Permissions tab, and the **Trust relationships** tab shows your project path in the `gitlab.com:sub` line.

---

## 14. Step 10: Add the CI/CD variables in GitLab

`.gitlab-ci.yml` contains no account details. It reads them from five variables.

1. Open your project on GitLab.com.
2. In the left menu choose **Settings > CI/CD**.
3. Find **Variables** and choose **Expand**.
4. Choose **Add variable**. For each variable in the table below:
   - **Type:** Variable (default)
   - **Environments:** All (default)
   - **Visibility:** Visible
   - **Protect variable:** clear the tick box
   - **Key:** exactly as in the table (capital letters, underscores)
   - **Value:** your value, with no spaces before or after
   - Choose **Add variable**

| Key | Value | Example |
|---|---|---|
| `AWS_ROLE_ARN` | The ARN you copied in Step 9 | `arn:aws:iam::123456789012:role/GitLabFoodExpressDeploy` |
| `AWS_DEFAULT_REGION` | `<REGION>` | `ap-south-1` |
| `S3_BUCKET` | `<BUCKET>`, the name only, without `s3://` | `foodexpress-deploy-asha-2026` |
| `CODEDEPLOY_APPLICATION` | `foodexpress` | `foodexpress` |
| `CODEDEPLOY_DEPLOYMENT_GROUP` | `foodexpress-prod` | `foodexpress-prod` |

> **Why clear "Protect variable"?** A protected variable is only given to pipelines on protected branches. If `main` is not protected in your project, the `deploy` job receives empty values and fails. None of these five values is a password, so leaving them unprotected is fine for this lab.

**Checkpoint:** the Variables list shows all five keys, spelled exactly as above.

---

## 15. Step 11: Run the pipeline and watch the deployment

### Part A: Start the pipeline

Use either way:

- **Re-run the failed job:** go to **Build > Pipelines**, open the pipeline from section 4, and choose the retry icon next to the `deploy` job.
- **Start a new pipeline:** go to **Build > Pipelines**, choose **New pipeline**, keep the branch `main`, choose **New pipeline**.

### Part B: Watch it in GitLab

1. Open the pipeline and choose the `deploy` job to see its log.
2. The log shows, in this order:
   - `upload: ./foodexpress.zip to s3://<BUCKET>/foodexpress/<commit>.zip`
   - `CodeDeploy deployment d-XXXXXXXXX started`
   - then it waits while CodeDeploy works
   - `Job succeeded`

### Part C: Watch it in AWS

1. In the AWS Console open **CodeDeploy > Deploy > Deployments**.
2. Open the deployment whose ID matches the one in the GitLab log.
3. Scroll down to **Deployment lifecycle events** and choose **View events**.

| Event | What happens on the server |
|---|---|
| ApplicationStop | Nothing to run. No script is defined for it, so it passes immediately. |
| DownloadBundle | The agent downloads the zip from S3. |
| BeforeInstall | Nothing to run. Passes immediately. |
| Install | The files are copied to `/opt/foodexpress`. |
| AfterInstall | `deploy/setup-ec2.sh` runs: Node.js, `npm ci`, `.env`, service restart. Slowest on the first deployment. |
| ApplicationStart | Nothing to run. The restart already happened in AfterInstall. |
| ValidateService | `deploy/validate-service.sh` runs: the app must answer `/health`. |

All seven events show **Succeeded** when the deployment works, including the ones with nothing to run.

**Checkpoint:** in GitLab all three jobs have a green tick. In CodeDeploy the deployment status is **Succeeded**.

---

## 16. Step 12: Check the application

1. In a browser open:

   ```
   http://<EC2_PUBLIC_IP>:3000
   ```

   Use `http://`, not `https://`. The FoodExpress home page loads.

2. Optional check on the server:

   ```bash
   sudo systemctl status foodexpress
   curl http://127.0.0.1:3000/health
   ```

**About the `.env` file:** the first deployment creates `/opt/foodexpress/.env` from `.env.example`. Later deployments never replace it. Email (SMTP) settings are edited on the server:

```bash
sudo nano /opt/foodexpress/.env
sudo systemctl restart foodexpress
```

**Checkpoint:** the home page loads in the browser.

---

## 17. Step 13: Prove the automation with a code change

1. On your computer open `public/index.html` and change some text that is visible on the home page, for example a heading.
2. Commit and push:

   ```bash
   git add public/index.html
   git commit -m "Change home page heading"
   git push origin main
   ```

3. In GitLab, watch the new pipeline under **Build > Pipelines** until `deploy` is green.
4. Reload the site in the browser (Ctrl+F5 to bypass the cache). The change is live, and nobody logged in to the server.

**Good to know:** each deployment restarts the app. FoodExpress keeps orders in memory, so orders placed before a deployment are gone after it. That is expected for this teaching app.

**Optional demo: a failing test blocks the deployment.** Break a test on purpose (for example, change the response of the `/health` route in `server.js`), then push. The `test` job fails, `package` and `deploy` do not run, and the version on the server stays as it was. Undo the change and push again.

---

## 18. Summary of everything you created

| Where | Resource | Name |
|---|---|---|
| S3 | Bucket | `<BUCKET>` |
| IAM | Role for the EC2 instance | `FoodExpressEC2Role` with `AmazonS3ReadOnlyAccess` |
| EC2 | IAM role on the instance | `FoodExpressEC2Role` |
| EC2 | Tag on the instance | `App = foodexpress` |
| EC2 instance | Software | CodeDeploy agent |
| IAM | Role for CodeDeploy | `CodeDeployServiceRole` with `AWSCodeDeployRole` |
| CodeDeploy | Application | `foodexpress` |
| CodeDeploy | Deployment group | `foodexpress-prod` |
| IAM | Identity provider | `gitlab.com` |
| IAM | Role for the pipeline | `GitLabFoodExpressDeploy` with inline policy `FoodExpressDeployPolicy` |
| GitLab | CI/CD variables | `AWS_ROLE_ARN`, `AWS_DEFAULT_REGION`, `S3_BUCKET`, `CODEDEPLOY_APPLICATION`, `CODEDEPLOY_DEPLOYMENT_GROUP` |

---

## 19. Troubleshooting

First find where it failed: a red job in GitLab (open the job log), or a failed event in the CodeDeploy console (open the deployment, **View events**, then the link in the error column).

### Failures in the GitLab `deploy` job

| What the log says | Cause | Fix |
|---|---|---|
| Pipeline stays "pending", no job starts | No runner available. New GitLab.com accounts must verify their identity before shared runners work. | **Settings > CI/CD > Runners**: check that instance runners are enabled, and complete the account verification GitLab asks for. |
| `Unable to locate credentials` | `AWS_ROLE_ARN` is missing or misspelled, or it is protected while `main` is not a protected branch. | Re-check Step 10. |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | The trust policy does not match the pipeline. | Step 9 part A: check the project path, the branch `main`, the account ID. Step 8: check the identity provider exists. |
| `AccessDenied` ... `s3:PutObject` | The bucket in the inline policy differs from the `S3_BUCKET` variable, or `/foodexpress/*` is missing at the end of the resource. | Step 9 part B and Step 10. |
| `NoSuchBucket` or an invalid bucket name error | `S3_BUCKET` is empty, misspelled, or includes `s3://`. | Step 10. |
| `ApplicationDoesNotExistException` or `DeploymentGroupDoesNotExistException` | The variable does not match the CodeDeploy name, or `AWS_DEFAULT_REGION` is a different region from the one CodeDeploy was set up in. | Step 10. |
| `Waiter DeploymentSuccessful failed` | The job reached CodeDeploy, and the deployment itself failed. | Open the deployment in the CodeDeploy console and use the next table. |

### Failures in the CodeDeploy deployment

| What you see | Cause | Fix |
|---|---|---|
| Fails at once: no instances found | The tag on the instance is not exactly `App = foodexpress`, or the instance is stopped. | Step 3 part B. |
| Stays "In progress" for many minutes, then fails with a message about the agent or `HEALTH_CONSTRAINTS` | The agent is not running or cannot reach AWS. | On the server: `sudo systemctl status codedeploy-agent`. Check the instance has the IAM role and internet access, then `sudo systemctl restart codedeploy-agent`. |
| DownloadBundle fails with `Access Denied` | The instance role is missing or cannot read S3, or the agent started before the role was attached. | Step 3 part A, then `sudo systemctl restart codedeploy-agent`. |
| AfterInstall fails | `setup-ec2.sh` hit an error. The usual reason is no internet access to download Node.js or npm packages. | Read the script output in the event details. |
| ValidateService fails | The app did not start. | On the server: `sudo journalctl -u foodexpress -n 50 --no-pager`. A wrong value in `.env` is the usual reason. |

### Everything is green but the site does not open

- The security group does not allow inbound TCP 3000 from your address.
- The address was typed with `https://` instead of `http://`, or without `:3000`.
- The instance was stopped and started, so its public IP changed. Look up the current IP in the EC2 console.

### Log files on the server

```bash
# CodeDeploy agent log
sudo tail -n 50 /var/log/aws/codedeploy-agent/codedeploy-agent.log

# Output of the deployment scripts
sudo tail -n 80 /opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log

# Application log
sudo journalctl -u foodexpress -n 50 --no-pager
```

---

## 20. Clean up

When the lab is over, remove the resources so nothing keeps costing money. Work in this order:

1. **CodeDeploy:** open the `foodexpress` application and choose **Delete application**. This also deletes the deployment group.
2. **S3:** select your bucket, choose **Empty**, confirm, then choose **Delete**.
3. **EC2:** terminate the instance if you no longer need it (**Instance state > Terminate instance**).
4. **IAM roles:** delete `GitLabFoodExpressDeploy`, `CodeDeployServiceRole` and `FoodExpressEC2Role`.
5. **IAM identity provider:** delete `gitlab.com`, unless another project in the account uses it.
6. **GitLab:** delete the five CI/CD variables if you keep the project.

CodeDeploy itself is free for EC2 deployments. The costs in this lab come from the EC2 instance and, to a very small degree, the zips stored in S3.
