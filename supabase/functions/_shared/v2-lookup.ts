/**
 * Resolves a v2_event regardless of whether the input UUID is a v2_events.id
 * or a legacy UUID (event_inquiries.id, event_bookings.id, catering_orders.id).
 *
 * Lookup priority: v2_events.id → source_inquiry_id → source_booking_id → source_catering_id
 */
// deno-lint-ignore no-explicit-any
export async function resolveV2Event(
  supabase: any,
  uuid: string,
): Promise<{ id: string; customer_id: string; [k: string]: any } | null> {
  if (!uuid || typeof uuid !== "string") return null;

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(uuid)) return null;

  // 1) Direct v2_events.id
  const { data: byId } = await supabase
    .from("v2_events")
    .select("*")
    .eq("id", uuid)
    .maybeSingle();
  if (byId) return byId;

  // 2) Legacy event_inquiries.id
  const { data: byInquiry } = await supabase
    .from("v2_events")
    .select("*")
    .eq("source_inquiry_id", uuid)
    .maybeSingle();
  if (byInquiry) return byInquiry;

  // 3) Legacy event_bookings.id
  const { data: byBooking } = await supabase
    .from("v2_events")
    .select("*")
    .eq("source_booking_id", uuid)
    .maybeSingle();
  if (byBooking) return byBooking;

  // 4) Legacy catering_orders.id
  const { data: byCatering } = await supabase
    .from("v2_events")
    .select("*")
    .eq("source_catering_id", uuid)
    .maybeSingle();
  if (byCatering) return byCatering;

  return null;
}