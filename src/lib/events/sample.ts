import { EventSchema, type Event } from "./schema";
import sample from "../../../data/events.json";

/** Seed events shipped with the deploy. The backend session replaces this read with the store. */
export function sampleEvents(): Event[] {
  return (sample as unknown[]).map((e) => EventSchema.parse(e));
}
