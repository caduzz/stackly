import type { GitCommit } from '../types'

export function CommitPage({ commit }: { commit: GitCommit }): React.JSX.Element {
  return <article className="commit-page" aria-label="Commit details">
    <section className="commit-page-hero">
      <span>{commit.shortHash}</span>
      <h1>{commit.message}</h1>
      <p>{commit.authorName} · {formatCommitDate(commit.authoredAt)}</p>
    </section>
    <section className="commit-page-details" aria-label="Commit metadata">
      <dl>
        <div><dt>Full hash</dt><dd>{commit.hash}</dd></div>
        <div><dt>Author</dt><dd>{commit.authorName}</dd></div>
        <div><dt>Email</dt><dd>{commit.authorEmail ?? 'Not available'}</dd></div>
        <div><dt>Date</dt><dd>{formatCommitDate(commit.authoredAt)}</dd></div>
        <div><dt>Message</dt><dd>{commit.message}</dd></div>
      </dl>
    </section>
  </article>
}

function formatCommitDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
