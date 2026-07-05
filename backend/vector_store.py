import os
import sys

# Support importing sibling modules when run or linted from parent directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# pyrefly: ignore [missing-import]
import chromadb
# pyrefly: ignore [missing-import]
from chromadb.utils import embedding_functions
from database import get_schema_metadata

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")

def init_vector_store():
    """Reads table schemas from MySQL and indexes them in ChromaDB."""
    try:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        emb_fn = embedding_functions.DefaultEmbeddingFunction()
        collection = client.get_or_create_collection(
            name="mysql_schema",
            embedding_function=emb_fn
        )
        
        # Retrieve active schema from DB
        schemas = get_schema_metadata()
        if not schemas:
            print("ChromaDB: No schemas found in database to index.")
            return
            
        ids = []
        documents = []
        metadatas = []
        
        for table_info in schemas:
            table_name = table_info["table_name"]
            columns = table_info["columns"]
            
            # Build schema text chunk
            col_lines = []
            for col in columns:
                col_lines.append(f"  - {col['column_name']} ({col['type']})")
            columns_str = "\n".join(col_lines)
            
            doc = f"Table: {table_name}\nColumns:\n{columns_str}"
            
            ids.append(table_name)
            documents.append(doc)
            metadatas.append({"table_name": table_name})
            
        # Upsert items
        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
        print(f"ChromaDB: Successfully indexed {len(ids)} tables.")
    except Exception as e:
        print(f"ChromaDB: Error indexing database tables: {e}")

def retrieve_relevant_schema(query: str, top_k: int = 2) -> str:
    """Retrieves relevant table schema strings from ChromaDB based on the query."""
    try:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        collection = client.get_collection(
            name="mysql_schema",
            embedding_function=embedding_functions.DefaultEmbeddingFunction()
        )
        
        # Adjust top_k if there are fewer tables indexed
        count = collection.count()
        actual_k = min(top_k, count)
        if actual_k <= 0:
            return ""
            
        results = collection.query(
            query_texts=[query],
            n_results=actual_k
        )
        
        docs = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            
        return "\n\n".join(docs)
    except Exception as e:
        print(f"ChromaDB: Error retrieving schema context: {e}")
        return ""
