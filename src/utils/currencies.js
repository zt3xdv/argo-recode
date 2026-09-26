const res = await fetch("https://api.frankfurter.dev/v2/currencies");

if (!res.ok) throw new Error(`Currencies API returned ${res.status}`);

const data = await res.json();

const currencies = (
  Array.isArray(data) ? data.map((c) => ({
    name: String(c.name ?? c.currency ?? ""),
    value: String(c.iso_code ?? c.code ?? c.currency ?? "").toUpperCase(),
  })) : Object.entries(data).map(([value, name]) => ({
    name: String(name),
    value: value.toUpperCase(),
  }))
).filter(({ name, value }) => name && value).sort((a, b) => a.name.localeCompare(b.name));

export { currencies };
