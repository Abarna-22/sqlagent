import re

BLOCKED_KEYWORDS = [
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", 
    "TRUNCATE", "REPLACE", "CREATE", "GRANT", "REVOKE"
]

def validate_sql(sql: str) -> tuple[bool, str | None]:
    """
    Validates that a SQL query is safe, SELECT-only, and free of injection vectors.
    Returns:
        (is_valid: bool, error_message: str | None)
    """
    if not sql:
        return False, "Query is empty."
        
    # Clean whitespace
    cleaned = sql.strip()
    
    # Remove single-line comments (-- ...) and multi-line comments (/* ... */)
    # to ensure they cannot bypass startswith or keyword checks.
    no_comments = re.sub(r'(--[^\n]*\n)|(--[^\n]*$)|(/\*.*?\*/)', '', cleaned, flags=re.DOTALL).strip()
    
    if not no_comments:
        return False, "Query consists only of comments."
        
    # Check if the query begins with SELECT (case-insensitive)
    if not no_comments.upper().startswith("SELECT"):
        return False, "Only SELECT statements are allowed."
        
    # Check for blocked keywords using word boundaries to avoid false positives on column or table names
    for keyword in BLOCKED_KEYWORDS:
        pattern = rf"\b{keyword}\b"
        if re.search(pattern, no_comments, re.IGNORECASE):
            return False, f"Dangerous write or schema modifying keyword '{keyword}' is blocked."
            
    # Check for stacked statements (stacked SQL injection)
    # Remove the very last trailing semicolon and verify no other semicolons exist
    no_trailing_semicolon = no_comments.rstrip(';').strip()
    if ';' in no_trailing_semicolon:
        return False, "Stacked queries (multiple statements separated by semicolons) are blocked."
        
    return True, None
