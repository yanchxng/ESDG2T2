import os

with open('c:/Github Repos/ESDG2T2/payment-service/main.py', 'r') as f:
    lines = f.read().split('\n')

in_capture = False
out = []
for line in lines:
    if line.strip() == '@app.post(\"/api/payments/{payment_id}/capture\")':
        in_capture = True
        out.append(line)
        continue
    
    if in_capture and line.startswith('@app.post'):
        in_capture = False

    if in_capture and line.startswith('      conn ='):
        out.append(line)
    elif in_capture and line.startswith('      try:'):
        out.append(line)
    elif in_capture and line.startswith('            '):
        out.append(line[4:])
    elif in_capture and line.startswith('        finally:'):
        out.append(line[4:])
    elif in_capture and line.startswith('            await conn.close()'):
        out.append(line[4:])
    elif in_capture and line.startswith('          '):
        out.append(line[4:])
    else:
        out.append(line)

with open('c:/Github Repos/ESDG2T2/payment-service/main.py', 'w') as f:
    f.write('\n'.join(out))
