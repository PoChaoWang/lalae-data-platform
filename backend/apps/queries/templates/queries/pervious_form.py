{% extends 'base.html' %}

{% block extra_css %}
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/monokai.min.css">
{% endblock %}

{% block content %}
<!-- Dataset Tables Sidebar -->
<div class="dataset-tables-container">
    <div class="card h-100 border-0">
        <div class="card-header bg-white">
            <h5 class="card-title mb-0">Dataset Tables</h5>
            <button class="dataset-toggle" onclick="toggleDatasetTables()">
                <i class="fas fa-chevron-left"></i>
            </button>
        </div>
        <div class="dataset-tables">
            {% for table in dataset_tables %}
            <div class="table-item">
                <div class="table-header d-flex justify-content-between align-items-center" onclick="toggleColumns(this)">
                    <div class="d-flex align-items-center">
                        <span class="toggle-icon">+</span>
                        <strong>{{ table.name }}</strong>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="insertTableName('{{ table.name }}')">
                        Insert
                    </button>
                </div>
                <div class="table-columns">
                    {% for column in table.columns %}
                    <div class="column-item" onclick="insertColumnName('{{ table.name }}', '{{ column.name }}')">
                        <span class="column-name">{{ column.name }}</span>
                        <span class="column-type">{{ column.type }}({{ column.type }})</span>
                    </div>
                    {% endfor %}
                </div>
            </div>
            {% endfor %}
        </div>
    </div>
</div>

<!-- Main Content -->
<div class="main-content">
    <div class="container-fluid">
        <div class="d-flex justify-content-between align-items-center content-header">
            <h1>{% if form.instance.pk %}Edit Query{% else %}Create New Query{% endif %}</h1>
            <a href="{% url 'queries:query-list' %}" class="btn btn-secondary">Back to List</a>
        </div>

        <div class="card">
            <div class="card-body">
                <form method="post" novalidate>
                    {% csrf_token %}
                    
                    {% if form.non_field_errors %}
                    <div class="alert alert-danger">
                        {% for error in form.non_field_errors %}
                            {{ error }}
                        {% endfor %}
                    </div>
                    {% endif %}

                    <div class="mb-3">
                        <label for="{{ form.name.id_for_label }}" class="form-label">Name</label>
                        {{ form.name }}
                        {% if form.name.errors %}
                        <div class="invalid-feedback d-block">
                            {% for error in form.name.errors %}
                                {{ error }}
                            {% endfor %}
                        </div>
                        {% endif %}
                    </div>

                    <div class="mb-3">
                        <label for="{{ form.description.id_for_label }}" class="form-label">Description</label>
                        {{ form.description }}
                        {% if form.description.errors %}
                        <div class="invalid-feedback d-block">
                            {% for error in form.description.errors %}
                                {{ error }}
                            {% endfor %}
                        </div>
                        {% endif %}
                    </div>

                    <div class="mb-3">
                        <label for="{{ form.sql_query.id_for_label }}" class="form-label">SQL Query</label>
                        {{ form.sql_query }}
                        {% if form.sql_query.errors %}
                        <div class="invalid-feedback d-block">
                            {% for error in form.sql_query.errors %}
                                {{ error }}
                            {% endfor %}
                        </div>
                        {% endif %}
                        <div class="form-text">Enter your BigQuery SQL query here.</div>
                    </div>

                    <!-- Schedule and Output Tabs -->
                    <div class="schedule-output-tabs">
                        <div class="tab-header">
                            <button type="button" class="tab-button active" onclick="switchTab('schedule')">Schedule</button>
                            <button type="button" class="tab-button" onclick="switchTab('output')">Output</button>
                        </div>
                        
                        <!-- Schedule Tab Content -->
                        <div id="schedule-tab" class="tab-content active">
                            <div class="mb-3">
                                <label for="{{ form.schedule_frequency.id_for_label }}" class="form-label">Frequency</label>
                                {{ form.schedule_frequency }}
                            </div>
                            <div class="mb-3">
                                <label for="{{ form.schedule_start_datetime.id_for_label }}" class="form-label">Start Time</label>
                                {{ form.schedule_start_datetime }}
                            </div>
                            
                            <!-- Schedule Details -->
                            <div id="daily-schedule" class="schedule-details">
                                <div class="mb-3">
                                    <label class="form-label">Daily Time</label>
                                    <input type="time" class="form-control" name="daily_time" value="00:00">
                                </div>
                            </div>
                            
                            <div id="weekly-schedule" class="schedule-details">
                                <div class="mb-3">
                                    <label class="form-label">Day of Week</label>
                                    <select class="form-control" name="weekly_day">
                                        <option value="1">Monday</option>
                                        <option value="2">Tuesday</option>
                                        <option value="3">Wednesday</option>
                                        <option value="4">Thursday</option>
                                        <option value="5">Friday</option>
                                        <option value="6">Saturday</option>
                                        <option value="0">Sunday</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Time</label>
                                    <input type="time" class="form-control" name="weekly_time" value="00:00">
                                </div>
                            </div>
                            
                            <div id="monthly-schedule" class="schedule-details">
                                <div class="mb-3">
                                    <label class="form-label">Day of Month</label>
                                    <input type="number" class="form-control" name="monthly_day" min="1" max="31" value="1">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Time</label>
                                    <input type="time" class="form-control" name="monthly_time" value="00:00">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Output Tab Content -->
                        <div id="output-tab" class="tab-content">
                            <div class="mb-3">
                                <label for="{{ form.output_target.id_for_label }}" class="form-label">Target</label>
                                {{ form.output_target }}
                            </div>
                            <div class="mb-3">
                                <label for="{{ form.output_config.id_for_label }}" class="form-label">Configuration</label>
                                {{ form.output_config }}
                            </div>
                        </div>
                    </div>

                    <div class="d-grid gap-2 d-md-flex justify-content-md-end btn-group-query mt-4">
                        <div class="d-flex align-items-center me-auto">
                            <div id="queryStatus" class="me-3" style="display: none;">
                                <div class="d-flex align-items-center">
                                    <div class="spinner-border spinner-border-sm text-primary me-2" role="status" style="display: none;">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <span id="statusMessage" class="text-muted"></span>
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn btn-info" id="testButton">Test Query</button>
                        <button type="button" class="btn btn-success" id="runButton" disabled>Run Query</button>
                        <button type="submit" class="btn btn-primary" id="saveButton">Save Query</button>
                    </div>
                </form>

                <!-- Test Query Results -->
                <div id="testResults" class="mt-4" style="display: none;">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Test Results</h5>
                        </div>
                        <div class="card-body">
                            <div id="testResultsContent"></div>
                            <div id="testErrorContent" class="alert alert-danger" style="display: none;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

{% block extra_js %}
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/sql/sql.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/addon/hint/show-hint.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/addon/hint/sql-hint.js"></script>

<script>
    const datasetTables = {
        {% for table in dataset_tables %}
        "{{ table.name }}": {
            columns: [
                {% for column in table.columns %}
                "{{ column.name }}"{% if not forloop.last %},{% endif %}
                {% endfor %}
            ]
        }{% if not forloop.last %},{% endif %}
        {% endfor %}
    };
    
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize CodeMirror for SQL editor
        const sqlQueryField = document.querySelector('#{{ form.sql_query.id_for_label }}');
        const editor = CodeMirror.fromTextArea(sqlQueryField, {
            mode: 'text/x-sql',
            theme: 'monokai',
            lineNumbers: true,
            indentWithTabs: true,
            smartIndent: true,
            lineWrapping: true,
            matchBrackets: true,
            autofocus: true,
            extraKeys: {"Ctrl-Space": "autocomplete"},
            hintOptions: {
                tables: datasetTables
            }
        });
    
        // Initialize query form functionality
        const testButton = document.getElementById('testButton');
        const runButton = document.getElementById('runButton');
        const testResults = document.getElementById('testResults');
        const testResultsContent = document.getElementById('testResultsContent');
        const testErrorContent = document.getElementById('testErrorContent');
        const queryStatus = document.getElementById('queryStatus');
        const statusMessage = document.getElementById('statusMessage');
        const statusSpinner = queryStatus.querySelector('.spinner-border');
        let lastTestedQuery = ''; // Store the last tested query
    
        function updateStatus(message, isLoading = false) {
            queryStatus.style.display = 'block';
            statusMessage.textContent = message;
            statusSpinner.style.display = isLoading ? 'inline-block' : 'none';
        }
    
        // Add change listener to the editor - 改進版本
        editor.on('change', function() {
            const currentQuery = editor.getValue().trim();
            console.log('Editor changed. Current query length:', currentQuery.length); // Debug log
            console.log('Last tested query length:', lastTestedQuery.length); // Debug log
            
            if (currentQuery !== lastTestedQuery) {
                runButton.disabled = true;
                runButton.classList.remove('btn-success');
                runButton.classList.add('btn-secondary');
                updateStatus('Query modified. Please test again.', false);
            }
        });
    
        testButton.addEventListener('click', async function() {
            console.log('Test button clicked'); // Debug log
            const sqlQuery = editor.getValue().trim();
            console.log('SQL Query to test:', sqlQuery); // Debug log
            
            if (!sqlQuery) {
                alert('Please enter a SQL query first');
                return;
            }
    
            testButton.disabled = true;
            testButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Testing...';
            updateStatus('Connecting to BigQuery...', true);
            
            try {
                console.log('Sending request to test query'); // Debug log
                updateStatus('Sending query to BigQuery...', true);
                const response = await fetch('{% url "queries:test-query" %}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    },
                    body: JSON.stringify({ sql_query: sqlQuery })
                });
    
                console.log('Received response:', response); // Debug log
                const data = await response.json();
                
                if (response.ok) {
                    updateStatus('Query executed successfully', false);
                    testResults.style.display = 'block';
                    testErrorContent.style.display = 'none';
                    
                    // Display results in a table
                    let tableHtml = '<div class="table-responsive"><table class="table table-striped">';
                    if (data.results && data.results.length > 0) {
                        // Add header row
                        tableHtml += '<thead><tr>';
                        Object.keys(data.results[0]).forEach(key => {
                            tableHtml += `<th>${key}</th>`;
                        });
                        tableHtml += '</tr></thead>';
                        
                        // Add data rows
                        tableHtml += '<tbody>';
                        data.results.forEach(row => {
                            tableHtml += '<tr>';
                            Object.values(row).forEach(value => {
                                tableHtml += `<td>${value}</td>`;
                            });
                            tableHtml += '</tr>';
                        });
                        tableHtml += '</tbody>';
                    }
                    tableHtml += '</table></div>';
                    testResultsContent.innerHTML = tableHtml;
                    
                    // Enable run button and store the tested query
                    runButton.disabled = false;
                    runButton.classList.remove('btn-secondary');
                    runButton.classList.add('btn-success');
                    lastTestedQuery = sqlQuery;
                    
                    console.log('Test successful. Stored query length:', lastTestedQuery.length); // Debug log
                } else {
                    updateStatus('Query failed: ' + (data.error || 'Unknown error'), false);
                    testErrorContent.style.display = 'block';
                    testErrorContent.textContent = data.error || 'An error occurred while testing the query';
                    testResultsContent.innerHTML = '';
                    runButton.disabled = true;
                    runButton.classList.remove('btn-success');
                    runButton.classList.add('btn-secondary');
                    lastTestedQuery = ''; // Clear last tested query on failure
                }
            } catch (error) {
                console.error('Error:', error); // Debug log
                updateStatus('Error: ' + error.message, false);
                testErrorContent.style.display = 'block';
                testErrorContent.textContent = 'An error occurred while testing the query';
                testResultsContent.innerHTML = '';
                runButton.disabled = true;
                runButton.classList.remove('btn-success');
                runButton.classList.add('btn-secondary');
                lastTestedQuery = ''; // Clear last tested query on error
            } finally {
                testButton.disabled = false;
                testButton.textContent = 'Test Query';
            }
        });
    
        runButton.addEventListener('click', async function() {
            const queryName = document.getElementById('id_name').value.trim();
            if (!queryName) {
                alert('Please enter a query name before running the query.');
                return;
            }

            // Check if query name already exists
            try {
                const checkResponse = await fetch('{% url "queries:check-query-name" %}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    },
                    body: JSON.stringify({ name: queryName })
                });
                
                const checkData = await checkResponse.json();
                if (!checkData.is_available) {
                    alert('This query name already exists. Please choose a different name.');
                    return;
                }
            } catch (error) {
                console.error('Error checking query name:', error);
                alert('Error checking query name. Please try again.');
                return;
            }
            
            const sqlQuery = editor.getValue().trim();
            console.log('Run Query - SQL Query length:', sqlQuery.length); // Debug log
            console.log('Run Query - SQL Query content:', sqlQuery); // Debug log
            console.log('Run Query - Last tested query length:', lastTestedQuery.length); // Debug log
            
            if (!sqlQuery) {
                alert('Please enter a SQL query.');
                return;
            }

            // Check if the query has been modified since last test
            if (sqlQuery !== lastTestedQuery) {
                alert('Please test the query again before running it.');
                return;
            }

            // 確保 Run Query 按鈕是啟用狀態
            if (this.disabled) {
                alert('Please test the query first.');
                return;
            }

            // Disable the button and show loading state
            this.disabled = true;
            this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Running...';
            updateStatus('Running query...', true);

            try {
                const response = await fetch('{% url "queries:run-query" %}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    },
                    body: JSON.stringify({
                        sql_query: sqlQuery,
                        name: queryName
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    updateStatus('Query completed successfully', false);
                    setTimeout(() => {
                        window.location.href = '{% url "queries:query-list" %}';
                    }, 1000);
                } else {
                    updateStatus('Query failed: ' + data.error, false);
                    alert('Query failed: ' + data.error);
                }
            } catch (error) {
                console.error('Error:', error);
                updateStatus('Error: ' + error.message, false);
                alert('An error occurred while running the query.');
            } finally {
                // Re-enable the button and restore original text
                this.disabled = false;
                this.innerHTML = 'Run Query';
                // 失敗後重置按鈕狀態
                this.classList.remove('btn-success');
                this.classList.add('btn-secondary');
            }
        });
    
        // 確保頁面載入時 Run Query 按鈕處於正確狀態
        runButton.disabled = true;
        runButton.classList.remove('btn-success');
        runButton.classList.add('btn-secondary');

        // Add form submit handler
        const form = document.querySelector('form');
        const saveButton = document.getElementById('saveButton');
        
        // Add click handler for save button
        saveButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Save button clicked'); // Debug log
            
            // Update the textarea with the current editor content
            editor.save();
            
            // Get form data
            const nameInput = document.getElementById('id_name');
            const descriptionInput = document.getElementById('id_description');
            const sqlQuery = editor.getValue();
            
            // Validate required fields
            if (!nameInput || !nameInput.value.trim()) {
                alert('Please enter a query name');
                return;
            }
            
            if (!sqlQuery || !sqlQuery.trim()) {
                alert('Please enter a SQL query');
                return;
            }
            
            const data = {
                name: nameInput.value.trim(),
                sql_query: sqlQuery.trim(),
                description: descriptionInput ? descriptionInput.value.trim() : ''
            };
            
            console.log('Sending data:', data); // Debug log
            
            // Determine if this is an update or create
            const isUpdate = window.location.pathname.includes('/edit/');
            const queryId = isUpdate ? window.location.pathname.split('/')[2] : null;
            const url = isUpdate ? `/queries/save-query/${queryId}/` : '{% url "queries:save-query" %}';
            
            // Send AJAX request
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify(data)
            })
            .then(response => {
                console.log('Response received:', response); // Debug log
                return response.json();
            })
            .then(data => {
                console.log('Data received:', data); // Debug log
                if (data.success) {
                    window.location.href = '{% url "queries:query-list" %}';
                } else {
                    alert(data.error || 'Failed to save query');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while saving the query');
            });
        });
    });
</script>
{% endblock %}
{% endblock %} 