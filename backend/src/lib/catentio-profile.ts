import type { ChatActionOut, ProductAgentProfile } from '@forjio/catentio-embed';

/**
 * What the Suppuo agent may plan against, per resource — the product
 * half of the @forjio/catentio-embed contract. The engine sanitizes
 * against exactly these declarations, so a field absent here cannot be
 * written no matter what the model proposes.
 *
 * Scope decision: the agent writes the workspace's OWN CONTENT — help
 * centre articles/FAQs and canned replies. That is the repetitive
 * authoring a support team actually wants help with.
 *
 * Tickets are deliberately NOT in scope, and not merely unlisted: they
 * are live conversations with real end users, and an agent composing
 * into them is a different product decision with a different consent
 * story. `/tickets`, `/requester` and the public ingress are refused at
 * the auth layer, so no prompt can talk the agent onto them.
 *
 * Field sets mirror the zod bodies in routes/help.ts and
 * routes/canned-replies.ts.
 */

/** Per-product delegation token prefix — a leaked token names its
 *  origin. Lives here (not middleware/auth.ts) so test files that mock
 *  the auth middleware don't have to know about it. */
export const SUPPUO_DELEGATION_PREFIX = 'spdt_';

export interface SuppuoLimits {
  plan: string;
}

export const SUPPUO_PROFILE: ProductAgentProfile<SuppuoLimits> = {
  productName: 'Suppuo',
  resources: {
    help: {
      label: 'help article',
      createRequired: ['title', 'body'],
      fields: [
        { key: 'kind', type: 'string', create: true, edit: true, description: "'faq' (a question and its answer) | 'article' (a titled markdown page)" },
        { key: 'slug', type: 'string', create: true, edit: true, nullable: true, description: 'lowercase-kebab URL slug for articles (≤120 chars); FAQ rows leave it null' },
        { key: 'category', type: 'string', create: true, edit: true, nullable: true, description: 'grouping label on the help centre, e.g. "Getting started" (≤80 chars), or null' },
        { key: 'title', type: 'string', create: true, edit: true, description: 'the question for a FAQ, the title for an article (≤300 chars)' },
        { key: 'body', type: 'string', create: true, edit: true, description: 'the answer for a FAQ, the markdown body for an article (≤50000 chars)' },
        { key: 'status', type: 'string', create: true, edit: true, description: "'draft' | 'published' — new entries default to draft" },
        { key: 'position', type: 'number', create: true, edit: true, description: 'manual ordering within a category, ascending, 0-based' },
      ],
    },
    'canned-replies': {
      label: 'canned reply',
      createRequired: ['title', 'body'],
      fields: [
        { key: 'title', type: 'string', create: true, edit: true, description: 'what the reply is for, shown in the picker (≤120 chars)' },
        { key: 'body', type: 'string', create: true, edit: true, description: 'the reply text an agent inserts into a ticket (≤20000 chars)' },
      ],
    },
  },
  scopeSummary: "the workspace's help centre, canned replies, tickets, channels, or reports",
  multiStepExample: 'write a FAQ AND a canned reply that points at it',
  writablesSummary: 'help centre articles and canned replies',
  endpointsLine:
    '- Key endpoints: POST /api/v1/help (create; body fields below) · PATCH /api/v1/help/{id} · DELETE /api/v1/help/{id} · POST /api/v1/canned-replies · PATCH /api/v1/canned-replies/{id} · DELETE /api/v1/canned-replies/{id} · GET /api/v1/help, /api/v1/canned-replies.',
  extraNotes: [
    "A 'faq' is a question and its answer and needs no slug; an 'article' is a titled markdown page and takes a lowercase-kebab slug, unique per workspace. New entries are created as drafts — say so rather than implying they are live.",
    'You can read tickets to understand what customers keep asking, but you cannot write to them, reply to anyone, or touch a channel — propose a help article or a canned reply instead.',
  ],
  bulkExample: 'turn these 10 questions into FAQs',
  untrustedExamples: 'ticket subjects and customer messages',
  gatherExamples: 'existing slugs and categories, the article you are editing',
  executeSummaryExamples: 'the new article and its slug, the canned reply title, what actually changed',
  plan: {
    lookupSummary: 'help articles, canned replies, tickets',
  },
};

export type SuppuoChatAction = ChatActionOut;
