const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');

const VERCEL_API = 'https://api.vercel.com';

function walkFiles(rootDir, relDir = '') {
  const entries = fs.readdirSync(path.join(rootDir, relDir), { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const relPath = path.join(relDir, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) {
      files = files.concat(walkFiles(rootDir, relPath));
    } else {
      files.push(relPath);
    }
  }
  return files;
}

async function uploadFile(absPath, token) {
  const content = fs.readFileSync(absPath);
  const sha = crypto.createHash('sha1').update(content).digest('hex');
  const res = await fetch(`${VERCEL_API}/v2/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': sha,
    },
    body: content,
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    throw new Error(`File upload failed for ${absPath}: ${res.status} ${body}`);
  }
  return { sha, size: content.length };
}

async function deployDirectory({ rootDir, token, teamId, projectId, projectName }) {
  const relFiles = walkFiles(rootDir);
  const files = [];
  for (const rel of relFiles) {
    const { sha, size } = await uploadFile(path.join(rootDir, rel), token);
    files.push({ file: rel, sha, size });
  }

  const createRes = await fetch(`${VERCEL_API}/v13/deployments?teamId=${teamId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName,
      project: projectId,
      target: 'production',
      files,
    }),
  });
  const deployment = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Deployment create failed: ${JSON.stringify(deployment)}`);
  }

  const deploymentId = deployment.id;
  const deadline = Date.now() + 55000;
  while (Date.now() < deadline) {
    const statusRes = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}?teamId=${teamId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusJson = await statusRes.json();
    if (statusJson.readyState === 'READY') {
      return { url: `https://${statusJson.url}`, id: deploymentId };
    }
    if (['ERROR', 'CANCELED', 'BLOCKED'].includes(statusJson.readyState)) {
      throw new Error(`Deployment ended in ${statusJson.readyState}: ${statusJson.errorMessage || ''}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Deployment did not become ready within 55s');
}

module.exports = { deployDirectory, walkFiles, uploadFile };
