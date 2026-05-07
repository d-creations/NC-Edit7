import os, subprocess, json
req = json.dumps({'action': 'list_machines'}).encode('utf-8')
res = subprocess.run([r'c:\Users\damia\OneDrive\Dokumente\Projekte\NC-Edit7\nc-edit7-desktop\python_embedded\python.exe', r'c:\Users\damia\OneDrive\Dokumente\Projekte\NC-Edit7\ncplot7py\scripts\cgiserver.cgi'], input=req, env={**os.environ, 'REQUEST_METHOD': 'POST', 'CONTENT_LENGTH': str(len(req)), 'PYTHONPATH': r'c:\Users\damia\OneDrive\Dokumente\Projekte\NC-Edit7\ncplot7py\src'}, capture_output=True)
print(res.stdout.decode('utf-8'))
print(res.stderr.decode('utf-8'))