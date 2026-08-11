/**
 * PSGC Cloud API Utility
 *
 * Philippine Standard Geographic Code — https://psgc.cloud
 * Free, no auth required, public reference data.
 *
 * Cascading geographic data:
 *   Regions → Provinces → Cities/Municipalities → Barangays
 *
 * NCR (code 1300000000) has no provinces — cities sit directly under the region.
 * NCR cities-municipalities endpoint includes SubMun types which we filter out.
 */

const BASE = "https://psgc.cloud/api";
const MANILA_CITY_CODE = "1380600000";
const barangayCache = new Map();
const regionPlacesCache = new Map();

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PSGC API error: ${res.status}`);
  return res.json();
};

/** Fix double-encoded UTF-8 character artifacts (Mojibake) from external APIs */
export const sanitizeName = (str) => {
  if (!str) return "";
  return str
    .replace(/Ã±/g, "ñ")
    .replace(/Ã\+/g, "Ñ")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ã³/g, "ó")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ãº/g, "ú");
};

const byName = (a, b) => a.name.localeCompare(b.name, undefined, {
  numeric: true,
  sensitivity: "base",
});

const mapBarangay = (b, subMunicipalityName = "") => {
  const cleanName = sanitizeName(b.name);
  const cleanSub = sanitizeName(subMunicipalityName);
  return {
    code: b.code,
    name: cleanName,
    label: cleanSub ? `${cleanName} (${cleanSub})` : cleanName,
    subMunicipalityName: cleanSub,
  };
};

const getRegionPlaces = (regionCode) => {
  if (!regionPlacesCache.has(regionCode)) {
    regionPlacesCache.set(
      regionCode,
      fetchJson(`${BASE}/regions/${regionCode}/cities-municipalities`)
    );
  }
  return regionPlacesCache.get(regionCode);
};

const getManilaSubMunicipalities = async () => {
  const cityPrefix = MANILA_CITY_CODE.slice(0, 5);
  const places = await getRegionPlaces(NCR_CODE);

  return places
    .filter((place) => place.type === "SubMun" && place.code.startsWith(cityPrefix))
    .map((place) => ({ code: place.code, name: sanitizeName(place.name) }))
    .sort(byName);
};

/** Fetch all 17 regions, sorted by name */
export const getRegions = async () => {
  const data = await fetchJson(`${BASE}/regions`);
  return data
    .map((r) => ({ code: r.code, name: sanitizeName(r.name) }))
    .sort(byName);
};

/** Fetch provinces for a region (returns [] for NCR) */
export const getProvinces = async (regionCode) => {
  const data = await fetchJson(`${BASE}/regions/${regionCode}/provinces`);
  return data
    .map((p) => ({ code: p.code, name: sanitizeName(p.name) }))
    .sort(byName);
};

/**
 * Fetch cities/municipalities.
 * - If provinceCode is provided → cities under that province.
 * - If only regionCode → cities directly under the region (for NCR).
 * Filters out SubMun types (e.g. Tondo, Binondo) for NCR.
 */
export const getCities = async (provinceCode, regionCode) => {
  const data = provinceCode
    ? await fetchJson(`${BASE}/provinces/${provinceCode}/cities-municipalities`)
    : await getRegionPlaces(regionCode);

  return data
    .filter((c) => c.type === "City" || c.type === "Mun")
    .map((c) => ({ code: c.code, name: sanitizeName(c.name) }))
    .sort(byName);
};

/** Fetch barangays for a city/municipality */
export const getBarangays = async (cityCode) => {
  if (!cityCode) return [];
  if (barangayCache.has(cityCode)) return barangayCache.get(cityCode);

  const data = await fetchJson(`${BASE}/cities-municipalities/${cityCode}/barangays`);
  if (data.length > 0 || cityCode !== MANILA_CITY_CODE) {
    const barangays = data.map((b) => mapBarangay(b)).sort(byName);
    barangayCache.set(cityCode, barangays);
    return barangays;
  }

  const subMunicipalities = await getManilaSubMunicipalities();
  const barangayGroups = await Promise.all(
    subMunicipalities.map(async (subMunicipality) => {
      const barangays = await fetchJson(
        `${BASE}/sub-municipalities/${subMunicipality.code}/barangays`
      );
      return barangays.map((barangay) => mapBarangay(barangay, subMunicipality.name));
    })
  );

  const barangays = barangayGroups.flat().sort(byName);
  barangayCache.set(cityCode, barangays);
  return barangays;
};

/** NCR region code — has no provinces, cities sit directly under it */
export const NCR_CODE = "1300000000";
