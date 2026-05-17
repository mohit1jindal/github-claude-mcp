import { z } from "zod";
import { getOctokit } from "../github.js";

export const prTools = [
  {
    name: "list_pull_requests",
    description: "List pull requests for a repository with their status, labels, and review state.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "PR state (default: open)" },
        limit: { type: "number", description: "Max PRs to return (default: 10)" },
      },
      required: ["owner", "repo"],
    },
    async handler(args: unknown) {
      const { owner, repo, state = "open", limit = 10 } = z
        .object({ owner: z.string(), repo: z.string(), state: z.string().optional(), limit: z.number().optional() })
        .parse(args);

      const octokit = getOctokit();
      const { data } = await octokit.pulls.list({
        owner,
        repo,
        state: state as "open" | "closed" | "all",
        per_page: Math.min(limit ?? 10, 100),
      });

      return data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user?.login,
        state: pr.state,
        draft: pr.draft,
        base: pr.base.ref,
        head: pr.head.ref,
        labels: pr.labels.map((l) => l.name),
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        url: pr.html_url,
      }));
    },
  },

  {
    name: "get_pull_request",
    description:
      "Get full details of a pull request including the diff, changed files, and review status. Use this before posting a review.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pull_number: { type: "number", description: "Pull request number" },
        include_diff: {
          type: "boolean",
          description: "Include the full unified diff (default: true). Set false for large PRs.",
        },
      },
      required: ["owner", "repo", "pull_number"],
    },
    async handler(args: unknown) {
      const { owner, repo, pull_number, include_diff = true } = z
        .object({
          owner: z.string(),
          repo: z.string(),
          pull_number: z.number(),
          include_diff: z.boolean().optional(),
        })
        .parse(args);

      const octokit = getOctokit();

      const [prData, files] = await Promise.all([
        octokit.pulls.get({ owner, repo, pull_number }),
        octokit.pulls.listFiles({ owner, repo, pull_number, per_page: 100 }),
      ]);

      const pr = prData.data;

      let diff: string | undefined;
      if (include_diff) {
        const diffResponse = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number,
          headers: { accept: "application/vnd.github.diff" },
        });
        diff = diffResponse.data as unknown as string;
        // Truncate diffs > 50KB to avoid overwhelming context
        if (diff && diff.length > 50000) {
          diff = diff.slice(0, 50000) + "\n\n[...diff truncated — showing first 50KB...]";
        }
      }

      return {
        number: pr.number,
        title: pr.title,
        description: pr.body,
        author: pr.user?.login,
        state: pr.state,
        draft: pr.draft,
        base: pr.base.ref,
        head: pr.head.ref,
        labels: pr.labels.map((l) => l.name),
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        mergeable: pr.mergeable,
        url: pr.html_url,
        created_at: pr.created_at,
        files: files.data.map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ? (f.patch.length > 3000 ? f.patch.slice(0, 3000) + "..." : f.patch) : undefined,
        })),
        diff,
      };
    },
  },

  {
    name: "post_pr_review",
    description:
      "Post a review comment on a pull request. Use this after reviewing the PR diff with get_pull_request. Can approve, request changes, or leave a comment.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pull_number: { type: "number", description: "Pull request number" },
        body: { type: "string", description: "The review comment body (supports Markdown)" },
        event: {
          type: "string",
          enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
          description: "Review action: APPROVE, REQUEST_CHANGES, or COMMENT (default: COMMENT)",
        },
      },
      required: ["owner", "repo", "pull_number", "body"],
    },
    async handler(args: unknown) {
      const { owner, repo, pull_number, body, event = "COMMENT" } = z
        .object({
          owner: z.string(),
          repo: z.string(),
          pull_number: z.number(),
          body: z.string(),
          event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).optional(),
        })
        .parse(args);

      const octokit = getOctokit();
      const { data } = await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        body,
        event: event as "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
      });

      return {
        id: data.id,
        state: data.state,
        submitted_at: data.submitted_at,
        url: data.html_url,
      };
    },
  },
];
