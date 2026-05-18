import json
import re

with open('eslint_report.json', 'r') as f:
    data = json.load(f)

for file in data:
    if not file['messages']:
        continue
        
    path = file['filePath']
    with open(path, 'r') as f:
        lines = f.readlines()
        
    # We will just print out the exact problems so we can fix them easily or we can write specific python replacements.
    # Let's try to automatically fix 'no-unused-vars' by commenting them out? No, that will break code.
    # What if we just print a summary of files to fix?
