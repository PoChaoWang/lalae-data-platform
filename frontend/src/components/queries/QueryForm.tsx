// QueryForm.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch'; // 確保這是 ShadCN 的 Switch
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Check,
  Search,
  DatabaseZap,
  Table,
  Plus,
  ChevronDown,
  ChevronRight,
  Play,
  Send,
  Save,
  AlertCircle,
  Calendar,
  Target,
  Code,
  Settings,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { SelectableClient } from '@/lib/definitions';
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';

import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-tomorrow_night';
import 'ace-builds/src-noconflict/ext-language_tools'; 

interface QueryFormProps {
  client: SelectableClient; 
  initialData?: {
    displayName: string;
    config: {
      sql_query: string;
      schedule_type: 'ONCE' | 'PERIODIC'; 
      cron_schedule: string | null; 
      output_target: 'NONE' | 'GOOGLE_SHEET' | 'LOOKER_STUDIO';
      sheetId?: string;
      tabName?: string;
      appendMode?: boolean;
      email?: string;
    };
  } | null;
  queryId?: number | null;
}

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function QueryForm({ client, initialData, queryId }: QueryFormProps) {
  const { protectedFetch } = useProtectedFetch();
  const aceEditorRef = useRef<any>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const localStorageKey = queryId ? `query_draft_${queryId}` : 'query_draft_new';

  const getInitialState = useCallback(() => {
    if (typeof window !== 'undefined') {
      const savedDraft = localStorage.getItem(localStorageKey);
      if (savedDraft) {
        try {
          const parsedDraft = JSON.parse(savedDraft);
          // 這裡可以做一些數據驗證，確保 parsedDraft 結構正確
          // 如果 initialData 存在，且與 savedDraft 的 queryName 相同，則優先使用 savedDraft
          if (initialData && parsedDraft.queryName === initialData.displayName) {
             return parsedDraft;
          } else if (!initialData) { // 如果是新建查詢頁面，直接用 savedDraft
             return parsedDraft;
          }
        } catch (e) {
          console.error("Failed to parse saved draft from localStorage:", e);
          localStorage.removeItem(localStorageKey); // 清除無效的儲存
        }
      }
    }
    // 如果沒有 localStorage 數據，或者解析失敗，則返回 initialData 的值
    // 注意：這裡需要將 initialData 的 cron_schedule 和 output_target 轉換為組件內部狀態的格式
    if (initialData) {
      const config = initialData.config;
      let freq = 'Once';
      let hr = 9;
      let min = 0;
      let days: number[] = [];
      let dom = 1;

      if (config.schedule_type === 'PERIODIC' && config.cron_schedule) {
        const cronParts = config.cron_schedule.split(' ');
        if (cronParts.length === 5) {
          const [minutePart, hourPart, dayOfMonthPart, monthPart, dayOfWeekPart] = cronParts;
          min = parseInt(minutePart, 10);
          hr = parseInt(hourPart, 10);

          if (dayOfWeekPart !== '*' && dayOfMonthPart === '*') { // Weekly
            freq = 'Weekly';
            const convertedDays = dayOfWeekPart.split(',').map(Number).map(d => d === 0 ? 6 : d - 1); // 將 0 (Sunday) 轉換為 6
            days = convertedDays;
          } else if (dayOfMonthPart !== '*' && dayOfWeekPart === '*') { // Monthly
            freq = 'Monthly';
            dom = parseInt(dayOfMonthPart, 10);
          } else if (dayOfMonthPart === '*' && dayOfWeekPart === '*') { // Daily
            freq = 'Daily';
          }
        }
      }

      let outType = 'None';
      let sId = '';
      let tName = '';
      let appMode = false;
      let eml = '';

      if (config.output_target === 'GOOGLE_SHEET') {
        outType = 'Google Sheets';
        sId = config.sheetId || '';
        tName = config.tabName || '';
        appMode = config.appendMode || false;
      } else if (config.output_target === 'LOOKER_STUDIO') {
        outType = 'Google Looker Studio';
        eml = config.email || '';
      }

      return {
        queryName: initialData.displayName,
        sqlQuery: config.sql_query,
        frequency: freq,
        hour: hr,
        minute: min,
        selectedDays: days,
        dayOfMonth: dom,
        output_target: outType,
        sheetId: sId,
        tabName: tName,
        appendMode: appMode,
        email: eml,
      };
    }
    // 全新的表單
    return {
      queryName: '',
      sqlQuery: '',
      frequency: 'Once',
      hour: 9,
      minute: 0,
      selectedDays: [],
      dayOfMonth: 1,
      output_target: 'None',
      sheetId: '',
      tabName: '',
      appendMode: false,
      email: '',
    };
  }, [initialData, localStorageKey]);

  const [queryName, setQueryName] = useState(getInitialState().queryName);
  const [sqlQuery, setSqlQuery] = useState(getInitialState().sqlQuery);
  const [expandedTables, setExpandedTables] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [frequency, setFrequency] = useState(getInitialState().frequency);
  const [hour, setHour] = useState(getInitialState().hour);
  const [minute, setMinute] = useState(getInitialState().minute);
  const [selectedDays, setSelectedDays] = useState<number[]>(getInitialState().selectedDays);
  const [dayOfMonth, setDayOfMonth] = useState(getInitialState().dayOfMonth);
  const [output_target, setOutputType] = useState(getInitialState().output_target);
  const [sheetId, setSheetId] = useState(getInitialState().sheetId);
  const [tabName, setTabName] = useState(getInitialState().tabName);
  const [appendMode, setAppendMode] = useState(getInitialState().appendMode);
  const [email, setEmail] = useState(getInitialState().email);


  const [isLoading, setIsLoading] = useState(false);
  const [schema, setSchema] = useState<{ name: string; columns: { name: string; type: string }[] }[]>([]);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<string[][] | null>(null);
  const [previewColumns, setPreviewColumns] = useState<string[] | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);  

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentFormState = {
        queryName,
        sqlQuery,
        frequency,
        hour,
        minute,
        selectedDays,
        dayOfMonth,
        output_target,
        sheetId,
        tabName,
        appendMode,
        email,
      };
      localStorage.setItem(localStorageKey, JSON.stringify(currentFormState));
    }
  }, [
    queryName, sqlQuery, frequency, hour, minute, selectedDays, dayOfMonth,
    output_target, sheetId, tabName, appendMode, email, localStorageKey
  ]);

  // useEffect(() => {
  //   if (initialData?.config) {
  //     setSqlQuery(initialData.config.sql_query);
  //     setOutputType(initialData.config.output_target === 'GOOGLE_SHEET' ? 'Google Sheets' :
  //                   initialData.config.output_target === 'LOOKER_STUDIO' ? 'Google Looker Studio' : 'None');

  //     if (initialData.config.output_target === 'GOOGLE_SHEET') {
  //       setSheetId(initialData.config.sheetId || '');
  //       setTabName(initialData.config.tabName || 'Sheet1');
  //       setAppendMode(initialData.config.appendMode || false);
  //     } else if (initialData.config.output_target === 'LOOKER_STUDIO') {
  //       setEmail(initialData.config.email || '');
  //     }

  //     if (initialData.config.schedule_type === 'PERIODIC' && initialData.config.cron_schedule) {
  //       const cronParts = initialData.config.cron_schedule.split(' ');
  //       if (cronParts.length === 5) {
  //         const [minutePart, hourPart, dayOfMonthPart, monthPart, dayOfWeekPart] = cronParts;

  //         setMinute(parseInt(minutePart, 10));
  //         setHour(parseInt(hourPart, 10));

  //         if (dayOfWeekPart !== '*' && dayOfMonthPart === '*') { // Weekly
  //           setFrequency('Weekly');
  //           const days = dayOfWeekPart.split(',').map(Number);
  //           const convertedDays = days.map(d => d === 0 ? 6 : d - 1); // 將 0 (Sunday) 轉換為 6
  //           setSelectedDays(convertedDays);
  //         } else if (dayOfMonthPart !== '*' && dayOfWeekPart === '*') { // Monthly
  //           setFrequency('Monthly');
  //           setDayOfMonth(parseInt(dayOfMonthPart, 10));
  //         } else if (dayOfMonthPart === '*' && dayOfWeekPart === '*') { // Daily
  //           setFrequency('Daily');
  //         }
  //       }
  //     } else { // ONCE
  //       setFrequency('Once');
  //     }
  //   }
  // }, [initialData]);

  useEffect(() => {
    const fetchSchema = async () => {
      if (!client || !client.bigquery_dataset_id || !protectedFetch) return;

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await protectedFetch(
          `${NEXT_PUBLIC_TO_BACKEND_URL}/queries/dataset-tables/?dataset_id=${client.bigquery_dataset_id}`
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch schema.');
        }
        const data = await response.json();
        setSchema(data.tables || []);
      } catch (error: any) {
        setErrorMessage(`Failed to load schema: ${error.message}`);
        console.error('Failed to load schema:', error);
        setSchema([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchema();
  }, [client, protectedFetch]);

  // Ace Editor Auto-Complete and insert
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ace) {
      const ace = (window as any).ace;
      const langTools = ace.require('ace/ext/language_tools');

      // 自定義完成器
      const customCompleter = {
        getCompletions: (editor: any, session: any, pos: any, prefix: any, callback: any) => {
          const completions: any[] = [];

          // 基礎 SQL 關鍵字 (Ace 內建的已經不錯，但可以手動添加)
          // 這些會自動被 ace/mode/sql 處理，但如果需要額外關鍵字，可以在這裡添加
          // const sqlKeywords = ["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "LIMIT", "JOIN", "ON", "AND", "OR", "AS", "DISTINCT", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM"];
          // sqlKeywords.forEach(keyword => {
          //   if (keyword.toLowerCase().startsWith(prefix.toLowerCase())) {
          //     completions.push({ caption: keyword, value: keyword, meta: "Keyword" });
          //   }
          // });

          // 加入表格名稱
          schema.forEach(table => {
            if (table.name.toLowerCase().includes(prefix.toLowerCase())) { // 模糊匹配
              completions.push({
                caption: table.name,
                value: `\`${table.name}\``, // BigQuery 使用反引號
                meta: "Table",
                score: 1000 // 較高分數使其優先顯示
              });
            }
          });

          // 加入欄位名稱
          // 這裡可以做更聰明的判斷，例如只在 FROM/JOIN 子句後提示表格，在 SELECT/WHERE 後提示欄位
          // 為了簡化範例，這裡提供所有已展開表格的欄位，或者所有表格的欄位
          schema.forEach(table => {
            // 如果表格是展開的，或者前綴很短，則顯示所有相關欄位
            const shouldShowColumns = expandedTables.includes(table.name) || prefix.length < 3;
            if (shouldShowColumns) {
              table.columns.forEach(column => {
                if (column.name.toLowerCase().includes(prefix.toLowerCase())) { // 模糊匹配
                  completions.push({
                    caption: column.name,
                    value: `\`${column.name}\``, // BigQuery 使用反引號
                    meta: `Column (${column.type})`,
                    score: 900 // 次高分數
                  });
                }
              });
            }
          });

          callback(null, completions);
        }
      };

      // 設置完成器，保留原有的，並加入自定義的
      langTools.setCompleters([langTools.snippetCompleter, langTools.textCompleter, langTools.keyWordCompleter, customCompleter]);
    }
  }, [schema, expandedTables]);

  const filteredTables = schema.filter((table) =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) =>
      prev.includes(tableName) ? prev.filter((name) => name !== tableName) : [...prev, tableName]
    );
  };

  const insertIntoQuery = (text: string) => {
    const editor = aceEditorRef.current?.editor;
    if (editor) {
      editor.insert(text);
      editor.focus();
    }
  };

  if (typeof window !== 'undefined') {
    (window as any).insertTableName = function(tableName: string) {
        insertIntoQuery(`\`${tableName}\` `);
    };
    (window as any).insertColumnName = function(columnName: string) {
        insertIntoQuery(`\`${columnName}\` `);
    };
  }

  const buildCronSchedule = () => {
    let cronMinute = minute;
    let cronHour = hour;
    let cronDayOfMonth = '*';
    let cronMonth = '*';
    let cronDayOfWeek = '*';

    if (frequency === 'Daily') {
      // 每天在指定的小時和分鐘運行
      cronDayOfMonth = '*';
      cronMonth = '*';
      cronDayOfWeek = '*';
    } else if (frequency === 'Weekly') {
      // 每週在指定的星期幾和小時分鐘運行
      // 將我們的 0=Monday, ..., 6=Sunday 轉換為 cron 的 0=Sunday, ..., 6=Saturday
      const convertedDays = selectedDays.map(d => (d === 6 ? 0 : d + 1));
      cronDayOfWeek = convertedDays.length > 0 ? convertedDays.sort((a, b) => a - b).join(',') : '*';
      cronDayOfMonth = '*';
      cronMonth = '*';
    } else if (frequency === 'Monthly') {
      // 每月在指定的日期和小時分鐘運行
      cronDayOfMonth = dayOfMonth.toString();
      cronMonth = '*';
      cronDayOfWeek = '*';
    } else { // Once 或其他未定義的頻率
      return null; // 不生成 cron_schedule
    }

    return `${cronMinute} ${cronHour} ${cronDayOfMonth} ${cronMonth} ${cronDayOfWeek}`;
  };

  const handleTest = async () => {
    if (!protectedFetch) return;
    if (!queryName.trim()) {
      setErrorMessage('Query name cannot be empty.');
      return;
    }
    if (!sqlQuery.trim()) {
      setErrorMessage('SQL query cannot be empty.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setTestMessage(null);
    setTestSuccess(false);
    setPreviewData(null);
    setPreviewColumns(null);

    try {
      const checkNameRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/check-query-name/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: queryName, bigquery_dataset_id: client.bigquery_dataset_id }),
      });

      if (!checkNameRes.ok) {
        const errorData = await checkNameRes.json();
        throw new Error(errorData.error || 'Failed to check query name availability.');
      }
      const checkNameData = await checkNameRes.json();
      if (!checkNameData.is_available && queryName !== initialData?.displayName) {
        setErrorMessage('A query with this name already exists in this dataset. Please choose a different name.');
        setIsLoading(false);
        return;
      }

      const testRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/test-query/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql_query: sqlQuery, dataset_id: client.bigquery_dataset_id }),
      });

      if (!testRes.ok) {
        const errorData = await testRes.json();
        console.log('Test res:', testRes);
        console.log('Test query error:', errorData);
        throw new Error(errorData.error_message || 'Query test failed.');
      }

      const testData = await testRes.json();
      setTestSuccess(true);
      setTestMessage(`Query syntax is valid. Estimated bytes processed: ${testData.estimated_bytes_processed} bytes.`);
      setPreviewData(testData.preview_data);
      setPreviewColumns(testData.columns);
    } catch (error: any) {
      setTestSuccess(false);
      setErrorMessage(`Test failed: ${error.message}`);
      console.error('Test query error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAndSave = async () => {
    if (!protectedFetch) return;
    if (!testSuccess) {
      setErrorMessage('Please successfully test the query before sending and saving.');
      return;
    }
    if (!queryName.trim()) {
        setErrorMessage('Query name cannot be empty.');
        return;
    }
    if (!sqlQuery.trim()) {
        setErrorMessage('SQL query cannot be empty.');
        return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setTestMessage(null);

    const cronSchedule = buildCronSchedule();

    // 構建 payload
    const payload: { [key: string]: any } = {
      name: queryName,
      sql_query: sqlQuery,
      bigquery_dataset_id: client.bigquery_dataset_id,
      schedule_type: frequency === 'Once' ? 'ONCE' : 'PERIODIC', // 轉換為後端期望的 'ONCE'/'PERIODIC'
      cron_schedule: cronSchedule, // 將構建的 cron_schedule 傳遞
      is_test_passed: true,
      output_target: output_target === 'Google Sheets' ? 'GOOGLE_SHEET' :
                     output_target === 'Google Looker Studio' ? 'LOOKER_STUDIO' : 'NONE', // 轉換為後端期望的格式
    };

    // 處理輸出相關參數 (直接在 payload 中傳遞，讓後端組裝 output_config JSON)
    if (output_target === 'Google Sheets') {
      payload.sheetId = sheetId; 
      payload.tabName = tabName; 
      payload.appendMode = appendMode; 
      payload.email = null; 
    } else if (output_target === 'Google Looker Studio') {
      payload.email = email;
      payload.sheetId = null; 
      payload.tabName = null; 
      payload.appendMode = null; 
    } else {
      payload.sheetId = null;
      payload.tabName = null;
      payload.appendMode = null;
      payload.email = null;
    }
    console.log('Payload:', payload)

    try {
      const runRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/run-query/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!runRes.ok) {
        const errorData = await runRes.json();
        throw new Error(errorData.error || 'Failed to run and save query.');
      }
      console.log('Run res:', runRes)
      const runData = await runRes.json();
      setTestSuccess(false); // 重置測試成功狀態
      setTestMessage(runData.message || 'Query sent and saved successfully!');
      console.log('Query sent and saved successfully:', runData);
      router.push('/queries'); // 導航回查詢列表頁
    } catch (error: any) {
      setErrorMessage(`Send & Save failed: ${error.message}`);
      console.error('Send & Save error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!protectedFetch) return;
    if (!queryName.trim()) {
      setErrorMessage('Query name cannot be empty.');
      return;
    }
    if (!sqlQuery.trim()) {
      setErrorMessage('SQL query cannot be empty.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setTestMessage(null);

    const cronSchedule = buildCronSchedule();

    const payload: { [key: string]: any } = {
      name: queryName,
      sql_query: sqlQuery,
      bigquery_dataset_id: client.bigquery_dataset_id,
      schedule_type: frequency === 'Once' ? 'ONCE' : 'PERIODIC', // 轉換
      cron_schedule: cronSchedule, // 傳遞
      output_target: output_target === 'Google Sheets' ? 'GOOGLE_SHEET' :
                     output_target === 'Google Looker Studio' ? 'LOOKER_STUDIO' : 'NONE', // 轉換
  };

  if (output_target === 'Google Sheets') {
      payload.sheetId = sheetId;
      payload.tabName = tabName;
      payload.appendMode = appendMode;
      payload.email = null;
  } else if (output_target === 'Google Looker Studio') {
      payload.email = email;
      payload.sheetId = null;
      payload.tabName = null;
      payload.appendMode = null;
  } else {
      payload.sheetId = null;
      payload.tabName = null;
      payload.appendMode = null;
      payload.email = null;
  }

  try {
    const saveRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/save-draft/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!saveRes.ok) {
      const errorData = await saveRes.json();
      throw new Error(errorData.error || 'Failed to save draft.');
    }

    setTestMessage('Query draft saved successfully!');
    router.push('/queries');
  } catch (error: any) {
    setErrorMessage(`Save Draft failed: ${error.message}`);
    console.error('Save draft error:', error);
  } finally {
    setIsLoading(false);
  }
};

  const getDataTypeColor = (type: string) => {
    const colors = {
      INTEGER: 'text-blue-400',
      STRING: 'text-green-400',
      FLOAT: 'text-purple-400',
      TIMESTAMP: 'text-orange-400',
      DATE: 'text-yellow-400',
    };
    return colors[type as keyof typeof colors] || 'text-gray-400';
  };

  // --- 拖動調整大小的邏輯 ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    let newWidth = e.clientX - containerRect.left;

    const minWidth = 200;
    const maxWidth = containerRect.width * 0.5; // 限制最大為容器寬度的一半

    if (newWidth < minWidth) {
      newWidth = minWidth;
    } else if (newWidth > maxWidth) {
      newWidth = maxWidth;
    }

    setLeftPanelWidth(newWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // 當開始拖動時，設置 body 的 cursor 樣式為 'col-resize'
      document.body.style.cursor = 'col-resize';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // 停止拖動時，恢復 body 的 cursor 樣式
      document.body.style.cursor = 'default';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default'; // 清理效果
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);


  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-[700px] bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden ${isResizing ? 'cursor-col-resize' : ''}`}
    >
      {/* 左側面板：Schema Explorer */}
      {!isSidebarCollapsed ? (
        <div
          ref={leftPanelRef}
          style={{ width: `${leftPanelWidth}px` }}
          className="flex-shrink-0 bg-gray-800/30 backdrop-blur-sm border-r border-orange-500/20 p-6 overflow-y-auto h-full custom-scrollbar transition-all duration-300 ease-in-out"
        >
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-4"> {/* 新增的 Flexbox 容器 */}
              <div className="relative flex-grow"> {/* 讓 search bar 佔據可用空間 */}
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search tables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              {/* 收起側邊欄的按鈕 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarCollapsed(true)}
                className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 transition-colors duration-300 w-9 h-9 rounded-full flex-shrink-0" // 調整大小並防止收縮
                title="Collapse Schema Panel"
              >
                <PanelLeftClose className="h-10 w-10" /> {/* 圖標大小 */}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {isLoading && schema.length === 0 ? (
              <div className="text-gray-400 text-center">Loading schema...</div>
            ) : errorMessage && schema.length === 0 ? (
              <div className="text-red-400 text-center flex items-center justify-center space-x-2">
                <AlertCircle className="w-5 h-5" />
                <span>Error loading schema: {errorMessage}</span>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="text-gray-400 text-center">No tables found.</div>
            ) : (
              filteredTables.map((table) => (
                <div key={table.name} className="border border-gray-700/50 rounded-lg overflow-hidden">
                  <Collapsible open={expandedTables.includes(table.name)} onOpenChange={() => toggleTable(table.name)}>
                    <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors duration-300 group">
                      <div className="flex items-center space-x-3">
                        {expandedTables.includes(table.name) ? (
                          <ChevronDown className="w-6 h-6 text-orange-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-orange-400 flex-shrink-0" />
                        )}
                        <Table className="w-6 h-6 text-orange-400 flex-shrink-0" />
                        <span className="text-white font-medium font-mono">{table.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          insertIntoQuery(`\`${table.name}\` `);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-orange-500/20 rounded transition-all duration-300"
                      >
                        <Plus className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="bg-gray-900/30 border-t border-gray-700/50">
                        {table.columns.map((column) => (
                          <div
                            key={column.name}
                            className="flex items-center justify-between p-3 hover:bg-gray-700/20 transition-colors duration-300 group"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-4 h-4" />
                              <span className="text-gray-300 font-mono text-sm break-all">{column.name}</span> {/* ID自動換行 */}
                              <span className={`text-xs font-mono ${getDataTypeColor(column.type)}`}>{column.type}</span>
                            </div>
                            <button
                              onClick={() => insertIntoQuery(`\`${column.name}\` `)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-orange-500/20 rounded transition-all duration-300"
                            >
                              <Plus className="w-4 h-4 text-orange-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        // 摺疊時顯示的按鈕 (窄邊欄)，位置與邊界一致
        <div className="flex-shrink-0 flex flex-col items-center justify-start bg-gray-800/30 backdrop-blur-sm border-r border-orange-500/20 transition-all duration-300 ease-in-out"
             style={{ width: '48px' }} /* 調整為適合按鈕的固定窄寬度 */>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarCollapsed(false)}
            className="text-orange-400 mt-7 hover:text-orange-300 hover:bg-orange-500/10 transition-colors duration-300 w-9 h-9 rounded-full" // 與收起按鈕保持一致
            title="Expand Schema Panel"
          >
            <PanelLeftOpen className="h-10 w-10" /> {/* 圖標大小 */}
          </Button>
        </div>
      )}

      {/* 拖曳把手 (只有在側邊欄展開時顯示) */}
      {!isSidebarCollapsed && (
        <div
          className="w-2 bg-gray-700 hover:bg-orange-500 cursor-col-resize select-none touch-none flex items-center justify-center transition-colors duration-300"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        >
          <div className="w-1 h-8 bg-gray-500 rounded-full group-hover:bg-orange-300" />
        </div>
      )}

      {/* Main Content Area (flex-grow) */}
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        <div className="space-y-8">
          {/* Section 1: Query Details */}
          <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
            <h3 className="text-xl font-semibold text-orange-400 mb-4 flex items-center space-x-2">
              <Code className="w-5 h-5" />
              <span>Query Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-white font-medium">Query Name</Label>
                <Input
                  value={queryName}
                  onChange={(e) => {
                    setQueryName(e.target.value);
                    setTestSuccess(false);
                  }}
                  placeholder="Enter query name"
                  className="mt-2 bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <Label className="text-white font-medium">Dataset</Label>
                <Input
                  value={client.name}
                  readOnly
                  className="mt-2 bg-gray-700/50 border-gray-600/50 text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Section 2: SQL Editor */}
          <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
            <h3 className="text-xl font-semibold text-orange-400 mb-4 flex items-center space-x-2">
              <DatabaseZap className="w-5 h-5" />
              <span>SQL Editor</span>
            </h3>

            <div className="relative">
            <AceEditor
                ref={aceEditorRef} 
                mode="sql"
                theme="tomorrow_night" 
                name="sql_editor_instance"
                editorProps={{ $blockScrolling: true }}
                setOptions={{
                  enableBasicAutocompletion: true, 
                  enableLiveAutocompletion: true,  
                  enableSnippets: true,            
                  showLineNumbers: true,           
                  tabSize: 2,                      
                  useWorker: false,
                  fontSize: 20           
                }}
                value={sqlQuery}
                onChange={(newValue) => {
                  setSqlQuery(newValue);
                  setTestSuccess(false);
                }}
                height="256px" 
                width="100%"
                placeholder={`Example: SELECT * FROM \`${client.bigquery_dataset_id}.your_table_name\` LIMIT 100`}
                className="font-mono text-sm leading-relaxed"
                style={{ borderRadius: '0.5rem' }} 
              />
              <div className="absolute inset-0 rounded-md bg-orange-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>

            <div className="mt-4 flex items-center space-x-6 text-sm">
              <span className="text-gray-400">Lines: {sqlQuery.split('\n').length}</span>
              <span className="text-gray-400">Characters: {sqlQuery.length}</span>
              
            </div>
          </div>

          {/* Section 3: Sync Schedule */}
          <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
            <h3 className="text-xl font-semibold text-orange-400 mb-4 flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Sync Schedule</span>
            </h3>

            <div className="space-y-6">
              <div>
                <Label className="text-white font-medium">Frequency</Label>
                <div className="mt-2 flex space-x-2">
                  {['Once', 'Daily', 'Weekly', 'Monthly'].map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFrequency(freq)}
                      className={`px-4 py-2 rounded-lg border transition-all duration-300 ${
                        frequency === freq
                          ? 'bg-orange-500 text-black border-orange-500'
                          : 'bg-gray-800 text-gray-300 border-gray-600 hover:border-orange-500/50'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {frequency !== 'Once' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white font-medium">Hour</Label>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={hour}
                      onChange={(e) => setHour(Number.parseInt(e.target.value))}
                      className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
                      disabled={frequency === 'Once'} 
                    />
                  </div>
                  <div>
                    <Label className="text-white font-medium">Minute</Label>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={minute}
                      onChange={(e) => setMinute(Number.parseInt(e.target.value))}
                      className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
                      disabled={frequency === 'Once'} 
                    />
                  </div>
                </div>
              )}

              {frequency === 'Weekly' && (
                <div>
                  <Label className="text-white font-medium">Day of Week</Label>
                  <div className="mt-2 grid grid-cols-7 gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                      <div key={day} className="flex items-center space-x-2">
                        {/* Day of Week Checkbox 樣式調整 */}
                        <label
                          htmlFor={`day-${index}`}
                          className={`flex items-center justify-center p-2 rounded-md cursor-pointer transition-colors duration-200
                                       ${selectedDays.includes(index)
                                         ? 'bg-orange-500 text-black'
                                         : 'bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700'
                                       }`}
                        >
                          <Checkbox
                            id={`day-${index}`}
                            checked={selectedDays.includes(index)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDays((prev) => [...prev, index]);
                              } else {
                                setSelectedDays((prev) => prev.filter((d) => d !== index));
                              }
                            }}
                            className="sr-only" // 隱藏原生 checkbox
                          />
                          <span className="text-sm">{day}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {frequency === 'Monthly' && (
                <div>
                  <Label className="text-white font-medium">Day of Month</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number.parseInt(e.target.value))}
                    className="mt-2 bg-gray-900/50 border-gray-600/50 text-white max-w-32"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Output Destination */}
          <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
            <h3 className="text-xl font-semibold text-orange-400 mb-4 flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Output Destination</span>
            </h3>

            <div className="space-y-6">
              <div>
                <Label className="text-white font-medium">Output Type</Label>
                <div className="mt-2 flex space-x-2">
                  {['None', 'Google Sheets', 'Google Looker Studio'].map((type) => (
                    <button
                    key={type}
                    onClick={() => setOutputType(type)}
                    className={`px-4 py-2 rounded-lg border transition-all duration-300 ${
                      output_target === type
                        ? 'bg-orange-500 text-black border-orange-500'
                        : 'bg-gray-800 text-gray-300 border-gray-600 hover:border-orange-500/50'
                    }`}
                  >
                    {type}
                  </button>
                  ))}
                </div>
              </div>

              {output_target === 'Google Sheets' && (
                <div className="space-y-4">
                  {/* 原有的 Google Sheets 相關輸入框和提示 */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-blue-400 text-sm">
                          Please remember to grant 'Editor' access to 'lalae-client-data@my-project-for-bigquery-445809.iam.gserviceaccount.com'
                          <code className="bg-blue-500/20 px-2 py-1 rounded font-mono">service-account@gmail.com</code>
                      </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <Label className="text-white font-medium">Sheet ID</Label>
                          <Input
                              value={sheetId}
                              onChange={(e) => setSheetId(e.target.value)}
                              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                              className="mt-2 bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500"
                          />
                      </div>

                      <div>
                          <Label className="text-white font-medium">Tab Name</Label>
                          <Input
                              value={tabName}
                              onChange={(e) => setTabName(e.target.value)}
                              placeholder="Sheet1"
                              className="mt-2 bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500"
                          />
                      </div>
                  </div>

                  <div className="flex items-center space-x-3">
                      <Label htmlFor="append-mode-switch" className="text-white font-medium">Append Mode</Label>
                      <Switch
                          id="append-mode-switch"
                          checked={appendMode}
                          onCheckedChange={setAppendMode}
                          className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-600"
                      >
                          <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ease-in-out
                                          ${appendMode ? 'bg-orange-500' : 'bg-gray-600'}`}>
                              <span
                                  className={`absolute left-0 top-0 w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out
                                              ${appendMode ? 'translate-x-full' : 'translate-x-0'}`}>
                              </span>
                              <span className={`absolute inset-0 flex items-center justify-center text-xs font-semibold
                                                ${appendMode ? 'text-black' : 'text-white'}`}>
                                  {appendMode ? 'ON' : 'OFF'}
                              </span>
                          </div>
                      </Switch>
                      <span className="text-gray-400 text-sm">
                          {appendMode ? 'Add new rows to existing data' : 'Replace all data'}
                      </span>
                  </div>
                </div>
              )}

              {output_target === 'Google Looker Studio' && (
                <div>
                  <Label className="text-white font-medium">Email Address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="mt-2 bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Action Buttons */}
          <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-orange-400 flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Actions</span>
              </h3>
              {errorMessage && (
                <div className="flex items-center space-x-1 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {testMessage && !errorMessage && (
                <div className={`flex items-center space-x-1 text-sm ${testSuccess ? 'text-green-400' : 'text-yellow-400'}`}>
                  {testSuccess ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  <span>{testMessage}</span>
                </div>
              )}

              <div className="flex space-x-4">
                <Button
                  onClick={handleTest}
                  disabled={isLoading}
                  variant="outline"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 transition-all duration-300 shadow-lg hover:shadow-blue-500/25"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isLoading ? 'Testing...' : 'Test'}
                </Button>

                <Button
                  onClick={handleSendAndSave}
                  disabled={isLoading || !testSuccess || !queryName.trim() || !sqlQuery.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-black font-bold shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isLoading ? 'Sending...' : 'Send & Save'}
                </Button>

                <Button
                  onClick={handleSaveDraft}
                  disabled={isLoading || !queryName.trim() || !sqlQuery.trim()}
                  variant="ghost"
                  className="text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all duration-300"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save Draft'}
                </Button>
              </div>

              
            </div>
          </div>
          {previewData && previewColumns && previewData.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-lg font-semibold text-orange-300 mb-4 flex items-center space-x-2">
                    <Table className="w-5 h-5" />
                    <span>Query Preview (First {previewData.length} Rows)</span>
                  </h4>
                  <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-400">
                      <thead className="text-xs text-gray-300 uppercase bg-gray-700">
                        <tr>
                          {previewColumns.map((col, idx) => (
                            <th key={idx} scope="col" className="px-6 py-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, rowIndex) => (
                          <tr key={rowIndex} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700 transition-colors duration-200">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-6 py-4 whitespace-nowrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewData.length >= 5 && (
                    <p className="text-gray-500 text-xs mt-2">
                      Displaying first 5 rows. The full query may return more results.
                    </p>
                  )}
                </div>
              )}
        </div>
      </div>
    </div>
  );
}