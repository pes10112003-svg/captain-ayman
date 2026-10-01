"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Ruler, Save } from "lucide-react";
import { addMeasurementsAction, createMeasurementTypeAction } from "@/server/actions/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import type { MeasurementKind } from "@/lib/units";
import { useI18n } from "@/i18n/client";
import { measureTypeLabel } from "@/i18n/labels";

export type TypeOption = { id: string; key: string; name: string; kind: MeasurementKind; unit: string; isSystem: boolean };

export function MeasurementDialog({
  clientId,
  types,
  weightUnit,
  lengthUnit,
  today,
  defaultOpen,
}: {
  clientId: string;
  types: TypeOption[];
  weightUnit: string;
  lengthUnit: string;
  today: string;
  defaultOpen?: boolean;
}) {
  const { t, f, fmt } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(!!defaultOpen);
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unitFor = (ty: TypeOption) => (ty.kind === "mass" ? weightUnit : ty.kind === "length" ? lengthUnit : ty.unit);

  const submit = () => {
    const entries = Object.entries(values)
      .filter(([, v]) => v.trim() !== "")
      .map(([typeId, v]) => ({ typeId, value: Number(v) }));
    if (!entries.length) return setError(t.measureForm.errNone);
    if (entries.some((e) => !Number.isFinite(e.value) || e.value <= 0)) return setError(t.measureForm.errPositive);
    setError(null);
    start(async () => {
      const res = await addMeasurementsAction(clientId, { measuredOn: date, note: note || null, values: entries });
      if (!res.ok) return setError(res.error);
      toast.success(f(t.measureForm.saved, { n: fmt.num(res.data.count, 0) }));
      setValues({});
      setNote("");
      setOpen(false);
      router.replace(`/coach/clients/${clientId}/progress`, { scroll: false });
      router.refresh();
    });
  };

  const groups: { title: string; list: TypeOption[] }[] = [
    { title: t.measureForm.groupBody, list: types.filter((ty) => ty.isSystem && ["weight", "height", "body_fat", "muscle_mass", "bmi"].includes(ty.key)) },
    { title: t.measureForm.groupTape, list: types.filter((ty) => ty.isSystem && !["weight", "height", "body_fat", "muscle_mass", "bmi"].includes(ty.key)) },
    { title: t.measureForm.groupCustom, list: types.filter((ty) => !ty.isSystem) },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Ruler /> {t.progress.addMeasurements}
        </Button>
      </DialogTrigger>
      <DialogContent title={t.measureForm.title} description={t.measureForm.subtitle} size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.measureForm.date} htmlFor="m-date">
              <Input id="m-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t.measureForm.note} htmlFor="m-note" optional>
              <Input id="m-note" value={note} maxLength={500} placeholder={t.measureForm.notePh} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          {groups
            .filter((g) => g.list.length)
            .map((g) => (
              <fieldset key={g.title}>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {g.list.map((ty) => (
                    <Field key={ty.id} label={measureTypeLabel(t, ty)} htmlFor={`m-${ty.id}`} hint={ty.key === "bmi" ? t.measureForm.bmiHint : undefined}>
                      <UnitInput
                        id={`m-${ty.id}`}
                        unit={fmt.unit(unitFor(ty))}
                        type="number"
                        step="0.1"
                        min={0}
                        value={values[ty.id] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [ty.id]: e.target.value }))}
                      />
                    </Field>
                  ))}
                </div>
              </fieldset>
            ))}
          <NewTypeInline onCreated={() => router.refresh()} />
          {error ? (
            <p className="rounded-xl bg-crit-soft px-3 py-2 text-sm text-crit-text" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
            <Button onClick={submit} loading={pending}>
              {!pending ? <Save /> : null} {t.measureForm.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewTypeInline({ onCreated }: { onCreated: () => void }) {
  const { t, f } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MeasurementKind>("length");
  const [unit, setUnit] = useState("");
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <Plus className="size-4" /> {t.measureForm.newType}
      </button>
    );
  return (
    <div className="grid gap-3 rounded-xl border border-dashed border-line-strong p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <Field label={t.measureForm.typeName}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.measureForm.typeNamePh} maxLength={60} />
      </Field>
      <Field label={t.measureForm.typeKind}>
        <Select value={kind} onChange={(e) => setKind(e.target.value as MeasurementKind)}>
          <option value="length">{t.measureForm.kindLength}</option>
          <option value="mass">{t.measureForm.kindMass}</option>
          <option value="percent">{t.measureForm.kindPercent}</option>
          <option value="other">{t.measureForm.kindOther}</option>
        </Select>
      </Field>
      {kind === "other" ? (
        <Field label={t.measureForm.unit}>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t.measureForm.unitPh} maxLength={16} className="w-24" />
        </Field>
      ) : (
        <span />
      )}
      <Button
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await createMeasurementTypeAction({ name, kind, unit: kind === "other" ? unit : "x" });
            if (!res.ok) return void toast.error(res.error);
            toast.success(f(t.measureForm.typeCreated, { name: res.data.name }));
            setName("");
            setOpen(false);
            onCreated();
          })
        }
      >
        {t.common.create}
      </Button>
    </div>
  );
}
