#!/usr/bin/env node
// Generates docs/architecture/cicd-architecture.drawio (3 pages). No dependencies.
//
//   node docs/architecture/generate-diagram.js              write the .drawio file and run the checks
//   node docs/architecture/generate-diagram.js --preview    also write rough preview-pageN.svg files
//
// The diagram content lives in this file. After the repository changes (pipeline, appspec, scripts),
// edit the labels below and run the script again. Manual edits made in draw.io are overwritten.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'cicd-architecture.drawio');
const PAGE_W = 1920;
const PAGE_H = 1080;

// ---------- colours ----------
const C = {
  ink: '#1F2933', blue: '#1F4E79', orange: '#C55A11', green: '#2E7D32', red: '#C62828',
  purple: '#6A1B9A', grey: '#8A8A8A', aws: '#232F3E',
};

// ---------- styles ----------
const S = {
  title: 'text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=24;fontStyle=1;fontColor=#1F4E79;',
  subtitle: 'text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=13;fontColor=#444444;',
  zone: (fill, stroke) => `rounded=1;arcSize=3;whiteSpace=wrap;html=1;container=1;collapsible=0;recursiveResize=0;fillColor=${fill};strokeColor=${stroke};strokeWidth=2;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontSize=14;fontStyle=1;fontColor=${stroke};`,
  card: (stroke = '#5B7083', fill = '#FFFFFF') => `rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};strokeWidth=1.5;align=left;verticalAlign=top;spacing=6;fontSize=11;fontColor=#1F2933;`,
  iconCard: (stroke = '#5B7083') => `rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${stroke};strokeWidth=1.5;align=left;verticalAlign=top;spacing=6;spacingLeft=52;fontSize=11;fontColor=#1F2933;`,
  proposed: 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#FAFAFA;strokeColor=#8A8A8A;strokeWidth=1.5;dashed=1;dashPattern=6 4;align=left;verticalAlign=top;spacing=6;fontSize=11;fontColor=#555555;',
  ok: 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#E8F5E9;strokeColor=#2E7D32;strokeWidth=2;align=left;verticalAlign=top;spacing=6;fontSize=11;fontColor=#1B5E20;',
  fail: 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#FDECEA;strokeColor=#C62828;strokeWidth=2;align=left;verticalAlign=top;spacing=6;fontSize=11;fontColor=#8E1B1B;',
  note: 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#FFF8E1;strokeColor=#D6A300;strokeWidth=1;align=left;verticalAlign=top;spacing=6;fontSize=11;fontColor=#4E3B00;',
  stage: 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#C55A11;strokeWidth=2;align=left;verticalAlign=top;spacing=6;fontSize=11;fontColor=#1F2933;',
  diamond: 'rhombus;whiteSpace=wrap;html=1;fillColor=#FFF8E1;strokeColor=#D6A300;strokeWidth=2;fontSize=11;fontStyle=1;fontColor=#4E3B00;',
  bar: (fill) => `rounded=1;arcSize=30;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=none;fontSize=11;fontStyle=1;fontColor=#FFFFFF;align=center;verticalAlign=middle;`,
  awsCloud: 'points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=14;fontStyle=1;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;strokeWidth=2;',
  awsEc2: 'points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=13;fontStyle=1;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_ec2_instance_contents;strokeColor=#D86613;fillColor=#FFFBF5;verticalAlign=top;align=left;spacingLeft=30;fontColor=#D86613;dashed=0;strokeWidth=2;',
  awsIcon: (name, fill) => `sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=${fill};strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${name};`,
  edge: (color, extra = '') => `edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=${color};endArrow=block;endFill=1;fontSize=10;fontColor=${color};labelBackgroundColor=#FFFFFF;${extra}`,
};
const E = {
  flow: S.edge(C.blue),
  control: S.edge(C.orange),
  traffic: S.edge(C.green),
  auth: S.edge(C.purple),
  fail: S.edge(C.red),
  proposed: S.edge(C.grey, 'dashed=1;dashPattern=6 4;'),
};

// ---------- model ----------
const pages = [];
let page;
function newPage(id, name) { page = { id, name, cells: [] }; pages.push(page); }
const mono = (t) => `<font face="Courier New">${t}</font>`;
const monoS = (t) => `<font face="Courier New" style="font-size:10px">${t}</font>`;
const big = (st) => st.replace('fontSize=11', 'fontSize=12');

// Shapes use coordinates relative to their parent container.
function box(id, parent, x, y, w, h, value, style) {
  page.cells.push({ kind: 'v', id: `${page.id}_${id}`, parent: parent ? `${page.id}_${parent}` : '1', x, y, w, h, value, style });
}
function card(id, parent, x, y, w, h, title, lines = [], style = S.card()) {
  box(id, parent, x, y, w, h, [`<b>${title}</b>`, ...lines].join('<br>'), style);
}
function cardBig(id, parent, x, y, w, h, title, lines, style) { card(id, parent, x, y, w, h, title, lines, big(style)); }
function awsCard(id, parent, x, y, w, h, icon, fill, title, lines, stroke = '#5B7083') {
  card(id, parent, x, y, w, h, title, lines, S.iconCard(stroke));
  box(`${id}_icon`, id, 8, 8, 38, 38, '', S.awsIcon(icon, fill));
}
// opts: ex,ey = exit point on source (0..1), nx,ny = entry point on target, pts = absolute waypoints
function edge(id, source, target, label, style, opts = {}) {
  let st = style;
  if (opts.ex !== undefined) st += `exitX=${opts.ex};exitY=${opts.ey};exitDx=0;exitDy=0;`;
  if (opts.nx !== undefined) st += `entryX=${opts.nx};entryY=${opts.ny};entryDx=0;entryDy=0;`;
  page.cells.push({ kind: 'e', id: `${page.id}_${id}`, source: `${page.id}_${source}`, target: `${page.id}_${target}`, value: label || '', style: st, pts: opts.pts || [], opts });
}
function line(id, x1, y1, x2, y2, style) {
  page.cells.push({ kind: 'l', id: `${page.id}_${id}`, x1, y1, x2, y2, style, value: '' });
}

function legend(parent, x, y, w, h) {
  box('legend', parent, x, y, w, h, 'Legend', S.zone('#FFFFFF', '#5B7083'));
  const rows = [
    ['flow', E.flow, 'Solid blue: configured workflow (files and data)'],
    ['control', E.control, 'Solid orange: deployment control path'],
    ['traffic', E.traffic, 'Solid green: user / application traffic'],
    ['auth', E.auth, 'Solid purple + \u{1F512}: authentication'],
    ['fail', E.fail, 'Red: failure path'],
    ['prop', E.proposed, 'Dashed grey: optional or proposed, not configured'],
  ];
  // Legend lines are free-standing, so they use absolute page coordinates.
  const abs = absOf(`${page.id}_legend`);
  rows.forEach(([k, st, text], i) => {
    const yy = 36 + i * 31;
    line(`lg_${k}`, abs.x + 14, abs.y + yy + 15, abs.x + 74, abs.y + yy + 15, st);
    box(`lg_${k}_t`, 'legend', 84, yy, w - 94, 30, text, 'text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=11;fontColor=#1F2933;');
  });
  box('lg_sec', 'legend', 14, 36 + rows.length * 31, w - 24, 28, '\u{1F512} = secret or credential boundary', 'text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=11;fontColor=#6A1B9A;');
}

function absOf(id) {
  let c = page.cells.find((k) => k.id === id);
  let x = 0; let y = 0;
  while (c) { x += c.x; y += c.y; c = c.parent === '1' ? null : page.cells.find((k) => k.id === c.parent); }
  return { x, y };
}

// =====================================================================================
// PAGE 1: End-to-End Architecture
// =====================================================================================
newPage('p1', '1 End-to-End Architecture');
box('title', null, 20, 12, 1880, 36, 'FoodExpress: from <i>git push</i> to a running application on Amazon EC2', S.title);
box('subtitle', null, 20, 48, 1880, 34, 'What this repository really contains: GitLab CI/CD → Amazon S3 → AWS CodeDeploy → one EC2 instance. There is no Jenkins, Docker, Amazon ECR, Amazon EKS / Kubernetes, Prometheus or Grafana in the repository.', S.subtitle);

// --- Zone A
box('zA', null, 20, 90, 300, 700, 'A · Developer and GitLab', S.zone('#EEF4FB', '#1F4E79'));
card('dev', 'zA', 20, 40, 260, 60, 'Developer', ['Writes and tests code on a laptop.']);
card('ide', 'zA', 20, 130, 260, 160, 'VS Code + Claude Code', [
  'Claude Code is an AI assistant inside the editor. It helps write and review application code, the pipeline file, deploy scripts and documentation.',
  '<i>It is not part of the pipeline and does not trigger it.</i>']);
card('git', 'zA', 20, 320, 260, 100, 'Local Git repository', ['Default branch: ' + mono('main'), mono('git commit'), mono('git push origin main')]);
card('gitlab', 'zA', 20, 450, 260, 130, 'GitLab.com project', [
  mono('devops_slate/'), mono('foodexpress-monolithic-nodejs'),
  'Stores the source code. Every push starts a pipeline defined in ' + mono('.gitlab-ci.yml') + '.'], S.card('#C55A11'));
card('mr', 'zA', 20, 600, 260, 85, 'Branches and merge requests', [
  'Push to any branch: <b>test</b> only. Push to main: all three stages. No merge-request pipeline is configured.'], S.note);
edge('e_dev_ide', 'dev', 'ide', 'writes code', E.flow);
edge('e_ide_git', 'ide', 'git', 'commit', E.flow);
edge('e_git_gitlab', 'git', 'gitlab', 'push', E.flow);

// --- Zone B
box('zB', null, 340, 90, 330, 700, 'B · GitLab CI/CD (.gitlab-ci.yml)', S.zone('#FFF4E5', '#C55A11'));
card('s1', 'zB', 20, 40, 290, 130, '① test', [
  'Image: ' + mono('node:20'), mono('npm ci'), mono('npm test') + ' (12 tests)', 'Runs on every branch.'], S.stage);
card('s2', 'zB', 20, 195, 290, 130, '② package', [
  'Image: ' + mono('node:20'), mono('git archive') + ' → ' + mono('foodexpress.zip'), 'Saved as a job artifact for 1 week.', 'Default branch only.'], S.stage);
card('s3', 'zB', 20, 350, 290, 215, '③ deploy', [
  'Image: ' + mono('amazon/aws-cli:latest'), '\u{1F512} Signs in with a GitLab OIDC token. No AWS keys are stored.',
  mono('aws s3 cp'), mono('aws deploy create-deployment'), mono('aws deploy wait deployment-successful'),
  'Environment: production. One deployment at a time. Default branch only.'], S.stage);
card('pfail', 'zB', 20, 590, 290, 95, '✖ If any stage fails', [
  'The pipeline stops and later stages do not run. No automatic rollback is configured.'], S.fail);
edge('e_gitlab_s1', 'gitlab', 's1', 'push starts pipeline', E.flow, { ex: 1, ey: 0.5, nx: 0, ny: 0.5 });
edge('e_s1_s2', 's1', 's2', 'tests passed', E.flow);
edge('e_s2_s3', 's2', 's3', 'zip artifact', E.flow);
edge('e_s3_fail', 's3', 'pfail', '', E.fail);

// --- Zone C: AWS
box('aws', null, 690, 90, 890, 700, 'C · AWS Cloud (region = ${AWS_DEFAULT_REGION})', S.awsCloud);
awsCard('oidc', 'aws', 20, 45, 240, 90, 'identity_and_access_management', '#DD344C', 'IAM identity provider', [
  mono('gitlab.com') + ' (OpenID Connect)', 'Created by hand, see walkthrough.']);
awsCard('role', 'aws', 20, 155, 240, 135, 'identity_and_access_management', '#DD344C', '\u{1F512} IAM role for the pipeline', [
  mono('${AWS_ROLE_ARN}'), 'Trusts only this project and the main branch. May upload the zip and start a deployment.']);
awsCard('s3b', 'aws', 20, 310, 240, 110, 's3', '#7AA116', 'Amazon S3 bucket', [
  mono('${S3_BUCKET}'), 'Key: ' + mono('foodexpress/'), mono('&lt;short commit id&gt;.zip')]);
awsCard('cd', 'aws', 20, 440, 240, 150, 'codedeploy', '#C925D1', 'AWS CodeDeploy', [
  'App:', monoS('${CODEDEPLOY_APPLICATION}'), 'Group:', monoS('${CODEDEPLOY_DEPLOYMENT_GROUP}'),
  'Finds the server by its tag (documented: App = foodexpress).']);
card('svc', 'aws', 20, 610, 240, 75, 'Other IAM roles (documented)', [
  'CodeDeploy service role and EC2 instance role. Not defined as code in the repo.'], S.note);

box('ec2', 'aws', 310, 45, 565, 640, 'EC2 instance · Amazon Linux 2023 · single server', S.awsEc2);
card('agent', 'ec2', 15, 40, 255, 110, 'CodeDeploy agent', [
  'Installed once by hand. Polls CodeDeploy, downloads the zip from S3 with the instance role, runs ' + mono('appspec.yml') + '.']);
card('hooks', 'ec2', 15, 170, 255, 165, 'appspec.yml lifecycle', [
  '<b>Install:</b> copy files to ' + mono('/opt/foodexpress'),
  '<b>AfterInstall:</b> ' + mono('deploy/setup-ec2.sh'),
  'Node.js 20, ' + mono('npm ci --omit=dev') + ', restart.',
  '<b>ValidateService:</b>', mono('deploy/validate-service.sh')]);
card('systemd', 'ec2', 15, 355, 255, 105, 'systemd service: foodexpress', [
  'User ' + mono('foodexpress') + ', ' + mono('NODE_ENV=production'),
  mono('Restart=on-failure') + '. Starts on boot.']);
card('env', 'ec2', 15, 480, 255, 85, '\u{1F512} /opt/foodexpress/.env', [
  'PORT and SMTP settings. Never in Git, never in the zip. File mode 600. Deployments keep it.']);
card('logs', 'ec2', 15, 580, 255, 48, 'Logs: journald', [mono('journalctl -u foodexpress')]);

box('zD', 'ec2', 285, 40, 265, 400, 'D · FoodExpress monolith', S.zone('#EAF5EA', '#2E7D32'));
card('static', 'zD', 12, 32, 241, 62, 'Website (static files)', [mono('public/') + ' HTML, CSS, JavaScript']);
card('api', 'zD', 12, 104, 241, 76, 'JSON API', [mono('/api/products'), mono('/api/orders')]);
card('health', 'zD', 12, 190, 241, 46, 'Health check', [mono('GET /health')]);
card('store', 'zD', 12, 246, 241, 62, 'Data: in memory', ['Menu and orders. Orders are lost on every restart.']);
card('email', 'zD', 12, 318, 241, 70, 'Email service (Nodemailer)', ['Sends the order confirmation.']);
card('nginx', 'ec2', 285, 460, 265, 100, 'Optional: Nginx reverse proxy', [
  'Port 80 → ' + mono('127.0.0.1:3000'), 'Manual: ' + mono('deploy/nginx_installation.sh') + '. Not run by the pipeline.'], S.proposed);
card('sg', 'ec2', 285, 575, 265, 53, 'Security group (documented)', ['Inbound TCP 3000, and 80 with Nginx.'], S.note);

edge('e_s3_role', 's3', 'role', '3a \u{1F512} OIDC sign-in', E.auth, { ex: 1, ey: 0.12, nx: 0, ny: 0.5 });
edge('e_oidc_role', 'oidc', 'role', 'verifies token', E.auth);
edge('e_s3_s3b', 's3', 's3b', '3b upload zip', E.flow, { ex: 1, ey: 0.5, nx: 0, ny: 0.5 });
edge('e_s3_cd', 's3', 'cd', '3c start + wait', E.control, { ex: 1, ey: 0.88, nx: 0, ny: 0.5 });
edge('e_s3b_agent', 's3b', 'agent', 'download zip', E.flow, { ex: 1, ey: 0.5, nx: 0, ny: 0.3, pts: [[970, 455], [970, 208]] });
edge('e_cd_agent', 'cd', 'agent', 'deployment instruction', E.control, { ex: 1, ey: 0.5, nx: 0, ny: 0.75, pts: [[985, 605], [985, 258]] });
edge('e_agent_hooks', 'agent', 'hooks', 'runs', E.control);
edge('e_hooks_systemd', 'hooks', 'systemd', 'restart', E.control);
edge('e_systemd_app', 'systemd', 'zD', 'node server.js', E.control, { ex: 1, ey: 0.5, nx: 0, ny: 0.92 });
edge('e_hooks_health', 'hooks', 'health', 'health check', E.control, { ex: 1, ey: 0.5, nx: 0, ny: 0.5 });

// --- Right column
card('users', null, 1620, 185, 280, 90, 'Customer (web browser)', ['Opens ' + mono('http://&lt;server&gt;:3000'), 'Browses the menu and places orders.']);
card('smtp', null, 1620, 478, 280, 90, 'SMTP mail server (external)', ['\u{1F512} Host and login come from ' + mono('.env') + '. Not part of this repository.']);
box('zE', null, 1620, 600, 280, 190, 'E · Monitoring', S.zone('#F3EEFA', '#6A1B9A'));
card('mon', 'zE', 10, 32, 260, 68, 'Configured today', [mono('/health') + ', journald logs and CodeDeploy events. No metrics.']);
card('prom', 'zE', 10, 110, 125, 70, 'Prometheus', ['Proposed. Not in the repo.'], S.proposed);
card('graf', 'zE', 145, 110, 125, 70, 'Grafana', ['Proposed. Not in the repo.'], S.proposed);
edge('e_users_app', 'users', 'static', 'HTTP :3000', E.traffic, { ex: 0, ey: 0.3, nx: 1, ny: 0.5 });
edge('e_users_nginx', 'users', 'nginx', 'HTTP :80 (optional)', E.proposed, { ex: 0, ey: 0.8, nx: 1, ny: 0.5, pts: [[1594, 257], [1594, 645]] });
edge('e_nginx_app', 'nginx', 'zD', '', E.proposed, { ex: 0.5, ey: 0, nx: 0.5, ny: 1 });
edge('e_email_smtp', 'email', 'smtp', 'SMTP', E.flow, { ex: 1, ey: 0.5, nx: 0, ny: 0.5 });
edge('e_app_prom', 'zD', 'prom', 'proposed', E.proposed, { ex: 1, ey: 0.97, nx: 0, ny: 0.5, pts: [[1608, 563], [1608, 745]] });
edge('e_prom_graf', 'prom', 'graf', '', E.proposed);

// --- Bottom band
legend(null, 20, 810, 400, 250);
cardBig('k1', null, 440, 810, 355, 250, 'CI and CD', [
  '<b>Continuous Integration</b> is stages ① and ②: every push is tested and packaged automatically.',
  '<b>Continuous Deployment</b> is stage ③ plus CodeDeploy: a tested package is put on the server with no manual step.',
  'Here both run in one GitLab pipeline.'], S.card('#1F4E79'));
cardBig('k2', null, 815, 810, 355, 250, 'Source code and artifact', [
  '<b>Source code</b> lives in GitLab.', 'The <b>artifact</b> is ' + mono('foodexpress.zip') + ': a snapshot of one commit, stored in S3 under that commit id.',
  'Nothing is compiled. Dependencies are installed on the server by ' + mono('npm ci') + '.',
  'There is no Docker image in this project.'], S.card('#1F4E79'));
cardBig('k3', null, 1190, 810, 355, 250, 'Control path and user traffic', [
  '<b>Orange</b> arrows tell the server what to deploy: GitLab → CodeDeploy → agent → scripts.',
  '<b>Green</b> arrows are customers using the site on port 3000.',
  'They never share a path. Customers cannot reach CodeDeploy, and the pipeline never logs in to the server.'], S.card('#1F4E79'));
card('k4', null, 1565, 810, 335, 250, 'Not in this repository', [
  'Jenkins, Dockerfile, Amazon ECR, Amazon EKS, Kubernetes manifests, Terraform or CloudFormation, Prometheus, Grafana.',
  'AWS resources are created by hand from ' + mono('docs/CodeDeploy-Setup-Walkthrough.md') + '.'], S.note);

// =====================================================================================
// PAGE 2: CI/CD Pipeline Deep Dive
// =====================================================================================
newPage('p2', '2 CI-CD Pipeline Deep Dive');
box('title', null, 20, 12, 1880, 36, 'CI/CD pipeline deep dive: what each stage really runs', S.title);
box('subtitle', null, 20, 50, 1880, 22, 'Stage names, images and commands are copied from .gitlab-ci.yml, appspec.yml and the deploy/ scripts.', S.subtitle);
box('ci_bar', null, 250, 74, 650, 20, 'Continuous Integration (stages 1 and 2)', S.bar('#1F4E79'));
box('cd_bar', null, 930, 74, 970, 20, 'Continuous Deployment (stage 3 and AWS CodeDeploy)', S.bar('#C55A11'));

card('f_push', null, 20, 108, 190, 86, 'Push to GitLab', [mono('git push origin main')]);
card('f_test', null, 250, 108, 190, 86, '① test', [mono('npm ci') + ', ' + mono('npm test')], S.stage);
box('d1', null, 480, 98, 140, 106, 'Tests pass?', S.diamond);
card('f_pkg', null, 660, 108, 200, 86, '② package', ['Build ' + mono('foodexpress.zip')], S.stage);
card('f_dep', null, 930, 108, 220, 86, '③ deploy', ['Upload zip, start CodeDeploy, wait for the result'], S.stage);
card('f_cd', null, 1190, 108, 220, 86, 'CodeDeploy on EC2', ['Install, set up, restart, health check']);
box('d2', null, 1450, 98, 160, 106, 'Deployment<br>Succeeded?', S.diamond);
card('f_ok', null, 1660, 108, 240, 86, '✔ Pipeline green', ['The new version is live on the server.'], S.ok);
card('f_r1', null, 440, 240, 220, 84, '✖ Pipeline stops', ['package and deploy do not run. The server is unchanged.'], S.fail);
card('f_r2', null, 1400, 240, 260, 84, '✖ deploy job fails', ['No automatic rollback is configured. Read the CodeDeploy events, fix, push again.'], S.fail);
edge('e1', 'f_push', 'f_test', '', E.flow);
edge('e2', 'f_test', 'd1', '', E.flow);
edge('e3', 'd1', 'f_pkg', 'yes', E.flow);
edge('e4', 'd1', 'f_r1', 'no', E.fail);
edge('e5', 'f_pkg', 'f_dep', 'artifact', E.flow);
edge('e6', 'f_dep', 'f_cd', '', E.control);
edge('e7', 'f_cd', 'd2', '', E.control);
edge('e8', 'd2', 'f_ok', 'yes', E.flow);
edge('e9', 'd2', 'f_r2', 'no', E.fail);

// Detail containers
box('dt', null, 20, 345, 400, 365, '① test · node:20 · every branch', S.zone('#FFF4E5', '#C55A11'));
card('dt1', 'dt', 15, 35, 370, 62, '1.1 Checkout', ['GitLab clones the commit into the job container (default behaviour).']);
card('dt2', 'dt', 15, 107, 370, 62, '1.2 Install dependencies', [mono('npm ci') + ' installs exactly what ' + mono('package-lock.json') + ' lists.']);
card('dt3', 'dt', 15, 179, 370, 96, '1.3 Run the tests', [mono('npm test') + ' runs ' + mono('node --test') + '.', '11 tests in ' + mono('test/api.test.js'), '1 test in ' + mono('test/email-failure.test.js')]);
card('dt4', 'dt', 15, 285, 370, 66, 'Not configured', ['No lint, code-quality or security-scan job exists.'], S.note);
edge('dte1', 'dt1', 'dt2', '', E.flow); edge('dte2', 'dt2', 'dt3', '', E.flow);

box('dp', null, 440, 345, 400, 365, '② package · node:20 · default branch', S.zone('#FFF4E5', '#C55A11'));
card('dp1', 'dp', 15, 35, 370, 96, '2.1 Build the zip', [mono('git archive --format=zip'), mono('  -o foodexpress.zip HEAD'), 'Only committed files. No .git, node_modules or .env.']);
card('dp2', 'dp', 15, 141, 370, 80, '2.2 Keep it as a job artifact', ['Path: ' + mono('foodexpress.zip'), 'Expires in 1 week. Passed to the deploy job.']);
card('dp3', 'dp', 15, 231, 370, 120, 'What is in the zip', ['The whole repository at that commit: app code, ' + mono('appspec.yml') + ', ' + mono('deploy/') + ' scripts, docs and tests. Nothing is compiled.'], S.note);
edge('dpe1', 'dp1', 'dp2', '', E.flow);

box('dd', null, 860, 345, 500, 365, '③ deploy · amazon/aws-cli:latest · default branch', S.zone('#FFF4E5', '#C55A11'));
card('dd1', 'dd', 15, 35, 470, 82, '3.1 \u{1F512} Sign in to AWS', ['GitLab issues ' + mono('GITLAB_OIDC_TOKEN') + ' (aud https://gitlab.com).', 'The AWS CLI swaps it for temporary credentials of ' + mono('${AWS_ROLE_ARN}') + '.']);
card('dd2', 'dd', 15, 127, 470, 66, '3.2 Upload the zip', [mono('aws s3 cp foodexpress.zip'), mono('s3://$S3_BUCKET/foodexpress/$CI_COMMIT_SHORT_SHA.zip')]);
card('dd3', 'dd', 15, 203, 470, 66, '3.3 Start the deployment', [mono('aws deploy create-deployment') + ' with the application,', 'the deployment group and the S3 location of the zip.']);
card('dd4', 'dd', 15, 279, 470, 72, '3.4 Wait for the result', [mono('aws deploy wait deployment-successful'), 'The job turns red if CodeDeploy reports a failure.']);
edge('dde1', 'dd1', 'dd2', '', E.flow); edge('dde2', 'dd2', 'dd3', '', E.flow); edge('dde3', 'dd3', 'dd4', '', E.control);

box('dc', null, 1380, 345, 520, 365, 'AWS CodeDeploy on EC2 · appspec.yml', S.zone('#FFFBF5', '#D86613'));
card('dc1', 'dc', 15, 35, 490, 48, '4 DownloadBundle', ['The agent downloads the zip from S3.']);
card('dc2', 'dc', 15, 93, 490, 62, '5 Install', ['Files are copied to ' + mono('/opt/foodexpress') + '.', mono('file_exists_behavior: OVERWRITE')]);
card('dc3', 'dc', 15, 165, 490, 112, '6 AfterInstall · deploy/setup-ec2.sh · root · timeout 600 s', [
  'Installs Node.js 20 if missing. Creates the user ' + mono('foodexpress') + '.',
  mono('npm ci --omit=dev') + '. Creates ' + mono('.env') + ' only if there is none.',
  'Writes the systemd unit, then ' + mono('systemctl restart foodexpress') + '.']);
card('dc4', 'dc', 15, 287, 490, 66, '7 ValidateService · deploy/validate-service.sh · timeout 60 s', [
  'Calls ' + mono('http://127.0.0.1:$PORT/health') + ' up to 30 times, 1 s apart.', 'Exit code 1 fails the deployment.']);
edge('dce1', 'dc1', 'dc2', '', E.control); edge('dce2', 'dc2', 'dc3', '', E.control); edge('dce3', 'dc3', 'dc4', '', E.control);

// Bottom row
cardBig('vars', null, 20, 730, 620, 330, '\u{1F512} GitLab CI/CD variables (Settings > CI/CD > Variables)', [
  'The pipeline file holds no account details. It reads five variables. Values are set in GitLab and are not in the repository.',
  '',
  mono('AWS_ROLE_ARN') + ': IAM role the deploy job assumes',
  mono('AWS_DEFAULT_REGION') + ': AWS region for S3 and CodeDeploy',
  mono('S3_BUCKET') + ': bucket that stores the zips',
  mono('CODEDEPLOY_APPLICATION') + ': CodeDeploy application name',
  mono('CODEDEPLOY_DEPLOYMENT_GROUP') + ': CodeDeploy deployment group name',
  '',
  'Set inside the job: ' + mono('S3_KEY') + ', ' + mono('AWS_WEB_IDENTITY_TOKEN_FILE') + ', ' + mono('AWS_ROLE_SESSION_NAME') + '.',
  'No AWS access keys are used anywhere.'], S.card('#6A1B9A'));
cardBig('rules', null, 660, 730, 420, 330, 'Which push runs which stage', [
  '<b>Push to main (default branch):</b>', 'test → package → deploy', '',
  '<b>Push to any other branch:</b>', 'test only', '',
  '<b>Merge requests:</b>', 'No merge-request pipeline is configured.', '',
  '<b>Trigger:</b> a push. No webhook, schedule or manual gate is configured.', '',
  '<b>Concurrency:</b> ' + mono('resource_group: production') + ' lets only one deploy job run at a time.'], S.card('#C55A11'));
cardBig('where', null, 1100, 730, 420, 330, 'Where each action runs', [
  '<b>GitLab runner</b> (job containers): checkout, tests, zip, AWS CLI calls. The runner itself is not defined in the repo; GitLab.com shared runners are assumed.', '',
  '<b>AWS</b>: S3 stores the zip. CodeDeploy tracks the deployment.', '',
  '<b>EC2 instance</b>: the CodeDeploy agent copies the files and runs the two scripts as root.', '',
  'The pipeline never opens an SSH session to the server.'], S.card('#1F4E79'));
legend(null, 1540, 730, 360, 330);

// =====================================================================================
// PAGE 3: EC2 Runtime and Monitoring
// =====================================================================================
newPage('p3', '3 EC2 Runtime and Monitoring');
box('title', null, 20, 12, 1880, 36, 'Runtime on the EC2 instance, application traffic and monitoring', S.title);
box('subtitle', null, 20, 50, 1880, 34, 'This repository has no Kubernetes. The application is one Node.js process managed by systemd on a single EC2 instance. Kubernetes objects such as Pods, Deployments and Services do not exist here.', S.subtitle);

card('users', null, 20, 105, 230, 90, 'Customer (web browser)', ['Loads pages and calls the JSON API.']);
card('unsplash', null, 20, 330, 230, 100, 'images.unsplash.com', ['The browser loads menu photos from here. Allowed by the Content-Security-Policy.']);
edge('e_users_unsplash', 'users', 'unsplash', 'photos', E.traffic, { ex: 0.25, ey: 1, nx: 0.25, ny: 0 });

box('ec2', null, 290, 90, 1000, 620, 'EC2 instance · Amazon Linux 2023', S.awsEc2);
card('nginx', 'ec2', 20, 110, 200, 110, 'Optional: Nginx', ['Port 80 → ' + mono('127.0.0.1:3000'), 'Installed by hand, not by the pipeline.'], S.proposed);
card('systemd', 'ec2', 20, 245, 200, 150, 'systemd: foodexpress', [mono('ExecStart node server.js'), mono('Restart=on-failure'), mono('RestartSec=5'), 'Starts on boot. Hardened: NoNewPrivileges, PrivateTmp, ProtectSystem=full.']);
card('env', 'ec2', 20, 415, 200, 100, '\u{1F512} .env file', [mono('/opt/foodexpress/.env'), 'PORT, NODE_ENV, TRUST_PROXY, SMTP_*, EMAIL_FROM. Mode 600.']);
card('logs', 'ec2', 20, 535, 200, 65, 'journald', ['Process output (stdout), stored by systemd.']);

box('proc', 'ec2', 250, 45, 730, 555, 'Node.js process · node server.js · port 3000 · user foodexpress', S.zone('#EAF5EA', '#2E7D32'));
card('mw', 'proc', 15, 35, 700, 62, 'Express middleware', ['Helmet security headers with a Content-Security-Policy (HSTS in production). JSON body limit ' + mono('10kb') + '. ' + mono('trust proxy') + ' from TRUST_PROXY.']);
card('static', 'proc', 15, 110, 220, 150, 'Website: public/', [mono('index.html'), mono('menu.html'), mono('checkout.html'), mono('orders.html'), mono('order-success.html'), 'plus CSS and JavaScript']);
card('api', 'proc', 250, 110, 235, 150, 'JSON API: routes/', [mono('GET  /api/products'), mono('GET  /api/products/:id'), mono('POST /api/orders'), mono('GET  /api/orders/:id'), mono('POST /api/orders/:id/'), mono('     resend-email')]);
card('health', 'proc', 500, 110, 215, 150, 'GET /health', ['Returns JSON:', mono('status') + ', ' + mono('uptimeSeconds') + ',', mono('timestamp') + ', ' + mono('environment') + ',', mono('emailConfigured'), 'Used by ValidateService.']);
card('services', 'proc', 15, 275, 340, 125, 'Business logic: services/', [mono('orderService') + ': creates and prices orders', mono('validation') + ': checks every field', mono('emailService') + ': builds and sends the confirmation email with Nodemailer']);
card('data', 'proc', 370, 275, 345, 125, 'Data: data/ (in memory, no database)', [mono('products') + ': the menu', mono('orderStore') + ': a Map, at most 1000 orders', '<b>All orders are lost when the process restarts, including on every deployment.</b>']);
card('limits', 'proc', 15, 415, 700, 125, 'Built-in protection (per client IP, per minute)', [
  mono('POST /api/orders') + ': 60, or RATE_LIMIT_ORDERS_PER_MIN',
  mono('GET /api/orders/:id') + ': 60     ' + mono('POST .../resend-email') + ': 10',
  'An order has at most 20 lines and 10 of each item. At most 5 email attempts per order, with a 30 s wait between resends.',
  'Errors are returned as JSON. Stack traces stay in the server log.']);

card('smtp', null, 1320, 360, 270, 100, 'SMTP mail server (external)', ['\u{1F512} SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS are read from ' + mono('.env') + '.']);
cardBig('deployfx', null, 1320, 90, 580, 240, 'What a deployment does to this runtime', [
  '1. The CodeDeploy agent replaces the files in ' + mono('/opt/foodexpress') + '.',
  '2. ' + mono('setup-ec2.sh') + ' runs ' + mono('npm ci --omit=dev') + ' and restarts the service.',
  '3. The site is unavailable for a few seconds while the process restarts.',
  '4. In-memory orders are gone.',
  '5. ' + mono('validate-service.sh') + ' calls ' + mono('/health') + '. No answer means the deployment is marked Failed.',
  '', '<b>Compared with Kubernetes:</b> there is no rolling update, no replica and no automatic rollback. One process, one server.'], S.card('#D86613'));
cardBig('concepts', null, 1320, 490, 580, 220, 'Three paths to keep apart', [
  '<b>Application traffic (green):</b> browser → port 3000 → Express.',
  '<b>Deployment control (orange):</b> CodeDeploy → agent → scripts → systemd. See page 2.',
  '<b>Monitoring (page bottom):</b> today a person reads the health endpoint and the logs. Nothing collects metrics.', '',
  '<b>Metrics collection</b> means a tool pulls numbers on a schedule and stores them. <b>Dashboards</b> only draw what was stored. Neither exists here yet.'], S.card('#1F4E79'));

edge('e_users_proc', 'users', 'proc', 'HTTP :3000', E.traffic, { ex: 1, ey: 0.5, nx: 0, ny: 0.027 });
edge('e_users_nginx', 'users', 'nginx', 'HTTP :80 (optional)', E.proposed, { ex: 0.75, ey: 1, nx: 0, ny: 0.5 });
edge('e_nginx_proc', 'nginx', 'proc', '', E.proposed, { ex: 1, ey: 0.5, nx: 0, ny: 0.216 });
edge('e_systemd_proc', 'systemd', 'proc', 'starts, restarts', E.control, { ex: 1, ey: 0.5, nx: 0, ny: 0.5 });
edge('e_env_proc', 'env', 'proc', 'read at start', E.flow, { ex: 1, ey: 0.5, nx: 0, ny: 0.703 });
edge('e_proc_logs', 'proc', 'logs', 'stdout', E.flow, { ex: 0, ey: 0.932, nx: 1, ny: 0.5 });
edge('e_proc_smtp', 'proc', 'smtp', '\u{1F512} SMTP', E.flow, { ex: 1, ey: 0.495, nx: 0, ny: 0.5 });

box('zE', null, 20, 730, 1270, 330, 'E · Monitoring and observability', S.zone('#F3EEFA', '#6A1B9A'));
card('m1', 'zE', 15, 35, 300, 130, 'Configured: health endpoint', [mono('curl http://127.0.0.1:3000/health'), 'Checked automatically once per deployment by ValidateService. Nothing checks it between deployments.']);
card('m2', 'zE', 15, 180, 300, 135, 'Configured: logs', [mono('journalctl -u foodexpress'), 'CodeDeploy agent log:', mono('/var/log/aws/codedeploy-agent/'), 'CodeDeploy console: lifecycle events of each deployment.']);
card('m3', 'zE', 335, 35, 290, 280, 'Missing in the repository', [
  'No ' + mono('/metrics') + ' endpoint in the app.', 'No Prometheus configuration, scrape job or interval.', 'No node exporter.', 'No Grafana data source or dashboard.', 'No alert rules or notification channel.', 'No CloudWatch agent or alarm.'], S.note);
card('prom', 'zE', 645, 35, 190, 130, 'Prometheus', ['Proposed. Would scrape a ' + mono('/metrics') + ' endpoint and a node exporter on a fixed interval.'], S.proposed);
card('graf', 'zE', 855, 35, 190, 130, 'Grafana', ['Proposed. Would query Prometheus and draw dashboards and alerts.'], S.proposed);
card('m4', 'zE', 645, 180, 400, 135, 'What students would watch once metrics exist', ['CPU and memory of the server, process restarts, requests per second, error rate (4xx and 5xx), response time.', 'None of these are measured today.'], S.proposed);
card('m5', 'zE', 1065, 35, 190, 280, 'Troubleshooting today', ['1. Is the pipeline red? Read the job log.', '2. Did CodeDeploy fail? Read the lifecycle event.', '3. Is the service up?', mono('systemctl status'), mono('foodexpress'), '4. Read the app log with journalctl.']);
edge('e_proc_prom', 'proc', 'prom', 'proposed: scrape', E.proposed, { ex: 0.62, ey: 1, nx: 0.5, ny: 0 });
edge('e_prom_graf', 'prom', 'graf', 'query', E.proposed);
legend(null, 1310, 730, 590, 330);

// =====================================================================================
// Output
// =====================================================================================
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function toXml() {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<mxfile host="app.diagrams.net" agent="generate-diagram.js" version="24.7.17" type="device">'];
  for (const p of pages) {
    out.push(`  <diagram id="${p.id}" name="${esc(p.name)}">`);
    out.push(`    <mxGraphModel dx="1600" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${PAGE_W}" pageHeight="${PAGE_H}" math="0" shadow="0" background="#FFFFFF">`);
    out.push('      <root>', `        <mxCell id="${p.id}_0" />`, `        <mxCell id="${p.id}_1" parent="${p.id}_0" />`);
    const par = (x) => (x === '1' ? `${p.id}_1` : x);
    for (const c of p.cells) {
      if (c.kind === 'v') {
        out.push(`        <mxCell id="${c.id}" value="${esc(c.value)}" style="${esc(c.style)}" vertex="1" parent="${par(c.parent)}">`,
          `          <mxGeometry x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" as="geometry" />`, '        </mxCell>');
      } else if (c.kind === 'e') {
        out.push(`        <mxCell id="${c.id}" value="${esc(c.value)}" style="${esc(c.style)}" edge="1" parent="${p.id}_1" source="${c.source}" target="${c.target}">`);
        if (c.pts.length) {
          out.push('          <mxGeometry relative="1" as="geometry">', '            <Array as="points">',
            ...c.pts.map(([x, y]) => `              <mxPoint x="${x}" y="${y}" />`), '            </Array>', '          </mxGeometry>');
        } else out.push('          <mxGeometry relative="1" as="geometry" />');
        out.push('        </mxCell>');
      } else {
        out.push(`        <mxCell id="${c.id}" value="" style="${esc(c.style)}" edge="1" parent="${p.id}_1">`,
          '          <mxGeometry relative="1" as="geometry">',
          `            <mxPoint x="${c.x1}" y="${c.y1}" as="sourcePoint" />`, `            <mxPoint x="${c.x2}" y="${c.y2}" as="targetPoint" />`,
          '          </mxGeometry>', '        </mxCell>');
      }
    }
    out.push('      </root>', '    </mxGraphModel>', '  </diagram>');
  }
  out.push('</mxfile>', '');
  return out.join('\n');
}

// ---------- checks ----------
const plain = (v) => v.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const fontOf = (st) => Number((/fontSize=(\d+)/.exec(st) || [0, 11])[1]);
function wrap(text, widthPx, fs_) {
  const max = Math.max(4, Math.floor(widthPx / (fs_ * 0.6)));
  const lines = [];
  for (const seg of text.split('\n')) {
    if (seg.length <= max) { lines.push(seg); continue; }
    let cur = '';
    for (const word of seg.split(' ')) {
      if ((cur + ' ' + word).trim().length > max && cur) { lines.push(cur); cur = word; } else cur = (cur + ' ' + word).trim();
      while (cur.length > max) { lines.push(cur.slice(0, max)); cur = cur.slice(max); }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}
function check() {
  const problems = [];
  const ids = new Set();
  for (const p of pages) {
    const abs = new Map();
    const byId = new Map(p.cells.map((c) => [c.id, c]));
    for (const c of p.cells) {
      if (ids.has(c.id)) problems.push(`duplicate id ${c.id}`);
      ids.add(c.id);
    }
    const absRect = (c) => {
      if (abs.has(c.id)) return abs.get(c.id);
      let { x, y } = c;
      if (c.parent !== '1') { const pr = absRect(byId.get(c.parent)); x += pr.x; y += pr.y; }
      const r = { x, y, w: c.w, h: c.h }; abs.set(c.id, r); return r;
    };
    for (const c of p.cells) {
      if (c.kind === 'e') {
        if (!byId.has(c.source)) problems.push(`${c.id}: missing source ${c.source}`);
        if (!byId.has(c.target)) problems.push(`${c.id}: missing target ${c.target}`);
        continue;
      }
      if (c.kind !== 'v') continue;
      if (c.parent !== '1' && !byId.has(c.parent)) { problems.push(`${c.id}: missing parent`); continue; }
      const r = absRect(c);
      if (r.x < 0 || r.y < 0 || r.x + r.w > PAGE_W || r.y + r.h > PAGE_H) problems.push(`${c.id}: outside the page`);
      if (c.parent !== '1') {
        const pr = absRect(byId.get(c.parent));
        if (c.x < 0 || c.y < 0 || c.x + c.w > pr.w || c.y + c.h > pr.h) problems.push(`${c.id}: outside its container`);
      }
      const isContainer = /container=1/.test(c.style);
      if (isContainer && plain(c.value).length * fontOf(c.style) * 0.62 > c.w - 24 - Number((/spacingLeft=(d+)/.exec(c.style) || [0, 0])[1])) problems.push(`${c.id}: container title is too long for one line`);
      if (!isContainer && c.value && !/rhombus|shape=mxgraph/.test(c.style)) {
        const fs_ = fontOf(c.style);
        const padL = Number((/spacingLeft=(\d+)/.exec(c.style) || [0, 0])[1]);
        const need = wrap(plain(c.value), c.w - 14 - padL, fs_).length * fs_ * 1.32 + (/^text;|arcSize=30/.test(c.style) ? 0 : 12);
        if (need > c.h + 1) problems.push(`${c.id}: text needs about ${Math.round(need)} px, box is ${c.h} px`);
      }
    }
    // overlap between siblings
    const vs = p.cells.filter((c) => c.kind === 'v' && !/resourceIcon/.test(c.style));
    for (let i = 0; i < vs.length; i += 1) {
      for (let j = i + 1; j < vs.length; j += 1) {
        const a = vs[i]; const b = vs[j];
        if (a.parent !== b.parent) continue;
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) problems.push(`${a.id} overlaps ${b.id}`);
      }
    }
    p.abs = abs; p.absRect = absRect;
  }
  return problems;
}

// ---------- rough SVG preview (not a draw.io render) ----------
function preview(p) {
  const get = (st, k, d) => (new RegExp(`${k}=([^;]+)`).exec(st) || [0, d])[1];
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>`];
  const byId = new Map(p.cells.map((c) => [c.id, c]));
  for (const c of p.cells) {
    if (c.kind !== 'v') continue;
    const r = p.absRect(c);
    const fs_ = fontOf(c.style);
    const fill = get(c.style, 'fillColor', 'none'); const stroke = get(c.style, 'strokeColor', 'none');
    const dash = /dashed=1/.test(c.style) ? ' stroke-dasharray="6 4"' : '';
    if (/rhombus/.test(c.style)) {
      o.push(`<polygon points="${r.x + r.w / 2},${r.y} ${r.x + r.w},${r.y + r.h / 2} ${r.x + r.w / 2},${r.y + r.h} ${r.x},${r.y + r.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
    } else if (!/^text;/.test(c.style)) {
      o.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${fill === 'none' ? 'none' : fill}" stroke="${stroke}" stroke-width="1.5"${dash}/>`);
    }
    if (!c.value) continue;
    const padL = Number(get(c.style, 'spacingLeft', 0));
    const color = get(c.style, 'fontColor', '#1F2933');
    const centre = /rhombus|align=center/.test(c.style);
    const lines = wrap(plain(c.value), r.w - 14 - padL, fs_);
    const startY = /rhombus|verticalAlign=middle/.test(c.style) ? r.y + r.h / 2 - (lines.length * fs_ * 1.32) / 2 + fs_ : r.y + 6 + fs_;
    lines.forEach((ln, i) => {
      const bold = (i === 0 && /<b>/.test(c.value.slice(0, 4))) || /fontStyle=1/.test(c.style);
      const tx = centre ? r.x + r.w / 2 : r.x + 7 + padL;
      o.push(`<text x="${tx}" y="${startY + i * fs_ * 1.32}" font-size="${fs_}" fill="${color}"${bold ? ' font-weight="bold"' : ''}${centre ? ' text-anchor="middle"' : ''}>${esc(ln)}</text>`);
    });
  }
  const pt = (c, fx, fy) => { const r = p.absRect(c); return [r.x + r.w * fx, r.y + r.h * fy]; };
  for (const c of p.cells) {
    if (c.kind === 'v') continue;
    const color = get(c.style, 'strokeColor', '#000');
    const dash = /dashed=1/.test(c.style) ? ' stroke-dasharray="6 4"' : '';
    let pts;
    if (c.kind === 'l') pts = [[c.x1, c.y1], [c.x2, c.y2]];
    else {
      const s = byId.get(c.source); const t = byId.get(c.target);
      const sr = p.absRect(s); const tr = p.absRect(t);
      const horiz = Math.abs((sr.x + sr.w / 2) - (tr.x + tr.w / 2)) > Math.abs((sr.y + sr.h / 2) - (tr.y + tr.h / 2));
      const forward = horiz ? tr.x > sr.x : tr.y > sr.y;
      const a = c.opts.ex !== undefined ? pt(s, c.opts.ex, c.opts.ey) : pt(s, horiz ? (forward ? 1 : 0) : 0.5, horiz ? 0.5 : (forward ? 1 : 0));
      const b = c.opts.nx !== undefined ? pt(t, c.opts.nx, c.opts.ny) : pt(t, horiz ? (forward ? 0 : 1) : 0.5, horiz ? 0.5 : (forward ? 0 : 1));
      let mid = c.pts;
      if (!mid.length && a[0] !== b[0] && a[1] !== b[1]) {
        const vertical = c.opts.ex !== undefined ? (c.opts.ey === 0 || c.opts.ey === 1) : !horiz;
        mid = vertical ? [[a[0], (a[1] + b[1]) / 2], [b[0], (a[1] + b[1]) / 2]] : [[(a[0] + b[0]) / 2, a[1]], [(a[0] + b[0]) / 2, b[1]]];
      }
      pts = [a, ...mid, b];
    }
    o.push(`<polyline points="${pts.map((q) => q.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2"${dash}/>`);
    const [ex, ey] = pts[pts.length - 1];
    o.push(`<circle cx="${ex}" cy="${ey}" r="4" fill="${color}"/>`);
    if (c.value) {
      const m = pts[Math.floor((pts.length - 1) / 2)]; const n = pts[Math.floor((pts.length - 1) / 2) + 1];
      o.push(`<text x="${(m[0] + n[0]) / 2}" y="${(m[1] + n[1]) / 2 - 4}" font-size="10" fill="${color}" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(plain(c.value))}</text>`);
    }
  }
  o.push('</svg>');
  return o.join('\n');
}

const problems = check();
fs.writeFileSync(OUT, toXml(), 'utf8');
const count = pages.map((p) => `${p.name}: ${p.cells.filter((c) => c.kind === 'v').length} shapes, ${p.cells.filter((c) => c.kind !== 'v').length} connectors`);
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
count.forEach((c) => console.log('  ' + c));
if (process.argv.includes('--preview')) {
  const dir = process.argv[process.argv.indexOf('--preview') + 1] || __dirname;
  pages.forEach((p, i) => fs.writeFileSync(path.join(dir, `preview-page${i + 1}.svg`), preview(p), 'utf8'));
  console.log(`wrote ${pages.length} preview SVG files to ${dir}`);
}
if (problems.length) { console.log(`\n${problems.length} problem(s):`); problems.forEach((x) => console.log('  - ' + x)); process.exitCode = 1; } else console.log('checks passed: unique ids, connector endpoints, containment, overlaps, text fit');
