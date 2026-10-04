import ReactMarkdown from 'react-markdown';

/** Renders markdown with the `.markdown` styles from index.css (headings, lists, code blocks, images). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        components={{
          a: ({ node: _node, ...props }) => {
            const external = typeof props.href === 'string' && /^https?:\/\//.test(props.href);
            return <a {...props} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} />;
          },
          img: ({ node: _node, ...props }) => <img loading="lazy" {...props} alt={props.alt ?? ''} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
