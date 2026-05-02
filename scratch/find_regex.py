
import sys

with open('src/pages/app/ChargerDetail.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    # Remove strings and comments for simple counting
    # This is very rough but might find something
    temp = line
    # Simple count of /
    count = temp.count('/')
    # Subtract / in common patterns
    count -= temp.count('//') * 2
    count -= temp.count('/*')
    count -= temp.count('*/')
    count -= temp.count('</')
    count -= temp.count('/>')
    
    if count % 2 != 0:
        print(f"Line {i+1}: {line.strip()}")
