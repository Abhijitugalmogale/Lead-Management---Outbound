import sys
import json
import pdfplumber

def extract_pdf_data(pdf_path):
    extracted_tables = []
    text_snippets = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                # 1. Extract tables if present
                tables = page.extract_tables()
                for table in tables:
                    if table and len(table) > 1:
                        extracted_tables.append({
                            "page": page_idx + 1,
                            "rows": table
                        })

                # 2. Extract plain text
                text = page.extract_text()
                if text:
                    text_snippets.append(text)

        result = {
            "success": True,
            "page_count": len(pdf.pages) if 'pdf' in locals() else 0,
            "tables": extracted_tables,
            "full_text": "\n\n".join(text_snippets)
        }
    except Exception as e:
        result = {
            "success": False,
            "error": str(e)
        }

    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
    extract_pdf_data(sys.argv[1])
