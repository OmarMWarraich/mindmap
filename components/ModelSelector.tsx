'use client';

import { groupModelsByProvider } from '../lib/model/group-models';
import type { PublicModel } from '../lib/model/public-catalog';

interface ModelSelectorProps {
  models: PublicModel[];
  value: string | undefined;
  onChange: (modelId: string) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function ModelSelector({
  models,
  value,
  onChange,
  id,
  label,
  disabled = false,
  loading = false,
  placeholder = 'Select a model',
  className,
}: ModelSelectorProps) {
  const groups = groupModelsByProvider(models);
  const isEmpty = !loading && groups.length === 0;
  const isDisabled = disabled || loading || isEmpty;

  const statusText = loading
    ? 'Loading models…'
    : isEmpty
      ? 'No models available'
      : placeholder;

  return (
    <div className={`grid gap-1${className ? ` ${className}` : ''}`}>
      {label ? (
        <label className="text-xs font-medium text-zinc-500" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          aria-label={label ?? 'Model'}
          className="w-full appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm text-zinc-900 shadow-sm transition hover:border-zinc-300 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
          disabled={isDisabled}
          id={id}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          value={value ?? ''}
        >
          <option disabled value="">
            {statusText}
          </option>
          {groups.map((group) => (
            <optgroup key={group.provider} label={group.label}>
              {group.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-400"
        >
          <ChevronDownIcon />
        </span>
      </div>
    </div>
  );
}
