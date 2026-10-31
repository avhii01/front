import type { Citation } from '../types';

function retrievalLabel(citation: Citation): string {
  if (citation.retrieval === 'vector_chroma') return 'Vector RAG · Chroma';
  if (citation.retrieval === 'vector_database') return 'Vector RAG · database';
  if (citation.retrieval === 'lexical_fallback') return 'Lexical fallback';
  return citation.retrieval;
}

/** Readable policy citations. Title/version/section/chunk ID are retained end-to-end. */
export function PolicyCitations({ citations, label = 'Policy sources' }: { citations: Citation[]; label?: string }) {
  if (!citations.length) return null;
  return (
    <section className="citations" aria-label={label}>
      <h3 className="citations__title">{label}</h3>
      <ul className="citations__list">
        {citations.map((citation) => (
          <li key={citation.chunk_id} className="citation">
            <div className="citation__head">
              <strong>{citation.title}</strong>
              <span className="citation__meta">
                v{citation.version} · §{citation.section}
              </span>
            </div>
            <p className="citation__excerpt">{citation.excerpt}</p>
            <div className="citation__foot">
              <code>{citation.chunk_id}</code>
              <span className="tag tag--sim">{retrievalLabel(citation)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
