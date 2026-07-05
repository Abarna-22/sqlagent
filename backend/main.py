import os
import sys
from pathlib import Path

# Support importing sibling modules when run or linted from parent directory
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.append(str(BACKEND_DIR))

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db, get_audit_logs
from vector_store import init_vector_store
from agent import run_query_agent, explain_sql

app = FastAPI(title="SQL Query Agent API", version="1.0.0")
STATIC_DIR = BACKEND_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)

# Enable CORS for development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to initialize DB and Vector Store
# Guarded so the app can still boot on Vercel even if MySQL or ChromaDB is unavailable.
@app.on_event("startup")
def startup_event():
    print("FastAPI: Initializing database connection...")
    try:
        init_db()
    except Exception as exc:
        print(f"FastAPI: Database initialization skipped due to error: {exc}")

    print("FastAPI: Initializing vector store schema index...")
    try:
        init_vector_store()
    except Exception as exc:
        print(f"FastAPI: Vector store initialization skipped due to error: {exc}")

    print("FastAPI: Startup initialization complete.")

class QueryRequest(BaseModel):
    question: str

@app.post("/api/query")
def post_query(request: QueryRequest):
    """Processes a natural language question, compiles it to SQL, runs it, and returns results."""
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    
    try:
        response_data = run_query_agent(question)
        return response_data
    except Exception as e:
        print(f"Error in post_query: {e}")
        raise HTTPException(status_code=500, detail=f"Internal agent execution error: {str(e)}")

from safety import validate_sql
from database import execute_query

class SandboxRequest(BaseModel):
    sql: str

@app.post("/api/sandbox")
def post_sandbox(request: SandboxRequest):
    """Allows raw SQL querying with safety validation checks."""
    sql = request.sql.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query cannot be empty.")
    
    # Safety Check
    is_valid, safety_err = validate_sql(sql)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Safety Check Failed: {safety_err}")
    
    try:
        cols, rows = execute_query(sql)
        return {"status": "success", "columns": cols, "results": rows}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database Error: {str(e)}")

@app.get("/api/audit-log")
def get_audit():
    """Retrieves all query logs from the database audit log."""
    try:
        logs = get_audit_logs()
        return logs
    except Exception as e:
        print(f"Error in get_audit: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit log: {str(e)}")

class ExplainRequest(BaseModel):
    sql: str

@app.post("/api/explain")
def post_explain(request: ExplainRequest):
    """Explains a SQL query in plain English."""
    sql = request.sql.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query cannot be empty.")
    try:
        explanation = explain_sql(sql)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to explain SQL: {str(e)}")

# Mount static directory for JS and CSS assets
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def read_index():
    """Serves the main single-page interface."""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return HTMLResponse(content="<h1>SQL Query Agent static folder is ready. Please write index.html</h1>", status_code=200)
