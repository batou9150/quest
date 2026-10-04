import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders GitHub-flavoured markdown with the `.markdown` styles from index.css (headings, lists, code blocks, tables, images). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => {
            const external = typeof props.href === 'string' && /^https?:\/\//.test(props.href);
            return <a {...props} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} />;
          },
          img: ({ node: _node, ...props }) => <img loading="lazy" {...props} alt={props.alt ?? ''} />,
          table: ({ node: _node, ...props }) => (
            <div className="table-scroll">
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
