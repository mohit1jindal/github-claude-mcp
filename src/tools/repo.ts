import { z } from "zod";
import { getOctokit } from "../github.js";

export const repoTools = [
  {
    name: "list_repos",
    description:
      "List GitHub repositories for the authenticated user or a specific organization. Returns repo names, descriptions, languages, star counts, and open issue counts.",
    inputSchema: {
      type: "object",
      properties: {
        org: {
          type: "string",
          description: "Organization name (optional — defaults to authenticated user's repos)",
        },
        type: {
          type: "string",
          enum: ["all", "public", "private", "forks", "sources"],
          description: "Filter by repo type (default: all)",
        },
        limit: {
          type: "number",
          description: "Max repos to return (default: 20, max: 100)",
        },
      },
    },
    async handler(args: unknown) {
      const { org, type = "all", limit = 20 } = z
        .object({ org: z.string().optional(), type: z.string().optional(), limit: z.number().optional() })
        .parse(args);

      const octokit = getOctokit();
      const perPage = Math.min(limit ?? 20, 100);

      const repos = org
        ? await octokit.repos.listForOrg({ org, type: type as "all" | "public" | "private" | "forks" | "sources", per_page: perPage })
        : await octokit.repos.listForAuthenticatedUser({ type: type as "all" | "public" | "private" | "owner" | "member", per_page: perPage });

      return repos.data.map((r) => ({
        name: r.full_name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        open_issues: r.open_issues_count,
        private: r.private,
        url: r.html_url,
        updated_at: r.updated_at,
      }));
    },
  },

  {
    name: "get_repo",
    description:
      "Get detailed information about a specific GitHub repository including languages breakdown, recent activity, topics, and contributor count.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner (user or org)" },
        repo: { type: "string", description: "Repository name" },
      },
      required: ["owner", "repo"],
    },
    async handler(args: unknown) {
      const { owner, repo } = z.object({ owner: z.string(), repo: z.string() }).parse(args);
      const octokit = getOctokit();

      const [repoData, languages, contributors] = await Promise.all([
        octokit.repos.get({ owner, repo }),
        octokit.repos.listLanguages({ owner, repo }),
        octokit.repos.listContributors({ owner, repo, per_page: 5 }).catch(() => ({ data: [] })),
      ]);

      const r = repoData.data;
      return {
        full_name: r.full_name,
        description: r.description,
        url: r.html_url,
        default_branch: r.default_branch,
        language: r.language,
        languages: languages.data,
        stars: r.stargazers_count,
        forks: r.forks_count,
        open_issues: r.open_issues_count,
        topics: r.topics,
        license: r.license?.name,
        created_at: r.created_at,
        updated_at: r.updated_at,
        top_contributors: (contributors.data as Array<{ login?: string; contributions: number }>).map((c) => ({
          login: c.login,
          contributions: c.contributions,
        })),
      };
    },
  },

  {
    name: "get_file_contents",
    description: "Get the contents of a file from a GitHub repository.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path within the repository" },
        ref: { type: "string", description: "Branch, tag, or commit SHA (default: main branch)" },
      },
      required: ["owner", "repo", "path"],
    },
    async handler(args: unknown) {
      const { owner, repo, path, ref } = z
        .object({ owner: z.string(), repo: z.string(), path: z.string(), ref: z.string().optional() })
        .parse(args);

      const octokit = getOctokit();
      const response = await octokit.repos.getContent({ owner, repo, path, ref });
      const data = response.data;

      if ("content" in data && data.type === "file") {
        return {
          path: data.path,
          size: data.size,
          encoding: data.encoding,
          content: Buffer.from(data.content, "base64").toString("utf-8"),
          sha: data.sha,
          url: data.html_url,
        };
      }

      if (Array.isArray(data)) {
        return data.map((item) => ({ name: item.name, path: item.path, type: item.type, size: item.size }));
      }

      return data;
    },
  },
];
