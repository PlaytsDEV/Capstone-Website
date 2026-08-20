import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const createLeanQueryWithPopulate = (result) => ({
  select: jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(result),
      }),
    }),
    limit: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(result),
    }),
  }),
});

const models = {
  User: { find: jest.fn() },
  Room: { find: jest.fn() },
  MaintenanceRequest: { find: jest.fn() },
};

await jest.unstable_mockModule("../models/index.js", () => models);
await jest.unstable_mockModule("../config/roles.js", () => ({
  isOwnerRole: (role) => role === "owner",
}));

const { handleAdminQuickSearch } = await import("./adminSearchController.js");

describe("adminSearchController", () => {
  beforeEach(() => {
    models.User.find.mockReset();
    models.Room.find.mockReset();
    models.MaintenanceRequest.find.mockReset();
  });

  test("returns empty data when query is blank", async () => {
    const req = {
      query: { query: "" },
      authUser: { role: "branch_admin", branch: "gil-puyat" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await handleAdminQuickSearch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        tenants: [],
        rooms: [],
        maintenance: [],
      },
    });
  });

  test("filters search strictly by branch for branch admins", async () => {
    models.User.find.mockReturnValue(
      createLeanQueryWithPopulate([
        {
          _id: "user-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          branch: "gil-puyat",
        },
      ])
    );
    models.Room.find.mockReturnValue(
      createLeanQueryWithPopulate([
        {
          _id: "room-1",
          roomNumber: "101",
          name: "Room 101",
          branch: "gil-puyat",
          type: "quadruple",
        },
      ])
    );
    models.MaintenanceRequest.find.mockReturnValue(
      createLeanQueryWithPopulate([
        {
          _id: "maint-1",
          title: "Plumbing Leak",
          roomNumber: "101",
          branch: "gil-puyat",
          status: "pending",
        },
      ])
    );

    const req = {
      query: { query: "101" },
      authUser: { role: "branch_admin", branch: "gil-puyat" },
      branchFilter: "gil-puyat",
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await handleAdminQuickSearch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    expect(jsonCall.data.tenants).toHaveLength(1);
    expect(jsonCall.data.rooms).toHaveLength(1);
    expect(jsonCall.data.maintenance).toHaveLength(1);
    expect(jsonCall.data.tenants[0].branch).toBe("Gil Puyat");
  });

  test("allows owners to search across all branches", async () => {
    models.User.find.mockReturnValue(
      createLeanQueryWithPopulate([
        {
          _id: "user-1",
          firstName: "Alice",
          lastName: "Guadalupe",
          email: "alice@example.com",
          branch: "guadalupe",
        },
        {
          _id: "user-2",
          firstName: "Bob",
          lastName: "Puyat",
          email: "bob@example.com",
          branch: "gil-puyat",
        },
      ])
    );
    models.Room.find.mockReturnValue(createLeanQueryWithPopulate([]));
    models.MaintenanceRequest.find.mockReturnValue(createLeanQueryWithPopulate([]));

    const req = {
      query: { query: "Alice" },
      authUser: { role: "owner" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await handleAdminQuickSearch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    expect(jsonCall.data.tenants).toHaveLength(2);
    expect(jsonCall.data.tenants[0].branch).toBe("Guadalupe");
    expect(jsonCall.data.tenants[1].branch).toBe("Gil Puyat");
  });
});
