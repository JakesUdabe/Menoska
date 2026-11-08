import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => false,
  createClient: () => {
    throw new Error("not configured");
  },
}));

vi.mock("@/lib/bulletins-store", () => {
  const rows = [
    {
      id: "b-org-a",
      createdBy: "user-a",
      organizationId: "org-a",
      name: "A",
      subject: "A",
      language: "es",
      frequency: "weekly" as const,
      sendDay: 1,
      sendHour: 7,
      timezone: "UTC",
      recipients: [],
      mode: "common" as const,
      nlQuery: "",
      sections: [{ title: "S", companies: [], technologies: [] }],
      maxItems: 10,
      status: "active" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "b-org-b",
      createdBy: "user-b",
      organizationId: "org-b",
      name: "B",
      subject: "B",
      language: "es",
      frequency: "weekly" as const,
      sendDay: 1,
      sendHour: 7,
      timezone: "UTC",
      recipients: [],
      mode: "common" as const,
      nlQuery: "",
      sections: [{ title: "S", companies: [], technologies: [] }],
      maxItems: 10,
      status: "active" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "b-user-a-personal",
      createdBy: "user-a",
      organizationId: "org-a",
      name: "Personal",
      subject: "P",
      language: "es",
      frequency: "weekly" as const,
      sendDay: 1,
      sendHour: 7,
      timezone: "UTC",
      recipients: [],
      mode: "common" as const,
      nlQuery: "",
      sections: [{ title: "S", companies: [], technologies: [] }],
      maxItems: 10,
      status: "draft" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  return {
    listBulletinsForUser: (userId: string, organizationId: string | null, canSeeOrg: boolean) => {
      if (canSeeOrg && organizationId) return rows.filter((b) => b.organizationId === organizationId);
      return rows.filter((b) => b.createdBy === userId);
    },
    normalizeBulletin: <T>(b: T) => b,
    getBulletin: () => undefined,
    saveBulletin: <T>(b: T) => b,
    deleteBulletin: () => undefined,
    countActiveBulletins: () => 0,
  };
});

describe("bulletin repository tenant isolation", () => {
  it("filters by organization when canSeeOrg", async () => {
    const { listBulletinsForUser } = await import("./bulletins-repository");
    const orgA = await listBulletinsForUser("user-a", "org-a", true);
    expect(orgA.every((b) => b.organizationId === "org-a")).toBe(true);
    expect(orgA.some((b) => b.id === "b-org-b")).toBe(false);
    expect(orgA.map((b) => b.id).sort()).toEqual(["b-org-a", "b-user-a-personal"]);
  });

  it("does not leak other org bulletins to a different org admin", async () => {
    const { listBulletinsForUser } = await import("./bulletins-repository");
    const orgB = await listBulletinsForUser("user-b", "org-b", true);
    expect(orgB).toHaveLength(1);
    expect(orgB[0]?.id).toBe("b-org-b");
  });

  it("scopes to creator when canSeeOrg is false", async () => {
    const { listBulletinsForUser } = await import("./bulletins-repository");
    const mine = await listBulletinsForUser("user-a", "org-a", false);
    expect(mine.every((b) => b.createdBy === "user-a")).toBe(true);
    expect(mine.some((b) => b.id === "b-org-b")).toBe(false);
  });
});
