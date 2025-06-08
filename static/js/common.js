// Common JavaScript functions for all apps

// Tab switching function
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content and activate its button
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
}

// Initialize CodeMirror editor
function initializeCodeMirror(textareaId, options = {}) {
    const textarea = document.querySelector(`#${textareaId}`);
    if (!textarea) return null;

    const defaultOptions = {
        mode: 'text/x-sql',
        theme: 'monokai',
        lineNumbers: true,
        indentWithTabs: true,
        smartIndent: true,
        lineWrapping: true,
        matchBrackets: true,
        autofocus: true,
        viewportMargin: Infinity,
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Tab": function(cm) {
                if (cm.somethingSelected()) {
                    cm.indentSelection("add");
                } else {
                    cm.replaceSelection("  ", "end");
                }
            }
        }
    };

    const editor = CodeMirror.fromTextArea(textarea, { ...defaultOptions, ...options });

    // Auto-resize CodeMirror based on content
    editor.on("change", function() {
        const lineCount = editor.lineCount();
        const lineHeight = editor.defaultTextHeight();
        const newHeight = Math.min(lineCount * lineHeight + 20, window.innerHeight * 0.8);
        editor.setSize(null, newHeight);
    });

    // Initial resize
    editor.setSize(null, Math.min(editor.lineCount() * editor.defaultTextHeight() + 20, window.innerHeight * 0.8));

    return editor;
}

// Add Bootstrap classes to form fields
function initializeFormFields() {
    const formFields = document.querySelectorAll('input[type="text"], textarea, select');
    formFields.forEach(field => {
        field.classList.add('form-control');
    });
}

// Toggle columns visibility
function toggleColumns(header) {
    const columns = header.nextElementSibling;
    const icon = header.querySelector('.toggle-icon');
    columns.classList.toggle('show');
    icon.classList.toggle('rotated');
}

// Toggle dataset tables sidebar
function toggleDatasetTables() {
    const container = document.querySelector('.dataset-tables-container');
    const mainContent = document.querySelector('.main-content');
    const toggle = document.querySelector('.dataset-toggle');
    container.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
    toggle.classList.toggle('rotated');
}

// Insert table name into editor
function insertTableName(tableName) {
    const editor = document.querySelector('.CodeMirror').CodeMirror;
    const doc = editor.getDoc();
    const cursor = doc.getCursor();
    doc.replaceRange(tableName, cursor);
}

// Insert column name into editor
function insertColumnName(tableName, columnName) {
    const editor = document.querySelector('.CodeMirror').CodeMirror;
    const doc = editor.getDoc();
    const cursor = doc.getCursor();
    doc.replaceRange(`${tableName}.${columnName}`, cursor);
}

// Initialize query form functionality
function initializeQueryForm() {
    // Initialize form fields
    initializeFormFields();

    // Set description field height to match name field
    const descriptionField = document.querySelector('#{{ form.description.id_for_label }}');
    if (descriptionField) {
        descriptionField.style.height = '38px';
    }

    // Schedule frequency change handler
    const scheduleFrequency = document.querySelector('#{{ form.schedule_frequency.id_for_label }}');
    if (scheduleFrequency) {
        scheduleFrequency.addEventListener('change', function() {
            const frequency = this.value;
            document.querySelectorAll('.schedule-details').forEach(el => el.classList.remove('show'));
            if (frequency !== 'NONE') {
                document.getElementById(`${frequency.toLowerCase()}-schedule`).classList.add('show');
            }
        });
    }

    // Test Query button click handler
    const testButton = document.getElementById('testButton');
    if (testButton) {
        testButton.addEventListener('click', function() {
            const queryId = '{{ form.instance.pk }}';
            const url = queryId ? `/queries/${queryId}/test/` : '/queries/test/';
            
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    sql_query: editor.getValue()
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('Query test successful!');
                } else {
                    alert('Error: ' + data.error_message);
                }
            })
            .catch(error => {
                alert('Error: ' + error.message);
            });
        });
    }

    // Run Query button click handler
    const runButton = document.getElementById('runButton');
    if (runButton) {
        runButton.addEventListener('click', function() {
            const queryId = '{{ form.instance.pk }}';
            const url = queryId ? `/queries/${queryId}/run/` : '/queries/run/';
            
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    sql_query: editor.getValue()
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('Query execution started!');
                } else {
                    alert('Error: ' + data.error_message);
                }
            })
            .catch(error => {
                alert('Error: ' + error.message);
            });
        });
    }
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeFormFields();
}); 