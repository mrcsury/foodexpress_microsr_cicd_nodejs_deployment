# Architecture diagram

This folder holds the CI/CD and runtime architecture diagram for FoodExpress and the documents that explain it.

| File | What it is |
|---|---|
| `cicd-architecture.drawio` | The diagram. Three pages. Opens in draw.io (diagrams.net). |
| `architecture-explained.md` | A student-friendly walkthrough of the diagram. |
| `pipeline-configuration-reference.md` | Every configuration value on the diagram, with its source file. |
| `architecture-inventory.json` | The same components and connections in machine-readable form. |
| `generate-diagram.js` | The script that writes the `.drawio` file. |

## Open the diagram

Use any one of these:

- **draw.io in the browser:** go to https://app.diagrams.net, choose **Open Existing Diagram**, and pick `cicd-architecture.drawio`.
- **draw.io Desktop:** install it from https://www.drawio.com, then double-click the file.
- **VS Code:** install the "Draw.io Integration" extension, then open the file in the editor.

The AWS icons come from draw.io's built-in AWS shape library, so the diagram needs no internet connection and no image files.

## Pages

Switch pages with the tabs at the bottom of the draw.io window.

| Page | Shows |
|---|---|
| 1 End-to-End Architecture | The whole journey: developer, GitLab, pipeline, AWS, the server, customers |
| 2 CI-CD Pipeline Deep Dive | Each stage with its real commands, the failure paths, the GitLab variables |
| 3 EC2 Runtime and Monitoring | What runs on the server, how traffic reaches it, what monitoring exists |

Each page is 1920 x 1080 (16:9). For a projector, use **View > Fit Page** (Ctrl+Shift+H).

## Reading the diagram

| Arrow | Meaning |
|---|---|
| Solid blue | Configured workflow: files and data |
| Solid orange | Deployment control path |
| Solid green | User and application traffic |
| Solid purple with a lock | Authentication |
| Red | Failure path |
| Dashed grey | Optional or proposed. Not configured in this repository. |

Yellow boxes are notes about things that are documented or missing.

## Export for slides

In draw.io choose **File > Export as > PNG** (or SVG or PDF). To export one page, open that page first and clear **All Pages**. For sharp slides set **Zoom** to 200%.

## Change the diagram

There are two ways. Pick one and stay with it.

**Edit in draw.io.** Every box, label, arrow and container is a normal draw.io object. Move, restyle or rewrite anything, then save. Simple and visual. Do not run the generator afterwards, because it overwrites the file.

**Edit the generator.** `generate-diagram.js` holds all labels and positions. Change the text there and run:

```bash
node docs/architecture/generate-diagram.js
```

It needs Node.js only, no packages. It rewrites `cicd-architecture.drawio` and then checks the result:

- every object has a unique ID
- every arrow starts and ends on an existing object
- every box is inside its container and inside the page
- no two boxes in the same container overlap
- the text of each box fits its height (an estimate)

If a check fails, the script lists the problems and exits with an error.

## Regenerate after the repository changes

When the pipeline or deployment changes, the diagram does not update by itself. Check these files and carry any change into the diagram and the documents:

| If this file changes | Update |
|---|---|
| `.gitlab-ci.yml` | Zone B on page 1, the stage details and variables on page 2 |
| `appspec.yml` | The lifecycle box on page 1, the CodeDeploy lane on page 2 |
| `deploy/setup-ec2.sh` | The systemd box, AfterInstall on page 2, page 3 |
| `deploy/validate-service.sh` | ValidateService on page 2 |
| `server.js`, `routes/`, `config.js` | Zone D on page 1, the process box on page 3 |
| A Dockerfile, Kubernetes manifests or monitoring are added | The "Not in this repository" notes and the dashed boxes |

Then update `pipeline-configuration-reference.md` and `architecture-inventory.json` to match.

## Accuracy rules used for this diagram

- The repository is the source of truth. Nothing was added because it is common elsewhere.
- Values that live outside the repository are shown as variable names, for example `${S3_BUCKET}`.
- AWS resources created by hand are marked "documented", because the repository describes them but does not create them.
- No password, token, key, account number or IP address appears anywhere.
