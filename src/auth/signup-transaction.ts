import { AsyncLocalStorage } from "node:async_hooks";
import type { Database, Executor } from "@/db/create-database";

const current = new AsyncLocalStorage<Executor>();

/**
 * The database handed to Better Auth's adapter: the same, except that each
 * transaction it opens (the passkey signup's) is remembered while it runs.
 * Better Auth's adapter can only insert a row as given; the signup's group
 * join needs one conditional statement on that same transaction.
 */
export function trackTransactions(db: Database): Database {
  function transaction<T>(
    run: (tx: Executor) => Promise<T>,
    config?: Parameters<Database["transaction"]>[1],
  ): Promise<T> {
    return db.transaction((tx) => current.run(tx, () => run(tx)), config);
  }
  return Object.create(db, { transaction: { value: transaction } });
}

/** The Better Auth transaction this code runs in; throws outside one. */
export function currentTransaction(): Executor {
  const tx = current.getStore();
  if (tx === undefined) {
    throw new Error("Group join outside a Better Auth transaction");
  }
  return tx;
}
