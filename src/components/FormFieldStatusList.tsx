'use client';

import type { FormFieldMapping } from '@/lib/formTypes';
import { humanizeProfileKey } from '@/lib/profileKeys';

interface Props {
  formFields: FormFieldMapping[];
}

function sourceLabel(field: FormFieldMapping) {
  if (field.matchStatus === 'needs_review') return 'Needs review';
  if (field.matchStatus === 'missing') return field.isOptional ? 'Optional missing' : 'Required missing';
  return field.valueSource === 'user_input' ? 'User input' : 'Database';
}

function sourceClass(field: FormFieldMapping) {
  if (field.matchStatus === 'needs_review') return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  if (field.matchStatus === 'missing') return 'border-red-500/20 bg-red-500/10 text-red-200';
  return field.valueSource === 'user_input'
    ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'
    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
}

export default function FormFieldStatusList({ formFields }: Props) {
  if (formFields.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-6 shadow-2xl">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-xl font-semibold text-white tracking-tight">Current field object</h3>
          <p className="text-sm text-neutral-400">Every detected field now carries an ID, match state, and eventual fill point.</p>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <p>{formFields.length} fields tracked</p>
        </div>
      </div>

      <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1">
        {formFields.map((field) => (
          <div
            key={field.fieldId}
            className="rounded-2xl border border-white/8 bg-black/30 px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-white font-medium">{field.detectedLabel}</p>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                  {field.isOptional ? 'Optional' : 'Required'}
                </span>
              </div>
              <p className="text-xs text-neutral-500">ID: {field.fieldId}</p>
              <p className="text-sm text-neutral-300">Canonical key: {humanizeProfileKey(field.canonicalKey)}</p>
              <p className="text-xs text-neutral-500">
                Label box: {Math.round(field.labelBox.x)}, {Math.round(field.labelBox.y)} / {Math.round(field.labelBox.width)} x{' '}
                {Math.round(field.labelBox.height)}
              </p>
              {field.fillPoint ? (
                <p className="text-xs text-neutral-500">
                  Fill point: {Math.round(field.fillPoint.x)}, {Math.round(field.fillPoint.y)} ({field.fillPointSource})
                </p>
              ) : null}
            </div>

            <div className="lg:text-right space-y-2">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs ${sourceClass(field)}`}>
                {sourceLabel(field)}
              </div>
              {field.value ? (
                <p className="text-sm text-neutral-200 max-w-md break-words">{field.value}</p>
              ) : (
                <p className="text-sm text-neutral-500">No resolved value yet</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
