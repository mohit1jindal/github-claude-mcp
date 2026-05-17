import { z } from "zod";
import { getOctokit } from "../github.js";

export const issueTools = [
  {
    name: "list_issues",
    description: "List issues for a GitHub repository with labels, assignees, and status.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "Issue state (default: open)" },
        labels: { type: "string", description: "Comma-separated label names to filter by" },
        limit: { type: "number", description: "Max issues to return (default: 20)" },
      },
      required: ["owner", "repo"],
    },
    async handler(args: unknown) {
      const { owner, repo, state = "open", labels, limit = 20 } = z
        .object({
          owner: z.string(),
          repo: z.string(),
          state: z.string().optional(),
          labels: z.string().optional(),
          limit: z.number().optional(),
        })
        .parse(args);

      const octokit = getOctokit();
      const { data } = await octokit.issues.listForRepo({
        owner,
        repo,
        state: state as "open" | "closed" | "all",
        labels,
        per_page: Math.min(limit ?? 20, 100),
      });

      // Filter out pull requests (GitHub issues API returns both)
      return data
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          number: issue.number,
          title: issue.title,
          author: issue.user?.login,
          state: issue.state,
          labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
          assignees: issue.assignees?.map((a) => a.login),
          comments: issue.comments,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          url: issue.html_url,
          body_preview: issue.body ? issue.body.slice(0, 300) : undefined,
        }));
    },
  },

  {
    name: "create_issue",
    description: "Create a new GitHub issue with a title, body, labels, and assignees.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Issue body (Markdown supported)" },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels to apply to the issue",
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "GitHub usernames to assign",
        },
      },
      required: ["owner", "repo", "title"],
    },
    async handler(args: unknown) {
      const { owner, repo, title, body, labels, assignees } = z
        .object({
          owner: z.string(),
          repo: z.string(),
          title: z.string(),
          body: z.string().optional(),
          labels: z.array(z.string()).optional(),
          assignees: z.array(z.string()).optional(),
        })
        .parse(args);

      const octokit = getOctokit();
      const { data } = await octokit.issues.create({ owner, repo, title, body, labels, assignees });

      return {
        number: data.number,
        title: data.title,
        url: data.html_url,
        state: data.state,
        created_at: data.created_at,
      };
    },
  },

  {
    name: "add_issue_comment",
    description: "Add a comment to an existing GitHub issue or pull request.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        issue_number: { type: "number", description: "Issue or PR number" },
        body: { type: "string", description: "Comment body (Markdown supported)" },
      },
      required: ["owner", "repo", "issue_number", "body"],
    },
    async handler(args: unknown) {
      const { owner, repo, issue_number, body } = z
        .object({ owner: z.string(), repo: z.string(), issue_number: z.number(), body: z.string() })
        .parse(args);

      const octokit = getOctokit();
      const { data } = await octokit.issues.createComment({ owner, repo, issue_number, body });

      return { id: data.id, url: data.html_url, created_at: data.created_at };
    },
  },
];
