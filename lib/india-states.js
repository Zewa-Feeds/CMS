/**
 * States and union territories, and the shipping zone each one starts in.
 *
 * Mirrors Backend/src/lib/india-states.ts — the API is authoritative for what a
 * customer is charged; this list exists so the settings screen can show every
 * state and group them sensibly. Names must match the API's exactly.
 */

export const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar Islands", "Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

export const HOME_STATE = "Kerala";
export const SOUTH_ZONE_STATES = ["Tamil Nadu", "Karnataka", "Telangana", "Andhra Pradesh", "Goa"];

/** Which starting tier a state belongs to. Only groups the UI; rates are per state. */
export function zoneForState(state) {
  if (state === HOME_STATE) return "home";
  return SOUTH_ZONE_STATES.includes(state) ? "south" : "rest";
}

/** The three groups, in the order they are shown, cheapest first. */
export const ZONES = [
  { key: "home", label: "Kerala", hint: "Home state." },
  { key: "south", label: "South zone", hint: "Neighbouring southern states." },
  { key: "rest", label: "Rest of India", hint: "Everywhere else." },
];
