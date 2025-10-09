import type { ContextOptions, ContextProvider } from "./BaseContextProvider.js";
import { CurrentFileProvider } from "./CurrentFileProvider.js";
import { SelectionProvider } from "./SelectionProvider.js";
import { OpenFilesProvider } from "./OpenFilesProvider.js";
import { SearchProvider } from "./SearchProvider.js";

export async function gatherContext(opts: ContextOptions = {}) {
  const providers: ContextProvider[] = [];
  providers.push(new CurrentFileProvider());        // no VS Code deps in stub
  if (opts.includeSelection) providers.push(new SelectionProvider());
  if (opts.includeOpenFiles) providers.push(new OpenFilesProvider());
  if (opts.includeSearch) providers.push(new SearchProvider(opts.includeSearch));

  const slices = (await Promise.all(providers.map((p) => p.get()))).filter(
    (x): x is NonNullable<typeof x> => !!x
  );
  return { slices } as { slices: Array<{ name: string; data: any }> };
}
