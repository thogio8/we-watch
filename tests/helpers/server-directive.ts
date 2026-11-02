// How tests/functional/server-actions.test.ts finds Server Actions. Next
// turns any function holding a "use server" directive into a public
// endpoint: only a whole module may be one, so it is checked in full.

/** Whitespace and comments before a module's first statement. */
const LEADING_COMMENTS = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/;
const HEAD_DIRECTIVE = /^(["'])use server\1/;
/**
 * The directive as a statement: at a line start or after `{`, `}` or `;`,
 * and ended by `;`, `}` or the line's end. A string inside an expression
 * (an argument, an array) or a comment is not one.
 */
const STATEMENT = /(?:^|[{};])[ \t]*(["'])use server\1[ \t]*(?=[;}]|$)/m;

/** The module's text after its leading comments. */
const body = (text: string) => text.replace(LEADING_COMMENTS, "");

/** A module whose first statement is the directive, comments aside. */
export function isServerModule(text: string): boolean {
  return HEAD_DIRECTIVE.test(body(text));
}

/** The directive anywhere but as a module's first statement. */
export function hasMisplacedDirective(text: string): boolean {
  return STATEMENT.test(body(text).replace(HEAD_DIRECTIVE, ""));
}
