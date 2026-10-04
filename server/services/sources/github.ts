import { createHash } from 'node:crypto'
import type { GitHubCandidate, MaterialExtraction } from '../../../shared/studyMaterial'
import { publicUrl, readPublic, SourceError, type PublicReader } from './network'

const TEXT = /\.(?:md|mdx|txt|rst|adoc|ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|c|h|cpp|hpp|cs|rb|php|swift|kt|vue|svelte|html|css|scss|sql|graphql|json|ya?ml|toml|sh)$/i
export function studyFile(path: string) {
  if (path.length > 500 || path.startsWith('/') || /[\\\x00-\x1f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) return false
  if (/(^|\/)(?:\.git|node_modules|vendor|dist|build|coverage|\.nuxt|\.output|\.vercel|\.aws|\.ssh|\.next|__pycache__)(\/|$)/i.test(path)) return false
  if (/(^|\/)(?:\.env[^/]*|[^/]*(?:secret|credential)[^/]*|id_rsa|id_ed25519)(\/|$)|(?:\.min\.[cm]?js|\.map|\.lock|lock\.json|\.pem|\.key|\.p12|\.pfx)$/i.test(path)) return false
  return TEXT.test(path) || /(^|\/)(README|LICENSE|LICENCE|COPYING|NOTICE|Dockerfile|Makefile)$/i.test(path)
}
export function githubRepository(input: string) {
  const url = publicUrl(input, ['github.com', 'www.github.com'])
  const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
  if (parts.length !== 2) throw new SourceError(400, 'Use the repository link, such as https://github.com/owner/repository.')
  const owner = parts[0]!; const repo = parts[1]!.replace(/\.git$/, '')
  if (!/^[\w.-]{1,100}$/.test(owner) || !/^[\w.-]{1,100}$/.test(repo) || [owner, repo].some(value => value === '.' || value === '..')) throw new SourceError(400, 'This repository link is invalid.')
  return { owner, repo }
}
export class GitHubStudyReader {
  requests: number
  constructor(private reader: PublicReader = readPublic, private token = '', consumed = 0) { this.requests = consumed }
  private async get(path: string) {
    if (++this.requests > 16) throw new SourceError(422, 'This import reached its GitHub request allowance.')
    const response = await this.reader(`https://api.github.com${path}`, { hosts: ['api.github.com'], redirects: 0,
      headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) } })
    try { return JSON.parse(response.body.toString('utf8')) } catch { throw new SourceError(502, 'GitHub returned an unreadable response.') }
  }
  private base(owner: string, repo: string) {
    const valid = githubRepository(`https://github.com/${owner}/${repo}`)
    return `/repos/${encodeURIComponent(valid.owner)}/${encodeURIComponent(valid.repo)}`
  }
  async repository(owner: string, repo: string) {
    const data = await this.get(this.base(owner, repo))
    if (data.private !== false || !data.default_branch) throw new SourceError(422, 'Only public repositories with a default branch can be studied.')
    return { owner, repo, title: String(data.full_name || `${owner}/${repo}`), defaultBranch: String(data.default_branch), license: String(data.license?.spdx_id || 'No license information supplied') }
  }
  async revision(owner: string, repo: string, branch: string) {
    const data = await this.get(`${this.base(owner, repo)}/commits/${encodeURIComponent(branch)}`)
    if (!/^[a-f0-9]{40}$/.test(data.sha)) throw new SourceError(502, 'GitHub did not return a pinned commit.')
    return String(data.sha)
  }
  async files(owner: string, repo: string, commit: string) {
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new SourceError(400, 'A full commit SHA is required.')
    const data = await this.get(`${this.base(owner, repo)}/git/trees/${commit}?recursive=1`)
    if (!Array.isArray(data.tree)) throw new SourceError(502, 'GitHub did not return a file tree.')
    const eligible = data.tree.filter((item: any) => item.type === 'blob' && ['100644', '100755'].includes(item.mode) && studyFile(item.path) && Number.isInteger(item.size) && item.size > 0 && item.size <= 65_536 && /^[a-f0-9]{40}$/.test(item.sha))
    const candidates: GitHubCandidate[] = eligible.slice(0, 2000).map((item: any) => ({ path: item.path, size: item.size, sha: item.sha }))
    return { candidates, omissions: [
      'Binary, oversized, generated, dependency, credential, symlink, and submodule entries are excluded.',
      ...(data.truncated || eligible.length > 2000 ? ['Discovery is incomplete; only the available first 2,000 eligible candidates are shown.'] : []),
    ] }
  }
  async file(owner: string, repo: string, commit: string, candidate: GitHubCandidate) {
    if (!studyFile(candidate.path) || !/^[a-f0-9]{40}$/.test(commit) || !/^[a-f0-9]{40}$/.test(candidate.sha) || candidate.size > 65_536) throw new SourceError(400, 'Choose an eligible file from the inspected repository.')
    const data = await this.get(`${this.base(owner, repo)}/git/blobs/${candidate.sha}`)
    if (data.encoding !== 'base64' || typeof data.content !== 'string' || data.content.length > 100_000) throw new SourceError(422, 'This repository file cannot be read as bounded text.')
    const bytes = Buffer.from(data.content, 'base64')
    if (bytes.length > 65_536 || bytes.includes(0)) throw new SourceError(422, 'A selected file is binary or too large.')
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new SourceError(422, 'A selected file is not UTF-8 text.') }
    return { text, hash: createHash('sha256').update(bytes).digest('hex'), url: `https://github.com/${owner}/${repo}/blob/${commit}/${candidate.path.split('/').map(encodeURIComponent).join('/')}` }
  }
  async snapshot(owner: string, repo: string, commit: string, selected: GitHubCandidate[], license?: string): Promise<MaterialExtraction> {
    if (!selected.length || selected.length > 12 || new Set(selected.map(item => item.path)).size !== selected.length) throw new SourceError(400, 'Choose between one and twelve different files.')
    const sections: MaterialExtraction['sections'] = []; let total = 0
    for (const candidate of selected) {
      const file = await this.file(owner, repo, commit, candidate)
      total += file.text.length
      if (total > 100_000) throw new SourceError(413, 'The selected files exceed 100,000 characters. Select fewer files.')
      const lines = file.text.split('\n')
      for (let offset = 0; offset < lines.length; offset += 40) {
        const end = Math.min(offset + 40, lines.length)
        const text = lines.slice(offset, end).join('\n').trim()
        if (text) sections.push({ id: `file-${sections.length + 1}`, label: `${candidate.path} · lines ${offset + 1}–${end}`, text,
          location: { path: candidate.path, startLine: offset + 1, endLine: end, url: `${file.url}#L${offset + 1}-L${end}` } })
      }
    }
    if (!sections.length) throw new SourceError(422, 'The selected files contain no readable text.')
    return { kind: 'GITHUB', sections, excerpt: sections[0]!.text.slice(0, 320), provenance: { url: `https://github.com/${owner}/${repo}`, provider: 'GitHub REST', retrievedAt: new Date().toISOString(), commit, license,
      hash: createHash('sha256').update(JSON.stringify(sections)).digest('hex'), omissions: ['Only the selected files at this commit were read. Repository code was not executed.'] } }
  }
}
