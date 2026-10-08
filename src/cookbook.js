// Recipes from the owner's printed cookbook. The book is copyrighted, so its
// recipes are not part of this public repository: they live in the database
// (table cookbook, migration 0011) as gzipped JSON, loaded there with
// scripts/import-cookbook.mjs from the owner's private copy. Without them the
// cookbook is simply empty.
let database = null;
let cache = null;
let emptyUntil = 0;
const EMPTY = { recipes: [], page_aliases: {} };
// A cookbook not imported yet is looked for again after a minute.
const EMPTY_RETRY_MS = 60_000;

// The worker hands over its database on each request and cron run; the recipes
// loaded once stay for the life of the isolate.
export function useCookbookDatabase(db) {
  if (db) database = db;
}
export function _resetCookbookForTest() { database = null; cache = null; emptyUntil = 0; }

async function unpack(base64) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

export async function getCookbook() {
  if (cache) return cache;
  if (!database || Date.now() < emptyUntil) return EMPTY;
  let row = null;
  try { row = await database.prepare("SELECT data FROM cookbook WHERE id = 1").first(); }
  catch (error) { if (!/no such table/i.test(String(error?.message))) throw error; }
  if (!row?.data) { emptyUntil = Date.now() + EMPTY_RETRY_MS; return EMPTY; }
  cache = await unpack(row.data);
  return cache;
}

export async function getCookbookRecipeByPage(page) {
  const n = Number(page);
  if (!Number.isInteger(n)) return null;
  const data = await getCookbook();
  const direct = data.recipes.find(recipe => recipe.page === n);
  if (direct) return { ...direct, requested_page: n, page_match: "direct" };
  const canonicalPage = data.page_aliases?.[String(n)];
  if (canonicalPage != null) {
    const recipe = data.recipes.find(r => r.page === Number(canonicalPage));
    if (recipe) return { ...recipe, requested_page: n, page_match: "continuation" };
  }
  return null;
}
