'use client';

import { useEffect, useRef } from 'react';
import * as CodeMirror from 'codemirror';

import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/mode/sql/sql';

const SQLEditor = () => {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      const editor = CodeMirror.fromTextArea(editorRef.current, {
        mode: 'text/x-sql',
        theme: 'monokai',
        lineNumbers: true,
      });

      editor.setValue("SELECT * FROM your_postgresql_table;");

      return () => {
        editor.toTextArea();
      };
    }
  }, []);

  return <textarea ref={editorRef} />;
};

export default SQLEditor;