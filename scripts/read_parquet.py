#!/usr/bin/env python3
"""
Helper script to read EEA Parquet files and convert to JSON
Handles DECIMAL types that parquetjs doesn't support
"""
import sys
import json
import pandas as pd

def read_parquet_to_json(file_path):
    """Read a Parquet file and return JSON array of records"""
    try:
        df = pd.read_parquet(file_path)
        # Convert to records (list of dicts)
        records = df.to_dict('records')
        # Convert numpy types to native Python types for JSON serialization
        for record in records:
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None
                elif hasattr(value, 'item'):  # numpy scalar
                    record[key] = value.item()
        return json.dumps(records)
    except Exception as e:
        return json.dumps({"error": str(e)})

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: read_parquet.py <file_path>"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = read_parquet_to_json(file_path)
    print(result)

