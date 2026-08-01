import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCustomization, fetchCustomizations, type CreateCustomizationPayload, type CustomizationRow } from '../services/customizations.service';

type CareType = 'Skin care' | 'Hair care';

function parseBulkBlocks(rawText: string, care: CareType): CreateCustomizationPayload[] {
  const blocks = rawText
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const parsed = blocks
    .map((block) => {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) return null;

      const name = lines[0];
      const tailCategory = lines.length >= 2 ? lines[lines.length - 2] : '';
      const tailIndication = lines.length >= 1 ? lines[lines.length - 1] : '';
      const tailColor = lines.length >= 3 ? lines[lines.length - 3] : '';

      const activeLines = lines.length > 3 ? lines.slice(0, -3) : lines.slice(0, 1);
      const activeComposition = activeLines.reduce<Record<string, string>>((acc, line, idx) => {
        acc[`active_${idx + 1}`] = line;
        return acc;
      }, {});

      return {
        name,
        care,
        category: tailCategory || 'General',
        indications: tailIndication || '',
        description: `Auto-imported from dashboard bulk input (${care})`,
        specifications: tailColor ? { Color: tailColor } : {},
        active_composition: activeComposition,
      } satisfies CreateCustomizationPayload;
    });

  return parsed.filter((x) => x !== null) as CreateCustomizationPayload[];
}

const CustomizationCatalog = () => {
  const [rows, setRows] = useState<CustomizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [care, setCare] = useState<CareType>('Skin care');
  const [bulkText, setBulkText] = useState('');
  const [single, setSingle] = useState({
    name: '',
    category: '',
    indications: '',
    color: '',
    activeComposition: '',
  });
  const [message, setMessage] = useState<string>('');

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, row) => {
      const key = `${row.care || 'Unknown'} > ${row.category || 'Uncategorized'}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [rows]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchCustomizations();
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load customizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSingleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      await createCustomization({
        name: single.name.trim(),
        care,
        category: single.category.trim(),
        indications: single.indications.trim(),
        description: `Created from admin dashboard (${care})`,
        specifications: single.color.trim() ? { Color: single.color.trim() } : {},
        active_composition: single.activeComposition.trim()
          ? { active_1: single.activeComposition.trim() }
          : {},
      });
      setSingle({ name: '', category: '', indications: '', color: '', activeComposition: '' });
      await load();
      setMessage('Customization added successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create customization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkCreate = async () => {
    const payloads = parseBulkBlocks(bulkText, care);
    if (payloads.length === 0) {
      setMessage('No valid blocks found in pasted text.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      for (const payload of payloads) {
        await createCustomization(payload);
      }
      setBulkText('');
      await load();
      setMessage(`Imported ${payloads.length} customization blocks.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bulk import failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Customization Catalog</h1>
        <div className="flex items-center gap-2 mt-2 text-sm bg-gray-100 px-4 py-2 rounded-lg">
          <Link to="/" className="text-slate-800 hover:text-amber-800 hover:underline">Dashboard</Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">Customization Catalog</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Care Type</label>
          <select
            value={care}
            onChange={(e) => setCare(e.target.value as CareType)}
            className="w-full sm:w-52 px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="Skin care">Skin care</option>
            <option value="Hair care">Hair care</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <form onSubmit={handleSingleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Add Single Entry</h2>
          <input
            value={single.name}
            onChange={(e) => setSingle((s) => ({ ...s, name: e.target.value }))}
            placeholder="Name (e.g. CERAMIDES)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            value={single.activeComposition}
            onChange={(e) => setSingle((s) => ({ ...s, activeComposition: e.target.value }))}
            placeholder="Main active composition"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            value={single.color}
            onChange={(e) => setSingle((s) => ({ ...s, color: e.target.value }))}
            placeholder="Color / appearance"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            value={single.category}
            onChange={(e) => setSingle((s) => ({ ...s, category: e.target.value }))}
            placeholder="Category (e.g. FACE SERUM)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            value={single.indications}
            onChange={(e) => setSingle((s) => ({ ...s, indications: e.target.value }))}
            placeholder="Indications (e.g. AGEING SKIN)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Create Entry'}
          </button>
        </form>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Bulk Add (Paste Blocks)</h2>
          <p className="text-xs text-gray-500">
            Paste multi-line blocks separated by a blank line. Last 3 lines are interpreted as Color, Category, Indications.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={14}
            placeholder="CERAMIDES&#10;SODIUM PCA&#10;VITAMIN B5&#10;RICH WHITE CREAM&#10;FACE MOISTURISER&#10;DRY SKIN"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
          />
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleBulkCreate()}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-60"
          >
            {submitting ? 'Importing...' : 'Import Blocks'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Existing Entries</h2>
          <button type="button" onClick={() => void load()} className="text-sm text-slate-700 hover:underline">
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-3">Total: {rows.length}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
              {Object.entries(grouped).map(([k, count]) => (
                <div key={k} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium">{k}</span> <span className="text-gray-500">({count})</span>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th scope="col" className="py-2 pr-3">ID</th>
                    <th scope="col" className="py-2 pr-3">Name</th>
                    <th scope="col" className="py-2 pr-3">Care</th>
                    <th scope="col" className="py-2 pr-3">Category</th>
                    <th scope="col" className="py-2 pr-3">Indications</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((row) => (
                    <tr key={row.custom_id} className="border-b border-gray-100">
                      <td className="py-2 pr-3">{row.custom_id}</td>
                      <td className="py-2 pr-3">{row.name || '-'}</td>
                      <td className="py-2 pr-3">{row.care || '-'}</td>
                      <td className="py-2 pr-3">{row.category || '-'}</td>
                      <td className="py-2 pr-3">{row.indications || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomizationCatalog;
