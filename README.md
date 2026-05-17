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

This runs entirely on GitHub's infrastructure — no server, no local process. Once the workflow file is in your repo, every PR and issue gets AI attention automatically.

#### How it works

**PR Review flow:**
```
Developer opens / updates PR
        ↓
GitHub Action triggers automatically
        ↓
Action fetches full PR diff + metadata
        ↓
Diff is sent to Claude API with a review prompt
        ↓
Claude responds with structured review:
  • Summary of what the PR does
  • Strengths (what's done well)
  • Suggestions (specific, actionable feedback with file references)
  • Questions (anything unclear for the author)
  • Verdict: APPROVE / REQUEST CHANGES / COMMENT
        ↓
Review posted as a PR comment within ~30 seconds
```

**Issue Triage flow:**
```
Developer opens a new Issue
        ↓
GitHub Action triggers automatically
        ↓
Action fetches issue title + body + available repo labels
        ↓
Sent to Claude for triage
        ↓
Claude responds with:
  • A friendly triage comment
  • Suggested labels from the repo's existing label list
  • Priority (high / medium / low) and type (bug / feature / question / docs)
        ↓
Comment posted + matching labels applied automatically
```

#### Step 1 — Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in or create an account
3. Click **API Keys** in the left sidebar → **Create Key**
4. Name it (e.g. `github-claude-mcp`)
5. Copy the key — it starts with `sk-ant-...` — you won't see it again

> **Cost estimate:**
> | Event | Approx tokens | Approx cost |
> |---|---|---|
> | Small PR review (< 50 files) | ~1,000–2,000 | ~$0.005 |
> | Large PR review (many files) | ~3,000–4,000 | ~$0.015 |
> | Issue triage | ~500–1,000 | ~$0.002 |
>
> For a personal repo with low traffic: **typically under $1/month.**

#### Step 2 — Add the API key as a GitHub Secret

Do this in **each repository** where you want AI reviews enabled:

1. Go to the repository on GitHub
2. Click **Settings** (top navigation bar of the repo)
3. In the left sidebar: **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. **Name:** `ANTHROPIC_API_KEY` ← must be exactly this
6. **Secret:** paste your `sk-ant-...` key
7. Click **Add secret**

> The `GITHUB_TOKEN` secret is automatically injected by GitHub into every workflow run — you do **not** need to create it manually.

#### Step 3 — Add the workflow file

In the repository where you want reviews, create the file `.github/workflows/claude-review.yml`:

```yaml
name: Claude AI Review

on:
  pull_request:
    types: [opened, synchronize]   # Triggers on new PRs and new commits pushed to a PR
  issues:
    types: [opened]                # Triggers when a new issue is opened

permissions:
  pull-requests: write             # Needed to post PR review comments
  issues: write                    # Needed to post issue comments and apply labels
  contents: read                   # Needed to read repo contents

jobs:
  claude-review:
    runs-on: ubuntu-latest
    # Skip draft PRs — remove this line if you want drafts reviewed too
    if: ${{ github.event_name == 'issues' || !github.event.pull_request.draft }}
    steps:
      - name: Claude AI Review & Triage
        uses: mohit1jindal/github-claude-mcp@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          model: "claude-sonnet-4-6"   # Optional — change to claude-opus-4-7 for deeper reviews
          max_tokens: "2048"           # Optional — increase for longer reviews
```

Commit and push this file to your repo's **default branch** (main or master). GitHub will automatically detect it.

#### Step 4 — Test it

Open a new Pull Request (or reopen an existing one) in your repo. Within ~30 seconds:

- The **Actions** tab will show a `Claude AI Review` workflow running
- A review comment will appear on the PR from `github-actions[bot]`

To test issue triage: open a new issue in the repo. Claude will reply within ~20 seconds with a triage comment and apply labels if any match.

#### What the PR review comment looks like

```markdown
## Summary
This PR adds input validation to the invoice processing pipeline,
ensuring line items with zero hours are rejected before submission.

## Strengths
- Clean separation between validation and processing logic
- Error messages are specific and actionable for the end user
- Existing tests updated to cover the new validation path

## Suggestions
- `InvoiceValidator.java:45` — consider extracting the hour threshold
  (currently hardcoded as `0.1`) into a named constant for clarity
- The `validateLineItems()` method is now 80+ lines — worth splitting
  into `validateHours()` and `validateAmounts()` for readability
- Add a test for the edge case where `lineItem.getHours() == null`

## Questions
- Should zero-hour line items with expense type be allowed through?
  The current logic rejects all zero-hour items regardless of type.

## Verdict
💬 **COMMENT** — logic is sound, suggestions are minor improvements

---
*🤖 Review generated by [github-claude-mcp](https://github.com/mohit1jindal/github-claude-mcp) using claude-sonnet-4-6*
```

#### Customization options

**Review only PRs (skip issue triage):**
```yaml
on:
  pull_request:
    types: [opened, synchronize]
# Remove the issues: block entirely
```

**Review only issues (skip PR review):**
```yaml
on:
  issues:
    types: [opened]
# Remove the pull_request: block entirely
```

**Use a more powerful model for deeper reviews:**
```yaml
with:
  anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
  github_token: ${{ secrets.GITHUB_TOKEN }}
  model: "claude-opus-4-7"
  max_tokens: "4096"
```

**Review draft PRs too** (by default drafts are skipped):
```yaml
jobs:
  claude-review:
    runs-on: ubuntu-latest
    # Remove the 'if:' line entirely — all PRs including drafts will be reviewed
    steps:
      ...
```

**Add to multiple repos:** Repeat Steps 2–3 for each repo. The `ANTHROPIC_API_KEY` secret must be added to each repo individually (or set as an [organization secret](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-an-organization) to share across all repos in an org).

#### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Action doesn't trigger at all | Workflow file not on default branch | Push `claude-review.yml` to `main` or `master` |
| `Resource not accessible by integration` | Missing `permissions` block | Add the `permissions:` section exactly as shown |
| `Error: Bad credentials` | Wrong secret name | Check Settings → Secrets — must be `ANTHROPIC_API_KEY` |
| Action runs but no comment appears | Token lacks permission | Ensure `pull-requests: write` and `issues: write` in `permissions:` |
| Draft PRs not reviewed | By design | Remove the `if:` condition from the job |
| Review is too short | `max_tokens` too low | Set `max_tokens: "4096"` in the `with:` block |
| Action fails on large PRs | Diff exceeds limit | Diffs are auto-truncated at 50KB — no fix needed, large files show a truncation notice |

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
