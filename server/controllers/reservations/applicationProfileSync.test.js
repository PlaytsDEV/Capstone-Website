import { describe, expect, test } from "@jest/globals";
import { buildUserProfileUpdatesFromApplication } from "./applicationController.js";
import {
  resolveTenantPersonalDetails,
  buildTenantProfileSyncUpdates,
} from "../../services/tenantProfileService.js";

describe("Application to Profile Synchronization", () => {
  describe("buildUserProfileUpdatesFromApplication", () => {
    test("extracts all submitted application fields into User document updates", () => {
      const submittedBody = {
        firstName: "Maria",
        middleName: "Santos",
        lastName: "Dela Cruz",
        mobileNumber: "09171234567",
        selfiePhotoUrl: "https://storage.example.com/selfie123.jpg",
        gender: "female",
        maritalStatus: "single",
        nationality: "Filipino",
        birthday: "2001-05-15",
        educationLevel: "college",
        "employment.occupation": "Software Engineer",
        "employment.employerSchool": "Tech Corp PH",
        addressUnitHouseNo: "Unit 4B",
        addressStreet: "123 Katipunan Ave",
        addressBarangay: "Loyola Heights",
        addressCity: "Quezon City",
        addressProvince: "Metro Manila",
        emergencyContactName: "Juan Dela Cruz",
        emergencyRelationship: "father",
        emergencyContactNumber: "09189876543",
      };

      const existingReservation = {};

      const userUpdates = buildUserProfileUpdatesFromApplication(
        submittedBody,
        existingReservation,
      );

      expect(userUpdates.firstName).toBe("Maria");
      expect(userUpdates.middleName).toBe("Santos");
      expect(userUpdates.lastName).toBe("Dela Cruz");
      expect(userUpdates.phone).toBe("09171234567");
      expect(userUpdates.profileImage).toBe("https://storage.example.com/selfie123.jpg");
      expect(userUpdates.gender).toBe("female");
      expect(userUpdates.civilStatus).toBe("single");
      expect(userUpdates.nationality).toBe("Filipino");
      expect(userUpdates.occupation).toBe("Software Engineer");
      expect(userUpdates.educationLevel).toBe("college");
      expect(userUpdates.school).toBe("Tech Corp PH");
      expect(userUpdates.address).toBe(
        "Unit 4B, 123 Katipunan Ave, Loyola Heights, Quezon City, Metro Manila",
      );
      expect(userUpdates.city).toBe("Quezon City");
      expect(userUpdates.province).toBe("Metro Manila");
      expect(userUpdates.dateOfBirth).toEqual(new Date("2001-05-15"));
      expect(userUpdates.emergencyContact).toBe("Juan Dela Cruz");
      expect(userUpdates.emergencyRelationship).toBe("father");
      expect(userUpdates.emergencyPhone).toBe("09189876543");
    });

    test("falls back gracefully to existing reservation fields when partial body is provided", () => {
      const partialBody = {
        firstName: "UpdatedMaria",
      };

      const existingReservation = {
        middleName: "Santos",
        lastName: "Dela Cruz",
        mobileNumber: "09171234567",
        selfiePhotoUrl: "https://storage.example.com/selfie.jpg",
        gender: "female",
        maritalStatus: "single",
        nationality: "Filipino",
        birthday: "2000-01-01",
        educationLevel: "highschool",
        employment: {
          occupation: "Designer",
          employerSchool: "Design Studio",
        },
        address: {
          unitHouseNo: "Room 1",
          street: "Main St",
          barangay: "Central",
          city: "Manila",
          province: "Metro Manila",
        },
        emergencyContact: {
          name: "Pedro Santos",
          relationship: "brother",
          contactNumber: "09191112233",
        },
      };

      const userUpdates = buildUserProfileUpdatesFromApplication(
        partialBody,
        existingReservation,
      );

      expect(userUpdates.firstName).toBe("UpdatedMaria");
      expect(userUpdates.middleName).toBe("Santos");
      expect(userUpdates.lastName).toBe("Dela Cruz");
      expect(userUpdates.phone).toBe("09171234567");
      expect(userUpdates.profileImage).toBe("https://storage.example.com/selfie.jpg");
      expect(userUpdates.occupation).toBe("Designer");
      expect(userUpdates.address).toBe("Room 1, Main St, Central, Manila, Metro Manila");
      expect(userUpdates.emergencyContact).toBe("Pedro Santos");
      expect(userUpdates.emergencyPhone).toBe("09191112233");
    });
  });

  describe("resolveTenantPersonalDetails", () => {
    test("resolves selfie photo and middle name when user document initially has empty values", () => {
      const user = {
        firstName: "Juan",
        lastName: "Luna",
        email: "juan@example.test",
        profileImage: "",
      };

      const reservation = {
        firstName: "Juan",
        middleName: "Novicio",
        lastName: "Luna",
        mobileNumber: "09170001122",
        selfiePhotoUrl: "https://storage.example.com/juan_selfie.jpg",
        educationLevel: "college",
        address: {
          street: "General Luna St",
          city: "Manila",
          province: "Metro Manila",
        },
        emergencyContact: {
          name: "Antonio Luna",
          relationship: "brother",
          contactNumber: "09179998877",
        },
      };

      const resolved = resolveTenantPersonalDetails({ user, reservation });

      expect(resolved.fullName).toBe("Juan Novicio Luna");
      expect(resolved.firstName).toBe("Juan");
      expect(resolved.middleName).toBe("Novicio");
      expect(resolved.lastName).toBe("Luna");
      expect(resolved.profileImage).toBeNull();
      expect(resolved.educationLevel).toBe("college");
      expect(resolved.phone).toBe("09170001122");
      expect(resolved.currentAddress).toBe("General Luna St, Manila, Metro Manila");
      expect(resolved.emergencyContact.name).toBe("Antonio Luna");
      expect(resolved.emergencyContact.relationship).toBe("brother");
      expect(resolved.emergencyContact.phone).toBe("09179998877");
    });

    test("prefers user edited profile image over application selfie when user customizes it", () => {
      const user = {
        firstName: "Juan",
        lastName: "Luna",
        profileImage: "https://storage.example.com/custom_avatar.png",
      };

      const reservation = {
        selfiePhotoUrl: "https://storage.example.com/application_selfie.jpg",
      };

      const resolved = resolveTenantPersonalDetails({ user, reservation });
      expect(resolved.profileImage).toBe("https://storage.example.com/custom_avatar.png");
    });
  });

  describe("buildTenantProfileSyncUpdates", () => {
    test("identifies missing user fields that can be filled from submitted application", () => {
      const user = {
        firstName: "Jose",
        lastName: "Rizal",
        email: "jose@example.test",
        phone: null,
      };

      const reservation = {
        middleName: "Protacio",
        mobileNumber: "09171231234",
        nationality: "Filipino",
        maritalStatus: "single",
        birthday: "1998-06-19",
        address: {
          street: "Calamba",
          city: "Calamba",
          province: "Laguna",
        },
      };

      const syncUpdates = buildTenantProfileSyncUpdates({ user, reservation });

      expect(syncUpdates.middleName).toBe("Protacio");
      expect(syncUpdates.phone).toBe("09171231234");
      expect(syncUpdates.nationality).toBe("Filipino");
      expect(syncUpdates.civilStatus).toBe("single");
      expect(syncUpdates.city).toBe("Calamba");
      expect(syncUpdates.province).toBe("Laguna");
    });
  });
});
