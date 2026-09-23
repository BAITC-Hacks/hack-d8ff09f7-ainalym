export function transitDueDate(header) {
  const match = String(header ?? '').match(/поступление до\s+(\d{2})\.(\d{2})\.(\d{4})/i);
  if (!match) throw new Error(`Missing in-transit due date in header: ${header}`);
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error(`Invalid in-transit due date: ${header}`);
  return iso;
}
