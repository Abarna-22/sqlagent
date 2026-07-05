import os
import sys

# Support importing sibling modules when run or linted from parent directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import re
# pyrefly: ignore [missing-import]
from groq import Groq
from database import execute_query, log_audit
from vector_store import retrieve_relevant_schema
from safety import validate_sql

SYSTEM_PROMPT = """You are an expert SQL Assistant. Your task is to translate natural language questions into single, safe MySQL SELECT queries.

You MUST follow these rules:
1. ONLY generate SELECT statements. Do NOT generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE statements.
2. If the user asks you to perform a modification (e.g. delete, insert, update, drop, create) or if the database schema does not have the tables or columns necessary to answer the question, you MUST respond with exactly: CANNOT_ANSWER
3. Use only the tables and columns listed in the schema context below. Do not invent columns.
4. Ensure the query is valid MySQL.
5. If the query does not already have a LIMIT clause and could return many rows, append a LIMIT 100 clause.
6. Return ONLY the SQL query. Do not include any explanations, Markdown formatting other than optional ```sql ... ``` code blocks, or comments.
7. If you use table joins, specify the correct JOIN conditions.

Available Schema Context:
{schema_context}

Few-shot Examples:
Question: What is the total quantity of products sold in the 'Electronics' category?
Response:
```sql
SELECT SUM(o.quantity) AS total_sold FROM orders o JOIN products p ON o.product_id = p.id WHERE p.category = 'Electronics';
```

Question: Which employee has the highest salary, and what is their department?
Response:
```sql
SELECT name, department, salary FROM employees ORDER BY salary DESC LIMIT 1;
```

Question: Delete all records from the employees table.
Response:
CANNOT_ANSWER

Question: Show departments and their average employee salary.
Response:
```sql
SELECT department, AVG(salary) AS avg_salary FROM employees GROUP BY department;
```
"""

def extract_sql(text: str) -> str:
    """Parses the SQL code block or raw query from LLM response text."""
    text = text.strip()
    if "CANNOT_ANSWER" in text:
        return "CANNOT_ANSWER"
        
    # Match ```sql ... ```
    match = re.search(r'```sql\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
        
    # Match generic ``` ... ```
    match_plain = re.search(r'```\s*(.*?)\s*```', text, re.DOTALL)
    if match_plain:
        return match_plain.group(1).strip()
        
    return text

def run_query_agent(question: str) -> dict:
    """
    RAG + Text-to-SQL + Validation + Execution with a Self-Correction Loop.
    Logs result to MySQL audit table and returns JSON response metadata.
    """
    attempts = []
    status = "failed"
    final_sql = None
    results = []
    columns = []
    
    # 1. Retrieve relevant schema chunks via RAG
    schema_context = retrieve_relevant_schema(question, top_k=3)
    
    # 2. Setup LLM prompt messages
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(schema_context=schema_context)},
        {"role": "user", "content": f"Question: {question}"}
    ]
    
    max_attempts = 3
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        err_msg = "GROQ_API_KEY environment variable is not set."
        print(err_msg)
        return {
            "question": question,
            "status": "failed",
            "final_sql": None,
            "attempts": [{
                "attempt": 1,
                "sql": "N/A",
                "allowed": False,
                "error": err_msg
            }],
            "results": [],
            "columns": []
        }

    client = Groq(api_key=api_key)
    
    for attempt_idx in range(1, max_attempts + 1):
        try:
            # Call Groq LLM
            response = client.chat.completions.create(
                messages=messages,
                model="llama-3.3-70b-versatile",
                temperature=0.0
            )
            raw_content = response.choices[0].message.content
            sql = extract_sql(raw_content)
            
            # Case 1: LLM Refused
            if sql == "CANNOT_ANSWER":
                status = "refused"
                attempts.append({
                    "attempt": attempt_idx,
                    "sql": "CANNOT_ANSWER",
                    "allowed": False,
                    "error": "The agent determined the database schema cannot answer this question."
                })
                break
                
            # Case 2: Validate safety
            is_valid, safety_err = validate_sql(sql)
            if not is_valid:
                status = "blocked"
                attempts.append({
                    "attempt": attempt_idx,
                    "sql": sql,
                    "allowed": False,
                    "error": f"Safety Block: {safety_err}"
                })
                break  # Abort correction immediately on safety violation to prevent retrying dangerous queries
                
            # Case 3: Execute query against MySQL database
            try:
                cols, rows = execute_query(sql)
                # Successful execution!
                status = "success"
                final_sql = sql
                results = rows
                columns = cols
                attempts.append({
                    "attempt": attempt_idx,
                    "sql": sql,
                    "allowed": True,
                    "error": None
                })
                break
            except Exception as db_err:
                error_msg = str(db_err)
                attempts.append({
                    "attempt": attempt_idx,
                    "sql": sql,
                    "allowed": True,
                    "error": error_msg
                })
                
                # Check if we can retry
                if attempt_idx < max_attempts:
                    # Append the failed output and correction request context to message thread
                    messages.append({"role": "assistant", "content": raw_content})
                    correction_prompt = (
                        f"The previous SQL query you generated failed with a MySQL database error:\n"
                        f"Failed SQL: {sql}\n"
                        f"MySQL Error: {error_msg}\n\n"
                        f"Please analyze what went wrong, correct the table names, column names, join rules, or syntax, "
                        f"and generate a corrected SQL query. Remember to return ONLY the SQL query."
                    )
                    messages.append({"role": "user", "content": correction_prompt})
                else:
                    final_sql = sql
                    status = "failed"
                    
        except Exception as api_err:
            error_msg = f"Groq API Error: {str(api_err)}"
            attempts.append({
                "attempt": attempt_idx,
                "sql": "N/A",
                "allowed": False,
                "error": error_msg
            })
            status = "failed"
            break
            
    # Write audit log to database
    try:
        log_audit(
            question=question,
            status=status,
            final_sql=final_sql,
            attempts=attempts,
            num_attempts=len(attempts)
        )
    except Exception as audit_err:
        print(f"Failed to write to query_audit_log table: {audit_err}")
        
    return {
        "question": question,
        "status": status,
        "final_sql": final_sql,
        "attempts": attempts,
        "results": results,
        "columns": columns
    }

def explain_sql(sql: str) -> str:
    """Takes a SQL query and returns a plain English explanation of what it does."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return "Explanation unavailable: GROQ_API_KEY is not set."
        
    client = Groq(api_key=api_key)
    
    prompt = f"Please explain the following SQL query in simple, plain English. Keep it concise, no more than 3-4 sentences. Do not include markdown formatting like bolding or bullet points unless necessary.\n\nSQL:\n{sql}"
    
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            max_tokens=256,
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Error explaining SQL: {str(e)}"
