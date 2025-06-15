// /components/connections/GoogleSheetFields.tsx
'use client';

// ✨ 步驟 1: 導入所有需要的 UI 元件和圖示
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Zap,
  FileSpreadsheet,
  Database,
  Type,
  Info,
  Settings,
} from "lucide-react";


// --- 型別定義維持不變 ---
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
  
  // --- 所有 State 和 Hooks 維持不變 ---
  const [formState, setFormState] = useState<FormState>({
    sheet_id: '',
    tab_name: '',
    schema: [],
    date_column: null,
  });

  const [columnsInput, setColumnsInput] = useState('');

  const onConfigChangeRef = useRef(onConfigChange);
  useEffect(() => { onConfigChangeRef.current = onConfigChange; }, [onConfigChange]);
  
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
    if (!formState.sheet_id) return;

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

  useEffect(() => { onConfigChangeRef.current(formState); }, [formState]);
  
  // --- 事件處理函式維持不變 ---
  const handleTypeChange = (columnName: string, newType: string) => {
    setFormState(prev => ({ ...prev, schema: prev.schema.map(col => col.name === columnName ? { ...col, type: newType } : col) }));
  };

  const handleDateFieldChange = (columnName: string) => {
    setFormState(prev => ({ ...prev, date_column: columnName }));
  };
  
  // 稍作修改以適應新版 Input 的 onChange
  const handleFormStateChange = (field: keyof FormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };
  
  const handleColumnsInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setColumnsInput(e.target.value);
  }

  // --- ✨ 步驟 2: 使用新的 JSX 結構和樣式，但綁定到既有的狀態和函式 ---
  return (
    <div className="space-y-8">
      {/* Basic Configuration Card */}
      <div className="bg-gray-800/30 border border-orange-500/20 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-orange-400 mb-6 flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Google Sheets Configuration</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <Label className="text-white font-medium flex items-center space-x-2 mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-green-400" />
                    <span>Google Sheet ID</span>
                </Label>
                <Input
                    value={formState.sheet_id}
                    onChange={(e) => handleFormStateChange("sheet_id", e.target.value)}
                    placeholder="Enter Google Sheet ID"
                    className="bg-gray-900/50 border-gray-600/50"
                />
            </div>
            <div>
                <Label className="text-white font-medium flex items-center space-x-2 mb-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span>Tab Name (Sheet Name)</span>
                </Label>
                <Input
                    value={formState.tab_name}
                    onChange={(e) => handleFormStateChange("tab_name", e.target.value)}
                    placeholder="e.g., Sheet1"
                    className="bg-gray-900/50 border-gray-600/50"
                />
            </div>
        </div>
        <Alert className="mt-6 bg-blue-500/10 border-blue-500/30 text-blue-400">
            <Info className="h-4 w-4" />
            <AlertDescription>
                <strong>Important:</strong> Grant 'Editor' access to the service account email for this sheet.
            </AlertDescription>
        </Alert>
      </div>
      
      {/* Schema Configuration Card */}
      <div className="bg-gray-800/30 border border-orange-500/20 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-orange-400 mb-6 flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Schema Configuration</span>
          </h3>
          <div>
              <Label className="text-white font-medium flex items-center space-x-2 mb-2">
                  <Type className="w-4 h-4 text-purple-400" />
                  <span>Column Names</span>
              </Label>
              <Textarea
                  value={columnsInput}
                  onChange={handleColumnsInputChange}
                  placeholder="e.g., date, campaign_name, clicks, impressions"
                  className="bg-gray-900/50 border-gray-600/50 min-h-24"
              />
              <p className="text-gray-400 text-sm mt-2">
                  Enter column names separated by commas. Spaces will be converted to underscores.
              </p>
          </div>
      </div>

      {/* ✨ 步驟 3: 美化您喜歡的表格區塊，但保留其 UI/UX */}
      {formState.schema.length > 0 && (
        <div className="bg-gray-800/30 border border-orange-500/20 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-orange-400 mb-6">Define Column Types</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs text-orange-400 uppercase bg-gray-900/30">
                <tr>
                  <th scope="col" className="px-6 py-3">Column Name</th>
                  <th scope="col" className="px-6 py-3">Data Type</th>
                  <th scope="col" className="px-6 py-3 text-center">Date Field</th>
                </tr>
              </thead>
              <tbody>
                {formState.schema.map((col) => (
                  <tr key={col.name} className="border-b border-gray-700/50 hover:bg-orange-500/5">
                    <td className="px-6 py-4 font-mono text-white">{col.name}</td>
                    <td className="px-6 py-4">
                      <Select value={col.type} onValueChange={(value: string) => handleTypeChange(col.name, value)}>
                          <SelectTrigger className="bg-gray-800/50 border-gray-600/50 text-white min-w-36 h-9">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="STRING">String</SelectItem>
                              <SelectItem value="INTEGER">Integer</SelectItem>
                              <SelectItem value="FLOAT">Float</SelectItem>
                              <SelectItem value="BOOLEAN">Boolean</SelectItem>
                              <SelectItem value="DATE">Date</SelectItem>
                              <SelectItem value="TIMESTAMP">Timestamp</SelectItem>
                          </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <RadioGroup
                            value={formState.date_column || ""}
                            onValueChange={() => handleDateFieldChange(col.name)}
                            className="flex justify-center"
                        >
                            <RadioGroupItem value={col.name} id={`date-${col.name}`} className="border-orange-500/50 text-orange-500" />
                        </RadioGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}