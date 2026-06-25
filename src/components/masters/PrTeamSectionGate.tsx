import type { ReactNode } from 'react';

type PrTeamSectionGateProps = {
  canEdit: boolean;
  viewOnlyLabel?: string;
  children: ReactNode;
  className?: string;
};

/** Disables child inputs when the current PR team role may not edit this subsection. */
export function PrTeamSectionGate({
  canEdit,
  viewOnlyLabel = 'View only — this section is assigned to another team.',
  children,
  className = '',
}: PrTeamSectionGateProps): JSX.Element {
  return (
    <div className={className}>
      {!canEdit ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          {viewOnlyLabel}
        </p>
      ) : null}
      <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0 m-0 disabled:opacity-90">
        {children}
      </fieldset>
    </div>
  );
}
