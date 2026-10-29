import { getSchema } from "better-auth/db";
import { describe, expect, it } from "vitest";
import { groupModels } from "./legacy-group-join";

describe("tables de groupes déclarées à Better Auth", () => {
  it("ne laisse jamais Better Auth les migrer : elles appartiennent à l’appli", () => {
    const schema = getSchema({ plugins: [groupModels] });

    expect(schema.group?.disableMigrations).toBe(true);
    expect(schema.membership?.disableMigrations).toBe(true);
  });
});
