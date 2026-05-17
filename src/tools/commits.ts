import { z } from "zod";
import { getOctokit } from "../github.js";

export const commitTools = [
  {
    name: "list_commits",
    description:
      "List recent commits for a repository or a specific file path. Returns commit messages, authors, dates, and SHAs.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        branch: { type: "string", description: "Branch name (defaults to repo default branch)" },
        path: { type: "string", description: "Only commits that touch this file/directory path" },
        since: { type: "string", description: "ISO 8601 date — only commits after this date" },
        limit: { type: "number", description: "Max commits to return (default: 20)" },
      },
      required: ["owner", "repo"],
    },
    async handler(args: unknown) {
      const { owner, repo, branch, path, since, limit = 20 } = z
        .object({
          owner: z.string(),
          repo: z.string(),
          branch: z.string().optional(),
          path: z.string().optional(),
          since: z.string().optional(),
          limit: z.number().optional(),
        })
        .parse(args);

      const octokit = getOctokit();
      const { data } = await octokit.repos.listCommits({
        owner,
        repo,
        sha: branch,
        path,
        since,
        per_page: Math.min(limit ?? 20, 100),
      });

      return data.map((c) => ({
        sha: c.sha.slice(0, 8),
        full_sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name,
        author_login: c.author?.login,
        date: c.commit.author?.date,
        url: c.html_url,
      }));
    },
  },

  {
    name: "get_commit",
    description: "Get detailed information about a specific commit including the files changed and their diffs.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        sha: { type: "string", description: "Commit SHA (full or abbreviated)" },
      },
      required: ["owner", "repo", "sha"],
    },
    async handler(args: unknown) {
      const { owner, repo, sha } = z
        .object({ owner: z.string(), repo: z.string(), sha: z.string() })
        .parse(args);

      const octokit = getOctokit();
      const { data } = await octokit.repos.getCommit({ owner, repo, ref: sha });

      return {
        sha: data.sha,
        message: data.commit.message,
        author: data.commit.author?.name,
        author_login: data.author?.login,
        date: data.commit.author?.date,
        url: data.html_url,
        stats: data.stats,
        files: data.files?.map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ? (f.patch.length > 2000 ? f.patch.slice(0, 2000) + "..." : f.patch) : undefined,
        })),
      };
    },
  },
];
