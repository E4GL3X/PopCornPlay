from pathlib import Path
import re
path = Path('public/index.html')
backup = path.with_suffix('.html.bak')
backup.write_text(path.read_text(encoding='utf-8'), encoding='utf-8')
text = path.read_text(encoding='utf-8')
text = re.sub(r'<!--([\s\S]*?)-->', '', text)
text = re.sub(r'/\*([\s\S]*?)\*/', '', text)
text = re.sub(r'(^|[^:\\n])//.*$', r'\1', text, flags=re.M)
path.write_text(text, encoding='utf-8')
print('done; backup created at', backup)
