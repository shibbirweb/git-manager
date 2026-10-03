// Browser links for a repository's remotes (Git > Open Repository in Browser), for any
// host: GitHub, GitLab, Bitbucket, Azure DevOps or a self-hosted server. No API, no login.

import type { RemoteInfo } from "$lib/types";
import type { PickItem } from "$lib/ui/pickList";

/** Schemes whose URLs point at a server; local paths and file:// have no web page. */
const NETWORK_SCHEMES = ["https", "http", "ssh", "git", "git+ssh", "ssh+git"];

/** Azure DevOps SSH remotes use their own host and a "v3/ORG/PROJECT/REPO" path. */
const AZURE_SSH_HOSTS = ["ssh.dev.azure.com", "vs-ssh.visualstudio.com"];

/**
 * The web page of a remote URL, in the forms git accepts: https://host/path(.git),
 * credentials and all, ssh://user@host:port/path, git://host/path and the scp-like
 * user@host:path. SSH and git ports are dropped (the web server is on 443). Null for
 * a local path, file:// or anything unreadable.
 */
export function remoteWebUrl(remoteUrl: string | null | undefined): string | null {
  const text = (remoteUrl ?? "").trim();
  if (!text) {
    return null;
  }
  let protocol: string;
  let host: string;
  let port: string | null = null;
  let path: string;
  const scheme = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^/:]+)(?::(\d+))?(?:\/(.*))?$/i.exec(text);
  if (scheme) {
    protocol = scheme[1].toLowerCase();
    if (!NETWORK_SCHEMES.includes(protocol)) {
      return null;
    }
    host = scheme[2];
    port = scheme[3] ?? null;
    path = scheme[4] ?? "";
  } else {
    // scp-like syntax: [user@]host:path, with no slash before the colon. A Windows drive
    // ("C:\repo", "C:/repo") has a one-letter host, which is never a server.
    const scp = /^(?:[^@/]+@)?([^/:\\]+):(?!\/\/)(.*)$/.exec(text);
    if (!scp || scp[1].length < 2) {
      return null;
    }
    protocol = "ssh";
    host = scp[1];
    path = scp[2];
  }
  const parts = path
    .replace(/[?#].*$/, "")
    .split("/")
    .filter((part) => part !== "");
  const last = parts.length - 1;
  if (last >= 0) {
    parts[last] = parts[last].replace(/\.git$/i, "");
    if (parts[last] === "") {
      parts.pop();
    }
  }
  if (parts.length === 0) {
    return null;
  }
  const lowerHost = host.toLowerCase();
  if (AZURE_SSH_HOSTS.includes(lowerHost) && parts[0] === "v3" && parts.length === 4) {
    const [, organization, project, repo] = parts;
    return `https://dev.azure.com/${organization}/${project}/_git/${repo}`;
  }
  // A plain http remote has a plain http site; every other kind is served over https.
  const web = protocol === "http" ? "http" : "https";
  const webPort = port && (protocol === "http" || protocol === "https") ? `:${port}` : "";
  return `${web}://${lowerHost}${webPort}/${parts.join("/")}`;
}

export interface RemoteLink {
  remoteName: string;
  url: string;
}

/**
 * One link per distinct page: each remote's fetch URL, plus its push URL when that is a
 * different page. The upstream's remote comes first, then origin, then the rest as listed.
 */
export function remoteLinks(remotes: RemoteInfo[], preferredRemote: string | null = null): RemoteLink[] {
  const rank = (remote: RemoteInfo) => (remote.name === preferredRemote ? 0 : remote.name === "origin" ? 1 : 2);
  const ordered = remotes
    .map((remote, index) => ({ remote, index }))
    .sort((left, right) => rank(left.remote) - rank(right.remote) || left.index - right.index)
    .map(({ remote }) => remote);
  const links: RemoteLink[] = [];
  const seen = new Set<string>();
  for (const remote of ordered) {
    for (const remoteUrl of [remote.fetchUrl, remote.pushUrl]) {
      const url = remoteWebUrl(remoteUrl);
      if (url && !seen.has(url)) {
        seen.add(url);
        links.push({ remoteName: remote.name, url });
      }
    }
  }
  return links;
}

/** Rows of the picker shown when there is more than one link; the value is the URL. */
export function remoteLinkPickItems(links: RemoteLink[]): PickItem[] {
  return links.map((link) => ({ value: link.url, label: link.remoteName, description: link.url }));
}
