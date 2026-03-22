#!/usr/bin/env node
/**
 * aggregate.js — 全リポジトリから .project-meta.yaml + GitHub API データを集約して projects.json を生成
 *
 * 実行モード:
 *   node scripts/aggregate.js          → GitHub API経由（Actions/CI用）
 *   node scripts/aggregate.js --local  → ローカル ~/projects/ を走査（開発用）
 *
 * 必要な環境変数:
 *   GITHUB_TOKEN — GitHub Personal Access Token（API用）
 *   GITHUB_USER  — GitHubユーザー名（デフォルト: ryuichi-gt）
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");
const os = require("os");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_USER = process.env.GITHUB_USER || "ryuichi-gt";
const LOCAL_MODE = process.argv.includes("--local");
const PROJECTS_DIR = path.join(os.homedir(), "projects");
const OUTPUT_PATH = path.join(__dirname, "..", "public", "data", "projects.json");

// ============================================================
// GitHub API helpers
// ============================================================

function ghFetch(apiPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: apiPath,
      headers: {
        "User-Agent": "project-hub-aggregator",
        Accept: "application/vnd.github.v3+json",
      },
    };
    if (GITHUB_TOKEN) {
      options.headers.Authorization = `token ${GITHUB_TOKEN}`;
    }
    https
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data: null });
          }
        });
      })
      .on("error", reject);
  });
}

async function fetchAllRepos() {
  const repos = [];
  let page = 1;
  while (true) {
    const res = await ghFetch(
      `/users/${GITHUB_USER}/repos?per_page=100&page=${page}&sort=updated`
    );
    if (res.status !== 200 || !res.data || res.data.length === 0) break;
    repos.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return repos;
}

async function fetchFileFromRepo(owner, repo, filePath) {
  const res = await ghFetch(
    `/repos/${owner}/${repo}/contents/${filePath}`
  );
  if (res.status === 200 && res.data && res.data.content) {
    return Buffer.from(res.data.content, "base64").toString("utf-8");
  }
  return null;
}

async function fetchRepoPRs(owner, repo) {
  const res = await ghFetch(
    `/repos/${owner}/${repo}/pulls?state=open&per_page=5`
  );
  if (res.status === 200 && Array.isArray(res.data)) {
    return res.data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.user?.login,
      created_at: pr.created_at,
    }));
  }
  return [];
}

// ============================================================
// YAML parser (lightweight — no external dependency)
// ============================================================

function parseSimpleYaml(text) {
  const result = {};
  let currentKey = null;
  let multilineValue = "";
  let inMultiline = false;

  for (const line of text.split("\n")) {
    // Skip comments and empty lines
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) {
      if (inMultiline) multilineValue += "\n";
      continue;
    }

    // Array item
    if (inMultiline && /^\s{2,}-\s/.test(line)) {
      multilineValue += line.trim().replace(/^-\s*/, "") + "\n";
      continue;
    }

    // Multiline continuation
    if (inMultiline && /^\s{2,}/.test(line)) {
      multilineValue += line.trim() + "\n";
      continue;
    }

    // End multiline
    if (inMultiline) {
      result[currentKey] = multilineValue.trim();
      inMultiline = false;
    }

    // Key: value
    const match = line.match(/^(\w[\w_]*)\s*:\s*(.*)/);
    if (match) {
      currentKey = match[1];
      const val = match[2].trim();

      if (val === "|" || val === ">") {
        inMultiline = true;
        multilineValue = "";
      } else if (val.startsWith("[") && val.endsWith("]")) {
        // Inline array
        result[currentKey] = val
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      } else if (val === "" || val === '""' || val === "''") {
        result[currentKey] = "";
      } else {
        result[currentKey] = val.replace(/^["']|["']$/g, "");
      }
    }
  }

  if (inMultiline && currentKey) {
    result[currentKey] = multilineValue.trim();
  }

  return result;
}

// ============================================================
// Local scanning
// ============================================================

function scanLocalProject(dirPath, dirName) {
  const project = {
    id: dirName,
    source: "local",
    name: dirName,
    category: "",
    status: "unknown",
    description: "",
    tech: "",
    url: "",
    login: "",
    deploy: "",
    apis: [],
    business_context: "",
    competitors: [],
    group_company: "",
    // Git info
    git_branch: null,
    git_changes: 0,
    last_commit: null,
    last_commit_date: null,
    has_remote: false,
    github_url: null,
    // GitHub info
    open_prs: [],
    open_issues_count: 0,
    contributors: [],
    last_push_at: null,
  };

  // Read .project-meta.yaml
  const metaPath = path.join(dirPath, ".project-meta.yaml");
  if (fs.existsSync(metaPath)) {
    const meta = parseSimpleYaml(fs.readFileSync(metaPath, "utf-8"));
    Object.assign(project, {
      name: meta.name || dirName,
      category: meta.category || "",
      status: meta.status || "unknown",
      description: meta.description || "",
      tech: meta.tech || "",
      url: meta.url || "",
      login: meta.login || "",
      deploy: meta.deploy || "",
      apis: Array.isArray(meta.apis) ? meta.apis : [],
      business_context: meta.business_context || "",
      competitors: Array.isArray(meta.competitors) ? meta.competitors : [],
      group_company: meta.group_company || "",
    });
  }

  // Git info
  const gitDir = path.join(dirPath, ".git");
  if (fs.existsSync(gitDir)) {
    try {
      project.git_branch = execSync("git branch --show-current", {
        cwd: dirPath,
        encoding: "utf-8",
        timeout: 5000,
      }).trim();

      const status = execSync("git status --porcelain", {
        cwd: dirPath,
        encoding: "utf-8",
        timeout: 5000,
      });
      project.git_changes = status
        .split("\n")
        .filter((l) => l.trim()).length;

      const log = execSync('git log -1 --format="%s|%ai"', {
        cwd: dirPath,
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      const [msg, date] = log.split("|");
      project.last_commit = msg;
      project.last_commit_date = date;

      const remotes = execSync("git remote -v", {
        cwd: dirPath,
        encoding: "utf-8",
        timeout: 5000,
      });
      project.has_remote = remotes.includes("origin");
      const ghMatch = remotes.match(
        /github\.com[:/](.+?)\/(.+?)(?:\.git)?\s/
      );
      if (ghMatch) {
        project.github_url = `https://github.com/${ghMatch[1]}/${ghMatch[2]}`;
      }
    } catch {
      // git commands may fail for various reasons
    }
  }

  // Detect tech from package.json if not specified in meta
  if (!project.tech) {
    const pkgPath = path.join(dirPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const techs = [];
        if (deps["next"]) techs.push("Next.js");
        else if (deps["react"]) techs.push("React");
        if (deps["typescript"]) techs.push("TypeScript");
        if (deps["@prisma/client"]) techs.push("Prisma");
        if (deps["express"]) techs.push("Express");
        if (deps["openai"]) techs.push("OpenAI");
        if (deps["@anthropic-ai/sdk"]) techs.push("Claude API");
        if (deps["stripe"]) techs.push("Stripe");
        if (techs.length) project.tech = techs.join(", ");
      } catch {
        // ignore
      }
    }
    // Python detection
    const reqPath = path.join(dirPath, "requirements.txt");
    if (fs.existsSync(reqPath)) {
      project.tech = project.tech ? project.tech + ", Python" : "Python";
    }
  }

  return project;
}

function scanAllLocal() {
  const dirs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith(".") &&
        !d.name.startsWith("_") &&
        d.name !== "node_modules"
    );

  return dirs.map((d) =>
    scanLocalProject(path.join(PROJECTS_DIR, d.name), d.name)
  );
}

// ============================================================
// GitHub API mode
// ============================================================

async function aggregateFromGitHub() {
  console.log(`[aggregate] Fetching repos for ${GITHUB_USER}...`);
  const repos = await fetchAllRepos();
  console.log(`[aggregate] Found ${repos.length} repos`);

  const projects = [];

  for (const repo of repos) {
    console.log(`[aggregate] Processing ${repo.name}...`);

    const project = {
      id: repo.name,
      source: "github",
      name: repo.name,
      category: "",
      status: repo.archived ? "archived" : "active",
      description: repo.description || "",
      tech: repo.language || "",
      url: repo.homepage || "",
      login: "",
      deploy: "",
      apis: [],
      business_context: "",
      competitors: [],
      group_company: "",
      git_branch: repo.default_branch,
      git_changes: 0,
      last_commit: null,
      last_commit_date: null,
      has_remote: true,
      github_url: repo.html_url,
      open_prs: [],
      open_issues_count: repo.open_issues_count,
      contributors: [],
      last_push_at: repo.pushed_at,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      visibility: repo.private ? "private" : "public",
    };

    // Try to read .project-meta.yaml from repo
    const metaContent = await fetchFileFromRepo(
      GITHUB_USER,
      repo.name,
      ".project-meta.yaml"
    );
    if (metaContent) {
      const meta = parseSimpleYaml(metaContent);
      // Merge meta over defaults (meta wins for non-empty values)
      if (meta.name) project.name = meta.name;
      if (meta.category) project.category = meta.category;
      if (meta.status) project.status = meta.status;
      if (meta.description) project.description = meta.description;
      if (meta.tech) project.tech = meta.tech;
      if (meta.url) project.url = meta.url;
      if (meta.login) project.login = meta.login;
      if (meta.deploy) project.deploy = meta.deploy;
      if (meta.apis && meta.apis.length) project.apis = meta.apis;
      if (meta.business_context)
        project.business_context = meta.business_context;
      if (meta.competitors && meta.competitors.length)
        project.competitors = meta.competitors;
      if (meta.group_company) project.group_company = meta.group_company;
    }

    // Fetch open PRs
    project.open_prs = await fetchRepoPRs(GITHUB_USER, repo.name);

    projects.push(project);
  }

  return projects;
}

// ============================================================
// Merge: GitHub + Local
// ============================================================

async function aggregateAll() {
  let projects = [];

  if (LOCAL_MODE) {
    console.log("[aggregate] Running in LOCAL mode");
    projects = scanAllLocal();
  } else {
    // GitHub mode: fetch from API, then merge with local-only projects
    projects = await aggregateFromGitHub();

    // Also scan local to pick up projects without GitHub remotes
    if (fs.existsSync(PROJECTS_DIR)) {
      const localProjects = scanAllLocal();
      const githubIds = new Set(projects.map((p) => p.id));

      for (const local of localProjects) {
        if (!githubIds.has(local.id)) {
          // Also check by github_url match
          const matchByUrl = local.github_url
            ? projects.some(
                (p) => p.github_url === local.github_url
              )
            : false;
          if (!matchByUrl) {
            local.source = "local-only";
            projects.push(local);
          }
        } else {
          // Merge local meta into GitHub project
          const ghProject = projects.find((p) => p.id === local.id);
          if (ghProject && local.description && !ghProject.description) {
            ghProject.description = local.description;
          }
          if (ghProject && local.category && !ghProject.category) {
            ghProject.category = local.category;
          }
          // Always prefer local meta for business fields
          if (local.business_context) {
            ghProject.business_context = local.business_context;
          }
          if (local.login) ghProject.login = local.login;
          if (local.url && !ghProject.url) ghProject.url = local.url;
          if (local.deploy && !ghProject.deploy) ghProject.deploy = local.deploy;
          if (local.apis && local.apis.length && !ghProject.apis.length) {
            ghProject.apis = local.apis;
          }
          if (local.git_changes) ghProject.git_changes = local.git_changes;
        }
      }
    }
  }

  // Sort: active first, then by last activity
  projects.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    const dateA = a.last_push_at || a.last_commit_date || "";
    const dateB = b.last_push_at || b.last_commit_date || "";
    return dateB.localeCompare(dateA);
  });

  return {
    generated_at: new Date().toISOString(),
    generator: "project-hub/aggregate.js",
    mode: LOCAL_MODE ? "local" : "github+local",
    project_count: projects.length,
    projects,
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  try {
    const result = await aggregateAll();

    // Ensure output directory exists
    const outDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
    console.log(
      `[aggregate] Done. ${result.project_count} projects → ${OUTPUT_PATH}`
    );
  } catch (err) {
    console.error("[aggregate] Error:", err.message);
    process.exit(1);
  }
}

main();
