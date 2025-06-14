// /components/connections/GoogleSheetFields.tsx
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';

type SchemaColumn = {
  name: string;
  type: string;
};

type FormState = {
  sheet_id: string;
  tab_name: string;
  schema: SchemaColumn[];
  date_column: string | null;
};

export default function GoogleSheetFields({ onConfigChange, initialConfig }: { onConfigChange: (config: object) => void; initialConfig?: any }) {
  
  const [formState, setFormState] = useState<FormState>({
    sheet_id: '',
    tab_name: '',
    schema: [],
    date_column: null,
  });

  const [columnsInput, setColumnsInput] = useState('');

  const onConfigChangeRef = useRef(onConfigChange);
  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);
  
  
  useEffect(() => {
    if (initialConfig?.sheet_id && !formState.sheet_id) {
      
      const initialSchema = initialConfig.schema?.columns || [];
      
      
      setFormState({
        sheet_id: initialConfig.sheet_id,
        tab_name: initialConfig.tab_name || '',
        schema: initialSchema,
        date_column: initialConfig.schema?.date_column || null,
      });

      
      if (initialSchema.length > 0) {
        setColumnsInput(initialSchema.map((col: SchemaColumn) => col.name).join(', '));
      }
    }
    
  }, [initialConfig, formState.sheet_id]);

  const derivedColumnNames = useMemo(() => {
    return columnsInput.split(',')
      .map(name => name.trim().replace(/ /g, '_'))
      .filter(Boolean);
  }, [columnsInput]);
  
  useEffect(() => {
    
    if (!formState.sheet_id) {
      return;
    }

    const currentColumnNames = formState.schema.map(c => c.name);
    if (JSON.stringify(currentColumnNames) !== JSON.stringify(derivedColumnNames)) {
      const newSchema = derivedColumnNames.map(name => {
        const existingColumn = formState.schema.find(col => col.name === name);
        return { name, type: existingColumn?.type || 'STRING' };
      });
      
      let newDateColumn = formState.date_column;
      if (newDateColumn && !derivedColumnNames.includes(newDateColumn)) {
        newDateColumn = derivedColumnNames.length > 0 ? derivedColumnNames[0] : null;
      }
      setFormState(prev => ({ ...prev, schema: newSchema, date_column: newDateColumn }));
    }
  }, [derivedColumnNames, formState.schema, formState.date_column, formState.sheet_id]);


  // 當 formState 變動時，將完整的 config 同步回父元件
  useEffect(() => {
    onConfigChangeRef.current(formState);
  }, [formState]);
  
  // --- 事件處理函式 ---
  const handleTypeChange = (columnName: string, newType: string) => {
    setFormState(prev => ({ ...prev, schema: prev.schema.map(col => col.name === columnName ? { ...col, type: newType } : col) }));
  };

  const handleDateFieldChange = (columnName: string) => {
    setFormState(prev => ({ ...prev, date_column: columnName }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormState(prev => ({ ...prev, [id]: value }));
  };
  
  const handleColumnsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColumnsInput(e.target.value);
  }

  // --- JSX ---
  return (
    <>
      <div className="mb-3">
        <label htmlFor="sheet_id" className="form-label">Google Sheet ID</label>
        <input id="sheet_id" value={formState.sheet_id} onChange={handleInputChange} className="form-control" />
      </div>
      <div className="mb-3">
        <label htmlFor="tab_name" className="form-label">Tab Name (Sheet Name)</label>
        <input id="tab_name" value={formState.tab_name} onChange={handleInputChange} className="form-control" />
      </div>
      <hr />
      <h5 className="mt-4">Schema Configuration</h5>
      <div className="mb-3">
        <label htmlFor="columns-input" className="form-label">Column Names</label>
        <input id="columns-input" value={columnsInput} onChange={handleColumnsInputChange} className="form-control" placeholder="e.g., date,campaign,clicks" />
        <div className="form-text">Enter your column names, separated by commas.</div>
      </div>
      
      {formState.schema.length > 0 && (
        <div className="card">
          <div className="card-header">Define Column Types</div>
          <div className="card-body">
            <table className="table table-sm">
              <thead>
                <tr><th>Column Name</th><th>Data Type</th><th className="text-center">Date Field</th></tr>
              </thead>
              <tbody>
                {formState.schema.map((col) => (
                  <tr key={col.name}>
                    <td>{col.name}</td>
                    <td>
                      <select value={col.type} onChange={(e) => handleTypeChange(col.name, e.target.value)} className="form-select form-select-sm">
                        <option value="STRING">String</option><option value="INTEGER">Integer</option><option value="FLOAT">Float</option><option value="BOOLEAN">Boolean</option><option value="DATE">Date</option><option value="TIMESTAMP">Timestamp</option>
                      </select>
                    </td>
                    <td className="text-center">
                      <input type="radio" name="date_column_selector" value={col.name} checked={formState.date_column === col.name} onChange={() => handleDateFieldChange(col.name)} className="form-check-input" />
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