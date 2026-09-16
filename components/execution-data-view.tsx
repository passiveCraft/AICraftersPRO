'use client';

import { useEffect, useMemo, useState } from 'react';
import { Braces, Check, Clock3, Copy, Table2, X } from 'lucide-react';
import type { ExecutionDetail } from '@/lib/n8n-types';

function duration(value: number | null) {
  return value === null ? 'Unavailable' : value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
}

function cell(value: unknown) {
  if (value === null) return <span className="data-null">null</span>;
  if (value === undefined) return <span className="data-null">—</span>;
  if (typeof value === 'object') return <code>{JSON.stringify(value)}</code>;
  if (typeof value === 'boolean') return <span className="data-boolean">{String(value)}</span>;
  return String(value);
}

export function ExecutionDataView({ detail }: { detail: ExecutionDetail }) {
  const [selectedStepName, setSelectedStepName] = useState('');
  const [dataSide, setDataSide] = useState<'output' | 'input'>('output');
  const [format, setFormat] = useState<'table' | 'json'>('table');
  const [copied, setCopied] = useState(false);
  const selectedStep = detail.steps.find((step) => step.name === selectedStepName) || detail.steps.find((step) => step.name === detail.lastNode) || detail.steps.at(-1);
  const stepIndex = selectedStep ? detail.steps.indexOf(selectedStep) : -1;
  const input = stepIndex > 0 ? detail.steps[stepIndex - 1]?.output : undefined;
  const selectedData = dataSide === 'output' ? selectedStep?.output : input;
  const items = useMemo(() => Array.isArray(selectedData) ? selectedData : selectedData === undefined ? [] : [selectedData], [selectedData]);
  const columns = useMemo(() => [...new Set(items.flatMap((item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.keys(item as Record<string, unknown>) : ['value']))].slice(0, 10), [items]);
  useEffect(() => {
    setSelectedStepName(detail.lastNode || detail.steps.at(-1)?.name || '');
    setDataSide('output');
    setCopied(false);
  }, [detail.id]);
  async function copyData() {
    if (selectedData === undefined) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedData, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* Clipboard availability depends on the browser context. */ }
  }
  return <div className="execution-data-shell">
    <aside className="execution-step-list" aria-label="Execution steps">
      <span>EXECUTION DATA</span>
      {detail.steps.map((step, index) => <button key={`${step.name}-${index}`} className={step.name === selectedStep?.name ? 'selected' : ''} onClick={() => { setSelectedStepName(step.name); setDataSide('output'); }}>
        <i className={step.status}>{step.status === 'success' ? <Check size={13} /> : step.status === 'error' ? <X size={13} /> : <Clock3 size={13} />}</i>
        <div><strong>{step.name}</strong><small>{step.status} · {duration(step.durationMs)}</small></div>
        {step.output && <em>{Array.isArray(step.output) ? step.output.length : 1}</em>}
      </button>)}
    </aside>
    <section className="execution-data-view" aria-live="polite">
      <header><div><span>{selectedStep?.name || 'Execution output'}</span><small>{items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : 'No reported items'}</small></div><div className="data-actions"><button aria-pressed={format === 'table'} onClick={() => setFormat('table')}><Table2 size={15} /> Table</button><button aria-pressed={format === 'json'} onClick={() => setFormat('json')}><Braces size={15} /> JSON</button><button disabled={selectedData === undefined} onClick={() => void copyData()}><Copy size={15} /> {copied ? 'Copied' : 'Copy'}</button></div></header>
      <nav className="execution-data-tabs" aria-label="Data direction"><button className={dataSide === 'input' ? 'active' : ''} disabled={input === undefined} onClick={() => setDataSide('input')}>Input</button><button className={dataSide === 'output' ? 'active' : ''} disabled={selectedStep?.output === undefined} onClick={() => setDataSide('output')}>Output</button></nav>
      {selectedData === undefined ? <div className="execution-empty-data"><strong>No {dataSide} data was reported</strong><span>{dataSide === 'input' ? 'This is the workflow entry step, or n8n did not retain input data.' : 'This step did not emit any items.'}</span></div> : format === 'json' ? <pre className="execution-json">{JSON.stringify(selectedData, null, 2)}</pre> : <div className="execution-table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{items.map((item, index) => { const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : { value: item }; return <tr key={index}>{columns.map(column => <td key={column}>{cell(record[column])}</td>)}</tr>; })}</tbody></table></div>}
    </section>
  </div>;
}
