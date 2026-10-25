import { route } from "@/lib/api";
import { pendencies } from "@/lib/services/copilot";

export const GET = route(async ({ session }) => pendencies(session), { module: "teo" });
