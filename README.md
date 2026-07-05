# SQL Query Agent 🤖🔍

An AI-powered co-pilot that translates natural language questions into SQL, runs them safely against a live MySQL database, automatically corrects its own SQL query syntax or logical errors (up to 3 attempts), and logs a comprehensive audit trail for AI governance and accountability.

---

## 🏗️ Architecture & Pipeline Flow

The agent runs a highly robust, multi-stage processing pipeline on each user request:

```
[User Question]
       │
       ▼
1. [ChromaDB RAG Step] ──► Retrieves only relevant table schemas (minimizing context window)
       │
       ▼
2. [Groq LLM Generation] ──► Compiles question to MySQL query using a structured system prompt
       │
       ▼
3. [Safety Validator] ──► Scan: Reject non-SELECT, block write commands, block stacked (;) queries
       │
       ├─► (Blocked) ──► Log BLOCKED to Audit table ──► Return Safety Error
       │
       ▼ (Allowed)
4. [MySQL Query Execution]
       │
       ├─► (Success) ──► Log SUCCESS to Audit table ──► Return Results & Columns
       │
       └─► (Database Error) ──► 5. [Self-Correction Loop] 
                                      │
                                      ├── Feedback failed query + MySQL error message back to Groq
                                      ├── Re-generate corrected SQL query
                                      └── Retry up to 3 times total
```

---

## 🛠️ Technology Stack

* **Backend**: Python 3.11 with **FastAPI** as the web server framework and **PyMySQL** for database connections.
* **Vector Store**: **ChromaDB** (embedded persistent store) for semantic database schema indexing and retrieval.
* **Large Language Model**: **Groq API** running `llama-3.3-70b-versatile` with zero temperature for deterministic, accurate SQL generation.
* **Frontend**: Single Page Application built with **HTML5, CSS3 (Glassmorphism design, dark theme), and Vanilla JavaScript**.
* **Database**: **MySQL 8.0** hosting standard business schema tables and the audit logs.
* **Containerization**: **Docker & Docker Compose** for zero-dependency multi-service deployment.

---

## 📁 Directory Structure

```
sqlagent/
├── docker-compose.yml        # Docker Compose configuration (MySQL + FastAPI)
├── .env                      # Active credentials config (Git ignored)
├── .env.example              # Sample environment configuration template
├── .gitignore                # Files excluded from git tracking
├── backend/
│   ├── Dockerfile            # Container configuration for FastAPI
│   ├── requirements.txt      # Python dependencies list (pip-installed)
│   ├── .dockerignore         # Excluded container build files
│   ├── main.py               # FastAPI server endpoints & static folder mounting
│   ├── database.py           # MySQL operations, schema init, data seeding & audit logs
│   ├── vector_store.py       # ChromaDB schema vector indexing and retrieval
│   ├── safety.py             # SQL safety validation logic (Select-only, keywords check)
│   ├── agent.py              # Groq orchestrator & self-correction retry loop
│   └── static/
│       └── index.html        # SPA dashboard (Chat panel + Audit dashboard tab)
```

---

## ⚙️ Initial Setup

### 1. Requirements
Ensure you have the following installed on your machine:
* **Docker Desktop** (with the backend Linux container engine active)
* **Groq API Key** (You can create one for free at the [Groq Console](https://console.groq.com/keys))

### 2. Environment Configuration
The repository includes a `.env` file. Open the **[.env](file:///c:/Users/Geethapriya/OneDrive/Attachments/sqlagent/.env)** file and make sure the `GROQ_API_KEY` is set:

```env
# Groq API Configuration
GROQ_API_KEY=gsk_your_groq_api_key_here

# Database Configuration (Pre-configured for Docker network)
MYSQL_HOST=db
MYSQL_USER=sqlagent_user
MYSQL_PASSWORD=MonkeyDluffy@99
MYSQL_DATABASE=sql_query
MYSQL_ROOT_PASSWORD=MonkeyDluffy@99
```

*Note: `MYSQL_HOST` is configured to `db` which points to the MySQL container within the Docker bridge network. Do not change this to `localhost` inside the environment config file.*

---

## 🚀 Deployment

Start the application by running the following command in your terminal from the project root:

```powershell
docker compose up --build -d
```

### What happens behind the scenes:
1. Docker downloads MySQL and builds the FastAPI backend image.
2. The MySQL database starts.
3. The FastAPI server waits for MySQL to become healthy.
4. On startup, the FastAPI server check if MySQL contains data. If empty, it creates and seeds 4 tables (`departments`, `employees`, `products`, `orders`) with realistic business data.
5. The FastAPI server reads the active database schema columns and embeds them in **ChromaDB**.
6. The app becomes reachable at **`http://localhost:8000`**.

To stop the containers, run:
```powershell
docker compose down
```

---

## 🧪 Testing and Verification Guide

Open `http://localhost:8000` in your web browser and execute the following tests:

### 1. Standard RAG Query
* **Action**: Click the chip **"What is the average salary of employees?"** or type it and click **"Ask Agent"**.
* **Expectation**: The agent retrieves the `employees` schema structure, generates `SELECT AVG(salary) FROM employees;`, executes it, and renders a table with the average salary.

### 2. Safety Filter (Blocked Query)
* **Action**: Type **"Delete all records from employees table"** or **"Drop table products;"** and click **"Ask Agent"**.
* **Expectation**: The safety filter intercepts the query due to a forbidden keyword (`DELETE` / `DROP`). It prevents database contact, marks the attempt as **Blocked**, and logs it to the Audit dashboard.

### 3. Self-Correction Loop
* **Action**: Type **"Sort products by cost"** and click **"Ask Agent"**.
* **Expectation**: 
  - **Attempt 1**: Groq generates `SELECT * FROM products ORDER BY cost;`. MySQL returns `Unknown column 'cost' in 'order clause'` because the column is named `price` in the seed data.
  - **Correction**: The agent catches this error, sends the query and database error log back to Groq, and Groq corrects it to `SELECT * FROM products ORDER BY price;`.
  - **Attempt 2**: The query runs successfully. The UI displays both attempts and the final query tables!

### 4. Governance Audit Log
* **Action**: Click the **"Audit Log"** tab at the top.
* **Expectation**: Shows metrics (Total Queries, Success Rate, Corrections, Blocked) and a tabular query history log. Clicking **"Details"** on any query row opens a modal timeline displaying the exact SQL and errors generated in each attempt.

---

## 📊 Seed Database Schema Reference

* **departments** (`id` INT AUTO_INCREMENT PK, `name` VARCHAR)
* **employees** (`id` INT AUTO_INCREMENT PK, `name` VARCHAR, `department` VARCHAR, `salary` DECIMAL, `hire_date` DATE)
* **products** (`id` INT AUTO_INCREMENT PK, `name` VARCHAR, `category` VARCHAR, `price` DECIMAL)
* **orders** (`id` INT AUTO_INCREMENT PK, `customer_name` VARCHAR, `product_id` INT FK, `quantity` INT, `order_date` DATE, `total` DECIMAL)
* **query_audit_log** (`id` INT AUTO_INCREMENT PK, `timestamp` TIMESTAMP, `question` TEXT, `status` VARCHAR, `final_sql` TEXT, `attempts` JSON, `num_attempts` INT)
