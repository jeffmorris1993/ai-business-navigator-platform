// Which fictional sample files to offer in each upload spot (derived from the example-company presets).
import { PRESETS, presetFor, type SampleFile } from "./presets";
export type { SampleFile };

export const SAMPLE_FILES = Object.fromEntries(PRESETS.map((p) => [p.slug, p.files])) as Record<string, (typeof PRESETS)[number]["files"]>;

export const ALL_SAMPLES: SampleFile[] = PRESETS.flatMap((p) =>
  [...(p.files.sales ?? []), ...(p.files.salesUpdate ?? []), ...(p.files.invoices ?? []), ...(p.files.payments ?? []), ...(p.files.expenses ?? [])].map((f) => ({ file: f.file, label: `${p.name}: ${f.label}` })),
);

export function samplesFor(slug: string | null, kind: "sales" | "salesUpdate" | "invoices" | "expenses" | "payments"): SampleFile[] {
  return presetFor(slug)?.files[kind] ?? [];
}
