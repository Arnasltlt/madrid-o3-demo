# Fixing Parquet DECIMAL Type Issue

## Problem

The EEA Parquet files use DECIMAL type for some fields, which the `parquetjs` library doesn't support. This causes parsing errors:
```
Error parsing Parquet file: invalid parquet type: DECIMAL
```

## Solutions

### Option 1: Use Python/pandas (Recommended for Production)

1. Install pandas:
   ```bash
   pip3 install pandas pyarrow
   ```

2. The app will automatically use Python if available (future enhancement)

### Option 2: Use parquet-wasm (WebAssembly)

Install a WASM-based Parquet reader that supports DECIMAL:
```bash
npm install parquet-wasm
```

Then update `lib/data/eea.ts` to use `parquet-wasm` instead of `parquetjs`.

### Option 3: Convert Parquet to JSON (Temporary Workaround)

Use a Python script to convert Parquet files to JSON first, then parse JSON in Node.js.

## Current Status

The app currently falls back to mock data when Parquet parsing fails. This allows development and testing to continue while we implement a proper solution.

## Next Steps

1. Implement Python subprocess call to read Parquet files
2. OR switch to parquet-wasm library
3. OR convert Parquet files server-side before processing

For now, the app works with mock data for testing purposes.

