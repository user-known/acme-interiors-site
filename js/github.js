/* Acme Interiors — minimal GitHub API client for admin.html.
   Every save becomes ONE commit (Git Data API), so GitHub Pages rebuilds once per save. */
window.GitHub = (() => {
  const API = 'https://api.github.com';
  let cfg = { owner: '', repo: '', branch: 'main', token: '' };

  async function req(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch {}
      const hint = res.status === 401 ? ' — the token is invalid or expired.'
        : res.status === 403 ? ' — the token is missing "Contents: Read and write" permission, or the rate limit was hit.'
        : res.status === 404 ? ' — repository, branch or file not found (or the token cannot see this repo).' : '';
      const err = new Error(`GitHub ${res.status}: ${msg}${hint}`); err.status = res.status; throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  const R = () => `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
  const b64ToText = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

  return {
    configure(c) { cfg = { ...cfg, ...c }; },
    get ready() { return !!(cfg.owner && cfg.repo && cfg.branch && cfg.token); },

    /** Checks the repo, branch and write permission. */
    async test() {
      const repo = await req(R());
      await req(`${R()}/branches/${encodeURIComponent(cfg.branch)}`);
      return { name: repo.full_name, canWrite: !!(repo.permissions && (repo.permissions.push || repo.permissions.admin)), pages: repo.has_pages };
    },

    /** Reads a JSON file from the branch (always fresh, unlike the cached GitHub Pages copy). */
    async readJSON(path) {
      const f = await req(`${R()}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`);
      if (f.content) return JSON.parse(b64ToText(f.content));
      const blob = await req(`${R()}/git/blobs/${f.sha}`); // files over 1 MB
      return JSON.parse(b64ToText(blob.content));
    },

    /**
     * Writes several files in one commit.
     * files: [{ path, text }] | [{ path, base64 }] | [{ path, delete: true }]
     */
    async commit(message, files) {
      const attempt = async (list) => {
        const ref = await req(`${R()}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
        const head = await req(`${R()}/git/commits/${ref.object.sha}`);
        const tree = [];
        for (const f of list) {
          if (f.delete) { tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); continue; }
          const blob = await req(`${R()}/git/blobs`, { method: 'POST', body: JSON.stringify(
            f.base64 != null ? { content: f.base64, encoding: 'base64' } : { content: f.text, encoding: 'utf-8' }) });
          tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
        }
        const t = await req(`${R()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
        const c = await req(`${R()}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: t.sha, parents: [ref.object.sha] }) });
        await req(`${R()}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
        return c;
      };
      try { return await attempt(files); }
      catch (e) {
        // A file we tried to delete may already be gone; retry without the deletions.
        if (e.status === 422 && files.some(f => f.delete)) return attempt(files.filter(f => !f.delete));
        // Someone else pushed between our read and write: try once more on top of the new head.
        if (e.status === 409 || e.status === 422) return attempt(files);
        throw e;
      }
    },
  };
})();
