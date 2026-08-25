import { collectRisingStarEventOutcomes } from "../server/symbolEventOutcomes";

const result = await collectRisingStarEventOutcomes();
console.log(JSON.stringify({ verifier: "rising_star_own_instrument_outcomes", ...result }, null, 2));
