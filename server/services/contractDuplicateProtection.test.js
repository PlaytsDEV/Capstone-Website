import fs from "fs";
import { describe, expect, test } from "@jest/globals";
import Contract from "../models/Contract.js";

const serviceSource = fs.readFileSync(
  new URL("./contractService.js", import.meta.url),
  "utf8",
);
const controllerSource = fs.readFileSync(
  new URL("../controllers/contractController.js", import.meta.url),
  "utf8",
);

describe("initial Contract duplicate protection", () => {
  test("uses unique deterministic Reservation and Stay source keys", () => {
    const indexes = Contract.schema.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      [
        { initialContractKey: 1 },
        expect.objectContaining({
          unique: true,
          name: "unique_initial_contract_reservation",
        }),
      ],
      [
        { initialStayKey: 1 },
        expect.objectContaining({
          unique: true,
          name: "unique_initial_contract_stay",
        }),
      ],
    ]));
  });

  test("checks Reservation, application, and Stay before allocating a number", () => {
    const duplicateLookup = serviceSource.indexOf("const existingContract = await Contract.findOne");
    const numberAllocation = serviceSource.indexOf("const number = await generateContractNumber");
    expect(duplicateLookup).toBeGreaterThan(-1);
    expect(numberAllocation).toBeGreaterThan(duplicateLookup);
    expect(serviceSource).toMatch(/\{ reservationId: reservation\._id \}/);
    expect(serviceSource).toMatch(/\{ applicationId: reservation\._id \}/);
    expect(serviceSource).toMatch(/\{ stayId: effectiveStayId \}/);
  });

  test("normal creation always emits an initial purpose and deterministic keys", () => {
    expect(serviceSource).toMatch(/contractPurpose: "initial"/);
    expect(serviceSource).toMatch(/initialContractKey: `reservation:\$\{reservation\._id\}`/);
    expect(serviceSource).toMatch(/initialStayKey: effectiveStayId \? `stay:\$\{effectiveStayId\}` : null/);
  });

  test("duplicate-key races return a stable 409 conflict", () => {
    expect(serviceSource).toMatch(/error\?\.code === 11000/);
    expect(serviceSource).toMatch(/"DUPLICATE_CONTRACT",\s*409/);
    expect(controllerSource).toMatch(/Duplicate initial Contract creation prevented/);
  });
});
