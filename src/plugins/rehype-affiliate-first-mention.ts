import type { Element, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visitParents } from 'unist-util-visit-parents';

const SKIP_ANCESTOR_TAGS = new Set(['a', 'code', 'pre', 'script', 'style']);

type ServiceId = 'kindle-unlimited' | 'audible';

const SERVICES: Record<
  ServiceId,
  { label: string; officialUrl: string }
> = {
  'kindle-unlimited': {
    label: 'Kindle Unlimited',
    officialUrl: 'https://www.amazon.co.jp/kindle-dbs/hz/signup',
  },
  audible: {
    label: 'Audible',
    officialUrl: 'https://www.amazon.co.jp/hz/audible/mlp',
  },
};

const TERMS: { id: ServiceId; label: string }[] = [
  { id: 'kindle-unlimited', label: SERVICES['kindle-unlimited'].label },
  { id: 'audible', label: SERVICES.audible.label },
];

function affiliateUrl(url: string): string {
  const tag =
    typeof import.meta !== 'undefined'
      ? (import.meta.env?.PUBLIC_AMAZON_ASSOCIATE_TAG as string | undefined)
      : undefined;
  if (!tag) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('amazon.co.jp')) return url;
    parsed.searchParams.set('tag', tag);
    return parsed.toString();
  } catch {
    return url;
  }
}

function createAffiliateLink(label: string, href: string): Element {
  return {
    type: 'element',
    tagName: 'a',
    properties: {
      href,
      rel: 'nofollow sponsored noopener',
      target: '_blank',
      className: 'prose-affiliate-link',
    },
    children: [{ type: 'text', value: label }],
  };
}

function splitAtFirstOccurrence(
  text: string,
  term: { id: ServiceId; label: string },
): (Text | Element)[] {
  const index = text.indexOf(term.label);
  if (index === -1) return [{ type: 'text', value: text }];

  const href = affiliateUrl(SERVICES[term.id].officialUrl);
  const parts: (Text | Element)[] = [];
  if (index > 0) {
    parts.push({ type: 'text', value: text.slice(0, index) });
  }
  parts.push(createAffiliateLink(term.label, href));
  const rest = text.slice(index + term.label.length);
  if (rest) {
    parts.push({ type: 'text', value: rest });
  }
  return parts;
}

function isInsideSkippedAncestor(ancestors: unknown[]): boolean {
  return ancestors.some(
    (ancestor) =>
      ancestor &&
      typeof ancestor === 'object' &&
      'type' in ancestor &&
      ancestor.type === 'element' &&
      SKIP_ANCESTOR_TAGS.has((ancestor as Element).tagName),
  );
}

function linkFirstMention(tree: Root, term: (typeof TERMS)[number]): void {
  let linked = false;

  visitParents(tree, 'text', (node, ancestors) => {
    if (linked) return;
    if (isInsideSkippedAncestor(ancestors)) return;
    if (!node.value.includes(term.label)) return;

    const elementAncestors = ancestors.filter(
      (ancestor): ancestor is Element => ancestor.type === 'element',
    );
    const parent = elementAncestors.at(-1);
    if (!parent) return;

    const index = parent.children.indexOf(node);
    if (index === -1) return;

    const parts = splitAtFirstOccurrence(node.value, term);
    if (parts.length === 1 && parts[0].type === 'text') return;

    parent.children.splice(index, 1, ...parts);
    linked = true;
  });
}

/**
 * 記事本文（Markdown → HTML）で Kindle Unlimited / Audible の
 * 各サービス名の初出（文書順）のみアソシエイトリンクにする。
 */
export const rehypeAffiliateFirstMention: Plugin<[], Root> = () => {
  return (tree) => {
    for (const term of TERMS) {
      linkFirstMention(tree, term);
    }
  };
};
