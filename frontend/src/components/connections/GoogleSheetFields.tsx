// /components/connections/GoogleSheetFields.tsx
'use client';
import { useState, useEffect, useMemo } from 'react';

type SchemaColumn = { name: string; type: string; };

export default function GoogleSheetFields({ onConfigChange }: { onConfigChange: (config: object) => void; }) {
  const [sheetId, setSheetId] = useState('');
  const [tabName, setTabName] = useState('');
  const [columnsInput, setColumnsInput] = useState('');
  const [schema, setSchema] = useState<SchemaColumn[]>([]);
  const [dateField, setDateField] = useState<string | null>(null);

  const columnNames = useMemo(() => {
    return columnsInput.split(',')
      .map(name => name.trim().replace(/ /g, '_'))
      .filter(Boolean);
  }, [columnsInput]);
  
  useEffect(() => {
    const newSchema = columnNames.map(name => ({ name, type: 'STRING' }));
    setSchema(newSchema);
    if (columnNames.length > 0 && !columnNames.includes(dateField || '')) {
      setDateField(columnNames[0]);
    } else if (columnNames.length === 0) {
      setDateField(null);
    }
  }, [columnNames, dateField]);

  useEffect(() => {
    onConfigChange({
      sheet_id: sheetId,
      tab_name: tabName,
      // ✨ 這裡的 key 必須與後端 `forms.py` 的 `clean_columns_config` 期望的 key 一致
      schema: { 
        columns: schema,
        date_column: dateField,
      }
    });
  }, [sheetId, tabName, schema, dateField, onConfigChange]);

  const handleTypeChange = (columnName: string, newType: string) => {
    setSchema(prevSchema =>
      prevSchema.map(col =>
        col.name === columnName ? { ...col, type: newType } : col
      )
    );
  };

  return (
    <>
      <div className="mb-3">
        <label htmlFor="sheet_id" className="form-label">Google Sheet ID</label>
        <input id="sheet_id" value={sheetId} onChange={(e) => setSheetId(e.target.value)} className="form-control" />
      </div>
      <div className="mb-3">
        <label htmlFor="tab_name" className="form-label">Tab Name (Sheet Name)</label>
        <input id="tab_name" value={tabName} onChange={(e) => setTabName(e.target.value)} className="form-control" />
      </div>
      <hr />
      <h5 className="mt-4">Schema Configuration</h5>
      <div className="mb-3">
        <label htmlFor="columns-input" className="form-label">Column Names</label>
        <input id="columns-input" value={columnsInput} onChange={(e) => setColumnsInput(e.target.value)} className="form-control" placeholder="e.g., date,campaign,clicks" />
        <div className="form-text">Enter your column names, separated by commas.</div>
      </div>
      
      {columnNames.length > 0 && (
        <div className="card">
          <div className="card-header">Define Column Types</div>
          <div className="card-body">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Column Name</th><th>Data Type</th><th className="text-center">Date Field</th>
                </tr>
              </thead>
              <tbody>
                {schema.map((col) => (
                  <tr key={col.name}>
                    <td>{col.name}</td>
                    <td>
                      <select value={col.type} onChange={(e) => handleTypeChange(col.name, e.target.value)} className="form-select form-select-sm">
                        <option value="STRING">String</option><option value="INTEGER">Integer</option>
                        <option value="FLOAT">Float</option><option value="BOOLEAN">Boolean</option>
                        <option value="DATE">Date</option><option value="TIMESTAMP">Timestamp</option>
                      </select>
                    </td>
                    <td className="text-center">
                      <input type="radio" name="date_column_selector" value={col.name} checked={dateField === col.name} onChange={() => setDateField(col.name)} className="form-check-input"/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}