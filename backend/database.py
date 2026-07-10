import os
from pathlib import Path
import time
import json
import pymysql
import pymysql.cursors
from datetime import date, datetime
from dotenv import load_dotenv

# Load environment variables from project root .env if available.
ROOT_DIR = Path(__file__).resolve().parent.parent
for env_path in (ROOT_DIR / '.env', Path(__file__).resolve().parent / '.env'):
    if env_path.exists():
        load_dotenv(env_path)

MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "sqlagent_user")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "sqlagent_pass")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "sqlagent_db")


def get_db_connection(max_retries=10, delay=3):
    """Establishes a database connection with a retry loop on startup."""
    attempt = 0
    while attempt < max_retries:
        try:
            conn = pymysql.connect(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database=MYSQL_DATABASE,
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=True,
                connect_timeout=5,
                charset="utf8mb4",
            )
            return conn
        except pymysql.MySQLError as exc:
            attempt += 1
            print(f"Database connection attempt {attempt} failed: {exc}. Retrying in {delay} seconds...")
            time.sleep(delay)
    raise RuntimeError(f"Failed to connect to MySQL database at {MYSQL_HOST}:{MYSQL_PORT} after {max_retries} attempts.")

def init_db():
    """Initializes the database schema and seeds it with sample data if empty."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Create departments table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS departments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE
                ) ENGINE=InnoDB;
            """)

            # Create employees table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS employees (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    department VARCHAR(100) NOT NULL,
                    salary DECIMAL(10, 2) NOT NULL,
                    hire_date DATE NOT NULL
                ) ENGINE=InnoDB;
            """)

            # Create products table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    price DECIMAL(10, 2) NOT NULL
                ) ENGINE=InnoDB;
            """)

            # Create orders table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    customer_name VARCHAR(100) NOT NULL,
                    product_id INT NOT NULL,
                    quantity INT NOT NULL,
                    order_date DATE NOT NULL,
                    total DECIMAL(10, 2) NOT NULL,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
                ) ENGINE=InnoDB;
            """)

            # Create users table for signup/login
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(150) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(128) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            """)

            # Create query_audit_log table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS query_audit_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    question TEXT NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    final_sql TEXT NULL,
                    attempts JSON NOT NULL,
                    num_attempts INT NOT NULL
                ) ENGINE=InnoDB;
            """)

            # Check if seeding is needed
            cursor.execute("SELECT COUNT(*) as count FROM departments;")
            if cursor.fetchone()['count'] == 0:
                print("Seeding database with sample data...")
                
                # 1. Seed departments
                departments = [
                    ("Engineering",),
                    ("Sales",),
                    ("Marketing",),
                    ("Finance",),
                    ("HR",)
                ]
                cursor.executemany("INSERT INTO departments (name) VALUES (%s);", departments)

                # 2. Seed employees (at least 8)
                employees = [
                    ("Alice Smith", "Engineering", 95000.00, "2022-01-15"),
                    ("Bob Jones", "Engineering", 105000.00, "2021-06-20"),
                    ("Charlie Brown", "Sales", 75000.00, "2023-03-10"),
                    ("Diana Prince", "Marketing", 85000.00, "2022-11-05"),
                    ("Evan Wright", "Finance", 90000.00, "2020-08-12"),
                    ("Fiona Gallagher", "HR", 65000.00, "2023-05-01"),
                    ("George Lopez", "Sales", 80000.00, "2022-02-28"),
                    ("Hannah Abbott", "Engineering", 115000.00, "2019-10-14")
                ]
                cursor.executemany(
                    "INSERT INTO employees (name, department, salary, hire_date) VALUES (%s, %s, %s, %s);", 
                    employees
                )

                # 3. Seed products (at least 5)
                products = [
                    ("Laptop", "Electronics", 1200.00),
                    ("Smartphone", "Electronics", 800.00),
                    ("Desk Chair", "Furniture", 250.00),
                    ("Coffee Maker", "Appliances", 80.00),
                    ("Running Shoes", "Apparel", 120.00)
                ]
                cursor.executemany("INSERT INTO products (name, category, price) VALUES (%s, %s, %s);", products)

                # 4. Seed orders (at least 7)
                # We fetch the inserted product IDs to map them properly
                cursor.execute("SELECT id, name FROM products;")
                prod_map = {row['name']: row['id'] for row in cursor.fetchall()}
                
                orders = [
                    ("John Doe", prod_map["Laptop"], 1, "2024-01-10", 1200.00),
                    ("Jane Smith", prod_map["Smartphone"], 2, "2024-01-15", 1600.00),
                    ("Bob Johnson", prod_map["Coffee Maker"], 4, "2024-01-20", 320.00), # 4 * 80
                    ("Alice Cooper", prod_map["Desk Chair"], 1, "2024-02-02", 250.00), # 1 * 250
                    ("Charlie Sheen", prod_map["Running Shoes"], 3, "2024-02-10", 360.00), # 3 * 120
                    ("David Hasselhoff", prod_map["Laptop"], 2, "2024-02-15", 2400.00), # 2 * 1200
                    ("Emma Watson", prod_map["Smartphone"], 1, "2024-02-20", 800.00) # 1 * 800
                ]
                cursor.executemany(
                    "INSERT INTO orders (customer_name, product_id, quantity, order_date, total) VALUES (%s, %s, %s, %s, %s);", 
                    orders
                )
                print("Seeding completed successfully.")
            else:
                print("Database already contains data. Seeding skipped.")
    finally:
        conn.close()

def execute_query(sql: str):
    """Executes a SQL query and returns column names and row values as a list of dicts."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            results = cursor.fetchall()
            # If no rows, cursor.description holds column info
            columns = [col[0] for col in cursor.description] if cursor.description else []
            # Serialize date/datetime objects for JSON compatibility
            serialized_results = []
            for row in results:
                serialized_row = {}
                for key, val in row.items():
                    if isinstance(val, (datetime, date)):
                        serialized_row[key] = val.isoformat()
                    elif isinstance(val, float) or hasattr(val, 'to_eng_string'): # handles decimal type
                        serialized_row[key] = float(val)
                    else:
                        serialized_row[key] = val
                serialized_results.append(serialized_row)
            return columns, serialized_results
    finally:
        conn.close()

def log_audit(question: str, status: str, final_sql: str | None, attempts: list, num_attempts: int):
    """Logs the query attempt details to query_audit_log table."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            attempts_json = json.dumps(attempts)
            cursor.execute(
                """
                INSERT INTO query_audit_log (question, status, final_sql, attempts, num_attempts)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (question, status, final_sql, attempts_json, num_attempts)
            )
    finally:
        conn.close()

def get_audit_logs():
    """Fetches all query audit logs from database sorted newest first."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, timestamp, question, status, final_sql, attempts, num_attempts FROM query_audit_log ORDER BY timestamp DESC;")
            logs = cursor.fetchall()
            for log in logs:
                if isinstance(log['timestamp'], (datetime, date)):
                    log['timestamp'] = log['timestamp'].isoformat()
                # Parse attempts JSON string back to Python list/dict if returned as string
                if isinstance(log['attempts'], str):
                    try:
                        log['attempts'] = json.loads(log['attempts'])
                    except Exception:
                        pass
            return logs
    finally:
        conn.close()


def create_user(name: str, email: str, password_hash: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s);",
                (name, email, password_hash),
            )
            return cursor.lastrowid
    finally:
        conn.close()


def get_user_by_email(email: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, email, password_hash FROM users WHERE email = %s;", (email,))
            return cursor.fetchone()
    finally:
        conn.close()


def get_schema_metadata():
    """Retrieves list of tables and column names with data types from the active database."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Query all table columns in the current database, excluding query_audit_log
            cursor.execute(
                """
                SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME != 'query_audit_log'
                ORDER BY TABLE_NAME, ORDINAL_POSITION;
                """,
                (MYSQL_DATABASE,)
            )
            rows = cursor.fetchall()
            
            schema = {}
            for row in rows:
                t_name = row['TABLE_NAME']
                c_name = row['COLUMN_NAME']
                d_type = row['DATA_TYPE']
                if t_name not in schema:
                    schema[t_name] = []
                schema[t_name].append({"column_name": c_name, "type": d_type})
                
            return [{"table_name": k, "columns": v} for k, v in schema.items()]
    finally:
        conn.close()
