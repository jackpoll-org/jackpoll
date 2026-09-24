"use client";

import Markdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

// Markdown for owner-written content blocks (public #7). react-markdown never
// renders raw HTML and strips unsafe URLs (javascript:, data:) by default.
// Images are not allowed inline: a remote image would leak every respondent's
// IP to a third-party host, so pictures go through our own uploads instead.
const DISALLOWED = ["img"];

/** Drop react-markdown's AST `node` prop so it isn't spread onto the DOM element. */
function domProps<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const { node, ...rest } = props;
  void node;
  return rest;
}

const COMPONENTS: Components = {
  h1: (props) => <h3 className="text-lg font-semibold" {...domProps(props)} />,
  h2: (props) => <h4 className="text-base font-semibold" {...domProps(props)} />,
  h3: (props) => <h5 className="text-sm font-semibold" {...domProps(props)} />,
  p: (props) => <p className="leading-relaxed" {...domProps(props)} />,
  ul: (props) => <ul className="list-disc space-y-1 pl-5" {...domProps(props)} />,
  ol: (props) => <ol className="list-decimal space-y-1 pl-5" {...domProps(props)} />,
  blockquote: (props) => (
    <blockquote className="border-l-2 pl-3 text-muted-foreground italic" {...domProps(props)} />
  ),
  a: (props) => (
    <a
      className="font-medium text-primary underline underline-offset-4"
      target="_blank"
      rel="noopener noreferrer nofollow"
      {...domProps(props)}
    />
  ),
};

interface RichTextProps {
  markdown: string;
  className?: string;
}

/** Render a small, safe Markdown subset: headings, emphasis, lists, quotes, links. */
export function RichText({ markdown, className }: RichTextProps) {
  return (
    <div className={cn("grid gap-3 text-sm break-words", className)}>
      <Markdown components={COMPONENTS} disallowedElements={DISALLOWED} unwrapDisallowed>
        {markdown}
      </Markdown>
    </div>
  );
}
