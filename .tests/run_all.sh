#!/bin/sh
cd "$(dirname "$0")/.."
set -e
for t in t_json_latex t_math_code_plot t_schema t_generate t_pdf_safe t_notes_pdf t_units t_demo t_callai t_proxy; do
  printf "%-18s" "$t"; node .tests/$t.mjs | tail -1
done
npx esbuild .tests/ssr/entry.jsx --bundle --platform=node --format=esm --jsx=automatic --loader:.css=empty --external:mermaid --external:mathjs --external:react --external:react-dom --external:react/jsx-runtime --outfile=.tests/ssr/out.mjs --log-level=error
printf "%-18s" "ssr_layouts"; node .tests/ssr/out.mjs | tail -1
