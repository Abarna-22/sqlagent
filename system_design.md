# SQL Query Agent - System Design Document

This document contains the visual design specs, including the **System Flow Chart** and the **Use Case Model** for the SQL Query Agent.

---

## 📊 1. System Flow Chart

The flow chart below illustrates the complete operational workflow of the query pipeline, safety validation rules, database query execution, self-correction retry mechanism (up to 3 times), and audit logging.

![System Flowchart Diagram](C:/Users/Geethapriya/.gemini/antigravity-ide/brain/cccf49d4-8571-46f4-81e8-577747c27c46/system_flowchart_diagram_1783193476212.png)

```mermaid
flowchart TD
    Start([User inputs Question]) --> RetrieveRAG[Retrieve Relevant Table Schemas from ChromaDB]
    RetrieveRAG --> BuildPrompt[Construct System Prompt with Schema Context + Few-Shot Examples]
    BuildPrompt --> CallGroq[Query Groq API: llama-3.3-70b-versatile]
    
    CallGroq --> ParseResponse{Parse SQL Response}
    ParseResponse -->|Refusal / CANNOT_ANSWER| LogRefusal[Log status 'refused' with N/A SQL]
    LogRefusal --> ReturnRefusal[Return refusal response to UI]
    
    ParseResponse -->|Generated SQL| SafetyCheck{Run Safety Validator}
    
    SafetyCheck -->|Blocked: Non-SELECT, stack queries, dangerous keyword| LogBlocked[Log status 'blocked' in Audit Log]
    LogBlocked --> ReturnBlocked[Return Blocked safety warning to UI]
    
    SafetyCheck -->|Allowed| InitRetry[Set Attempt Count = 1]
    
    InitRetry --> RunSQL[Execute SQL Query in MySQL Database]
    
    RunSQL -->|Success| LogSuccess[Log status 'success' with final SQL and attempts JSON]
    LogSuccess --> ReturnSuccess[Return columns, rows, and attempts timeline to UI]
    
    RunSQL -->|Database Exception / Error| CheckAttempts{Is Attempt Count < 3?}
    
    CheckAttempts -->|Yes| IncrementRetry[Increment Attempt Count]
    IncrementRetry --> BuildCorrectionPrompt[Construct follow-up prompt with failed SQL + MySQL error logs]
    BuildCorrectionPrompt --> CallGroq
    
    CheckAttempts -->|No| LogFailed[Log status 'failed' with final SQL, errors list, and attempts JSON]
    LogFailed --> ReturnFailed[Return error logs and attempts timeline to UI]

    ReturnRefusal --> End([End Query Execution])
    ReturnBlocked --> End
    ReturnSuccess --> End
    ReturnFailed --> End
```

---

## 👥 2. Use Case Model

The Use Case Model identifies the actors (users and external systems interacting with the SQL Query Agent) and defines the system's boundary and functional use cases.

### Actors
1. **User (Actor)**: Plain-English business user asking questions and viewing query results.
2. **Administrator / Auditor (Actor)**: Oversees system operations, inspects governance logs, and audits AI actions.
3. **Groq LLM (System Actor)**: External LLM service used to generate and correct SQL code.
4. **ChromaDB Vector Store (System Actor)**: Manages semantic index search for schemas.
5. **MySQL Database (System Actor)**: Stores and executes queries against seeded transaction tables.

### Use Case Diagram (Mermaid)

![Use Case Model Diagram](C:/Users/Geethapriya/.gemini/antigravity-ide/brain/cccf49d4-8571-46f4-81e8-577747c27c46/usecase_model_diagram_1783193503126.png)

```mermaid
graph LR
    %% Actors
    User((User))
    Auditor((Auditor))
    Groq[Groq LLM API]
    Chroma[ChromaDB Vector Store]
    MySQL[MySQL Database]

    subgraph SystemBoundary ["SQL Query Agent System"]
        UC1[Ask Natural Language Question]
        UC2[View Query Results Table]
        UC3[Auto-Correct SQL Query]
        UC4[Inspect Query Audit History]
        UC5[View Attempts Timeline Details]
        UC6[Enforce Query Safety Rules]
    end

    %% User Interactions
    User --> UC1
    User --> UC2
    
    %% Auditor Interactions
    Auditor --> UC4
    Auditor --> UC5
    
    %% System Actor Dependencies
    UC1 -.->|Includes| UC6
    UC1 --> Chroma
    UC1 --> Groq
    
    UC3 --> Groq
    UC3 --> MySQL
    
    UC4 --> MySQL
    UC5 --> MySQL
    UC6 -.->|On Block| UC4
```

---

## 📝 Use Case Descriptions

### Use Case 1: Ask Natural Language Question
* **Primary Actor**: User
* **System Actors**: ChromaDB Vector Store, Groq LLM API, MySQL Database
* **Pre-conditions**: The user is on the "Agent Chat" tab and the database is populated.
* **Basic Flow**:
  1. The user inputs an English question (e.g. "Average salary in Engineering").
  2. The system queries ChromaDB for relevant tables.
  3. The system queries the Groq API to compile the question into a SELECT query.
  4. The system validates the query for safety.
  5. The query executes against MySQL.
  6. The system displays the resulting data table.
* **Post-conditions**: The action is logged to the `query_audit_log` database table.

### Use Case 2: Auto-Correct SQL Query
* **Primary Actor**: None (System Internal Trigger)
* **System Actors**: Groq LLM API, MySQL Database
* **Pre-conditions**: A valid SQL query was generated but thrown a database execution error (e.g. syntax error or unknown column).
* **Basic Flow**:
  1. The system catches the MySQL error.
  2. The system appends the failed SQL and raw error message to the conversational history context.
  3. The system calls Groq LLM to generate a corrected query.
  4. The system repeats validation and retries execution.
* **Post-conditions**: Each attempt is documented in the audit log attempts timeline. The loop triggers up to 3 times total.

### Use Case 3: Enforce Query Safety Rules
* **Primary Actor**: None (System Internal Trigger)
* **Pre-conditions**: A SQL query has been successfully generated by the LLM.
* **Basic Flow**:
  1. The safety engine scans the SQL query.
  2. It checks if the statement starts with `SELECT` (ignoring comments).
  3. It validates that none of the blocked keywords (e.g. `DROP`, `DELETE`, `UPDATE`) are in the query.
  4. It checks that no semicolons divide multiple statements.
  5. If safe, the query is passed to MySQL. If unsafe, execution is immediately blocked.
* **Post-conditions**: Unsafe queries are intercepted and logged as `blocked` in the audit logs.

### Use Case 4: Inspect Query Audit History
* **Primary Actor**: Auditor / Administrator
* **System Actors**: MySQL Database
* **Pre-conditions**: Queries have been executed, and logs have been recorded in the database.
* **Basic Flow**:
  1. The auditor switches to the "Audit Log" tab.
  2. The frontend sends a request to `/api/audit-log`.
  3. The backend fetches query audit logs from MySQL.
  4. The frontend renders the high-level stats cards and the search-filtered governance table.
* **Post-conditions**: Shows metrics, status flags, and final SQL query parameters.
