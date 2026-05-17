# github-claude-mcp

A two-way bridge between **Claude AI** and **GitHub** — built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

**Claude → GitHub:** An MCP server that gives Claude full GitHub awareness — read repos, inspect PRs, review code, manage issues, and explore commit history, all from a Claude conversation.

**GitHub → Claude:** A GitHub Action that automatically fires Claude on pull requests and issues — AI-powered code reviews posted as PR comments, and intelligent issue triage with label suggestions.

---

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard by Anthropic that lets AI assistants connect to external tools and data sources. Think of it as a universal plugin system for AI — instead of copy-pasting code into a chat window, Claude connects directly to your GitHub and acts on it.

---

## Features

### MCP Server (Claude → GitHub)

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

### GitHub Action (GitHub → Claude)

- **Auto PR Review** — triggers on `pull_request` (opened/updated), sends the diff to Claude, posts a structured review comment (Summary, Strengths, Suggestions, Verdict)
- **Issue Triage** — triggers on `issues` (opened), Claude analyzes the issue, posts a welcome comment, and applies relevant labels automatically

---

## Quick Start

### 1. MCP Server Setup

**Install:**
```bash
npm install -g github-claude-mcp
```

**Add to Claude Code** (`~/.claude/settings.json` or project `.claude/settings.json`):
```json
{
  "mcpServers": {
    "github": {
      "command": "github-claude-mcp",
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

**Or run directly:**
```bash
GITHUB_TOKEN=ghp_... npx github-claude-mcp
```

**Get a GitHub token:** [github.com/settings/tokens](https://github.com/settings/tokens) — scopes needed: `repo`, `read:org`

Once connected, ask Claude anything:
- *"List my GitHub repos"*
- *"Review the open PRs in mohit1jindal/my-project"*
- *"What changed in the last 10 commits on the main branch?"*
- *"Create an issue in my-repo titled 'Fix null pointer in invoice validator'"*

---

### 2. GitHub Action Setup

Add the workflow to any repository you want AI reviews on:

```yaml
# .github/workflows/claude-review.yml
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
    if: ${{ github.event_name == 'issues' || !github.event.pull_request.draft }}
    steps:
      - name: Claude AI Review & Triage
        uses: mohit1jindal/github-claude-mcp@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Add your Anthropic API key as a secret: **Settings → Secrets → Actions → New repository secret** → name it `ANTHROPIC_API_KEY`.

---

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes (MCP server) | GitHub Personal Access Token |
| `ANTHROPIC_API_KEY` | Yes (GitHub Action) | Anthropic API key |

### Action Inputs

| Input | Default | Description |
|---|---|---|
| `model` | `claude-sonnet-4-6` | Claude model to use |
| `max_tokens` | `2048` | Max tokens for Claude response |
| `github_token` | `${{ github.token }}` | GitHub token |
| `anthropic_api_key` | — | Anthropic API key (required) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Claude (AI)                       │
│                                                     │
│  "Review PR #42 in my-repo and post your thoughts" │
└──────────────────────┬──────────────────────────────┘
                       │ MCP Protocol (stdio)
                       ▼
┌─────────────────────────────────────────────────────┐
│             github-claude-mcp (MCP Server)          │
│                                                     │
│  Tools: list_repos, get_pull_request,               │
│         post_pr_review, create_issue, ...           │
└──────────────────────┬──────────────────────────────┘
                       │ GitHub REST API (Octokit)
                       ▼
┌─────────────────────────────────────────────────────┐
│                    GitHub                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              GitHub (Event Source)                  │
│                                                     │
│  PR opened → workflow trigger                       │
│  Issue opened → workflow trigger                    │
└──────────────────────┬──────────────────────────────┘
                       │ GitHub Actions
                       ▼
┌─────────────────────────────────────────────────────┐
│         github-claude-mcp (GitHub Action)           │
│                                                     │
│  Sends PR diff / issue body to Claude API           │
│  Posts AI review / triage back to GitHub            │
└─────────────────────────────────────────────────────┘
```

---

## Development

```bash
git clone https://github.com/mohit1jindal/github-claude-mcp
cd github-claude-mcp
npm install
npm run build

# Run the MCP server locally
GITHUB_TOKEN=ghp_... npm start
```

---

## Contributing

Contributions welcome. Open an issue or PR — the auto-review action will give Claude's take on your changes.

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built by [Mohit Jindal](https://www.linkedin.com/in/mohit1jindal) · [Model Context Protocol](https://modelcontextprotocol.io) · [Anthropic](https://anthropic.com)*
