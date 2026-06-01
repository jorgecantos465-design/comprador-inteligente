import type { Alias, PriceList, PurchaseItem, Supplier } from "./types";

export const LOCAL_SESSION_KEY = "comprador-inteligente.session.v1";

export interface LocalSession {
  suppliers: Supplier[];
  lists: PriceList[];
  aliases: Alias[];
  items: PurchaseItem[];
}

export interface LocalSessionResult {
  session?: LocalSession;
  error?: string;
}

export function loadLocalSession(storage: Storage): LocalSessionResult {
  try {
    const raw = storage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<LocalSession>;
    if (![parsed.suppliers, parsed.lists, parsed.aliases, parsed.items].every(Array.isArray)) {
      return { error: "No se pudo restaurar la sesión guardada. Los datos locales no tienen un formato válido." };
    }
    return { session: parsed as LocalSession };
  } catch {
    return { error: "No se pudo acceder al guardado local de este navegador." };
  }
}

export function saveLocalSession(storage: Storage, session: LocalSession): string | undefined {
  try {
    storage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
    return undefined;
  } catch {
    return "No se pudo guardar la sesión local en este navegador.";
  }
}

export function clearLocalSession(storage: Storage): string | undefined {
  try {
    storage.removeItem(LOCAL_SESSION_KEY);
    return undefined;
  } catch {
    return "No se pudo borrar la sesión guardada en este navegador.";
  }
}
