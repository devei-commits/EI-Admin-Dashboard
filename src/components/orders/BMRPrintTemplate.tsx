/**
 * BMRPrintTemplate — Port of generateBMRPrintHTML from v15f.
 * Generates a printable BMR document. Sections: batch details, RM dispensing sheet,
 * 6 manufacturing steps, batch specifications, sign-off.
 */
import React, { useRef } from 'react';
import { fmtNum } from '../../utils/manufacturing';

interface Props {
  bmr: any;
  onClose: () => void;
}

export default function BMRPrintTemplate({ bmr, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString('en-IN');

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>BMR ${bmr.docNo}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#000}
        table{width:100%;border-collapse:collapse;margin-bottom:12px}
        th,td{border:1px solid #333;padding:5px 8px}
        th{background:#eee;font-weight:bold}
        .r{text-align:right}.fill{min-width:80px}
        .header{display:flex;justify-content:space-between;border:2px solid #000;padding:10px;margin-bottom:16px}
        .section{margin-bottom:14px}
        h3{margin:0 0 6px;font-size:12px;background:#ddd;padding:4px 8px}
        @media print{button{display:none}}
      </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  // Prefer real batch data supplied by the caller; fall back to generic templates when absent.
  const mfgSteps = Array.isArray(bmr.mfgSteps) && bmr.mfgSteps.length ? bmr.mfgSteps : [
    { step: 1, desc: 'Add water to manufacturing vessel. Heat to 70-75°C', target: '70-75°C' },
    { step: 2, desc: 'Add RM phase A ingredients with slow mixing', target: 'As dispensed' },
    { step: 3, desc: 'Cool to 40°C. Add phase B ingredients', target: '40°C' },
    { step: 4, desc: 'Run homogenizer for specified time', target: 'Per SOP' },
    { step: 5, desc: 'pH adjustment and final QC checks', target: 'Per spec' },
    { step: 6, desc: 'Transfer to storage vessel / BPR staging area', target: '' },
  ];

  const batchSpecs = Array.isArray(bmr.batchSpecs) && bmr.batchSpecs.length ? bmr.batchSpecs : [
    { param: 'pH', spec: '5.0 – 6.5' },
    { param: 'Viscosity (cP)', spec: '4000 – 8000' },
    { param: 'Appearance', spec: 'White smooth cream' },
    { param: 'Yield %', spec: '95 – 103%' },
  ];

  return (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="bmr-print-title" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 id="bmr-print-title" className="text-xl font-bold">BMR Print Preview</h2>
            <p className="text-slate-300 text-sm">{bmr.docNo} · {bmr.batchNo}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Print
            </button>
            <button onClick={onClose} aria-label="Close" className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* Print content */}
        <div className="flex-1 overflow-auto p-6">
          <div ref={printRef}>
            {/* Document header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', border: '2px solid #000', padding: '10px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0 }}>BULK MANUFACTURING RECORD</h2>
                <div>BMR No: <b>{bmr.docNo}</b> &nbsp;&nbsp; Batch: <b>{bmr.batchNo}</b></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Product: <b>{bmr.product}</b></div>
                <div>SKU: {bmr.sku}</div>
                <div>Date: {today}</div>
              </div>
            </div>

            {/* Batch details */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '12px', background: '#ddd', padding: '4px 8px' }}>BATCH DETAILS</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Batch Size (Units)</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Bulk Qty (kg)</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Manufacturing Area</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Tank / Vessel</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Schedule Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{bmr.units}</td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{bmr.bulkKg}</td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{bmr.mfgArea || ''}</td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{bmr.tankId || ''}</td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{bmr.scheduleDate || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* RM Dispensing Sheet */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '12px', background: '#ddd', padding: '4px 8px' }}>RAW MATERIAL DISPENSING SHEET</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Item Code</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Material Name</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', textAlign: 'right' }}>Std Qty</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>UOM</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Actual Qty</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Dispensed By</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Checked By</th>
                  </tr>
                </thead>
                <tbody>
                  {(bmr.rmLines || []).map((l: any, i: number) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{l.itemId}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{l.name}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', textAlign: 'right' }}>{fmtNum(l.required)}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{l.uom || 'kg'}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Manufacturing steps */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '12px', background: '#ddd', padding: '4px 8px' }}>MANUFACTURING STEPS (Fill in sequence)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', width: '30px' }}>Step</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Description</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Target</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Actual</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Time</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {mfgSteps.map((s) => (
                    <tr key={s.step}>
                      <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{s.step}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{s.desc}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{s.target}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Batch specifications */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '12px', background: '#ddd', padding: '4px 8px' }}>BATCH SPECIFICATIONS (To be filled by QC)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Parameter</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Specification</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Result</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Pass/Fail</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee', minWidth: '80px' }}>Analyst</th>
                  </tr>
                </thead>
                <tbody>
                  {batchSpecs.map((s, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{s.param}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{s.spec}</td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                      <td style={{ border: '1px solid #333', padding: '5px 8px', minWidth: '80px' }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sign-off */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '12px', background: '#ddd', padding: '4px 8px' }}>SIGN-OFF</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>Production Supervisor</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>QC Analyst</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px', background: '#eee' }}>QA Manager</th>
                  </tr>
                  <tr style={{ height: '50px' }}>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}></td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}></td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}></td>
                  </tr>
                  <tr>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px' }}>Name &amp; Signature</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px' }}>Name &amp; Signature</th>
                    <th scope="col" style={{ border: '1px solid #333', padding: '5px 8px' }}>Name &amp; Signature</th>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}>Date: ___________</td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}>Date: ___________</td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px' }}>Date: ___________</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
