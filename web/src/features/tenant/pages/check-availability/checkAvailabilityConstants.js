import gpQuadRoom from "../../../../assets/images/branches/gil-puyat/Quadruple - GP/Pic quad.webp";
import gpQuadCommonCr1 from "../../../../assets/images/branches/gil-puyat/Quadruple - GP/Quad & double Common CR.webp";
import gpQuadCommonCr2 from "../../../../assets/images/branches/gil-puyat/Quadruple - GP/Quad & double Common CR2.webp";
import gpDoubleRoom from "../../../../assets/images/branches/gil-puyat/Double - GP/Double sharing room1.webp";
import gpDoubleCommonCr1 from "../../../../assets/images/branches/gil-puyat/Double - GP/Quad & double Common CR.webp";
import gpDoubleCommonCr2 from "../../../../assets/images/branches/gil-puyat/Double - GP/Quad & double Common CR2.webp";
import gpPrivateRoom from "../../../../assets/images/branches/gil-puyat/Private - GP/private room copy.webp";
import gpPrivateTnb from "../../../../assets/images/branches/gil-puyat/Private - GP/Private Rm T&B.webp";
import gp2dDoubleRoom1 from "../../../../assets/images/branches/gil-puyat/2d-viewing/Double sharing room1.webp";
import gp2dDoubleRoom2 from "../../../../assets/images/branches/gil-puyat/2d-viewing/Double sharing rm3.webp";
import gp2dElevatorLobby from "../../../../assets/images/branches/gil-puyat/2d-viewing/G_F elevator lobby.webp";
import gp2dSeatingArea from "../../../../assets/images/branches/gil-puyat/2d-viewing/G_F seating area.webp";
import gp2dSecurityCounter from "../../../../assets/images/branches/gil-puyat/2d-viewing/G_F security counter.webp";
import gp2dLoungeCommon from "../../../../assets/images/branches/gil-puyat/2d-viewing/Lounge common.webp";
import gp2dQuadRoom from "../../../../assets/images/branches/gil-puyat/2d-viewing/Pic quad.webp";
import gp2dPrivateBath from "../../../../assets/images/branches/gil-puyat/2d-viewing/Private Rm T&B.webp";
import gp2dPrivateRoom from "../../../../assets/images/branches/gil-puyat/2d-viewing/private room copy.webp";
import gp2dCommonCr1 from "../../../../assets/images/branches/gil-puyat/2d-viewing/Quad & double Common CR.webp";
import gp2dCommonCr2 from "../../../../assets/images/branches/gil-puyat/2d-viewing/Quad & double Common CR2.webp";
import gp2dRdLoungeArea1 from "../../../../assets/images/branches/gil-puyat/2d-viewing/RD Lounge Area.webp";
import gp2dRdLoungeArea2 from "../../../../assets/images/branches/gil-puyat/2d-viewing/RD Lounge Area 2.webp";
import gd2dCr from "../../../../assets/images/branches/guadalupe/2d-viewing/Guadalupe CR.webp";
import gd2dDiningKit from "../../../../assets/images/branches/guadalupe/2d-viewing/Guadalupe dining_kit.webp";
import gd2dFacade from "../../../../assets/images/branches/guadalupe/2d-viewing/Guadalupe facade.webp";
import gd2dLivingArea from "../../../../assets/images/branches/guadalupe/2d-viewing/Guadalupe living area.webp";
import gd2dSharedRoom1 from "../../../../assets/images/branches/guadalupe/2d-viewing/Guadalupe shared room.webp";
import gd2dSharedRoom2 from "../../../../assets/images/branches/guadalupe/2d-viewing/Guadalupe shared room2.webp";

export const AVAILABLE_APPLIANCES = [
 { id: "fan", name: "Electric Fan", price: 200 },
 { id: "ricecooker", name: "Rice Cooker", price: 200 },
 { id: "laptop", name: "Laptop", price: 200 },
];

export const BRANCH_CAPACITY = {
 "Gil Puyat": {
 totalRooms: 20,
 totalBeds: 60,
 roomTypes: {
 Private: { maxRooms: 40, bedsPerRoom: 2 },
 Shared: { maxRooms: 10, bedsPerRoom: 2 },
 Quadruple: { maxRooms: 45, bedsPerRoom: 4 },
 },
 },
 Guadalupe: {
 totalRooms: 16,
 totalBeds: 64,
 roomTypes: { Quadruple: { maxRooms: 16, bedsPerRoom: 4 } },
 },
};

export const UPCOMING_ROOM = {
 id: "GD-Q-004",
 title: "Room GD-Q-004",
 branch: "Guadalupe",
 type: "Quadruple",
 price: 5400,
 availableFrom: "March 15, 2026",
};

export const validateRoomCapacity = (rooms) => {
 const validation = { isValid: true, errors: [], warnings: [] };
 Object.keys(BRANCH_CAPACITY).forEach((branch) => {
 const branchRooms = rooms.filter((r) => r.branch === branch);
 const config = BRANCH_CAPACITY[branch];
 if (branchRooms.length > config.totalRooms) {
 validation.errors.push(
 `${branch}: Room count exceeds maximum of ${config.totalRooms}`,
 );
 validation.isValid = false;
 }
 const totalBeds = branchRooms.reduce(
 (sum, room) => sum + (room.beds ? room.beds.length : 0),
 0,
 );
 if (totalBeds > config.totalBeds) {
 validation.errors.push(
 `${branch}: Bed count ${totalBeds} exceeds maximum of ${config.totalBeds}`,
 );
 validation.isValid = false;
 }
 Object.keys(config.roomTypes).forEach((roomType) => {
 const typeRooms = branchRooms.filter((r) => r.type === roomType);
 const rc = config.roomTypes[roomType];
 if (typeRooms.length > rc.maxRooms)
 validation.warnings.push(
 `${branch} - ${roomType}: Count ${typeRooms.length} exceeds recommended ${rc.maxRooms}`,
 );
 typeRooms.forEach((room) => {
 const bc = room.beds ? room.beds.length : 0;
 if (bc !== rc.bedsPerRoom)
 validation.warnings.push(
 `${room.title}: Has ${bc} beds, expected ${rc.bedsPerRoom}`,
 );
 });
 });
 });
 return validation;
};

export const checkRoomOverbooking = (room) => {
 if (!room.beds) return false;
 return room.beds.filter((bed) => !bed.available).length > room.beds.length;
};

export const mapRoomType = (type) => {
 const v = typeof type === "string" ? type.toLowerCase() : "";
 if (v === "private" || v.includes("private")) return "Private";
 if (v === "double-sharing" || v.includes("shared") || v.includes("double")) return "Shared";
 if (v === "quadruple-sharing" || v.includes("quad")) return "Quadruple";
 return "Unknown";
};

export const mapBranchLabel = (branch) => {
 if (branch === "gil-puyat") return "Gil Puyat";
 if (branch === "guadalupe") return "Guadalupe";
 return "Unknown";
};

export const getPrimaryImage = (type) => {
 if (type === "private") return gpPrivateRoom;
 if (type === "double-sharing") return gpDoubleRoom;
 return gpQuadRoom;
};

export const getRoomImages = (type, branch) => {
 const normalizedType = typeof type === "string" ? type.toLowerCase() : "";
 const normalizedBranch =
 typeof branch === "string" ? branch.toLowerCase() : "";

 if (
 normalizedType === "quadruple-sharing" &&
 (normalizedBranch === "gil-puyat" || normalizedBranch === "gil puyat")
 ) {
 return [gpQuadRoom, gpQuadCommonCr1, gpQuadCommonCr2];
 }

 if (
 normalizedType === "double-sharing" &&
 (normalizedBranch === "gil-puyat" || normalizedBranch === "gil puyat")
 ) {
 return [gpDoubleRoom, gpDoubleCommonCr1, gpDoubleCommonCr2];
 }

 if (
 normalizedType === "private" &&
 (normalizedBranch === "gil-puyat" || normalizedBranch === "gil puyat")
 ) {
 return [gpPrivateRoom, gpPrivateTnb, gpDoubleRoom];
 }

 return [getPrimaryImage(type), gpDoubleRoom, gpQuadRoom];
};

const isGilPuyatBranch = (branch) => {
 const normalizedBranch =
 typeof branch === "string" ? branch.toLowerCase().trim() : "";
 return normalizedBranch === "gil-puyat" || normalizedBranch === "gil puyat";
};

const isGuadalupeBranch = (branch) => {
 const normalizedBranch =
 typeof branch === "string" ? branch.toLowerCase().trim() : "";
 return normalizedBranch === "guadalupe";
};

const uniqueImages = (...collections) =>
 collections
 .flat()
 .filter((image, index, images) => image && images.indexOf(image) === index);

const GIL_PUYAT_COMMON_AREA_IMAGES = [
 gp2dElevatorLobby,
 gp2dSecurityCounter,
 gp2dSeatingArea,
 gp2dLoungeCommon,
 gp2dRdLoungeArea1,
 gp2dRdLoungeArea2,
];

const GIL_PUYAT_SHARED_CR_IMAGES = [gp2dCommonCr1, gp2dCommonCr2];
const GUADALUPE_COMMON_AREA_IMAGES = [
 gd2dFacade,
 gd2dLivingArea,
 gd2dDiningKit,
];
const GUADALUPE_ROOM_IMAGES = [gd2dSharedRoom1, gd2dSharedRoom2];
const GUADALUPE_CR_IMAGES = [gd2dCr];

export const getRemoteViewingImages = (type, branch) => {
 const normalizedType = typeof type === "string" ? type.toLowerCase() : "";

 if (isGuadalupeBranch(branch)) {
 return uniqueImages(
 GUADALUPE_ROOM_IMAGES,
 GUADALUPE_CR_IMAGES,
 GUADALUPE_COMMON_AREA_IMAGES,
 );
 }

 if (!isGilPuyatBranch(branch)) {
 return getRoomImages(type, branch);
 }

 if (normalizedType === "double-sharing") {
 return uniqueImages(
 [gp2dDoubleRoom1, gp2dDoubleRoom2],
 GIL_PUYAT_SHARED_CR_IMAGES,
 GIL_PUYAT_COMMON_AREA_IMAGES,
 );
 }

 if (normalizedType === "quadruple-sharing") {
 return uniqueImages(
 [gp2dQuadRoom],
 GIL_PUYAT_SHARED_CR_IMAGES,
 GIL_PUYAT_COMMON_AREA_IMAGES,
 );
 }

 if (normalizedType === "private") {
 return uniqueImages(
 [gp2dPrivateRoom, gp2dPrivateBath],
 GIL_PUYAT_COMMON_AREA_IMAGES,
 );
 }

 return uniqueImages(
 [gp2dPrivateRoom, gp2dDoubleRoom1, gp2dDoubleRoom2, gp2dQuadRoom],
 [gp2dPrivateBath],
 GIL_PUYAT_SHARED_CR_IMAGES,
 GIL_PUYAT_COMMON_AREA_IMAGES,
 );
};

export const ROOM_IMAGES = {
 gpQuadRoom,
 gpQuadCommonCr1,
 gpQuadCommonCr2,
 gpDoubleRoom,
 gpDoubleCommonCr1,
 gpDoubleCommonCr2,
 gpPrivateRoom,
 gpPrivateTnb,
 gp2dDoubleRoom1,
 gp2dDoubleRoom2,
 gp2dElevatorLobby,
 gp2dSeatingArea,
 gp2dSecurityCounter,
 gp2dLoungeCommon,
 gp2dQuadRoom,
 gp2dPrivateBath,
 gp2dPrivateRoom,
 gp2dCommonCr1,
 gp2dCommonCr2,
 gp2dRdLoungeArea1,
 gp2dRdLoungeArea2,
 gd2dCr,
 gd2dDiningKit,
 gd2dFacade,
 gd2dLivingArea,
 gd2dSharedRoom1,
 gd2dSharedRoom2,
};

export const buildBedsFromCapacity = (roomNumber, type, occupiedCount = 0) => {
 const positions =
 type === "private" || type === "double-sharing"
 ? ["upper", "lower"]
 : ["upper", "lower", "upper", "lower"];
 return positions.map((position, index) => ({
 id: `${roomNumber}-B${index + 1}`,
 position,
 available: index >= occupiedCount,
 }));
};
