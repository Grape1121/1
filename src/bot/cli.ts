/**
 * Chatbot-style CLI that drives the SAME core engine as the web app.
 * This is the proof that a Telegram/WhatsApp/WeChat bot can reuse everything:
 * it only swaps the I/O layer (readline here) for a messaging webhook.
 *
 * Run:  npm run bot
 */
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { buildPlan, getCategoryOptions } from "../lib/agent";
import type { CategoryRequest, Companion, Place, TripContext } from "../lib/types";

/**
 * A prompt helper that works both interactively (a real terminal) and when
 * stdin is piped (CI / scripted demos). readline/promises behaves
 * inconsistently with piped EOF, so for non-TTY we pre-read every line.
 */
function makeAsk() {
  if (input.isTTY) {
    const rl = readline.createInterface({ input, output });
    return {
      ask: (q: string) => rl.question(q),
      close: () => rl.close()
    };
  }
  const queued: string[] = [];
  let buf = "";
  let resolved = false;
  const ready = new Promise<void>((resolve) => {
    input.on("data", (d) => (buf += d.toString()));
    input.on("end", () => {
      buf.split(/\r?\n/).forEach((l) => queued.push(l));
      resolved = true;
      resolve();
    });
    // No stdin at all (e.g. /dev/null): resolve immediately.
    if (input.readableEnded) {
      resolved = true;
      resolve();
    }
  });
  return {
    ask: async (q: string) => {
      output.write(q);
      if (!resolved) await ready;
      const line = queued.shift() ?? "";
      output.write(line + "\n");
      return line;
    },
    close: () => {}
  };
}

const PRESETS: Record<string, CategoryRequest> = {
  froyo: { key: "froyo", label: "Froyo", query: "frozen yogurt" },
  coffee: { key: "coffee", label: "Coffee", query: "coffee shop" },
  dinner: { key: "dinner", label: "Dinner", query: "dinner restaurant" },
  bookstore: { key: "bookstore", label: "Bookstore", query: "bookstore" },
  dessert: { key: "dessert", label: "Dessert", query: "dessert" },
  bar: { key: "bar", label: "Bar", query: "cocktail bar" }
};

function stars(r: number) {
  return "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
}

async function main() {
  const { ask, close } = makeAsk();
  console.log("\n🗺️  Outing Planner (chat mode)\n");

  const location =
    (await ask("Where are you? (neighborhood / address / lat,lng)\n> ")) ||
    "Mission District, San Francisco";
  const companions = ((await ask(
    "Who's coming? [solo/friends/partner/family] (default partner)\n> "
  )) || "partner") as Companion;
  const catsRaw =
    (await ask(
      "Which stops, in order? (comma separated; options: " +
        Object.keys(PRESETS).join(", ") +
        ")\n> "
    )) || "froyo,coffee,dinner";

  const context: TripContext = { location, companions, time: "afternoon" };
  const categories = catsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((k) => PRESETS[k])
    .filter(Boolean);

  const chosen: Place[] = [];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    console.log(`\n— Stop ${i + 1}/${categories.length}: ${cat.label} —`);
    const { options, source } = await getCategoryOptions(cat, context, 3);
    console.log(`  (${source} data)\n`);
    options.slice(0, 3).forEach((p, idx) => {
      console.log(
        `  ${idx + 1}. ${p.name}  ${stars(p.rating)} ${p.rating.toFixed(1)} ` +
          `(${p.reviewCount} reviews) — ${Math.round(p.distanceMeters ?? 0)}m`
      );
      if (p.reviews[0]) console.log(`       "${p.reviews[0].text}"`);
    });
    const ans = await ask(`\n  Pick 1-3 (default 1): `);
    const idx = Math.min(2, Math.max(0, (parseInt(ans, 10) || 1) - 1));
    chosen.push(options[idx]);
  }

  const plan = buildPlan(context, chosen);
  console.log("\n✅  Your route:\n");
  plan.orderedPlaces.forEach((p, i) => {
    if (i > 0) {
      const leg = plan.legs[i];
      console.log(
        `      ↓ ${leg.distanceMeters}m, ~${Math.round(leg.durationSeconds / 60)} min`
      );
    }
    console.log(`  ${i + 1}. ${p.name} — ${p.address ?? ""}`);
  });
  console.log(
    `\n  Total: ${plan.totalDistanceMeters}m, ~${Math.round(
      plan.totalDurationSeconds / 60
    )} min travel`
  );
  console.log(`\n  Directions: ${plan.directionsUrl}\n`);

  close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
