"use client";
import React from "react";

export interface WorkflowStage {
  role: string;
  label: string;
  desc: string;
  blocking: boolean;
  required?: boolean;
  enabled?: boolean;
}

export interface BudgetItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export const DEFAULT_WORKFLOW_STAGES: WorkflowStage[] = [
  { role: 'hod',      label: 'HOD',             desc: 'Head of Dept — matched by dept + campus',     blocking: true, required: true,  enabled: true },
  { role: 'dean',     label: 'Dean',             desc: 'Dean of School — matched by school + campus', blocking: true, required: true,  enabled: true },
  { role: 'cfo',      label: 'CFO / Campus Dir', desc: 'Finance & campus oversight',                  blocking: true, required: false, enabled: false },
  { role: 'accounts', label: 'Finance Officer',  desc: 'Accounts Office — matched by campus',         blocking: true, required: false, enabled: false },
];

export interface ApprovalsWorkflowBuilderProps {
  organizingSchool?: string;
  organizingDept?: string;
  /** 'fest' (default) renders fest-specific action buttons; 'event' omits them and calls onChange on every state change. */
  context?: 'fest' | 'event';
  /** Fired on every stages/budget change when context === 'event'. */
  onChange?: (stages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  // Fest-specific props (only used when context === 'fest')
  festId?: string | null;
  approvalExists?: boolean | null;
  isSubmitting?: boolean;
  isUpdatingFest?: boolean;
  initialStages?: WorkflowStage[];
  initialBudgetItems?: BudgetItem[];
  onSubmitForApproval?: (customStages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  onUpdateWorkflow?: (customStages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  onUpdateFest?: () => void;
  onBackToDetails?: () => void;
}

export function ApprovalsWorkflowBuilder({
  organizingSchool,
  organizingDept,
  context = 'fest',
  onChange,
  festId,
  approvalExists,
  isSubmitting = false,
  isUpdatingFest = false,
  initialStages,
  initialBudgetItems,
  onSubmitForApproval,
  onUpdateWorkflow,
  onUpdateFest,
  onBackToDetails,
}: ApprovalsWorkflowBuilderProps) {
  const [stages, setStages] = React.useState<WorkflowStage[]>(initialStages && initialStages.length > 0 ? initialStages : DEFAULT_WORKFLOW_STAGES);
  const [draggedRole, setDraggedRole] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{
    role: string | null;
    position: 'before' | 'after';
    section: 'pre' | 'post';
  } | null>(null);
  const [budgetItems, setBudgetItems] = React.useState<BudgetItem[]>(initialBudgetItems ?? []);

  React.useEffect(() => {
    if (initialStages && initialStages.length > 0) {
      setStages(initialStages);
    }
  }, [initialStages]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (initialBudgetItems && initialBudgetItems.length > 0) {
      setBudgetItems(initialBudgetItems.map(b => ({ ...b, id: b.id || crypto.randomUUID() })));
    }
  }, [initialBudgetItems]);

  // Notify parent on every change when used in event context
  React.useEffect(() => {
    if (context === 'event') {
      onChange?.(stages.filter(s => s.required || s.enabled !== false), budgetItems);
    }
  }, [stages, budgetItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfoEnabled  = stages.find(s => s.role === 'cfo')?.enabled !== false;
  const needsBudget = stages.some(s => (s.role === 'cfo' || s.role === 'accounts') && s.enabled !== false);

  function toggleStage(role: string, enabled: boolean) {
    setStages(prev => {
      let updated = prev.map(s => s.role === role ? { ...s, enabled } : s);
      if (role === 'cfo' && enabled) {
        updated = updated.map(s => s.role === 'accounts' ? { ...s, enabled: true } : s);
      }
      return updated;
    });
  }

  function addBudgetRow() {
    setBudgetItems(prev => [...prev, { id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeBudgetRow(id: string) {
    setBudgetItems(prev => prev.filter(b => b.id !== id));
  }

  function updateBudgetRow(id: string, field: keyof Omit<BudgetItem, 'id'>, value: string) {
    setBudgetItems(prev => prev.map(b => {
      if (b.id !== id) return b;
      if (field === 'name') return { ...b, name: value };
      const num = parseFloat(value) || 0;
      return { ...b, [field]: num };
    }));
  }

  const budgetTotal = budgetItems.reduce((sum, b) => sum + b.quantity * b.unitPrice, 0);

  const preLiveStages  = stages.filter(s => s.blocking);
  const postLiveStages = stages.filter(s => !s.blocking);

  const isPreLiveOnly = (role: string) => role === 'hod' || role === 'dean';

  function handleDragStart(e: React.DragEvent, role: string) {
    setDraggedRole(role);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', role);
  }

  function handleDragOverItem(e: React.DragEvent, role: string, section: 'pre' | 'post') {
    e.stopPropagation();
    if (draggedRole && isPreLiveOnly(draggedRole) && section === 'post') return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropTarget({ role, position, section });
  }

  function handleDropOnItem(e: React.DragEvent, targetRole: string, targetSection: 'pre' | 'post') {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedRole || !dropTarget) return;
    if (isPreLiveOnly(draggedRole) && targetSection === 'post') { setDraggedRole(null); setDropTarget(null); return; }
    const sourceStage = stages.find(s => s.role === draggedRole);
    if (!sourceStage || draggedRole === targetRole) { setDraggedRole(null); setDropTarget(null); return; }
    const targetBlocking = targetSection === 'pre';
    const withoutDragged = stages.filter(s => s.role !== draggedRole);
    const targetIdx = withoutDragged.findIndex(s => s.role === targetRole);
    if (targetIdx === -1) { setDraggedRole(null); setDropTarget(null); return; }
    const insertAt = dropTarget.position === 'after' ? targetIdx + 1 : targetIdx;
    const spliced = [
      ...withoutDragged.slice(0, insertAt),
      { ...sourceStage, blocking: targetBlocking },
      ...withoutDragged.slice(insertAt),
    ];
    setStages([...spliced.filter(s => s.blocking), ...spliced.filter(s => !s.blocking)]);
    setDraggedRole(null);
    setDropTarget(null);
  }

  function handleDragOverEmpty(e: React.DragEvent, section: 'pre' | 'post') {
    if (draggedRole && isPreLiveOnly(draggedRole) && section === 'post') return;
    e.preventDefault();
    setDropTarget({ role: null, position: 'after', section });
  }

  function handleDropOnEmpty(e: React.DragEvent, section: 'pre' | 'post') {
    e.preventDefault();
    if (!draggedRole) return;
    if (isPreLiveOnly(draggedRole) && section === 'post') return;
    const sourceStage = stages.find(s => s.role === draggedRole);
    if (!sourceStage) return;
    const targetBlocking = section === 'pre';
    const updated = stages.map(s => s.role === draggedRole ? { ...s, blocking: targetBlocking } : s);
    setStages([...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)]);
    setDraggedRole(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDraggedRole(null);
    setDropTarget(null);
  }

  function moveToPostLive(role: string) {
    setStages(prev => {
      const updated = prev.map(s => s.role === role ? { ...s, blocking: false } : s);
      return [...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)];
    });
  }

  function moveToPreLive(role: string) {
    setStages(prev => {
      const updated = prev.map(s => s.role === role ? { ...s, blocking: true } : s);
      return [...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)];
    });
  }

  function renderSectionList(sectionStages: WorkflowStage[], section: 'pre' | 'post', emptyText: string) {
    const accentColor = section === 'pre' ? '#3b82f6' : '#a855f7';
    const isEmpty = sectionStages.length === 0;
    const isEmptyDropTarget = dropTarget?.section === section && dropTarget?.role === null;
    return (
      <div
        className={`min-h-[60px] space-y-0.5 rounded-lg transition-colors ${isEmptyDropTarget ? 'bg-blue-50/50' : ''}`}
        onDragOver={(e) => isEmpty && handleDragOverEmpty(e, section)}
        onDrop={(e) => isEmpty && handleDropOnEmpty(e, section)}
        onDragLeave={(e) => {
          if (isEmpty && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            setDropTarget(null);
          }
        }}
      >
        {isEmpty ? (
          <div className={`border-2 border-dashed rounded-lg p-4 text-center text-xs transition-colors ${
            isEmptyDropTarget ? 'border-blue-400 text-blue-500 bg-blue-50' : 'border-gray-200 text-gray-400'
          }`}>
            {emptyText}
          </div>
        ) : (
          sectionStages.map((s, i) => {
            const isDragging = draggedRole === s.role;
            const isDropBefore = dropTarget?.role === s.role && dropTarget.position === 'before';
            const isDropAfter  = dropTarget?.role === s.role && dropTarget.position === 'after';
            const isLocked = s.role === 'accounts' && cfoEnabled;
            return (
              <div key={s.role}>
                <div className={`h-0.5 rounded-full mx-1 transition-all ${isDropBefore ? 'mb-1' : 'mb-0 bg-transparent'}`}
                  style={isDropBefore ? { backgroundColor: accentColor } : {}} />

                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, s.role)}
                  onDragOver={(e) => handleDragOverItem(e, s.role, section)}
                  onDrop={(e) => handleDropOnItem(e, s.role, section)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 bg-white cursor-grab active:cursor-grabbing select-none transition-all ${
                    isDragging ? 'opacity-30 scale-[0.98]' : 'opacity-100'
                  } border-gray-200 hover:border-gray-300 hover:shadow-sm`}
                >
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                  </svg>

                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    section === 'pre' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {i + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{s.label}</p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {s.required ? (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium select-none">
                        Required
                      </span>
                    ) : (
                      <label
                        className={`relative inline-flex items-center ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        title={isLocked ? 'Finance Officer is locked ON while CFO is enabled' : 'Toggle this approval on/off'}
                      >
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={s.enabled !== false}
                          disabled={isLocked}
                          onChange={() => !isLocked && toggleStage(s.role, s.enabled === false)}
                        />
                        <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#154CB3]" />
                      </label>
                    )}
                    {!s.required && (
                      <button
                        type="button"
                        title={section === 'pre' ? 'Move to Post-Live' : 'Move to Pre-Live'}
                        onClick={() => section === 'pre' ? moveToPostLive(s.role) : moveToPreLive(s.role)}
                        className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-1 py-0.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        {section === 'pre' ? '↓' : '↑'}
                      </button>
                    )}
                  </div>
                </div>

                <div className={`h-0.5 rounded-full mx-1 transition-all ${isDropAfter ? 'mt-1' : 'mt-0 bg-transparent'}`}
                  style={isDropAfter ? { backgroundColor: accentColor } : {}} />
              </div>
            );
          })
        )}
      </div>
    );
  }

  const itemLabel = context === 'event' ? 'event' : 'fest';

  return (
    <div className="p-6 sm:p-8 md:p-10">
      <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-1">Approvals</h2>
      <p className="text-sm text-gray-500 mb-6">
        Drag to reorder stages. HOD and Dean are mandatory. CFO and Finance Officer can be toggled off if not required.
      </p>

      {organizingSchool && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
          <span className="text-sm text-blue-800">
            <span className="font-semibold">School:</span> {organizingSchool}
            {organizingDept && <span className="text-blue-600"> · {organizingDept}</span>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Pre-Live Section */}
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <h3 className="text-sm font-bold text-blue-800">Stage 1 — Pre-Live</h3>
            <span className="text-xs text-blue-500 ml-auto">Blocks publishing</span>
          </div>
          <p className="text-xs text-blue-600 mb-3">
            These approvals must complete before your {itemLabel} goes live.
          </p>
          {renderSectionList(preLiveStages, 'pre', 'Drag stages here to require approval before going live')}
        </div>

        {/* Post-Live Section */}
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <h3 className="text-sm font-bold text-purple-800">Stage 2 — Post-Live</h3>
            <span className="text-xs text-purple-500 ml-auto">Operational</span>
          </div>
          <p className="text-xs text-purple-600 mb-3">
            These run in parallel after the {itemLabel} is live.
          </p>
          {renderSectionList(postLiveStages, 'post', 'Drag stages here for post-live operational tasks')}
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6 text-xs text-amber-800">
        <span className="font-semibold">Routing:</span> HOD is auto-assigned by dept + campus · Dean by school + campus · CFO & Finance by campus. Use ↓/↑ to move between sections.
      </div>

      {needsBudget && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-800">Budget Estimate</h3>
            <span className="text-xs text-gray-500">Required for CFO / Finance review</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            List your expected expenses. This is submitted with the approval request.
          </p>

          <div className="grid grid-cols-[1fr_72px_96px_88px_32px] gap-2 mb-1 px-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Item</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center">Qty</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Unit (₹)</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Total (₹)</span>
            <span />
          </div>

          <div className="space-y-2">
            {budgetItems.map(b => (
              <div key={b.id} className="grid grid-cols-[1fr_72px_96px_88px_32px] gap-2 items-center">
                <input
                  type="text"
                  placeholder="e.g. Sound system rental"
                  value={b.name}
                  onChange={e => updateBudgetRow(b.id, 'name', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <input
                  type="number"
                  min="1"
                  value={b.quantity}
                  onChange={e => updateBudgetRow(b.id, 'quantity', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={b.unitPrice}
                  onChange={e => updateBudgetRow(b.id, 'unitPrice', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <span className="text-sm text-gray-700 text-right tabular-nums">
                  {(b.quantity * b.unitPrice).toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  onClick={() => removeBudgetRow(b.id)}
                  className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-base leading-none"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}

            {budgetItems.length === 0 && (
              <div className="text-center py-5 text-sm text-gray-400 border border-dashed border-gray-200 rounded">
                No items added yet.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={addBudgetRow}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              + Add item
            </button>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">Total estimate</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">₹{budgetTotal.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer action buttons — fest context only */}
      {context !== 'event' && (
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onBackToDetails}
            className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            ← Back to Fest Details
          </button>

          {onUpdateFest && (
            <button
              type="button"
              onClick={onUpdateFest}
              disabled={isUpdatingFest || isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUpdatingFest && (
                <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isUpdatingFest ? 'Saving...' : 'Update Fest'}
            </button>
          )}

          {approvalExists ? (
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <button
                type="button"
                onClick={() => onUpdateWorkflow?.(stages.filter(s => s.required || s.enabled !== false), budgetItems)}
                disabled={isSubmitting || !festId}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-md hover:bg-[#0f3a7a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isSubmitting ? 'Saving...' : 'Update Workflow'}
              </button>
              <a
                href={`/approvals/${festId}?type=fest`}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors text-center"
              >
                View Approval Status
              </a>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSubmitForApproval?.(stages.filter(s => s.required || s.enabled !== false), budgetItems)}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-md hover:bg-[#0f3a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ApprovalsWorkflowBuilder;
