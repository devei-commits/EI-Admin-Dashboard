/**
 * BPRPrintTemplate — Port of generateBPRPrintHTML from v15f.
 * Generates a printable BPR (Batch Packaging Record) document.
 * Sections: batch details, PM issue sheet, 8 packing operations, QC final release, sign-off.
 */
import React, { useRef } from 'react';
import { fmtNum } from '../../utils/manufacturing';

interface Props {
  bpr: any;
  onClose: () => void;
}

export default function BPRPrintTemplate({ bpr, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString('en-IN');

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>BPR ${bpr.docNo}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:20px}
        table{width:100%;border-collapse:collapse;margin-bottom:12px}
        th,td{border:1px solid #333;padding:5px 8px}th{background:#eee}
        .r{text-align:right}.fill{min-width:80px}
        .header{display:flex;justify-content:space-between;border:2px solid #000;padding:10px;margin-bottom:16px}
        .section{margin-bottom:14px}h3{margin:0 0 6px;font-size:12px;background:#ddd;padding:4px 8px}
        @media print{button{display:none}}
      </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const packingOps = [
    { step: 1, activity: 'Line clearance and cleaning verification', check: 'No remnants from previous batch' },
    { step: 2, activity: 'Set up filling machine as per batch size', check: 'Fill weight: ±2%' },
    { step: 3, activity: 'Bulk transfer from manufacturing to filling', check: 'Correct batch only' },
    { step: 4, activity: 'Filling & crimping (tube packs)', check: 'Net weight, seam check' },
    { step: 5, activity: 'Labeling — apply primary label', check: 'Batch no, mfg/exp date correct' },
    { step: 6, activity: 'Cartoning and secondary packing', check: 'Leaflet included' },
    { step: 7, activity: 'Shipper packing and palletizing', check: 'Count correct' },
    { step: 8, activity: 'Final count and handover to FG store', check: 'Signed delivery note' },
  ];

  const qcChecks = [
    { check: 'Label – Batch No.', spec: 'Matches BMR batch no.' },
    { check: 'Label – Mfg Date', spec: 'Current month/year' },
    { check: 'Label – Exp Date', spec: '24 months from mfg' },
    { check: 'Net Wt Check', spec: 'As per SKU ±2%' },
    { check: 'Carton count', spec: 'As per BPR planned' },
    { check: 'Yield %', spec: '95 – 103%' },
  ];

  const cellStyle: React.CSSProperties = { border: '1px solid #333', padding: '5px 8px' };
  const thStyle: React.CSSProperties = { ...cellStyle, background: '#eee', fontWeight: 'bold' };
  const fillStyle: React.CSSProperties = { ...cellStyle, minWidth: '80px' };
  const h3Style: React.CSSProperties = { margin: '0 0 6px', fontSize: '12px', background: '#ddd', padding: '4px 8px' };

  return (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">BPR Print Preview</h2>
            <p className="text-slate-300 text-sm">{bpr.docNo} · {bpr.batchNo}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Print
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* Print content */}
        <div className="flex-1 overflow-auto p-6">
          <div ref={printRef}>
            {/* Document header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', border: '2px solid #000', padding: '10px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0 }}>BATCH PACKAGING RECORD</h2>
                <div>BPR No: <b>{bpr.docNo}</b> &nbsp;&nbsp; Batch: <b>{bpr.batchNo}</b></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Product: <b>{bpr.product}</b></div>
                <div>SKU: {bpr.sku}</div>
                <div>Date: {today}</div>
              </div>
            </div>

            {/* Batch details */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={h3Style}>BATCH DETAILS</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Units to Pack</th>
                    <th style={thStyle}>Bulk Source BMR</th>
                    <th style={thStyle}>Filling Line</th>
                    <th style={thStyle}>Schedule Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={fillStyle}>{bpr.units}</td>
                    <td style={fillStyle}>{bpr.batchNo || ''}</td>
                    <td style={fillStyle}></td>
                    <td style={fillStyle}>{bpr.scheduleDate || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* PM Issue sheet */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={h3Style}>PACKING MATERIAL ISSUE SHEET</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Item Code</th>
                    <th style={thStyle}>Material Name</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Std Qty</th>
                    <th style={thStyle}>UOM</th>
                    <th style={{ ...thStyle, minWidth: '80px' }}>Actual Issued</th>
                    <th style={{ ...thStyle, minWidth: '80px' }}>Issued By</th>
                  </tr>
                </thead>
                <tbody>
                  {(bpr.pmLines || []).map((l: any, i: number) => (
                    <tr key={i}>
                      <td style={cellStyle}>{l.itemId}</td>
                      <td style={cellStyle}>{l.name}</td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>{fmtNum(l.required)}</td>
                      <td style={cellStyle}>{l.uom || 'pcs'}</td>
                      <td style={fillStyle}></td>
                      <td style={fillStyle}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Packing operations */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={h3Style}>PACKING OPERATIONS</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '30px' }}>Step</th>
                    <th style={thStyle}>Activity</th>
                    <th style={thStyle}>Check Point</th>
                    <th style={{ ...thStyle, minWidth: '80px' }}>Done</th>
                    <th style={{ ...thStyle, minWidth: '80px' }}>Time</th>
                    <th style={{ ...thStyle, minWidth: '80px' }}>Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {packingOps.map((op) => (
                    <tr key={op.step}>
                      <td style={cellStyle}>{op.step}</td>
                      <td style={cellStyle}>{op.activity}</td>
                      <td style={cellStyle}>{op.check}</td>
                      <td style={fillStyle}></td>
                      <td style={fillStyle}></td>
                      <td style={fillStyle}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* QC Final release */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={h3Style}>QC FINAL RELEASE (FG Spec)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Check</th>
                    {/* <th style={thStyle}>Specification</th> */}
                    <th style={{ ...thStyle, minWidth: '80px' }}>Result</th>
                    <th style={{ ...thStyle, minWidth: '80px' }}>Pass/Fail</th>
                    <th style={{ ...thStyle, minWidth: '80px' }}>QC Sign</th>
                  </tr>
                </thead>
                <tbody>
                  {qcChecks.map((c, i) => (
                    <tr key={i}>
                      <td style={cellStyle}>{c.check}</td>
                      {/* <td style={cellStyle}>{c.spec}</td> */}
                      <td style={fillStyle}></td>
                      <td style={fillStyle}></td>
                      <td style={fillStyle}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sign-off */}
            <div style={{ marginBottom: '14px' }}>
              <h3 style={h3Style}>SIGN-OFF</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <th style={thStyle}>Packing Supervisor</th>
                    <th style={thStyle}>QC Analyst</th>
                    <th style={thStyle}>QA Manager</th>
                  </tr>
                  <tr style={{ height: '50px' }}>
                    <td style={cellStyle}></td>
                    <td style={cellStyle}></td>
                    <td style={cellStyle}></td>
                  </tr>
                  <tr>
                    <th style={cellStyle}>Name &amp; Signature</th>
                    <th style={cellStyle}>Name &amp; Signature</th>
                    <th style={cellStyle}>Name &amp; Signature</th>
                  </tr>
                  <tr>
                    <td style={cellStyle}>Date: ___________</td>
                    <td style={cellStyle}>Date: ___________</td>
                    <td style={cellStyle}>Date: ___________</td>
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
