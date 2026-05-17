# github-claude-mcp

A two-way bridge between **Claude AI** and **GitHub** — built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

**Claude → GitHub:** An MCP server that gives Claude live GitHub access — read repos, inspect PRs, post reviews, manage issues, and browse commit history, all from inside a Claude conversation.

**GitHub → Claude:** A GitHub Action that automatically fires Claude on pull requests and issues — AI-powered code reviews posted as PR comments, and intelligent issue triage with label suggestions.

---

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard by Anthropic that lets AI assistants connect to external tools and data sources. Instead of copy-pasting code into a chat window, Claude connects directly to GitHub and acts on it.

---

## Features

### MCP Server — Claude → GitHub

| Tool | Description |
|---|---|
| `list_repos` | List repositories for a user or organization |
| `get_repo` | Repo details: languages, topics, contributors, stats |
| `get_file_contents` | Read any file from any branch |
| `list_pull_requests` | List open/closed PRs with metadata |
| `get_pull_request` | Full PR details including unified diff |
| `post_pr_review` | Post Approve / Request Changes / Comment reviews |
| `list_issues` | List issues with label and assignee filters |
| `create_issue` | Create issues with labels and assignees |
| `add_issue_comment` | Add comments to issues or PRs |
| `list_commits` | Recent commits for a repo or file path |
| `get_commit` | Full commit details with file diffs |

### GitHub Action — GitHub → Claude

- **Auto PR Review** — triggers on every PR open/update, sends the diff to Claude, posts a structured review (Summary · Strengths · Suggestions · Verdict)
- **Issue Triage** — triggers when an issue is opened, Claude posts a welcome/triage comment and applies matching labels automatically

---

## End-to-End Setup

### Prerequisites

- [Node.js 18+](https://nodejs.org) installed on your machine
- [Claude Code CLI](https://claude.ai/code) or [Claude Desktop](https://claude.ai/download) installed
- A GitHub account and a repository

---

### Part 1 — MCP Server (Claude → GitHub)

This runs locally on your machine and connects Claude to GitHub.

#### Step 1 — Clone and build

```bash
git clone https://github.com/mohit1jindal/github-claude-mcp.git
cd github-claude-mcp
npm install
npm run build
```

#### Step 2 — Create a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**
2. Give it a name (e.g. `claude-mcp`)
3. Select these scopes:
   - `repo` — full repo access (read/write PRs, issues, code)
   - `read:org` — read org membership (needed for org repos)
4. Click **Generate token** and copy the value — you won't see it again

#### Step 3 — Configure Claude Code

Add the MCP server to your Claude Code settings. Choose **one** of:

**Option A — Global (all projects):**
Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/absolute/path/to/github-claude-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

**Option B — Per-project:**
Create `.claude/settings.json` in your project root with the same content.

> **Windows path example:** `"C:\\Users\\YourName\\Coding\\github-claude-mcp\\dist\\index.js"`

#### Step 3b — Configure Claude Desktop (alternative)

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/absolute/path/to/github-claude-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

#### Step 4 — Verify the connection

Open Claude Code and type:

```
List my GitHub repos
```

If configured correctly, Claude will call `list_repos` and return your repositories.

**Troubleshooting:**
- Run `node dist/index.js` directly in the terminal — you should see `github-claude-mcp running on stdio`
- If you see `GITHUB_TOKEN environment variable is required`, the env var isn't reaching the process — double-check the path and that the `env` key is spelled correctly in settings.json
- On Windows, use double backslashes (`\\`) or forward slashes (`/`) in the path

---

### Part 2 — GitHub Action (GitHub → Claude)

This runs on GitHub's infrastructure and needs no local setup after configuration.

#### Step 1 — Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in (or create an account)
3. Click **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

> **Cost:** Each PR review uses ~1,000–4,000 tokens depending on diff size. At Sonnet pricing (~$3/million input tokens) a typical review costs under $0.02. Issue triage is cheaper. For a personal repo this is negligible.

#### Step 2 — Add the API key as a GitHub Secret

In the repository where you want AI reviews:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: paste your Anthropic API key
5. Click **Add secret**

#### Step 3 — Add the workflow file

Create `.github/workflows/claude-review.yml` in your repository:

```yaml
name: Claude AI Review

on:
  pull_request:
    types: [opened, synchronize]
  issues:
    types: [opened]

permissions:
  pull-requests: write
  issues: write
  contents: read

jobs:
  claude-review:
    runs-on: ubuntu-latest
    # Skip draft PRs
    if: ${{ github.event_name == 'issues' || !github.event.pull_request.draft }}
    steps:
      - name: Claude AI Review & Triage
        uses: mohit1jindal/github-claude-mcp@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Commit and push this file. The action will run on the next PR or issue.

#### Step 4 — Verify

Open a new PR or issue in your repo. Within ~30 seconds you should see a Claude comment appear. Check the **Actions** tab if it doesn't appear — any errors will be logged there.

**Troubleshooting:**
- `Error: ANTHROPIC_API_KEY` → secret name doesn't match; check it's exactly `ANTHROPIC_API_KEY`
- `Resource not accessible by integration` → the workflow is missing the `permissions` block — add it as shown above
- Action not triggering → check the `on:` triggers match the event type (PR must not be a draft)

---

## Configuration Reference

### MCP Server environment variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token with `repo` and `read:org` scopes |

### GitHub Action inputs

| Input | Default | Description |
|---|---|---|
| `anthropic_api_key` | — | **Required.** Your Anthropic API key |
| `github_token` | `${{ github.token }}` | GitHub token — the default works for most cases |
| `model` | `claude-sonnet-4-6` | Claude model to use |
| `max_tokens` | `2048` | Max tokens in Claude's response |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 You (in Claude)                     │
│  "Review the open PRs in my repo"                  │
└──────────────────────┬──────────────────────────────┘
                       │ MCP Protocol (stdio)
                       ▼
┌─────────────────────────────────────────────────────┐
│       github-claude-mcp MCP Server (local)          │
│  Tools: list_repos, get_pull_request,               │
│         post_pr_review, create_issue, ...           │
└──────────────────────┬──────────────────────────────┘
                       │ GitHub REST API
                       ▼
              ┌────────────────┐
              │    GitHub      │
              └────────────────┘

┌─────────────────────────────────────────────────────┐
│           GitHub (event: PR opened)                 │
└──────────────────────┬──────────────────────────────┘
                       │ GitHub Actions trigger
                       ▼
┌─────────────────────────────────────────────────────┐
│    github-claude-mcp GitHub Action (GitHub infra)   │
│  Fetches PR diff → calls Claude API →               │
│  posts review comment back to PR                    │
└─────────────────────────────────────────────────────┘
```

---

## Development

```bash
git clone https://github.com/mohit1jindal/github-claude-mcp.git
cd github-claude-mcp

# Install MCP server dependencies
npm install
npm run build

# Run MCP server manually (for testing)
GITHUB_TOKEN=ghp_... node dist/index.js

# Build GitHub Action bundle (only needed when changing github-action/src/)
cd github-action && npm install
npx tsc -p ../tsconfig.action.json
npx ncc build dist/index.js -o dist/bundle
```

---

## Contributing

Contributions welcome. Open an issue or PR — the auto-review action will give Claude's take on your changes.

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built by [Mohit Jindal](https://www.linkedin.com/in/mohit1jindal) · [Model Context Protocol](https://modelcontextprotocol.io) · [Anthropic](https://anthropic.com)*
